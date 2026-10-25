"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

type ViewState = "checking" | "ready" | "error";

export default function MarketplaceVerificationPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const started = useRef(false);
  const [state, setState] = useState<ViewState>("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const emailToken = new URLSearchParams(window.location.search).get("token");
    if (!emailToken) {
      setError(isFrench ? "Le lien de confirmation est incomplet." : "The confirmation link is incomplete.");
      setState("error");
      return;
    }
    void fetch("/api/marketplace/verification/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: emailToken }),
    }).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "confirmation_failed");
      setState("ready");
    }).catch(() => {
      setError(isFrench
        ? "Ce lien est invalide ou a expiré. Retournez sur la marketplace pour demander un nouveau lien."
        : "This link is invalid or expired. Return to the marketplace to request a new one.");
      setState("error");
    });
  }, [isFrench]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16">
      <div className="border-y border-midnight-border py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">
          {isFrench ? "Vérification vendeur" : "Seller verification"}
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
          {state === "checking"
            ? (isFrench ? "Confirmation de votre adresse…" : "Confirming your email…")
            : state === "ready"
              ? (isFrench ? "Adresse e-mail confirmée" : "Email address confirmed")
              : (isFrench ? "Confirmation impossible" : "Could not confirm")}
        </h1>
        {state === "checking" ? (
          <p className="mt-3 text-sm text-ink-muted">{isFrench ? "Vérification sécurisée du lien en cours." : "Securely validating your confirmation link."}</p>
        ) : state === "ready" ? (
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-muted">
            {isFrench
              ? "Votre adresse e-mail est confirmée. Retournez sur la marketplace pour choisir votre abonnement vendeur (15 $ par mois ou 180 $ par an) et activer votre accès vendeur."
              : "Your email is confirmed. Return to the marketplace to choose your seller subscription ($15 per month or $180 per year) and activate seller access."}
          </p>
        ) : (
          <p role="alert" className="mx-auto mt-3 max-w-lg text-sm leading-6 text-rose-300">{error}</p>
        )}
        {state === "ready" && error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
        <div className="mt-6">
          <Link
            href={state === "ready"
              ? { pathname: "/login", query: { callbackUrl: "/marketplace?tab=sell" } }
              : "/marketplace"}
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {state === "ready"
              ? (isFrench ? "Se connecter et continuer la configuration vendeur" : "Sign in and continue seller setup")
              : (isFrench ? "Retour à la marketplace" : "Back to the marketplace")}
          </Link>
        </div>
      </div>
    </main>
  );
}
