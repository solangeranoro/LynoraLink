"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CopilotLoadingScreen } from "@/components/CopilotLoadingScreen";

type CopilotNavigationContextValue = { showCopilotSplash: () => void };

const CopilotNavigationContext = createContext<CopilotNavigationContextValue | null>(null);

export function CopilotNavigationLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const startPathRef = useRef(pathname);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showCopilotSplash = useCallback(() => {
    if (pathname === "/copilot" || pathname.startsWith("/copilot/")) return;
    startPathRef.current = pathname;
    clearTimer();
    setIsVisible(true);
    timerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      timerRef.current = null;
    }, 8000);
  }, [clearTimer, pathname]);

  useEffect(() => {
    if (!isVisible) return;
    if (pathname === "/copilot" || pathname.startsWith("/copilot/")) {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setIsVisible(false);
        timerRef.current = null;
      }, 1100);
    } else if (pathname !== startPathRef.current) {
      clearTimer();
      setIsVisible(false);
    }
    return clearTimer;
  }, [clearTimer, isVisible, pathname]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <CopilotNavigationContext.Provider value={{ showCopilotSplash }}>
      {children}
      {isVisible ? <CopilotLoadingScreen /> : null}
    </CopilotNavigationContext.Provider>
  );
}

export function useCopilotNavigationLoader() {
  const context = useContext(CopilotNavigationContext);
  if (!context) throw new Error("useCopilotNavigationLoader must be used within CopilotNavigationLoader");
  return context;
}
