import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

const PLATFORMS = new Set(['ios', 'android', 'web']);

// FCM 기기 토큰 등록/갱신. 네이티브 앱이 토큰을 획득해 WebView(=세션 보유)를 통해 호출한다.
// 토큰은 기기당 고유 → onConflict(token)로 계정 전환 시 user_id 재매핑. admin으로 세션 user에 스코프.
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => null);
        const token = typeof body?.token === 'string' ? body.token.trim() : '';
        const platform = typeof body?.platform === 'string' ? body.platform.toLowerCase() : '';
        if (!token || !PLATFORMS.has(platform)) {
            return NextResponse.json({ error: 'Invalid token or platform' }, { status: 400 });
        }

        const { error } = await admin()
            .from('device_tokens')
            .upsert(
                { token, user_id: session.user.id, platform, updated_at: new Date().toISOString() },
                { onConflict: 'token' },
            );
        if (error) throw error;

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error registering device token:', error);
        return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
    }
}

// 로그아웃/알림 해제 시 토큰 제거(본인 것만).
export async function DELETE(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => null);
        const token = typeof body?.token === 'string' ? body.token.trim() : '';
        if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

        await admin()
            .from('device_tokens')
            .delete()
            .eq('token', token)
            .eq('user_id', session.user.id);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error deleting device token:', error);
        return NextResponse.json({ error: 'Failed to delete token' }, { status: 500 });
    }
}
