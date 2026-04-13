import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 활성 구독 조회
    const { data: subscription, error: findError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .single();

    if (findError || !subscription) {
      return NextResponse.json({ error: 'NO_ACTIVE_SUBSCRIPTION' }, { status: 400 });
    }

    // 해지 예약 (cancelled_at 설정, status는 ACTIVE 유지)
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

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
