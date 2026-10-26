"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, Compass, FolderKanban, Lightbulb, MessageCircleMore, MessagesSquare, Rocket, UsersRound } from "@/components/FontAwesomeIcons";
import { LandingTopNav } from "@/components/LandingTopNav";
import { LandingImageCarousel } from "@/components/LandingImageCarousel";
import { HeroImageSlider } from "@/components/HeroImageSlider";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n";

const copy = {
  en: {
    navHow: "How it works",
    navFeatures: "What you can do",
    navCommunity: "The community",
    signIn: "Sign in",
    join: "Join LynoraLink",
    navJoin: "Join",
    eyebrow: "A co-building space for independent minds",
    headline: "LynoraLink",
    heroCopy: "Good ideas deserve good collaborators. Find your people, build in public, and turn the thing you keep thinking about into something real.",
    startBuilding: "Start building",
    exploreHow: "See how it works",
    heroNote: "Independent makers. Shared momentum.",
    scroll: "Scroll to explore",
    sectionEyebrow: "More than a network",
    sectionTitle: "Build with people who get it.",
    sectionCopy: "Go from browsing to building: explore projects, compare the skills teams need, connect directly, then share your progress with the community.",
    steps: [
      { title: "Explore what is being built", text: "Browse projects by their stage, focus, and tags. See the idea behind each one before deciding where you could contribute.", icon: Compass },
      { title: "Find the right fit", text: "Review maker profiles, skills, and the roles a project is looking for. Choose a collaboration that matches what you can bring.", icon: UsersRound },
      { title: "Start a real conversation", text: "Message a project creator directly to discuss expectations, share context, and agree on a useful next step.", icon: MessagesSquare },
      { title: "Build in public", text: "Share progress, questions, and lessons in the feed so collaborators can follow the journey and join the discussion.", icon: Rocket },
    ],
    featuresEyebrow: "The tools to move an idea forward",
    featuresTitle: "A practical home for your next build.",
    featuresCopy: "Each part of LynoraLink supports a practical step: understand a project, show what you bring, share progress, and keep the conversation moving.",
    features: [
      { title: "Explore projects", text: "Compare project stages, focus, tags, collaborators, and the roles teams are looking for before you reach out.", icon: FolderKanban },
      { title: "Show your work", text: "Post milestones, questions, and lessons from the build. Invite feedback and make progress visible as it happens.", icon: MessageCircleMore },
      { title: "Meet makers", text: "Present your skills, interests, and links on a profile that helps potential collaborators understand what you bring.", icon: UsersRound },
      { title: "Talk directly", text: "Message a maker one-to-one, discuss a project in context, and follow up from the same conversation.", icon: MessagesSquare },
    ],
    communityEyebrow: "A community built around generous exchange",
    communityTitle: "A thoughtful place to share work in progress.",
    communityCopy: "LynoraLink is more than a directory. Makers can share perspective from experience, offer constructive feedback, and encourage one another through the uncertain middle of a build.",
    pointOne: "Give feedback that is useful and kind",
    pointTwo: "Share lessons before everything is polished",
    pointThree: "Credit contributions and agree expectations",
    communityAudienceTitle: "Small contributions make a stronger community.",
    communityAudiences: [
      { title: "Ask a focused question", text: "Bring the context around a blocker and invite makers to share a perspective or lesson that helped them.", icon: Lightbulb },
      { title: "Pass on what you learned", text: "A short note about a decision, experiment, or mistake can save another maker time.", icon: MessageCircleMore },
      { title: "Recognize a milestone", text: "Celebrate progress, offer a thoughtful response, and help make the community welcoming to new voices.", icon: Rocket },
    ],
    communityNextStep: "Bring a question, a lesson, or a small win. Every useful contribution helps another maker keep moving.",
    joinCommunity: "Find your people",
    footerLine: "Made for people who make things.",
    footerExplore: "Explore",
    footerAccount: "Your account",
    footerTerms: "Terms of service",
    footerContact: "Contact",
    footerCookies: "Cookies",
    footerFaq: "FAQ",
  },
  fr: {
    navHow: "Comment ça marche",
    navFeatures: "Les outils",
    navCommunity: "La communauté",
    signIn: "Connexion",
    join: "Rejoindre LynoraLink",
    navJoin: "S’inscrire",
    eyebrow: "Un espace de co-création pour les esprits indépendants",
    headline: "LynoraLink",
    heroCopy: "Les bonnes idées méritent de bons partenaires. Trouvez votre équipe, partagez vos avancées et transformez votre projet en quelque chose de concret.",
    startBuilding: "Commencer à construire",
    exploreHow: "Découvrir le fonctionnement",
    heroNote: "Des makers indépendants. Un élan collectif.",
    scroll: "Défiler pour explorer",
    sectionEyebrow: "Plus qu’un réseau",
    sectionTitle: "Construisez avec ceux qui vous comprennent.",
    sectionCopy: "Passez de la découverte à la création : explorez les projets, comparez les compétences recherchées, échangez directement et partagez vos avancées.",
    steps: [
      { title: "Explorez les projets en cours", text: "Parcourez les projets par étape, sujet et tags. Comprenez l’idée avant de choisir où vous pourriez contribuer.", icon: Compass },
      { title: "Trouvez la bonne collaboration", text: "Consultez les profils, compétences et rôles recherchés. Choisissez un projet adapté à ce que vous pouvez apporter.", icon: UsersRound },
      { title: "Engagez une vraie conversation", text: "Écrivez directement au créateur pour discuter des attentes, donner du contexte et choisir une prochaine étape utile.", icon: MessagesSquare },
      { title: "Construisez en public", text: "Partagez avancées, questions et apprentissages dans le fil pour que les partenaires suivent et participent.", icon: Rocket },
    ],
    featuresEyebrow: "Les outils pour faire avancer une idée",
    featuresTitle: "Un espace concret pour votre prochain projet.",
    featuresCopy: "Chaque espace de LynoraLink sert une étape concrète : comprendre un projet, présenter vos atouts, partager l’avancement et poursuivre l’échange.",
    features: [
      { title: "Explorer les projets", text: "Comparez leur étape, leur sujet, leurs tags, leurs collaborateurs et les rôles recherchés avant de contacter l’équipe.", icon: FolderKanban },
      { title: "Partager vos avancées", text: "Publiez étapes, questions et apprentissages. Demandez des retours et rendez le progrès visible au fil du projet.", icon: MessageCircleMore },
      { title: "Rencontrer des makers", text: "Présentez vos compétences, vos intérêts et vos liens pour aider les partenaires à comprendre votre contribution.", icon: UsersRound },
      { title: "Échanger directement", text: "Écrivez à un maker, discutez du projet dans son contexte et poursuivez l’échange dans la même conversation.", icon: MessagesSquare },
    ],
    communityEyebrow: "Une communauté fondée sur l’entraide",
    communityTitle: "Un espace bienveillant pour partager son parcours.",
    communityCopy: "LynoraLink ne se limite pas à un annuaire. Les makers peuvent partager leur expérience, donner des retours constructifs et s’encourager pendant les étapes incertaines d’un projet.",
    pointOne: "Donner des retours utiles et bienveillants",
    pointTwo: "Partager ses apprentissages sans attendre un résultat parfait",
    pointThree: "Reconnaître les contributions et clarifier les attentes",
    communityAudienceTitle: "Les petites contributions font vivre la communauté.",
    communityAudiences: [
      { title: "Poser une question précise", text: "Expliquez le contexte d’un blocage et invitez les makers à partager une piste ou une expérience utile.", icon: Lightbulb },
      { title: "Transmettre un apprentissage", text: "Une courte note sur une décision, un essai ou une erreur peut faire gagner du temps à quelqu’un.", icon: MessageCircleMore },
      { title: "Souligner une étape franchie", text: "Célébrez un progrès, répondez avec attention et contribuez à accueillir de nouvelles voix.", icon: Rocket },
    ],
    communityNextStep: "Apportez une question, un apprentissage ou une petite victoire. Chaque contribution utile aide un maker à avancer.",
    joinCommunity: "Trouvez votre équipe",
    footerLine: "Pour celles et ceux qui créent.",
    footerExplore: "Explorer",
    footerAccount: "Votre compte",
    footerTerms: "Conditions d’utilisation",
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

      <section className="relative isolate overflow-hidden bg-[#081827] text-white">
        <HeroImageSlider />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#061321]/45 md:bg-transparent" />

        <div aria-hidden="true" className="h-[76px]" />
        <div
          className="mx-auto flex max-w-7xl flex-col justify-center px-5 pb-10 pt-12 sm:px-8 sm:pt-16 lg:px-12"
          style={{ minHeight: "max(31.25rem, calc(100svh - 11.5rem))" }}
        >
          <div className="max-w-2xl">
            <p className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#69dfcf] sm:text-xs">
              <span className="h-px w-8 bg-[#69dfcf]" />{text.eyebrow}
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Lynora<span className="text-gold-soft">Link</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">{text.heroCopy}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#22b8a0] px-5 text-sm font-semibold text-[#071827] transition hover:bg-[#43c8d0]">
                {text.startBuilding}<ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/40 px-5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10">
                {text.exploreHow}<ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/25 pt-5 text-xs text-white/75 sm:mt-16 sm:text-sm">
            <p>{text.heroNote}</p>
            <a href="#how-it-works" className="hidden items-center gap-2 sm:inline-flex">
              {text.scroll}<ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 bg-[#edf5f6] text-[#14273a]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#087d82]">{text.sectionEyebrow}</p>
              <h2 className="max-w-md font-display text-3xl font-semibold leading-tight sm:text-4xl">{text.sectionTitle}</h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#526779] sm:text-base">{text.sectionCopy}</p>
            </div>
            <div className="grid gap-7 sm:grid-cols-2 sm:gap-5">
              {text.steps.map(({ title, text: description, icon: Icon }, index) => (
                <article key={title} className="border-t border-[#c4d6df] pt-5">
                  <div className="mb-7 flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-[#087d82]">0{index + 1}</span>
                    <Icon size={20} className="text-[#367586]" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#526779]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LandingImageCarousel />

      <section id="features" className="scroll-mt-20 bg-white text-[#14273a]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="grid gap-8 border-b border-[#d9e5ea] pb-10 md:grid-cols-[0.8fr_1.2fr] md:items-end md:gap-16">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#087d82]">{text.featuresEyebrow}</p>
              <h2 className="max-w-md font-display text-3xl font-semibold leading-tight sm:text-4xl">{text.featuresTitle}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-[#526779] sm:text-base">{text.featuresCopy}</p>
          </div>
          <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
            {text.features.map(({ title, text: description, icon: Icon }, index) => (
              <article key={title} className="border-b border-[#d9e5ea] py-6 sm:py-7 lg:border-b-0">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#edf5f6] text-[#286579]">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="font-display text-xs font-semibold text-[#087d82]">0{index + 1}</span>
                </div>
                <h3 className="font-display text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#526779]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="community" className="scroll-mt-20 bg-[#103845] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:gap-24 lg:px-12 lg:py-24">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#69dfcf]">{text.communityEyebrow}</p>
            <h2 className="max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">{text.communityTitle}</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/75 sm:text-base">{text.communityCopy}</p>
            <Link href="/register" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#22b8a0] px-5 text-sm font-semibold text-[#071827] transition hover:bg-[#43c8d0]">
              {text.joinCommunity}<ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ul className="divide-y divide-white/20 border-y border-white/20">
            {[text.pointOne, text.pointTwo, text.pointThree].map((point) => (
              <li key={point} className="flex items-center gap-4 py-5 text-sm font-medium sm:text-base">
                <Lightbulb size={18} className="shrink-0 text-[#69dfcf]" aria-hidden="true" />{point}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-10 sm:px-8 lg:px-12">
          <div className="border-t border-white/20 pt-7">
            <h3 className="font-display text-xl font-semibold sm:text-2xl">{text.communityAudienceTitle}</h3>
            <div className="mt-5 grid gap-x-8 sm:grid-cols-3">
              {text.communityAudiences.map(({ title, text: description, icon: Icon }) => (
                <article key={title} className="border-t border-white/20 py-5">
                  <div className="mb-4 flex items-center gap-3 text-[#69dfcf]">
                    <Icon size={18} aria-hidden="true" />
                    <h4 className="text-sm font-semibold text-white">{title}</h4>
                  </div>
                  <p className="text-sm leading-6 text-white/70">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:px-12 lg:pb-16">
          <div className="flex flex-col gap-4 border-t border-white/20 pt-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm leading-6 text-white/70">{text.communityNextStep}</p>
            <Link href="/register" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-white/35 px-4 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10">
              {text.startBuilding}<ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#081827] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div>
            <Logo
              size={38}
              withWordmark
              className="gap-2.5"
            />
            <p className="mt-2 text-xs text-white/75">{text.footerLine}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/70">
            <a href="#how-it-works" className="transition hover:text-white">{text.footerExplore}</a>
            <Link href="/faq" className="transition hover:text-white">{text.footerFaq}</Link>
            <Link href="/terms" className="transition hover:text-white">{text.footerTerms}</Link>
            <Link href="/contact" className="transition hover:text-white">{text.footerContact}</Link>
            <Link href="/cookies" className="transition hover:text-white">{text.footerCookies}</Link>
            <Link href="/login" className="transition hover:text-white">{text.signIn}</Link>
            <Link href="/register" className="transition hover:text-white">{text.footerAccount}</Link>
          </div>
          <p className="text-xs text-white/75">© {new Date().getFullYear()} LynoraLink</p>
        </div>
      </footer>
    </main>
  );
}
