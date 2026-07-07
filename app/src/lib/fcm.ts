// 제로 의존성 FCM HTTP v1 클라이언트 (Node 런타임 전용 — crypto 사용).
// 서비스 계정(JSON)으로 RS256 JWT를 만들어 OAuth2 액세스 토큰을 받고 FCM v1로 발송한다.
// firebase-admin/google-auth-library를 추가하지 않으려고 최소 구현했다.
//
// 필요한 환경변수: FCM_SERVICE_ACCOUNT_JSON
//   = Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키(JSON) 전체 문자열.
import crypto from 'crypto';

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function loadServiceAccount(): ServiceAccount | null {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
        if (parsed.client_email && parsed.private_key && parsed.project_id) {
            return {
                client_email: parsed.client_email,
                // Vercel 등에서 개행이 리터럴 \n으로 들어오는 경우 복원
                private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
                project_id: parsed.project_id,
            };
        }
    } catch {
        /* invalid JSON → 미설정으로 취급 */
    }
    return null;
}

export function isFcmConfigured(): boolean {
    return loadServiceAccount() !== null;
}

let cachedToken: { token: string; exp: number } | null = null;

function base64url(input: Buffer | string): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64url(
        JSON.stringify({
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        }),
    );
    const signingInput = `${header}.${claim}`;
    const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key);
    const jwt = `${signingInput}.${base64url(signature)}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });
    if (!res.ok) throw new Error(`FCM oauth token failed: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in?: number };
    cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
    return cachedToken.token;
}

export type PushResult = { token: string; ok: boolean; invalid: boolean };

// 여러 기기 토큰으로 동일 알림 발송. 등록 해제/무효 토큰은 invalid=true로 표시(호출측이 정리).
export async function sendPushToTokens(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
): Promise<PushResult[]> {
    const sa = loadServiceAccount();
    if (!sa || tokens.length === 0) return [];

    const accessToken = await getAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    const results: PushResult[] = [];
    for (const token of tokens) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: { title: payload.title, body: payload.body },
                        data: payload.data ?? {},
                        android: {
                            priority: 'HIGH',
                            notification: { channel_id: 'coparent' },
                        },
                        apns: { payload: { aps: { sound: 'default' } } },
                    },
                }),
            });
            if (res.ok) {
                results.push({ token, ok: true, invalid: false });
            } else {
                const errText = await res.text();
                // 등록 해제/무효 토큰은 정리 대상으로 표시
                const invalid =
                    res.status === 404 ||
                    /UNREGISTERED|NOT_FOUND|invalid.?(registration|argument)/i.test(errText);
                results.push({ token, ok: false, invalid });
            }
        } catch {
            results.push({ token, ok: false, invalid: false });
        }
    }
    return results;
}
