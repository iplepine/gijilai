import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { markNotificationsRead } from '@/lib/notificationsServer';

// 알림 읽음 처리. body.ids가 있으면 해당 항목만, 없으면 안 읽은 전체를 읽음 처리.
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let ids: string[] | undefined;
        try {
            const body = await request.json();
            if (Array.isArray(body?.ids)) {
                ids = body.ids.filter((x: unknown): x is string => typeof x === 'string');
            }
        } catch {
            // body 없음 → 전체 읽음 처리
        }

        await markNotificationsRead(session.user.id, ids);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error marking notifications read:', error);
        return NextResponse.json({ error: 'Failed to mark notifications read' }, { status: 500 });
    }
}
