import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import type { Database } from '@/types/supabase';

type SessionRow = Database['public']['Tables']['consultation_sessions']['Row'];
type ConsultationRow = Database['public']['Tables']['consultations']['Row'];
type PracticeItemRow = Database['public']['Tables']['practice_items']['Row'];
type PracticeLogRow = Database['public']['Tables']['practice_logs']['Row'];
type PracticeReviewRow = Database['public']['Tables']['practice_reviews']['Row'];
type SessionContextRequest = {
    sessionId?: string;
};

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sessionId } = (await request.json()) as SessionContextRequest;

        if (!sessionId) {
            return NextResponse.json(
                { error: 'Missing sessionId' },
                { status: 400 }
            );
        }

        const [sessionRes, consultsRes, practicesRes] = await Promise.all([
            supabase.from('consultation_sessions').select('*').eq('id', sessionId).eq('user_id', session.user.id).single(),
            supabase.from('consultations').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
            supabase.from('practice_items').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
        ]);

        if (sessionRes.error) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // 실천 로그 & 회고
        const practiceIds = (practicesRes.data || []).map(p => p.id);
        let logs: PracticeLogRow[] = [];
        let reviews: PracticeReviewRow[] = [];

        if (practiceIds.length > 0) {
            const [logsRes, reviewsRes] = await Promise.all([
                supabase.from('practice_logs').select('*').in('practice_id', practiceIds).order('date', { ascending: true }),
                supabase.from('practice_reviews').select('*').in('practice_id', practiceIds),
            ]);
            logs = logsRes.data || [];
            reviews = reviewsRes.data || [];
        }

        return NextResponse.json({
            session: sessionRes.data as SessionRow,
            consultations: (consultsRes.data || []) as ConsultationRow[],
            practices: (practicesRes.data || []) as PracticeItemRow[],
            logs,
            reviews,
        });
    } catch (error) {
        console.error('Error fetching session context:', error);
        return NextResponse.json(
            { error: 'Failed to fetch session context' },
            { status: 500 }
        );
    }
}
