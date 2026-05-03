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

        const { problem, firstRoundAnswers } = await parseJsonBody<{
            problem?: string;
            firstRoundAnswers?: Record<string, string>;
        }>(request);

        if (!problem || !firstRoundAnswers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const { systemPrompt, userMessage } = buildFollowUpConsultQuestionsPrompt({
            problem,
            firstRoundAnswers,
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
        await recordSubscriptionUsageEvent({
            userId: session.user.id,
            feature: 'AI_CONSULTATION',
            eventName: 'CONSULT_QUESTIONS_FOLLOWUP',
            metadata: {
                needsFollowUp: parsed.needsFollowUp === true,
                model,
            },
        });

        return NextResponse.json(parsed);
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
