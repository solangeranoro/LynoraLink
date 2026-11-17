"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  Check,
  FolderKanban,
  MessageCircleMore,
  Rocket,
  Sparkles,
  UsersRound,
} from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

type AuthSplitLayoutProps = {
  children: ReactNode;
  variant: "login" | "register";
};

export function AuthSplitLayout({ children, variant }: AuthSplitLayoutProps) {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const isLogin = variant === "login";
  const heading = isLogin
    ? isFrench ? "Retrouvez le fil de vos projets." : "Pick up where your projects left off."
    : isFrench ? "Ne construisez pas votre idée seul·e." : "You don't have to build alone.";
  let letterIndex = 0;

  return (
    <section className="relative mx-auto grid w-full max-w-6xl lg:grid-cols-2">
      <aside className="relative isolate hidden min-h-0 flex-col justify-between overflow-hidden p-8 text-ink lg:flex">
        <div aria-hidden="true" className={`auth-hero-decoration ${isLogin ? "auth-hero-decoration-login" : "auth-hero-decoration-register"}`}>
          <span className="auth-hero-glow" />
          <span className="auth-hero-orbit" />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-midnight-border/60 bg-midnight-card/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-soft">
            {isLogin ? <FolderKanban size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
            {isLogin
              ? isFrench ? "Votre espace de travail" : "Your workspace"
              : isFrench ? "Pour les makers indépendants" : "For independent makers"}
          </div>
          <h2 aria-label={heading} className="mt-5 max-w-md font-display text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-ink sm:text-4xl lg:mt-7 lg:text-[2.5rem]">
            {heading.split(" ").map((word, wordIndex) => (
              <span key={`${word}-${wordIndex}`}>
                {wordIndex > 0 && " "}
                <span className="inline-block whitespace-nowrap">
                  {Array.from(word).map((letter) => {
                    const index = letterIndex++;
                    return (
                      <span
                        key={`${letter}-${index}`}
                        aria-hidden="true"
                        className="auth-title-letter"
                        style={{
                          "--auth-letter-delay": `${index * 32}ms`,
                          "--auth-color-delay": `${index * 58}ms`,
                        } as CSSProperties}
                      >
                        {letter}
                      </span>
                    );
                  })}
                </span>
              </span>
            ))}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">
            {isLogin
              ? isFrench
                ? "Discussions, tâches et retours de test restent réunis dans votre espace d’équipe."
                : "Keep team discussions, tasks, and tester feedback together in your project workspace."
              : isFrench
                ? "Présentez votre projet, trouvez les compétences qui vous manquent et avancez avec la communauté."
                : "Share your project, find the skills you're missing, and move forward with the community."}
          </p>
        </div>

        {isLogin ? (
          <div className="relative z-10 mt-5 rounded-2xl border border-white/15 bg-[#0b2557]/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-md sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0878ff]/20 text-[#8fc8ff]">
                  <FolderKanban size={17} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">
                    {isFrench ? "Espace d’équipe" : "Team workspace"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {isFrench ? "Tout au même endroit" : "Everything in one place"}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-[#8cff00]/25 bg-[#8cff00]/10 px-2.5 py-1 text-[10px] font-medium text-[#c2ff81]">
                {isFrench ? "Ensemble" : "Together"}
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                { label: isFrench ? "Discussions d’équipe" : "Team discussions", icon: MessageCircleMore },
                { label: isFrench ? "Tâches et fichiers partagés" : "Tasks and shared files", icon: Check },
                { label: isFrench ? "Avis des testeurs" : "Tester feedback", icon: Rocket },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl bg-white/[0.045] px-3 py-2.5">
                  <Icon size={14} className="shrink-0 text-[#baff70]" aria-hidden="true" />
                  <span className="flex-1 text-xs font-medium text-white/80">{label}</span>
                  <ArrowRight size={12} className="text-white/35" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative z-10 mt-5 rounded-2xl border border-white/15 bg-[#0b2557]/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-md sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
              {isFrench ? "Votre parcours sur LynoraLink" : "Your LynoraLink journey"}
            </p>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: isFrench ? "Présentez votre idée" : "Share your idea",
                  detail: isFrench ? "Donnez-lui un point de départ" : "Give it a starting point",
                  icon: Sparkles,
                },
                {
                  label: isFrench ? "Trouvez vos collaborateurs" : "Meet your collaborators",
                  detail: isFrench ? "Réunissez les bonnes compétences" : "Bring the right skills together",
                  icon: UsersRound,
                },
                {
                  label: isFrench ? "Construisez et faites tester" : "Build and get feedback",
                  detail: isFrench ? "Avancez, puis apprenez des testeurs" : "Make progress, then learn from testers",
                  icon: Rocket,
                },
              ].map(({ label, detail, icon: Icon }, index) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${index === 0 ? "bg-[#8cff00]/15 text-[#c2ff81]" : "bg-[#0878ff]/20 text-[#8fc8ff]"}`}>
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="mt-0.5 truncate text-[10px] text-white/55">{detail}</p>
                  </div>
                  {index === 0 && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#a1ff47] shadow-[0_0_12px_rgba(161,255,71,0.7)]" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className={`animate-fade-in min-w-0 px-5 py-6 sm:px-8 sm:py-8 lg:flex lg:flex-col lg:px-10 lg:py-7 ${isLogin ? "lg:justify-center" : "lg:justify-start"}`}>
        {children}
      </div>
    </section>
  );
}
