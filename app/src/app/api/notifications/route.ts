import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { listNotificationsForUser } from '@/lib/notificationsServer';

// 현재 사용자의 인앱 알림 목록 + 안 읽은 개수
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await listNotificationsForUser(session.user.id);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error listing notifications:', error);
        return NextResponse.json({ error: 'Failed to list notifications' }, { status: 500 });
    }
}
