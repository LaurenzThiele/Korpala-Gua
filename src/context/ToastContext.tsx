import { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  hiding: boolean;
}

let _nextId = 0;

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++_nextId;
    setToasts(prev => [...prev, { id, message, type, hiding: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 250);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-6 right-5 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={[
              'flex items-center gap-3 pl-4 pr-5 py-3 rounded-xl text-sm shadow-2xl border min-w-[260px]',
              toast.type === 'error'
                ? 'bg-[#1a0c0c] border-[#3a1515] text-[#ededed]'
                : 'bg-[#0c1a0c] border-[#153a15] text-[#ededed]',
              toast.hiding ? 'animate-toast-out' : 'animate-toast-in',
            ].join(' ')}
          >
            <span className={`text-sm flex-none leading-none ${toast.type === 'error' ? 'text-brand-red' : 'text-green-400'}`}>
              {toast.type === 'error' ? '✕' : '✓'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
