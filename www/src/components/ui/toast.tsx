'use client';

import * as React from 'react';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [newToast, ...prev]);

    if (toast.duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 3000);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 p-3 rounded-lg shadow-lg border backdrop-blur-md animate-in slide-in-from-top-2 fade-in duration-300",
            toast.type === 'success' && "bg-emerald-950/90 border-emerald-500/20 text-emerald-200",
            toast.type === 'error' && "bg-red-950/90 border-red-500/20 text-red-200",
            toast.type === 'info' && "bg-zinc-900/90 border-zinc-800 text-zinc-200"
          )}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircleIcon className="size-4 text-emerald-500" />}
            {toast.type === 'error' && <AlertCircleIcon className="size-4 text-red-500" />}
            {toast.type === 'info' && <InfoIcon className="size-4 text-blue-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold">{toast.title}</h3>
            {toast.description && (
              <p className={cn(
                "text-[11px] mt-0.5 leading-relaxed opacity-90",
                toast.type === 'success' && "text-emerald-200/70",
                toast.type === 'error' && "text-red-200/70",
                toast.type === 'info' && "text-zinc-400"
              )}>
                {toast.description}
              </p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className={cn(
              "shrink-0 p-1 rounded-md transition-colors",
              toast.type === 'success' && "hover:bg-emerald-900/50 text-emerald-400",
              toast.type === 'error' && "hover:bg-red-900/50 text-red-400",
              toast.type === 'info' && "hover:bg-zinc-800 text-zinc-500"
            )}
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
