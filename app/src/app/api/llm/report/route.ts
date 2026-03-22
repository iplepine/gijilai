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

        const userId = session.user.id;
        const body = await request.json();
        const {
            userName, scores, type, model = 'gpt-4o', answers,
            parentScores, isPreview = false, childType, parentType,
            refresh = false,
            intake, styleScores
        } = body;

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

        // 1. 캐시 확인 (refresh가 아닐 때)
        if (!refresh) {
            const { data: cachedRows, error: cacheError } = await supabase
                .from('reports')
                .select('analysis_json, created_at, is_paid')
                .eq('user_id', userId)
                .eq('type', type)
                .order('created_at', { ascending: false })
                .limit(1);

            if (cacheError) {
                console.error('[Report API] Cache query error:', cacheError);
            }

            if (cachedRows && cachedRows.length > 0) {
                console.log(`[Report API] Returning cached ${type} report`);
                return NextResponse.json({
                    report: cachedRows[0].analysis_json,
                    createdAt: cachedRows[0].created_at,
                    cached: true
                });
            }
        }

        // 2. Child 프로필 조회/생성
        let childId: string | null = null;
        const { data: existingChildren, error: childQueryError } = await supabase
            .from('children')
            .select('id')
            .eq('parent_id', userId)
            .limit(1);

        if (childQueryError) {
            console.error('[Report API] Child query error:', childQueryError);
        }

        if (existingChildren && existingChildren.length > 0) {
            childId = existingChildren[0].id;
        } else if (intake) {
            const { data: newChild, error: childInsertError } = await supabase
                .from('children')
                .insert({
                    parent_id: userId,
                    name: intake.childName || '아이',
                    gender: intake.gender || 'male',
                    birth_date: intake.birthDate || new Date().toISOString().split('T')[0],
                    birth_time: intake.birthTime || null,
                    image_url: null,
                })
                .select('id')
                .single();

            if (childInsertError) {
                console.error('[Report API] Child insert error:', childInsertError);
            } else {
                childId = newChild?.id || null;
            }
        }

        // 3. Survey 저장
        let surveyId: string | null = null;
        if (childId) {
            const surveyType = type === 'HARMONY' ? 'PARENTING_STYLE' : type;
            const surveyScores = type === 'HARMONY' ? (styleScores || scores) : scores;
            // answers를 Record 형태로 변환 (배열 → 객체)
            const answersRecord: Record<string, number> = {};
            if (Array.isArray(answers)) {
                answers.forEach((a: any) => { answersRecord[a.questionId] = a.score; });
            }

            const { data: survey, error: surveyError } = await supabase
                .from('surveys')
                .insert({
                    user_id: userId,
                    child_id: childId,
                    type: surveyType,
                    answers: answersRecord,
                    scores: surveyScores,
                    status: 'COMPLETED',
                })
                .select('id')
                .single();

            if (surveyError) {
                console.error('[Report API] Survey insert error:', surveyError);
            } else {
                surveyId = survey?.id || null;
            }
        }

        // 4. LLM 호출
        console.log(`[Report API] Generating ${type} report via LLM (refresh=${refresh})`);
        const report = await generateReport(
            userName, scores, type as any, undefined, model,
            answers, parentScores, isPreview, childType, parentType
        );

        // 5. DB 저장 (childId/surveyId 없어도 캐시를 위해 저장)
        // refresh 시 기존 리포트 삭제
        if (refresh) {
            const { error: deleteError } = await supabase
                .from('reports')
                .delete()
                .eq('user_id', userId)
                .eq('type', type);
            if (deleteError) console.error('[Report API] Delete error:', deleteError);
        }

        const { error: reportError } = await supabase
            .from('reports')
            .insert({
                user_id: userId,
                child_id: childId,
                survey_id: surveyId,
                type,
                analysis_json: report as any,
                model_used: model,
                is_paid: !isPreview,
            });

        if (reportError) {
            console.error('[Report API] Report save error:', reportError);
        } else {
            console.log(`[Report API] ${type} report saved to DB (childId=${childId}, surveyId=${surveyId})`);
        }

        return NextResponse.json({
            report,
            createdAt: new Date().toISOString(),
            cached: false
        });
    } catch (error) {
        console.error('[Report API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate report' },
            { status: 500 }
        );
    }
}
