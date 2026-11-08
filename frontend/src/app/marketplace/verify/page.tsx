"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Check } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

type ViewState = "checking" | "ready" | "error";
const VERIFICATION_CONFIRMED_STORAGE_KEY = "lynora:marketplace-verification-confirmed";

export default function MarketplaceVerificationPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const started = useRef(false);
  const [state, setState] = useState<ViewState>("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError(isFrench ? "Le lien de confirmation est incomplet." : "The confirmation link is incomplete.");
      setState("error");
      return;
    }

    void fetch("/api/marketplace/verification/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "confirmation_failed");
      setState("ready");
      try {
        window.localStorage.setItem(VERIFICATION_CONFIRMED_STORAGE_KEY, String(Date.now()));
      } catch (storageError) {
        console.warn("Could not notify the seller workspace about email confirmation:", storageError);
      }
    }).catch(() => {
      setError(isFrench
        ? "Ce lien est invalide ou a expiré. Retournez sur la marketplace pour demander un nouveau lien."
        : "This link is invalid or expired. Return to the marketplace to request a new one.");
      setState("error");
    });
  }, [isFrench]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-midnight-border bg-midnight-card shadow-2xl shadow-black/20">
        <div className="h-1 bg-gradient-to-r from-emerald-500/30 via-emerald-400 to-gold/50" />
        <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
          {state === "ready" ? (
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_40px_rgba(52,211,153,0.12)]">
              <span className="relative grid h-12 w-12 place-items-center rounded-full bg-emerald-400 text-midnight-deep">
                <Check size={25} aria-hidden="true" />
                <BadgeCheck size={21} className="absolute -bottom-2 -right-3 rounded-full bg-midnight-card text-emerald-300" aria-hidden="true" />
              </span>
            </div>
          ) : state === "error" ? (
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-rose-300/25 bg-rose-400/10 text-rose-300" aria-hidden="true">
              <span className="text-3xl font-semibold">!</span>
            </div>
          ) : (
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gold/20 border-t-gold" role="status" aria-label={isFrench ? "Vérification en cours" : "Verification in progress"} />
          )}
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-gold-soft">
            {isFrench ? "Vérification vendeur" : "Seller verification"}
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {state === "checking"
              ? (isFrench ? "Confirmation de votre adresse…" : "Confirming your email…")
              : state === "ready"
                ? (isFrench ? "Votre compte vendeur est vérifié" : "Your seller account is verified")
                : (isFrench ? "Confirmation impossible" : "Could not confirm")}
          </h1>
          {state === "checking" ? (
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">{isFrench ? "Nous vérifions votre lien de confirmation de manière sécurisée." : "We’re securely validating your confirmation link."}</p>
          ) : state === "ready" ? (
            <>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
                {isFrench
                  ? "La vérification de votre compte vendeur est terminée. L’espace vendeur déjà ouvert dans l’autre onglet sera actualisé automatiquement."
                  : "Your seller account verification is complete. The seller workspace open in your other tab will update automatically."}
              </p>
              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/5 px-4 py-2 text-sm font-medium text-emerald-200">
                <Check size={15} aria-hidden="true" />
                {isFrench ? "Vous pouvez fermer cet onglet" : "You can close this tab"}
              </div>
            </>
          ) : (
            <p role="alert" className="mx-auto mt-3 max-w-md text-sm leading-6 text-rose-300">{error}</p>
          )}
        </div>
      </section>
    </main>
  );
}
