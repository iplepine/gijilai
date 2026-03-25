import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { payWithBillingKey } from '@/lib/portone';
import { computePeriodEnd } from '@/lib/subscription';
import type { Currency } from '@/lib/portone';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_RETRY_COUNT = 3;

export async function POST(req: Request) {
  // Cron 인증
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 갱신 대상 구독 조회
    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .in('status', ['ACTIVE', 'PAST_DUE'])
      .lte('current_period_end', new Date().toISOString())
      .not('billing_key', 'is', null);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      // 해지 예약된 구독은 만료 처리
      if (sub.cancelled_at) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
          .eq('id', sub.id);
        processed++;
        continue;
      }

      const currency = sub.currency as Currency;
      const paymentId = `renewal_${sub.id.substring(0, 8)}_${Date.now()}`;

      try {
        const result = await payWithBillingKey({
          billingKey: sub.billing_key!,
          paymentId,
          orderName: sub.plan === 'MONTHLY' ? '기질아이 월 구독 갱신' : '기질아이 연 구독 갱신',
          amount: sub.amount,
          currency,
          customerId: sub.user_id,
        });

        if (result?.payment?.paidAt) {
          // 갱신 성공
          const newPeriodEnd = computePeriodEnd(sub.plan as 'MONTHLY' | 'YEARLY');
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'ACTIVE',
              current_period_start: new Date().toISOString(),
              current_period_end: newPeriodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id);

          await supabaseAdmin.from('payments').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            type: 'RENEWAL',
            portone_payment_id: paymentId,
            status: 'PAID',
            currency,
            amount: sub.amount,
            paid_at: new Date().toISOString(),
          });

          processed++;
        } else {
          throw new Error('Payment not confirmed');
        }
      } catch (payError: any) {
        // 갱신 실패
        await supabaseAdmin.from('payments').insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          type: 'RENEWAL',
          portone_payment_id: paymentId,
          status: 'FAILED',
          currency,
          amount: sub.amount,
          failed_reason: payError.message || 'Unknown',
        });

        // 최근 연속 실패 횟수 확인
        const { count } = await supabaseAdmin
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('subscription_id', sub.id)
          .eq('type', 'RENEWAL')
          .eq('status', 'FAILED')
          .gte('created_at', new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString());

        const retryCount = count || 0;

        if (retryCount >= MAX_RETRY_COUNT) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
            .eq('id', sub.id);
        } else {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'PAST_DUE', updated_at: new Date().toISOString() })
            .eq('id', sub.id);
        }

        failed++;
      }
    }

    return NextResponse.json({ processed, failed, total: subscriptions.length });
  } catch (error: any) {
    console.error('Billing cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
