'use client';

import { Suspense, useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent, trackPurchase } from '@/lib/analytics';
import { getApiErrorMessage, readJsonResponse } from '@/lib/api';
import { buildInstallPageUrl, isAppWebView } from '@/lib/install';


declare global {
  interface Window {
    PortOne?: {
      requestPayment?: (params: Record<string, unknown>) => Promise<PortOnePaymentResult>;
      requestIssueBillingKey?: (params: PortOneIssueBillingKeyParams) => Promise<PortOnePaymentResult>;
    };
    PaymentBridge?: { postMessage: (msg: string) => void };
    __iapLoadingDone?: () => void;
    __iapPaymentCompleted?: (payload?: IapPaymentCompletedPayload) => void;
  }
}

type PayMethodOption = 'KCP_CARD' | 'INICIS_CARD';
type IapPaymentCompletedPayload = { shouldNavigate?: boolean };

const PRICES = {
  MONTHLY: { KRW: 12000, USD: 999 },
  // 연 구독: 정가 144,000원 대비 20% off → 115,200원.
  // 백엔드(subscribe/billing/webhook + portone.PRICE_TABLE)는 활성화됨.
  // UI 토글은 약관/환불 SOP 변호사 검토 + App Store/Play 상품 등록 완료 후 노출.
  YEARLY: { KRW: 115200, USD: 9599 },
};

const FIRST_MONTH_DISCOUNT = 0.3;
const FIRST_MONTH_PRICES = {
  KRW: Math.round(PRICES.MONTHLY.KRW * (1 - FIRST_MONTH_DISCOUNT)),
  USD: Math.round(PRICES.MONTHLY.USD * (1 - FIRST_MONTH_DISCOUNT)),
};

type SubscriptionSource = 'PORTONE' | 'APPLE_IAP' | 'GOOGLE_PLAY';

type ExistingSubscriptionSummary = {
  id: string;
  source: SubscriptionSource;
  cancelled_at: string | null;
  current_period_end: string;
} | null;

type SubscriptionBootstrapResponse = {
  subscription?: ExistingSubscriptionSummary;
  isFirstSubscription?: boolean;
};

function isSubscriptionSummary(value: unknown): value is Exclude<ExistingSubscriptionSummary, null> {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && (candidate.source === 'PORTONE' || candidate.source === 'APPLE_IAP' || candidate.source === 'GOOGLE_PLAY')
    && (candidate.cancelled_at === null || typeof candidate.cancelled_at === 'string')
	    && typeof candidate.current_period_end === 'string';
}

function getExistingSubscriptionStatus(subscription: ExistingSubscriptionSummary) {
  if (!subscription) return 'none';
  return subscription.cancelled_at ? 'cancel_scheduled' : 'active';
}

