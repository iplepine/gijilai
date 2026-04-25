import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Webhook } from '@portone/server-sdk';
import { verifyPayment, cancelPayment } from '@/lib/portone';
import { computePeriodEnd } from '@/lib/subscription';
import type { Json } from '@/types/supabase';

type PaymentMetadata = { reportId?: string };
type PortoneWebhookPayload = {
  type?: string;
  data?: {
    paymentId?: string;
    billingKey?: string;
    failReason?: string;
  };
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getReportId(metadata: Json | null): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const reportId = (metadata as PaymentMetadata).reportId;
  return typeof reportId === 'string' ? reportId : null;
}

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getWebhookSecrets(): string[] {
  const secrets = [
    process.env.PORTONE_WEBHOOK_SECRET,
    process.env.PORTONE_WEBHOOK_SECRET_SECONDARY,
    ...(process.env.PORTONE_WEBHOOK_SECRETS?.split(',') ?? []),
  ]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(secrets)];
}

export async function POST(req: Request) {
  try {
    const body = await req.text();

    // 웹훅 시그니처 검증
    const webhookSecrets = getWebhookSecrets();
    if (webhookSecrets.length > 0) {
      const headers = {
        'webhook-id': req.headers.get('webhook-id') ?? '',
        'webhook-signature': req.headers.get('webhook-signature') ?? '',
        'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      };

      let verified = false;
      const verificationErrors: string[] = [];

      for (const webhookSecret of webhookSecrets) {
        try {
          await Webhook.verify(webhookSecret, body, headers);
          verified = true;
          break;
        } catch (error) {
          verificationErrors.push(getErrorMessage(error));
        }
      }

      if (!verified) {
        console.error('Webhook signature verification failed', {
          headerPresence: {
            webhookId: Boolean(headers['webhook-id']),
            webhookSignature: Boolean(headers['webhook-signature']),
            webhookTimestamp: Boolean(headers['webhook-timestamp']),
          },
          secretCount: webhookSecrets.length,
          verificationErrors,
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const { type, data } = JSON.parse(body) as PortoneWebhookPayload;

    switch (type) {
      case 'Transaction.Paid': {
        const paymentId = data?.paymentId;
        if (!paymentId) break;

        const admin = getSupabaseAdmin();

        // 멱등성: 이미 PAID면 무시
        const { data: existing } = await admin
          .from('payments')
          .select('id, status, type, metadata')
          .eq('portone_payment_id', paymentId)
          .single();

        if (existing?.status === 'PAID') break;

        if (existing) {
          // 기존 레코드가 있으면 상태만 업데이트
          await admin
            .from('payments')
            .update({ status: 'PAID', paid_at: new Date().toISOString() })
            .eq('portone_payment_id', paymentId);

          // 건별 결제면 리포트 업데이트
          const reportId = getReportId(existing.metadata);
          if (existing.type === 'ONE_TIME' && reportId) {
            await admin
              .from('reports')
              .update({ is_paid: true })
              .eq('id', reportId);
          }
        } else if (paymentId.startsWith('sub_')) {
          // 구독 결제인데 DB 레코드가 없음 = subscribe API가 실패한 케이스
          // PortOne에서 결제 정보 조회 후 구독 복구
          try {
            const portonePayment = await verifyPayment(paymentId);
            if (!('paidAt' in portonePayment)) break;

            const customerId = portonePayment.customer?.id;
            if (!customerId) break;

            const amount = portonePayment.amount?.total ?? 0;
            const currency = portonePayment.currency === 'KRW' ? 'KRW' : 'USD';
            const billingKey = 'billingKey' in portonePayment
              ? (typeof portonePayment.billingKey === 'string' ? portonePayment.billingKey : null)
              : null;
            // [연 구독] 재활성화 시: orderName 기반 판별 복원
            // const orderName = portonePayment.orderName ?? '';
            // const plan = orderName.includes('연') || orderName.includes('Yearly') ? 'YEARLY' : 'MONTHLY';
            const plan = 'MONTHLY';

            // 이미 활성 구독이 있으면 환불
            const { data: activeSub } = await admin
              .from('subscriptions')
              .select('id')
              .eq('user_id', customerId)
              .in('status', ['ACTIVE', 'PAST_DUE'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeSub) {
              await cancelPayment(paymentId, '이미 활성 구독 존재 — 중복 결제 자동 환불');
              break;
            }

            // 구독 생성
            const now = new Date();
            const periodEnd = computePeriodEnd(plan, now);

            const { data: subscription, error: subError } = await admin
              .from('subscriptions')
              .insert({
                user_id: customerId,
                plan,
                status: 'ACTIVE',
                billing_key: billingKey,
                portone_customer_id: customerId,
                currency,
                amount,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
              })
              .select()
              .single();

            if (subError) {
              console.error('Webhook: subscription recovery failed, refunding:', subError);
              await cancelPayment(paymentId, '웹훅 구독 복구 실패 — 자동 환불');
              break;
            }

            // 결제 기록
            await admin.from('payments').insert({
              user_id: customerId,
              subscription_id: subscription.id,
              type: 'SUBSCRIPTION',
              portone_payment_id: paymentId,
              status: 'PAID',
              currency,
              amount,
              paid_at: now.toISOString(),
            });

            console.log(`Webhook: recovered subscription for user ${customerId}`);
          } catch (recoveryError) {
            console.error('Webhook: subscription recovery error:', recoveryError);
          }
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
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    console.error('Webhook error detail:', getErrorMessage(error));
    return NextResponse.json({ received: true });
  }
}
