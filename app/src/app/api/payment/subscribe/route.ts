import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { createClient } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  payWithBillingKey,
  getAmount,
  getFirstMonthAmount,
  cancelPayment,
  getKoChannelKey,
  getPaymentMethodType,
  getPaymentPgProvider,
  toPaymentMethodMetadata,
  type PayMethod,
} from '@/lib/portone';
import { computePeriodEnd } from '@/lib/subscription';
import type { Currency } from '@/lib/portone';

type SubscribeRequest = {
  billingKey?: string;
  plan?: 'MONTHLY' | 'YEARLY';
  locale?: string;
  payMethod?: PayMethod;
};

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getErrorDetail(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    return (error as { data?: unknown }).data ?? error;
  }
  return error;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billingKey, plan, locale, payMethod } = await parseJsonBody<SubscribeRequest>(req);

    if (!billingKey || !plan || (plan !== 'MONTHLY' && plan !== 'YEARLY')) {
      return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 });
    }

    if (locale === 'ko' && payMethod && !['KCP_CARD', 'INICIS_CARD'].includes(payMethod)) {
      return NextResponse.json({ error: 'INVALID_PAY_METHOD' }, { status: 400 });
    }

    // 기존 활성 구독 확인
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', session.user.id)
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      return NextResponse.json({ error: 'ALREADY_SUBSCRIBED' }, { status: 400 });
    }

    const currency: Currency = locale === 'ko' ? 'KRW' : 'USD';
    const channelKey = locale === 'ko'
      ? getKoChannelKey(payMethod ?? 'INICIS_CARD')
      : process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_STRIPE;
    const productCode = plan === 'YEARLY' ? 'subscription_yearly' : 'subscription_monthly';
    const regularAmount = getAmount(productCode, currency);

    // 최초 구독 여부 확인 (과거 구독 이력이 없으면 첫 달 할인 — 월 구독에만 적용)
    const { count: pastSubCount } = await getSupabaseAdmin()
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    const isFirstSubscription = (pastSubCount ?? 0) === 0;
    // 연 구독은 첫 달 할인 미적용 (이미 yearly 자체 20% 할인 — 다크패턴법·중복할인 분쟁 회피)
    const firstPayAmount =
      plan === 'MONTHLY' && isFirstSubscription
        ? getFirstMonthAmount(currency)
        : regularAmount;
    const paymentId = `sub_${session.user.id.substring(0, 8)}_${Date.now()}`;

    // 빌링키로 첫 결제 실행
    const orderName =
      plan === 'YEARLY'
        ? '기질아이 연 구독'
        : isFirstSubscription
          ? '기질아이 월 구독 (첫 달 할인)'
          : '기질아이 월 구독';
    const payResult = await payWithBillingKey({
      billingKey,
      paymentId,
      orderName,
      amount: firstPayAmount,
      currency,
      customerId: session.user.id,
      channelKey,
    });

    if (!payResult?.payment?.paidAt) {
      return NextResponse.json({ error: 'BILLING_FAILED' }, { status: 400 });
    }

    // 결제 성공 후 구독 생성 — 실패 시 자동 환불
    try {
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
          amount: regularAmount,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .select()
        .single();

      if (subError) throw subError;

      // 결제 기록 (실제 결제 금액)
      const { error: paymentInsertError } = await admin.from('payments').insert({
        user_id: session.user.id,
        subscription_id: subscription.id,
        type: 'SUBSCRIPTION',
        portone_payment_id: paymentId,
        status: 'PAID',
        currency,
        amount: firstPayAmount,
        pg_provider: getPaymentPgProvider(payResult.payment),
        pay_method: getPaymentMethodType(payResult.payment) ?? (payMethod?.includes('CARD') ? 'CARD' : payMethod ?? null),
        paid_at: now.toISOString(),
        metadata: toPaymentMethodMetadata(payResult.payment, {
          selectedPayMethod: payMethod ?? null,
          isFirstSubscription,
        }),
      });
      if (paymentInsertError) throw paymentInsertError;

      return NextResponse.json({
        success: true,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          currentPeriodEnd: subscription.current_period_end,
        },
      });
    } catch (dbError: unknown) {
      // 구독/결제기록 생성 실패 → 결제 취소(환불)
      console.error('Subscribe DB error, cancelling payment:', dbError);
      const nowIso = new Date().toISOString();
      const admin = getSupabaseAdmin();
      try {
        await cancelPayment(paymentId, '구독 생성 실패로 인한 자동 환불');
      } catch (cancelError) {
        console.error('Auto-cancel also failed:', cancelError);
      }
      const { error: subscriptionCleanupError } = await admin
        .from('subscriptions')
        .update({
          status: 'CANCELLED',
          cancelled_at: nowIso,
          updated_at: nowIso,
          billing_key: null,
        })
        .eq('user_id', session.user.id)
        .eq('billing_key', billingKey)
        .in('status', ['ACTIVE', 'PAST_DUE']);
      if (subscriptionCleanupError) {
        console.error('Subscribe cleanup failed:', subscriptionCleanupError);
      }
      return NextResponse.json({ error: '구독 생성 실패' }, { status: 500 });
    }
  } catch (error: unknown) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('Subscribe error:', error);
    console.error('Subscribe error detail:', JSON.stringify(getErrorDetail(error), null, 2));
    return NextResponse.json({ error: 'SUBSCRIBE_FAILED' }, { status: 500 });
  }
}
