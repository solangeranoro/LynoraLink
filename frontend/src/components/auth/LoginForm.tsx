"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck } from "@/components/FontAwesomeIcons";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useTranslation } from "@/lib/i18n";

function getSafeCallbackUrl(value: string | null): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "https://lynoralink.invalid");
    return url.origin === "https://lynoralink.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

export function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const verified = params.get("verified") === "1";
  const oauthError = params.get("error");
  const callbackUrl = getSafeCallbackUrl(params.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requiresCode, setRequiresCode] = useState(false);
  const [code, setCode] = useState("");
  const [oauthTwoFactorToken, setOAuthTwoFactorToken] = useState<string | null>(null);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get("oauth2fa");
    if (token) {
      setOAuthTwoFactorToken(token);
      setRequiresCode(true);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    if (oauthError === "OAuthTwoFactorUnavailable") {
      setError(t("auth.errors.twoFactorUnavailable"));
    } else if (oauthError) {
      setError(null);
    }
  }, [oauthError, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!requiresCode) {
      try {
        const response = await fetch("/api/auth/2fa/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const result = await response.json();
        if (!response.ok) {
          setError(
            result.error === "rate_limited"
              ? t("auth.errors.twoFactorRateLimited")
              : result.error === "email_unavailable"
                ? t("auth.errors.twoFactorUnavailable")
                : response.status >= 500
                  ? t("auth.errors.serviceUnavailable")
                  : t("auth.errors.invalidCredentials"),
          );
          setLoading(false);
          return;
        }
        if (result.twoFactorRequired) {
          setRequiresCode(true);
          setLoading(false);
          return;
        }
      } catch (error) {
        setError(error instanceof TypeError ? t("auth.errors.networkUnavailable") : t("auth.errors.serviceUnavailable"));
        setLoading(false);
        return;
      }
    }

    let res: Awaited<ReturnType<typeof signIn>>;
    try {
      res = oauthTwoFactorToken
        ? await signIn("oauth-two-factor", { token: oauthTwoFactorToken, code, redirect: false })
        : await signIn("credentials", { email, password, code: requiresCode ? code : undefined, redirect: false });
    } catch (error) {
      setLoading(false);
      setError(error instanceof TypeError ? t("auth.errors.networkUnavailable") : t("auth.errors.serviceUnavailable"));
      return;
    }
    setLoading(false);
    if (res?.error) {
      if (res.status === 401 || res.error === "CredentialsSignin") {
        setError(requiresCode ? t("auth.errors.invalidTwoFactorCode") : t("auth.errors.invalidCredentials"));
      } else {
        setError(t("auth.errors.serviceUnavailable"));
      }
      return;
    }
    window.dispatchEvent(new Event("lynora:navigation-start"));
    let destination = callbackUrl ?? "/dashboard";
    if (!callbackUrl) {
      try {
        if (window.sessionStorage.getItem("lynora.registrationComplete") === "1") destination = "/welcome";
      } catch {
        // Continue to the dashboard when session storage is unavailable.
      }
    }
    router.push(destination);
    router.refresh();
  }

  async function resendCode() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(oauthTwoFactorToken ? "/api/auth/2fa/oauth-challenge" : "/api/auth/2fa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(oauthTwoFactorToken ? { token: oauthTwoFactorToken } : { email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error === "rate_limited" ? t("auth.errors.twoFactorRateLimited") : response.status >= 500 ? t("auth.errors.serviceUnavailable") : t("auth.errors.twoFactorUnavailable"));
      }
      else {
        setCode("");
        setError(t("auth.twoFactorCodeSent"));
      }
    } catch (error) {
      setError(error instanceof TypeError ? t("auth.errors.networkUnavailable") : t("auth.errors.serviceUnavailable"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card animate-fade-in mx-auto w-full max-w-sm p-5 sm:p-6">
      <div className="text-center">
        {requiresCode && <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold-soft"><ShieldCheck size={20} aria-hidden="true" /></div>}
        <h1 className="font-display text-xl font-semibold text-ink">{requiresCode ? t("auth.twoFactorTitle") : t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{requiresCode ? oauthTwoFactorToken ? t("auth.oauthTwoFactorSubtitle") : t("auth.twoFactorSubtitle", { email }) : t("auth.loginSubtitle")}</p>
      </div>

      {verified && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {t("auth.registrationVerifiedDescription")}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        {!requiresCode ? (
          <>
            <div>
              <label htmlFor="email" className="label">{t("auth.email")}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label mb-0">{t("auth.password")}</label>
                <Link href="/forgot-password" className="text-xs font-medium text-gold-soft hover:text-gold">{t("auth.forgotPassword")}</Link>
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10 pr-11" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="two-factor-code" className="label">{t("auth.twoFactorCodeLabel")}</label>
            <input id="two-factor-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="input text-center font-mono text-xl tracking-[0.3em]" placeholder="000000" />
          </div>
        )}

        {error && <p role="status" className={`text-sm ${error === t("auth.twoFactorCodeSent") ? "text-emerald-300" : "text-red-400"}`}>{error}</p>}

        {requiresCode && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button type="button" onClick={() => { setRequiresCode(false); setOAuthTwoFactorToken(null); setCode(""); setError(null); }} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"><ArrowLeft size={14} aria-hidden="true" />{t("auth.twoFactorBack")}</button>
            <button type="button" onClick={() => void resendCode()} disabled={loading} className="font-medium text-gold-soft hover:text-gold-bright disabled:opacity-50">{t("auth.twoFactorResend")}</button>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-gold w-full">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {requiresCode ? t("auth.twoFactorVerify") : t("auth.login")}
        </button>
      </form>

      {!requiresCode && (
        <OAuthButtons callbackUrl={callbackUrl ?? "/dashboard"} />
      )}

      {!requiresCode && <p className="mt-5 text-center text-sm text-ink-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-gold-soft hover:text-gold">
          {t("auth.register")}
        </Link>
      </p>}
    </div>
  );
}

export default LoginForm;
