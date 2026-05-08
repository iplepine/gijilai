'use client';

import Image from 'next/image';
import { LoadingSpinner } from '@/components/ui/TabLoadingIndicator';

type ProgressStyle = 'bar' | 'dots' | 'spinner' | 'none';
type LoadingSize = 'regular' | 'compact';

interface TemperamentLoadingStateProps {
  title: string;
  message?: string;
  note?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  typeLabel?: string;
  className?: string;
  imagePriority?: boolean;
  showImage?: boolean;
  progressStyle?: ProgressStyle;
  progressCurrent?: number;
  progressTotal?: number;
  progressLabel?: string;
  size?: LoadingSize;
}

const DEFAULT_IMAGE = '/child_type/type_lhh.jpg';
const DEFAULT_ALT = '기질 유형 일러스트';

export function TemperamentLoadingState({
  title,
  message,
  note,
  imageSrc,
  imageAlt = DEFAULT_ALT,
  typeLabel,
  className = '',
  imagePriority = false,
  showImage = true,
  progressStyle = 'bar',
  progressCurrent,
  progressTotal,
  progressLabel,
  size = 'regular',
}: TemperamentLoadingStateProps) {
  const isCompact = size === 'compact';
  const hasDeterminateProgress =
    typeof progressCurrent === 'number'
    && typeof progressTotal === 'number'
    && progressTotal > 0;
  const progressPercent = hasDeterminateProgress
    ? Math.max(4, Math.min(100, Math.round((progressCurrent / progressTotal) * 100)))
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center text-center animate-fade-in ${isCompact ? 'gap-3' : 'gap-5'} ${className}`}
    >
      {showImage && (
        <div
          className={`relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_18px_42px_rgba(47,79,62,0.14)] dark:border-white/10 dark:bg-surface-dark dark:shadow-black/20 ${
            isCompact ? 'w-[10.5rem]' : 'w-[14rem]'
          } max-w-full aspect-[11/6]`}
        >
          <Image
            src={imageSrc || DEFAULT_IMAGE}
            alt={imageAlt}
            width={704}
            height={384}
            priority={imagePriority}
            quality={75}
            sizes={isCompact ? '168px' : '224px'}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/10 to-transparent" />
        </div>
      )}

      {showImage && typeLabel && (
        <p className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black text-primary dark:bg-white/10 dark:text-primary-light">
          {typeLabel}
        </p>
      )}

      <div className={`space-y-2 ${isCompact ? 'max-w-[17rem]' : 'max-w-[20rem]'}`}>
        <p className={`${isCompact ? 'text-[15px]' : 'text-lg'} font-black leading-snug text-text-main dark:text-white break-keep`}>
          {title}
        </p>
        {message && (
          <p className={`${isCompact ? 'text-[12px]' : 'text-[14px]'} font-semibold leading-relaxed text-text-sub dark:text-gray-400 break-keep`}>
            {message}
          </p>
        )}
      </div>

      {progressStyle === 'bar' && (
        <div className={`${isCompact ? 'w-28' : 'w-44'} space-y-1.5`}>
          {progressLabel && (
            <p className="text-[11px] font-black text-primary dark:text-primary-light">
              {progressLabel}
            </p>
          )}
          <div
            role="progressbar"
            aria-label={progressLabel ? `${title} ${progressLabel}` : title}
            aria-valuemin={hasDeterminateProgress ? 0 : undefined}
            aria-valuemax={hasDeterminateProgress ? progressTotal : undefined}
            aria-valuenow={hasDeterminateProgress ? progressCurrent : undefined}
            className={`${isCompact ? 'h-1' : 'h-1.5'} overflow-hidden rounded-full bg-primary/10 dark:bg-white/10`}
          >
            <div
              className={`h-full rounded-full bg-gradient-to-r from-primary to-secondary ${
                hasDeterminateProgress ? 'transition-all duration-700 ease-out' : 'animate-progress'
              }`}
              style={hasDeterminateProgress ? { width: `${progressPercent}%` } : undefined}
            />
          </div>
        </div>
      )}

      {progressStyle === 'spinner' && <LoadingSpinner />}

      {progressStyle === 'dots' && (
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce-subtle" />
          <span className="h-2 w-2 rounded-full bg-secondary animate-bounce-subtle" style={{ animationDelay: '120ms' }} />
          <span className="h-2 w-2 rounded-full bg-primary/70 animate-bounce-subtle" style={{ animationDelay: '240ms' }} />
        </div>
      )}

      {note && (
        <p className="max-w-[20rem] text-[12px] font-medium leading-relaxed text-text-sub/70 dark:text-gray-500 break-keep">
          {note}
        </p>
      )}
    </div>
  );
}
