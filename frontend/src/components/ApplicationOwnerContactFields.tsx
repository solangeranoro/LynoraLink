"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import * as CountryFlags from "country-flag-icons/react/3x2";
import { ChevronDown, Globe2, Search, X } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

function CountryFlag({ code }: { code: string }) {
  const Flag = CountryFlags[code as keyof typeof CountryFlags];
  return Flag
    ? <Flag className="block h-4 w-6 rounded-[3px] object-cover shadow-sm" aria-hidden="true" />
    : <Globe2 size={15} className="text-ink-muted" aria-hidden="true" />;
}

type Props = {
  idPrefix: string;
  countryLabel: string;
  phoneLabel: string;
  defaultCountry?: string;
  defaultPhone?: string | null;
};

export function ApplicationOwnerContactFields({
  idPrefix,
  countryLabel,
  phoneLabel,
  defaultCountry = "",
  defaultPhone = "",
}: Props) {
  const { locale } = useTranslation();
  const countryNames = useMemo(() => ({
    en: new Intl.DisplayNames(["en"], { type: "region" }),
    fr: new Intl.DisplayNames(["fr"], { type: "region" }),
  }), []);
  const countries = useMemo(() => getCountries()
    .map((code) => ({
      code,
      dialCode: getCountryCallingCode(code),
      name: countryNames[locale].of(code) ?? code,
      englishName: countryNames.en.of(code) ?? code,
      frenchName: countryNames.fr.of(code) ?? code,
    }))
    .sort((first, second) => first.name.localeCompare(second.name, locale)), [countryNames, locale]);
  const initialCountryCode = useMemo(() => {
    const normalized = defaultCountry.trim().toLocaleLowerCase();
    return countries.find(({ code, name, englishName, frenchName }) => (
      [code, name, englishName, frenchName].some((value) => value.toLocaleLowerCase() === normalized)
    ))?.code ?? "";
  }, [countries, defaultCountry]);
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [phoneNumber, setPhoneNumber] = useState(() => {
    if (!defaultPhone) return "";
    const parsedPhone = parsePhoneNumberFromString(defaultPhone);
    if (parsedPhone) return parsedPhone.nationalNumber;
    return defaultPhone;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedCountry = countries.find(({ code }) => code === countryCode);
  const parsedPhone = selectedCountry && phoneNumber.trim()
    ? parsePhoneNumberFromString(phoneNumber, selectedCountry.code)
    : undefined;
  const normalizedPhone = phoneNumber.trim()
    ? parsedPhone?.number ?? `${selectedCountry ? `+${selectedCountry.dialCode} ` : ""}${phoneNumber.trim()}`
    : "";
  const filteredCountries = countries.filter(({ code, dialCode, name, englishName, frenchName }) => {
    const query = search.trim().toLocaleLowerCase(locale);
    return !query
      || [name, englishName, frenchName, code].some((value) => value.toLocaleLowerCase(locale).includes(query))
      || `+${dialCode}`.includes(query);
  });

  useEffect(() => {
    if (!pickerOpen) {
      setSearch("");
      return;
    }
    searchRef.current?.focus();
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) setPickerOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);
        pickerButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pickerOpen]);

  return (
    <>
      <div className="text-sm font-medium text-ink" data-application-owner-country>
        <label id={`${idPrefix}-country-label`} htmlFor={`${idPrefix}-country`} className="mb-1.5 block">
          {countryLabel} <span className="text-rose-300" aria-hidden="true">*</span>
        </label>
        <input type="hidden" name="ownerCountry" value={selectedCountry?.name ?? ""} />
        <div ref={pickerRef} className="relative">
          <button
            ref={pickerButtonRef}
            id={`${idPrefix}-country`}
            type="button"
            aria-labelledby={`${idPrefix}-country-label`}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-controls={`${idPrefix}-country-options`}
            onClick={() => setPickerOpen((open) => !open)}
            className="input flex min-h-12 w-full items-center gap-3 text-left"
          >
            <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-midnight-border bg-midnight-card text-lg" aria-hidden="true">
              {selectedCountry ? <CountryFlag code={selectedCountry.code} /> : <Globe2 size={15} className="text-ink-muted" />}
            </span>
            <span className={`min-w-0 flex-1 truncate ${selectedCountry ? "text-ink" : "text-ink-muted"}`}>
              {selectedCountry?.name ?? (locale === "fr" ? "Choisir un pays" : "Choose a country")}
            </span>
            {selectedCountry && <span className="shrink-0 rounded-md bg-midnight-card px-2 py-1 text-xs tabular-nums text-ink-muted">+{selectedCountry.dialCode}</span>}
            <ChevronDown size={14} className={`shrink-0 text-ink-muted transition-transform ${pickerOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {pickerOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card shadow-2xl shadow-black/40">
              <div className="border-b border-midnight-border bg-midnight-deep/70 p-2.5">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        pickerRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
                      }
                    }}
                    placeholder={locale === "fr" ? "Rechercher un pays ou un indicatif…" : "Search countries or calling codes…"}
                    aria-label={locale === "fr" ? "Rechercher un pays" : "Search countries"}
                    className="h-10 w-full rounded-xl border border-midnight-border bg-midnight-card pl-9 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-emerald-300/50"
                  />
                  {search && <button type="button" onClick={() => setSearch("")} aria-label={locale === "fr" ? "Effacer la recherche" : "Clear search"} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink"><X size={12} aria-hidden="true" /></button>}
                </div>
              </div>
              <div id={`${idPrefix}-country-options`} role="listbox" aria-labelledby={`${idPrefix}-country-label`} className="max-h-64 overflow-y-auto p-1.5">
                {filteredCountries.length ? filteredCountries.map(({ code, dialCode, name }) => (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={countryCode === code}
                    onClick={() => {
                      setCountryCode(code);
                      setPickerOpen(false);
                      pickerButtonRef.current?.focus();
                    }}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none ${countryCode === code ? "bg-emerald-300/10 text-emerald-100" : "text-ink"}`}
                  >
                    <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-midnight-border bg-midnight-deep" aria-hidden="true"><CountryFlag code={code} /></span>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">+{dialCode}</span>
                  </button>
                )) : <p className="px-3 py-6 text-center text-sm text-ink-muted">{locale === "fr" ? "Aucun pays trouvé." : "No countries found."}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{phoneLabel}</span>
        <span className="flex min-h-12 items-center overflow-hidden rounded-xl border border-midnight-border bg-midnight-deep/70 transition focus-within:border-emerald-300/50 focus-within:ring-2 focus-within:ring-emerald-300/15">
          <span className="flex h-12 shrink-0 items-center border-r border-midnight-border px-3 text-sm tabular-nums text-ink-muted" aria-label={selectedCountry ? `+${selectedCountry.dialCode}` : undefined}>
            {selectedCountry ? `+${selectedCountry.dialCode}` : "+—"}
          </span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            maxLength={40}
            autoComplete="tel-national"
            inputMode="tel"
            className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-muted/70"
            placeholder={locale === "fr" ? "6 12 34 56 78" : "555 123 4567"}
          />
        </span>
        <input type="hidden" name="ownerPhone" value={normalizedPhone} />
      </label>
    </>
  );
}
