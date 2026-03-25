import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
    try {
        const { sessionId } = await request.json();

        if (!sessionId) {
            return NextResponse.json(
                { error: 'Missing sessionId' },
                { status: 400 }
            );
        }

        const [sessionRes, consultsRes, practicesRes] = await Promise.all([
            supabase.from('consultation_sessions').select('*').eq('id', sessionId).single(),
            supabase.from('consultations').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
            supabase.from('practice_items').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
        ]);

        if (sessionRes.error) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // 실천 로그 & 회고
        const practiceIds = (practicesRes.data || []).map(p => p.id);
        let logs: any[] = [];
        let reviews: any[] = [];

        if (practiceIds.length > 0) {
            const [logsRes, reviewsRes] = await Promise.all([
                supabase.from('practice_logs').select('*').in('practice_id', practiceIds).order('date', { ascending: true }),
                supabase.from('practice_reviews').select('*').in('practice_id', practiceIds),
            ]);
            logs = logsRes.data || [];
            reviews = reviewsRes.data || [];
        }

        return NextResponse.json({
            session: sessionRes.data,
            consultations: consultsRes.data || [],
            practices: practicesRes.data || [],
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
