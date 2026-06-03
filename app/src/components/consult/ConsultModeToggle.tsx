'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';

type Mode = 'child' | 'self';

// 아이 상담(/consult)과 내 마음 상담(/consult/self) INPUT 화면 상단에 두는 전환 토글.
// 입력 단계에서만 노출한다(문진/결과 중에는 숨김).
export function ConsultModeToggle({ current }: { current: Mode }) {
  const router = useRouter();
  const { t } = useLocale();

  const go = (mode: Mode) => {
    if (mode === current) return;
    trackEvent('consult_mode_toggle', { from: current, to: mode });
    router.push(mode === 'child' ? '/consult' : '/consult/self?from=mode_toggle');
  };

  const pill = (mode: Mode, label: string) => {
    const active = mode === current;
    return (
      <button
        onClick={() => go(mode)}
        aria-pressed={active}
        className={`flex-1 h-9 rounded-lg text-[13px] font-bold transition-all ${
          active
            ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white shadow-sm'
            : 'text-text-sub dark:text-gray-400'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-beige-light/60 dark:bg-white/5 border border-beige-main/20">
      {pill('child', t('selfParent.toggleChild'))}
      {pill('self', t('selfParent.toggleSelf'))}
    </div>
  );
}
