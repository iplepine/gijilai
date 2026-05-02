import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { getServerFeatureAccess } from '@/lib/access';
import { getConsultModel } from '@/lib/consult-model';
import { openai } from '@/lib/openai';
import { recordSubscriptionUsageEvent } from '@/lib/subscription-usage';
import { createClient } from '@/lib/supabaseServer';
import type { Json } from '@/types/supabase';

type PracticeFeedbackRequest = {
  logId?: string;
  practiceId?: string;
};

type PracticeFeedbackResponse = {
  reactionInsight: string;
  tomorrowAdjustment: string;
  parentEncouragement: string;
};

type PracticeLogForFeedback = {
  id: string;
  practice_id: string;
  user_id: string;
  date: string;
  done: boolean;
  memo: string | null;
  child_reaction_type: string | null;
  child_reaction_note: string | null;
};

type PracticeForFeedback = {
  id: string;
  title: string;
  description: string;
  duration: number;
  encouragement: string | null;
  consultation_sessions: {
    id: string;
    title: string;
    user_id: string;
  };
};

const REACTION_LABELS: Record<string, string> = {
  cooperated: '잘 따라왔다',
  resisted_then_settled: '처음엔 싫어했지만 진정했다',
  escalated: '더 화냈다',
  no_clear_reaction: '반응이 거의 없었다',
  not_tried: '상황이 달라 못 했다',
  custom: '직접 기록',
};

function isPracticeFeedbackResponse(value: unknown): value is PracticeFeedbackResponse {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return isNonEmptyString(payload.reactionInsight)
    && isNonEmptyString(payload.tomorrowAdjustment)
    && isNonEmptyString(payload.parentEncouragement);
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

    const { logId, practiceId } = await parseJsonBody<PracticeFeedbackRequest>(request);
    if (!logId || !practiceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [logRes, practiceRes] = await Promise.all([
      supabase
        .from('practice_logs')
        .select('id, practice_id, user_id, date, done, memo, child_reaction_type, child_reaction_note')
        .eq('id', logId)
        .eq('practice_id', practiceId)
        .eq('user_id', session.user.id)
        .single<PracticeLogForFeedback>(),
      supabase
        .from('practice_items')
        .select('id, title, description, duration, encouragement, consultation_sessions!inner(id, title, user_id)')
        .eq('id', practiceId)
        .eq('consultation_sessions.user_id', session.user.id)
        .single<PracticeForFeedback>(),
    ]);

    if (logRes.error || practiceRes.error || !logRes.data || !practiceRes.data) {
      console.error('[Practice Feedback] Context lookup failed:', {
        log: logRes.error,
        practice: practiceRes.error,
      });
      return NextResponse.json({ error: 'Practice log not found' }, { status: 404 });
    }

    const log = logRes.data;
    const practice = practiceRes.data;
    if (!log.child_reaction_type) {
      return NextResponse.json({ error: 'Missing child reaction' }, { status: 400 });
    }

    const reactionLabel = REACTION_LABELS[log.child_reaction_type] ?? log.child_reaction_type;
    const model = await getConsultModel(session.user.id);
    const promptPayload = {
      sessionTitle: practice.consultation_sessions.title,
      practice: {
        title: practice.title,
        description: practice.description,
        duration: practice.duration,
        encouragement: practice.encouragement,
      },
      todayLog: {
        done: log.done,
        memo: log.memo,
        childReaction: reactionLabel,
        childReactionNote: log.child_reaction_note,
      },
    };

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `당신은 기질 기반 양육 코치입니다. 양육자가 오늘의 첫 실천을 기록한 직후, 부담 없이 내일 조정할 수 있는 짧은 피드백을 제공합니다.

규칙:
- 의학적·심리학적 진단처럼 말하지 마세요.
- 아이 반응을 실패로 단정하지 말고, 가능성형으로 해석하세요.
- 양육자를 평가하지 말고 다음 시도를 작게 조정하세요.
- 3개 필드를 모두 한국어로 작성하세요.
- 각 필드는 1~2문장으로 짧게 작성하세요.
- JSON만 출력하세요.

응답 형식:
{
  "reactionInsight": "아이 반응 해석",
  "tomorrowAdjustment": "내일 조정할 점",
  "parentEncouragement": "양육자에게 한마디"
}`,
        },
        {
          role: 'user',
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    const parsed = content ? JSON.parse(content) as unknown : null;
    if (!isPracticeFeedbackResponse(parsed)) {
      return NextResponse.json({ error: 'Invalid feedback response' }, { status: 502 });
    }

    const feedback: PracticeFeedbackResponse = {
      reactionInsight: parsed.reactionInsight.trim(),
      tomorrowAdjustment: parsed.tomorrowAdjustment.trim(),
      parentEncouragement: parsed.parentEncouragement.trim(),
    };

    const createdAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('practice_logs')
      .update({
        ai_feedback: feedback as unknown as Json,
        ai_feedback_created_at: createdAt,
      })
      .eq('id', log.id)
      .eq('user_id', session.user.id);

    if (updateError) {
      console.error('[Practice Feedback] Failed to update log:', updateError);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    void recordSubscriptionUsageEvent({
      userId: session.user.id,
      feature: 'AI_CONSULTATION',
      eventName: 'PRACTICE_AI_FEEDBACK',
      resourceType: 'practice_log',
      resourceId: log.id,
      metadata: {
        practiceId: practice.id,
        reactionType: log.child_reaction_type,
        done: log.done,
      },
    });

    return NextResponse.json({ feedback, createdAt });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('[Practice Feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to generate practice feedback' }, { status: 500 });
  }
}
