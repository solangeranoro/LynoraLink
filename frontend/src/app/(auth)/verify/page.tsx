"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, AlertTriangle } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

function VerifyInner() {
  const { t, locale } = useTranslation();
  const isFrench = locale === "fr";
  const status = useSearchParams().get("status");
  const isError = status === "invalid" || status === "expired";

  return (
    <div className="card animate-fade-in mx-auto w-full max-w-md p-7 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
        {isError ? <AlertTriangle className="h-7 w-7 text-amber-400" /> : <MailCheck className="h-7 w-7 text-gold" />}
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {t("auth.verifyTitle")}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {t("auth.verifySubtitle")}
      </p>
      <Link
        href={{ pathname: "/login", query: { callbackUrl: "/marketplace?tab=sell" } }}
        className="btn-gold mt-6 w-full"
      >
        {isFrench ? "Se connecter et continuer la vérification vendeur" : "Sign in and continue seller verification"}
      </Link>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 w-full rounded-xl" />}>
      <VerifyInner />
    </Suspense>
  );
}
