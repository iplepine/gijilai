import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabaseServer';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 활성 구독 조회. 결제 기간이 지난 ACTIVE/PAST_DUE 이력은 해지 대상이 아니다.
    const { data: subscription, error: findError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .gte('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    if (!subscription) {
      return NextResponse.json({ error: 'NO_ACTIVE_SUBSCRIPTION' }, { status: 400 });
    }

    if (subscription.cancelled_at) {
      return NextResponse.json({
        success: true,
        activeUntil: subscription.current_period_end,
        alreadyCancelled: true,
      });
    }

    if (subscription.source !== 'PORTONE') {
      return NextResponse.json({ error: 'UNSUPPORTED_SUBSCRIPTION_SOURCE' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // subscriptions RLS는 사용자의 update를 허용하지 않으므로 서버 service role로 해지 예약한다.
    // status는 유지하고 갱신 cron이 current_period_end 도달 시 EXPIRED로 전환한다.
    const { error: updateError } = await getSupabaseAdmin()
      .from('subscriptions')
      .update({
        cancelled_at: now,
        updated_at: now,
      })
      .eq('id', subscription.id)
      .eq('user_id', session.user.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      activeUntil: subscription.current_period_end,
    });
  } catch (error: unknown) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
