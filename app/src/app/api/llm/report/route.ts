import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { formatSurveyAnswersForPrompt, generateReport, openai, type ReportType } from '@/lib/openai';
import { buildServerTimingHeader, createPerfTracker } from '@/lib/perf';
import { CHILD_REPORT_STREAM_PROMPT } from '@/lib/prompts';
import { createClient } from '@/lib/supabaseServer';
import type { ChildAiReport } from '@/lib/report';
import type { Json } from '@/types/supabase';

const REPORT_MODEL = 'gpt-4o-mini';

type TemperamentScores = { NS: number; HA: number; RD: number; P: number };
type AnswerItem = { questionId: string; score: number };
type TemperamentSummary = { label: string; keywords: string[] };
type ChildInfo = { name: string; gender: string; birthDate: string };
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
    stream?: boolean;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ChildDimensionMap = NonNullable<NonNullable<ChildAiReport['analysis']>['dimensions']>;
type ChildInsight = NonNullable<ChildAiReport['analysis']>['insight'];
const REPORT_SCORE_KEYS = ['NS', 'HA', 'RD', 'P'] as const;
type ChildReportStreamModule =
    | { module: 'intro'; data: { title?: string; intro?: string } }
    | { module: 'dimensions'; data: { dimensions?: ChildDimensionMap } }
    | { module: 'insight'; data: { insight?: ChildInsight } }
    | { module: 'strengths'; data: { strengths?: string } }
    | { module: 'parentingTips'; data: { parentingTips?: ChildAiReport['parentingTips'] } }
    | { module: 'scripts'; data: { scripts?: ChildAiReport['scripts']; shareText?: string } };

function isReportType(value: unknown): value is ReportType {
    return value === 'PARENT' || value === 'CHILD' || value === 'HARMONY';
}

function isChildReportValid(value: unknown): value is ChildAiReport {
    if (!value || typeof value !== 'object') return false;
    const report = value as ChildAiReport;
    return !!(
        report.intro
        && report.analysis?.dimensions
        && REPORT_SCORE_KEYS.every((key) => {
            const dimension = report.analysis?.dimensions?.[key];
            return typeof dimension === 'string' && dimension.trim().length > 0;
        })
    );
}

function isChildReportComplete(value: unknown): value is ChildAiReport {
    if (!isChildReportValid(value)) return false;
    return !!(
        value.analysis?.insight
        && value.analysis.strengths
        && Array.isArray(value.parentingTips)
        && value.parentingTips.length > 0
        && Array.isArray(value.scripts)
        && value.scripts.length > 0
    );
}

function applyChildReportStreamModule(report: ChildAiReport, item: ChildReportStreamModule) {
    if (item.module === 'intro') {
        report.title = item.data.title;
        report.intro = item.data.intro;
        return;
    }

    if (item.module === 'dimensions') {
        report.analysis = { ...report.analysis, dimensions: item.data.dimensions };
        return;
    }

    if (item.module === 'insight') {
        report.analysis = { ...report.analysis, insight: item.data.insight };
        return;
    }

    if (item.module === 'strengths') {
        report.analysis = { ...report.analysis, strengths: item.data.strengths };
        return;
    }

    if (item.module === 'parentingTips') {
        report.parentingTips = item.data.parentingTips;
        return;
    }

    report.scripts = item.data.scripts;
    report.shareText = item.data.shareText;
}

function normalizeStreamLine(line: string) {
    return line.trim().replace(/^```(?:jsonl|json)?/i, '').replace(/```$/i, '').trim();
}

function calculateChildAgeLabel(birthDate: string) {
    const birth = new Date(birthDate);
    const today = new Date();
    const yearDiff = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();
    let months = yearDiff * 12 + monthDiff;
    if (dayDiff < 0) months--;
    const normalizedMonths = Math.max(0, months);
    const age = Math.floor(normalizedMonths / 12);
    return `${age}세 (${normalizedMonths}개월)`;
}

