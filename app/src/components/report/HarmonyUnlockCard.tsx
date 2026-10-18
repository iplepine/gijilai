'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';
import { HARMONY_REPORT_PRICE, HARMONY_REPORT_PRODUCT } from '@/lib/harmonyUnlock';
import { buildInstallPageUrl } from '@/lib/install';

export type HarmonyPaywallMode = 'app' | 'web';

type IapWindow = Window & {
  PaymentBridge?: { postMessage: (message: string) => void };
  __iapLoadingDone?: () => void;
  __iapPaymentCompleted?: (payload?: { shouldNavigate?: boolean }) => void;
};

// 네이티브 결제 시트의 콜백이 유실돼도 버튼이 영구히 잠기지 않게 한다(요금제 화면과 같은 안전장치).
const PURCHASE_LOCK_TIMEOUT_MS = 60_000;

/**
 * 궁합 심층 리포트 잠금 카드. 앱에서는 인앱결제 단품을 요청하고,
 * 브라우저에서는 결제를 앱으로 보낸다(웹 결제는 앱 설치로 유도하는 기존 정책).
 */
export function HarmonyUnlockCard({
  mode,
  childId,
  principleCount,
  tipCount,
  onPurchased,
}: {
  mode: HarmonyPaywallMode;
  childId: string;
  principleCount: number;
  tipCount: number;
  onPurchased: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const onPurchasedRef = useRef(onPurchased);
  useEffect(() => {
    onPurchasedRef.current = onPurchased;
  }, [onPurchased]);

  useEffect(() => {
    trackEvent('harmony_paywall_viewed', { paywall_mode: mode });
  }, [mode, childId]);

  useEffect(() => {
    if (mode !== 'app') return;
    const iapWindow = window as IapWindow;
    iapWindow.__iapLoadingDone = () => setRequesting(false);
    iapWindow.__iapPaymentCompleted = () => {
      setRequesting(false);
      trackEvent('harmony_unlock_completed', { paywall_mode: mode });
      onPurchasedRef.current();
    };
    return () => {
      iapWindow.__iapLoadingDone = undefined;
      iapWindow.__iapPaymentCompleted = undefined;
    };
  }, [mode]);

  useEffect(() => {
    if (!requesting) return;
    const timer = window.setTimeout(() => setRequesting(false), PURCHASE_LOCK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [requesting]);

  const handleUnlock = () => {
    if (requesting) return;
    trackEvent('harmony_unlock_started', { paywall_mode: mode });

    if (mode === 'web') {
      router.push(buildInstallPageUrl({ source: 'harmony_unlock', entry_cta: 'harmony_unlock' }));
      return;
    }

    const bridge = (window as IapWindow).PaymentBridge;
    if (!bridge) return;
    setRequesting(true);
    bridge.postMessage(JSON.stringify({
      type: 'PAYMENT_REQUEST',
      product: HARMONY_REPORT_PRODUCT,
      childId,
    }));
  };

  const price = t('harmonyUnlock.price', { amount: HARMONY_REPORT_PRICE.amount.toLocaleString('ko-KR') });
  const includes = [
    t('harmonyUnlock.includesPrinciples', { count: principleCount }),
    t('harmonyUnlock.includesScripts', { count: tipCount }),
    t('harmonyUnlock.includesAudit'),
    t('harmonyUnlock.includesReminder'),
  ];

  return (
    <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-primary/20 space-y-4">
      <div className="space-y-1.5">
        <p className="text-[12px] font-black text-primary flex items-center gap-1.5">
          <Icon name="lock" size="sm" /> {t('harmonyUnlock.eyebrow')}
        </p>
        <h4 className="text-[18px] font-black text-text-main dark:text-white leading-snug break-keep">{t('harmonyUnlock.title')}</h4>
        <p className="text-[13px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">{t('harmonyUnlock.description')}</p>
      </div>

      <ul className="space-y-2">
        {includes.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[13px] text-text-main dark:text-slate-200 break-keep">
            <Icon name="check_circle" size="sm" className="text-primary mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <Button
        variant="primary"
        fullWidth
        className="h-14 rounded-2xl font-black text-base"
        onClick={handleUnlock}
        disabled={requesting}
      >
        {mode === 'app' ? t('harmonyUnlock.ctaApp', { price }) : t('harmonyUnlock.ctaWeb')}
      </Button>

      <div className="space-y-1.5 text-center">
        <button
          type="button"
          onClick={() => router.push('/pricing?source=harmony_unlock&entry_cta=harmony_subscription')}
          className="text-[12px] font-bold text-text-sub underline underline-offset-2"
        >
          {t('harmonyUnlock.subscriptionNote')}
        </button>
        <p className="text-[11px] text-text-sub/70 leading-relaxed break-keep">{t('harmonyUnlock.legalNote')}</p>
      </div>
    </section>
  );
}
