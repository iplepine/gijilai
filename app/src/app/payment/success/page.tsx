'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setIsPaid } = useAppStore();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        const paymentId = searchParams.get('paymentId');

        if (paymentId) {
            // 포트원 리다이렉트 결제 완료 — 서버에서 검증
            fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId }),
            })
                .then(res => {
                    if (res.ok) {
                        setIsPaid(true);
                        setStatus('success');
                        setTimeout(() => router.push('/report'), 2000);
                    } else {
                        setStatus('error');
                    }
                })
                .catch(() => setStatus('error'));
        } else {
            setStatus('error');
        }
    }, [searchParams, setIsPaid, router]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
            {status === 'loading' && (
                <div className="space-y-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Icon name="sync" className="text-primary animate-spin" size="lg" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">결제 확인 중...</h2>
                    <p className="text-slate-500 text-sm">잠시만 기다려주세요.</p>
                </div>
            )}

            {status === 'success' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="relative w-32 h-32 mx-auto">
                        <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-25"></div>
                        <div className="relative w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-xl shadow-green-200">
                            <Icon name="check" className="text-white text-5xl" size="lg" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white">결제 완료!</h2>
                        <p className="text-slate-500 text-base leading-relaxed break-keep">
                            분석 결과 페이지로 이동합니다.
                        </p>
                    </div>
                    <Button variant="primary" size="lg" onClick={() => router.push('/report')} className="h-14 px-10 rounded-2xl font-bold">
                        분석 결과 보러가기
                    </Button>
                </div>
            )}

            {status === 'error' && (
                <div className="space-y-6">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <Icon name="error" className="text-red-500" size="lg" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">결제 오류</h2>
                    <p className="text-slate-500 text-sm">결제 처리 중 문제가 발생했습니다.</p>
                    <Button variant="secondary" onClick={() => router.replace('/payment')}>
                        결제 페이지로 돌아가기
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <div className="relative flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-900">
            <Navbar title="결제 완료" />
            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                </div>
            }>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
