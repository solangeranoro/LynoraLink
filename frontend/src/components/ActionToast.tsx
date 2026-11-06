"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastContextValue = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ActionToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((nextMessage: string) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setMessage(nextMessage);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setMessage("");
    }, 3_500);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <p role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 right-4 z-[70] animate-slide-left rounded-xl border border-gold/30 bg-midnight-card px-4 py-3 text-sm text-gold-soft shadow-glow sm:left-auto sm:right-6 sm:w-fit">
          {message}
        </p>
      )}
    </ToastContext.Provider>
  );
}

export function useActionToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useActionToast must be used within ActionToastProvider");
  return context;
}
