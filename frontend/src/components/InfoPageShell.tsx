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
    <main className="min-h-screen bg-[#edf5f6] text-[#14273a]">
      <LandingTopNav />
      <div aria-hidden="true" className="h-[76px]" />

      <section className="bg-[#103845] text-white">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#69dfcf]">{eyebrow}</p>
          <h1 className="max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">{description}</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="max-w-3xl space-y-8">{children}</div>
      </div>

      <footer className="border-t border-[#d9e5ea] bg-[#edf5f6]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-xs text-[#526779] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p>© {new Date().getFullYear()} LynoraLink · {isFrench ? "Pour celles et ceux qui créent." : "Made for people who make things."}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={isFrench ? "Liens légaux" : "Legal links"}>
            <Link href="/faq" className="transition hover:text-[#087d82]">FAQ</Link>
            <Link href="/terms" className="transition hover:text-[#087d82]">{isFrench ? "Conditions d’utilisation" : "Terms of service"}</Link>
            <Link href="/contact" className="transition hover:text-[#087d82]">{isFrench ? "Contact" : "Contact"}</Link>
            <Link href="/cookies" className="transition hover:text-[#087d82]">{isFrench ? "Cookies" : "Cookies"}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}