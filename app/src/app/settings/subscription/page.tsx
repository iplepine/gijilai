'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, PaymentData } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';


export default function SubscriptionPage() {
  const { t } = useLocale();
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
    if (!confirm(t('settings.cancelConfirm'))) return;

    setCancelling(true);
    try {
      const res = await fetch('/api/payment/cancel-subscription', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSubscription((prev: any) => prev ? { ...prev, cancelled_at: new Date().toISOString() } : null);
        alert(t('settings.cancelSuccess').replace('{date}', new Date(data.activeUntil).toLocaleDateString('ko-KR')));
      } else {
        alert(data.error || t('settings.cancelError'));
      }
    } catch (e: any) {
      alert(t('settings.cancelError'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center">
        <div className="w-full max-w-md min-h-screen flex flex-col">
          <Navbar title={t('settings.subscription')} showBack />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const planLabel = subscription?.plan === 'MONTHLY' ? t('pricing.monthly') : '';
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR') : '';
  const isCancelled = !!subscription?.cancelled_at;

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
        <Navbar title={t('settings.subscription')} showBack />

        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-10 space-y-6">
          {subscription ? (
            <>
              {/* Current Plan */}
              <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-beige-main/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-text-sub">{t('settings.currentPlan')}</p>
                    <p className="text-lg font-black text-text-main dark:text-white">{planLabel}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                    isCancelled
                      ? 'bg-amber-100 text-amber-700'
                      : subscription.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {isCancelled ? t('settings.cancelScheduled') : subscription.status === 'ACTIVE' ? t('settings.active') : subscription.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-sub">{isCancelled ? t('settings.availableUntil') : t('settings.nextPaymentDate')}</span>
                    <span className="font-bold">{periodEnd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-sub">{t('settings.paymentAmount')}</span>
                    <span className="font-bold">
                      {subscription.currency === 'KRW'
                        ? `${subscription.amount.toLocaleString()}원`
                        : `$${(subscription.amount / 100).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {isCancelled ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                    {t('settings.cancelledNotice').replace('{date}', periodEnd)}
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
                    {cancelling ? t('pricing.processing') : t('settings.cancelSubscription')}
                  </Button>
                )}
              </section>
            </>
          ) : (
            <section className="text-center space-y-4 py-12">
              <Icon name="credit_card_off" className="text-text-sub/30 text-5xl" size="lg" />
              <p className="text-text-sub text-sm">{t('settings.noSubscription')}</p>
              <Button variant="primary" onClick={() => router.push('/pricing')}>
                {t('settings.startSubscription')}
              </Button>
            </section>
          )}

          {/* Payment History */}
          {payments.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-text-main dark:text-white px-1">{t('settings.paymentHistory')}</h3>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-beige-main/10 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-text-main dark:text-white">
                        {p.currency === 'KRW' ? `${p.amount.toLocaleString()}원` : `$${(p.amount / 100).toFixed(2)}`}
                      </p>
                      <p className="text-[11px] text-text-sub">
                        {new Date(p.created_at).toLocaleDateString('ko-KR')} · {
                          p.type === 'ONE_TIME' ? t('settings.paymentReport') : p.type === 'SUBSCRIPTION' ? t('settings.paymentSubscription') : t('settings.paymentRenewal')
                        }
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      p.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {p.status === 'PAID' ? t('settings.paymentComplete') : p.status === 'FAILED' ? t('settings.paymentFailed') : p.status}
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
