/**
 * OpenAI 크레딧이 소진되면 사용자에게는 일반 생성 오류로만 보여 운영자가 알아채지 못한다(2026-10 사고).
 * OpenAI 클라이언트의 fetch를 감싸 insufficient_quota 응답을 감지하고 운영 알림을 보낸다.
 */

const QUOTA_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const ALERT_WEBHOOK_TIMEOUT_MS = 3_000;

export const OPENAI_QUOTA_ALERT_MESSAGE =
    '[기질아이] OpenAI 크레딧이 소진되어 리포트·상담 생성이 실패하고 있습니다. 충전: https://platform.openai.com/settings/organization/billing/';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function isInsufficientQuotaBody(body: unknown): boolean {
    if (!body || typeof body !== 'object') return false;
    const error = (body as { error?: { code?: unknown; type?: unknown } }).error;
    return error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota';
}

/**
 * 서버 로그에 `[OPS ALERT]`로 남기고, `OPS_ALERT_WEBHOOK_URL`(Slack incoming webhook 호환 `{ text }`)이
 * 설정돼 있으면 함께 보낸다. 알림 실패가 본 요청 흐름을 막지 않는다.
 */
export async function sendOpsAlert(text: string, fetchImpl: FetchLike = fetch): Promise<void> {
    console.error(`[OPS ALERT] ${text}`);
    const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        await fetchImpl(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(ALERT_WEBHOOK_TIMEOUT_MS),
        });
    } catch (error) {
        console.error('[OPS ALERT] webhook delivery failed:', error);
    }
}

/**
 * 429 응답 본문이 insufficient_quota면 쿨다운(인스턴스당 30분) 안에서 한 번만 알린다.
 * 서버리스에서 응답 반환 후 작업이 끊길 수 있어 알림을 기다린 뒤 원래 응답을 돌려준다.
 */
export function createQuotaAlertingFetch(
    baseFetch: FetchLike = (input, init) => fetch(input, init),
    now: () => number = Date.now,
    alert: (text: string) => Promise<void> = sendOpsAlert,
): FetchLike {
    let lastAlertAt: number | null = null;

    return async (input, init) => {
        const response = await baseFetch(input, init);
        if (response.status !== 429) return response;

        const body = await response.clone().json().catch(() => null);
        if (!isInsufficientQuotaBody(body)) return response;

        const currentTime = now();
        if (lastAlertAt === null || currentTime - lastAlertAt >= QUOTA_ALERT_COOLDOWN_MS) {
            lastAlertAt = currentTime;
            await alert(OPENAI_QUOTA_ALERT_MESSAGE);
        }
        return response;
    };
}
