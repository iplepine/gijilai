import { NextResponse } from 'next/server';
import { generateReport, type ReportType } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import type { Json } from '@/types/supabase';

type TemperamentScores = { NS: number; HA: number; RD: number; P: number };
type AnswerItem = { questionId: string; score: number };
type TemperamentSummary = { label: string; keywords: string[] };
type IntakePayload = {
    childName?: string;
    gender?: 'male' | 'female';
    birthDate?: string;
};
type ReportRequestBody = {
    userName?: string;
    scores?: TemperamentScores;
    type?: ReportType;
    answers?: AnswerItem[];
    parentScores?: TemperamentScores;
    childType?: TemperamentSummary;
    parentType?: TemperamentSummary;
    refresh?: boolean;
    intake?: IntakePayload | null;
    styleScores?: TemperamentScores;
    childId?: string | null;
};

function isReportType(value: unknown): value is ReportType {
    return value === 'PARENT' || value === 'CHILD' || value === 'HARMONY';
}

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
        const body = (await request.json()) as ReportRequestBody;
        const {
            userName, scores, type, answers,
            parentScores, childType, parentType,
            refresh = false,
            intake, styleScores,
            childId: clientChildId
        } = body;

        if (!userName || !scores || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: userName, scores, or type' },
                { status: 400 }
            );
        }

        if (!isReportType(type)) {
            return NextResponse.json(
                { error: 'Invalid type. Must be PARENT, CHILD, or HARMONY.' },
                { status: 400 }
            );
        }

        // 1. 캐시 확인 (refresh가 아닐 때)
        if (!refresh) {
            let cacheQuery = supabase
                .from('reports')
                .select('id, analysis_json, created_at, is_paid')
                .eq('user_id', userId)
                .eq('type', type);

            if (clientChildId) {
                cacheQuery = cacheQuery.eq('child_id', clientChildId);
            }

            const { data: cachedRows, error: cacheError } = await cacheQuery
                .order('created_at', { ascending: false })
                .limit(1);

            if (cacheError) {
                console.error('[Report API] Cache query error:', cacheError);
            }

            if (cachedRows && cachedRows.length > 0) {
                console.log(`[Report API] Returning cached ${type} report (childId=${clientChildId})`);
                return NextResponse.json({
                    report: cachedRows[0].analysis_json,
                    reportId: cachedRows[0].id,
                    createdAt: cachedRows[0].created_at,
                    cached: true
                });
            }
        }

        // 2. Child 프로필 조회/생성
        let childId: string | null = clientChildId || null;
        let childInfo: { name: string, gender: string, birthDate: string } | null = null;

        if (childId) {
            const { data } = await supabase
                .from('children')
                .select('name, gender, birth_date')
                .eq('id', childId)
                .single();
            if (data) childInfo = { name: data.name, gender: data.gender, birthDate: data.birth_date };
        } else {
            const { data: existingChildren, error: childQueryError } = await supabase
                .from('children')
                .select('id, name, gender, birth_date')
                .eq('parent_id', userId)
                .limit(1);

            if (childQueryError) {
                console.error('[Report API] Child query error:', childQueryError);
            }

            if (existingChildren && existingChildren.length > 0) {
                childId = existingChildren[0].id;
                childInfo = { name: existingChildren[0].name, gender: existingChildren[0].gender, birthDate: existingChildren[0].birth_date };
            }
        }
        
        if (!childId && intake) {
            const { data: newChild, error: childInsertError } = await supabase
                .from('children')
                .insert({
                    parent_id: userId,
                    name: intake.childName || '아이',
                    gender: intake.gender || 'male',
                    birth_date: intake.birthDate || new Date().toISOString().split('T')[0],
                    birth_time: null,
                    image_url: null,
                })
                .select('id, name, gender, birth_date')
                .single();

            if (childInsertError) {
                console.error('[Report API] Child insert error:', childInsertError);
            } else if (newChild) {
                childId = newChild.id;
                childInfo = { name: newChild.name, gender: newChild.gender, birthDate: newChild.birth_date };
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
                answers.forEach((a) => { answersRecord[a.questionId] = a.score; });
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
            userName, scores, type, undefined,
            answers, parentScores, childType, parentType, childInfo
        );

        // 5. DB 저장 (childId/surveyId 없어도 캐시를 위해 저장)
        // refresh 시 기존 리포트 삭제
        if (refresh) {
            let deleteQuery = supabase
                .from('reports')
                .delete()
                .eq('user_id', userId)
                .eq('type', type);
            if (childId) {
                deleteQuery = deleteQuery.eq('child_id', childId);
            }
            const { error: deleteError } = await deleteQuery;
            if (deleteError) console.error('[Report API] Delete error:', deleteError);
        }

        const { data: savedReport, error: reportError } = await supabase
            .from('reports')
            .insert({
                user_id: userId,
                child_id: childId,
                survey_id: surveyId,
                type,
                analysis_json: report as Json,
                model_used: 'gpt-4o-mini',
                is_paid: false,
            })
            .select('id')
            .single();

        if (reportError) {
            console.error('[Report API] Report save error:', reportError);
        } else {
            console.log(`[Report API] ${type} report saved to DB (id=${savedReport?.id}, childId=${childId}, surveyId=${surveyId})`);
        }

        return NextResponse.json({
            report,
            reportId: savedReport?.id || null,
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
