import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isFcmConfigured, sendPushToTokens } from '@/lib/fcm';
import { composeCoParentPushText, type NotificationRecord } from '@/lib/notificationPush';

export const runtime = 'nodejs';

function admin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

// Supabase Database Webhook: public.notifications INSERT → 수신자 기기로 FCM 푸시.
// 인앱 알림(026 트리거)이 만든 row를 기기 푸시로 확장한다. 헤더 시크릿으로 인증.
//   webhook 설정: x-webhook-secret: <NOTIFICATION_WEBHOOK_SECRET>
//   payload(Supabase): { type:'INSERT', table, schema, record:{...}, old_record }
export async function POST(request: Request) {
    try {
        const secret = process.env.NOTIFICATION_WEBHOOK_SECRET;
        const provided = request.headers.get('x-webhook-secret');
        if (!secret || provided !== secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // FCM 미설정이어도 인앱 알림은 이미 동작하므로 조용히 통과(배포/설정 순서 무관하게 안전).
        if (!isFcmConfigured()) {
            return NextResponse.json({ ok: true, skipped: 'fcm_not_configured' });
        }

        const body = await request.json().catch(() => null);
        const record = body?.record as (NotificationRecord & { user_id?: string }) | undefined;
        if (!record || record.type !== 'CO_PARENT_CONSULTATION' || !record.user_id) {
            return NextResponse.json({ ok: true, skipped: 'not_applicable' });
        }

        const recipientId = record.user_id;
        const supabase = admin();

        // 수신자 푸시 선호(기본 ON). 인앱은 항상 남고, 이 값은 기기 푸시만 좌우.
        const { data: profile } = await supabase
            .from('profiles')
            .select('coparent_push_enabled')
            .eq('id', recipientId)
            .maybeSingle();
        if (profile && (profile as { coparent_push_enabled?: boolean }).coparent_push_enabled === false) {
            return NextResponse.json({ ok: true, skipped: 'opted_out' });
        }

        const { data: tokenRows } = await supabase
            .from('device_tokens')
            .select('token')
            .eq('user_id', recipientId);
        const tokens = (tokenRows ?? []).map((r) => (r as { token: string }).token);
        if (tokens.length === 0) {
            return NextResponse.json({ ok: true, skipped: 'no_tokens' });
        }

        const text = await composeCoParentPushText(supabase, record);
        const results = await sendPushToTokens(tokens, {
            title: text.title,
            body: text.body,
            data: {
                type: 'CO_PARENT_CONSULTATION',
                sessionId: record.session_id ?? '',
                url: text.url,
            },
        });

        // 등록 해제/무효 토큰 정리
        const invalid = results.filter((r) => r.invalid).map((r) => r.token);
        if (invalid.length > 0) {
            await supabase.from('device_tokens').delete().in('token', invalid);
        }

        return NextResponse.json({
            ok: true,
            sent: results.filter((r) => r.ok).length,
            pruned: invalid.length,
        });
    } catch (error) {
        console.error('notification-created webhook error:', error);
        return NextResponse.json({ error: 'dispatch_failed' }, { status: 500 });
    }
}
