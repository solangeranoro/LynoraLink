"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, BarChart3, Compass, FolderKanban, Rocket, Sparkles, Store, UsersRound } from "@/components/FontAwesomeIcons";
import { LandingTopNav } from "@/components/LandingTopNav";
import { LandingImageCarousel } from "@/components/LandingImageCarousel";
import { LandingScrollEffects } from "@/components/LandingScrollEffects";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n";

const copy = {
  en: {
    navHow: "How it works",
    navFeatures: "What you can do",
    navCommunity: "Choose your path",
    signIn: "Sign in",
    join: "Join LynoraLink",
    navJoin: "Join",
    eyebrow: "For independent makers ready to build together",
    headline: "Build your idea with the right team.",
    heroCopy: "Post an idea or join a project, find the skills your team is missing, then work together in one shared space—from first conversation to beta feedback.",
    startBuilding: "Create your account",
    exploreHow: "See how it works",
    heroNote: "Find a project. Bring your skills. Make progress together.",
    scroll: "Scroll to explore",
    visualTitle: "A project moves forward, one real step at a time.",
    showcaseEyebrow: "One connected workspace",
    showcaseTitle: "The whole project, in one place.",
    showcaseCopy: "Keep conversations, community feedback, polls, and beta testing connected to the work—so your team can focus on what comes next.",
    sectionEyebrow: "A clear path from idea to feedback",
    sectionTitle: "From a shared project brief to beta feedback.",
    sectionCopy: "LynoraLink connects the steps that usually happen in separate places: finding a project, bringing the right people together, coordinating the work, and learning from testers.",
    steps: [
      { title: "Start with a real project", text: "Describe the idea, its current stage, and the kind of help you need—or browse projects looking for your skills.", icon: Compass },
      { title: "Agree on the next step", text: "Check maker profiles, talk directly, and make sure the goals and expectations fit before you join in.", icon: UsersRound },
      { title: "Keep the work together", text: "Coordinate with your team through project discussions, shared files, tasks, and polls in one workspace.", icon: FolderKanban },
      { title: "Put it in front of testers", text: "Share a beta with the community, collect useful feedback, and follow your progress with maker analytics.", icon: Rocket },
    ],
    featuresEyebrow: "More than a place to meet",
    featuresTitle: "The tools to take a project beyond the first conversation.",
    featuresCopy: "Bring people together, then keep momentum: validate a beta, understand your activity, get help from LynoAI, and find useful offers from the community.",
    features: [
      { title: "Beta testing with real feedback", text: "Publish an app for community testing, gather reviews, and see what to improve before your next release.", icon: Rocket, href: "/discover#discover-tester-applications" },
      { title: "Analytics for your maker journey", text: "Track projects, posts, engagement, and ranking to see how your work and community contributions grow.", icon: BarChart3, href: "/analytics" },
      { title: "LynoAI, in your corner", text: "Think through a project, get unstuck, or turn a rough idea into clear next steps with the AI assistant.", icon: Sparkles, href: "/copilot" },
      { title: "A marketplace for maker needs", text: "Discover tools and services offered by the community, contact sellers, or list your own offer.", icon: Store, href: "/marketplace" },
    ],
    communityEyebrow: "Choose your way in",
    communityTitle: "Bring a project—or bring your point of view.",
    communityCopy: "You don’t need to arrive with a finished product. Start with the role that fits you today, and take one useful step with the community.",
    communityAudiences: [
      { title: "I’m building something", text: "Share your project, find collaborators for the skills you’re missing, and organize the work in a shared team space.", action: "Start a project", href: "/projects/new", icon: FolderKanban },
      { title: "I want to test and contribute", text: "Try community apps, leave practical feedback, and find projects where your experience can make a difference.", action: "Explore apps to test", href: "/discover#discover-tester-applications", icon: Rocket },
    ],
    path: "YOUR NEXT STEP",
    footerLine: "Ideas, teams, and beta feedback—connected in one place.",
    footerExplore: "Explore",
    footerHowItWorks: "How it works",
    footerAccount: "Account",
    footerCreateAccount: "Create an account",
    footerInformation: "Information",
    footerTerms: "Terms of service",
    footerPrivacy: "Privacy",
    footerContact: "Contact",
    footerCookies: "Cookies",
    footerFaq: "FAQ",
  },
  fr: {
    navHow: "Comment ça marche",
    navFeatures: "Les outils",
    navCommunity: "Choisir mon parcours",
    signIn: "Connexion",
    join: "Rejoindre LynoraLink",
    navJoin: "S’inscrire",
    eyebrow: "Pour les makers indépendants qui veulent construire ensemble",
    headline: "Faites avancer vos idées en équipe.",
    heroCopy: "Publiez une idée ou rejoignez un projet, trouvez les compétences qui manquent à l’équipe, puis avancez dans un espace partagé, de la première discussion aux retours des testeurs.",
    startBuilding: "Créer mon compte",
    exploreHow: "Découvrir le fonctionnement",
    heroNote: "Trouvez un projet. Apportez vos compétences. Avancez ensemble.",
    scroll: "Défiler pour explorer",
    visualTitle: "Un projet avance, une vraie étape après l’autre.",
    showcaseEyebrow: "Un espace de travail connecté",
    showcaseTitle: "Tout le projet, au même endroit.",
    showcaseCopy: "Reliez les échanges, les retours de la communauté, les sondages et le bêta-test au travail de l’équipe pour avancer sans perdre le fil.",
    sectionEyebrow: "Un parcours clair, de l’idée aux retours",
    sectionTitle: "Du projet partagé aux retours de bêta-test.",
    sectionCopy: "LynoraLink rassemble des étapes souvent dispersées : découvrir un projet, réunir les bonnes compétences, organiser le travail et apprendre des testeurs.",
    steps: [
      { title: "Partez d’un vrai projet", text: "Présentez votre idée, son stade et les compétences recherchées — ou explorez les projets qui ont besoin de votre savoir-faire.", icon: Compass },
      { title: "Choisissez la bonne collaboration", text: "Consultez les profils, échangez directement et mettez-vous d’accord sur les objectifs avant de vous lancer.", icon: UsersRound },
      { title: "Gardez le travail au même endroit", text: "Coordonnez l’équipe avec des discussions, fichiers partagés, tâches et sondages dans un espace de projet commun.", icon: FolderKanban },
      { title: "Faites tester votre produit", text: "Proposez une bêta à la communauté, recueillez des retours utiles et suivez votre progression avec les analytics maker.", icon: Rocket },
    ],
    featuresEyebrow: "Plus qu’un lieu de rencontre",
    featuresTitle: "Les outils pour dépasser la première conversation.",
    featuresCopy: "Réunissez votre équipe, puis gardez le rythme : validez une bêta, suivez votre activité, demandez de l’aide à LynoAI et trouvez des offres utiles auprès de la communauté.",
    features: [
      { title: "Bêta-test et retours concrets", text: "Proposez votre application aux testeurs, recueillez des avis et identifiez les améliorations avant la prochaine version.", icon: Rocket, href: "/discover#discover-tester-applications" },
      { title: "Analytics de votre parcours maker", text: "Suivez projets, publications, engagement et classement pour voir évoluer votre activité et vos contributions.", icon: BarChart3, href: "/analytics" },
      { title: "LynoAI à vos côtés", text: "Réfléchissez à votre projet, débloquez un problème ou transformez une idée floue en prochaines étapes concrètes.", icon: Sparkles, href: "/copilot" },
      { title: "Une marketplace pour les makers", text: "Découvrez les outils et services de la communauté, contactez les vendeurs ou publiez votre offre.", icon: Store, href: "/marketplace" },
    ],
    communityEyebrow: "Choisissez votre point de départ",
    communityTitle: "Venez avec un projet ou avec votre regard.",
    communityCopy: "Pas besoin d’avoir un produit fini. Choisissez le rôle qui vous correspond aujourd’hui et faites un premier pas utile avec la communauté.",
    communityAudiences: [
      { title: "Je construis un projet", text: "Présentez votre projet, trouvez les compétences qui vous manquent et organisez le travail dans un espace d’équipe partagé.", action: "Créer un projet", href: "/projects/new", icon: FolderKanban },
      { title: "Je veux tester et contribuer", text: "Essayez les applications de la communauté, partagez des retours concrets et repérez les projets où votre expérience peut aider.", action: "Découvrir les applications à tester", href: "/discover#discover-tester-applications", icon: Rocket },
    ],
    path: "VOTRE PROCHAINE ÉTAPE",
    footerLine: "Idées, équipes et retours bêta réunis au même endroit.",
    footerExplore: "Découvrir",
    footerHowItWorks: "Comment ça marche",
    footerAccount: "Compte",
    footerCreateAccount: "Créer un compte",
    footerInformation: "Informations",
    footerTerms: "Conditions d’utilisation",
    footerPrivacy: "Confidentialité",
    footerContact: "Contact",
    footerCookies: "Cookies",
    footerFaq: "FAQ",
  },
} as const;

