"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Monitor, Moon, Sun } from "@/components/FontAwesomeIcons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import {
  readAppearancePreferences,
  saveAppearancePreferences,
  type AppearancePreferences,
} from "@/lib/appearance";
import { useTranslation } from "@/lib/i18n";

export function AuthHeader() {
  const { locale } = useTranslation();
  const [appearance, setAppearance] = useState<AppearancePreferences>({ theme: "light", fontSize: "normal" });
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const isFrench = locale === "fr";
  const themeOptions = [
    { id: "light", label: isFrench ? "Clair" : "Light", icon: Sun },
    { id: "system", label: isFrench ? "Système" : "System", icon: Monitor },
    { id: "dark", label: isFrench ? "Sombre" : "Dark", icon: Moon },
  ] as const;
  const selectedTheme = themeOptions.find((option) => option.id === appearance.theme) ?? themeOptions[0];
  const SelectedThemeIcon = selectedTheme.icon;

  useEffect(() => {
    setAppearance(readAppearancePreferences());
  }, []);

  useEffect(() => {
    if (!themeMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !themeMenuRef.current?.contains(event.target)) setThemeMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setThemeMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [themeMenuOpen]);

  function updateTheme(theme: AppearancePreferences["theme"]) {
    const next = { ...appearance, theme };
    setAppearance(next);
    saveAppearancePreferences(next);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 w-full items-center justify-between gap-3 border-b border-midnight-border/70 bg-midnight-deep/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <Link href="/" aria-label="LynoraLink home" className="shrink-0">
        <Logo size={36} withWordmark />
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageSwitcher compact className="shrink-0" />
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            aria-label={`${isFrench ? "Thème" : "Theme"} : ${selectedTheme.label}`}
            aria-expanded={themeMenuOpen}
            aria-controls="auth-theme-menu"
            onClick={() => setThemeMenuOpen((open) => !open)}
            className="flex h-10 items-center gap-2 rounded-xl border border-midnight-border bg-midnight-deep/60 px-2.5 text-xs font-medium text-ink transition hover:border-gold/40 hover:bg-midnight-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:px-3"
          >
            <SelectedThemeIcon size={16} className="text-gold-soft" aria-hidden="true" />
            <span>{selectedTheme.label}</span>
            <ChevronDown size={14} className={`text-ink-muted transition-transform ${themeMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {themeMenuOpen && <div id="auth-theme-menu" role="group" aria-label={isFrench ? "Choisir un thème" : "Choose a theme"} className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-midnight-border bg-midnight-card p-1.5 shadow-xl shadow-black/25">
            {themeOptions.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={appearance.theme === id}
                onClick={() => {
                  updateTheme(id);
                  setThemeMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${appearance.theme === id ? "bg-gold/10 text-gold-soft" : "text-ink-muted hover:bg-white/5 hover:text-ink"}`}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {appearance.theme === id && <Check size={15} aria-hidden="true" />}
              </button>
            ))}
          </div>}
        </div>
      </div>
    </header>
  );
}