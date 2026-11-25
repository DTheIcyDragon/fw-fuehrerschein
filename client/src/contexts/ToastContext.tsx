import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextToastId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-end gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:w-96"
      >
        {toasts.map((toast) => {
          const styles =
            toast.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-100'
              : toast.kind === 'error'
                ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/95 dark:text-red-100'
                : 'border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100';

          const Icon =
            toast.kind === 'success'
              ? CheckCircle2
              : toast.kind === 'error'
                ? AlertCircle
                : Info;

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3.5 shadow-lg ${styles}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-1 opacity-70 hover:opacity-100"
                aria-label="Meldung schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
