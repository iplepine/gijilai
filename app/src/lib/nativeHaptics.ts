'use client';

import { getNativeCapabilities } from '@/lib/nativeCapabilities';

export type NativeHapticStyle = 'light' | 'medium' | 'heavy';

declare global {
  interface Window {
    HapticBridge?: {
      postMessage: (message: string) => void;
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
    getNativeCapabilities()?.haptics === true &&
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
