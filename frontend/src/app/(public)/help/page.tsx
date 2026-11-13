"use client";

import Link from "next/link";
import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

export default function HelpPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const resources = [
    {
      href: "/faq",
      title: "FAQ",
      description: isFrench
        ? "Consultez les réponses aux questions fréquentes sur les comptes, les projets et la communauté."
        : "Find answers to common questions about accounts, projects, and the community.",
    },
    {
      href: "/documentation",
      title: isFrench ? "Documentation" : "Documentation",
      description: isFrench
        ? "Parcourez les guides pour découvrir les fonctionnalités et utiliser la plateforme."
        : "Explore guides to learn about the features and how to use the platform.",
    },
    {
      href: "/contact",
      title: isFrench ? "Contacter l’équipe" : "Contact the team",
      description: isFrench
        ? "Écrivez au support pour une question, un problème ou une demande concernant votre compte."
        : "Contact support with a question, an issue, or a request about your account.",
    },
    {
      href: "/forgot-password",
      title: isFrench ? "Réinitialiser mon mot de passe" : "Reset my password",
      description: isFrench
        ? "Lancez la procédure de réinitialisation si vous ne pouvez plus accéder à votre compte."
        : "Start the reset process if you can no longer access your account.",
    },
  ];

  return (
    <InfoPageShell
      eyebrow={isFrench ? "Centre d’aide" : "Help center"}
      title={isFrench ? "Comment pouvons-nous vous aider ?" : "How can we help?"}
      description={isFrench
        ? "Choisissez la ressource adaptée à votre question ou contactez directement l’équipe LynoraLink."
        : "Choose the resource that fits your question, or contact the LynoraLink team directly."}
    >
      <nav aria-label={isFrench ? "Ressources d’aide" : "Help resources"} className="grid gap-4 sm:grid-cols-2">
        {resources.map(({ href, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#8cff00]/40 hover:bg-white/[0.05]"
          >
            <h2 className="font-semibold text-white transition group-hover:text-[#8cff00]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
            <span className="mt-4 inline-block text-sm font-medium text-[#8cff00]" aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
    </InfoPageShell>
  );
}