function buildChildReportStreamPayload(params: {
    userName: string;
    scores: TemperamentScores;
    answers?: AnswerItem[];
    childType?: TemperamentSummary;
    childInfo: ChildInfo | null;
}) {
    const payload: Record<string, unknown> = {
        userName: params.userName,
        type: 'CHILD',
        surveyDetails: formatSurveyAnswersForPrompt('CHILD', params.answers),
        scores: params.scores,
    };

    if (params.childType) payload.childType = params.childType;
    if (params.childInfo) {
        payload.childInfo = {
            name: params.childInfo.name,
            gender: params.childInfo.gender === 'male' ? '남아' : (params.childInfo.gender === 'female' ? '여아' : params.childInfo.gender),
            age: calculateChildAgeLabel(params.childInfo.birthDate),
        };
    }

    return JSON.stringify(payload);
}

async function resolveChildForReport(params: {
    supabase: SupabaseServerClient;
    userId: string;
    clientChildId?: string | null;
    intake?: IntakePayload | null;
}) {
    const { supabase, userId, clientChildId, intake } = params;
    let childId: string | null = clientChildId || null;
    let childInfo: ChildInfo | null = null;

    if (childId) {
        const { data, error } = await supabase
            .from('children')
            .select('name, gender, birth_date')
            .eq('id', childId)
            .eq('parent_id', userId)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('CHILD_NOT_FOUND');
        childInfo = { name: data.name, gender: data.gender, birthDate: data.birth_date };
    } else {
        const { data, error } = await supabase
            .from('children')
            .select('id, name, gender, birth_date')
            .eq('parent_id', userId)
            .limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
            childId = data[0].id;
            childInfo = { name: data[0].name, gender: data[0].gender, birthDate: data[0].birth_date };
        }
    }

    if (!childId && intake) {
        const { data, error } = await supabase
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
        if (error) throw error;
        childId = data.id;
        childInfo = { name: data.name, gender: data.gender, birthDate: data.birth_date };
    }

    return { childId, childInfo };
}

async function insertCompletedSurvey(params: {
    supabase: SupabaseServerClient;
    userId: string;
    childId: string | null;
    type: 'CHILD' | 'PARENT' | 'PARENTING_STYLE';
    answers?: AnswerItem[];
    scores: TemperamentScores;
}) {
    if (!params.childId) return null;

    const answersRecord: Record<string, number> = {};
    if (Array.isArray(params.answers)) {
        params.answers.forEach((answer) => {
            answersRecord[answer.questionId] = answer.score;
        });
    }

    const { data, error } = await params.supabase
        .from('surveys')
        .insert({
            user_id: params.userId,
            child_id: params.childId,
            type: params.type,
            answers: answersRecord,
            scores: params.scores,
            status: 'COMPLETED',
        })
        .select('id')
        .single();
    if (error) throw error;
    return data?.id ?? null;
}

