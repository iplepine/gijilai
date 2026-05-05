export type NativeAuthProvider = 'kakao' | 'apple' | 'google';
export type NativeScreenKey =
  | 'login'
  | 'payment'
  | 'subscription'
  | 'notifications'
  | 'profile';

export interface NativeCapabilities {
  contractVersion?: number;
  haptics?: boolean;
  voiceInput?: boolean;
  supportedScreens?: Partial<Record<NativeScreenKey, boolean>>;
  nativeAuthProviders?: Partial<Record<NativeAuthProvider, boolean>>;
}

declare global {
  interface Window {
    __nativeCapabilities?: NativeCapabilities;
    RouteBridge?: {
      postMessage(message: string): void;
    };
  }
}

export function getNativeCapabilities() {
  if (typeof window === 'undefined') return null;
  return window.__nativeCapabilities ?? null;
}

export function supportsNativeScreen(screen: NativeScreenKey) {
  return getNativeCapabilities()?.supportedScreens?.[screen] === true;
}

export function supportsNativeAuthProvider(provider: NativeAuthProvider) {
  return getNativeCapabilities()?.nativeAuthProviders?.[provider] === true;
}

export function notifyNativeRouteChange(path?: string) {
  if (typeof window === 'undefined') return false;
  if (typeof window.RouteBridge?.postMessage !== 'function') return false;

  try {
    const routePath = path ?? window.location.pathname;
    window.RouteBridge.postMessage(JSON.stringify({
      type: 'ROUTE_CHANGED',
      url: window.location.href,
      path: routePath,
    }));
    return true;
  } catch {
    return false;
  }
}
