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
    PortOne?: any;
    PaymentBridge?: { postMessage: (msg: string) => void };
    __iapLoadingDone?: () => void;
  }
}

type PayMethodOption = 'CARD' | 'TOSSPAY' | 'NAVERPAY';

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

function formatPrice(amount: number, curr: 'KRW' | 'USD'): string {
  if (curr === 'KRW') return `${amount.toLocaleString()}원`;
  return `$${(amount / 100).toFixed(2)}`;
}

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t, currency } = useLocale();
  const [loading, setLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethodOption>('CARD');
  const [existingSubscription, setExistingSubscription] = useState<any>(null);
  const [isFirstSubscription, setIsFirstSubscription] = useState(true);
  const [isApp, setIsApp] = useState(false);

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
      let billingKeyMethod: string;

      if (locale === 'ko') {
        if (payMethod === 'NAVERPAY') {
          channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVERPAY;
          billingKeyMethod = 'EASY_PAY';
        } else if (payMethod === 'TOSSPAY') {
          channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS;
          billingKeyMethod = 'EASY_PAY';
        } else {
          channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP;
          billingKeyMethod = 'CARD';
        }
      } else {
        channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_STRIPE;
        billingKeyMethod = 'CARD';
      }

      // 빌링키 발급
      const issueParams: Record<string, any> = {
        storeId,
        channelKey,
        billingKeyMethod,
        issueId: `issue_${user.id.substring(0, 8)}_${Date.now()}`,
        issueName: '기질아이 월 구독',
        customer: {
          customerId: user.id,
          ...(user.email ? { email: user.email } : {}),
        },
      };

      if (locale === 'ko') {
        if (payMethod === 'NAVERPAY') {
          issueParams.easyPay = { provider: 'NAVERPAY' };
        } else if (payMethod === 'TOSSPAY') {
          issueParams.easyPay = { provider: 'TOSSPAY' };
        }
      }

      const issueResult = await window.PortOne.requestIssueBillingKey(issueParams);

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

      router.replace('/');
    } catch (error: any) {
      console.error('Subscribe error:', error);
      alert(t('pricing.subscribeError', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const monthlyPrice = formatPrice(PRICES.MONTHLY[currency], currency);

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

        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-32 space-y-8">
          {/* Header */}
          <section className="text-center space-y-2">
            <h2 className="text-2xl font-bold break-keep">
              {t('pricing.headline')}
            </h2>
            <p className="text-text-sub text-sm">
              {t('pricing.subtitle')}
            </p>
          </section>

          {/* Plan Card — [연 구독] 재활성화 시: grid grid-cols-2 gap-3으로 변경, YEARLY 카드 추가 */}
          <section>
            <div className="p-6 rounded-2xl border-2 border-primary bg-primary/5 text-center relative">
              {isFirstSubscription && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                  {t('pricing.firstMonthOff')}
                </span>
              )}
              <p className="text-xs font-bold text-text-sub mb-2">
                {t('pricing.monthly')}
              </p>
              {isFirstSubscription ? (
                <>
                  <p className="text-3xl font-black text-text-main dark:text-white">
                    {formatPrice(FIRST_MONTH_PRICES[currency], currency)}
                  </p>
                  <p className="text-sm text-text-sub mt-1">
                    <span className="line-through">{monthlyPrice}</span>
                    {t('pricing.perFirstMonth')}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black text-text-main dark:text-white">
                    {monthlyPrice}
                  </p>
                  <p className="text-sm text-text-sub mt-1">
                    {t('pricing.perMonth')}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Benefits */}
          <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 space-y-4 border border-beige-main/20">
            <h3 className="text-sm font-bold text-text-main dark:text-white">
              {t('pricing.benefits')}
            </h3>
            {[
              { icon: 'analytics', key: 'pricing.unlimitedReports' },
              { icon: 'chat', key: 'pricing.unlimitedConsult' },
              { icon: 'task_alt', key: 'pricing.fullHistory' },
              { icon: 'speed', key: 'pricing.noCooldown' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name={item.icon} size="sm" className="text-primary text-[18px]" />
                </div>
                <span className="text-sm text-text-main dark:text-white">
                  {t(item.key)}
                </span>
              </div>
            ))}
          </section>

          {/* 결제수단 선택 (한국 웹만 — 앱에서는 Apple/Google이 처리) */}
          {locale === 'ko' && !isApp && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-text-main dark:text-white">{t('pricing.payMethod')}</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPayMethod('CARD')}
                  className={`p-3 rounded-2xl border-2 transition-all text-center ${
                    payMethod === 'CARD'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
                  }`}
                >
                  <Icon name="credit_card" size="sm" className={`text-2xl mb-1 ${payMethod === 'CARD' ? 'text-primary' : 'text-text-sub'}`} />
                  <p className={`text-sm font-bold ${payMethod === 'CARD' ? 'text-primary' : 'text-text-main dark:text-white'}`}>{t('pricing.card')}</p>
                  <p className="text-[11px] text-text-sub mt-0.5">NHN KCP</p>
                </button>
                <button
                  onClick={() => setPayMethod('TOSSPAY')}
                  className={`p-3 rounded-2xl border-2 transition-all text-center ${
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
                  className={`p-3 rounded-2xl border-2 transition-all text-center ${
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
            </section>
          )}

        </div>

        {/* CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30 max-w-md mx-auto w-full">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubscribe}
            disabled={loading || !user}
            className="h-16 rounded-2xl text-lg font-bold shadow-glow"
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
