import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { Json } from '@/types/supabase';

export type SubscriptionUsageFeature = 'AI_CONSULTATION' | 'PRACTICE_HISTORY';
export type SubscriptionUsageEventName =
  | 'CONSULT_QUESTIONS_INITIAL'
  | 'CONSULT_QUESTIONS_FOLLOWUP'
  | 'CONSULT_PRESCRIPTION'
  | 'PRACTICE_HISTORY_VIEW'
  | 'PRACTICE_AI_FEEDBACK';

type ActiveSubscriptionRow = {
  id: string;
};

type RecordUsageInput = {
  userId: string;
  feature: SubscriptionUsageFeature;
  eventName: SubscriptionUsageEventName;
  resourceType?: string;
  resourceId?: string;
  metadata?: Json;
};

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function recordSubscriptionUsageEvent(input: RecordUsageInput) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', input.userId)
    .in('status', ['ACTIVE', 'PAST_DUE'])
    .lte('current_period_start', now)
    .gte('current_period_end', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ActiveSubscriptionRow>();

  if (subscriptionError) {
    console.error('[Subscription Usage] Failed to find active subscription:', subscriptionError);
    return { recorded: false, reason: 'subscription_lookup_failed' as const };
  }

  if (!subscription) {
    return { recorded: false, reason: 'no_active_subscription' as const };
  }

  const { error: insertError } = await admin
    .from('subscription_usage_events')
    .insert({
      user_id: input.userId,
      subscription_id: subscription.id,
      feature: input.feature,
      event_name: input.eventName,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? {},
    });

  if (insertError) {
    console.error('[Subscription Usage] Failed to record usage event:', insertError);
    return { recorded: false, reason: 'insert_failed' as const };
  }

  return { recorded: true, subscriptionId: subscription.id };
}
