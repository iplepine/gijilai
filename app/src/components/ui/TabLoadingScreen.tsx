'use client';

import type { ReactNode } from 'react';
import BottomNav from '@/components/layout/BottomNav';
import { Navbar } from '@/components/layout/Navbar';
import { TabLoadingIndicator } from '@/components/ui/TabLoadingIndicator';
import { useLocale } from '@/i18n/LocaleProvider';

type TabLoadingScreenProps = {
  /** 페이지 상단 Navbar에 표시할 제목. 생략하면 Navbar 미노출. */
  navbarTitle?: string;
  /** Navbar에 뒤로가기 버튼 노출 여부 (navbarTitle와 함께 사용). */
  showBack?: boolean;
  /** 하단 탭바 노출 여부 (기본: true — 탭 전환 시 nav 유지). */
  showBottomNav?: boolean;
  /** 스피너 옆에 표시할 라벨. */
  label?: ReactNode;
};

/**
 * 5개 메인 탭의 로딩 화면을 한 모양으로 통일하는 풀스크린 쉘.
 * - 모바일 max-w-md 컨테이너
 * - 가운데 `TabLoadingIndicator`
 * - BottomNav는 기본 노출 (탭 전환 도중 사라지지 않도록)
 * - Navbar는 navbarTitle이 있을 때만
 */
export function TabLoadingScreen({
  navbarTitle,
  showBack = false,
  showBottomNav = true,
  label,
}: TabLoadingScreenProps) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t('common.loading');

  return (
    <div className="bg-background-light dark:bg-background-dark h-[100dvh] min-h-[100dvh] overflow-hidden flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-0 flex flex-col shadow-2xl overflow-hidden relative">
        {navbarTitle && <Navbar title={navbarTitle} showBack={showBack} />}
        <main className="flex min-h-0 flex-1 items-center justify-center">
          <TabLoadingIndicator
            label={resolvedLabel}
            className="animate-fade-in"
          />
        </main>
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
