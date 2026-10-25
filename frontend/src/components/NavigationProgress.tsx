"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export function NavigationProgress() {
  const { locale } = useTranslation();
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const active = useRef(false);
  const interval = useRef<number | null>(null);
  const finishTimeout = useRef<number | null>(null);
  const fallbackTimeout = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const finishProgress = useCallback(() => {
    if (interval.current !== null) window.clearInterval(interval.current);
    if (fallbackTimeout.current !== null) window.clearTimeout(fallbackTimeout.current);
    interval.current = null;
    fallbackTimeout.current = null;
    active.current = false;
    setProgress(100);
    finishTimeout.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      finishTimeout.current = null;
    }, 280);
  }, []);

  const startProgress = useCallback(() => {
    if (finishTimeout.current !== null) window.clearTimeout(finishTimeout.current);
    finishTimeout.current = null;
    if (!active.current) {
      active.current = true;
      setVisible(true);
      setProgress(8);
    }
    if (interval.current === null) {
      interval.current = window.setInterval(() => {
        setProgress((current) => Math.min(90, current + Math.max(1, (90 - current) * 0.08)));
      }, 180);
    }
    if (fallbackTimeout.current !== null) window.clearTimeout(fallbackTimeout.current);
    fallbackTimeout.current = window.setTimeout(finishProgress, 12_000);
  }, [finishProgress]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      startProgress();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("lynora:navigation-start", startProgress);
    window.addEventListener("popstate", startProgress);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("lynora:navigation-start", startProgress);
      window.removeEventListener("popstate", startProgress);
    };
  }, [startProgress]);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!active.current) startProgress();
    finishProgress();
  }, [pathname, finishProgress, startProgress]);

  useEffect(() => () => {
    if (interval.current !== null) window.clearInterval(interval.current);
    if (finishTimeout.current !== null) window.clearTimeout(finishTimeout.current);
    if (fallbackTimeout.current !== null) window.clearTimeout(fallbackTimeout.current);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[10000] h-1 bg-midnight-border/70"
      role="progressbar"
      aria-label={locale === "fr" ? "Chargement de la page" : "Loading page"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-full shadow-[0_0_10px_rgb(var(--navigation-progress)/0.9)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{
          width: `${progress}%`,
          backgroundImage: "linear-gradient(to right, rgb(var(--button-primary)), rgb(var(--navigation-progress)))",
        }}
      />
    </div>
  );
}