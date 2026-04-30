'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, PaymentData, SubscriptionData } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';
import { getApiErrorMessage, readJsonResponse } from '@/lib/api';

type PaymentMethodMetadata = {
  paymentMethod?: {
    type?: string;
    provider?: string;
    easyPayMethodType?: string;
    card?: {
      name?: string;
      issuer?: string;
      publisher?: string;
      number?: string;
    };
  } | null;
  selectedPayMethod?: string | null;
  platform?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readPaymentMetadata(payment: PaymentData): PaymentMethodMetadata {
  return isRecord(payment.metadata) ? payment.metadata as PaymentMethodMetadata : {};
}

function safeMaskedCardNumber(value?: string): string | null {
  if (!value) return null;
  if (value.includes('*')) return value;
  return value.replace(/\d(?=\d{4})/g, '*');
}

function formatCodeLabel(value?: string): string | null {
  if (!value) return null;
  if (value === 'TOSSPAY') return 'TossPay';
  if (value === 'NAVERPAY') return 'Naver Pay';
  if (value === 'KCP_CARD' || value === 'INICIS_CARD') return null;
  return value
    .replace(/^PaymentMethod/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPaymentMethodLabel(payment: PaymentData, t: (key: string) => string): string | null {
  const metadata = readPaymentMetadata(payment);
  const method = metadata.paymentMethod;
  const selectedPayMethod = metadata.selectedPayMethod ?? payment.pay_method;

  if (method?.type === 'CARD' || payment.pay_method === 'CARD' || selectedPayMethod?.includes('CARD')) {
    const card = method?.card;
    const cardName = card?.name || formatCodeLabel(card?.issuer) || formatCodeLabel(card?.publisher);
    const cardNumber = safeMaskedCardNumber(card?.number);
    return [t('settings.paymentMethodCard'), cardName, cardNumber].filter(Boolean).join(' · ');
  }

  if (method?.type === 'EASY_PAY' || payment.pay_method === 'EASY_PAY') {
    const provider = formatCodeLabel(method?.provider ?? selectedPayMethod ?? undefined);
    return [provider, t('settings.paymentMethodEasyPay')].filter(Boolean).join(' · ');
  }

  if (selectedPayMethod === 'applepay' || metadata.platform === 'APPLE_IAP') {
    return t('settings.paymentMethodAppStore');
  }

  if (selectedPayMethod === 'googlepay' || metadata.platform === 'GOOGLE_PLAY') {
    return t('settings.paymentMethodGooglePlay');
  }

  return formatCodeLabel(payment.pay_method ?? undefined);
}

type FeedbackDialogState = {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

type SubscriptionResponse = {
  subscription?: SubscriptionData | null;
};

export default function SubscriptionPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState<FeedbackDialogState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : t('settings.cancelError');
  const formatLocalDate = (value: string) => new Date(value).toLocaleDateString('ko-KR');

  const loadSubscriptionData = useCallback(async () => {
    if (!user) return;

    setLoadError(null);

    const [subscriptionResponse, paymentData] = await Promise.all([
      fetch('/api/payment/subscription', { cache: 'no-store' }),
      db.getPaymentHistory(user.id),
    ]);

    const subData = await readJsonResponse<SubscriptionResponse>(subscriptionResponse);
    if (!subscriptionResponse.ok) {
      throw new Error(getApiErrorMessage(subData, t('settings.cancelError')));
    }

    setSubscription(subData?.subscription ?? null);
    setPayments(paymentData);
  }, [user]);

  const getStoreManagementUrl = (source?: string | null): string | undefined => {
    if (source === 'APPLE_IAP') {
      return 'https://apps.apple.com/account/subscriptions';
    }

    if (source === 'GOOGLE_PLAY') {
      return 'https://play.google.com/store/account/subscriptions';
    }

    return undefined;
  };

  const openStoreManagementPage = (source?: string | null) => {
    const url = getStoreManagementUrl(source);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openStoreManagementDialog = (source?: string | null) => {
    setFeedbackDialog({
      title: t('settings.storeManagedTitle'),
      message: source === 'APPLE_IAP'
        ? t('settings.cancelAppStoreDescription')
        : t('settings.cancelGooglePlayDescription'),
      actionLabel: t('settings.openStoreSubscriptions'),
      actionHref: getStoreManagementUrl(source),
    });
  };

  useEffect(() => {
    if (!user) return;
    loadSubscriptionData()
      .catch((error) => {
        console.error(error);
        setLoadError(getErrorMessage(error));
      })
      .finally(() => setLoading(false));
  }, [loadSubscriptionData, user]);

  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadSubscriptionData().catch((error) => {
          console.error(error);
          setLoadError(getErrorMessage(error));
        });
      }
    };

    const handleWindowFocus = () => {
      void loadSubscriptionData().catch((error) => {
        console.error(error);
        setLoadError(getErrorMessage(error));
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loadSubscriptionData, user]);

  const handleCancelClick = () => {
    if (!subscription) return;

    if (subscription.source !== 'PORTONE') {
      openStoreManagementDialog(subscription.source);
      return;
    }

    setIsCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    setIsCancelDialogOpen(false);

    setCancelling(true);
    try {
      const res = await fetch('/api/payment/cancel-subscription', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSubscription((prev) => prev ? { ...prev, cancelled_at: new Date().toISOString() } : null);
        setFeedbackDialog({
          title: t('settings.cancelSubscription'),
          message: t('settings.cancelSuccess').replace('{date}', formatLocalDate(data.activeUntil)),
        });
      } else {
        if (data.error === 'STORE_MANAGED_SUBSCRIPTION') {
          openStoreManagementDialog(data.source);
        } else {
          setFeedbackDialog({
            title: t('common.error'),
            message: data.error || t('settings.cancelError'),
          });
        }
      }
    } catch (error) {
      setFeedbackDialog({
        title: t('common.error'),
        message: getErrorMessage(error),
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      const res = await fetch('/api/payment/reactivate-subscription', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSubscription(data.subscription);
        setFeedbackDialog({
          title: t('settings.reactivateSubscription'),
          message: t('settings.reactivateSuccess'),
        });
      } else {
        setFeedbackDialog({
          title: t('common.error'),
          message: data.error || t('settings.reactivateError'),
        });
      }
    } catch {
      setFeedbackDialog({
        title: t('common.error'),
        message: t('settings.reactivateError'),
      });
    } finally {
      setReactivating(false);
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

  if (loadError) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center">
        <div className="w-full max-w-md min-h-screen flex flex-col">
          <Navbar title={t('settings.subscription')} showBack />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
            <Icon name="error" className="text-red-500 text-5xl" size="lg" />
            <h2 className="text-xl font-bold text-text-main dark:text-white">{t('common.error')}</h2>
            <p className="text-sm text-text-sub leading-relaxed">{loadError}</p>
            <Button variant="primary" onClick={() => {
              setLoading(true);
              void loadSubscriptionData()
                .catch((error) => {
                  console.error(error);
                  setLoadError(getErrorMessage(error));
                })
                .finally(() => setLoading(false));
            }}>
              {t('common.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const planLabel = subscription?.plan === 'MONTHLY' ? t('pricing.monthly') : '';
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR') : '';
  const isCancelled = !!subscription?.cancelled_at;
  const latestPaidPayment = payments.find((payment) => payment.status === 'PAID');
  const latestPaymentMethod = latestPaidPayment ? getPaymentMethodLabel(latestPaidPayment, t) : null;

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
        <Navbar title={t('settings.subscription')} showBack />

        <div className="app-page-scroll flex-1 overflow-y-auto px-6 pt-8 pb-10 space-y-6">
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
                  {latestPaymentMethod && (
                    <div className="flex justify-between gap-4">
                      <span className="text-text-sub">{t('settings.paymentMethod')}</span>
                      <span className="font-bold text-right">{latestPaymentMethod}</span>
                    </div>
                  )}
                </div>

                {isCancelled ? (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                      {t('settings.cancelledNotice').replace('{date}', periodEnd)}
                    </p>
                    {subscription.source === 'PORTONE' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={handleReactivate}
                        disabled={reactivating}
                        className="mt-2"
                      >
                        {reactivating ? t('pricing.processing') : t('settings.reactivateSubscription')}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          onClick={() => openStoreManagementPage(subscription.source)}
                          className="mt-2"
                        >
                          {t('settings.reactivateStoreSubscription')}
                        </Button>
                        <p className="text-xs text-text-sub bg-beige-main/20 p-3 rounded-xl">
                          {t('settings.reactivateStoreNotice')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={handleCancelClick}
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
                {payments.map((p) => {
                  const paymentMethod = getPaymentMethodLabel(p, t);
                  return (
                    <div key={p.id} className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-beige-main/10 flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-main dark:text-white">
                          {p.currency === 'KRW' ? `${p.amount.toLocaleString()}원` : `$${(p.amount / 100).toFixed(2)}`}
                        </p>
                        <p className="text-[11px] text-text-sub">
                          {new Date(p.created_at).toLocaleDateString('ko-KR')} · {
                            p.type === 'ONE_TIME' ? t('settings.paymentReport') : p.type === 'SUBSCRIPTION' ? t('settings.paymentSubscription') : t('settings.paymentRenewal')
                          }
                        </p>
                        {paymentMethod && (
                          <p className="mt-1 truncate text-[11px] font-medium text-text-sub">
                            {paymentMethod}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        p.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {p.status === 'PAID' ? t('settings.paymentComplete') : p.status === 'FAILED' ? t('settings.paymentFailed') : p.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {isCancelDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 sm:items-center sm:pb-0">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-surface-dark">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-text-main dark:text-white">
                  {t('settings.cancelSubscription')}
                </h2>
                <p className="text-[13px] leading-relaxed whitespace-pre-line text-text-sub">
                  {t('settings.cancelConfirm')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelDialogOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-text-sub transition hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                aria-label={t('common.close')}
              >
                <Icon name="close" size="sm" className="text-xl" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setIsCancelDialogOpen(false)}
                className="h-12 rounded-xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={confirmCancel}
                disabled={cancelling}
                className="h-12 rounded-xl"
              >
                {cancelling ? t('pricing.processing') : t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {feedbackDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 sm:items-center sm:pb-0">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-surface-dark">
            <div className="mb-5 space-y-1">
              <h2 className="text-lg font-bold text-text-main dark:text-white">
                {feedbackDialog.title}
              </h2>
              <p className="text-[13px] leading-relaxed whitespace-pre-line text-text-sub">
                {feedbackDialog.message}
              </p>
            </div>

            <div className={`grid gap-2 ${feedbackDialog.actionHref ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <Button
                type="button"
                variant={feedbackDialog.actionHref ? 'secondary' : 'primary'}
                size="md"
                onClick={() => setFeedbackDialog(null)}
                className="h-12 rounded-xl"
              >
                {feedbackDialog.actionHref ? t('common.cancel') : t('common.confirm')}
              </Button>
              {feedbackDialog.actionHref && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    window.open(feedbackDialog.actionHref, '_blank', 'noopener,noreferrer');
                    setFeedbackDialog(null);
                  }}
                  className="h-12 rounded-xl"
                >
                  {feedbackDialog.actionLabel || t('common.confirm')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
