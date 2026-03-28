'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/components/auth/AuthProvider';


declare global {
  interface Window {
    PortOne?: any;
  }
}

type Locale = 'ko' | 'en';
type Plan = 'MONTHLY' | 'YEARLY';

const PRICES = {
  MONTHLY: { KRW: 12000, USD: 1199 },
  YEARLY: { KRW: 89000, USD: 8999 },
};

function formatPrice(amount: number, locale: Locale): string {
  if (locale === 'ko') return `${amount.toLocaleString()}원`;
  return `$${(amount / 100).toFixed(2)}`;
}

function getMonthlyEquivalent(plan: Plan, locale: Locale): string {
  if (plan === 'MONTHLY') return '';
  const yearly = locale === 'ko' ? PRICES.YEARLY.KRW : PRICES.YEARLY.USD;
  const monthly = Math.round(yearly / 12);
  return formatPrice(monthly, locale);
}

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('MONTHLY');
  const [locale, setLocale] = useState<Locale>('ko');
  const [loading, setLoading] = useState(false);
  const [existingSubscription, setExistingSubscription] = useState<any>(null);

  useEffect(() => {
    // locale 감지
    const saved = document.cookie.match(/gijilai_locale=(\w+)/)?.[1];
    if (saved === 'en' || saved === 'ko') {
      setLocale(saved as Locale);
    } else {
      const browserLang = navigator.language.toLowerCase();
      setLocale(browserLang.startsWith('ko') ? 'ko' : 'en');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/payment/subscription')
      .then(res => res.json())
      .then(data => {
        if (data.subscription) setExistingSubscription(data.subscription);
      })
      .catch(() => {});
  }, [user]);

  const handleSubscribe = async () => {
    if (!user || !window.PortOne) return;
    setLoading(true);

    try {
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = locale === 'ko'
        ? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS
        : process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_STRIPE;

      // 빌링키 발급
      const issueResult = await window.PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
        billingKeyMethod: 'CARD',
        issueId: `issue_${user.id.substring(0, 8)}_${Date.now()}`,
        issueName: selectedPlan === 'MONTHLY' ? '기질아이 월 구독' : '기질아이 연 구독',
        customer: {
          customerId: user.id,
          email: user.email,
        },
      });

      if (issueResult.code) {
        throw new Error(issueResult.message || '빌링키 발급 실패');
      }

      // 서버에서 구독 생성 + 첫 결제
      const response = await fetch('/api/payment/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingKey: issueResult.billingKey,
          plan: selectedPlan,
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
      alert(locale === 'ko'
        ? `구독 처리 중 오류가 발생했습니다: ${error.message}`
        : `Subscription error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const currency = locale === 'ko' ? 'KRW' : 'USD';
  const monthlyPrice = formatPrice(PRICES.MONTHLY[currency], locale);
  const yearlyPrice = formatPrice(PRICES.YEARLY[currency], locale);
  const yearlyMonthly = getMonthlyEquivalent('YEARLY', locale);

  if (existingSubscription) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
        <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
          <Navbar title={locale === 'ko' ? '요금제' : 'Pricing'} showBack />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
            <Icon name="check_circle" className="text-primary text-5xl" size="lg" />
            <h2 className="text-2xl font-bold">
              {locale === 'ko' ? '이미 구독 중입니다' : 'Already Subscribed'}
            </h2>
            <p className="text-text-sub text-sm">
              {locale === 'ko'
                ? `${existingSubscription.plan === 'MONTHLY' ? '월' : '연'} 구독 이용 중`
                : `${existingSubscription.plan === 'MONTHLY' ? 'Monthly' : 'Yearly'} plan active`}
            </p>
            <Button variant="secondary" onClick={() => router.replace('/settings/subscription')}>
              {locale === 'ko' ? '구독 관리' : 'Manage Subscription'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md min-h-screen flex flex-col shadow-2xl">
        <Navbar title={locale === 'ko' ? '요금제' : 'Pricing'} showBack />

        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-32 space-y-8">
          {/* Header */}
          <section className="text-center space-y-2">
            <h2 className="text-2xl font-bold break-keep">
              {locale === 'ko'
                ? '우리 아이를 더 깊이 이해하는 시간'
                : 'Understand Your Child Deeply'}
            </h2>
            <p className="text-text-sub text-sm">
              {locale === 'ko'
                ? '프리미엄 구독으로 모든 기능을 무제한 이용하세요'
                : 'Unlock all features with a premium subscription'}
            </p>
          </section>

          {/* Plan Cards */}
          <section className="grid grid-cols-2 gap-3">
            {/* Monthly */}
            <button
              onClick={() => setSelectedPlan('MONTHLY')}
              className={`p-5 rounded-2xl border-2 transition-all text-left ${
                selectedPlan === 'MONTHLY'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
              }`}
            >
              <p className="text-xs font-bold text-text-sub mb-2">
                {locale === 'ko' ? '월 구독' : 'Monthly'}
              </p>
              <p className="text-xl font-black text-text-main dark:text-white">
                {monthlyPrice}
              </p>
              <p className="text-[11px] text-text-sub mt-1">
                {locale === 'ko' ? '/월' : '/month'}
              </p>
            </button>

            {/* Yearly */}
            <button
              onClick={() => setSelectedPlan('YEARLY')}
              className={`p-5 rounded-2xl border-2 transition-all text-left relative ${
                selectedPlan === 'YEARLY'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
              }`}
            >
              <span className="absolute -top-2 right-3 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                38% OFF
              </span>
              <p className="text-xs font-bold text-text-sub mb-2">
                {locale === 'ko' ? '연 구독' : 'Yearly'}
              </p>
              <p className="text-xl font-black text-text-main dark:text-white">
                {yearlyPrice}
              </p>
              <p className="text-[11px] text-text-sub mt-1">
                {locale === 'ko' ? `/년 (${yearlyMonthly}/월)` : `/year (${yearlyMonthly}/mo)`}
              </p>
            </button>
          </section>

          {/* Benefits */}
          <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 space-y-4 border border-beige-main/20">
            <h3 className="text-sm font-bold text-text-main dark:text-white">
              {locale === 'ko' ? '구독 혜택' : 'What you get'}
            </h3>
            {[
              { icon: 'analytics', ko: '프리미엄 리포트 무제한', en: 'Unlimited premium reports' },
              { icon: 'chat', ko: 'AI 상담 무제한', en: 'Unlimited AI consultations' },
              { icon: 'task_alt', ko: '실천 기록 전체 이력', en: 'Full practice history' },
              { icon: 'speed', ko: '재검사 쿨다운 없음', en: 'No reassessment cooldown' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name={item.icon} size="sm" className="text-primary text-[18px]" />
                </div>
                <span className="text-sm text-text-main dark:text-white">
                  {locale === 'ko' ? item.ko : item.en}
                </span>
              </div>
            ))}
          </section>

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
                <span>{locale === 'ko' ? '처리 중...' : 'Processing...'}</span>
              </div>
            ) : (
              locale === 'ko'
                ? `${formatPrice(selectedPlan === 'MONTHLY' ? PRICES.MONTHLY.KRW : PRICES.YEARLY.KRW, 'ko')} 구독 시작하기`
                : `Start for ${formatPrice(selectedPlan === 'MONTHLY' ? PRICES.MONTHLY.USD : PRICES.YEARLY.USD, 'en')}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