export default function Home() {
  const { locale } = useTranslation();
  const text = locale === "fr" ? copy.fr : copy.en;

  return (
    <main className="landing-page">
      <LandingTopNav />
      <LandingScrollEffects />

      <section className="landing-hero-shell relative isolate overflow-hidden bg-[#06194b] text-white">
        <div className="landing-hero-layout relative mx-auto grid min-h-[min(48rem,100svh)] max-w-7xl items-center gap-10 px-5 pb-14 pt-28 sm:px-8 sm:pb-16 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:px-12 lg:pt-32">
          <div className="landing-hero-copy relative z-10 max-w-2xl">
            <p className="landing-hero-kicker mb-7 inline-flex items-center rounded-full border border-white/15 bg-[#07163e]/70 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1ff47] shadow-[0_12px_40px_rgba(0,0,0,0.15)] backdrop-blur-md sm:text-xs">
              {text.eyebrow}
            </p>
            <h1 className="landing-hero-title max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-[4.25rem]">
              {text.headline}
            </h1>
            <p className="landing-hero-description mt-7 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">{text.heroCopy}</p>
            <div className="landing-hero-actions mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8cff00] bg-gradient-to-r from-[#0878ff] to-[#005ce6] px-5 text-sm font-semibold text-white shadow-[0_12px_36px_rgba(3,55,40,0.28)] transition duration-200 hover:-translate-y-0.5 hover:from-[#064dd6] hover:to-[#003db8] hover:shadow-[0_16px_44px_rgba(3,55,40,0.38)]">
                {text.startBuilding}<ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/[0.06] px-5 text-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-white/70 hover:bg-white/10">
                {text.exploreHow}<ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="landing-hero-visual relative mx-auto w-full max-w-[46rem]" aria-label={text.visualTitle}>
            <div className="landing-hero-photo-frame relative aspect-[1.5]">
              <Image
                src="/landing/hero.png"
                alt={locale === "fr" ? "Une équipe de makers LynoraLink construit ensemble autour d’un ordinateur" : "A LynoraLink maker team building together around a laptop"}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-contain object-bottom"
              />
            </div>
          </div>

          <div data-landing-reveal="up" className="landing-hero-bottom col-span-full mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-white/65 sm:text-sm">
            <p>{text.heroNote}</p>
            <a href="#how-it-works" className="inline-flex items-center gap-2 transition hover:text-[#a1ff47]">
              {text.scroll}<ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-how scroll-mt-20 text-[#10224c]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
          <div className="landing-section-heading mb-12 flex flex-col gap-6 lg:mb-16 lg:flex-row lg:items-end lg:justify-between">
            <div data-landing-reveal="left" className="max-w-2xl">
              <p className="landing-eyebrow mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0878ff]">{text.sectionEyebrow}</p>
              <h2 className="max-w-lg font-display text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">{text.sectionTitle}</h2>
            </div>
            <p data-landing-reveal="right" className="max-w-xl text-base leading-7 text-[#586b8c] sm:text-lg sm:leading-8">{text.sectionCopy}</p>
          </div>
          <div className="landing-steps-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {text.steps.map(({ title, text: description, icon: Icon }, index) => (
              <article key={title} data-landing-reveal="up" className="landing-step-card group relative overflow-hidden rounded-2xl border border-[#d8e2f2] bg-white p-6 sm:p-7">
                <div className="mb-9 flex items-center justify-between">
                  <span className="landing-step-number font-display text-4xl font-semibold tracking-[-0.06em] text-[#d8e2f2]">0{index + 1}</span>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf2ff] text-[#0878ff] transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-105">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                </div>
                <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#586b8c]">{description}</p>
                <span aria-hidden="true" className="landing-step-accent absolute bottom-0 left-6 right-6 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-[#0878ff] to-[#8cff00] transition-transform duration-300 group-hover:scale-x-100" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-showcase text-[#10224c]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-12 lg:py-32">
          <div data-landing-reveal="left" className="max-w-xl">
            <p className="landing-eyebrow mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0878ff]">{text.showcaseEyebrow}</p>
            <h2 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">{text.showcaseTitle}</h2>
            <p className="mt-6 text-base leading-7 text-[#586b8c] sm:text-lg sm:leading-8">{text.showcaseCopy}</p>
            <ul className="mt-8 grid gap-3">
              {text.features.slice(0, 3).map(({ title, icon: Icon }) => (
                <li key={title} className="flex items-center gap-3 text-sm font-semibold text-[#10224c]">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf2ff] text-[#0878ff]"><Icon size={16} aria-hidden="true" /></span>
                  {title}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#0878ff] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(8,120,255,0.24)] transition hover:-translate-y-0.5 hover:bg-[#005ce6]">
              {text.startBuilding}<ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div data-landing-reveal="right" className="landing-showcase-visual relative mx-auto w-full max-w-[54rem]">
            <div className="landing-screen-window overflow-hidden rounded-2xl border border-[#d8e2f2] bg-white">
              <div className="flex h-11 items-center gap-2 border-b border-white/10 bg-[#071742] px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b65]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffc453]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#43c987]" />
                <span className="ml-3 rounded-md bg-white/[0.08] px-3 py-1 text-[10px] font-medium text-white/70">
                  LynoraLink · {locale === "fr" ? "Espace communautaire" : "Community workspace"}
                </span>
              </div>
              <div className="landing-screen-frame relative aspect-[1.776] bg-[#f3f6ff]">
                <Image
                  src="/landing/screen-1.png"
                  alt={locale === "fr" ? "Aperçu de LynoraLink : avis, sondages et bêta-test" : "LynoraLink preview: reviews, polls, and beta testing"}
                  fill
                  sizes="(max-width: 1024px) 100vw, 62vw"
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section landing-features scroll-mt-20 text-[#10224c]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
          <div className="mb-12 grid gap-6 lg:mb-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
            <div data-landing-reveal="left">
              <p className="landing-eyebrow mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0878ff]">{text.featuresEyebrow}</p>
              <h2 className="max-w-xl font-display text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">{text.featuresTitle}</h2>
            </div>
            <p data-landing-reveal="right" className="max-w-2xl text-base leading-7 text-[#586b8c] sm:text-lg sm:leading-8">{text.featuresCopy}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {text.features.map(({ title, text: description, icon: Icon, href }, index) => (
              <Link key={title} href={href} data-landing-reveal="up" className="landing-feature-card group block rounded-3xl border border-[#d8e2f2] bg-[#fbfdfd] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#a8c6ff] hover:shadow-[0_20px_55px_rgba(20,55,67,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878ff] focus-visible:ring-offset-2 sm:p-7">
                <div className="mb-10 flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf2ff] text-[#0878ff] transition duration-300 group-hover:bg-[#d4eee7]">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="font-display text-xs font-semibold tracking-[0.14em] text-[#9eaccb]">0{index + 1}</span>
                </div>
                <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#586b8c]">{description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0878ff] transition group-hover:gap-3">
                  {locale === "fr" ? "Découvrir" : "Explore"} <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <LandingImageCarousel />

      <section id="community" className="landing-community scroll-mt-20 text-white">
        <div className="landing-community-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div data-landing-reveal="left" className="mb-8 max-w-3xl sm:mb-10">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8cff00] sm:mb-5 sm:text-xs sm:tracking-[0.18em]">{text.communityEyebrow}</p>
            <h2 className="max-w-xl font-display text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">{text.communityTitle}</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 sm:mt-6 sm:text-lg sm:leading-8">{text.communityCopy}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {text.communityAudiences.map(({ title, text: description, action, href, icon: Icon }, index) => (
              <Link key={title} href={href} data-landing-reveal="up" className="landing-community-card group rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-[#8cff00]/40 hover:bg-white/[0.075] sm:rounded-3xl sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#35b5ff]/10 text-[#8cff00] sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="text-[10px] font-semibold tracking-[0.16em] text-white/40">0{index + 1}</span>
                </div>
                <p className="mt-6 text-[10px] font-semibold tracking-[0.14em] text-[#8cff00] sm:mt-8 sm:tracking-[0.16em]">{text.path}</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-white sm:text-3xl">{title}</h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-white/70 sm:text-base">{description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#adff62] transition group-hover:gap-3 sm:mt-7">
                  {action}<ArrowRight size={15} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer text-white">
        <div className="mx-auto max-w-7xl px-5 pb-7 pt-12 sm:px-8 lg:px-12 lg:pt-16">
          <div data-landing-reveal="up" className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[1.2fr_2fr] md:gap-16">
            <div>
              <Logo size={42} withWordmark className="gap-2.5" wordmarkClassName="landing-brand-wordmark" />
              <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">{text.footerLine}</p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <nav aria-label={text.footerExplore} className="flex flex-col items-start gap-3">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/85">{text.footerExplore}</h2>
                <a href="#how-it-works" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.footerHowItWorks}</a>
                <Link href="/faq" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.footerFaq}</Link>
              </nav>
              <nav aria-label={text.footerAccount} className="flex flex-col items-start gap-3">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/85">{text.footerAccount}</h2>
                <Link href="/login" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.signIn}</Link>
                <Link href="/register" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.footerCreateAccount}</Link>
              </nav>
              <nav aria-label={text.footerInformation} className="col-span-2 flex flex-col items-start gap-3 sm:col-span-1">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/85">{text.footerInformation}</h2>
                <Link href="/terms" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.footerTerms}</Link>
                <Link href="/privacy" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.footerPrivacy}</Link>
                <Link href="/contact" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.footerContact}</Link>
                <Link href="/cookies" className="text-sm text-white/55 transition hover:text-[#8cff00]">{text.footerCookies}</Link>
              </nav>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-5 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} LynoraLink</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
