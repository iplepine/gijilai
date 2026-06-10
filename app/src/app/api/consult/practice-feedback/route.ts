import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { getServerFeatureAccess } from '@/lib/access';
import { consumeLlmQuota, LLM_QUOTA_EXCEEDED_CODE } from '@/lib/llm-quota';
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

type FeedbackDepth = 'quick' | 'deep';

type PracticeLogForFeedback = {
  id: string;
  practice_id: string;
  user_id: string;
  date: string;
  done: boolean;
  memo: string | null;
  practice_attempt_type: string | null;
  practice_attempt_note: string | null;
  child_reaction_type: string | null;
  child_reaction_note: string | null;
  parent_impression_type: string | null;
  ai_feedback: Json | null;
  ai_feedback_created_at: string | null;
  ai_feedback_model: string | null;
  ai_feedback_depth: FeedbackDepth | null;
};

type RecentPracticeLogForFeedback = {
  id: string;
  date: string;
  done: boolean;
  practice_attempt_type: string | null;
  child_reaction_type: string | null;
  parent_impression_type: string | null;
  ai_feedback_depth: FeedbackDepth | null;
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

const QUICK_FEEDBACK_MODEL = 'gpt-4o-mini';
const DEEP_FEEDBACK_MODEL = 'gpt-4o';
const LONG_NOTE_THRESHOLD = 40;

const ATTEMPT_LABELS: Record<string, string> = {
  as_prescribed: '처방 그대로 해봤다',
  changed_words: '말을 조금 바꿔 해봤다',
  shortened: '짧게 줄여 해봤다',
  adapted_to_situation: '상황에 맞게 바꿔 해봤다',
  barely_tried: '거의 해보지 못했다',
};

const REACTION_LABELS: Record<string, string> = {
  cooperated: '잘 따라왔다',
  resisted_then_settled: '처음엔 싫어했지만 진정했다',
  escalated: '더 화냈다',
  no_clear_reaction: '반응이 거의 없었다',
  not_tried: '상황이 달라 못 했다',
  custom: '직접 기록',
};

const IMPRESSION_LABELS: Record<string, string> = {
  this_is_it: '이거다!',
  seems_right: '맞는 것 같다',
  not_sure: '아직 모르겠다',
  seems_wrong: '이건 아닌 것 같다',
  want_to_adjust: '다음엔 바꿔보고 싶다',
};

function isPracticeFeedbackResponse(value: unknown): value is PracticeFeedbackResponse {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return isNonEmptyString(payload.reactionInsight)
    && isNonEmptyString(payload.tomorrowAdjustment)
    && isNonEmptyString(payload.parentEncouragement);
}

function parsePracticeFeedback(value: unknown): PracticeFeedbackResponse | null {
  if (!isPracticeFeedbackResponse(value)) return null;
  return {
    reactionInsight: value.reactionInsight.trim(),
    tomorrowAdjustment: value.tomorrowAdjustment.trim(),
    parentEncouragement: value.parentEncouragement.trim(),
  };
}

function hasLongNote(log: PracticeLogForFeedback) {
  return (log.practice_attempt_note?.trim().length ?? 0) >= LONG_NOTE_THRESHOLD
    || (log.child_reaction_note?.trim().length ?? 0) >= LONG_NOTE_THRESHOLD;
}

function isNegativeLog(log: RecentPracticeLogForFeedback) {
  return !log.done
    || log.practice_attempt_type === 'barely_tried'
    || log.child_reaction_type === 'escalated'
    || log.child_reaction_type === 'not_tried'
    || log.parent_impression_type === 'seems_wrong'
    || log.parent_impression_type === 'want_to_adjust';
}

function shouldRecommendPracticeChange(log: PracticeLogForFeedback) {
  return log.practice_attempt_type === 'barely_tried'
    || log.child_reaction_type === 'escalated'
    || log.child_reaction_type === 'not_tried'
    || log.parent_impression_type === 'seems_wrong'
    || log.parent_impression_type === 'want_to_adjust';
}

function chooseFeedbackDepth(
  log: PracticeLogForFeedback,
  recentNegativeCount: number,
  hasDeepFeedbackToday: boolean,
): FeedbackDepth {
  const needsDeepFeedback = log.child_reaction_type === 'escalated'
    || log.parent_impression_type === 'seems_wrong'
    || log.parent_impression_type === 'want_to_adjust'
    || hasLongNote(log)
    || recentNegativeCount >= 2;

  if (!needsDeepFeedback || hasDeepFeedbackToday) {
    return 'quick';
  }
  return 'deep';
}

function createStaticFeedback(log: PracticeLogForFeedback): PracticeFeedbackResponse {
  if (log.child_reaction_type === 'not_tried' || log.practice_attempt_type === 'barely_tried') {
    return {
      reactionInsight: '오늘은 실천이 아이와 부모님 모두에게 맞는 장면을 만나지 못했을 수 있어요. 못 해본 기록도 다음 시도를 조정하는 데 충분한 단서가 됩니다.',
      tomorrowAdjustment: '내일은 전체 실천을 다 하려 하기보다, 같은 상황이 보일 때 한 문장이나 10초 행동만 먼저 시도해보세요.',
      parentEncouragement: '실천을 못 한 날도 실패가 아니라 현실 점검이에요. 부담을 줄이는 쪽으로 다시 맞춰보면 됩니다.',
    };
  }

  return {
    reactionInsight: '아이 반응은 아직 한 번의 기록만으로 단정하기보다, 다음 시도에서 같은 흐름이 반복되는지 보는 편이 좋아요.',
    tomorrowAdjustment: '내일은 오늘과 같은 표현을 유지하되, 시작 시간을 더 짧게 잡고 아이가 받아들이는 첫 순간만 확인해보세요.',
    parentEncouragement: '오늘 남긴 기록만으로도 다음 시도를 더 현실적으로 조정할 수 있어요.',
  };
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
        .select('id, practice_id, user_id, date, done, memo, practice_attempt_type, practice_attempt_note, child_reaction_type, child_reaction_note, parent_impression_type, ai_feedback, ai_feedback_created_at, ai_feedback_model, ai_feedback_depth')
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
    const existingFeedback = parsePracticeFeedback(log.ai_feedback);
    if (existingFeedback && log.ai_feedback_created_at) {
      return NextResponse.json({
        feedback: existingFeedback,
        createdAt: log.ai_feedback_created_at,
        depth: log.ai_feedback_depth ?? 'quick',
        changeRecommended: shouldRecommendPracticeChange(log),
      });
    }

    if (!log.practice_attempt_type || !log.child_reaction_type || !log.parent_impression_type) {
      return NextResponse.json({ error: 'Missing practice feedback fields' }, { status: 400 });
    }

    const [recentLogsRes, deepLogsTodayRes] = await Promise.all([
      supabase
        .from('practice_logs')
        .select('id, date, done, practice_attempt_type, child_reaction_type, parent_impression_type, ai_feedback_depth')
        .eq('practice_id', practiceId)
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(5)
        .returns<RecentPracticeLogForFeedback[]>(),
      supabase
        .from('practice_logs')
        .select('id, date, done, practice_attempt_type, child_reaction_type, parent_impression_type, ai_feedback_depth')
        .eq('user_id', session.user.id)
        .eq('date', log.date)
        .eq('ai_feedback_depth', 'deep')
        .neq('id', log.id)
        .limit(1)
        .returns<RecentPracticeLogForFeedback[]>(),
    ]);

    const recentPracticeLogs = recentLogsRes.data ?? [];
    const recentNegativeCount = recentPracticeLogs.filter(isNegativeLog).length;
    const hasDeepFeedbackToday = (deepLogsTodayRes.data ?? []).length > 0;

    const shouldUseStaticFeedback = log.child_reaction_type === 'not_tried'
      || log.practice_attempt_type === 'barely_tried';

    if (!shouldUseStaticFeedback) {
      const quota = await consumeLlmQuota({ userId: session.user.id, kind: 'PRACTICE_FEEDBACK' });
      if (!quota.allowed) {
        return NextResponse.json(
          { error: 'AI 피드백 생성 한도를 초과했습니다. 내일 다시 시도해주세요.', code: LLM_QUOTA_EXCEEDED_CODE },
          { status: 429 }
        );
      }
    }
    const depth = shouldUseStaticFeedback
      ? 'quick'
      : chooseFeedbackDepth(log, recentNegativeCount, hasDeepFeedbackToday);
    const model = depth === 'deep' ? DEEP_FEEDBACK_MODEL : QUICK_FEEDBACK_MODEL;
    const attemptLabel = ATTEMPT_LABELS[log.practice_attempt_type] ?? log.practice_attempt_type;
    const reactionLabel = REACTION_LABELS[log.child_reaction_type] ?? log.child_reaction_type;
    const impressionLabel = IMPRESSION_LABELS[log.parent_impression_type] ?? log.parent_impression_type;
    const promptModeInstruction = depth === 'deep'
      ? '이번 기록은 사용자가 의구심이나 어려움을 드러낸 기록입니다. 가능한 원인을 2가지 이하로 신중하게 짚고, 실천을 바꿀지 말지 판단할 수 있게 다음 조정안을 더 구체적으로 제안하세요.'
      : '이번 기록은 기본 빠른 피드백입니다. 비용 효율적인 짧은 확인 피드백으로, 핵심 해석과 내일 한 가지 조정만 제안하세요.';
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
        practiceAttempt: attemptLabel,
        practiceAttemptNote: log.practice_attempt_note,
        childReaction: reactionLabel,
        childReactionNote: log.child_reaction_note,
        parentImpression: impressionLabel,
      },
      feedbackMode: depth,
      recentNegativeCount,
    };

    const feedback = shouldUseStaticFeedback
      ? createStaticFeedback(log)
      : await (async () => {
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
- 사용자가 실천을 어떻게 했는지, 아이가 어떻게 반응했는지, 양육자가 받은 인상을 함께 보세요.
- ${promptModeInstruction}
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
          temperature: depth === 'deep' ? 0.45 : 0.35,
        });

        const content = response.choices[0].message.content;
        const parsed = content ? JSON.parse(content) as unknown : null;
        const parsedFeedback = parsePracticeFeedback(parsed);
        if (!parsedFeedback) {
          throw new Error('INVALID_FEEDBACK_RESPONSE');
        }
        return parsedFeedback;
      })();

    const createdAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('practice_logs')
      .update({
        ai_feedback: feedback as unknown as Json,
        ai_feedback_created_at: createdAt,
        ai_feedback_model: shouldUseStaticFeedback ? 'static' : model,
        ai_feedback_depth: depth,
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
        attemptType: log.practice_attempt_type,
        reactionType: log.child_reaction_type,
        parentImpressionType: log.parent_impression_type,
        done: log.done,
        feedbackDepth: depth,
        feedbackModel: shouldUseStaticFeedback ? 'static' : model,
        staticFeedback: shouldUseStaticFeedback,
        changeRecommended: shouldRecommendPracticeChange(log),
      },
    });

    return NextResponse.json({
      feedback,
      createdAt,
      depth,
      changeRecommended: shouldRecommendPracticeChange(log),
    });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('[Practice Feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to generate practice feedback' }, { status: 500 });
  }
}
