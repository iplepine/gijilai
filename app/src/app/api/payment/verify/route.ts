import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { verifyPayment, getAmount } from '@/lib/portone';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, reportId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'MISSING_PAYMENT_ID' }, { status: 400 });
    }

    // 포트원 서버에서 결제 조회
    const payment = await verifyPayment(paymentId);

    if (payment.status !== 'PAID') {
      return NextResponse.json({ error: 'PAYMENT_NOT_PAID' }, { status: 400 });
    }

    // 금액 검증
    const currency = (payment.currency || 'KRW') as 'KRW' | 'USD';
    const expectedAmount = getAmount('report_single', currency);
    if (payment.amount?.total !== expectedAmount) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
    }

    // 중복 처리 방지
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('portone_payment_id', paymentId)
      .single();

    if (existingPayment) {
      return NextResponse.json({ error: 'ALREADY_PROCESSED' }, { status: 400 });
    }

    // payments 테이블에 기록
    const { error: paymentError } = await supabase
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
      await supabase
        .from('reports')
        .update({ is_paid: true })
        .eq('id', reportId)
        .eq('user_id', session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
