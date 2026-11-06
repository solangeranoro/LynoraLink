"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

function ResetPasswordInner() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(!token);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(t("auth.errors.weakPassword"));
    if (password !== confirmPassword) return setError(t("auth.errors.passwordMismatch"));

    setLoading(true);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.error === "INVALID_TOKEN") setInvalidToken(true);
        else setError(result.error === "VALIDATION"
          ? t("auth.errors.weakPassword")
          : response.status >= 500
            ? t("auth.errors.serviceUnavailable")
            : t("auth.errors.resetFailed"));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t("auth.errors.networkUnavailable"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-8 py-5 md:grid-cols-[1fr_0.9fr] md:items-center md:gap-14">
      <div className="animate-slide-left px-1 md:px-0">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold-soft">
          <LockKeyhole size={21} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("auth.resetEyebrow")}</p>
        <h1 className="mt-2 max-w-lg font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{t("auth.resetPageTitle")}</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-ink-muted">{t("auth.resetPageDescription")}</p>
        <div className="mt-7 flex items-start gap-3 border-t border-midnight-border pt-5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
          <p className="max-w-sm text-xs leading-5 text-ink-muted">{t("auth.resetSecurityNote")}</p>
        </div>
      </div>

      <div className="card animate-slide-left p-5 sm:p-7">
        {success ? (
          <div aria-live="polite">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <Check size={22} aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-xl font-semibold text-ink">{t("auth.resetSuccessTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{t("auth.resetSuccessDescription")}</p>
            <Link href="/login" className="btn-gold mt-6 w-full">
              {t("auth.backToLogin")}<ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : invalidToken ? (
          <div aria-live="polite">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200">
              <KeyRound size={21} aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-xl font-semibold text-ink">{t("auth.resetInvalidTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{t("auth.resetInvalidDescription")}</p>
            <Link href="/forgot-password" className="btn-gold mt-6 w-full">
              {t("auth.requestNewResetLink")}<ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("auth.resetFormEyebrow")}</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{t("auth.resetTitle")}</h2>
              <p className="mt-1 text-sm leading-5 text-ink-muted">{t("auth.resetSubtitle")}</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-password" className="label">{t("auth.password")}</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <input id="reset-password" name="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={200} required value={password} onChange={(event) => setPassword(event.target.value)} className="input pl-10 pr-11" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft" aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">{t("auth.passwordHint")}</p>
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="label">{t("auth.confirmPassword")}</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <input id="reset-confirm-password" name="new-password-confirm" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={200} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input pl-10 pr-11" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft" aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")} aria-pressed={showConfirmPassword}>
                    {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              {error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-300">{error}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                {loading ? t("auth.resetSaving") : t("auth.resetSavePassword")}
              </button>
            </form>
          </>
        )}
        {!success && (
          <Link href="/login" className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-gold-soft">
            <ArrowLeft size={15} aria-hidden="true" />{t("auth.backToLogin")}
          </Link>
        )}
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80 w-full rounded-xl" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
