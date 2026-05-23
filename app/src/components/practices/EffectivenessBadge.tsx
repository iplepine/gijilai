'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import type { PracticeEffectivenessSummary } from '@/lib/practiceEffectiveness';

type Props = {
  summary: PracticeEffectivenessSummary;
  className?: string;
};

/**
 * 자기보고 효과 카운터 배지.
 * **절대 "%" 또는 "효과 X%" 표현을 노출하지 않는다.**
 * "효과 있었어요 N회 · 기록 M회" 식 카운트만 표시.
 */
export function EffectivenessBadge({ summary, className }: Props) {
  const { t } = useLocale();
  if (!summary.meetsDisplayThreshold) return null;

  return (
    <div
      className={
        'inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary/90 ring-1 ring-primary/15 ' +
        (className ?? '')
      }
      aria-label={t('practices.feltEffectiveAria', {
        felt: summary.feltEffectiveCount,
        total: summary.totalLogged,
      })}
    >
      <span className="material-symbols-outlined text-[14px]">favorite</span>
      <span>
        {t('practices.feltEffective', {
          felt: summary.feltEffectiveCount,
          total: summary.totalLogged,
        })}
      </span>
    </div>
  );
}
