"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Moon, Sun } from "@/components/FontAwesomeIcons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n";
import { readAppearancePreferences, saveAppearancePreferences } from "@/lib/appearance";

export function LandingTopNav() {
  const { locale } = useTranslation();
  const pathname = usePathname();
  const isFrench = locale === "fr";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const sectionHref = (section: string) => pathname === "/" ? `#${section}` : `/#${section}`;

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsLightTheme(root.dataset.theme === "light");
    const observer = new MutationObserver(syncTheme);
    syncTheme();
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, locale]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  function toggleTheme() {
    const preferences = readAppearancePreferences();
    const nextTheme = isLightTheme ? "dark" : "light";
    saveAppearancePreferences({ ...preferences, theme: nextTheme });
  }

  const themeToggle = (mobile = false) => (
    <button
      type="button"
      className={`landing-theme-toggle ${mobile ? "landing-theme-toggle-mobile" : "landing-theme-toggle-desktop"}`}
      onClick={toggleTheme}
      aria-label={isLightTheme
        ? (isFrench ? "Activer le mode sombre" : "Switch to dark mode")
        : (isFrench ? "Activer le mode clair" : "Switch to light mode")}
      title={isLightTheme
        ? (isFrench ? "Activer le mode sombre" : "Switch to dark mode")
        : (isFrench ? "Activer le mode clair" : "Switch to light mode")}
      aria-pressed={isLightTheme}
    >
      {isLightTheme ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      {mobile && <span>{isFrench ? "Changer de thème" : "Change theme"}</span>}
    </button>
  );

  return (
    <header className="landing-header pointer-events-none fixed inset-x-0 top-3 z-50 text-white">
      <div className="landing-header-inner pointer-events-auto relative mx-auto flex h-16 w-[calc(100%-1.5rem)] max-w-[1440px] items-center justify-between gap-2 rounded-2xl px-3 sm:w-[calc(100%-2.5rem)] sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="LynoraLink home" className="shrink-0">
          <Logo
            size={44}
            className="landing-brand-logo gap-2"
            withWordmark
            wordmarkClassName="landing-brand-wordmark"
          />
        </Link>
        <nav id="landing-primary-navigation" className={`${mobileMenuOpen ? "flex" : "hidden"} landing-mobile-nav absolute inset-x-0 top-[calc(100%+0.55rem)] max-h-[calc(100dvh-6rem)] flex-col gap-0 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#062b25]/95 px-5 py-2 shadow-2xl backdrop-blur-xl xl:static xl:flex xl:max-h-none xl:flex-row xl:items-center xl:gap-7 xl:overflow-visible xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none`} aria-label={isFrench ? "Navigation principale" : "Main navigation"}>
          <a onClick={() => setMobileMenuOpen(false)} href={sectionHref("how-it-works")} className="landing-nav-link border-b border-white/10 py-3 text-sm text-white/75 transition xl:border-0 xl:py-0">
            {isFrench ? "Comment ça marche" : "How it works"}
          </a>
          <a onClick={() => setMobileMenuOpen(false)} href={sectionHref("features")} className="landing-nav-link border-b border-white/10 py-3 text-sm text-white/75 transition xl:border-0 xl:py-0">
            {isFrench ? "Les outils" : "What you can do"}
          </a>
          <a onClick={() => setMobileMenuOpen(false)} href={sectionHref("community")} className="landing-nav-link border-b border-white/10 py-3 text-sm text-white/75 transition xl:border-0 xl:py-0">
            {isFrench ? "Choisir mon parcours" : "Choose your path"}
          </a>
          <Link onClick={() => setMobileMenuOpen(false)} href="/faq" className="landing-nav-link py-3 text-sm text-white/75 transition xl:py-0">
            FAQ
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} href="/register" className="landing-nav-cta mt-2 flex items-center justify-center gap-2 py-3 text-sm font-semibold md:hidden">
            {isFrench ? "S’inscrire" : "Join"}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} href="/login" className="landing-nav-link py-3 text-sm text-white/75 transition xl:hidden">
            {isFrench ? "Connexion" : "Sign in"}
          </Link>
          <div className="xl:hidden">{themeToggle(true)}</div>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {themeToggle()}
          <LanguageSwitcher variant="landing" />
          <Link href="/login" className="landing-nav-login hidden px-3 py-2 text-sm font-medium text-white/85 transition xl:inline-flex">
            {isFrench ? "Connexion" : "Sign in"}
          </Link>
          <Link href="/register" className="landing-nav-cta hidden items-center gap-1 px-2 py-2.5 text-[11px] font-semibold sm:gap-2 sm:px-3 sm:text-xs md:inline-flex xl:px-4 xl:text-sm">
            <span className="xl:hidden">{isFrench ? "S’inscrire" : "Join"}</span>
            <span className="hidden xl:inline">{isFrench ? "Rejoindre LynoraLink" : "Join LynoraLink"}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="landing-menu-toggle inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/[0.06] transition hover:border-[#48d0a8]/60 hover:bg-[#005ce6]/25 xl:hidden"
            aria-label={mobileMenuOpen ? (isFrench ? "Fermer le menu" : "Close menu") : (isFrench ? "Ouvrir le menu" : "Open menu")}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-primary-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className={`landing-menu-icon ${mobileMenuOpen ? "is-open" : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
}