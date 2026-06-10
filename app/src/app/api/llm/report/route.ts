import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { formatSurveyAnswersForPrompt, generateReport, openai, type ReportType } from '@/lib/openai';
import { buildServerTimingHeader, createPerfTracker } from '@/lib/perf';
import { CHILD_REPORT_STREAM_PROMPT, PARENT_REPORT_STREAM_PROMPT } from '@/lib/prompts';
import { createClient } from '@/lib/supabaseServer';
import { normalizeTemperamentDimensions, type ChildAiReport, type ParentAiReport } from '@/lib/report';
import { CHILD_PROFILE_LIMIT_REACHED_CODE, getServerChildProfileAccess } from '@/lib/access';
import { consumeLlmQuota, LLM_QUOTA_EXCEEDED_CODE } from '@/lib/llm-quota';
import { CHILD_NAME_PSEUDONYM, unmaskChildNameDeep } from '@/lib/childPseudonym';
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
type ParentDimensionMap = NonNullable<ParentAiReport['dimensions']>;
const REPORT_SCORE_KEYS = ['NS', 'HA', 'RD', 'P'] as const;
type ChildReportStreamModule =
    | { module: 'intro'; data: { title?: string; intro?: string } }
    | { module: 'dimensions'; data: { dimensions?: ChildDimensionMap } }
    | { module: 'insight'; data: { insight?: ChildInsight } }
    | { module: 'strengths'; data: { strengths?: string } }
    | { module: 'parentingTips'; data: { parentingTips?: ChildAiReport['parentingTips'] } }
    | { module: 'scripts'; data: { scripts?: ChildAiReport['scripts']; shareText?: string } };
const CHILD_REPORT_STREAM_MODULES = ['intro', 'dimensions', 'insight', 'strengths', 'parentingTips', 'scripts'] as const;
type ParentReportStreamModule =
    | { module: 'intro'; data: { title?: string; intro?: string } }
    | { module: 'dimensions'; data: { dimensions?: ParentDimensionMap } }
    | { module: 'shining'; data: { shining?: string } }
    | { module: 'parentingStyle'; data: { parentingStyle?: ParentAiReport['parentingStyle'] } }
    | { module: 'vulnerability'; data: { vulnerability?: string } }
    | { module: 'solutions'; data: { solutions?: ParentAiReport['solutions'] } }
    | { module: 'letter'; data: { letter?: string } };
const PARENT_REPORT_STREAM_MODULES = ['intro', 'dimensions', 'shining', 'parentingStyle', 'vulnerability', 'solutions', 'letter'] as const;

function isReportType(value: unknown): value is ReportType {
    return value === 'PARENT' || value === 'CHILD' || value === 'HARMONY';
}

function isChildReportStreamModule(value: unknown): value is ChildReportStreamModule {
    if (!value || typeof value !== 'object') return false;
    const item = value as { module?: unknown; data?: unknown };
    return typeof item.module === 'string'
        && CHILD_REPORT_STREAM_MODULES.includes(item.module as typeof CHILD_REPORT_STREAM_MODULES[number])
        && !!item.data
        && typeof item.data === 'object';
}

function isParentReportStreamModule(value: unknown): value is ParentReportStreamModule {
    if (!value || typeof value !== 'object') return false;
    const item = value as { module?: unknown; data?: unknown };
    return typeof item.module === 'string'
        && PARENT_REPORT_STREAM_MODULES.includes(item.module as typeof PARENT_REPORT_STREAM_MODULES[number])
        && !!item.data
        && typeof item.data === 'object';
}

