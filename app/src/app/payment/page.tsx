'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';

declare global {
  interface PortOnePaymentResult {
    code?: string;
    message?: string;
    billingKey?: string;
  }

  interface PortOneIssueBillingKeyParams {
    storeId?: string;
    channelKey?: string;
    billingKeyMethod?: 'CARD' | 'EASY_PAY';
    issueId?: string;
    issueName?: string;
    customer?: {
      customerId: string;
      email?: string;
      fullName?: string;
      phoneNumber?: string;
    };
    easyPay?: { provider: 'NAVERPAY' | 'TOSSPAY' };
  }

  interface Window {
    PortOne?: {
      requestPayment?: (params: Record<string, unknown>) => Promise<PortOnePaymentResult>;
      requestIssueBillingKey?: (params: PortOneIssueBillingKeyParams) => Promise<PortOnePaymentResult>;
    };
    PaymentBridge?: {
      postMessage: (message: string) => void;
    };
    onPaymentComplete?: (data: { status?: string }) => void;
  }
}

type LoadingStatus = 'idle' | 'paying' | 'analyzing' | 'complete';
type PayMethodOption = 'KCP_CARD' | 'INICIS_CARD' | 'TOSSPAY' | 'NAVERPAY';
type Coupon = { id: string; discount_amount: number };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [isApp, setIsApp] = useState(false);
  const [availableCoupon, setAvailableCoupon] = useState<Coupon | null>(null);
  const [useCoupon, setUseCoupon] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethodOption>('KCP_CARD');

  const LOADING_MESSAGES = [
    { icon: 'analytics', text: t('payment.analyzingTempData') },
    { icon: 'auto_awesome', text: t('payment.analyzingSubtype') },
    { icon: 'favorite', text: t('payment.calculatingMatch') },
    { icon: 'lightbulb', text: t('payment.generatingSolution') },
  ];

  const finalAmount = useCoupon && availableCoupon ? Math.max(0, 1980 - availableCoupon.discount_amount) : 1980;

  const handlePaymentSuccess = useCallback(() => {
    trackEvent('payment_completed', {
      pay_method: payMethod,
      final_amount: finalAmount,
      used_coupon: useCoupon,
    });
    setStatus('analyzing');
  }, [finalAmount, payMethod, useCoupon]);

  useEffect(() => {
    // 글로벌 사용자는 구독 페이지로 리다이렉트
    const browserLang = navigator.language.toLowerCase();
    const savedLocale = document.cookie.match(/gijilai_locale=(\w+)/)?.[1];
    const locale = savedLocale || (browserLang.startsWith('ko') ? 'ko' : 'en');
    if (locale !== 'ko') {
      router.replace('/pricing');
      return;
    }

    // Flutter WebView 감지
    const ua = navigator.userAgent.toLowerCase();
    const isFlutter = ua.includes('gijilai_app') || !!window.PaymentBridge;
    setIsApp(isFlutter);

    // Flutter 결제 콜백
    window.onPaymentComplete = (data: { status?: string }) => {
      if (data.status === 'success') handlePaymentSuccess();
    };

    // 쿠폰 로드
    if (user) {
      db.getAvailableCoupons(user.id)
        .then(coupons => {
          if (coupons.length > 0) setAvailableCoupon(coupons[0]);
        })
        .catch(() => {});
    }

    return () => { delete window.onPaymentComplete; };
  }, [handlePaymentSuccess, router, t, user]);

  // 분석 로딩 애니메이션
  useEffect(() => {
    if (status === 'analyzing') {
      const interval = setInterval(() => {
        setLoadingIndex((prev) => {
          if (prev >= LOADING_MESSAGES.length - 1) {
            clearInterval(interval);
            setTimeout(() => {
              setStatus('complete');
              router.push('/report');
            }, 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [status, router, LOADING_MESSAGES.length]);

  const handlePaymentStart = async () => {
    if (!user) return;

    trackEvent('payment_started', {
      pay_method: payMethod,
      used_coupon: useCoupon,
      final_amount: finalAmount,
    });

    // 쿠폰으로 전액 할인
    if (useCoupon && availableCoupon && finalAmount === 0) {
      try {
        await db.useCoupon(availableCoupon.id);
        setAvailableCoupon(null);
      } catch (e) {
        console.warn('Coupon use failed:', e);
      }
      handlePaymentSuccess();
      return;
    }

    // Flutter IAP
    if (isApp) {
      if (window.PaymentBridge) {
        window.PaymentBridge.postMessage(JSON.stringify({
          type: 'PAYMENT_REQUEST',
          provider: 'APPLE_GOOGLE',
          amount: 1980,
          productName: t('payment.productName')
        }));
      } else {
        alert(t('payment.appBridgeNotFound'));
      }
      return;
    }

    // 포트원 V2 결제
    if (!window.PortOne) {
      alert(t('payment.payModuleLoading'));
      return;
    }

    setStatus('paying');

    try {
      const paymentId = `pay_${user.id.substring(0, 8)}_${Date.now()}`;
      let channelKey: string | undefined;
      if (payMethod === 'NAVERPAY') {
        channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVERPAY;
      } else if (payMethod === 'TOSSPAY') {
        channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS;
      } else if (payMethod === 'INICIS_CARD') {
        channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_INICIS;
      } else {
        channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP;
      }

      const paymentParams: Record<string, unknown> = {
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
        channelKey,
        paymentId,
        orderName: t('payment.productName'),
        totalAmount: finalAmount,
        currency: 'KRW',
        payMethod: payMethod === 'KCP_CARD' || payMethod === 'INICIS_CARD' ? 'CARD' : 'EASY_PAY',
      };

      if (payMethod === 'NAVERPAY') {
        paymentParams.easyPay = { provider: 'NAVERPAY' };
      } else if (payMethod === 'TOSSPAY') {
        paymentParams.easyPay = { provider: 'TOSSPAY' };
      }

      const result = await window.PortOne.requestPayment?.(paymentParams);

      if (!result) {
        throw new Error(t('payment.paymentFailed', { message: '' }));
      }

      if (result.code) {
        throw new Error(result.message || t('payment.paymentFailed', { message: '' }));
      }

      // 서버에서 결제 검증
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || t('payment.paymentFailed', { message: '' }));
      }

      // 쿠폰 사용 처리
      if (useCoupon && availableCoupon) {
        try {
          await db.useCoupon(availableCoupon.id);
        } catch (e) {
          console.warn('Coupon use failed:', e);
        }
      }

      handlePaymentSuccess();
    } catch (error: unknown) {
      console.error('Payment error:', error);
      setStatus('idle');
      const message = getErrorMessage(error, t('payment.paymentFailed', { message: '' }));
      if (message !== 'User cancelled') {
        alert(t('payment.paymentFailed', { message }));
      }
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        {status === 'analyzing' ? (
          <div className="flex-1 flex flex-col">
            <Navbar title={t('payment.analyzing')} />
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
              <div className="relative w-48 h-48 mb-12">
                <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping duration-[3000ms]"></div>
                <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <Icon name={LOADING_MESSAGES[loadingIndex].icon} className="text-primary text-6xl animate-bounce-subtle" size="lg" />
                  </div>
                </div>
              </div>
              <div className="space-y-4 max-w-xs">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                  {LOADING_MESSAGES[loadingIndex].text}
                </h2>
              </div>
              <div className="w-full max-w-[200px] h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${((loadingIndex + 1) / LOADING_MESSAGES.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col pb-32">
            <Navbar title={t('payment.analysisPayment')} showBack />

            <div className="flex-1 overflow-y-auto px-6 pt-10 pb-10 space-y-10 w-full">
              {/* Header */}
              <section className="text-center space-y-3">
                <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-widest">
                  {t('payment.limitedOffer')}
                </div>
                <h2 className="text-2xl font-bold text-text-main dark:text-white break-keep">
                  {t('payment.headline')}
                </h2>
                <p className="text-text-sub text-sm">{t('payment.subheadline')}</p>
              </section>

              {/* Benefits */}
              <section className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden shadow-card border border-beige-main/20">
                <div className="p-8 space-y-6">
                  <div className="space-y-5">
                    {[
                      { emoji: '\uD83D\uDCA1', title: t('payment.benefitSignal'), desc: t('payment.benefitSignalDesc') },
                      { emoji: '\u2728', title: t('payment.benefitMagic'), desc: t('payment.benefitMagicDesc') },
                      { emoji: '\uD83D\uDDBC\uFE0F', title: t('payment.benefitIllust'), desc: t('payment.benefitIllustDesc') },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xl">{item.emoji}</span>
                        </div>
                        <div>
                          <h4 className="text-[15px] font-bold text-text-main dark:text-white">{item.title}</h4>
                          <p className="text-xs text-text-sub mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Pricing */}
              <section className="space-y-4">
                <div className="bg-primary-dark rounded-2xl p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                  <div className="relative z-10 flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-white/40 line-through">{t('payment.originalPrice')}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black">{finalAmount.toLocaleString()}</span>
                        <span className="text-lg font-bold">{t('payment.currency')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-primary px-3 py-1 rounded-full text-[10px] font-black uppercase mb-1">
                        {t('payment.discount')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coupon */}
                {availableCoupon && (
                  <div
                    onClick={() => setUseCoupon(!useCoupon)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      useCoupon ? 'border-primary bg-primary/5' : 'border-dashed border-gray-200 bg-white dark:bg-surface-dark'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        useCoupon ? 'bg-primary border-primary text-white' : 'border-gray-300'
                      }`}>
                        {useCoupon && <Icon name="check" size="sm" className="text-[14px]" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-main dark:text-white">{t('payment.applyCoupon')}</p>
                        <p className="text-[11px] text-text-sub">{t('payment.referralReward', { amount: String(availableCoupon.discount_amount) })}</p>
                      </div>
                    </div>
                    <span className="text-primary font-black text-lg">-{availableCoupon.discount_amount}{t('payment.currency')}</span>
                  </div>
                )}

                {/* 결제수단 선택 */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-text-sub">{t('payment.selectPayMethod')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPayMethod('KCP_CARD')}
                      className={`p-3 rounded-2xl border-2 transition-all text-center ${
                        payMethod === 'KCP_CARD'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
                      }`}
                    >
                      <Icon name="credit_card" size="sm" className={`text-2xl mb-1 ${payMethod === 'KCP_CARD' ? 'text-primary' : 'text-text-sub'}`} />
                      <p className={`text-sm font-bold ${payMethod === 'KCP_CARD' ? 'text-primary' : 'text-text-main dark:text-white'}`}>{t('payment.cardLabel')}</p>
                      <p className="text-[11px] text-text-sub mt-0.5">NHN KCP</p>
                    </button>
                    <button
                      onClick={() => setPayMethod('INICIS_CARD')}
                      className={`p-3 rounded-2xl border-2 transition-all text-center ${
                        payMethod === 'INICIS_CARD'
                          ? 'border-[#E84B3C] bg-[#E84B3C]/5'
                          : 'border-gray-100 bg-white dark:bg-surface-dark dark:border-gray-700'
                      }`}
                    >
                      <Icon name="credit_card" size="sm" className={`text-2xl mb-1 ${payMethod === 'INICIS_CARD' ? 'text-[#E84B3C]' : 'text-text-sub'}`} />
                      <p className={`text-sm font-bold ${payMethod === 'INICIS_CARD' ? 'text-[#E84B3C]' : 'text-text-main dark:text-white'}`}>{t('payment.cardLabel')}</p>
                      <p className="text-[11px] text-text-sub mt-0.5">KG Inicis</p>
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
                      <p className={`text-sm font-bold ${payMethod === 'TOSSPAY' ? 'text-[#0064FF]' : 'text-text-main dark:text-white'}`}>{t('payment.tossPay')}</p>
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
                      <p className={`text-sm font-bold ${payMethod === 'NAVERPAY' ? 'text-[#03C75A]' : 'text-text-main dark:text-white'}`}>{t('payment.naverPay')}</p>
                      <p className="text-[11px] text-text-sub mt-0.5">{t('pricing.easyPay')}</p>
                    </button>
                  </div>
                </div>

                {/* Subscription upsell */}
                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
                  <p className="text-xs font-bold text-primary mb-1">{t('payment.moreBenefits')}</p>
                  <p className="text-[11px] text-text-sub mb-3">{t('payment.subscribeDesc')}</p>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="text-xs font-bold text-primary underline underline-offset-2"
                  >
                    {t('payment.viewPlans')}
                  </button>
                </div>

                <p className="text-[11px] text-text-sub text-center flex items-center justify-center gap-1.5 px-4 break-keep pt-4">
                  <Icon name="verified" size="sm" className="text-primary/40" />
                  {t('payment.paymentNotice')}
                </p>
              </section>
            </div>

            {/* CTA */}
            {status === 'idle' && (
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30">
                <Button variant="primary" size="lg" fullWidth onClick={handlePaymentStart} className="h-16 rounded-2xl text-lg font-bold shadow-glow">
                  {finalAmount === 0
                    ? t('payment.freeWithCoupon')
                    : isApp
                      ? t('payment.payAndGetReport')
                      : t('payment.payWithAmount', { amount: finalAmount.toLocaleString() })
                  }
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
