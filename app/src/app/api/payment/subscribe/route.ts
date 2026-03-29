import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { payWithBillingKey, getAmount } from '@/lib/portone';
import { computePeriodEnd } from '@/lib/subscription';
import type { Currency } from '@/lib/portone';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billingKey, plan, locale } = await req.json();

    if (!billingKey || !plan || !['MONTHLY', 'YEARLY'].includes(plan)) {
      return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 });
    }

    // 기존 활성 구독 확인
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', session.user.id)
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .single();

    if (existingSub) {
      return NextResponse.json({ error: 'ALREADY_SUBSCRIBED' }, { status: 400 });
    }

    const currency: Currency = locale === 'ko' ? 'KRW' : 'USD';
    const productCode = plan === 'MONTHLY' ? 'subscription_monthly' : 'subscription_yearly';
    const amount = getAmount(productCode, currency);
    const paymentId = `sub_${session.user.id.substring(0, 8)}_${Date.now()}`;

    // 빌링키로 첫 결제 실행
    const payResult = await payWithBillingKey({
      billingKey,
      paymentId,
      orderName: plan === 'MONTHLY' ? '기질아이 월 구독' : '기질아이 연 구독',
      amount,
      currency,
      customerId: session.user.id,
    });

    if (!payResult?.payment?.paidAt) {
      return NextResponse.json({ error: 'BILLING_FAILED' }, { status: 400 });
    }

    // 구독 생성 (service_role로 RLS 우회)
    const admin = getSupabaseAdmin();
    const now = new Date();
    const periodEnd = computePeriodEnd(plan, now);

    const { data: subscription, error: subError } = await admin
      .from('subscriptions')
      .insert({
        user_id: session.user.id,
        plan,
        status: 'ACTIVE',
        billing_key: billingKey,
        portone_customer_id: session.user.id,
        currency,
        amount,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (subError) throw subError;

    // 결제 기록
    await admin.from('payments').insert({
      user_id: session.user.id,
      subscription_id: subscription.id,
      type: 'SUBSCRIPTION',
      portone_payment_id: paymentId,
      status: 'PAID',
      currency,
      amount,
      paid_at: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        currentPeriodEnd: subscription.current_period_end,
      },
    });
  } catch (error: any) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
