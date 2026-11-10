"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

type DocumentationLink = { href: string; label: string };
type DocumentationSection = {
  id: string;
  title: string;
  intro: string;
  points: readonly string[];
  links?: readonly DocumentationLink[];
};
type DocumentationContent = {
  eyebrow: string;
  title: string;
  description: string;
  contentsLabel: string;
  sections: readonly DocumentationSection[];
};

const documentation: Record<"fr" | "en", DocumentationContent> = {
  fr: {
    eyebrow: "Centre d’aide LynoraLink",
    title: "Guide d’utilisation",
    description: "Retrouvez les repères essentiels pour créer votre espace maker, présenter vos projets et collaborer avec la communauté.",
    contentsLabel: "Dans ce guide",
    sections: [
      {
        id: "demarrer",
        title: "1. Créer votre compte et démarrer",
        intro: "Votre espace LynoraLink rassemble votre profil, vos projets et vos échanges avec la communauté.",
        points: [
          "Créez un compte avec votre adresse e-mail ou utilisez un fournisseur de connexion proposé sur la page d’inscription.",
          "Si l’inscription par e-mail vous le demande, saisissez le code reçu pour confirmer votre adresse.",
          "Choisissez votre langue dans le sélecteur de langue. Vous pouvez la modifier à tout moment.",
          "Après connexion, le tableau de bord vous permet de retrouver le fil communautaire et les principales actions de votre espace.",
        ],
      },
      {
        id: "profil",
        title: "2. Compléter votre profil maker",
        intro: "Un profil clair aide les autres membres à comprendre votre parcours et les sujets sur lesquels vous souhaitez collaborer.",
        points: [
          "Ajoutez un nom, un nom d’utilisateur et une présentation qui décrivent votre activité.",
          "Renseignez votre ville, votre pays, vos compétences et les liens professionnels que vous souhaitez partager.",
          "Utilisez les paramètres de votre compte pour gérer vos préférences et les informations associées à votre espace.",
          "Évitez d’inclure des mots de passe, des coordonnées privées ou des données confidentielles dans les champs publics.",
        ],
        links: [{ href: "/profile", label: "Ouvrir mon profil" }],
      },
      {
        id: "decouvrir",
        title: "3. Découvrir des makers et des projets",
        intro: "Les espaces Découvrir, Créateurs et Meilleurs créateurs vous aident à explorer la communauté et les projets publiés.",
        points: [
          "Parcourez les projets pour comprendre leur objectif, leur état d’avancement et les compétences recherchées.",
          "Consultez les profils des makers pour découvrir leurs domaines d’intérêt et leurs expériences.",
          "Utilisez la recherche du TopNav pour retrouver des personnes, des projets ou des équipes.",
          "Contactez un créateur pour discuter du projet, des attentes et des prochaines étapes avant de vous engager.",
        ],
        links: [
          { href: "/discover", label: "Découvrir les projets" },
          { href: "/makers", label: "Parcourir les créateurs" },
        ],
      },
      {
        id: "projets-equipes",
        title: "4. Créer et gérer des projets ou des équipes",
        intro: "Présentez une idée, partagez son avancement et donnez aux collaborateurs potentiels les informations nécessaires pour vous rejoindre.",
        points: [
          "Depuis Mes projets, créez un projet avec un titre, une description et les informations utiles à sa découverte.",
          "Maintenez les informations du projet à jour afin que les personnes intéressées comprennent son état et ses besoins.",
          "Les espaces d’équipe permettent de réunir des membres autour d’un projet et de gérer les informations de l’équipe.",
          "Avant une collaboration, convenez directement des rôles, du calendrier, des responsabilités et des conditions de contribution.",
        ],
        links: [
          { href: "/projects", label: "Mes projets" },
          { href: "/teams", label: "Mes équipes" },
        ],
      },
      {
        id: "publications",
        title: "5. Partager des avancées dans le fil",
        intro: "Le fil communautaire sert à partager votre progression et à échanger autour de la création de produits.",
        points: [
          "Publiez des avancées, des questions, des étapes importantes ou des apprentissages liés à vos projets.",
          "Ajoutez du contexte pour aider les autres makers à comprendre votre publication et à y répondre utilement.",
          "Respectez les règles de la communauté : les offres commerciales et les ventes directes doivent être publiées dans le Marketplace, pas dans le fil.",
          "Utilisez l’option de signalement d’une publication si vous pensez qu’elle enfreint les règles.",
        ],
        links: [{ href: "/terms", label: "Lire les conditions d’utilisation" }],
      },
      {
        id: "echanges",
        title: "6. Envoyer des demandes et échanger",
        intro: "Les outils de mise en relation et de messagerie facilitent les premiers échanges entre makers.",
        points: [
          "Envoyez une demande de connexion depuis les espaces prévus à cet effet pour manifester votre intérêt.",
          "Une demande en attente peut être annulée depuis l’action associée à cette demande.",
          "Utilisez Messages pour poursuivre une conversation et clarifier les objectifs d’une collaboration.",
          "Prenez le temps de vérifier les informations et de vous mettre d’accord avec l’autre membre avant de partager des accès ou des ressources.",
        ],
        links: [{ href: "/messages", label: "Ouvrir les messages" }],
      },
      {
        id: "outils",
        title: "7. Utiliser LynoAI et les outils de la plateforme",
        intro: "LynoraLink propose des espaces complémentaires pour soutenir votre travail de maker.",
        points: [
          "LynoAI est accessible depuis la navigation principale et son espace d’utilisation.",
          "L’espace Analytics présente des indicateurs de votre activité disponibles dans votre compte.",
          "Le programme Application Testeur permet de découvrir les applications proposées et de partager des retours selon les consignes affichées.",
          "La disponibilité de certaines fonctions peut dépendre de l’état du compte ou des règles d’accès de la plateforme.",
        ],
        links: [
          { href: "/copilot", label: "Ouvrir LynoAI" },
          { href: "/analytics", label: "Voir Analytics" },
          { href: "/tester-applications", label: "Explorer les applications à tester" },
        ],
      },
      {
        id: "marketplace",
        title: "8. Parcourir le Marketplace",
        intro: "Le Marketplace regroupe des offres liées aux produits et services des makers.",
        points: [
          "Lisez attentivement la description, les éléments inclus et les informations fournies par le vendeur.",
          "Contactez le vendeur pour clarifier les questions qui ne sont pas couvertes par l’annonce.",
          "Les acheteurs et vendeurs conviennent directement des modalités et réalisent leurs transactions entre eux; consultez les conditions d’utilisation avant tout achat.",
          "Ne partagez pas d’informations sensibles lors d’un échange commercial.",
        ],
        links: [{ href: "/marketplace", label: "Ouvrir le Marketplace" }],
      },
      {
        id: "compte-securite",
        title: "9. Gérer votre compte et demander de l’aide",
        intro: "Vous gardez le contrôle de votre compte et pouvez contacter l’équipe si vous rencontrez une difficulté.",
        points: [
          "Ouvrez Paramètres depuis le menu de profil pour accéder aux options disponibles pour votre compte.",
          "Si vous ne pouvez plus vous connecter avec votre mot de passe, utilisez le lien de réinitialisation sur la page de connexion.",
          "Pour une question ou une demande d’assistance, écrivez à l’équipe LynoraLink depuis la page Contact.",
          "Ne transmettez jamais votre mot de passe ou vos codes de vérification à une autre personne.",
        ],
        links: [
          { href: "/settings", label: "Paramètres" },
          { href: "/contact", label: "Contacter l’équipe" },
        ],
      },
    ],
  },
  en: {
    eyebrow: "LynoraLink help center",
    title: "User guide",
    description: "Find the essentials for setting up your maker space, presenting projects, and collaborating with the community.",
    contentsLabel: "In this guide",
    sections: [
      {
        id: "getting-started",
        title: "1. Create your account and get started",
        intro: "Your LynoraLink space brings together your profile, projects, and conversations with the community.",
        points: [
          "Create an account with your email address or use a sign-in provider offered on the registration page.",
          "If email registration asks you to, enter the code you receive to confirm your address.",
          "Choose your language with the language switcher. You can change it at any time.",
          "After signing in, use the dashboard to find the community feed and the main actions for your space.",
        ],
      },
      {
        id: "profile",
        title: "2. Complete your maker profile",
        intro: "A clear profile helps other members understand your background and the areas where you would like to collaborate.",
        points: [
          "Add a name, username, and introduction that describe what you do.",
          "Add your city, country, skills, and professional links that you want to share.",
          "Use your account settings to manage the preferences and information available for your space.",
          "Avoid putting passwords, private contact details, or confidential data in public fields.",
        ],
        links: [{ href: "/profile", label: "Open my profile" }],
      },
      {
        id: "discover",
        title: "3. Discover makers and projects",
        intro: "Discover, Makers, and Top Makers help you explore the community and published projects.",
        points: [
          "Browse projects to understand their goals, progress, and requested skills.",
          "Review maker profiles to learn about their interests and experience.",
          "Use TopNav search to find people, projects, or teams.",
          "Contact a creator to discuss the project, expectations, and next steps before committing.",
        ],
        links: [
          { href: "/discover", label: "Discover projects" },
          { href: "/makers", label: "Browse makers" },
        ],
      },
      {
        id: "projects-teams",
        title: "4. Create and manage projects or teams",
        intro: "Present an idea, share its progress, and give potential collaborators the information they need to get involved.",
        points: [
          "Create a project from My Projects with a title, description, and useful discovery information.",
          "Keep project details current so interested people understand its status and needs.",
          "Team spaces bring members together around a project and let you manage team information.",
          "Before collaborating, agree directly on roles, timing, responsibilities, and contribution terms.",
        ],
        links: [
          { href: "/projects", label: "My projects" },
          { href: "/teams", label: "My teams" },
        ],
      },
      {
        id: "posts",
        title: "5. Share progress in the feed",
        intro: "The community feed is a place to share your progress and discuss building products.",
        points: [
          "Post project updates, questions, milestones, or lessons learned.",
          "Add context so other makers can understand your post and respond helpfully.",
          "Follow the community rules: commercial offers and direct sales belong in the Marketplace, not the feed.",
          "Use the report option if you believe a post violates the rules.",
        ],
        links: [{ href: "/terms", label: "Read the Terms of Service" }],
      },
      {
        id: "connections",
        title: "6. Send connection requests and communicate",
        intro: "Connection and messaging tools help makers start a conversation.",
        points: [
          "Send a connection request from the relevant areas to express your interest.",
          "You can cancel a pending request using the action associated with that request.",
          "Use Messages to continue a conversation and clarify collaboration goals.",
          "Check the details and agree with the other member before sharing access or resources.",
        ],
        links: [{ href: "/messages", label: "Open messages" }],
      },
      {
        id: "tools",
        title: "7. Use LynoAI and platform tools",
        intro: "LynoraLink offers additional spaces to support your work as a maker.",
        points: [
          "LynoAI is available from the main navigation and its usage space.",
          "Analytics shows activity indicators available to your account.",
          "The Beta Testing program lets you explore submitted apps and share feedback according to the displayed instructions.",
          "Access to some features may depend on account status or platform access rules.",
        ],
        links: [
          { href: "/copilot", label: "Open LynoAI" },
          { href: "/analytics", label: "View Analytics" },
          { href: "/tester-applications", label: "Explore apps to test" },
        ],
      },
      {
        id: "marketplace",
        title: "8. Browse the Marketplace",
        intro: "The Marketplace brings together offers related to makers’ products and services.",
        points: [
          "Read the description, included items, and seller-provided details carefully.",
          "Contact the seller to clarify questions not covered in the listing.",
          "Buyers and sellers agree on terms and complete transactions directly; review the Terms of Service before making a purchase.",
          "Do not share sensitive information during a commercial conversation.",
        ],
        links: [{ href: "/marketplace", label: "Open the Marketplace" }],
      },
      {
        id: "account-safety",
        title: "9. Manage your account and get help",
        intro: "You stay in control of your account and can contact the team if you run into an issue.",
        points: [
          "Open Settings from the profile menu to access the options available for your account.",
          "If you can’t sign in with your password, use the reset link on the sign-in page.",
          "For questions or support, contact the LynoraLink team through the Contact page.",
          "Never share your password or verification codes with anyone else.",
        ],
        links: [
          { href: "/settings", label: "Settings" },
          { href: "/contact", label: "Contact the team" },
        ],
      },
    ],
  },
} as const;

