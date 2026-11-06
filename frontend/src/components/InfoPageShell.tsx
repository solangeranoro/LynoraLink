"use client";

import Link from "next/link";
import { LandingTopNav } from "@/components/LandingTopNav";
import { useTranslation } from "@/lib/i18n";

export function InfoPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";

  return (
    <main className="info-page min-h-screen text-white">
      <LandingTopNav />
      <div aria-hidden="true" className="h-[76px]" />

      <section className="info-page-hero relative overflow-hidden">
        <div className="relative mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#8cff00]">{eyebrow}</p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">{description}</p>
        </div>
      </section>

      <div className="info-page-content relative mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="info-page-content-inner max-w-3xl space-y-6">{children}</div>
      </div>

      <footer className="info-page-footer">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-xs text-white/60 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p>© {new Date().getFullYear()} LynoraLink · {isFrench ? "Pour celles et ceux qui créent." : "Made for people who make things."}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={isFrench ? "Liens légaux" : "Legal links"}>
            <Link href="/faq" className="transition hover:text-[#8cff00]">FAQ</Link>
            <Link href="/terms" className="transition hover:text-[#8cff00]">{isFrench ? "Conditions d’utilisation" : "Terms of service"}</Link>
            <Link href="/contact" className="transition hover:text-[#8cff00]">{isFrench ? "Contact" : "Contact"}</Link>
            <Link href="/cookies" className="transition hover:text-[#8cff00]">{isFrench ? "Cookies" : "Cookies"}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}