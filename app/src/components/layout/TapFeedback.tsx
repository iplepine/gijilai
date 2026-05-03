'use client';

import { useEffect, useRef, useState } from 'react';
import { isAppWebView } from '@/lib/nativeHaptics';

function isDisabledInteractive(element: Element) {
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return element.disabled;
  }
  return element.getAttribute('aria-disabled') === 'true';
}

function findInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;

  return target.closest<HTMLElement>(
    'a[href], button, [role="button"], input[type="button"], input[type="submit"], summary',
  );
}

export function TapFeedback() {
  const [visible, setVisible] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isAppWebView()) return;

    const clearHideTimer = () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };

    const hideSoon = (delay = 180) => {
      clearHideTimer();
      hideTimer.current = window.setTimeout(() => {
        setVisible(false);
      }, delay);
    };

    const showPulse = (duration = 900) => {
      clearHideTimer();
      setPulseKey((key) => key + 1);
      setVisible(true);
      hideTimer.current = window.setTimeout(() => {
        setVisible(false);
      }, duration);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const interactive = findInteractiveElement(event.target);
      if (!interactive) return;
      if (interactive.closest('[data-tap-feedback="off"]')) return;
      if (isDisabledInteractive(interactive)) return;

      showPulse();
    };

    const handleSubmit = () => {
      showPulse(1600);
    };

    const handleNavigationSignal = () => {
      hideSoon(260);
    };

    const handlePageShow = () => {
      hideSoon(120);
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function patchedPushState(...args) {
      const result = originalPushState.apply(this, args);
      hideSoon(260);
      return result;
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      hideSoon(260);
      return result;
    };

    document.addEventListener('pointerdown', handlePointerDown, {
      capture: true,
      passive: true,
    });
    document.addEventListener('submit', handleSubmit, { capture: true });
    window.addEventListener('popstate', handleNavigationSignal);
    window.addEventListener('hashchange', handleNavigationSignal);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearHideTimer();
      document.removeEventListener('pointerdown', handlePointerDown, {
        capture: true,
      });
      document.removeEventListener('submit', handleSubmit, { capture: true });
      window.removeEventListener('popstate', handleNavigationSignal);
      window.removeEventListener('hashchange', handleNavigationSignal);
      window.removeEventListener('pageshow', handlePageShow);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`app-tap-feedback fixed left-0 right-0 z-[9999] h-[3px] overflow-hidden pointer-events-none transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div key={pulseKey} className="app-tap-feedback-bar h-full bg-primary" />
    </div>
  );
}
