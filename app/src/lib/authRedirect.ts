const VALIDATION_ORIGIN = 'https://gijilai.invalid';

function hasUnsafeCharacters(value: string) {
  return Array.from(value).some((character) => (
    character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127
  ));
}

/** Keep authentication returns inside the app, away from authentication loops. */
export function getSafeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafeCharacters(value)) {
    return '/';
  }

  try {
    const url = new URL(value, VALIDATION_ORIGIN);
    if (url.origin !== VALIDATION_ORIGIN) return '/';

    // Inspect encoded paths too: browsers/proxies may normalize slashes or dot segments.
    let pathname = url.pathname;
    for (let depth = 0; depth < 5; depth += 1) {
      if (hasUnsafeCharacters(pathname) || pathname.startsWith('//')) return '/';
      const normalized = new URL(pathname, VALIDATION_ORIGIN);
      if (normalized.origin !== VALIDATION_ORIGIN) return '/';
      if (/^\/(?:auth|login)(?:\/|$)/i.test(normalized.pathname)) return '/';

      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) return `${url.pathname}${url.search}${url.hash}`;
      pathname = decoded;
    }
  } catch {
    // Malformed URLs and percent encodings fall back to the home page.
  }

  return '/';
}

export function getAuthCallbackUrl(origin: string, redirect: string | null, native = false) {
  // Native OAuth already has a platform callback contract; keep that URI unchanged.
  if (native) return 'gijilai://auth/callback';

  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', getSafeAuthRedirect(redirect));
  return callback.toString();
}
