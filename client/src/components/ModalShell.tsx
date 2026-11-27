import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  maxWidthClass?: string;
  tabs?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function isPointOutsideRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  );
}

export function ModalShell({
  open,
  onClose,
  title,
  icon,
  maxWidthClass = 'max-w-lg',
  tabs,
  footer,
  children,
}: ModalShellProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerDownOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Safari fallback for closedby="any": only close if both pointerdown and pointerup occur outside dialog box
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open || 'closedBy' in HTMLDialogElement.prototype) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target !== dialog) {
        pointerDownOutsideRef.current = false;
        return;
      }
      pointerDownOutsideRef.current = isPointOutsideRect(
        e.clientX,
        e.clientY,
        dialog.getBoundingClientRect(),
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!pointerDownOutsideRef.current) return;
      pointerDownOutsideRef.current = false;
      if (
        e.target === dialog &&
        isPointOutsideRect(e.clientX, e.clientY, dialog.getBoundingClientRect())
      ) {
        dialog.close();
      }
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      {...({ closedby: 'any' } as Record<string, string>)}
      className={`modal-dialog m-auto max-h-[92vh] w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-lg focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:w-full ${maxWidthClass}`}
    >
      {open && (
        <>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-2.5">
              {icon && <span className="shrink-0">{icon}</span>}
              <h2
                id={titleId}
                className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Dialog schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {tabs && <div className="shrink-0">{tabs}</div>}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

          {footer && (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
