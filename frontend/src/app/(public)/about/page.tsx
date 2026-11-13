"use client";

import { EditorialInfoLayout } from "@/components/EditorialInfoLayout";
import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

export default function AboutPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const sections = isFrench
    ? [
        {
          id: "about-community",
          title: "Une communauté pour créer",
          body: "LynoraLink est un espace destiné aux indie makers, aux solopreneurs et à toutes les personnes qui construisent des produits numériques. La plateforme aide chacun à présenter son profil, découvrir des projets et rencontrer des personnes avec qui avancer.",
        },
        {
          id: "about-collaboration",
          title: "Des outils pour collaborer",
          body: "Les membres peuvent partager leurs projets et leurs avancées, échanger autour de leurs idées et contacter d’autres makers. Le Marketplace permet également de publier des offres et de prendre contact directement entre membres.",
        },
        {
          id: "about-values",
          title: "Construire ensemble, à son rythme",
          body: "LynoraLink rassemble des ressources pour rendre la découverte et la collaboration plus simples. Chaque membre reste libre de choisir les projets, les échanges et les informations qu’il souhaite partager.",
        },
      ]
    : [
        {
          id: "about-community",
          title: "A community for makers",
          body: "LynoraLink is a space for indie makers, solopreneurs, and anyone building digital products. The platform helps people present their profiles, discover projects, and meet others to make progress together.",
        },
        {
          id: "about-collaboration",
          title: "Tools to collaborate",
          body: "Members can share projects and progress, discuss ideas, and contact other makers. The Marketplace also lets members publish offers and connect directly with one another.",
        },
        {
          id: "about-values",
          title: "Build together, at your own pace",
          body: "LynoraLink brings together resources to make discovery and collaboration easier. Each member chooses which projects, conversations, and information to share.",
        },
      ];

  return (
    <InfoPageShell
      eyebrow={isFrench ? "À propos de LynoraLink" : "About LynoraLink"}
      title={isFrench ? "Un espace pour faire avancer vos projets" : "A space to move your projects forward"}
      description={isFrench
        ? "Découvrez la communauté et les outils LynoraLink dédiés aux personnes qui créent des produits numériques."
        : "Discover the LynoraLink community and tools for people building digital products."}
      pageClassName="documentation-page"
      contentClassName="documentation-content !max-w-none !space-y-0"
    >
      <EditorialInfoLayout
        sections={sections}
        contentsLabel={isFrench ? "À propos" : "About"}
        contactPrompt={isFrench ? "Envie d’en savoir plus ou de nous faire part d’une idée ?" : "Want to learn more or share an idea with us?"}
        contactLabel={isFrench ? "Contacter l’équipe" : "Contact the team"}
      />
    </InfoPageShell>
  );
}
