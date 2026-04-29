'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface NavbarProps {
  title: string;
  showBack?: boolean;
  onBackClick?: () => void;
  rightElement?: ReactNode;
}

export function Navbar({ title, showBack = true, onBackClick, rightElement }: NavbarProps) {
  const router = useRouter();

  return (
    <header className="app-top-bar sticky top-0 z-40 border-b border-gray-100 bg-background-light/80 backdrop-blur-xl dark:border-gray-800 dark:bg-background-dark/80">
      <div className="app-top-bar-inner relative flex items-center justify-center w-full px-4">
        <div className="absolute left-4">
          {showBack && (
            <button
              onClick={() => onBackClick ? onBackClick() : router.back()}
              className="size-10 flex items-center justify-center text-text-main dark:text-white"
              aria-label="뒤로 가기"
            >
              <span className="material-symbols-outlined">arrow_back_ios</span>
            </button>
          )}
        </div>

        <h1 className="text-xl font-display text-text-main dark:text-white text-center leading-none translate-y-[1px]">
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
