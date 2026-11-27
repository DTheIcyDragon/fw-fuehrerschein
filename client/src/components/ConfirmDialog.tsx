import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={title}
      maxWidthClass="max-w-md"
      icon={
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            danger
              ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
              : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
      }
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
            autoFocus={danger}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Bitte warten…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
    </ModalShell>
  );
}
