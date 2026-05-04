'use client';

import { triggerNativeHaptic } from '@/lib/nativeHaptics';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { HomeLogoButton } from './HomeLogoButton';

interface NavbarProps {
  title: string;
  showBack?: boolean;
  onBackClick?: () => void;
  onHomeClick?: () => boolean | void;
  rightElement?: ReactNode;
  showHomeLogo?: boolean;
}

export function Navbar({
  title,
  showBack = true,
  onBackClick,
  onHomeClick,
  rightElement,
  showHomeLogo = true,
}: NavbarProps) {
  const router = useRouter();

  return (
    <header className="app-top-bar sticky top-0 z-40 border-b border-gray-100 bg-background-light/80 backdrop-blur-xl dark:border-gray-800 dark:bg-background-dark/80">
      <div className="app-top-bar-inner relative flex items-center justify-center w-full px-4">
        <div className="absolute left-4 flex items-center gap-1">
          {showBack && (
            <button
              onClick={() => {
                triggerNativeHaptic('light');
                if (onBackClick) {
                  onBackClick();
                  return;
                }
                router.back();
              }}
              className="size-10 flex items-center justify-center text-text-main dark:text-white"
              aria-label="뒤로 가기"
            >
              <span className="material-symbols-outlined">arrow_back_ios</span>
            </button>
          )}
          {showHomeLogo && (
            <HomeLogoButton
              className="size-10 justify-center"
              imageClassName="size-7 rounded-lg object-contain"
              onNavigate={onHomeClick}
            />
          )}
        </div>

        <h1 className="max-w-[calc(100%-11rem)] truncate text-xl font-display text-text-main dark:text-white text-center leading-none translate-y-[1px]">
          {title}
        </h1>

        <div className="absolute right-4">
          {rightElement && (
            <div className="size-10 flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
