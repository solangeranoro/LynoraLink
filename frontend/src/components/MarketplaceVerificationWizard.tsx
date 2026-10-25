"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import * as CountryFlags from "country-flag-icons/react/3x2";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, Globe2, LockKeyhole, Mail, Search, ShieldCheck, UserRound, X } from "@/components/FontAwesomeIcons";

function CountryFlag({ code }: { code: string }) {
  const Flag = CountryFlags[code as keyof typeof CountryFlags];
  return Flag
    ? <Flag className="block h-4 w-6 rounded-[3px] object-cover shadow-sm" aria-hidden="true" />
    : <Globe2 size={15} className="text-ink-muted" aria-hidden="true" />;
}

type Props = {
  isFrench: boolean;
  email: string;
  onSubmitted: () => void;
  onCancel: () => void;
};

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  city: string;
  profession: string;
  phoneNumber: string;
};

export function MarketplaceVerificationWizard({ isFrench, email, onSubmitted, onCancel }: Props) {
  const countries = useMemo(
    () => {
      const countryNames = new Intl.DisplayNames([isFrench ? "fr" : "en"], { type: "region" });
      return getCountries()
        .map((code) => ({ code, dialCode: getCountryCallingCode(code), name: countryNames.of(code) ?? code }))
        .sort((first, second) => first.name.localeCompare(second.name, isFrench ? "fr" : "en"));
    },
    [isFrench],
  );
  const [step, setStep] = useState(0);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryPickerRef = useRef<HTMLDivElement>(null);
  const countryButtonRef = useRef<HTMLButtonElement>(null);
  const countrySearchRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email,
    countryCode: "",
    city: "",
    profession: "",
    phoneNumber: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!countryPickerOpen) {
      setCountrySearch("");
      return;
    }
    countrySearchRef.current?.focus();
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !countryPickerRef.current?.contains(event.target)) {
        setCountryPickerOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCountryPickerOpen(false);
        countryButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [countryPickerOpen]);
  const steps = [
    { label: isFrench ? "Profil" : "Profile", icon: UserRound },
    { label: isFrench ? "E-mail" : "Email", icon: Mail },
    { label: isFrench ? "Confirmation" : "Review", icon: ShieldCheck },
  ];

  function update<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function submit() {
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/marketplace/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
          email: form.email,
          country: selectedCountry?.name ?? "",
          city: form.city,
          profession: form.profession,
          phoneNumber: formattedPhoneNumber,
          locale: isFrench ? "FR" : "EN",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "verification_request_failed");
      onSubmitted();
    } catch (submitError) {
      const code = submitError instanceof Error ? submitError.message : "";
      setError(code === "VERIFICATION_EMAIL_SEND_FAILED"
        ? (isFrench ? "L’e-mail n’a pas pu être envoyé. Vérifiez la configuration e-mail puis réessayez." : "The email could not be sent. Check the email configuration and try again.")
        : code === "EMAIL_DELIVERY_NOT_CONFIGURED"
          ? (isFrench ? "L’envoi réel des e-mails n’est pas configuré sur le serveur. Contactez l’assistance." : "Email delivery is not configured on the server. Contact support.")
        : code === "VERIFICATION_EMAIL_MUST_MATCH_ACCOUNT"
          ? (isFrench ? "Utilisez l’adresse e-mail de votre compte." : "Use the email address on your account.")
          : code === "ACCOUNT_EMAIL_NOT_VERIFIED"
            ? (isFrench
              ? "Confirmez d’abord l’adresse e-mail de votre compte LynoraLink, puis revenez demander la vérification vendeur."
              : "Confirm your LynoraLink account email first, then return to request seller verification.")
            : code === "MARKETPLACE_VERIFICATION_ACTIVE"
              ? (isFrench
                ? "Un profil vendeur déjà vérifié est associé à votre compte. Actualisez la page pour ouvrir votre espace vendeur."
                : "A seller profile is already verified for your account. Refresh the page to open your seller workspace.")
          : (isFrench ? "La demande n’a pas pu être envoyée. Vérifiez les informations puis réessayez." : "The request could not be sent. Check the details and try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-midnight-border bg-midnight-deep px-3 py-2.5 text-sm text-ink outline-none transition focus:border-gold/60";
  const selectedCountry = countries.find(({ code }) => code === form.countryCode);
  const parsedPhoneNumber = selectedCountry && form.phoneNumber.trim()
    ? parsePhoneNumberFromString(form.phoneNumber, selectedCountry.code)
    : undefined;
  const formattedPhoneNumber = parsedPhoneNumber?.number ?? null;
  const identityIsValid = Boolean(form.firstName.trim())
    && Boolean(form.lastName.trim())
    && Boolean(selectedCountry)
    && Boolean(form.city.trim())
    && Boolean(form.profession.trim());
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const phoneIsValid = !form.phoneNumber.trim() || Boolean(parsedPhoneNumber?.isValid());
  const filteredCountries = countries.filter(({ code, dialCode, name }) => {
    const query = countrySearch.trim().toLocaleLowerCase(isFrench ? "fr" : "en");
    return !query
      || name.toLocaleLowerCase(isFrench ? "fr" : "en").includes(query)
      || code.toLowerCase().includes(query)
      || `+${dialCode}`.includes(query);
  });

  return (
    <section className="mx-auto mt-7 max-w-2xl rounded-2xl border border-midnight-border bg-midnight-card shadow-card" aria-labelledby="seller-verification-title">
      <div className="relative overflow-hidden border-b border-midnight-border bg-midnight-deep/40 bg-[radial-gradient(ellipse_at_top_right,rgba(8,111,88,0.18),transparent_55%)] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-soft shadow-[0_0_28px_rgba(8,111,88,0.14)]">
              <span className="relative grid h-7 w-7 place-items-center rounded-full border border-gold/35 bg-midnight-deep/70">
                <UserRound size={14} aria-hidden="true" />
                <BadgeCheck size={12} className="absolute -bottom-1 -right-1 rounded-full bg-midnight-card text-emerald-300" aria-hidden="true" />
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-soft">{isFrench ? "Vérification du compte vendeur" : "Seller account verification"}</p>
              <h3 id="seller-verification-title" className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
                {isFrench ? "Vérifiez votre profil" : "Verify your profile"}
              </h3>
              <p className="mt-1 text-sm leading-5 text-ink-muted">
                {isFrench ? "Complétez ces étapes pour obtenir votre badge vendeur." : "Complete these steps to receive your seller badge."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onCancel} aria-label={isFrench ? "Fermer le formulaire" : "Close verification form"} className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-ink-muted transition hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
            {isFrench ? "Fermer" : "Close"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 text-[11px] font-medium text-gold-soft">
            <Check size={12} aria-hidden="true" />{isFrench ? "15 $ / mois ou 180 $ / an" : "$15 / month or $180 / year"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-midnight-border bg-midnight-card/50 px-2.5 py-1 text-[11px] text-ink-muted">
            <LockKeyhole size={11} aria-hidden="true" />{isFrench ? "Confirmation sécurisée par e-mail" : "Secure email confirmation"}
          </span>
        </div>

        <ol className="mt-6 grid grid-cols-3 gap-2 sm:gap-4" aria-label={isFrench ? "Étapes du formulaire" : "Form steps"}>
          {steps.map(({ label, icon: Icon }, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined} className="min-w-0">
              <div className={`mb-2 h-1 rounded-full ${index <= step ? "bg-gold" : "bg-midnight-border"}`} />
              <div className={`flex min-w-0 items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs ${index === step ? "font-semibold text-gold-soft" : index < step ? "text-ink" : "text-ink-muted"}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${index < step ? "border-gold bg-gold text-midnight-deep" : index === step ? "border-gold/60 bg-gold/10 text-gold-soft" : "border-midnight-border"}`}>
                  {index < step ? <Check size={12} aria-hidden="true" /> : <Icon size={12} aria-hidden="true" />}
                </span>
                <span className="truncate">{label}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="p-5 sm:p-7">
        <div key={step} className="animate-slide-left" aria-live="polite">
          {step === 0 ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-soft">{isFrench ? "Étape 1 · Profil" : "Step 1 · Profile"}</p>
              <h4 className="mt-1 font-display text-lg font-semibold text-ink">{isFrench ? "Vos informations professionnelles" : "Your professional details"}</h4>
              <p className="mt-1 text-sm leading-5 text-ink-muted">{isFrench ? "Utilisez les informations qui vous représentent auprès des acheteurs." : "Share the details buyers will see on your seller profile."}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label htmlFor="verification-first-name" className="text-sm font-medium text-ink">
                  {isFrench ? "Prénom" : "First name"} <span className="text-rose-300" aria-hidden="true">*</span>
                  <input id="verification-first-name" autoComplete="given-name" required maxLength={60} value={form.firstName} onChange={(event) => update("firstName", event.target.value)} className={inputClass} />
                </label>
                <label htmlFor="verification-last-name" className="text-sm font-medium text-ink">
                  {isFrench ? "Nom de famille" : "Last name"} <span className="text-rose-300" aria-hidden="true">*</span>
                  <input id="verification-last-name" autoComplete="family-name" required maxLength={60} value={form.lastName} onChange={(event) => update("lastName", event.target.value)} className={inputClass} />
                </label>
                <div className="text-sm font-medium text-ink">
                  <label id="verification-country-label" htmlFor="verification-country" className="block">
                    {isFrench ? "Pays de résidence" : "Country of residence"} <span className="text-rose-300" aria-hidden="true">*</span>
                  </label>
                  <div ref={countryPickerRef} className="relative mt-1.5">
                    <button
                      ref={countryButtonRef}
                      id="verification-country"
                      type="button"
                      aria-labelledby="verification-country-label"
                      aria-haspopup="listbox"
                      aria-expanded={countryPickerOpen}
                      aria-controls="verification-country-options"
                      onClick={() => setCountryPickerOpen((open) => !open)}
                      className={`${inputClass} mt-0 flex min-h-11 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-gold/40`}
                    >
                      <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-midnight-border bg-midnight-card text-lg" aria-hidden="true">
                        {selectedCountry ? <CountryFlag code={selectedCountry.code} /> : <Globe2 size={15} className="text-ink-muted" />}
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${selectedCountry ? "text-ink" : "text-ink-muted"}`}>
                        {selectedCountry
                          ? selectedCountry.name
                          : (isFrench ? "Choisir un pays" : "Choose a country")}
                      </span>
                      {selectedCountry && <span className="shrink-0 rounded-md bg-midnight-card px-2 py-1 text-xs tabular-nums text-ink-muted">+{selectedCountry.dialCode}</span>}
                      <ChevronDown size={14} className={`shrink-0 text-ink-muted transition-transform ${countryPickerOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {countryPickerOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card shadow-2xl shadow-black/40">
                        <div className="border-b border-midnight-border bg-midnight-deep/70 p-2.5">
                          <div className="relative">
                            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                            <input
                              ref={countrySearchRef}
                              type="search"
                              value={countrySearch}
                              onChange={(event) => setCountrySearch(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "ArrowDown") {
                                  event.preventDefault();
                                  countryPickerRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
                                }
                              }}
                              placeholder={isFrench ? "Rechercher un pays ou un indicatif…" : "Search countries or calling codes…"}
                              aria-label={isFrench ? "Rechercher un pays" : "Search countries"}
                              className="h-10 w-full rounded-xl border border-midnight-border bg-midnight-card pl-9 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-gold/60"
                            />
                            {countrySearch && (
                              <button type="button" onClick={() => setCountrySearch("")} aria-label={isFrench ? "Effacer la recherche" : "Clear search"} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink">
                                <X size={12} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div id="verification-country-options" role="listbox" aria-labelledby="verification-country-label" className="max-h-64 overflow-y-auto p-1.5">
                          {filteredCountries.length ? filteredCountries.map(({ code, dialCode, name }) => (
                            <button
                              key={code}
                              type="button"
                              role="option"
                              aria-selected={form.countryCode === code}
                              onClick={() => {
                                update("countryCode", code);
                                setCountryPickerOpen(false);
                                countryButtonRef.current?.focus();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "ArrowDown") {
                                  event.preventDefault();
                                  (event.currentTarget.nextElementSibling as HTMLButtonElement | null)?.focus();
                                } else if (event.key === "ArrowUp") {
                                  event.preventDefault();
                                  const previous = event.currentTarget.previousElementSibling;
                                  if (previous instanceof HTMLButtonElement) previous.focus();
                                  else countrySearchRef.current?.focus();
                                } else if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  update("countryCode", code);
                                  setCountryPickerOpen(false);
                                }
                              }}
                              className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none ${form.countryCode === code ? "bg-gold/10 text-gold-soft" : "text-ink"}`}
                            >
                              <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-midnight-border bg-midnight-deep" aria-hidden="true"><CountryFlag code={code} /></span>
                              <span className="min-w-0 flex-1 truncate">{name}</span>
                              <span className="shrink-0 text-xs tabular-nums text-ink-muted">+{dialCode}</span>
                              {form.countryCode === code && <Check size={13} className="shrink-0" aria-hidden="true" />}
                            </button>
                          )) : (
                            <p className="px-3 py-8 text-center text-sm text-ink-muted">{isFrench ? "Aucun pays correspondant." : "No matching country."}</p>
                          )}
                        </div>
                        <div className="border-t border-midnight-border px-3 py-2 text-[10px] text-ink-muted">
                          {isFrench ? `${filteredCountries.length} pays disponibles` : `${filteredCountries.length} countries available`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <label htmlFor="verification-city" className="text-sm font-medium text-ink">
                  {isFrench ? "Ville" : "City"} <span className="text-rose-300" aria-hidden="true">*</span>
                  <input id="verification-city" autoComplete="address-level2" required maxLength={100} value={form.city} onChange={(event) => update("city", event.target.value)} className={inputClass} />
                </label>
                <label htmlFor="verification-profession" className="text-sm font-medium text-ink">
                  {isFrench ? "Profession ou activité" : "Profession or business activity"} <span className="text-rose-300" aria-hidden="true">*</span>
                  <input id="verification-profession" required maxLength={120} value={form.profession} onChange={(event) => update("profession", event.target.value)} className={inputClass} />
                </label>
                <label htmlFor="verification-phone" className="text-sm font-medium text-ink">
                  {isFrench ? "Numéro de téléphone" : "Phone number"}
                  <span className="ml-1 text-xs font-normal text-ink-muted">{isFrench ? "(facultatif)" : "(optional)"}</span>
                  <span className="mt-1.5 flex min-w-0 overflow-hidden rounded-xl border border-midnight-border bg-midnight-deep transition focus-within:border-gold/60">
                    <span className="flex shrink-0 items-center gap-2 border-r border-midnight-border px-3 text-sm text-ink-muted">
                      {selectedCountry ? <><CountryFlag code={selectedCountry.code} /><span>+{selectedCountry.dialCode}</span></> : <span>+—</span>}
                    </span>
                    <input
                      id="verification-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={24}
                      value={form.phoneNumber}
                      onChange={(event) => update("phoneNumber", event.target.value)}
                      placeholder={isFrench ? "6 12 34 56 78" : "555 123 4567"}
                      disabled={!selectedCountry}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </span>
                  <span className="mt-1.5 block text-xs font-normal text-ink-muted">
                    {selectedCountry
                      ? (isFrench ? `Indicatif +${selectedCountry.dialCode} défini selon le pays sélectionné.` : `Country code +${selectedCountry.dialCode} set from your selected country.`)
                      : (isFrench ? "Sélectionnez un pays pour définir automatiquement l’indicatif." : "Select a country to set the calling code automatically.")}
                  </span>
                  {!phoneIsValid && <span role="alert" className="mt-1 block text-xs font-normal text-rose-300">{isFrench ? "Vérifiez le numéro et l’indicatif du pays." : "Check the phone number and country calling code."}</span>}
                </label>
              </div>
            </>
          ) : step === 1 ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-soft">{isFrench ? "Étape 2 · E-mail" : "Step 2 · Email"}</p>
              <h4 className="mt-1 font-display text-lg font-semibold text-ink">{isFrench ? "Confirmez votre adresse e-mail" : "Confirm your email address"}</h4>
              <p className="mt-1 text-sm leading-5 text-ink-muted">{isFrench ? "Nous vous enverrons un lien sécurisé pour confirmer que cette adresse vous appartient." : "We’ll send a secure link so you can confirm you own this email address."}</p>
              <label htmlFor="verification-account-email" className="mt-5 block text-sm font-medium text-ink">
                {isFrench ? "E-mail de votre compte LynoraLink" : "Your LynoraLink account email"}
                <input id="verification-account-email" type="email" autoComplete="email" readOnly maxLength={254} value={form.email} className={`${inputClass} cursor-not-allowed opacity-80`} />
              </label>
              <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-ink-muted">
                <LockKeyhole size={13} className="shrink-0 text-gold-soft" aria-hidden="true" />
                {isFrench ? "Cette adresse est liée à votre compte et ne peut pas être remplacée ici." : "This address is tied to your account and cannot be changed here."}
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-soft">{isFrench ? "Étape 3 · Confirmation" : "Step 3 · Review"}</p>
              <h4 className="mt-1 font-display text-lg font-semibold text-ink">{isFrench ? "Vérifiez votre demande" : "Review your request"}</h4>
              <p className="mt-1 text-sm leading-5 text-ink-muted">{isFrench ? "Vérifiez les informations avant de recevoir votre lien de confirmation." : "Check your details before requesting your confirmation link."}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: isFrench ? "Prénom" : "First name", value: form.firstName },
                  { label: isFrench ? "Nom de famille" : "Last name", value: form.lastName },
                  { label: isFrench ? "E-mail du compte" : "Account email", value: form.email },
                  { label: isFrench ? "Pays et ville" : "Country and city", value: `${selectedCountry?.name ?? ""}, ${form.city}` },
                  { label: isFrench ? "Profession / activité" : "Profession / activity", value: form.profession },
                  ...(formattedPhoneNumber ? [{ label: isFrench ? "Téléphone" : "Phone", value: formattedPhoneNumber }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="min-w-0 rounded-xl border border-midnight-border bg-midnight-deep/40 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3.5">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
                <p className="text-xs leading-5 text-ink-muted">
                  {isFrench
                    ? "Après confirmation de votre e-mail, choisissez votre abonnement vendeur : 15 $ par mois ou 180 $ par an. Votre accès vendeur sera activé après le paiement. Aucune commission n’est prélevée sur vos ventes."
                    : "After confirming your email, choose a seller subscription: $15 per month or $180 per year. Seller access is enabled after payment. No platform commission is taken from your sales."}
                </p>
              </div>
            </>
          )}
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 px-3.5 py-3 text-sm text-rose-300">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-midnight-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => step === 0 ? onCancel() : setStep((current) => current - 1)} className="btn-ghost min-h-11 justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
            {step === 0 ? (isFrench ? "Annuler" : "Cancel") : <><ArrowLeft size={14} aria-hidden="true" />{isFrench ? "Retour" : "Back"}</>}
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => { setError(""); setStep((current) => current + 1); }}
              disabled={step === 0 ? !identityIsValid || !phoneIsValid : !emailIsValid}
              className="btn-primary min-h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:w-auto"
            >
              {isFrench ? "Continuer" : "Continue"} <ArrowRight size={14} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={() => void submit()} disabled={isSubmitting} className="btn-primary min-h-11 w-full justify-center disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:w-auto">
              {isSubmitting
                ? (isFrench ? "Envoi en cours…" : "Sending…")
                : <><Mail size={14} aria-hidden="true" />{isFrench ? "Recevoir mon lien de vérification" : "Send my verification link"}</>}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
