'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { triggerNativeHaptic } from '@/lib/nativeHaptics';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const noop = () => {};

const ToastContext = createContext<ToastContextType>({
  success: noop,
  error: noop,
  info: noop,
});

const TOAST_DURATION_MS = 3200;
const MAX_VISIBLE = 3;

const toneStyles: Record<ToastTone, { icon: string; iconClass: string }> = {
  success: { icon: 'check_circle', iconClass: 'text-primary' },
  error: { icon: 'error', iconClass: 'text-rose-500' },
  info: { icon: 'info', iconClass: 'text-sky-500' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone) => {
      if (!message) return;
      const id = nextId.current++;

      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, tone }]);
      triggerNativeHaptic(tone === 'error' ? 'medium' : 'light');

      const timer = window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // 언마운트 시 남은 타이머 정리
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextType>(
    () => ({
      success: (message: string) => push(message, 'success'),
      error: (message: string) => push(message, 'error'),
      info: (message: string) => push(message, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="app-toast-viewport pointer-events-none fixed inset-x-0 z-[200] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            onClick={() => dismiss(toast.id)}
            className="app-toast pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5 dark:bg-surface-dark dark:ring-white/10"
          >
            <span
              aria-hidden="true"
              className={`material-symbols-outlined shrink-0 text-[20px] leading-tight ${toneStyles[toast.tone].iconClass}`}
            >
              {toneStyles[toast.tone].icon}
            </span>
            <p className="whitespace-pre-line break-keep pt-px text-[14px] font-medium leading-relaxed text-text-main dark:text-white">
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
