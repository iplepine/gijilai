import { NextResponse } from 'next/server';
import { generateReport } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized. Please login to generate reports.' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { userName, scores, type, systemPrompt, model = 'gpt-4o', answers, parentScores, isPreview = false } = body;

        // Basic validation
        if (!userName || !scores || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: userName, scores, or type' },
                { status: 400 }
            );
        }

        if (type !== 'PARENT' && type !== 'CHILD' && type !== 'HARMONY') {
            return NextResponse.json(
                { error: 'Invalid type. Must be PARENT, CHILD, or HARMONY.' },
                { status: 400 }
            );
        }

        // Potential Payment Check (Mocked for now since schema is missing is_paid field)
        // In a real scenario, we'd check if the user has a valid payment for this child/report.
        // const { data: profile } = await supabase.from('profiles').select('is_paid').eq('id', session.user.id).single();
        // if (!profile?.is_paid) { ... }

        const report = await generateReport(
            userName,
            scores,
            type as any,
            systemPrompt,
            model,
            answers,
            parentScores,
            isPreview
        );

        return NextResponse.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        return NextResponse.json(
            { error: 'Failed to generate report' },
            { status: 500 }
        );
    }
}