function formatPrice(amount: number, curr: 'KRW' | 'USD'): string {
  if (curr === 'KRW') return `${amount.toLocaleString()}원`;
  return `$${(amount / 100).toFixed(2)}`;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

function formatPhoneNumber(value: string): string {
  const digits = normalizePhoneNumber(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function getCustomerName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const fullName = user.user_metadata?.full_name;
  const displayName = user.user_metadata?.name;
  const name =
    (typeof fullName === 'string' && fullName) ||
    (typeof displayName === 'string' && displayName) ||
    user.email?.split('@')[0];
  return (name || 'GIJILAI User').slice(0, 30);
}

function getStoreManagementUrl(source?: SubscriptionSource): string | undefined {
  if (source === 'APPLE_IAP') {
    return 'https://apps.apple.com/account/subscriptions';
  }

  if (source === 'GOOGLE_PLAY') {
    return 'https://play.google.com/store/account/subscriptions';
  }

  return undefined;
}

function isPaymentCancelled(code?: string, message?: string) {
  const value = `${code ?? ''} ${message ?? ''}`.toLowerCase();
  return value.includes('cancel');
}

function getAppIapProductId(): string {
  if (typeof window === 'undefined') return 'monthly_premium';

  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua)
    ? 'gijilai_premium_montly'
    : 'monthly_premium';
}

function buildIapCompletePath(params: {
  source: string;
  entryCta?: string;
  reportTab?: string | null;
  reportKind?: string | null;
  usedCoupon: boolean;
  finalAmount: number;
}) {
  const search = new URLSearchParams({
    iap: 'true',
    payMethod: 'APPLE_GOOGLE',
    source: params.source,
    used_coupon: String(params.usedCoupon),
    final_amount: String(params.finalAmount),
  });

  if (params.entryCta) search.set('entry_cta', params.entryCta);
  if (params.reportTab) search.set('report_tab', params.reportTab);
  if (params.reportKind) search.set('report_kind', params.reportKind);

  return `/pricing/complete?${search.toString()}`;
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { locale, t, currency } = useLocale();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerPhoneError, setBuyerPhoneError] = useState('');
  const [isBuyerPhoneDialogOpen, setIsBuyerPhoneDialogOpen] = useState(false);
  const [existingSubscription, setExistingSubscription] = useState<ExistingSubscriptionSummary>(null);
  const [isFirstSubscription, setIsFirstSubscription] = useState(true);
  const [isApp, setIsApp] = useState(false);
  const [isEnvironmentReady, setIsEnvironmentReady] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [subscriptionLookupError, setSubscriptionLookupError] = useState('');
  const trackedPricingViewRef = useRef(false);
  const payMethod: PayMethodOption = 'INICIS_CARD';
  const entrySource = searchParams.get('source') ?? 'direct';
  const entryCta = searchParams.get('entry_cta') ?? undefined;
  const reportTab = searchParams.get('report_tab');
  const reportKind = searchParams.get('report_kind');

  const getErrorMessage = useCallback((error: unknown) => (
    error instanceof Error ? error.message : t('common.error')
  ), [t]);
  const hasFirstMonthDiscount = isFirstSubscription;
  const currentPrice = hasFirstMonthDiscount ? FIRST_MONTH_PRICES[currency] : PRICES.MONTHLY[currency];

  useEffect(() => {
    const inApp = isAppWebView();
    setIsApp(inApp);
    setIsEnvironmentReady(true);

    if (!inApp) {
      router.replace(buildInstallPageUrl({
        source: entrySource,
        entry_cta: entryCta,
        from: 'pricing',
        report_tab: reportTab ?? undefined,
        report_kind: reportKind ?? undefined,
      }));
    }
  }, [entryCta, entrySource, reportKind, reportTab, router]);

  useEffect(() => {
    if (!isEnvironmentReady || trackedPricingViewRef.current) return;

    trackEvent('pricing_viewed', {
      source: entrySource,
      entry_cta: entryCta,
      is_app: isApp,
      report_tab: reportTab ?? undefined,
      report_kind: reportKind ?? undefined,
    });
    trackedPricingViewRef.current = true;
  }, [entryCta, entrySource, isApp, isEnvironmentReady, reportKind, reportTab]);

  useEffect(() => {
    if (!user || !isEnvironmentReady || !isApp) return;
    let cancelled = false;

    void (async () => {
      try {
        setSubscriptionLookupError('');
        const response = await fetch('/api/payment/subscription');
        const data = await readJsonResponse<SubscriptionBootstrapResponse>(response);

        if (!response.ok) {
          throw new Error(getApiErrorMessage(data, t('common.error')));
        }

        if (cancelled) return;

        setExistingSubscription(isSubscriptionSummary(data?.subscription) ? data.subscription : null);
        setIsFirstSubscription(typeof data?.isFirstSubscription === 'boolean' ? data.isFirstSubscription : true);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load subscription state:', error);
        setSubscriptionLookupError(getErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getErrorMessage, isApp, isEnvironmentReady, t, user]);

  // 앱 IAP: Flutter가 검증을 완료하면 웹은 완료 플로우로 라우팅한다.
  useEffect(() => {
    if (!isApp) return;
    window.__iapLoadingDone = () => setLoading(false);
    window.__iapPaymentCompleted = (payload) => {
      setLoading(false);
      if (payload?.shouldNavigate === false) return;
      router.refresh();
      router.replace(buildIapCompletePath({
        source: entrySource,
        entryCta,
        reportTab,
        reportKind,
        usedCoupon: hasFirstMonthDiscount,
        finalAmount: currentPrice,
      }));
    };
    return () => {
      window.__iapLoadingDone = undefined;
      window.__iapPaymentCompleted = undefined;
    };
  }, [currentPrice, entryCta, entrySource, hasFirstMonthDiscount, isApp, reportKind, reportTab, router]);

  if (!isEnvironmentReady || !isApp) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-text-sub">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const handleSubscribe = async (phoneOverride?: string) => {
    if (!user) return;

    // 앱 → IAP (Apple/Google이 결제수단 처리)
    if (isApp) {
      if (!window.PaymentBridge) {
        trackEvent('payment_failed', {
          source: entrySource,
          entry_cta: entryCta,
          pay_method: 'APPLE_GOOGLE',
          stage: 'iap_bridge',
          reason: 'bridge_unavailable',
          report_tab: reportTab ?? undefined,
          report_kind: reportKind ?? undefined,
        });
        return;
      }
      trackEvent('payment_started', {
        source: entrySource,
        entry_cta: entryCta,
        pay_method: 'APPLE_GOOGLE',
        used_coupon: hasFirstMonthDiscount,
        final_amount: currentPrice,
        report_tab: reportTab ?? undefined,
        report_kind: reportKind ?? undefined,
      });
      setLoading(true);
      window.PaymentBridge.postMessage(JSON.stringify({
        type: 'PAYMENT_REQUEST',
        provider: 'APPLE_GOOGLE',
        productId: getAppIapProductId(),
      }));
      return;
    }

    // 웹 → PortOne
    if (!window.PortOne) {
      trackEvent('payment_failed', {
        source: entrySource,
        entry_cta: entryCta,
        pay_method: payMethod,
        stage: 'payment_module',
        reason: 'module_unavailable',
        report_tab: reportTab ?? undefined,
        report_kind: reportKind ?? undefined,
      });
      return;
    }
    const requiresBuyerPhone = locale === 'ko' && payMethod === 'INICIS_CARD';
    const buyerPhoneDigits = normalizePhoneNumber(phoneOverride ?? buyerPhone);

    if (requiresBuyerPhone && buyerPhoneDigits.length < 10) {
      setBuyerPhoneError('');
      setIsBuyerPhoneDialogOpen(true);
      return;
    }

    trackEvent('payment_started', {
      source: entrySource,
      entry_cta: entryCta,
      pay_method: payMethod,
      used_coupon: isFirstSubscription,
      final_amount: currentPrice,
      report_tab: reportTab ?? undefined,
      report_kind: reportKind ?? undefined,
    });
    setLoading(true);
    let paymentStage = 'billing_key';

    try {
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;

      let channelKey: string | undefined;
      let billingKeyMethod: PortOneIssueBillingKeyParams['billingKeyMethod'];

      if (locale === 'ko') {
        if (payMethod === 'INICIS_CARD') {
          channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_INICIS;
          billingKeyMethod = 'CARD';
        } else {
          channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP;
          billingKeyMethod = 'CARD';
        }
      } else {
        channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_STRIPE;
        billingKeyMethod = 'CARD';
      }

      // 빌링키 발급
      const redirectUrl = new URL('/pricing/complete', window.location.origin);
      redirectUrl.searchParams.set('locale', locale);
      redirectUrl.searchParams.set('payMethod', payMethod);
      redirectUrl.searchParams.set('source', entrySource);
      if (entryCta) redirectUrl.searchParams.set('entry_cta', entryCta);
      if (reportTab) redirectUrl.searchParams.set('report_tab', reportTab);
      if (reportKind) redirectUrl.searchParams.set('report_kind', reportKind);
      redirectUrl.searchParams.set('used_coupon', String(isFirstSubscription));
      redirectUrl.searchParams.set('final_amount', String(currentPrice));

      const issueParams: PortOneIssueBillingKeyParams = {
        storeId,
        channelKey,
        billingKeyMethod,
        issueId: `issue_${user.id.substring(0, 8)}_${Date.now()}`,
        issueName: '기질아이 월 구독',
        customer: {
          customerId: user.id,
          fullName: getCustomerName(user),
          ...(user.email ? { email: user.email } : {}),
          ...(requiresBuyerPhone
            ? { phoneNumber: formatPhoneNumber(buyerPhoneDigits) }
            : {}),
        },
        redirectUrl: redirectUrl.toString(),
        windowType: {
          mobile: 'REDIRECTION',
        },
        locale: locale === 'ko' ? 'KO_KR' : 'EN_US',
        offerPeriod: {
          interval: '1m',
        },
      };

      const issueResult = await window.PortOne.requestIssueBillingKey?.(issueParams);

      if (!issueResult) {
        throw new Error('빌링키 발급 실패');
      }

      if (issueResult.code) {
        if (isPaymentCancelled(issueResult.code, issueResult.message)) {
          trackEvent('payment_cancelled', {
            source: entrySource,
            entry_cta: entryCta,
            pay_method: payMethod,
            stage: paymentStage,
            used_coupon: isFirstSubscription,
            final_amount: currentPrice,
            report_tab: reportTab ?? undefined,
            report_kind: reportKind ?? undefined,
          });
          return;
        }
        throw new Error(issueResult.message || '빌링키 발급 실패');
      }

      // 서버에서 구독 생성 + 첫 결제
      paymentStage = 'subscription_create';
      const response = await fetch('/api/payment/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingKey: issueResult.billingKey,
          plan: 'MONTHLY',
          locale,
          payMethod,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '구독 생성 실패');
      }

      trackEvent('payment_completed', {
        source: entrySource,
        entry_cta: entryCta,
        pay_method: payMethod,
        used_coupon: isFirstSubscription,
        final_amount: currentPrice,
        report_tab: reportTab ?? undefined,
        report_kind: reportKind ?? undefined,
      });
      // GA4 표준 매출 이벤트 — 총수익 집계용 (USD 단가는 센트라 달러로 환산).
      trackPurchase({
        value: currency === 'USD' ? currentPrice / 100 : currentPrice,
        currency,
        source: entrySource,
        pay_method: payMethod,
      });

      router.refresh();
      router.replace('/settings/subscription');
    } catch (error) {
      console.error('Subscribe error:', error);
      trackEvent('payment_failed', {
        source: entrySource,
        entry_cta: entryCta,
        pay_method: payMethod,
        stage: paymentStage,
        reason: 'payment_error',
        used_coupon: isFirstSubscription,
        final_amount: currentPrice,
        report_tab: reportTab ?? undefined,
        report_kind: reportKind ?? undefined,
      });
      toast.error(t('pricing.subscribeError', { message: getErrorMessage(error) }));
    } finally {
      setLoading(false);
    }
  };

  const handleBuyerPhoneSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const buyerPhoneDigits = normalizePhoneNumber(buyerPhone);
    if (buyerPhoneDigits.length < 10) {
      setBuyerPhoneError(t('pricing.buyerPhoneInvalid'));
      return;
    }

    const formattedPhone = formatPhoneNumber(buyerPhoneDigits);
    setBuyerPhone(formattedPhone);
    setBuyerPhoneError('');
    setIsBuyerPhoneDialogOpen(false);
    void handleSubscribe(formattedPhone);
  };

  const handleReactivate = async () => {
    setReactivating(true);
    trackEvent('subscription_action_requested', {
      action: 'reactivate_subscription',
      source: entrySource,
      entry_cta: entryCta,
      subscription_source: existingSubscription?.source ?? 'unknown',
      subscription_status: getExistingSubscriptionStatus(existingSubscription),
    });
    try {
      const response = await fetch('/api/payment/reactivate-subscription', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t('settings.reactivateError'));
      }
      setExistingSubscription(data.subscription);
      trackEvent('subscription_action_completed', {
        action: 'reactivate_subscription',
        source: entrySource,
        entry_cta: entryCta,
        subscription_source: existingSubscription?.source ?? 'unknown',
      });
      router.refresh();
      router.replace('/settings/subscription');
    } catch (error) {
      trackEvent('subscription_action_failed', {
        action: 'reactivate_subscription',
        source: entrySource,
        entry_cta: entryCta,
        subscription_source: existingSubscription?.source ?? 'unknown',
        reason: 'server_error',
      });
      toast.error(t('settings.reactivateError'));
      console.error('Reactivate subscription error:', error);
    } finally {
      setReactivating(false);
    }
  };

  const handleOpenStoreSubscriptions = () => {
    const url = getStoreManagementUrl(existingSubscription?.source);
    if (!url) return;
    trackEvent('subscription_action_clicked', {
      action: 'store_manage',
      source: entrySource,
      entry_cta: entryCta,
      subscription_source: existingSubscription?.source ?? 'unknown',
      subscription_status: getExistingSubscriptionStatus(existingSubscription),
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const monthlyPrice = formatPrice(PRICES.MONTHLY[currency], currency);
  const premiumBenefits = [
    { icon: 'description', key: 'pricing.reportConnection' },
    { icon: 'chat', key: 'pricing.followUpConsult' },
    { icon: 'history', key: 'pricing.fullHistory' },
    { icon: 'sync' as const, key: 'pricing.nextConsultContext' },
  ] as const;
  const coachingLoop = [
    { step: '01', titleKey: 'pricing.loopStep1Title', descKey: 'pricing.loopStep1Desc' },
    { step: '02', titleKey: 'pricing.loopStep2Title', descKey: 'pricing.loopStep2Desc' },
    { step: '03', titleKey: 'pricing.loopStep3Title', descKey: 'pricing.loopStep3Desc' },
  ] as const;

  if (existingSubscription?.cancelled_at) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
        <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
          <Navbar title={t('pricing.title')} showBack />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
            <Icon name="event_busy" className="text-amber-500 text-5xl" size="lg" />
            <h2 className="text-2xl font-bold">
              {t('settings.cancelScheduled')}
            </h2>
            <p className="text-text-sub text-sm leading-relaxed">
              {t('settings.cancelledNotice').replace(
                '{date}',
                new Date(existingSubscription.current_period_end).toLocaleDateString('ko-KR')
              )}
            </p>
            {existingSubscription.source === 'PORTONE' ? (
              <Button variant="primary" onClick={handleReactivate} disabled={reactivating}>
                {reactivating ? t('pricing.processing') : t('settings.reactivateSubscription')}
              </Button>
            ) : (
              <div className="w-full max-w-xs space-y-2">
                <Button variant="primary" fullWidth onClick={handleOpenStoreSubscriptions}>
                  {t('settings.reactivateStoreSubscription')}
                </Button>
                <p className="text-xs text-text-sub bg-white dark:bg-surface-dark rounded-xl p-3">
                  {t('settings.reactivateStoreNotice')}
                </p>
              </div>
            )}
            <Button variant="secondary" onClick={() => {
              trackEvent('subscription_action_clicked', {
                action: 'manage_subscription',
                source: entrySource,
                entry_cta: entryCta,
                subscription_source: existingSubscription.source ?? 'unknown',
                subscription_status: getExistingSubscriptionStatus(existingSubscription),
              });
              router.replace('/settings/subscription');
            }}>
              {t('pricing.manageSubscription')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (existingSubscription) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
        <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
          <Navbar title={t('pricing.title')} showBack />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
            <Icon name="check_circle" className="text-primary text-5xl" size="lg" />
            <h2 className="text-2xl font-bold">
              {t('pricing.alreadySubscribed')}
            </h2>
            <p className="text-text-sub text-sm">
              {t('pricing.monthlyActive')}
            </p>
            <Button variant="secondary" onClick={() => {
              trackEvent('subscription_action_clicked', {
                action: 'manage_subscription',
                source: entrySource,
                entry_cta: entryCta,
                subscription_source: existingSubscription.source ?? 'unknown',
                subscription_status: getExistingSubscriptionStatus(existingSubscription),
              });
              router.replace('/settings/subscription');
            }}>
              {t('pricing.manageSubscription')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
        <Navbar title={t('pricing.title')} showBack />

        <div className="app-fixed-cta-scroll flex-1 overflow-y-auto px-5 pt-7 space-y-6">
          {subscriptionLookupError && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
              <p className="text-sm font-semibold text-amber-900">{t('common.error')}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                {subscriptionLookupError}
              </p>
            </section>
          )}
          {/* Header */}
          <section className="text-center space-y-2">
            <h2 className="text-[19px] leading-[1.35] font-bold break-keep px-3">
              {t('pricing.headline')}
            </h2>
            <p className="text-text-sub text-[13px] leading-relaxed px-2">
              {t('pricing.subtitle')}
            </p>
            <p className="text-primary text-[13px] font-bold leading-relaxed px-4 pt-2 whitespace-pre-line">
              {t('catchphrase.main')}
            </p>
          </section>

          {/* Plan Card — [연 구독] 재활성화 시: grid grid-cols-2 gap-3으로 변경, YEARLY 카드 추가 */}
          <section>
            <div className="px-5 py-6 rounded-[28px] border-[1.5px] border-primary bg-primary/5 text-center relative">
              {hasFirstMonthDiscount && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-3.5 py-1 rounded-full whitespace-nowrap">
                  {t('pricing.firstMonthOff')}
                </span>
              )}
              <p className="text-[11px] font-bold text-text-sub mb-2">
                {t('pricing.monthly')}
              </p>
              {hasFirstMonthDiscount ? (
                <>
                  <p className="text-[34px] leading-none font-black tracking-[-0.03em] text-text-main dark:text-white">
                    {formatPrice(FIRST_MONTH_PRICES[currency], currency)}
                  </p>
                  <p className="text-[13px] text-text-sub mt-2">
                    <span className="line-through">{monthlyPrice}</span>
                    {t('pricing.perFirstMonth')}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[34px] leading-none font-black tracking-[-0.03em] text-text-main dark:text-white">
                    {monthlyPrice}
                  </p>
                  <p className="text-[13px] text-text-sub mt-2">
                    {t('pricing.perMonth')}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Benefits */}
          <section className="bg-white dark:bg-surface-dark rounded-[28px] px-5 py-6 space-y-3.5 border border-beige-main/20">
            <h3 className="text-[13px] font-bold text-text-main dark:text-white">
              {t('pricing.benefits')}
            </h3>
            {premiumBenefits.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                  <Icon name={item.icon} size="sm" className="text-primary text-[18px]" />
                </div>
                <span className="text-[13px] font-medium text-text-main dark:text-white leading-snug">
                  {t(item.key)}
                </span>
              </div>
            ))}
          </section>

          <section className="rounded-[28px] bg-primary px-5 py-6 text-white shadow-card relative overflow-hidden">
            <div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-white/10 blur-3xl -mr-10 -mt-12 pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                  {t('pricing.loopEyebrow')}
                </p>
                <h3 className="text-[18px] font-black leading-tight break-keep">
                  {t('pricing.loopTitle')}
                </h3>
                <p className="text-[13px] leading-relaxed text-white/85 break-keep">
                  {t('pricing.loopDesc')}
                </p>
              </div>

              <div className="space-y-3">
                {coachingLoop.map((item) => (
                  <div key={item.step} className="rounded-2xl bg-white/10 px-4 py-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 text-[12px] font-black">
                      {item.step}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[13px] font-black leading-snug">
                        {t(item.titleKey)}
                      </p>
                      <p className="text-[12px] leading-relaxed text-white/80 break-keep">
                        {t(item.descKey)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-beige-main/30 bg-white px-4 py-4 text-center text-[11px] leading-relaxed text-text-sub dark:border-gray-800 dark:bg-surface-dark">
            <p>{t('pricing.subscriptionDisclosure')}</p>
            <div className="mt-2 flex items-center justify-center gap-3 font-bold text-primary">
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                className="underline underline-offset-2"
              >
                {t('pricing.termsLink')}
              </a>
              <a href="/legal/privacy" className="underline underline-offset-2">
                {t('pricing.privacyLink')}
              </a>
            </div>
          </section>

        </div>

        {isBuyerPhoneDialogOpen && (
          <div className="app-modal-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center">
            <form
              onSubmit={handleBuyerPhoneSubmit}
              className="app-modal-panel w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-surface-dark"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-text-main dark:text-white">
                    {t('pricing.buyerPhoneDialogTitle')}
                  </h2>
                  <p className="text-[13px] leading-relaxed text-text-sub">
                    {t('pricing.buyerPhoneDialogDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBuyerPhoneDialogOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-text-sub transition hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                  aria-label={t('common.close')}
                >
                  <Icon name="close" size="sm" className="text-xl" />
                </button>
              </div>

              <label htmlFor="buyer-phone-dialog" className="mb-2 block text-[13px] font-bold text-text-main dark:text-white">
                {t('pricing.buyerPhone')}
              </label>
              <input
                id="buyer-phone-dialog"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={buyerPhone}
                onChange={(event) => {
                  setBuyerPhone(formatPhoneNumber(event.target.value));
                  setBuyerPhoneError('');
                }}
                placeholder={t('pricing.buyerPhonePlaceholder')}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] font-semibold text-text-main outline-none transition focus:border-[#E84B3C] dark:border-gray-700 dark:bg-background-dark dark:text-white"
                autoFocus
              />
              <p className={`mt-2 min-h-5 text-[12px] leading-relaxed ${buyerPhoneError ? 'text-red-500' : 'text-text-sub'}`}>
                {buyerPhoneError || t('pricing.buyerPhoneHelp')}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsBuyerPhoneDialogOpen(false)}
                  className="h-12 rounded-xl"
                >
                  {t('pricing.buyerPhoneCancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="h-12 rounded-xl"
                >
                  {t('pricing.buyerPhoneContinue')}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* CTA */}
        <div className="app-fixed-cta absolute bottom-0 left-0 right-0 px-5 pt-4 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30 max-w-md mx-auto w-full">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              trackEvent('subscription_action_clicked', {
                action: 'start_subscription',
                source: entrySource,
                entry_cta: entryCta,
                subscription_source: 'none',
                subscription_status: 'none',
                placement: 'pricing_footer',
              });
              void handleSubscribe();
            }}
            disabled={loading || !user}
            className="h-14 rounded-xl text-[15px] font-bold shadow-glow"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>{t('pricing.processing')}</span>
              </div>
            ) : (
              t('pricing.subscribeWithPrice', {
                price: formatPrice(
                  hasFirstMonthDiscount ? FIRST_MONTH_PRICES[currency] : PRICES.MONTHLY[currency],
                  currency
                ),
              })
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
