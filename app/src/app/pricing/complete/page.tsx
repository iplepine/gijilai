'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useLocale } from '@/i18n/LocaleProvider';
import { getApiErrorMessage, readJsonResponse } from '@/lib/api';

type CompleteStatus = 'loading' | 'success' | 'error';

function PricingCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<CompleteStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    async function completeSubscription() {
      const code = searchParams.get('code');
      const message = searchParams.get('message');
      const billingKey = searchParams.get('billingKey');
      const payMethod = searchParams.get('payMethod') || 'INICIS_CARD';
      const requestLocale = searchParams.get('locale') || locale;

      if (code) {
        setErrorMessage(message || code);
        setStatus('error');
        return;
      }

      if (!billingKey) {
        setErrorMessage('빌링키 발급 결과를 확인할 수 없습니다.');
        setStatus('error');
        return;
      }

      try {
        const response = await fetch('/api/payment/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billingKey,
            plan: 'MONTHLY',
            locale: requestLocale,
            payMethod,
          }),
        });
        const data = await readJsonResponse<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(data, '구독 생성 실패'));
        }
        setStatus('success');
        setTimeout(() => router.replace('/settings/subscription'), 1200);
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : t('pricing.subscribeError', { message: '' }));
        setStatus('error');
      }
    }

    void completeSubscription();
  }, [locale, router, searchParams, t]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
      {status === 'loading' && (
        <div className="space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Icon name="sync" className="text-primary animate-spin" size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('pricing.processing')}</h2>
          <p className="text-slate-500 text-sm">{t('payment.pleaseWait')}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-6 animate-fade-in">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-green-200">
            <Icon name="check" className="text-white text-5xl" size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('settings.paymentComplete')}</h2>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Icon name="error" className="text-red-500" size="lg" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('payment.paymentError')}</h2>
            <p className="text-slate-500 text-sm break-keep">{errorMessage || t('settings.cancelError')}</p>
          </div>
          <Button variant="secondary" onClick={() => router.replace('/pricing')}>
            {t('payment.backToPayment')}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PricingCompletePage() {
  const { t } = useLocale();
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-900">
      <Navbar title={t('pricing.title')} />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }>
        <PricingCompleteContent />
      </Suspense>
    </div>
  );
}
