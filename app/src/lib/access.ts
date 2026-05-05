export const TRIAL_DAYS = 7;
export const FREE_PRACTICE_VISIBLE_COUNT = 1;
export const FREE_CHILD_PROFILE_LIMIT = 1;
export const CHILD_PROFILE_LIMIT_REACHED_CODE = 'CHILD_PROFILE_LIMIT_REACHED';
export const LAST_FREE_CHILD_DELETE_BLOCKED_CODE = 'LAST_FREE_CHILD_DELETE_BLOCKED';

export type ChildProfileAccess = ReturnType<typeof getChildProfileAccess>;

type SubscriptionLookupFilter = {
  eq: (...args: unknown[]) => SubscriptionLookupQuery;
  in: (...args: unknown[]) => SubscriptionLookupQuery;
  gte: (...args: unknown[]) => SubscriptionLookupQuery;
  order: (...args: unknown[]) => SubscriptionLookupQuery;
  limit: (...args: unknown[]) => SubscriptionLookupQuery;
  maybeSingle: () => Promise<{ data: { id: string } | null }>;
};

type SubscriptionLookupQuery = SubscriptionLookupFilter & {
  select: (...args: unknown[]) => SubscriptionLookupFilter;
};

type CountLookupQuery = {
  eq: (...args: unknown[]) => Promise<{ count: number | null; error: unknown }>;
};

type CountLookupTable = {
  select: (...args: unknown[]) => CountLookupQuery;
};

export function getTrialStatus(userCreatedAt: string) {
  const created = new Date(userCreatedAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const isActive = diffDays < TRIAL_DAYS;
  const daysRemaining = isActive ? Math.ceil(TRIAL_DAYS - diffDays) : 0;

  return { isActive, daysRemaining, diffDays };
}

export function getFeatureAccess(params: { userCreatedAt?: string | null; hasSubscription: boolean }) {
  const trial = params.userCreatedAt ? getTrialStatus(params.userCreatedAt) : null;
  const hasFullAccess = params.hasSubscription || !!trial?.isActive;

  return {
    trial,
    hasSubscription: params.hasSubscription,
    hasFullAccess,
    canUseConsult: hasFullAccess,
    canViewAllPractices: hasFullAccess,
    visiblePracticeCount: hasFullAccess ? null : FREE_PRACTICE_VISIBLE_COUNT,
  };
}

export function getChildProfileAccess(params: {
  userCreatedAt?: string | null;
  hasSubscription: boolean;
  childCount: number;
  lifetimeChildSlots: number;
}) {
  const featureAccess = getFeatureAccess({
    userCreatedAt: params.userCreatedAt,
    hasSubscription: params.hasSubscription,
  });
  const hasFullChildProfileAccess = featureAccess.hasFullAccess;

  return {
    trial: featureAccess.trial,
    hasSubscription: featureAccess.hasSubscription,
    hasFullChildProfileAccess,
    freeChildProfileLimit: FREE_CHILD_PROFILE_LIMIT,
    childCount: params.childCount,
    lifetimeChildSlots: params.lifetimeChildSlots,
    canCreateChild: hasFullChildProfileAccess || params.lifetimeChildSlots < FREE_CHILD_PROFILE_LIMIT,
    canDeleteChild: hasFullChildProfileAccess || params.childCount > FREE_CHILD_PROFILE_LIMIT,
    canDeleteLastChild: hasFullChildProfileAccess,
  };
}

async function countRows(
  supabase: { from: (table: string) => unknown },
  table: string,
  column: string,
  value: string
) {
  const query = (supabase.from(table) as CountLookupTable)
    .select('id', { count: 'exact', head: true });
  const { count, error } = await query.eq(column, value);

  if (error) throw error;
  return count ?? 0;
}

export async function getServerFeatureAccess(
  supabase: { from: (table: string) => unknown },
  params: { userId: string; userCreatedAt?: string | null }
) {
  const subscriptionQuery = supabase
    .from('subscriptions') as SubscriptionLookupQuery;

  const { data: subscription } = await subscriptionQuery
    .select('id')
    .eq('user_id', params.userId)
    .in('status', ['ACTIVE', 'PAST_DUE'])
    .gte('current_period_end', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return getFeatureAccess({
    userCreatedAt: params.userCreatedAt,
    hasSubscription: !!subscription,
  });
}

export async function getServerChildProfileAccess(
  supabase: { from: (table: string) => unknown },
  params: { userId: string; userCreatedAt?: string | null }
) {
  const featureAccess = await getServerFeatureAccess(supabase, params);
  const [childCount, lifetimeChildSlots] = await Promise.all([
    countRows(supabase, 'children', 'parent_id', params.userId),
    countRows(supabase, 'child_profile_slots', 'user_id', params.userId),
  ]);

  return getChildProfileAccess({
    userCreatedAt: params.userCreatedAt,
    hasSubscription: featureAccess.hasSubscription,
    childCount,
    lifetimeChildSlots,
  });
}
