"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "@/components/FontAwesomeIcons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n";

export function LandingTopNav() {
  const { locale } = useTranslation();
  const pathname = usePathname();
  const isFrench = locale === "fr";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sectionHref = (section: string) => pathname === "/" ? `#${section}` : `/#${section}`;

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

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/20 bg-[#081827]/85 text-white backdrop-blur-md">
      <div className="relative mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-8 lg:px-12">
        <Link href="/" aria-label="LynoraLink home" className="shrink-0">
          <Logo
            size={44}
            className="landing-brand-logo gap-2"
            withWordmark
          />
        </Link>
        <nav id="landing-primary-navigation" className={`${mobileMenuOpen ? "flex" : "hidden"} landing-mobile-nav absolute inset-x-0 top-full flex-col gap-0 border-b border-white/20 bg-[#081827] px-5 py-2 shadow-xl md:static md:flex md:flex-row md:items-center md:gap-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none`} aria-label={isFrench ? "Navigation principale" : "Main navigation"}>
          <a onClick={() => setMobileMenuOpen(false)} href={sectionHref("how-it-works")} className="border-b border-white/10 py-3 text-sm text-white/75 transition hover:text-white md:border-0 md:py-0">
            {isFrench ? "Comment ça marche" : "How it works"}
          </a>
          <a onClick={() => setMobileMenuOpen(false)} href={sectionHref("features")} className="border-b border-white/10 py-3 text-sm text-white/75 transition hover:text-white md:border-0 md:py-0">
            {isFrench ? "Les outils" : "What you can do"}
          </a>
          <a onClick={() => setMobileMenuOpen(false)} href={sectionHref("community")} className="border-b border-white/10 py-3 text-sm text-white/75 transition hover:text-white md:border-0 md:py-0">
            {isFrench ? "La communauté" : "The community"}
          </a>
          <Link onClick={() => setMobileMenuOpen(false)} href="/faq" className="py-3 text-sm text-white/75 transition hover:text-white md:py-0">
            FAQ
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} href="/login" className="py-3 text-sm text-white/75 transition hover:text-white sm:hidden md:hidden">
            {isFrench ? "Connexion" : "Sign in"}
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LanguageSwitcher variant="landing" />
          <Link href="/login" className="hidden px-2 py-2 text-sm font-medium text-white/85 transition hover:text-white sm:inline-flex">
            {isFrench ? "Connexion" : "Sign in"}
          </Link>
          <Link href="/register" className="inline-flex items-center gap-1 rounded-md bg-[#22b8a0] px-2 py-2.5 text-[11px] font-semibold text-[#071827] transition hover:bg-[#43c8d0] sm:gap-2 sm:px-4 sm:text-sm">
            <span className="sm:hidden">{isFrench ? "S’inscrire" : "Join"}</span>
            <span className="hidden sm:inline">{isFrench ? "Rejoindre LynoraLink" : "Join LynoraLink"}</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="landing-menu-toggle inline-flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border border-white/25 bg-white/10 md:hidden"
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