"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check } from "@/components/FontAwesomeIcons";
import { Feed } from "@/components/Feed";
import { useTranslation } from "@/lib/i18n";

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const firstName = session?.user?.name?.split(" ")[0] ?? "Maker";
  const slides = [
    {
      title: `${t("dashboard.greeting")}, ${firstName}`,
      subtitle: t("dashboard.subtitle"),
    },
    {
      title: t("feed.title"),
      subtitle: t("feed.subtitle"),
    },
  ];

  useEffect(() => {
    if (isHovered || isFocused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [isFocused, isHovered, slides.length]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("verified") !== "1") return;
    setVerificationSuccess(true);
    url.searchParams.delete("verified");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!verificationSuccess) return;
    const timer = window.setTimeout(() => setVerificationSuccess(false), 6000);
    return () => window.clearTimeout(timer);
  }, [verificationSuccess]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-7">
      {verificationSuccess && (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          <Check size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            {locale === "fr"
              ? "Vérification réussie ! Votre compte est maintenant vérifié."
              : "Verification successful! Your account is now verified."}
          </p>
        </div>
      )}

      <header
        className="rounded-xl border border-midnight-border/60 bg-midnight-deep/30 p-3 shadow-sm backdrop-blur-md sm:p-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
        }}
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div
            className="min-w-0 flex-1"
            role="region"
            aria-roledescription={locale === "fr" ? "carrousel" : "carousel"}
            aria-label={locale === "fr" ? "En-tête du tableau de bord" : "Dashboard highlights"}
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-soft backdrop-blur-sm">
              {t("dashboard.eyebrow")}
            </p>
            <div key={activeSlide} className="animate-dashboard-slide mt-1 min-h-[3.25rem]" aria-live="off">
              <h1 className="font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
                {slides[activeSlide].title}
              </h1>
              <p className="mt-0.5 max-w-lg text-xs leading-4 text-ink-muted">
                {slides[activeSlide].subtitle}
              </p>
            </div>
          </div>
          <Link href="/projects/new" className="btn-gold w-full shrink-0 justify-center !py-2 text-sm sm:w-auto">
            {t("dashboard.createProject")}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div id="updates">
        <Feed showHeading={false} />
      </div>
    </div>
  );
}
