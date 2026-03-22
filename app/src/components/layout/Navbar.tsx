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
    <header className="sticky top-0 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl pt-12 pb-4 border-b border-gray-100 dark:border-gray-800">
      <div className="relative flex items-center justify-center w-full px-4 min-h-[40px]">
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

        <h1 className="text-lg font-display text-text-main dark:text-white text-center">
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
