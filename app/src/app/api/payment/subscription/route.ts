import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { refreshIapSubscriptionState } from '@/lib/iap';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .gte('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscription && subscription.source === 'GOOGLE_PLAY') {
      try {
        await refreshIapSubscriptionState(subscription);

        const { data: refreshed } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('id', subscription.id)
          .maybeSingle();

        if (refreshed) {
          subscription = refreshed;
        }
      } catch (refreshError) {
        console.error('Refresh Google Play subscription error:', refreshError);
      }
    }

    // 과거 구독 이력 확인 (첫 달 할인 표시 판단용)
    const { count: pastSubCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    return NextResponse.json({
      subscription: subscription || null,
      isFirstSubscription: (pastSubCount ?? 0) === 0,
    });
  } catch (error: unknown) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
