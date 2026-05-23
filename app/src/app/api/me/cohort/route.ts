import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * GA4 user_properties용 코호트 정보 1회 응답.
 * - signup_cohort: profiles.created_at의 YYYY-MM
 * - first_paid_at: 첫 PAID payment의 YYYY-MM-DD (없으면 null)
 * - plan: 활성 구독의 plan 또는 'FREE'
 * - child_count: 등록 자녀 수
 *
 * RLS로 자기 데이터만 읽는다.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // 병렬 페치 — RLS가 모두 자기 행만 허용
  const [profileRes, paymentRes, subRes, childRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('status', 'PAID')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle(),
    supabase
      .from('children')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', user.id),
  ]);

  const signupAt = profileRes.data?.created_at ?? null;
  const signupCohort = signupAt ? signupAt.slice(0, 7) : null; // YYYY-MM
  const firstPaidAt = paymentRes.data?.created_at
    ? paymentRes.data.created_at.slice(0, 10) // YYYY-MM-DD
    : null;
  const plan = subRes.data?.plan ?? 'FREE';
  const childCount = childRes.count ?? 0;

  return NextResponse.json({
    signup_cohort: signupCohort,
    first_paid_at: firstPaidAt,
    plan,
    child_count: childCount,
  });
}
