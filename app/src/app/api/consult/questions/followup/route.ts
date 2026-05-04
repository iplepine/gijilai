import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { getConsultModel } from '@/lib/consult-model';
import { getServerFeatureAccess } from '@/lib/access';
import { recordSubscriptionUsageEvent } from '@/lib/subscription-usage';
import { buildFollowUpConsultQuestionsPrompt } from '@/lib/consultPromptBuilders';

type FollowUpResponse = {
    needsFollowUp: boolean;
    followUpReason?: string;
    followUpQuestions?: Array<{
        id: string;
        text: string;
        type: 'CHOICE' | 'TEXT';
        options?: Array<{
            id: string;
            text: string;
            freeText?: boolean;
        }>;
    }>;
};

type FirstRoundQuestion = {
    id: string;
    text: string;
};

function isFirstRoundQuestionList(value: unknown): value is FirstRoundQuestion[] {
    return Array.isArray(value)
        && value.every((question) => {
            if (!question || typeof question !== 'object') return false;
            const candidate = question as Record<string, unknown>;
            return isNonEmptyString(candidate.id) && isNonEmptyString(candidate.text);
        });
}

function normalizeQuestionText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function meaningfulQuestionTokens(text: string): Set<string> {
    const stopWords = new Set([
        '혹시', '아이', '아이가', '아이의', '주로', '어떤', '어느', '얼마나',
        '때', '그때', '상황', '모습', '행동', '질문', '말씀해', '주세요', '있나요',
        '하나요', '하시나요', '인가요', '일까요',
    ]);
    return new Set(
        normalizeQuestionText(text)
            .split(' ')
            .map((token) => token.trim())
            .filter((token) => token.length >= 2 && !stopWords.has(token))
    );
}

function tokenOverlapScore(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const token of a) {
        if (b.has(token)) intersection += 1;
    }
    return intersection / Math.min(a.size, b.size);
}

function isTargetIntentQuestion(text: string): boolean {
    const normalized = normalizeQuestionText(text).replace(/\s/g, '');
    const strongTargetMarkers = [
        '바라', '원하', '기대', '나아졌', '나아지', '달라지', '좋겠',
        '행동해주', '되어야', '상상',
    ];
    return strongTargetMarkers.some((marker) => normalized.includes(marker));
}

function isLikelyDuplicateQuestion(candidate: string, previousQuestions: FirstRoundQuestion[]): boolean {
    const normalizedCandidate = normalizeQuestionText(candidate).replace(/\s/g, '');
    const candidateTokens = meaningfulQuestionTokens(candidate);
    const candidateIsTargetIntent = isTargetIntentQuestion(candidate);

    return previousQuestions.some((previous) => {
        const normalizedPrevious = normalizeQuestionText(previous.text).replace(/\s/g, '');
        if (
            normalizedCandidate === normalizedPrevious
            || normalizedCandidate.includes(normalizedPrevious)
            || normalizedPrevious.includes(normalizedCandidate)
        ) {
            return true;
        }

        if (candidateIsTargetIntent && isTargetIntentQuestion(previous.text)) {
            return true;
        }

        const previousTokens = meaningfulQuestionTokens(previous.text);
        return tokenOverlapScore(candidateTokens, previousTokens) >= 0.7
            && candidateTokens.size >= 3
            && previousTokens.size >= 3;
    });
}

function removeDuplicateFollowUpQuestions(
    payload: FollowUpResponse,
    previousQuestions?: FirstRoundQuestion[],
): FollowUpResponse {
    if (!previousQuestions || previousQuestions.length === 0 || !payload.followUpQuestions) {
        return payload;
    }

    const followUpQuestions = payload.followUpQuestions.filter((question) => (
        !isLikelyDuplicateQuestion(question.text, previousQuestions)
    ));

    return {
        ...payload,
        needsFollowUp: payload.needsFollowUp && followUpQuestions.length > 0,
        followUpQuestions,
    };
}

function isFollowUpResponse(value: unknown): value is FollowUpResponse {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;

    if (typeof payload.needsFollowUp !== 'boolean') return false;
    if (payload.followUpReason !== undefined && typeof payload.followUpReason !== 'string') return false;
    if (payload.followUpQuestions === undefined) return true;
    if (!Array.isArray(payload.followUpQuestions)) return false;

    return payload.followUpQuestions.every((question) => {
        if (!question || typeof question !== 'object') return false;
        const candidate = question as Record<string, unknown>;
        const validOptions = candidate.options === undefined || (
            Array.isArray(candidate.options)
            && candidate.options.every((option) => {
                if (!option || typeof option !== 'object') return false;
                const optionCandidate = option as Record<string, unknown>;
                return isNonEmptyString(optionCandidate.id)
                    && isNonEmptyString(optionCandidate.text)
                    && (optionCandidate.freeText === undefined || typeof optionCandidate.freeText === 'boolean');
            })
        );

        return isNonEmptyString(candidate.id)
            && isNonEmptyString(candidate.text)
            && (candidate.type === 'CHOICE' || candidate.type === 'TEXT')
            && validOptions;
    });
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const access = await getServerFeatureAccess(supabase, {
            userId: session.user.id,
            userCreatedAt: session.user.created_at,
        });
        if (!access.canUseConsult) {
            return NextResponse.json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 });
        }

        const { problem, firstRoundAnswers, firstRoundQuestions } = await parseJsonBody<{
            problem?: string;
            firstRoundAnswers?: Record<string, string>;
            firstRoundQuestions?: unknown;
        }>(request);

        if (!problem || !firstRoundAnswers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }
        if (firstRoundQuestions !== undefined && !isFirstRoundQuestionList(firstRoundQuestions)) {
            return NextResponse.json(
                { error: 'Invalid first round questions' },
                { status: 400 }
            );
        }

        const { systemPrompt, userMessage } = buildFollowUpConsultQuestionsPrompt({
            problem,
            firstRoundAnswers,
            firstRoundQuestions,
        });

        const model = await getConsultModel(session.user.id);

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content || '{"needsFollowUp": false}');
        if (!isFollowUpResponse(parsed)) {
            throw new Error('INVALID_FOLLOWUP_RESPONSE');
        }
        const guardedParsed = removeDuplicateFollowUpQuestions(parsed, firstRoundQuestions);

        await recordSubscriptionUsageEvent({
            userId: session.user.id,
            feature: 'AI_CONSULTATION',
            eventName: 'CONSULT_QUESTIONS_FOLLOWUP',
            metadata: {
                needsFollowUp: guardedParsed.needsFollowUp === true,
                model,
            },
        });

        return NextResponse.json(guardedParsed);
    } catch (error) {
        if (isInvalidJsonBodyError(error)) {
            return invalidJsonResponse();
        }

        console.error('Error generating follow-up questions:', error);
        return NextResponse.json(
            { error: 'Failed to process follow-up' },
            { status: 500 }
        );
    }
}
