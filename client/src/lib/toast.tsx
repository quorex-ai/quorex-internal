import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS = 3500;

/** Retour visuel court apres une action : rien de bloquant, rien de modal. */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;

      setToasts((current) => [...current.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), VISIBLE_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              role="status"
              className={[
                'pointer-events-auto flex items-center gap-3 rounded-item border px-4 py-3 text-sub',
                toast.tone === 'success'
                  ? 'border-card-line bg-card text-ink'
                  : 'border-pill-pink bg-pill-pink text-pill-pink-ink',
              ].join(' ')}
            >
              {toast.tone === 'success' ? (
                <CircleCheck size={18} strokeWidth={1.75} className="text-pill-green-ink" />
              ) : (
                <CircleAlert size={18} strokeWidth={1.75} />
              )}
              <span className="max-w-[360px]">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer"
                className="rounded-lg p-1 opacity-60 transition hover:opacity-100"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit etre utilise a l'interieur de ToastProvider.");
  return context;
}
