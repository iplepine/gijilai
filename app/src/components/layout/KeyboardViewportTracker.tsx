'use client';

import { useEffect } from 'react';

function isEditableTextInput(element: Element | null) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }

  return !element.disabled && !element.readOnly;
}

export function KeyboardViewportTracker() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const updateViewport = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const keyboardInset = isEditableTextInput(document.activeElement)
        ? Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop)
        : 0;

      root.style.setProperty('--visual-viewport-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--visual-viewport-offset-top', `${Math.round(viewportOffsetTop)}px`);
      root.style.setProperty('--keyboard-inset-bottom', `${Math.round(keyboardInset)}px`);
    };

    const updateAfterFocusSettles = () => {
      window.setTimeout(updateViewport, 80);
    };

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.addEventListener('focusin', updateAfterFocusSettles);
    window.addEventListener('focusout', updateAfterFocusSettles);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    updateViewport();

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.removeEventListener('focusin', updateAfterFocusSettles);
      window.removeEventListener('focusout', updateAfterFocusSettles);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      root.style.setProperty('--visual-viewport-height', '100dvh');
      root.style.setProperty('--visual-viewport-offset-top', '0px');
      root.style.setProperty('--keyboard-inset-bottom', '0px');
    };
  }, []);

  return null;
}
