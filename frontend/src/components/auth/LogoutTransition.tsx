"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n";

export function useLogoutTransition() {
  const { t } = useTranslation();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const started = useRef(false);

  async function logout() {
    if (started.current) return;
    started.current = true;
    setActive(true);

    const startedAt = Date.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      await signOut({ redirect: false });
    } catch {
      // Leave the protected area even if the sign-out request cannot finish.
    }

    const minimumDuration = reducedMotion ? 0 : 1100;
    const remaining = minimumDuration - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
    router.push("/");
  }

  const overlay = active
    ? createPortal(
      <div className="logout-screen application-theme fixed inset-0 z-[200] flex flex-col px-6 sm:px-10 lg:px-16" role="status" aria-live="polite" aria-busy="true">
        <div className="logout-ambient" aria-hidden="true">
          <span className="logout-orb logout-orb-primary" />
          <span className="logout-orb logout-orb-secondary" />
          <span className="logout-grid" />
        </div>
        <header className="relative z-10 flex items-center justify-between border-b border-white/10 py-5 sm:py-6">
          <Logo size={38} withWordmark />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b8c9e6]/65 sm:block">
            {t("auth.logoutTransitionEyebrow")}
          </span>
        </header>
        <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 py-12 md:grid-cols-[1fr_0.85fr] md:gap-16">
          <section className="max-w-xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#a2f34b]">
              <span className="mr-3 inline-block h-px w-8 align-middle bg-[#8cff00]/70" />
              {t("auth.logoutTransitionKicker")}
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              {t("auth.logoutTransitionTitle")}
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[#b8c9e6] sm:text-lg sm:leading-8">
              {t("auth.logoutTransitionDescription")}
            </p>
          </section>
          <div className="logout-emblem relative mx-auto grid aspect-square w-full max-w-[19rem] place-items-center sm:max-w-[23rem]" aria-hidden="true">
            <span className="logout-orbit logout-orbit-outer" />
            <span className="logout-orbit logout-orbit-inner" />
            <span className="logout-emblem-glow" />
            <span className="logout-emblem-core">
              <Logo size={88} />
            </span>
            <span className="logout-node logout-node-top" />
            <span className="logout-node logout-node-right" />
            <span className="logout-node logout-node-bottom" />
            <span className="logout-node logout-node-left" />
            <span className="logout-connection logout-connection-one" />
            <span className="logout-connection logout-connection-two" />
          </div>
        </main>
        <footer className="relative z-10 mx-auto w-full max-w-6xl pb-7 sm:pb-9">
          <div className="mb-3 flex items-center justify-between gap-4 text-xs">
            <span className="text-[#b8c9e6]/80">{t("auth.logoutTransitionStatus")}</span>
            <span className="inline-flex items-center gap-2 font-medium text-[#a2f34b]">
              <span className="logout-status-dot h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {t("auth.logoutTransitionInProgress")}
            </span>
          </div>
          <div className="h-px overflow-hidden bg-white/10" aria-hidden="true">
            <span className="logout-progress block h-full w-full origin-left bg-gradient-to-r from-[#0878ff] via-[#00a7ff] to-[#8cff00]" />
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-[#b8c9e6]/45">
            <span>Lynora<span className="text-[#8cff00]/70">Link</span></span>
            <span>{t("auth.logoutTransitionFooter")}</span>
          </div>
        </footer>
      </div>,
      document.body,
    )
    : null;

  return { logout, overlay };
}