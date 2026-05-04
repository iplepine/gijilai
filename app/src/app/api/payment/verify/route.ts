import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, parseJsonBody } from '@/lib/api';
import { createClient } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyPayment } from '@/lib/portone';

type VerifyRequest = {
  paymentId?: string;
  reportId?: string;
};

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

    const { paymentId, reportId } = await parseJsonBody<VerifyRequest>(req);

    if (!paymentId) {
      return NextResponse.json({ error: 'MISSING_PAYMENT_ID' }, { status: 400 });
    }

    // 포트원 서버에서 결제 조회
    const payment = await verifyPayment(paymentId);

    if (payment.status !== 'PAID') {
      return NextResponse.json({ error: 'PAYMENT_NOT_PAID' }, { status: 400 });
    }

    // 금액 검증 (건별 구매 폐지됨 — 기존 결제 건 호환용으로 유지)
    const currency = (payment.currency || 'KRW') as 'KRW' | 'USD';
    const legacyPrices = { KRW: 1980, USD: 499 } as const;
    const expectedAmount = legacyPrices[currency];
    if (payment.amount?.total !== expectedAmount) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
    }

    // 중복 처리 방지
    const admin = getSupabaseAdmin();

    const { data: existingPayment, error: existingPaymentError } = await admin
      .from('payments')
      .select('id')
      .eq('portone_payment_id', paymentId)
      .maybeSingle();

    if (existingPaymentError) throw existingPaymentError;

    if (existingPayment) {
      return NextResponse.json({ error: 'ALREADY_PROCESSED' }, { status: 400 });
    }

    if (reportId) {
      const { data: report, error: reportError } = await admin
        .from('reports')
        .select('id')
        .eq('id', reportId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (reportError) throw reportError;
      if (!report) {
        return NextResponse.json({ error: 'REPORT_NOT_FOUND' }, { status: 404 });
      }
    }

    // payments 테이블에 기록
    const { error: paymentError } = await admin
      .from('payments')
      .insert({
        user_id: session.user.id,
        type: 'ONE_TIME',
        portone_payment_id: paymentId,
        status: 'PAID',
        currency,
        amount: expectedAmount,
        pg_provider: null,
        pay_method: payment.method ? String(payment.method.type || '') : null,
        paid_at: new Date().toISOString(),
        metadata: reportId ? { reportId } : null,
      });

    if (paymentError) throw paymentError;

    // 리포트 결제 상태 업데이트
    if (reportId) {
      const { error: reportUpdateError } = await admin
        .from('reports')
        .update({ is_paid: true })
        .eq('id', reportId)
        .eq('user_id', session.user.id);
      if (reportUpdateError) throw reportUpdateError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('Payment verify error:', error);
    return NextResponse.json({ error: 'PAYMENT_VERIFICATION_FAILED' }, { status: 500 });
  }
}
