import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Webhook } from '@portone/server-sdk';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.text();

    // 웹훅 시그니처 검증
    const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
    if (webhookSecret) {
      try {
        await Webhook.verify(webhookSecret, body, {
          'webhook-id': req.headers.get('webhook-id') ?? '',
          'webhook-signature': req.headers.get('webhook-signature') ?? '',
          'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
        });
      } catch {
        console.error('Webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const { type, data } = JSON.parse(body);

    switch (type) {
      case 'Transaction.Paid': {
        const paymentId = data?.paymentId;
        if (!paymentId) break;

        // 멱등성: 이미 PAID면 무시
        const { data: existing } = await getSupabaseAdmin()
          .from('payments')
          .select('id, status, type, metadata')
          .eq('portone_payment_id', paymentId)
          .single();

        if (!existing || existing.status === 'PAID') break;

        await getSupabaseAdmin()
          .from('payments')
          .update({ status: 'PAID', paid_at: new Date().toISOString() })
          .eq('portone_payment_id', paymentId);

        // 건별 결제면 리포트 업데이트
        if (existing.type === 'ONE_TIME' && existing.metadata?.reportId) {
          await getSupabaseAdmin()
            .from('reports')
            .update({ is_paid: true })
            .eq('id', existing.metadata.reportId);
        }

        break;
      }

      case 'Transaction.Failed': {
        const paymentId = data?.paymentId;
        if (!paymentId) break;

        await getSupabaseAdmin()
          .from('payments')
          .update({
            status: 'FAILED',
            failed_reason: data?.failReason || 'Unknown',
          })
          .eq('portone_payment_id', paymentId);

        break;
      }

      case 'Transaction.Cancelled': {
        const paymentId = data?.paymentId;
        if (!paymentId) break;

        await getSupabaseAdmin()
          .from('payments')
          .update({ status: 'CANCELLED' })
          .eq('portone_payment_id', paymentId);

        break;
      }

      case 'BillingKey.Deleted': {
        const billingKey = data?.billingKey;
        if (!billingKey) break;

        // 빌링키 삭제 = 자동 해지 예약
        await getSupabaseAdmin()
          .from('subscriptions')
          .update({
            billing_key: null,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('billing_key', billingKey)
          .in('status', ['ACTIVE', 'PAST_DUE']);

        break;
      }
    }

    // 포트원 재시도 방지: 항상 200 반환
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true });
  }
}
