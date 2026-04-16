'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLocale } from '@/i18n/LocaleProvider';


declare global {
  interface Window {
    PortOne?: {
      requestPayment?: (params: Record<string, unknown>) => Promise<PortOnePaymentResult>;
      requestIssueBillingKey?: (params: PortOneIssueBillingKeyParams) => Promise<PortOnePaymentResult>;
    };
    PaymentBridge?: { postMessage: (msg: string) => void };
    __iapLoadingDone?: () => void;
  }
}

type PayMethodOption = 'KCP_CARD' | 'INICIS_CARD' | 'TOSSPAY' | 'NAVERPAY';

const PRICES = {
  MONTHLY: { KRW: 12000, USD: 1199 },
  // [연 구독] 신뢰 확보 후 재활성화 예정 — 환불 산식/갱신 알림 구현 필요
  // YEARLY: { KRW: 89000, USD: 8999 },
};

const FIRST_MONTH_DISCOUNT = 0.3;
const FIRST_MONTH_PRICES = {
  KRW: Math.round(PRICES.MONTHLY.KRW * (1 - FIRST_MONTH_DISCOUNT)),
  USD: Math.round(PRICES.MONTHLY.USD * (1 - FIRST_MONTH_DISCOUNT)),
};

type ExistingSubscriptionSummary = {
  id: string;
  source: 'PORTONE' | 'APPLE_IAP' | 'GOOGLE_PLAY';
  cancelled_at: string | null;
  current_period_end: string;
} | null;

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

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t, currency } = useLocale();
  const [loading, setLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethodOption>('KCP_CARD');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [existingSubscription, setExistingSubscription] = useState<ExistingSubscriptionSummary>(null);
  const [isFirstSubscription, setIsFirstSubscription] = useState(true);
  const [isApp, setIsApp] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : t('common.error');

  useEffect(() => {
    // 앱 감지
    const ua = navigator.userAgent.toLowerCase();
    const inApp = ua.includes('gijilai_app') || !!window.PaymentBridge;
    setIsApp(inApp);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/payment/subscription')
      .then(res => res.json())
      .then(data => {
        if (data.subscription) setExistingSubscription(data.subscription);
        if (data.isFirstSubscription !== undefined) setIsFirstSubscription(data.isFirstSubscription);
      })
      .catch(() => {});
  }, [user]);

  // 앱 IAP: Flutter가 결과를 네이티브 SnackBar로 처리, 웹은 loading 해제만 담당
  useEffect(() => {
    if (!isApp) return;
    window.__iapLoadingDone = () => setLoading(false);
    return () => { window.__iapLoadingDone = undefined; };
  }, [isApp]);

  const handleSubscribe = async () => {
    if (!user) return;

    // 앱 → IAP (Apple/Google이 결제수단 처리)
    if (isApp) {
      if (!window.PaymentBridge) return;
      setLoading(true);
      window.PaymentBridge.postMessage(JSON.stringify({
        type: 'PAYMENT_REQUEST',
        provider: 'APPLE_GOOGLE',
        productId: 'monthly_premium',
      }));
      return;
    }

    // 웹 → PortOne
    if (!window.PortOne) return;
    setLoading(true);

    try {
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;

      let channelKey: string | undefined;
      let billingKeyMethod: PortOneIssueBillingKeyParams['billingKeyMethod'];

      if (locale === 'ko') {
        if (payMethod === 'NAVERPAY') {
          channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVERPAY;
          billingKeyMethod = 'EASY_PAY';
        } else if (payMethod === 'TOSSPAY') {
          channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS;
          billingKeyMethod = 'EASY_PAY';
        } else if (payMethod === 'INICIS_CARD') {
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

      const buyerPhoneDigits = normalizePhoneNumber(buyerPhone);
      if (locale === 'ko' && payMethod === 'INICIS_CARD' && buyerPhoneDigits.length < 10) {
        alert(t('pricing.buyerPhoneRequired'));
        return;
      }

      // 빌링키 발급
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
          ...(locale === 'ko' && payMethod === 'INICIS_CARD'
            ? { phoneNumber: formatPhoneNumber(buyerPhoneDigits) }
            : {}),
        },
      };

      if (locale === 'ko') {
        if (payMethod === 'NAVERPAY') {
          issueParams.easyPay = { provider: 'NAVERPAY' };
        } else if (payMethod === 'TOSSPAY') {
          issueParams.easyPay = { provider: 'TOSSPAY' };
        }
      }

      const issueResult = await window.PortOne.requestIssueBillingKey?.(issueParams);

      if (!issueResult) {
        throw new Error('빌링키 발급 실패');
      }

      if (issueResult.code) {
        if (issueResult.code === 'PAY_PROCESS_CANCELED') return;
        throw new Error(issueResult.message || '빌링키 발급 실패');
      }

      // 서버에서 구독 생성 + 첫 결제
      const response = await fetch('/api/payment/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingKey: issueResult.billingKey,
          plan: 'MONTHLY',
          locale,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '구독 생성 실패');
      }

      router.refresh();
      router.replace('/settings/subscription');
    } catch (error) {
      console.error('Subscribe error:', error);
      alert(t('pricing.subscribeError', { message: getErrorMessage(error) }));
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      const response = await fetch('/api/payment/reactivate-subscription', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t('settings.reactivateError'));
      }
      setExistingSubscription(data.subscription);
      router.refresh();
      router.replace('/settings/subscription');
    } catch (error) {
      alert(t('settings.reactivateError'));
      console.error('Reactivate subscription error:', error);
    } finally {
      setReactivating(false);
    }
  };

  const monthlyPrice = formatPrice(PRICES.MONTHLY[currency], currency);

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
              <p className="text-xs text-text-sub bg-white dark:bg-surface-dark rounded-xl p-3">
                {t('settings.reactivateStoreNotice')}
              </p>
            )}
            <Button variant="secondary" onClick={() => router.replace('/settings/subscription')}>
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
            <Button variant="secondary" onClick={() => router.replace('/settings/subscription')}>
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

        <div className="flex-1 overflow-y-auto px-5 pt-7 pb-32 space-y-6">
          {/* Header */}
          <section className="text-center space-y-2">
            <h2 className="text-[19px] leading-[1.35] font-bold break-keep px-3">
              {t('pricing.headline')}
            </h2>
            <p className="text-text-sub text-[13px] leading-relaxed px-2">
              {t('pricing.subtitle')}
            </p>
          </section>

          {/* Plan Card — [연 구독] 재활성화 시: grid grid-cols-2 gap-3으로 변경, YEARLY 카드 추가 */}
          <section>
            <div className="px-5 py-6 rounded-[28px] border-[1.5px] border-primary bg-primary/5 text-center relative">
              {isFirstSubscription && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-3.5 py-1 rounded-full whitespace-nowrap">
                  {t('pricing.firstMonthOff')}
                </span>
              )}
              <p className="text-[11px] font-bold text-text-sub mb-2">
                {t('pricing.monthly')}
              </p>
              {isFirstSubscription ? (
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
            {[
              { icon: 'analytics', key: 'pricing.unlimitedReports' },
              { icon: 'chat', key: 'pricing.unlimitedConsult' },
              { icon: 'task_alt', key: 'pricing.fullHistory' },
              { icon: 'speed', key: 'pricing.noCooldown' },
            ].map((item, i) => (
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

          {/* 결제수단 선택 (한국 웹만 — 앱에서는 Apple/Google이 처리) */}
          {locale === 'ko' && !isApp && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-bold text-text-main dark:text-white">{t('pricing.payMethod')}</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPayMethod('KCP_CARD')}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    payMethod === 'KCP_CARD'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
                  }`}
                >
                  <Icon name="credit_card" size="sm" className={`text-2xl mb-1 ${payMethod === 'KCP_CARD' ? 'text-primary' : 'text-text-sub'}`} />
                  <p className={`text-sm font-bold ${payMethod === 'KCP_CARD' ? 'text-primary' : 'text-text-main dark:text-white'}`}>{t('pricing.card')}</p>
                  <p className="text-[11px] text-text-sub mt-0.5">NHN KCP</p>
                </button>
                <button
                  onClick={() => setPayMethod('INICIS_CARD')}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    payMethod === 'INICIS_CARD'
                      ? 'border-[#E84B3C] bg-[#E84B3C]/5'
                      : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
                  }`}
                >
                  <Icon name="credit_card" size="sm" className={`text-2xl mb-1 ${payMethod === 'INICIS_CARD' ? 'text-[#E84B3C]' : 'text-text-sub'}`} />
                  <p className={`text-sm font-bold ${payMethod === 'INICIS_CARD' ? 'text-[#E84B3C]' : 'text-text-main dark:text-white'}`}>{t('pricing.card')}</p>
                  <p className="text-[11px] text-text-sub mt-0.5">KG Inicis</p>
                </button>
                <button
                  onClick={() => setPayMethod('TOSSPAY')}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    payMethod === 'TOSSPAY'
                      ? 'border-[#0064FF] bg-[#0064FF]/5'
                      : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
                  }`}
                >
                  <span className={`text-2xl mb-1 inline-block font-black ${payMethod === 'TOSSPAY' ? 'text-[#0064FF]' : 'text-text-sub'}`}>T</span>
                  <p className={`text-sm font-bold ${payMethod === 'TOSSPAY' ? 'text-[#0064FF]' : 'text-text-main dark:text-white'}`}>토스페이</p>
                  <p className="text-[11px] text-text-sub mt-0.5">{t('pricing.easyPay')}</p>
                </button>
                <button
                  onClick={() => setPayMethod('NAVERPAY')}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    payMethod === 'NAVERPAY'
                      ? 'border-[#03C75A] bg-[#03C75A]/5'
                      : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
                  }`}
                >
                  <span className={`text-2xl mb-1 inline-block font-black ${payMethod === 'NAVERPAY' ? 'text-[#03C75A]' : 'text-text-sub'}`}>N</span>
                  <p className={`text-sm font-bold ${payMethod === 'NAVERPAY' ? 'text-[#03C75A]' : 'text-text-main dark:text-white'}`}>네이버페이</p>
                  <p className="text-[11px] text-text-sub mt-0.5">{t('pricing.easyPay')}</p>
                </button>
              </div>
              {payMethod === 'INICIS_CARD' && (
                <div className="space-y-2 rounded-2xl border border-[#E84B3C]/20 bg-[#E84B3C]/5 p-4">
                  <label htmlFor="buyer-phone" className="block text-[13px] font-bold text-text-main dark:text-white">
                    {t('pricing.buyerPhone')}
                  </label>
                  <input
                    id="buyer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={buyerPhone}
                    onChange={(event) => setBuyerPhone(formatPhoneNumber(event.target.value))}
                    placeholder={t('pricing.buyerPhonePlaceholder')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold text-text-main outline-none transition focus:border-[#E84B3C] dark:border-gray-700 dark:bg-surface-dark dark:text-white"
                  />
                  <p className="text-[12px] leading-relaxed text-text-sub">
                    {t('pricing.buyerPhoneHelp')}
                  </p>
                </div>
              )}
            </section>
          )}

        </div>

        {/* CTA */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pt-4 pb-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30 max-w-md mx-auto w-full">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubscribe}
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
                  isFirstSubscription ? FIRST_MONTH_PRICES[currency] : PRICES.MONTHLY[currency],
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
