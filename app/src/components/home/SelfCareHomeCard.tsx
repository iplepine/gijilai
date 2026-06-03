'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';

type Props = {
  userId: string;
};

// 홈 "오늘의 나" 카드.
// 진행 중인 양육자 자기 돌봄(SELF_PARENT 실천)이 있으면 부드럽게 노출하고,
// 없으면 렌더링하지 않는다 (홈 우선순위를 해치지 않도록 self-hide).
export function SelfCareHomeCard({ userId }: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await db.getActiveSelfParentPractices(userId);
        if (cancelled) return;
        if (items.length > 0) setActiveTitle(items[0].title);
      } catch (err) {
        console.warn('[SelfCareHomeCard] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return null;

  // 진행 중인 자기 돌봄이 있으면 → 내 마음 기록(이번 주 후속)으로
  if (activeTitle) {
    return (
      <button
        onClick={() => {
          trackEvent('self_parent_home_card_click', { state: 'active' });
          router.push('/consult/self/records');
        }}
        className="w-full text-left bg-white dark:bg-surface-dark/50 rounded-2xl p-5 shadow-soft border border-secondary/20 active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary/12 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-secondary">self_improvement</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-bold text-text-main dark:text-white">{t('selfParent.homeCardTitle')}</h3>
            <p className="text-[11px] text-text-sub dark:text-gray-400 truncate">
              {t('selfParent.homeCardActive', { title: activeTitle })}
            </p>
          </div>
          <span className="material-symbols-outlined text-[18px] text-secondary/50">arrow_forward</span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
          <p className="text-[12px] text-secondary/90 font-medium">{t('selfParent.homeCardCheckin')}</p>
        </div>
      </button>
    );
  }

  // 진행 중이 없으면 → 부드러운 초대 카드(시작). 활성 카드보다 가벼운 점선 스타일.
  return (
    <button
      onClick={() => {
        trackEvent('self_parent_home_card_click', { state: 'empty' });
        router.push('/consult/self?from=home_invite');
      }}
      className="w-full text-left bg-secondary/[0.04] dark:bg-secondary/10 rounded-2xl p-4 border border-dashed border-secondary/30 active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-secondary/12 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px] text-secondary">self_improvement</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-text-main dark:text-white">{t('selfParent.homeCardTitle')}</p>
          <p className="text-[11px] text-text-sub dark:text-gray-400 leading-snug">{t('selfParent.homeCardEmpty')}</p>
        </div>
        <span className="text-[12px] font-bold text-secondary shrink-0">{t('selfParent.homeCardEmptyCta')}</span>
      </div>
    </button>
  );
}
