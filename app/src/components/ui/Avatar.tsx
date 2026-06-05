'use client';

import { useEffect, useState } from 'react';

/**
 * 외부 OAuth 제공자(특히 카카오)가 내려주는 프로필 사진 URL은 종종 http:// 로 온다.
 * 앱은 HTTPS로 서비스되므로 이런 URL은 mixed-content로 차단되어 사진이 빈 화면으로 보인다.
 * HTTPS 환경에서는 http→https로 승격해 차단을 피한다. (blob:, data:, https:는 그대로 둔다.)
 */
export function normalizeAvatarUrl(src?: string | null): string | null {
  if (!src) return null;
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    src.startsWith('http://')
  ) {
    return `https://${src.slice('http://'.length)}`;
  }
  return src;
}

type AvatarProps = {
  src?: string | null;
  alt: string;
  /** 사진이 없거나 로드에 실패했을 때 보여줄 material-symbols 아이콘 이름 */
  fallbackIcon?: string;
  /** 폴백 아이콘에 적용할 클래스 (크기 등) */
  iconClassName?: string;
};

/**
 * 프로필/양육자 사진을 안전하게 렌더한다.
 * - 배경 이미지(div)만 쓰면 로드 실패를 감지할 수 없어 빈 원만 남는다.
 *   여기서는 이미지를 미리 로드해 실패하면 폴백 아이콘으로 대체한다.
 * - http:// URL은 normalizeAvatarUrl로 승격해 mixed-content 차단을 피한다.
 * 부모가 크기/모양(원형, overflow-hidden 등)을 지정하고, 이 컴포넌트는 그 안을 채운다.
 */
export function Avatar({ src, alt, fallbackIcon = 'person', iconClassName = '' }: AvatarProps) {
  const url = normalizeAvatarUrl(src);
  // 어떤 URL에서 로드가 실패했는지 기록한다. URL이 바뀌면 자연스럽게 다시 시도한다.
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new window.Image();
    img.onerror = () => {
      if (!cancelled) setErroredUrl(url);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (url && erroredUrl !== url) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="w-full h-full bg-cover bg-center"
        style={{ backgroundImage: `url("${url}")` }}
      />
    );
  }

  return (
    <span role="img" aria-label={alt} className={`material-symbols-outlined ${iconClassName}`}>
      {fallbackIcon}
    </span>
  );
}
