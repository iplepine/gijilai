'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, PaymentData } from '@/lib/db';


export default function SubscriptionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch('/api/payment/subscription').then(r => r.json()),
      db.getPaymentHistory(user.id),
    ]).then(([subData, paymentData]) => {
      setSubscription(subData.subscription);
      setPayments(paymentData);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  const handleCancel = async () => {
    if (!confirm('구독을 해지하시겠습니까?\n현재 결제 기간이 끝날 때까지 서비스를 이용할 수 있습니다.')) return;

    setCancelling(true);
    try {
      const res = await fetch('/api/payment/cancel-subscription', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSubscription((prev: any) => prev ? { ...prev, cancelled_at: new Date().toISOString() } : null);
        alert(`구독이 해지 예약되었습니다.\n${new Date(data.activeUntil).toLocaleDateString('ko-KR')}까지 이용 가능합니다.`);
      } else {
        alert(data.error || '해지 처리 중 오류가 발생했습니다.');
      }
    } catch (e: any) {
      alert('해지 처리 중 오류가 발생했습니다.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center">
        <div className="w-full app-shell-width min-h-screen flex flex-col">
          <Navbar title="구독 관리" showBack />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // [연 구독] 재활성화 시: subscription?.plan === 'YEARLY' ? '연 구독' : ... 분기 추가
  const planLabel = subscription?.plan === 'MONTHLY' ? '월 구독' : '';
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR') : '';
  const isCancelled = !!subscription?.cancelled_at;

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full app-shell-width min-h-screen flex flex-col shadow-2xl">
        <Navbar title="구독 관리" showBack />

        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-10 space-y-6">
          {subscription ? (
            <>
              {/* Current Plan */}
              <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-beige-main/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-text-sub">현재 플랜</p>
                    <p className="text-lg font-black text-text-main dark:text-white">{planLabel}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                    isCancelled
                      ? 'bg-amber-100 text-amber-700'
                      : subscription.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {isCancelled ? '해지 예약' : subscription.status === 'ACTIVE' ? '활성' : subscription.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-sub">{isCancelled ? '이용 가능일' : '다음 결제일'}</span>
                    <span className="font-bold">{periodEnd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-sub">결제 금액</span>
                    <span className="font-bold">
                      {subscription.currency === 'KRW'
                        ? `${subscription.amount.toLocaleString()}원`
                        : `$${(subscription.amount / 100).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {isCancelled ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                    {periodEnd}까지 모든 프리미엄 기능을 이용할 수 있습니다. 이후 무료 플랜으로 전환됩니다.
                  </p>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="mt-2"
                  >
                    {cancelling ? '처리 중...' : '구독 해지'}
                  </Button>
                )}
              </section>
            </>
          ) : (
            <section className="text-center space-y-4 py-12">
              <Icon name="credit_card_off" className="text-text-sub/30 text-5xl" size="lg" />
              <p className="text-text-sub text-sm">활성 구독이 없습니다.</p>
              <Button variant="primary" onClick={() => router.push('/pricing')}>
                구독 시작하기
              </Button>
            </section>
          )}

          {/* Payment History */}
          {payments.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-text-main dark:text-white px-1">결제 이력</h3>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-beige-main/10 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-text-main dark:text-white">
                        {p.currency === 'KRW' ? `${p.amount.toLocaleString()}원` : `$${(p.amount / 100).toFixed(2)}`}
                      </p>
                      <p className="text-[11px] text-text-sub">
                        {new Date(p.created_at).toLocaleDateString('ko-KR')} · {
                          p.type === 'ONE_TIME' ? '리포트' : p.type === 'SUBSCRIPTION' ? '구독' : '갱신'
                        }
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      p.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {p.status === 'PAID' ? '완료' : p.status === 'FAILED' ? '실패' : p.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