function isChildReportValid(value: unknown): value is ChildAiReport {
    if (!value || typeof value !== 'object') return false;
    const report = value as ChildAiReport;
    const dimensions = normalizeTemperamentDimensions(report.analysis?.dimensions);
    return !!(
        report.intro
        && dimensions
        && REPORT_SCORE_KEYS.every((key) => {
            const dimension = dimensions[key];
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

function isParentReportValid(value: unknown): value is ParentAiReport {
    if (!value || typeof value !== 'object') return false;
    const report = value as ParentAiReport;
    return !!(
        report.intro
        && (report.dimensions || report.sections)
    );
}

function isParentReportComplete(value: unknown): value is ParentAiReport {
    if (!isParentReportValid(value)) return false;
    const report = value as ParentAiReport;
    const dimensions = normalizeTemperamentDimensions(report.dimensions);
    return !!(
        dimensions
        && REPORT_SCORE_KEYS.every((key) => {
            const dimension = dimensions[key];
            return typeof dimension === 'string' && dimension.trim().length > 0;
        })
        && report.shining
        && Array.isArray(report.parentingStyle)
        && report.parentingStyle.length > 0
        && report.vulnerability
        && Array.isArray(report.solutions)
        && report.solutions.length > 0
        && report.letter
    );
}

function applyChildReportStreamModule(report: ChildAiReport, item: ChildReportStreamModule) {
    if (item.module === 'intro') {
        report.title = item.data.title;
        report.intro = item.data.intro;
        return;
    }

    if (item.module === 'dimensions') {
        report.analysis = {
            ...report.analysis,
            dimensions: normalizeTemperamentDimensions(item.data.dimensions),
        };
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

function applyParentReportStreamModule(report: ParentAiReport, item: ParentReportStreamModule) {
    if (item.module === 'intro') {
        report.intro = item.data.intro;
        return;
    }

    if (item.module === 'dimensions') {
        report.dimensions = normalizeTemperamentDimensions(item.data.dimensions);
        return;
    }

    if (item.module === 'shining') {
        report.shining = item.data.shining;
        return;
    }

    if (item.module === 'parentingStyle') {
        report.parentingStyle = item.data.parentingStyle;
        return;
    }

    if (item.module === 'vulnerability') {
        report.vulnerability = item.data.vulnerability;
        return;
    }

    if (item.module === 'solutions') {
        report.solutions = item.data.solutions;
        return;
    }

    report.letter = item.data.letter;
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
        // 아이 실명은 외부 LLM에 보내지 않는다 — 가명으로 보내고 모듈 파싱 후 복원한다.
        payload.childInfo = {
            name: CHILD_NAME_PSEUDONYM,
            gender: params.childInfo.gender === 'male' ? '남아' : (params.childInfo.gender === 'female' ? '여아' : params.childInfo.gender),
            age: calculateChildAgeLabel(params.childInfo.birthDate),
        };
    }

    return JSON.stringify(payload);
}

function buildParentReportStreamPayload(params: {
    userName: string;
    scores: TemperamentScores;
    answers?: AnswerItem[];
    parentType?: TemperamentSummary;
}) {
    const payload: Record<string, unknown> = {
        userName: params.userName,
        type: 'PARENT',
        surveyDetails: formatSurveyAnswersForPrompt('PARENT', params.answers),
        scores: params.scores,
    };

    if (params.parentType) payload.parentType = params.parentType;

    return JSON.stringify(payload);
}

function getKnownReportErrorCode(error: unknown) {
    if (error instanceof Error) {
        if (error.message === CHILD_PROFILE_LIMIT_REACHED_CODE) return CHILD_PROFILE_LIMIT_REACHED_CODE;
        if (error.message === 'CHILD_NOT_FOUND') return 'CHILD_NOT_FOUND';
        if (error.message === LLM_QUOTA_EXCEEDED_CODE) return LLM_QUOTA_EXCEEDED_CODE;
    }

    if (typeof error === 'object' && error !== null) {
        const record = error as Record<string, unknown>;
        if (record.message === CHILD_PROFILE_LIMIT_REACHED_CODE) return CHILD_PROFILE_LIMIT_REACHED_CODE;
    }

    return null;
}

async function resolveChildForReport(params: {
    supabase: SupabaseServerClient;
    userId: string;
    userCreatedAt?: string | null;
    clientChildId?: string | null;
    intake?: IntakePayload | null;
}) {
    const { supabase, userId, userCreatedAt, clientChildId, intake } = params;
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
        const access = await getServerChildProfileAccess(supabase, { userId, userCreatedAt });
        if (!access.canCreateChild) {
            throw new Error(CHILD_PROFILE_LIMIT_REACHED_CODE);
        }

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

async function persistGeneratedReport(params: {
    supabase: SupabaseServerClient;
    userId: string;
    childId: string | null;
    surveyId: string | null;
    type: 'CHILD' | 'PARENT' | 'HARMONY';
    report: Json;
    refresh: boolean;
    logPrefix: string;
}) {
    let savedReportId: string | null = null;
    let persisted = false;

    try {
        const { data: savedReport, error: reportError } = await params.supabase
            .from('reports')
            .insert({
                user_id: params.userId,
                child_id: params.childId,
                survey_id: params.surveyId,
                type: params.type,
                analysis_json: params.report,
                model_used: REPORT_MODEL,
                is_paid: false,
            })
            .select('id')
            .single();
        if (reportError) throw reportError;

        savedReportId = savedReport?.id || null;
        persisted = !!savedReportId;

        if (params.refresh && savedReportId) {
            let deleteQuery = params.supabase
                .from('reports')
                .delete()
                .eq('user_id', params.userId)
                .eq('type', params.type)
                .neq('id', savedReportId);
            if (params.childId) {
                deleteQuery = deleteQuery.eq('child_id', params.childId);
            }
            const { error: deleteError } = await deleteQuery;
            if (deleteError) console.error(`${params.logPrefix} Delete previous reports error:`, deleteError);
        }
    } catch (persistenceError) {
        console.error(`${params.logPrefix} Report persistence error:`, persistenceError);
    }

    return { savedReportId, persisted };
}

async function generateStreamFallbackReport(params: {
    supabase: SupabaseServerClient;
    userId: string;
    userName: string;
    scores: TemperamentScores;
    type: 'CHILD' | 'PARENT';
    answers?: AnswerItem[];
    childType?: TemperamentSummary;
    parentType?: TemperamentSummary;
    childInfo: ChildInfo | null;
    childId: string | null;
    surveyId: string | null;
    refresh: boolean;
}) {
    const report = await generateReport(
        params.userName,
        params.scores,
        params.type,
        undefined,
        params.answers,
        undefined,
        params.type === 'CHILD' ? params.childType : undefined,
        params.type === 'PARENT' ? params.parentType : undefined,
        params.childInfo,
    );

    if (!report) throw new Error(`EMPTY_${params.type}_FALLBACK_REPORT`);

    const isComplete = params.type === 'CHILD'
        ? isChildReportComplete(report)
        : isParentReportComplete(report);
    if (!isComplete) throw new Error(`INVALID_${params.type}_FALLBACK_REPORT`);

    const { savedReportId, persisted } = await persistGeneratedReport({
        supabase: params.supabase,
        userId: params.userId,
        childId: params.childId,
        surveyId: params.surveyId,
        type: params.type,
        report: report as Json,
        refresh: params.refresh,
        logPrefix: `[Report Stream API] ${params.type} fallback`,
    });

    return { report: report as Json, savedReportId, persisted };
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
    userCreatedAt?: string | null;
    clientChildId?: string | null;
}) {
    const encoder = new TextEncoder();
    const perf = createPerfTracker('Report Stream API', { type: 'CHILD', refresh: params.refresh });

    const body = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            let childIdForReport: string | null = null;
            let childInfoForReport: ChildInfo | null = null;
            let surveyIdForReport: string | null = null;
            let canRetryWithJsonFallback = false;

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

                const quota = await consumeLlmQuota({ userId: params.userId, kind: 'REPORT' });
                if (!quota.allowed) {
                    throw new Error(LLM_QUOTA_EXCEEDED_CODE);
                }

                const { childId, childInfo } = await resolveChildForReport({
                    supabase: params.supabase,
                    userId: params.userId,
                    userCreatedAt: params.userCreatedAt,
                    clientChildId: params.clientChildId,
                    intake: params.intake,
                });
                childIdForReport = childId;
                childInfoForReport = childInfo;
                perf.mark('child_lookup', { childId });

                const surveyId = await insertCompletedSurvey({
                    supabase: params.supabase,
                    userId: params.userId,
                    childId,
                    type: 'CHILD',
                    answers: params.answers,
                    scores: params.scores,
                });
                surveyIdForReport = surveyId;
                perf.mark('survey_insert', { hasSurveyId: !!surveyId });

                const userMessage = buildChildReportStreamPayload({
                    userName: params.userName,
                    scores: params.scores,
                    answers: params.answers,
                    childType: params.childType,
                    childInfo,
                });
                perf.mark('prompt_prepared', { payloadBytes: userMessage.length });
                canRetryWithJsonFallback = true;

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

                    let parsed: ChildReportStreamModule;
                    try {
                        parsed = JSON.parse(line) as ChildReportStreamModule;
                    } catch (error) {
                        if (isChildReportComplete(report)) {
                            console.warn('[Report Stream API] Ignoring malformed trailing JSONL line after complete report:', line);
                            return;
                        }
                        throw error;
                    }

                    if (!isChildReportStreamModule(parsed)) {
                        if (isChildReportComplete(report)) {
                            console.warn('[Report Stream API] Ignoring unknown trailing JSONL object after complete report:', line);
                            return;
                        }
                        throw new Error('INVALID_CHILD_REPORT_STREAM_MODULE');
                    }

                    // 가명(○○이)으로 생성된 모듈을 실제 이름으로 복원한 뒤 적용/전송한다.
                    const restored = childInfoForReport
                        ? unmaskChildNameDeep(parsed, childInfoForReport.name)
                        : parsed;

                    applyChildReportStreamModule(report, restored);
                    perf.mark(`module_${restored.module}`);
                    send('module', restored as unknown as Record<string, unknown>);
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

                const { savedReportId, persisted } = await persistGeneratedReport({
                    supabase: params.supabase,
                    userId: params.userId,
                    childId,
                    surveyId,
                    type: 'CHILD',
                    report: report as Json,
                    refresh: params.refresh,
                    logPrefix: '[Report Stream API] CHILD stream',
                });
                perf.mark(persisted ? 'report_insert' : 'report_persist_failed', { hasReportId: persisted });
                if (params.refresh && savedReportId) perf.mark('refresh_cleanup');

                send('completed', {
                    report: report as Json,
                    reportId: savedReportId,
                    createdAt: new Date().toISOString(),
                    cached: false,
                    persisted,
                    timings: perf.getSegments(),
                });
            } catch (error) {
                console.error('[Report Stream API] Error:', error);
                const code = getKnownReportErrorCode(error);
                if (code || !canRetryWithJsonFallback) {
                    perf.fail(error);
                    send('error', code ? { error: code, code } : { error: 'Failed to generate streamed report' });
                    return;
                }

                try {
                    perf.mark('stream_fallback_started');
                    console.warn('[Report Stream API] CHILD stream failed; retrying non-stream fallback.');
                    const fallback = await generateStreamFallbackReport({
                        supabase: params.supabase,
                        userId: params.userId,
                        userName: params.userName,
                        scores: params.scores,
                        type: 'CHILD',
                        answers: params.answers,
                        childType: params.childType,
                        childInfo: childInfoForReport,
                        childId: childIdForReport,
                        surveyId: surveyIdForReport,
                        refresh: params.refresh,
                    });
                    perf.mark('stream_fallback_completed', { persisted: fallback.persisted });
                    send('completed', {
                        report: fallback.report,
                        reportId: fallback.savedReportId,
                        createdAt: new Date().toISOString(),
                        cached: false,
                        persisted: fallback.persisted,
                        fallback: true,
                        timings: perf.getSegments(),
                    });
                } catch (fallbackError) {
                    perf.fail(fallbackError);
                    console.error('[Report Stream API] CHILD fallback failed:', fallbackError);
                    send('error', { error: 'Failed to generate streamed report' });
                }
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

function streamParentReportResponse(params: {
    supabase: SupabaseServerClient;
    userId: string;
    userName: string;
    scores: TemperamentScores;
    answers?: AnswerItem[];
    parentType?: TemperamentSummary;
    refresh: boolean;
    intake?: IntakePayload | null;
    userCreatedAt?: string | null;
    clientChildId?: string | null;
}) {
    const encoder = new TextEncoder();
    const perf = createPerfTracker('Report Stream API', { type: 'PARENT', refresh: params.refresh });

    const body = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            let childIdForReport: string | null = null;
            let childInfoForReport: ChildInfo | null = null;
            let surveyIdForReport: string | null = null;
            let canRetryWithJsonFallback = false;

            try {
                send('started', { type: 'PARENT' });

                if (!params.refresh) {
                    let cacheQuery = params.supabase
                        .from('reports')
                        .select('id, analysis_json, created_at, is_paid')
                        .eq('user_id', params.userId)
                        .eq('type', 'PARENT');

                    if (params.clientChildId) {
                        cacheQuery = cacheQuery.eq('child_id', params.clientChildId);
                    }

                    const { data: cachedRows, error: cacheError } = await cacheQuery
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (cacheError) throw cacheError;
                    perf.mark('cache_query', { cacheHit: !!cachedRows?.length });

                    const cachedReport = cachedRows?.[0]?.analysis_json;
                    if (isParentReportValid(cachedReport)) {
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

                const quota = await consumeLlmQuota({ userId: params.userId, kind: 'REPORT' });
                if (!quota.allowed) {
                    throw new Error(LLM_QUOTA_EXCEEDED_CODE);
                }

                const { childId, childInfo } = await resolveChildForReport({
                    supabase: params.supabase,
                    userId: params.userId,
                    userCreatedAt: params.userCreatedAt,
                    clientChildId: params.clientChildId,
                    intake: params.intake,
                });
                childIdForReport = childId;
                childInfoForReport = childInfo;
                perf.mark('child_lookup', { childId });

                const surveyId = await insertCompletedSurvey({
                    supabase: params.supabase,
                    userId: params.userId,
                    childId,
                    type: 'PARENT',
                    answers: params.answers,
                    scores: params.scores,
                });
                surveyIdForReport = surveyId;
                perf.mark('survey_insert', { hasSurveyId: !!surveyId });

                const userMessage = buildParentReportStreamPayload({
                    userName: params.userName,
                    scores: params.scores,
                    answers: params.answers,
                    parentType: params.parentType,
                });
                perf.mark('prompt_prepared', { payloadBytes: userMessage.length });
                canRetryWithJsonFallback = true;

                const completionStream = await openai.chat.completions.create({
                    model: REPORT_MODEL,
                    messages: [
                        { role: 'system', content: PARENT_REPORT_STREAM_PROMPT },
                        { role: 'user', content: userMessage },
                    ],
                    temperature: 0.7,
                    stream: true,
                });

                const report: ParentAiReport = {};
                let lineBuffer = '';
                const processLine = (rawLine: string) => {
                    const line = normalizeStreamLine(rawLine);
                    if (!line || !line.startsWith('{')) return;

                    let parsed: ParentReportStreamModule;
                    try {
                        parsed = JSON.parse(line) as ParentReportStreamModule;
                    } catch (error) {
                        if (isParentReportComplete(report)) {
                            console.warn('[Report Stream API] Ignoring malformed trailing parent JSONL line after complete report:', line);
                            return;
                        }
                        throw error;
                    }

                    if (!isParentReportStreamModule(parsed)) {
                        if (isParentReportComplete(report)) {
                            console.warn('[Report Stream API] Ignoring unknown trailing parent JSONL object after complete report:', line);
                            return;
                        }
                        throw new Error('INVALID_PARENT_REPORT_STREAM_MODULE');
                    }

                    applyParentReportStreamModule(report, parsed);
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

                if (!isParentReportComplete(report)) {
                    throw new Error('INVALID_STREAMED_PARENT_REPORT');
                }

                const { savedReportId, persisted } = await persistGeneratedReport({
                    supabase: params.supabase,
                    userId: params.userId,
                    childId,
                    surveyId,
                    type: 'PARENT',
                    report: report as Json,
                    refresh: params.refresh,
                    logPrefix: '[Report Stream API] PARENT stream',
                });
                perf.mark(persisted ? 'report_insert' : 'report_persist_failed', { hasReportId: persisted });
                if (params.refresh && savedReportId) perf.mark('refresh_cleanup');

                send('completed', {
                    report: report as Json,
                    reportId: savedReportId,
                    createdAt: new Date().toISOString(),
                    cached: false,
                    persisted,
                    timings: perf.getSegments(),
                });
            } catch (error) {
                console.error('[Report Stream API] Parent error:', error);
                const code = getKnownReportErrorCode(error);
                if (code || !canRetryWithJsonFallback) {
                    perf.fail(error);
                    send('error', code ? { error: code, code } : { error: 'Failed to generate streamed parent report' });
                    return;
                }

                try {
                    perf.mark('stream_fallback_started');
                    console.warn('[Report Stream API] PARENT stream failed; retrying non-stream fallback.');
                    const fallback = await generateStreamFallbackReport({
                        supabase: params.supabase,
                        userId: params.userId,
                        userName: params.userName,
                        scores: params.scores,
                        type: 'PARENT',
                        answers: params.answers,
                        parentType: params.parentType,
                        childInfo: childInfoForReport,
                        childId: childIdForReport,
                        surveyId: surveyIdForReport,
                        refresh: params.refresh,
                    });
                    perf.mark('stream_fallback_completed', { persisted: fallback.persisted });
                    send('completed', {
                        report: fallback.report,
                        reportId: fallback.savedReportId,
                        createdAt: new Date().toISOString(),
                        cached: false,
                        persisted: fallback.persisted,
                        fallback: true,
                        timings: perf.getSegments(),
                    });
                } catch (fallbackError) {
                    perf.fail(fallbackError);
                    console.error('[Report Stream API] PARENT fallback failed:', fallbackError);
                    send('error', { error: 'Failed to generate streamed parent report' });
                }
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
            if (type !== 'CHILD' && type !== 'PARENT') {
                return NextResponse.json(
                    { error: 'Streaming reports are currently supported for CHILD and PARENT only.' },
                    { status: 400 }
                );
            }

            if (type === 'PARENT') {
                return streamParentReportResponse({
                    supabase,
                    userId,
                    userName,
                    scores,
                    answers,
                    parentType,
                    refresh,
                    intake,
                    userCreatedAt: session.user.created_at,
                    clientChildId,
                });
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
                userCreatedAt: session.user.created_at,
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

        // 2. LLM 호출 쿼터 확인 (캐시 미스일 때만 여기 도달)
        const quota = await consumeLlmQuota({ userId, kind: 'REPORT' });
        if (!quota.allowed) {
            return NextResponse.json(
                { error: 'AI 리포트 생성 한도를 초과했습니다. 내일 다시 시도해주세요.', code: LLM_QUOTA_EXCEEDED_CODE },
                { status: 429 }
            );
        }

        // 3. Child 프로필 조회/생성
        let childId: string | null = null;
        let childInfo: { name: string, gender: string, birthDate: string } | null = null;

        try {
            const resolvedChild = await resolveChildForReport({
                supabase,
                userId,
                userCreatedAt: session.user.created_at,
                clientChildId,
                intake,
            });
            childId = resolvedChild.childId;
            childInfo = resolvedChild.childInfo;
        } catch (error) {
            const code = getKnownReportErrorCode(error);
            if (code === CHILD_PROFILE_LIMIT_REACHED_CODE) {
                return NextResponse.json({ code, error: code }, { status: 403 });
            }
            if (code === 'CHILD_NOT_FOUND') {
                return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
            }
            throw error;
        }

        perf.mark('child_lookup', { childId: childId ?? null });

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

        const code = getKnownReportErrorCode(error);
        if (code === CHILD_PROFILE_LIMIT_REACHED_CODE) {
            return NextResponse.json({ code, error: code }, { status: 403 });
        }

        perf.fail(error);
        console.error('[Report API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate report' },
            { status: 500 }
        );
    }
}
