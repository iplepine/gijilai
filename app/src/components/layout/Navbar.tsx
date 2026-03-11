'use client';

import { Icon } from '@/components/ui/Icon';
import { DarkModeToggle } from '@/components/ui/DarkModeToggle';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface NavbarProps {
  title: string;
  showBack?: boolean;
  onBackClick?: () => void;
  rightIcon?: string;
  onRightClick?: () => void;
  rightElement?: ReactNode;
  showDarkModeToggle?: boolean;
}

export function Navbar({ title, showBack = false, onBackClick, rightIcon, onRightClick, rightElement, showDarkModeToggle = false }: NavbarProps) {
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-50 bg-[var(--background-light)]/90 dark:bg-[var(--background-dark)]/90 backdrop-blur-xl pt-12 pb-4 border-b border-gray-100 dark:border-gray-800">
      <div className="relative flex items-center justify-center w-full px-4 min-h-[40px]">
        {/* Left Action */}
        <div className="absolute left-4">
          <div className="size-10 flex items-center justify-center">
            {showBack ? (
              <button onClick={() => onBackClick ? onBackClick() : router.back()} className="text-[var(--navy)] dark:text-white">
                <Icon name="arrow_back_ios" />
              </button>
            ) : (
              <button className="text-[var(--navy)] dark:text-white">
                <Icon name="menu" />
              </button>
            )}
          </div>
        </div>

        {/* Center Title */}
        <h2 className="text-[var(--navy)] dark:text-white text-base font-bold text-center">
          {title}
        </h2>

        {/* Right Action */}
        <div className="absolute right-4">
          <div className="size-10 flex items-center justify-center">
            {rightElement ? (
              rightElement
            ) : showDarkModeToggle ? (
              <DarkModeToggle />
            ) : rightIcon ? (
              <button onClick={onRightClick} className="text-[var(--navy)] dark:text-white">
                <Icon name={rightIcon} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
