'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';

declare global {
  interface Window {
    PortOne?: any;
  }
}

type LoadingStatus = 'idle' | 'paying' | 'analyzing' | 'complete';
type PayMethodOption = 'CARD' | 'TOSSPAY' | 'NAVERPAY';

const LOADING_MESSAGES = [
  { icon: 'analytics', text: '기질 데이터 분석 중' },
  { icon: 'auto_awesome', text: '기질아이 유형 세부 대응 중' },
  { icon: 'favorite', text: '양육자-자녀 궁합 계산 중' },
  { icon: 'lightbulb', text: '맞춤 양육 솔루션 생성 중' },
];

export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { intake } = useAppStore();
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [isApp, setIsApp] = useState(false);
  const [availableCoupon, setAvailableCoupon] = useState<any>(null);
  const [useCoupon, setUseCoupon] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethodOption>('CARD');

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
    const isFlutter = ua.includes('gijilai_app') || !!(window as any).PaymentBridge;
    setIsApp(isFlutter);

    // Flutter 결제 콜백
    (window as any).onPaymentComplete = (data: any) => {
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

    return () => { delete (window as any).onPaymentComplete; };
  }, []);

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
  }, [status, router]);

  const finalAmount = useCoupon && availableCoupon ? Math.max(0, 1980 - availableCoupon.discount_amount) : 1980;

  const handlePaymentStart = async () => {
    if (!user) return;

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
      if ((window as any).PaymentBridge) {
        (window as any).PaymentBridge.postMessage(JSON.stringify({
          type: 'PAYMENT_REQUEST',
          provider: 'APPLE_GOOGLE',
          amount: 1980,
          productName: '기질아이 프리미엄 리포트'
        }));
      } else {
        alert('앱 결제 브릿지를 찾을 수 없습니다.');
      }
      return;
    }

    // 포트원 V2 결제
    if (!window.PortOne) {
      alert('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
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
      } else {
        channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP;
      }

      const paymentParams: Record<string, any> = {
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
        channelKey,
        paymentId,
        orderName: '기질아이 프리미엄 리포트',
        totalAmount: finalAmount,
        currency: 'KRW',
        payMethod: payMethod === 'CARD' ? 'CARD' : 'EASY_PAY',
      };

      if (payMethod === 'NAVERPAY') {
        paymentParams.easyPay = { provider: 'NAVERPAY' };
      } else if (payMethod === 'TOSSPAY') {
        paymentParams.easyPay = { provider: 'TOSSPAY' };
      }

      const result = await window.PortOne.requestPayment(paymentParams);

      if (result.code) {
        throw new Error(result.message || '결제 실패');
      }

      // 서버에서 결제 검증
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || '결제 검증 실패');
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
    } catch (error: any) {
      console.error('Payment error:', error);
      setStatus('idle');
      if (error.message !== 'User cancelled') {
        alert(`결제에 실패하였습니다: ${error.message}`);
      }
    }
  };

  const handlePaymentSuccess = () => {
    setStatus('analyzing');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full app-shell-width bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        {status === 'analyzing' ? (
          <div className="flex-1 flex flex-col">
            <Navbar title="분석 중" />
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
            <Navbar title="분석 및 결제" showBack />

            <div className="flex-1 overflow-y-auto px-6 pt-10 pb-10 space-y-10 w-full">
              {/* Header */}
              <section className="text-center space-y-3">
                <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-widest">
                  Limited Offer
                </div>
                <h2 className="text-2xl font-bold text-text-main dark:text-white break-keep">
                  우리 아이를 위한<br />단 한 방울의 이해
                </h2>
                <p className="text-text-sub text-sm">1,980원으로 발견하는 육아의 마법</p>
              </section>

              {/* Benefits */}
              <section className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden shadow-card border border-beige-main/20">
                <div className="p-8 space-y-6">
                  <div className="space-y-5">
                    {[
                      { emoji: '💡', title: '아이 신호 통역하기', desc: '아이 행동의 진짜 원인을 기질 관점에서 명쾌하게 풀어드려요.' },
                      { emoji: '✨', title: '마법의 한마디', desc: '당장 오늘 저녁부터 써먹을 수 있는 맞춤형 대화 가이드.' },
                      { emoji: '🖼️', title: '맞춤형 기질 일러스트', desc: '내 기질과 아이 기질이 어우러진 배경화면용 카드 증정.' },
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
                      <p className="text-[11px] font-bold text-white/40 line-through">정가 4,900원</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black">{finalAmount.toLocaleString()}</span>
                        <span className="text-lg font-bold">원</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-primary px-3 py-1 rounded-full text-[10px] font-black uppercase mb-1">
                        80% Discount
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
                        <p className="text-sm font-bold text-text-main dark:text-white">할인 쿠폰 적용</p>
                        <p className="text-[11px] text-text-sub">추천 보상 {availableCoupon.discount_amount}원 할인</p>
                      </div>
                    </div>
                    <span className="text-primary font-black text-lg">-{availableCoupon.discount_amount}원</span>
                  </div>
                )}

                {/* 결제수단 선택 */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-text-sub">결제수단 선택</p>
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
                      <p className={`text-sm font-bold ${payMethod === 'CARD' ? 'text-primary' : 'text-text-main dark:text-white'}`}>카드</p>
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
                      <p className="text-[11px] text-text-sub mt-0.5">간편결제</p>
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
                      <p className="text-[11px] text-text-sub mt-0.5">간편결제</p>
                    </button>
                  </div>
                </div>

                {/* Subscription upsell */}
                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
                  <p className="text-xs font-bold text-primary mb-1">더 많은 혜택이 필요하신가요?</p>
                  <p className="text-[11px] text-text-sub mb-3">구독하면 리포트 무제한 + AI 상담 무제한</p>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="text-xs font-bold text-primary underline underline-offset-2"
                  >
                    구독 플랜 보기 →
                  </button>
                </div>

                <p className="text-[11px] text-text-sub text-center flex items-center justify-center gap-1.5 px-4 break-keep pt-4">
                  <Icon name="verified" size="sm" className="text-primary/40" />
                  결제 즉시 분석 리포트와 마음 처방전이 생성됩니다.
                </p>
              </section>
            </div>

            {/* CTA */}
            {status === 'idle' && (
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30">
                <Button variant="primary" size="lg" fullWidth onClick={handlePaymentStart} className="h-16 rounded-2xl text-lg font-bold shadow-glow">
                  {finalAmount === 0
                    ? '쿠폰으로 무료 이용하기'
                    : isApp
                      ? '결제하고 처방전 받기'
                      : `${finalAmount.toLocaleString()}원 결제하고 처방전 받기`
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
