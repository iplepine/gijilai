import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { getConsultModel } from '@/lib/consult-model';
import { getServerFeatureAccess } from '@/lib/access';
import { recordSubscriptionUsageEvent } from '@/lib/subscription-usage';
import { validateConsultProblemInput } from '@/lib/consultInputValidation';
import {
  getOwnedConsultChild,
  resolveConsultTemperamentProfile,
  type ConsultTemperamentProfile,
} from '@/lib/consultTemperamentContext';
import {
  buildInitialConsultQuestionsPrompt,
  type InitialConsultSessionContext,
} from '@/lib/consultPromptBuilders';
import type { Database } from '@/types/supabase';

type ObservationRow = Database['public']['Tables']['observations']['Row'];
type SessionRow = Database['public']['Tables']['consultation_sessions']['Row'];
type ConsultationRow = Database['public']['Tables']['consultations']['Row'];
type PracticeItemRow = Database['public']['Tables']['practice_items']['Row'];
type PracticeLogRow = Database['public']['Tables']['practice_logs']['Row'];
type TemperamentProfile = ConsultTemperamentProfile;
type SessionContextPayload = InitialConsultSessionContext & {
    session?: SessionRow | null;
    consultations?: ConsultationRow[];
    practices?: PracticeItemRow[];
    logs?: PracticeLogRow[];
};
type InitialQuestionRequest = {
    problem?: string;
    childId?: string | null;
    childName?: string;
    childBirthDate?: string;
    childGender?: 'male' | 'female' | string;
    childProfile?: TemperamentProfile | null;
    parentProfile?: TemperamentProfile | null;
    recentObservations?: ObservationRow[];
    sessionContext?: SessionContextPayload | null;
};

type InitialQuestionsResponse = {
    empathy: string;
    questions: Array<{
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

function isInitialQuestionsResponse(value: unknown): value is InitialQuestionsResponse {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    if (!isNonEmptyString(payload.empathy) || !Array.isArray(payload.questions)) return false;

    return payload.questions.every((question) => {
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

    const {
      problem,
      childId,
      childName,
      childBirthDate,
      childGender,
      childProfile,
      parentProfile,
      recentObservations,
      sessionContext,
    } = await parseJsonBody<InitialQuestionRequest>(request);

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

    if (typeof problem !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: problem' },
        { status: 400 }
      );
    }

    const problemValidation = validateConsultProblemInput(problem);
    if (!problemValidation.ok) {
      return NextResponse.json(
        {
          error: 'Invalid consultation input',
          code: problemValidation.code,
        },
        { status: 400 }
      );
    }

    const { systemPrompt, userMessage } = buildInitialConsultQuestionsPrompt({
      problem,
      childName: effectiveChildName,
      childBirthDate: effectiveChildBirthDate,
      childGender: effectiveChildGender,
      childProfile: effectiveChildProfile,
      parentProfile: effectiveParentProfile,
      recentObservations,
      sessionContext,
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
    const parsed = JSON.parse(content || '{"empathy": "", "questions": []}');
    if (!isInitialQuestionsResponse(parsed)) {
      throw new Error('INVALID_INITIAL_QUESTIONS_RESPONSE');
    }
    await recordSubscriptionUsageEvent({
      userId: session.user.id,
      feature: 'AI_CONSULTATION',
      eventName: 'CONSULT_QUESTIONS_INITIAL',
      metadata: {
        hasSessionContext: !!sessionContext,
        model,
      },
    });

    return NextResponse.json(parsed);
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('Error generating initial questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
