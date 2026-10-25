"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock, User, AtSign, Github, Twitter, X, MapPin, Phone, CalendarRange, ShieldCheck } from "@/components/FontAwesomeIcons";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useTranslation } from "@/lib/i18n";

const TOTAL_STEPS = 3;

export function RegisterForm() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    city: "",
    phoneNumber: "",
    handle: "",
    headline: "",
    bio: "",
    githubUrl: "",
    twitterUrl: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 3_500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function validateStep(step: number) {
    if (step === 1) {
      if (form.name.trim().length < 2) {
        setError(t("auth.errors.nameRequired"));
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        setError(t("auth.errors.invalidEmail"));
        return false;
      }
      if (form.password.length < 8) {
        setError(t("auth.errors.passwordMin"));
        return false;
      }
      if (form.password !== form.confirmPassword) {
        setError(t("auth.errors.passwordMismatch"));
        return false;
      }
    }

    if (step === 2) {
      if (form.handle.trim() && form.handle.trim().length < 3) {
        setError(t("auth.errors.handleMin"));
        return false;
      }
      if (form.age && (Number(form.age) < 13 || Number(form.age) > 120)) {
        setError(t("auth.errors.ageRange"));
        return false;
      }
    }

    setError(null);
    return true;
  }

  function goToNextStep() {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(step + 1, TOTAL_STEPS));
  }

  function goToPreviousStep() {
    setError(null);
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  function addSkill() {
    const value = skillInput.trim();
    if (!value || skills.includes(value) || skills.length >= 20) return;
    setSkills((s) => [...s, value]);
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkills((s) => s.filter((x) => x !== skill));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    setLoading(true);
    if (!accountCreated) {
      if (!validateStep(1) || !validateStep(2)) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            age: form.age === "" ? undefined : Number(form.age),
            phoneNumber: form.phoneNumber.trim() || undefined,
            city: form.city.trim() || undefined,
            skills,
            preferredLang: locale.toUpperCase(),
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          setLoading(false);
          if (data.error === "EMAIL_TAKEN") return setError(t("auth.errors.emailTaken"));
          if (data.error === "HANDLE_TAKEN") {
            setCurrentStep(2);
            return setError(t("auth.errors.handleTaken"));
          }
          if (data.error === "VALIDATION") return setError(t("auth.errors.registrationValidation"));
          return setError(t("auth.errors.serviceUnavailable"));
        }
        setAccountCreated(true);
        setVerificationPending(true);
        setToastMessage(t("auth.registrationWelcomeToast"));
        setNotice(data.emailSent ? t("auth.registrationCodeSent", { email: form.email }) : null);
        if (!data.emailSent) setError(t("auth.errors.registrationEmailUnavailable"));
        setLoading(false);
        return;
      } catch (error) {
        setLoading(false);
        setError(error instanceof TypeError ? t("auth.errors.networkUnavailable") : t("auth.errors.serviceUnavailable"));
        return;
      }
    }

    try {
      const verificationResponse = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code: verificationCode }),
      }).catch(() => null);
      const verificationResult = verificationResponse ? await verificationResponse.json().catch(() => ({})) : {};
      if (!verificationResponse?.ok || !verificationResult.verified) {
        setLoading(false);
        const verificationError = !verificationResponse
          ? t("auth.errors.networkUnavailable")
          : verificationResponse.status >= 500
            ? t("auth.errors.serviceUnavailable")
          : verificationResult.error === "code_expired"
            ? t("auth.errors.registrationCodeExpired")
            : verificationResult.error === "too_many_attempts"
              ? t("auth.errors.registrationCodeAttemptsExceeded")
              : t("auth.errors.invalidRegistrationCode");
        setError(verificationError);
        return;
      }
    } catch (error) {
      setLoading(false);
      setError(error instanceof TypeError ? t("auth.errors.networkUnavailable") : t("auth.errors.serviceUnavailable"));
      return;
    }
    try {
      window.sessionStorage.setItem("lynora.registrationComplete", "1");
    } catch {
      // Continue to sign-in even if session storage is unavailable.
    }
    setLoading(false);
    router.replace("/login?verified=1");
  }

  async function resendVerificationCode() {
    setResendingCode(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/register/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error === "rate_limited"
          ? t("auth.errors.registrationRateLimited")
          : response.status >= 500
            ? t("auth.errors.serviceUnavailable")
            : t("auth.errors.registrationEmailUnavailable"));
        return;
      }
      setNotice(t("auth.registrationCodeSent", { email: form.email }));
    } catch (error) {
      setError(error instanceof TypeError ? t("auth.errors.networkUnavailable") : t("auth.errors.serviceUnavailable"));
    } finally {
      setResendingCode(false);
    }
  }

  return (
    <>
      <div className="card animate-fade-in mx-auto w-full max-w-lg p-5 sm:p-7">
      <div>
        {!verificationPending && <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-soft">{t("auth.stepCounter", { current: currentStep, total: TOTAL_STEPS })}</p>}
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{verificationPending ? t("auth.registrationCodeTitle") : t("auth.registerTitle")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{verificationPending ? t("auth.registrationCodeDescription") : t("auth.registerSubtitle")}</p>
      </div>

      {!verificationPending && <div className="mt-6" aria-label={t("auth.registerTitle")}>
        <ol aria-label={t("auth.registerTitle")} className="grid grid-cols-3 gap-3">
          {(["account", "profile", "presence"] as const).map((step, index) => {
            const stepNumber = index + 1;
            const isComplete = currentStep > stepNumber;
            const isCurrent = currentStep === stepNumber;
            return <li key={step} aria-current={isCurrent ? "step" : undefined} className="min-w-0">
              <div className={`h-1 rounded-full ${currentStep >= stepNumber ? "bg-gold" : "bg-midnight-border"}`} />
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${isComplete || isCurrent ? "bg-gold/15 text-gold-soft" : "bg-midnight-card text-ink-muted"}`}>
                  {isComplete ? "✓" : stepNumber}
                </span>
                <span className={`truncate text-[11px] font-medium sm:text-xs ${isCurrent ? "text-ink" : "text-ink-muted"}`}>{t(`auth.registerSteps.${step}`)}</span>
              </div>
            </li>;
          })}
        </ol>
      </div>}

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {verificationPending && (
          <fieldset className="space-y-4">
            <legend className="sr-only">{t("auth.registrationCodeTitle")}</legend>
            <div className="grid h-12 w-12 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold-soft">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <p className="text-sm text-ink-muted">{t("auth.registrationCodeSent", { email: form.email })}</p>
            <div className="space-y-1.5">
              <label htmlFor="registration-code" className="label !normal-case !tracking-normal !text-ink">{t("auth.registrationCodeLabel")}</label>
              <input id="registration-code" name="one-time-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="input text-center font-mono text-2xl tracking-[0.4em]" placeholder="000000" aria-describedby="registration-code-help" />
              <p id="registration-code-help" className="text-xs text-ink-muted">{t("auth.registrationCodeHint")}</p>
            </div>
            <button type="button" onClick={() => void resendVerificationCode()} disabled={resendingCode || loading} className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-gold-soft hover:text-gold-bright disabled:opacity-50">
              {resendingCode ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}
              {resendingCode ? t("auth.registrationSendingCode") : t("auth.registrationResendCode")}
            </button>
          </fieldset>
        )}

        {!verificationPending && currentStep === 1 && (
          <fieldset className="space-y-4">
            <legend className="sr-only">{t("auth.accountSection")}</legend>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("auth.loginDetails")}</h2>
              <p className="text-xs text-ink-muted">{t("auth.accountDetails")}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="name" className="label !normal-case !tracking-normal !text-ink">{t("auth.name")}</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input id="name" name="name" autoComplete="name" required minLength={2} value={form.name} onChange={update("name")} className="input pl-10" placeholder="Ada Nkemi" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="label !normal-case !tracking-normal !text-ink">{t("auth.email")}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update("email")} className="input pl-10" placeholder="you@example.com" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="password" className="label !normal-case !tracking-normal !text-ink">{t("auth.password")}</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input id="password" name="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={form.password} onChange={update("password")} className="input pl-10 pr-11" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="label !normal-case !tracking-normal !text-ink">{t("auth.confirmPassword")}</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input id="confirmPassword" name="confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required value={form.confirmPassword} onChange={update("confirmPassword")} className="input pl-10 pr-11" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft" aria-label={showConfirmPassword ? "Masquer la confirmation du mot de passe" : "Afficher la confirmation du mot de passe"} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-muted">{t("auth.passwordHint")}</p>
          </fieldset>
        )}

        {!verificationPending && currentStep === 2 && (
          <fieldset className="space-y-4">
            <legend className="sr-only">{t("auth.registerSteps.profile")}</legend>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink">{t("auth.profileSection")}</h2>
                <span className="rounded-full border border-midnight-border px-2 py-0.5 text-[10px] font-medium text-ink-muted">{t("auth.profileOptionalShort")}</span>
              </div>
              <p className="text-xs text-ink-muted">{t("auth.profileDetails")}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="handle" className="label !normal-case !tracking-normal !text-ink">{t("auth.handle")}</label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input id="handle" name="username" autoComplete="username" minLength={3} value={form.handle} onChange={update("handle")} className="input pl-10" placeholder="adan" />
              </div>
              <p className="text-xs text-ink-muted">{t("auth.handleHint")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="age" className="label !normal-case !tracking-normal !text-ink">{t("auth.age")}</label>
                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input id="age" name="age" type="number" inputMode="numeric" min={13} max={120} value={form.age} onChange={update("age")} className="input pl-10" placeholder="25" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="city" className="label !normal-case !tracking-normal !text-ink">{t("auth.city")}</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input id="city" name="address-level2" autoComplete="address-level2" value={form.city} onChange={update("city")} className="input pl-10" placeholder="Paris" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phoneNumber" className="label !normal-case !tracking-normal !text-ink">{t("auth.phoneNumber")}</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" value={form.phoneNumber} onChange={update("phoneNumber")} className="input pl-10" placeholder="+33 6 12 34 56 78" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="headline" className="label !normal-case !tracking-normal !text-ink">{t("auth.headline")}</label>
              <input id="headline" name="headline" value={form.headline} onChange={update("headline")} className="input" placeholder={t("auth.headlinePlaceholder")} />
            </div>
          </fieldset>
        )}

        {!verificationPending && currentStep === 3 && (
          <fieldset className="space-y-4">
            <legend className="sr-only">{t("auth.registerSteps.presence")}</legend>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("auth.presenceTitle")}</h2>
              <p className="text-xs text-ink-muted">{t("auth.presenceDetails")}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bio" className="label !normal-case !tracking-normal !text-ink">{t("auth.bio")}</label>
              <textarea id="bio" name="bio" rows={4} value={form.bio} onChange={update("bio")} className="input resize-y" placeholder={t("auth.bioPlaceholder")} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="skillInput" className="label !normal-case !tracking-normal !text-ink">{t("auth.skills")}</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="skillInput"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  className="input"
                  placeholder={t("auth.skillsPlaceholder")}
                />
                <button type="button" onClick={addSkill} className="btn-outline shrink-0 sm:w-auto">
                  {t("auth.addSkill")}
                </button>
              </div>
              <p className="text-xs text-ink-muted">{t("auth.skillsHint")}</p>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {skills.map((skill) => (
                    <span key={skill} className="badge-gold">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} aria-label={t("auth.removeSkill", { skill })} className="ml-0.5 hover:text-gold">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="githubUrl" className="label !normal-case !tracking-normal !text-ink">{t("auth.github")}</label>
                <div className="relative">
                  <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input id="githubUrl" name="githubUrl" type="url" value={form.githubUrl} onChange={update("githubUrl")} className="input pl-10" placeholder="https://github.com/..." />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="twitterUrl" className="label !normal-case !tracking-normal !text-ink">{t("auth.twitter")}</label>
                <div className="relative">
                  <Twitter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input id="twitterUrl" name="twitterUrl" type="url" value={form.twitterUrl} onChange={update("twitterUrl")} className="input pl-10" placeholder="https://x.com/..." />
                </div>
              </div>
            </div>
          </fieldset>
        )}

        {error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-300">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-300">{notice}</p>}

        {!verificationPending && <div className="flex flex-col-reverse justify-between gap-3 border-t border-midnight-border pt-4 sm:flex-row">
          {currentStep > 1 ? (
            <button type="button" onClick={goToPreviousStep} disabled={accountCreated} className="btn-outline w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {t("common.back")}
            </button>
          ) : <span />}

          {currentStep < TOTAL_STEPS ? (
            <button type="button" onClick={goToNextStep} className="btn-gold w-full sm:min-w-36 sm:w-auto">
              {t("auth.continue")}
            </button>
          ) : (
            <button type="submit" disabled={loading} className="btn-gold w-full sm:min-w-36 sm:w-auto">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {accountCreated ? t("auth.registrationVerifyAction") : t("auth.register")}
            </button>
          )}
        </div>}

        {verificationPending && <button type="submit" disabled={loading || verificationCode.length !== 6} className="btn-gold w-full sm:min-w-36">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? t("auth.registrationVerifying") : t("auth.registrationVerifyAction")}
        </button>}
      </form>

      {!verificationPending && <OAuthButtons />}

      {!verificationPending && <p className="mt-4 text-center text-xs leading-5 text-ink-muted">
        {t("auth.registrationTermsPrefix")} {" "}
        <Link href="/terms" className="font-medium text-gold-soft underline decoration-gold/40 underline-offset-4 transition hover:text-gold-bright">
          {t("auth.registrationTermsLink")}
        </Link>{" "}{t("auth.registrationTermsSuffix")}
      </p>}

      {!verificationPending && <p className="mt-5 text-center text-sm text-ink-muted">
        {t("auth.hasAccount")} {" "}
        <Link href="/login" className="font-semibold text-gold-soft hover:text-gold">
          {t("auth.login")}
        </Link>
      </p>}
      </div>
      {toastMessage && (
        <p role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 right-4 z-[70] animate-slide-up rounded-xl border border-gold/30 bg-midnight-card px-4 py-3 text-sm text-gold-soft shadow-glow sm:left-auto sm:right-6 sm:w-fit">
          {toastMessage}
        </p>
      )}
    </>
  );
}

export default RegisterForm;
