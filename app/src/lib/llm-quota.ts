/**
 * LLM 호출 사용자별 일일 쿼터 (abuse guard).
 *
 * subscription_usage_events는 활성 구독자만 기록되므로 무료/체험 사용자를 막지 못한다.
 * 모든 인증 사용자의 LLM 호출을 호출 "전에" llm_usage_events에 기록하고,
 * 최근 24시간 카운트가 한도를 넘으면 차단한다 (차단된 시도도 카운트에 남는다).
 *
 * 정상 사용자는 닿을 수 없는 수준의 한도다. 제품 차원의 사용량 제한이 아니라
 * 한 계정으로 OpenAI 비용을 무한정 태우는 것을 막는 안전장치다.
 *
 * 운영 중 조정: 환경변수 LLM_DAILY_LIMIT_<KIND> (예: LLM_DAILY_LIMIT_REPORT=20)
 * 테이블이 아직 없거나 DB 오류가 나면 차단하지 않고 통과시킨다(fail-open) —
 * 쿼터 인프라 문제로 제품이 멈추면 안 되기 때문.
 */
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';

export type LlmUsageKind =
  | 'REPORT'
  | 'CONSULT_QUESTIONS'
  | 'CONSULT_PRESCRIPTION'
  | 'PRACTICE_FEEDBACK'
  | 'SELF_PARENT_QUESTIONS'
  | 'SELF_PARENT_PRESCRIPTION'
  | 'TRANSLATE';

export const LLM_QUOTA_EXCEEDED_CODE = 'LLM_QUOTA_EXCEEDED';

const DEFAULT_DAILY_LIMITS: Record<LlmUsageKind, number> = {
  REPORT: 12,
  CONSULT_QUESTIONS: 60,
  CONSULT_PRESCRIPTION: 20,
  PRACTICE_FEEDBACK: 40,
  SELF_PARENT_QUESTIONS: 30,
  SELF_PARENT_PRESCRIPTION: 10,
  TRANSLATE: 30,
};

const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function getLlmDailyLimit(kind: LlmUsageKind): number {
  const override = process.env[`LLM_DAILY_LIMIT_${kind}`];
  if (override) {
    const parsed = Number.parseInt(override, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_DAILY_LIMITS[kind];
}

export type LlmQuotaResult = {
  allowed: boolean;
  count: number;
  limit: number;
};

export async function consumeLlmQuota(
  input: { userId: string; kind: LlmUsageKind },
  adminClient?: SupabaseClient
): Promise<LlmQuotaResult> {
  const limit = getLlmDailyLimit(input.kind);
  const failOpen: LlmQuotaResult = { allowed: true, count: 0, limit };

  try {
    const admin = adminClient ?? getSupabaseAdmin();

    const { error: insertError } = await admin
      .from('llm_usage_events')
      .insert({ user_id: input.userId, kind: input.kind });

    if (insertError) {
      console.error('[LLM Quota] Failed to record usage event (fail-open):', insertError);
      return failOpen;
    }

    const since = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString();
    const { count, error: countError } = await admin
      .from('llm_usage_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .eq('kind', input.kind)
      .gte('created_at', since);

    if (countError || count === null || count === undefined) {
      console.error('[LLM Quota] Failed to count usage events (fail-open):', countError);
      return failOpen;
    }

    if (count > limit) {
      console.warn(`[LLM Quota] Blocked ${input.kind} for user=${input.userId} (${count}/${limit} in 24h)`);
      return { allowed: false, count, limit };
    }

    return { allowed: true, count, limit };
  } catch (error) {
    console.error('[LLM Quota] Unexpected error (fail-open):', error);
    return failOpen;
  }
}
