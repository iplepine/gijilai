'use client';

import { triggerNativeHaptic } from '@/lib/nativeHaptics';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'kakao' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconRight?: ReactNode;
  badge?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  badge,
  fullWidth = false,
  children,
  className = '',
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const baseStyles = `
    flex items-center justify-center gap-2 font-bold
    rounded-2xl transition-all active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
  `;

  const variants = {
    primary: `
      bg-[var(--primary)] text-white
      shadow-xl shadow-[var(--primary)]/20
    `,
    secondary: `
      bg-white dark:bg-gray-800
      text-[var(--navy)] dark:text-white
      border border-gray-200 dark:border-gray-700
    `,
    kakao: `
      bg-[#FEE500] text-[#3c1e1e]
    `,
    ghost: `
      bg-transparent text-[var(--navy)] dark:text-white
      hover:bg-gray-100 dark:hover:bg-gray-800
    `,
  };

  const sizes = {
    sm: 'h-10 px-4 text-sm',
    md: 'h-14 px-5 text-base',
    lg: 'h-16 px-6 text-lg',
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled}
      onClick={(event) => {
        if (!disabled) {
          triggerNativeHaptic('light');
        }
        onClick?.(event);
      }}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      {badge && (
        <span className="bg-[var(--navy)]/10 px-2 py-0.5 rounded-md text-xs font-bold">
          {badge}
        </span>
      )}
      {iconRight}
    </button>
  );
}