export default function DocumentationPage() {
  const { locale } = useTranslation();
  const content = locale === "fr" ? documentation.fr : documentation.en;
  const [activeSection, setActiveSection] = useState(content.sections[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = content.sections
          .map(({ id }) => document.getElementById(id))
          .filter((section): section is HTMLElement => section !== null);
        const activationLine = 220;
        const currentSection = sections
          .filter((section) => section.getBoundingClientRect().top <= activationLine)
          .at(-1);
        const atPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        setActiveSection(atPageEnd ? sections.at(-1)?.id ?? "" : currentSection?.id ?? sections[0]?.id ?? "");
      });
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [content.sections]);

  return (
    <InfoPageShell
      eyebrow={content.eyebrow}
      title={content.title}
      description={content.description}
      pageClassName="documentation-page"
      contentClassName="documentation-content !max-w-none !space-y-0"
    >
      <div className="documentation-layout">
        <aside className="documentation-toc">
          <div className="documentation-toc-heading">
            <span className="documentation-toc-kicker">{locale === "fr" ? "Ressource" : "Resource"}</span>
            <h2>{content.contentsLabel}</h2>
          </div>
          <nav aria-label={content.contentsLabel}>
            <ol>
              {content.sections.map(({ id, title }, index) => (
                <li key={id}>
                  <a href={`#${id}`} aria-current={activeSection === id ? "location" : undefined} onClick={() => setActiveSection(id)}>
                    <span className="documentation-toc-number">{String(index + 1).padStart(2, "0")}</span>
                    <span>{title.replace(/^\d+\.\s*/, "")}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="documentation-help">
            <p>{locale === "fr" ? "Besoin d’aide ?" : "Need help?"}</p>
            <Link href="/contact" className="documentation-help-link">
              {locale === "fr" ? "Contacter l’équipe" : "Contact the team"}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </aside>

        <article className="documentation-article">
          <header className="documentation-article-intro">
            <span>{locale === "fr" ? "GUIDE DE LA PLATEFORME" : "PLATFORM GUIDE"}</span>
            <p>{content.description}</p>
          </header>
          {content.sections.map(({ id, title, intro, points, links }, index) => (
            <section key={id} id={id} className="documentation-chapter scroll-mt-28">
              <div className="documentation-chapter-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="documentation-chapter-content">
                <h2>{title.replace(/^\d+\.\s*/, "")}</h2>
                <p className="documentation-chapter-intro">{intro}</p>
                <ul>
                  {points.map((point) => <li key={point}>{point}</li>)}
                </ul>
                {links && (
                  <div className="documentation-chapter-links">
                    {links.map(({ href, label }) => (
                      <Link key={href} href={href}>{label}<span aria-hidden="true">→</span></Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
          <footer className="documentation-article-footer">
            <div>
              <span>{locale === "fr" ? "UNE QUESTION ?" : "HAVE A QUESTION?"}</span>
              <p>{locale === "fr" ? "Notre équipe est là pour vous aider à avancer." : "Our team is here to help you move forward."}</p>
            </div>
            <Link href="/contact">{locale === "fr" ? "Contacter l’équipe" : "Contact the team"}<span aria-hidden="true">→</span></Link>
          </footer>
        </article>
      </div>
    </InfoPageShell>
  );
}
