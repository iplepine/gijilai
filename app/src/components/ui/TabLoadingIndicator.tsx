import type { ReactNode } from 'react';

interface LoadingSpinnerProps {
  className?: string;
}

interface TabLoadingIndicatorProps {
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

export function LoadingSpinner({ className = '' }: LoadingSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`h-10 w-10 animate-spin rounded-full border-4 border-primary/10 border-t-primary ${className}`}
    />
  );
}

export function TabLoadingIndicator({
  label,
  ariaLabel,
  className = '',
}: TabLoadingIndicatorProps) {
  const fallbackLabel = ariaLabel || (typeof label === 'string' ? label : 'Loading');

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 opacity-50 ${className}`}
    >
      <LoadingSpinner />
      {label ? (
        <p className="text-sm font-medium text-text-sub dark:text-gray-400">
          {label}
        </p>
      ) : (
        <span className="sr-only">{fallbackLabel}</span>
      )}
    </div>
  );
}
