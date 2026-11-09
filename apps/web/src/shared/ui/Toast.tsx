'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type ToastTone = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++nextId.current;
    setItems(list => [...list, { id, message, tone }]);
    window.setTimeout(() => setItems(list => list.filter(item => item.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end print:!hidden">
        {items.map(item => (
          <div key={item.id} role="status" className="pointer-events-auto flex max-w-sm animate-pop-in items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-pop">
            {item.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-sage-200" aria-hidden />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" aria-hidden />
            )}
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
