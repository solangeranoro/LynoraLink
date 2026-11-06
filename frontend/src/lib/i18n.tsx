"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import en from "@/../messages/en.json";
import fr from "@/../messages/fr.json";

export type Locale = "en" | "fr";

const dictionaries = { en, fr } as const;
type Dictionary = typeof en;

const STORAGE_KEY = "lynora.locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveKey(dict: Dictionary, key: string): string | undefined {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict) as string | undefined;
}

export function I18nProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const { data: session, status: sessionStatus } = useSession();

  // Hydratation : on récupère la langue depuis le localStorage / navigateur
  useEffect(() => {
    const stored = (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) as Locale | null;
    if (stored && (stored === "en" || stored === "fr")) {
      setLocaleState(stored);
      return;
    }
    const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
    setLocaleState(nav.startsWith("fr") ? "fr" : "en");
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.user?.preferredLang) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") return;
    const accountLocale = session.user.preferredLang === "FR" ? "fr" : "en";
    setLocaleState(accountLocale);
    window.localStorage.setItem(STORAGE_KEY, accountLocale);
  }, [sessionStatus, session?.user?.id, session?.user?.preferredLang]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    if (sessionStatus === "authenticated") {
      void fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLang: next.toUpperCase() }),
      }).catch(() => undefined);
    }
  }, [sessionStatus]);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "fr" : "en");
  }, [locale, setLocale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale] as unknown as Dictionary;
      let value = resolveKey(dict, key) ?? resolveKey(dictionaries.en as unknown as Dictionary, key) ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          value = value.replace(new RegExp(`{${k}}`, "g"), String(v));
        });
      }
      return value;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}
