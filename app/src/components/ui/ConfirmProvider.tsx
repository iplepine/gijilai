'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useLocale } from '@/i18n/LocaleProvider';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 되돌릴 수 없는 작업이면 'danger' — 확인 버튼이 빨간색이 된다. */
  tone?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const settle = useCallback((value: boolean) => {
    pendingRef.current?.resolve(value);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    // 이미 열려 있는 확인창이 있으면 취소로 정리해 프라미스가 매달리지 않게 한다.
    pendingRef.current?.resolve(false);

    return new Promise<boolean>((resolve) => {
      const next = { ...options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <ConfirmDialog
          title={pending.title}
          description={pending.description ?? ''}
          cancelLabel={pending.cancelLabel ?? t('common.cancel')}
          confirmLabel={pending.confirmLabel ?? t('common.confirm')}
          tone={pending.tone}
          onCancel={() => settle(false)}
          onConfirm={() => settle(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * 네이티브 confirm()을 대체하는 훅.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: '삭제할까요?' }))) return;
 */
export function useConfirm() {
  return useContext(ConfirmContext);
}
