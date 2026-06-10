import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { getConsultModel } from '@/lib/consult-model';
import { getServerFeatureAccessForChild } from '@/lib/access';
import { recordSubscriptionUsageEvent } from '@/lib/subscription-usage';
import {
    getOwnedConsultChild,
    resolveConsultTemperamentProfile,
    type ConsultTemperamentProfile,
} from '@/lib/consultTemperamentContext';
import {
    buildConsultPrescriptionPrompt,
    type ConsultPromptObservation,
    type ConsultPromptQuestion,
    type PrescriptionConsultSessionContext,
} from '@/lib/consultPromptBuilders';
import { buildConsultCaregiverContext } from '@/lib/coParentServer';
import { applyConsultPrescriptionGuardrails } from '@/lib/consultPrescriptionGuardrails';
import { consumeLlmQuota, LLM_QUOTA_EXCEEDED_CODE } from '@/lib/llm-quota';
import {
    CHILD_NAME_PSEUDONYM,
    maskChildNameDeep,
    maskChildNameText,
    unmaskChildNameDeep,
} from '@/lib/childPseudonym';

type PrescriptionResponse = {
    interpretation: string;
    chemistry: string;
    magicWord: string;
    questionAnalysis?: Array<{
        question: string;
        answer: string;
        analysis: string;
    }>;
    actionItem?: string;
    actionItems?: Array<{
        title: string;
        trigger?: string;
        action?: string;
        description: string;
        duration: number;
        encouragement: string;
    }>;
    sessionTitle?: string;
};

type TemperamentProfile = ConsultTemperamentProfile;

