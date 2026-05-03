export type BrowserPlatform = 'ios' | 'android' | 'other';

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
    __nativeCapabilities?: unknown;
  };
  return (
    readUserAgent(userAgent).includes('gijilai_app') ||
    typeof appWindow.PaymentBridge !== 'undefined' ||
    typeof appWindow.__nativeCapabilities !== 'undefined'
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

export function buildInstallPageUrl(params?: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return query ? `/install-app?${query}` : '/install-app';
}
