'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/payment/CheckoutForm';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

type LoadingStatus = 'idle' | 'paying' | 'analyzing' | 'complete';

const LOADING_MESSAGES = [
  { icon: 'analytics', text: '기질 데이터 분석 중' },
  { icon: 'auto_awesome', text: '기질아이 유형 세부 대응 중' },
  { icon: 'favorite', text: '양육자-자녀 궁합 계산 중' },
  { icon: 'lightbulb', text: '맞춤 양육 솔루션 생성 중' },
];

export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { intake, setIsPaid } = useAppStore();
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isApp, setIsApp] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'naver' | 'kakao' | 'toss' | 'iap' | null>(null);
  const [availableCoupon, setAvailableCoupon] = useState<any>(null);
  const [useCoupon, setUseCoupon] = useState(false);

  useEffect(() => {
    // Detect if running inside Flutter WebView
    const ua = navigator.userAgent.toLowerCase();
    const isFlutter = ua.includes('gijilai_app') || !!(window as any).PaymentBridge;
    setIsApp(isFlutter);
    if (isFlutter) setSelectedMethod('iap');
    else setSelectedMethod('card');

    // Register callback for Flutter
    (window as any).onPaymentComplete = (data: any) => {
      if (data.status === 'success') {
        handlePaymentSuccess();
      }
    };

    // Load available coupons
    if (user) {
      db.getAvailableCoupons(user.id)
        .then(coupons => {
          if (coupons.length > 0) {
            setAvailableCoupon(coupons[0]);
          }
        })
        .catch(() => { /* Table may not exist yet */ });
    }

    // Load Portone SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.iamport.kr/v1/iamport.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      delete (window as any).onPaymentComplete;
      document.body.removeChild(script);
    };
  }, []);

  // Simulate loading messages
  useEffect(() => {
    if (status === 'analyzing') {
      const interval = setInterval(() => {
        setLoadingIndex((prev) => {
          if (prev >= LOADING_MESSAGES.length - 1) {
            clearInterval(interval);
            setTimeout(() => {
              setStatus('complete');
              router.replace('/report');
            }, 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [status, router]);

  const finalAmount = useCoupon && availableCoupon ? Math.max(0, 990 - availableCoupon.discount_amount) : 990;

  const handlePaymentStart = async () => {
    // If coupon covers full amount, skip payment
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

    if (isApp) {
      handleIAPRequest();
      return;
    }

    if (selectedMethod === 'card') {
      try {
        // 990원 결제 Intent 생성
        const response = await fetch('/api/payment/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 990 }),
        });

        const data = await response.json();
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setStatus('paying');
        } else {
          throw new Error(data.error || 'Failed to create payment intent');
        }
      } catch (error) {
        console.error('Payment initialization error:', error);
        alert('결제 준비 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } else {
      handleDomesticPaymentRequest();
    }
  };

  const handleIAPRequest = () => {
    if ((window as any).PaymentBridge) {
      (window as any).PaymentBridge.postMessage(JSON.stringify({
        type: 'PAYMENT_REQUEST',
        provider: 'APPLE_GOOGLE',
        amount: 990,
        productName: '기질아이 리포트 분석'
      }));
    } else {
      alert('앱 결제 브릿지를 찾을 수 없습니다.');
    }
  };

  const handleDomesticPaymentRequest = () => {
    const { IMP } = window as any;
    if (!IMP) {
      alert('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    IMP.init('imp00000000'); // TODO: 포트원 관리자 콘솔에서 발급받은 가맹점 식별코드

    const pgMap = {
      naver: 'naverpay',
      kakao: 'kakaopay',
      toss: 'tosspay'
    };

    IMP.request_pay({
      pg: pgMap[selectedMethod as keyof typeof pgMap],
      pay_method: 'card',
      merchant_uid: `mid_${new Date().getTime()}`,
      name: '기질아이 리포트 분석',
      amount: 990,
      buyer_email: '',
      buyer_name: intake.childName || '아이',
      m_redirect_url: `${window.location.origin}/payment/success`
    }, (rsp: any) => {
      if (rsp.success) {
        handlePaymentSuccess();
      } else {
        alert(`결제에 실패하였습니다. 에러 내용: ${rsp.error_msg}`);
      }
    });
  };

  const handlePaymentSuccess = () => {
    setIsPaid(true);
    setStatus('analyzing');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        {status === 'analyzing' ? (
          <div className="flex-1 flex flex-col">
            <Navbar title="분석 중" />

            <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
              {/* Animated Garden Scene */}
              <div className="relative w-48 h-48 mb-12">
                <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping duration-[3000ms]"></div>
                <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <Icon name={LOADING_MESSAGES[loadingIndex].icon} className="text-primary text-6xl animate-bounce-subtle" size="lg" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center animate-spin duration-[4000ms]">
                      <span className="text-[10px]">✨</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loading Text */}
              <div className="space-y-4 max-w-xs">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                  {LOADING_MESSAGES[loadingIndex].text}
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed break-keep">
                  {loadingIndex === 0 && "아이의 데이터를 꼼꼼하게 읽어보고 있어요."}
                  {loadingIndex === 1 && "아이의 기질 조합을 상세하게 분석합니다."}
                  {loadingIndex === 2 && "양육자와의 조화로운 교감을 위한 공식을 계산해요."}
                  {loadingIndex === 3 && "오늘 바로 실천할 수 있는 솔루션을 준비 중입니다."}
                </p>
              </div>

              {/* Progress Bar */}
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
            <Navbar title={status === 'paying' ? '결제하기' : '분석 및 결제'} showBack onBackClick={status === 'paying' ? () => setStatus('idle') : undefined} />

            <div className="flex-1 overflow-y-auto px-6 pt-10 pb-10 space-y-10 w-full">
              {status === 'paying' && clientSecret ? (
                <div className="space-y-8 animate-fade-in">
                  <section className="text-center space-y-3">
                    <h2 className="text-2xl font-bold text-text-main dark:text-white">카드 정보를 입력해주세요</h2>
                    <p className="text-text-sub text-sm">안전한 Stripe 결제 시스템을 사용합니다.</p>
                  </section>
                  <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-card border border-beige-main/20">
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                      <CheckoutForm amount={990} onSuccess={handlePaymentSuccess} />
                    </Elements>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header Section */}
                  <section className="text-center space-y-3">
                    <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-widest">
                      Limited Offer
                    </div>
                    <h2 className="text-2xl font-bold text-text-main dark:text-white break-keep">
                      우리 아이를 위한<br />단 한 방울의 이해
                    </h2>
                    <p className="text-text-sub text-sm">
                      990원으로 발견하는 육아의 마법
                    </p>
                  </section>

                  {/* Benefits Preview Card */}
                  <section className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden shadow-card border border-beige-main/20">
                    <div className="p-8 space-y-6">
                      <div className="space-y-5">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                            <span className="text-xl">💡</span>
                          </div>
                          <div>
                            <h4 className="text-[15px] font-bold text-text-main dark:text-white">아이 신호 통역하기</h4>
                            <p className="text-xs text-text-sub mt-1 leading-relaxed">아이 행동의 진짜 원인을 기질 관점에서 명쾌하게 풀어드려요.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                            <span className="text-xl">✨</span>
                          </div>
                          <div>
                            <h4 className="text-[15px] font-bold text-text-main dark:text-white">마법의 한마디</h4>
                            <p className="text-xs text-text-sub mt-1 leading-relaxed">당장 오늘 저녁부터 써먹을 수 있는 맞춤형 대화 가이드.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xl">🖼️</span>
                          </div>
                          <div>
                            <h4 className="text-[15px] font-bold text-text-main dark:text-white">맞춤형 기질 일러스트</h4>
                            <p className="text-xs text-text-sub mt-1 leading-relaxed">내 기질과 아이 기질이 어우러진 배경화면용 카드 증정.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Pricing Card */}
                  <section className="space-y-4">
                    <div className="bg-primary-dark rounded-2xl p-6 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-10 -mt-10 blur-2xl"></div>

                      <div className="relative z-10 flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-white/40 line-through">정가 4,900원</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black">990</span>
                            <span className="text-lg font-bold">원</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block bg-primary px-3 py-1 rounded-full text-[10px] font-black uppercase mb-1">
                            80% Discount
                          </span>
                          <p className="text-[10px] text-slate-400">커피 한 잔보다 가벼운 응원</p>
                        </div>
                      </div>
                    </div>

                    {/* Coupon */}
                    {availableCoupon && (
                      <div
                        onClick={() => setUseCoupon(!useCoupon)}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          useCoupon
                            ? 'border-primary bg-primary/5'
                            : 'border-dashed border-gray-200 bg-white dark:bg-surface-dark'
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

                    {/* Payment Method Selector */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-text-sub ml-1">결제 수단 선택 {isApp && '(In-App Purchase)'}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {isApp ? (
                          <button
                            onClick={() => setSelectedMethod('iap')}
                            className={`col-span-2 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedMethod === 'iap' ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}
                          >
                            <Icon name="phone_iphone" size="sm" className={selectedMethod === 'iap' ? 'text-primary' : 'text-gray-400'} />
                            <span className={`text-sm font-bold ${selectedMethod === 'iap' ? 'text-primary' : 'text-gray-600'}`}>애플/구글 스토어 결제</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setSelectedMethod('card')}
                              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedMethod === 'card' ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}
                            >
                              <Icon name="credit_card" size="sm" className={selectedMethod === 'card' ? 'text-primary' : 'text-gray-400'} />
                              <span className={`text-sm font-bold ${selectedMethod === 'card' ? 'text-primary' : 'text-gray-600'}`}>신용카드</span>
                            </button>
                            <button
                              onClick={() => setSelectedMethod('naver')}
                              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedMethod === 'naver' ? 'border-[#03C75A] bg-[#03C75A]/5' : 'border-gray-100 bg-white'}`}
                            >
                              <span className={`text-sm font-bold ${selectedMethod === 'naver' ? 'text-[#03C75A]' : 'text-gray-600'}`}>네이버페이</span>
                            </button>
                            <button
                              onClick={() => setSelectedMethod('kakao')}
                              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedMethod === 'kakao' ? 'border-[#FEE500] bg-[#FEE500]/5' : 'border-gray-100 bg-white'}`}
                            >
                              <span className={`text-sm font-bold ${selectedMethod === 'kakao' ? 'text-slate-700' : 'text-gray-600'}`}>카카오페이</span>
                            </button>
                            <button
                              onClick={() => setSelectedMethod('toss')}
                              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedMethod === 'toss' ? 'border-[#0064FF] bg-[#0064FF]/5' : 'border-gray-100 bg-white'}`}
                            >
                              <span className={`text-sm font-bold ${selectedMethod === 'toss' ? 'text-[#0064FF]' : 'text-gray-600'}`}>토스페이</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-text-sub text-center flex items-center justify-center gap-1.5 px-4 break-keep pt-4">
                      <Icon name="verified" size="sm" className="text-primary/40" />
                      결제 즉시 분석 리포트와 마음 처방전이 생성됩니다. 분석된 데이터는 전문가가 검증한 로직을 따릅니다.
                    </p>
                  </section>
                </>
              )}
            </div>

            {/* Payment Action */}
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
