import type { NativeCapabilities } from '@/lib/nativeCapabilities';

export type BrowserPlatform = 'ios' | 'android' | 'other';

export const GIJILAI_APP_SCHEME = 'gijilai';
export const GIJILAI_APP_STORE_URL = 'https://apps.apple.com/app/id6761619239';
export const GIJILAI_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.devho.gijilai';

function readUserAgent(userAgent?: string) {
  if (typeof userAgent === 'string') return userAgent.toLowerCase();
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent.toLowerCase();
}

export function isAppWebView(userAgent?: string) {
  if (typeof window === 'undefined') {
    return readUserAgent(userAgent).includes('gijilai_app');
  }

  const appWindow = window as Window & {
    PaymentBridge?: unknown;
    __nativeCapabilities?: NativeCapabilities;
  };
  const nativePlatform = document.documentElement.dataset.nativePlatform;

  return (
    readUserAgent(userAgent).includes('gijilai_app') ||
    typeof appWindow.PaymentBridge !== 'undefined' ||
    typeof appWindow.__nativeCapabilities !== 'undefined' ||
    nativePlatform === 'ios' ||
    nativePlatform === 'android'
  );
}

export function detectBrowserPlatform(userAgent?: string): BrowserPlatform {
  const ua = readUserAgent(userAgent);

  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (ua.includes('android')) return 'android';
  return 'other';
}

export function getPrimaryStoreUrl(platform: BrowserPlatform) {
  if (platform === 'ios') return GIJILAI_APP_STORE_URL;
  if (platform === 'android') return GIJILAI_PLAY_STORE_URL;
  return null;
}

export function buildAppOpenPath(from?: string | null) {
  if (from === 'pricing') return '/pricing';
  if (from === 'payment') return '/payment';
  if (from === 'practices') return '/practices';
  return '/';
}

export function buildAppOpenUrl(path: string) {
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  return `${GIJILAI_APP_SCHEME}://open?path=${encodeURIComponent(safePath)}`;
}

export function buildAndroidIntentUrl(path: string) {
  const fallbackUrl = encodeURIComponent(GIJILAI_PLAY_STORE_URL);
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  return `intent://open?path=${encodeURIComponent(safePath)}#Intent;scheme=${GIJILAI_APP_SCHEME};package=com.devho.gijilai;S.browser_fallback_url=${fallbackUrl};end`;
}

export function buildInstallPageUrl(params?: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return query ? `/install-app?${query}` : '/install-app';
}
