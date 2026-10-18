'use client';

import { Icon } from '@/components/ui/Icon';
import { useLocale } from '@/i18n/LocaleProvider';
import { getAssessmentAgeStatus } from '@/lib/childAgeRange';

/** 기질 검사 기준 연령(만 3~7세) 밖의 생년월일이면 결과를 참고용으로 보라고 안내한다. 입력은 막지 않는다. */
export function AssessmentAgeNotice({ birthDate }: { birthDate: string }) {
  const { t } = useLocale();
  const status = birthDate ? getAssessmentAgeStatus(birthDate) : null;
  if (!status || status === 'in_range') return null;

  return (
    <div role="note" className="mt-2 rounded-2xl border border-primary/10 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-white/10">
          <Icon name="info" size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-text-main dark:text-white">{t('ageNotice.title')}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-text-sub break-keep">
            {t(status === 'too_young' ? 'ageNotice.tooYoung' : 'ageNotice.tooOld')}
          </p>
        </div>
      </div>
    </div>
  );
}