function streamChildReportResponse(params: {
    supabase: SupabaseServerClient;
    userId: string;
    userName: string;
    scores: TemperamentScores;
    answers?: AnswerItem[];
    childType?: TemperamentSummary;
    refresh: boolean;
    intake?: IntakePayload | null;
    clientChildId?: string | null;
}) {
    const encoder = new TextEncoder();
    const perf = createPerfTracker('Report Stream API', { type: 'CHILD', refresh: params.refresh });

    const body = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            try {
                send('started', { type: 'CHILD' });

                if (!params.refresh) {
                    let cacheQuery = params.supabase
                        .from('reports')
                        .select('id, analysis_json, created_at, is_paid')
                        .eq('user_id', params.userId)
                        .eq('type', 'CHILD');

                    if (params.clientChildId) {
                        cacheQuery = cacheQuery.eq('child_id', params.clientChildId);
                    }

                    const { data: cachedRows, error: cacheError } = await cacheQuery
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (cacheError) throw cacheError;
                    perf.mark('cache_query', { cacheHit: !!cachedRows?.length });

                    const cachedReport = cachedRows?.[0]?.analysis_json;
                    if (isChildReportValid(cachedReport)) {
                        send('cached', {
                            report: cachedReport as Json,
                            reportId: cachedRows[0].id,
                            createdAt: cachedRows[0].created_at,
                        });
                        send('completed', {
                            report: cachedReport as Json,
                            reportId: cachedRows[0].id,
                            createdAt: cachedRows[0].created_at,
                            cached: true,
                            timings: perf.getSegments(),
                        });
                        return;
                    }
                }

                const { childId, childInfo } = await resolveChildForReport({
                    supabase: params.supabase,
                    userId: params.userId,
                    clientChildId: params.clientChildId,
                    intake: params.intake,
                });
                perf.mark('child_lookup', { childId });

                const surveyId = await insertCompletedSurvey({
                    supabase: params.supabase,
                    userId: params.userId,
                    childId,
                    type: 'CHILD',
                    answers: params.answers,
                    scores: params.scores,
                });
                perf.mark('survey_insert', { hasSurveyId: !!surveyId });

                const userMessage = buildChildReportStreamPayload({
                    userName: params.userName,
                    scores: params.scores,
                    answers: params.answers,
                    childType: params.childType,
                    childInfo,
                });
                perf.mark('prompt_prepared', { payloadBytes: userMessage.length });

                const completionStream = await openai.chat.completions.create({
                    model: REPORT_MODEL,
                    messages: [
                        { role: 'system', content: CHILD_REPORT_STREAM_PROMPT },
                        { role: 'user', content: userMessage },
                    ],
                    temperature: 0.7,
                    stream: true,
                });

                const report: ChildAiReport = {};
                let lineBuffer = '';
                const processLine = (rawLine: string) => {
                    const line = normalizeStreamLine(rawLine);
                    if (!line || !line.startsWith('{')) return;

                    const parsed = JSON.parse(line) as ChildReportStreamModule;
                    applyChildReportStreamModule(report, parsed);
                    perf.mark(`module_${parsed.module}`);
                    send('module', parsed as unknown as Record<string, unknown>);
                };

                for await (const chunk of completionStream) {
                    const delta = chunk.choices[0]?.delta?.content ?? '';
                    if (!delta) continue;
                    lineBuffer += delta;

                    let newlineIndex = lineBuffer.indexOf('\n');
                    while (newlineIndex >= 0) {
                        const line = lineBuffer.slice(0, newlineIndex);
                        lineBuffer = lineBuffer.slice(newlineIndex + 1);
                        processLine(line);
                        newlineIndex = lineBuffer.indexOf('\n');
                    }
                }

                if (lineBuffer.trim()) {
                    processLine(lineBuffer);
                }
                perf.mark('openai_stream_completed');

                if (!isChildReportComplete(report)) {
                    throw new Error('INVALID_STREAMED_CHILD_REPORT');
                }

                const { data: savedReport, error: reportError } = await params.supabase
                    .from('reports')
                    .insert({
                        user_id: params.userId,
                        child_id: childId,
                        survey_id: surveyId,
                        type: 'CHILD',
                        analysis_json: report as Json,
                        model_used: REPORT_MODEL,
                        is_paid: false,
                    })
                    .select('id')
                    .single();
                if (reportError) throw reportError;
                perf.mark('report_insert', { hasReportId: !!savedReport?.id });

                if (params.refresh && savedReport?.id) {
                    let deleteQuery = params.supabase
                        .from('reports')
                        .delete()
                        .eq('user_id', params.userId)
                        .eq('type', 'CHILD')
                        .neq('id', savedReport.id);
                    if (childId) {
                        deleteQuery = deleteQuery.eq('child_id', childId);
                    }
                    const { error: deleteError } = await deleteQuery;
                    if (deleteError) console.error('[Report Stream API] Delete previous reports error:', deleteError);
                    perf.mark('refresh_cleanup');
                }

                send('completed', {
                    report: report as Json,
                    reportId: savedReport?.id || null,
                    createdAt: new Date().toISOString(),
                    cached: false,
                    timings: perf.getSegments(),
                });
            } catch (error) {
                perf.fail(error);
                console.error('[Report Stream API] Error:', error);
                send('error', { error: 'Failed to generate streamed report' });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(body, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}

export async function POST(request: Request) {
    const perf = createPerfTracker('Report API');

    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        perf.mark('auth_session', { hasSession: !!session });

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized. Please login to generate reports.' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const body = await parseJsonBody<ReportRequestBody>(request);
        const {
            userName, scores, type, answers,
            parentScores, childType, parentType,
            refresh = false,
            intake, styleScores,
            childId: clientChildId,
            stream = false
        } = body;
        perf.mark('request_parsed', {
            type,
            refresh,
            userId,
            requestedChildId: clientChildId ?? null,
            stream,
        });

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

        if (stream) {
            if (type !== 'CHILD') {
                return NextResponse.json(
                    { error: 'Streaming reports are currently supported for CHILD only.' },
                    { status: 400 }
                );
            }

            return streamChildReportResponse({
                supabase,
                userId,
                userName,
                scores,
                answers,
                childType,
                refresh,
                intake,
                clientChildId,
            });
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

            perf.mark('cache_query', { cacheHit: !!cachedRows?.length });

            if (cachedRows && cachedRows.length > 0) {
                console.log(`[Report API] Returning cached ${type} report (childId=${clientChildId})`);
                const response = NextResponse.json({
                    report: cachedRows[0].analysis_json,
                    reportId: cachedRows[0].id,
                    createdAt: cachedRows[0].created_at,
                    cached: true,
                    timings: perf.getSegments(),
                });
                response.headers.set('Server-Timing', buildServerTimingHeader(perf.getSegments()));
                return response;
            }
        }

        // 2. Child 프로필 조회/생성
        let childId: string | null = clientChildId || null;
        let childInfo: { name: string, gender: string, birthDate: string } | null = null;

        if (childId) {
            const { data, error: childLookupError } = await supabase
                .from('children')
                .select('name, gender, birth_date')
                .eq('id', childId)
                .eq('parent_id', userId)
                .maybeSingle();
            if (childLookupError) {
                console.error('[Report API] Child lookup error:', childLookupError);
                return NextResponse.json({ error: 'CHILD_LOOKUP_FAILED' }, { status: 500 });
            }
            if (!data) {
                return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
            }
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

        perf.mark('child_lookup', { childId: childId ?? null });
        
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

            perf.mark('child_create', { childId: childId ?? null });
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

        perf.mark('survey_insert', { hasSurveyId: !!surveyId });

        // 4. LLM 호출
        console.log(`[Report API] Generating ${type} report via LLM (refresh=${refresh})`);
        const report = await generateReport(
            userName, scores, type, undefined,
            answers, parentScores, childType, parentType, childInfo
        );
        perf.mark('openai_report');

        // 5. DB 저장 (childId/surveyId 없어도 캐시를 위해 저장)
        // refresh에서도 새 리포트 저장이 성공한 뒤 이전 리포트만 정리한다.
        const { data: savedReport, error: reportError } = await supabase
            .from('reports')
            .insert({
                user_id: userId,
                child_id: childId,
                survey_id: surveyId,
                type,
                analysis_json: report as Json,
                model_used: REPORT_MODEL,
                is_paid: false,
            })
            .select('id')
            .single();

        if (reportError) {
            console.error('[Report API] Report save error:', reportError);
            throw reportError;
        } else {
            console.log(`[Report API] ${type} report saved to DB (id=${savedReport?.id}, childId=${childId}, surveyId=${surveyId})`);
        }
        perf.mark('report_insert', { hasReportId: !!savedReport?.id });

        if (refresh && savedReport?.id) {
            let deleteQuery = supabase
                .from('reports')
                .delete()
                .eq('user_id', userId)
                .eq('type', type)
                .neq('id', savedReport.id);
            if (childId) {
                deleteQuery = deleteQuery.eq('child_id', childId);
            }
            const { error: deleteError } = await deleteQuery;
            if (deleteError) console.error('[Report API] Delete previous reports error:', deleteError);
            perf.mark('refresh_cleanup');
        }

        const timings = perf.getSegments();
        const response = NextResponse.json({
            report,
            reportId: savedReport?.id || null,
            createdAt: new Date().toISOString(),
            cached: false,
            timings,
        });
        response.headers.set('Server-Timing', buildServerTimingHeader(timings));
        return response;
    } catch (error) {
        if (isInvalidJsonBodyError(error)) {
            return invalidJsonResponse();
        }

        perf.fail(error);
        console.error('[Report API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate report' },
            { status: 500 }
        );
    }
}
