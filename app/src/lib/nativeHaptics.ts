'use client';

export type NativeHapticStyle = 'light' | 'medium' | 'heavy';

declare global {
  interface Window {
    HapticBridge?: {
      postMessage: (message: string) => void;
    };
    __nativeCapabilities?: {
      haptics?: boolean;
    };
  }
}

export function isAppWebView() {
  return (
    typeof window !== 'undefined' &&
    window.navigator.userAgent.includes('gijilai_app')
  );
}

export function supportsNativeHaptics() {
  if (typeof window === 'undefined') return false;

  return (
    isAppWebView() &&
    window.__nativeCapabilities?.haptics === true &&
    !!window.HapticBridge
  );
}

export function triggerNativeHaptic(style: NativeHapticStyle = 'light') {
  if (!supportsNativeHaptics()) return;

  window.HapticBridge?.postMessage(
    JSON.stringify({
      type: 'impact',
      style,
    }),
  );
}
