'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleProvider';
import { triggerNativeHaptic } from '@/lib/nativeHaptics';

type HomeLogoButtonProps = {
  variant?: 'icon' | 'brand';
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  imageSize?: number;
  priority?: boolean;
  onNavigate?: () => boolean | void;
};

export function HomeLogoButton({
  variant = 'icon',
  className = '',
  imageClassName = '',
  textClassName = '',
  imageSize = 28,
  priority = false,
  onNavigate,
}: HomeLogoButtonProps) {
  const router = useRouter();
  const { t } = useLocale();

  const handleClick = () => {
    triggerNativeHaptic('light');
    if (onNavigate?.() === false) return;
    router.replace('/');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('common.homeAriaLabel')}
      className={`inline-flex items-center cursor-pointer transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      <Image
        src="/gijilai_icon.png"
        alt=""
        width={imageSize}
        height={imageSize}
        priority={priority}
        className={imageClassName}
      />
      {variant === 'brand' && (
        <span className={textClassName}>
          {t('common.appName')}
        </span>
      )}
    </button>
  );
}
