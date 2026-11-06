"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, KeyRound, Loader2, Mail, MailCheck, ShieldCheck } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error" | "network" | "unavailable">("idle");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      setStatus(response.ok && result.ok ? "sent" : response.status >= 500 ? "unavailable" : "error");
    } catch {
      setStatus("network");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-8 py-5 md:grid-cols-[1fr_0.9fr] md:items-center md:gap-14">
      <div className="animate-slide-left px-1 md:px-0">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold-soft">
          <KeyRound size={22} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("auth.forgotEyebrow")}</p>
        <h1 className="mt-2 max-w-lg font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{t("auth.forgotTitle")}</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-ink-muted">{t("auth.forgotDescription")}</p>
        <div className="mt-7 flex items-start gap-3 border-t border-midnight-border pt-5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
          <p className="max-w-sm text-xs leading-5 text-ink-muted">{t("auth.forgotSecurityNote")}</p>
        </div>
      </div>

      <div className="card animate-slide-left p-5 sm:p-7">
        {status === "sent" ? (
          <div aria-live="polite">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <MailCheck size={22} aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-xl font-semibold text-ink">{t("auth.forgotSentTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{t("auth.forgotSentDescription", { email })}</p>
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-midnight-border bg-midnight-deep/40 p-3 text-xs leading-5 text-ink-muted">
              <Check size={15} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
              <span>{t("auth.forgotSentHint")}</span>
            </div>
            <button type="button" onClick={() => setStatus("idle")} className="btn-ghost mt-6 w-full">
              {t("auth.forgotUseAnotherEmail")}<ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("auth.forgotFormEyebrow")}</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{t("auth.resetTitle")}</h2>
              <p className="mt-1 text-sm leading-5 text-ink-muted">{t("auth.resetSubtitle")}</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="label">{t("auth.email")}</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <input id="forgot-email" name="email" type="email" autoComplete="email" autoFocus required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setStatus("idle"); }} className="input pl-10" placeholder="you@example.com" />
                </div>
              </div>
              {status !== "idle" && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-300">{t(status === "network"
                ? "auth.errors.networkUnavailable"
                : status === "unavailable"
                  ? "auth.errors.serviceUnavailable"
                  : "auth.errors.resetRequestFailed")}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                {loading ? t("auth.resetSending") : t("auth.sendResetLink")}
              </button>
            </form>
          </>
        )}

        <Link href="/login" className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-gold-soft">
          <ArrowLeft size={15} aria-hidden="true" />{t("auth.backToLogin")}
        </Link>
      </div>
    </section>
  );
}
