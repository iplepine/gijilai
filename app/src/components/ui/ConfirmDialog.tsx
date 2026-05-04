'use client';

import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <div
      className="app-modal-overlay fixed inset-0 z-[100] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div className="app-modal-panel w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-surface-dark">
        <div className="space-y-2 pb-5 text-left">
          <h2 id="confirm-dialog-title" className="text-[20px] font-black leading-tight text-text-main dark:text-white">
            {title}
          </h2>
          <p id="confirm-dialog-description" className="text-[14px] leading-relaxed text-text-sub dark:text-slate-300 break-keep">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onCancel}
            disabled={isConfirming}
            className="h-12 rounded-2xl"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={onConfirm}
            disabled={isConfirming}
            className="h-12 rounded-2xl"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
