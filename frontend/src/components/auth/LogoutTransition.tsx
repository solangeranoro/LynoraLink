"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "@/components/FontAwesomeIcons";
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
      <div className="logout-screen fixed inset-0 z-[200] flex items-center justify-center bg-midnight-deep/95 px-6 text-center backdrop-blur-xl" role="status" aria-live="polite" aria-busy="true">
        <div className="w-full max-w-xs">
          <div className="relative mx-auto mb-7 grid h-20 w-20 place-items-center rounded-full border border-gold/20 bg-gold/5">
            <span className="logout-ring absolute inset-0 rounded-full border border-gold/20 border-t-gold-soft" aria-hidden="true" />
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold/10 text-gold-soft">
              <LogOut size={22} aria-hidden="true" />
            </span>
          </div>
          <Logo size={30} withWordmark className="justify-center" />
          <h1 className="mt-7 font-display text-xl font-semibold text-ink">{t("auth.logoutTransitionTitle")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("auth.logoutTransitionDescription")}</p>
          <div className="mt-7 h-1 overflow-hidden rounded-full bg-midnight-border" aria-hidden="true">
            <span className="logout-progress block h-full w-full origin-left rounded-full bg-gradient-to-r from-emerald-400 to-gold-bright" />
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return { logout, overlay };
}