function isPrescriptionResponse(value: unknown): value is PrescriptionResponse {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    const validQuestionAnalysis = payload.questionAnalysis === undefined || (
        Array.isArray(payload.questionAnalysis)
        && payload.questionAnalysis.every((item) => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return isNonEmptyString(candidate.question)
                && isNonEmptyString(candidate.answer)
                && isNonEmptyString(candidate.analysis);
        })
    );
    const validActionItems = (
        Array.isArray(payload.actionItems)
        && payload.actionItems.length === 3
        && payload.actionItems.every((item) => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return isNonEmptyString(candidate.title)
                && isNonEmptyString(candidate.description)
                && typeof candidate.duration === 'number'
                && isNonEmptyString(candidate.encouragement)
                && (candidate.trigger === undefined || typeof candidate.trigger === 'string')
                && (candidate.action === undefined || typeof candidate.action === 'string');
        })
    );

    return isNonEmptyString(payload.interpretation)
        && isNonEmptyString(payload.chemistry)
        && isNonEmptyString(payload.magicWord)
        && validQuestionAnalysis
        && validActionItems
        && (payload.actionItem === undefined || typeof payload.actionItem === 'string')
        && (payload.sessionTitle === undefined || typeof payload.sessionTitle === 'string');
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            problem,
            questions,
            answers,
            childId,
            childProfile,
            parentProfile,
            childName,
            childBirthDate,
            childGender,
            recentObservations,
            sessionContext
        }: {
            problem?: string;
            questions?: ConsultPromptQuestion[];
            answers?: Record<string, string>;
            childId?: string | null;
            childProfile?: TemperamentProfile | null;
            parentProfile?: TemperamentProfile | null;
            childName?: string;
            childBirthDate?: string;
            childGender?: string;
            recentObservations?: ConsultPromptObservation[];
            sessionContext?: PrescriptionConsultSessionContext | null;
        } = await parseJsonBody<{
            problem?: string;
            questions?: ConsultPromptQuestion[];
            answers?: Record<string, string>;
            childId?: string | null;
            childProfile?: TemperamentProfile | null;
            parentProfile?: TemperamentProfile | null;
            childName?: string;
            childBirthDate?: string;
            childGender?: string;
            recentObservations?: ConsultPromptObservation[];
            sessionContext?: PrescriptionConsultSessionContext | null;
        }>(request);

        // 공동양육자 케이스에서 owner의 구독으로 권한이 흘러오도록 childId 컨텍스트 포함
        const access = await getServerFeatureAccessForChild(supabase, {
            userId: session.user.id,
            userCreatedAt: session.user.created_at,
            childId,
        });
        if (!access.canUseConsult) {
            return NextResponse.json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 });
        }

        const ownedChild = await getOwnedConsultChild(supabase, session.user.id, childId);
        if (childId && !ownedChild) {
            return NextResponse.json(
                { error: 'Invalid child id', code: 'INVALID_CHILD_ID' },
                { status: 403 }
            );
        }

        const effectiveChildProfile = await resolveConsultTemperamentProfile(supabase, {
            userId: session.user.id,
            type: 'CHILD',
            childId: ownedChild?.id ?? childId,
            fallback: childProfile,
        });
        const effectiveParentProfile = await resolveConsultTemperamentProfile(supabase, {
            userId: session.user.id,
            type: 'PARENT',
            fallback: parentProfile,
        });
        const effectiveChildName = ownedChild?.name ?? childName;
        const effectiveChildBirthDate = ownedChild?.birthDate ?? childBirthDate;
        const effectiveChildGender = ownedChild?.gender ?? childGender;

        if (!problem || !answers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const quota = await consumeLlmQuota({ userId: session.user.id, kind: 'CONSULT_PRESCRIPTION' });
        if (!quota.allowed) {
            return NextResponse.json(
                { error: 'AI 상담 한도를 초과했습니다. 내일 다시 시도해주세요.', code: LLM_QUOTA_EXCEEDED_CODE },
                { status: 429 }
            );
        }

        const caregiverContext = await buildConsultCaregiverContext({
            actorUserId: session.user.id,
            childId: ownedChild?.id ?? childId ?? null,
            previousAuthorUserIds: (sessionContext?.consultations ?? [])
                .map((c) => (c as unknown as { user_id?: string }).user_id ?? '')
                .filter((u): u is string => Boolean(u)),
        });

        // 아이 실명은 외부 LLM에 보내지 않는다 — 가명으로 보내고 응답에서 복원한다.
        // questions/answers/관찰/세션 맥락의 자유 텍스트에 들어간 이름도 함께 가린다.
        const realChildName = effectiveChildName?.trim() || null;
        const { systemPrompt, isFollowUp } = buildConsultPrescriptionPrompt({
            problem: maskChildNameText(problem, realChildName),
            questions: maskChildNameDeep(questions, realChildName),
            answers: maskChildNameDeep(answers, realChildName),
            childName: realChildName ? CHILD_NAME_PSEUDONYM : effectiveChildName,
            childBirthDate: effectiveChildBirthDate,
            childGender: effectiveChildGender,
            childProfile: effectiveChildProfile,
            parentProfile: effectiveParentProfile,
            recentObservations: maskChildNameDeep(recentObservations, realChildName),
            sessionContext: maskChildNameDeep(sessionContext, realChildName),
            caregiverContext,
        });

        const model = await getConsultModel(session.user.id);

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt }
            ],
            temperature: 0.45,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsed = applyConsultPrescriptionGuardrails(JSON.parse(content || '{}'));
        if (!isPrescriptionResponse(parsed)) {
            throw new Error('INVALID_PRESCRIPTION_RESPONSE');
        }
        const prescription = unmaskChildNameDeep(parsed, realChildName);

        // 하위 호환: actionItem 필드 유지
        if (prescription.actionItems && prescription.actionItems.length > 0 && !prescription.actionItem) {
            prescription.actionItem = prescription.actionItems[0].description;
        }

        await recordSubscriptionUsageEvent({
            userId: session.user.id,
            feature: 'AI_CONSULTATION',
            eventName: 'CONSULT_PRESCRIPTION',
            metadata: {
                isFollowUp,
                model,
                actionItemCount: Array.isArray(prescription.actionItems) ? prescription.actionItems.length : 0,
            },
        });

        return NextResponse.json(prescription);
    } catch (error) {
        if (isInvalidJsonBodyError(error)) {
            return invalidJsonResponse();
        }

        console.error('Error generating prescription:', error);
        return NextResponse.json(
            { error: 'Failed to generate prescription' },
            { status: 500 }
        );
    }
}
