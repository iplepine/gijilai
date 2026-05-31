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

type SingleSelectFilter<T> = {
  eq: (...args: unknown[]) => SingleSelectFilter<T>;
  maybeSingle: () => Promise<{ data: T | null }>;
};

type ChildLookupQuery = {
  select: (...args: unknown[]) => SingleSelectFilter<{ parent_id: string }>;
};

type ProfileLookupQuery = {
  select: (...args: unknown[]) => SingleSelectFilter<{ created_at: string | null }>;
};

type MembershipLookupFilter = {
  eq: (...args: unknown[]) => MembershipLookupFilter;
  maybeSingle: () => Promise<{ data: { id: string } | null }>;
};

type MembershipLookupQuery = {
  select: (...args: unknown[]) => MembershipLookupFilter;
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

// 단일 사용자(userId)의 활성 구독 여부만 조회. childId 컨텍스트는 다루지 않는다.
async function hasActiveSubscription(
  supabase: { from: (table: string) => unknown },
  userId: string,
): Promise<boolean> {
  const subscriptionQuery = supabase
    .from('subscriptions') as SubscriptionLookupQuery;

  const { data: subscription } = await subscriptionQuery
    .select('id')
    .eq('user_id', userId)
    .in('status', ['ACTIVE', 'PAST_DUE'])
    .gte('current_period_end', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return !!subscription;
}

export async function getServerFeatureAccess(
  supabase: { from: (table: string) => unknown },
  params: { userId: string; userCreatedAt?: string | null }
) {
  const hasSubscription = await hasActiveSubscription(supabase, params.userId);
  return getFeatureAccess({
    userCreatedAt: params.userCreatedAt,
    hasSubscription,
  });
}

// 공동양육자 정책: 한 명의 owner 구독으로 양쪽이 사용할 수 있어야 한다.
// 본인 + (해당 아이의 owner가 다른 사람이라면) owner의 구독/체험을 OR로 결합한다.
// childId가 없거나 본인이 owner인 경우엔 본인 기준만 반환(기존 동작과 동일).
export async function getServerFeatureAccessForChild(
  supabase: { from: (table: string) => unknown },
  params: { userId: string; userCreatedAt?: string | null; childId?: string | null }
) {
  // 1) 본인 액세스 계산 (기존 로직)
  const selfHasSubscription = await hasActiveSubscription(supabase, params.userId);
  const selfAccess = getFeatureAccess({
    userCreatedAt: params.userCreatedAt,
    hasSubscription: selfHasSubscription,
  });

  if (!params.childId || selfAccess.hasFullAccess) {
    // 본인이 이미 풀 액세스이거나 childId 컨텍스트 없음 → 본인 액세스 그대로
    return selfAccess;
  }

  // 2) 해당 아이의 owner 조회
  const childQuery = supabase.from('children') as ChildLookupQuery;
  const { data: child } = await childQuery
    .select('parent_id')
    .eq('id', params.childId)
    .maybeSingle();

  if (!child || child.parent_id === params.userId) {
    // 본인이 owner이거나 아이가 없음 → 본인 액세스 그대로
    return selfAccess;
  }

  // 3) 본인이 ACCEPTED co-parent인지 확인
  const membershipQuery = supabase.from('child_co_parents') as MembershipLookupQuery;
  const { data: membership } = await membershipQuery
    .select('id')
    .eq('child_id', params.childId)
    .eq('co_parent_id', params.userId)
    .eq('status', 'ACCEPTED')
    .maybeSingle();

  if (!membership) {
    return selfAccess;
  }

  // 4) owner의 액세스 계산 (구독 + 체험)
  const ownerProfileQuery = supabase.from('profiles') as ProfileLookupQuery;
  const { data: ownerProfile } = await ownerProfileQuery
    .select('created_at')
    .eq('id', child.parent_id)
    .maybeSingle();

  const ownerHasSubscription = await hasActiveSubscription(supabase, child.parent_id);
  const ownerAccess = getFeatureAccess({
    userCreatedAt: ownerProfile?.created_at ?? null,
    hasSubscription: ownerHasSubscription,
  });

  // 5) OR 결합 — 둘 중 하나라도 풀 액세스면 풀 액세스로 본다.
  //    구독 표시(hasSubscription)는 본인 기준을 유지(결제 관리 UI는 본인 것만 노출).
  const combinedHasFullAccess = selfAccess.hasFullAccess || ownerAccess.hasFullAccess;

  return {
    trial: selfAccess.trial,
    hasSubscription: selfAccess.hasSubscription,
    hasFullAccess: combinedHasFullAccess,
    canUseConsult: combinedHasFullAccess,
    canViewAllPractices: combinedHasFullAccess,
    visiblePracticeCount: combinedHasFullAccess ? null : FREE_PRACTICE_VISIBLE_COUNT,
  };
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
