import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .gte('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 과거 구독 이력 확인 (첫 달 할인 표시 판단용)
    const { count: pastSubCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    return NextResponse.json({
      subscription: subscription || null,
      isFirstSubscription: (pastSubCount ?? 0) === 0,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
