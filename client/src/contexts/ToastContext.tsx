import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

interface TimerRecord {
  timerId: number | null;
  startedAt: number;
  remainingMs: number;
}

const TOAST_DURATION_MS = 4500;
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextToastId = 1;

type PopoverElement = HTMLDivElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Map<number, TimerRecord>>(new Map());
  const isFocusedRef = useRef(false);

  const dismiss = useCallback((id: number) => {
    const rec = timersRef.current.get(id);
    if (rec?.timerId !== null && rec?.timerId !== undefined) {
      window.clearTimeout(rec.timerId);
    }
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleTimer = useCallback(
    (id: number, delayMs: number) => {
      const existing = timersRef.current.get(id);
      if (existing?.timerId !== null && existing?.timerId !== undefined) {
        window.clearTimeout(existing.timerId);
      }
      const timerId = window.setTimeout(() => {
        dismiss(id);
      }, delayMs);
      timersRef.current.set(id, {
        timerId,
        startedAt: Date.now(),
        remainingMs: delayMs,
      });
    },
    [dismiss],
  );

  const pauseAllTimers = useCallback(() => {
    const now = Date.now();
    for (const [id, rec] of timersRef.current.entries()) {
      if (rec.timerId !== null) {
        window.clearTimeout(rec.timerId);
        const elapsed = now - rec.startedAt;
        timersRef.current.set(id, {
          timerId: null,
          startedAt: now,
          remainingMs: Math.max(500, rec.remainingMs - elapsed),
        });
      }
    }
  }, []);

  const resumeAllTimers = useCallback(() => {
    for (const [id, rec] of timersRef.current.entries()) {
      if (rec.timerId === null) {
        scheduleTimer(id, rec.remainingMs);
      }
    }
  }, [scheduleTimer]);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      if (isFocusedRef.current) {
        timersRef.current.set(id, {
          timerId: null,
          startedAt: Date.now(),
          remainingMs: TOAST_DURATION_MS,
        });
      } else {
        scheduleTimer(id, TOAST_DURATION_MS);
      }
    },
    [scheduleTimer],
  );

  useEffect(() => {
    const el = containerRef.current as PopoverElement | null;
    if (!el || typeof el.showPopover !== 'function' || typeof el.hidePopover !== 'function') {
      return;
    }
    try {
      if (toasts.length > 0) {
        if (!el.matches(':popover-open')) {
          el.showPopover();
        }
      } else if (el.matches(':popover-open')) {
        el.hidePopover();
      }
    } catch {
      // ignore if popover state cannot be toggled
    }
  }, [toasts.length]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const rec of timers.values()) {
        if (rec.timerId !== null) window.clearTimeout(rec.timerId);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        ref={containerRef}
        role="region"
        aria-label="Benachrichtigungen"
        aria-live="polite"
        popover="manual"
        onFocusCapture={() => {
          isFocusedRef.current = true;
          pauseAllTimers();
        }}
        onBlurCapture={(e) => {
          const nextTarget = e.relatedTarget as Node | null;
          if (!containerRef.current?.contains(nextTarget)) {
            isFocusedRef.current = false;
            resumeAllTimers();
          }
        }}
        className="pointer-events-none fixed inset-x-4 bottom-20 left-4 right-4 top-auto z-50 m-0 flex flex-col items-end gap-2 border-0 bg-transparent p-0 md:bottom-5 md:left-auto md:right-5 md:w-96"
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
                className="rounded p-1 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-fire-500"
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
