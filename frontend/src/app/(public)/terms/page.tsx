"use client";

import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

const terms = {
  en: {
    eyebrow: "Legal information",
    title: "Terms of service",
    description: "These terms describe the basic rules for using LynoraLink and participating in its maker community.",
    notice: "This is a general product draft, not legal advice. Before public launch, have the terms reviewed and adapted to the laws and business details that apply to LynoraLink.",
    sections: [
      ["Using LynoraLink", "LynoraLink provides tools for makers to create profiles, discover projects, share updates, and communicate with other members. By creating an account or using these features, you agree to use the service lawfully and respectfully."],
      ["Your account", "Provide accurate account information, keep your sign-in credentials private, and tell us if you suspect unauthorized access. You are responsible for activity carried out through your account."],
      ["Your content and projects", "You keep ownership of the content and project materials you submit. You grant LynoraLink permission to host, display, and distribute that content as needed to operate the features you choose to use. Only share material you have the right to publish, and respect the intellectual-property and privacy rights of others."],
      ["Community conduct", "Do not use LynoraLink to harass, impersonate, defraud, spam, distribute unlawful material, or interfere with the service or other members. Do not present another member’s work as your own. Members are responsible for evaluating collaboration proposals and agreements they make with one another."],
      ["Availability and changes", "We may update, suspend, or retire features as the service develops. We will make reasonable efforts to keep the service available, but continuous or error-free operation cannot be guaranteed."],
      ["Suspension and termination", "We may restrict access where reasonably necessary to protect members, comply with law, address misuse, or maintain the service. You may stop using LynoraLink at any time; account-specific deletion requests can be sent through the Contact page."],
      ["Liability and updates", "To the extent permitted by applicable law, LynoraLink is provided without guarantees that every project, introduction, or collaboration will meet your expectations. These terms may be updated as the service changes; the latest version will be published on this page."],
    ],
  },
  fr: {
    eyebrow: "Informations juridiques",
    title: "Conditions d’utilisation",
    description: "Ces conditions présentent les règles de base pour utiliser LynoraLink et participer à sa communauté de makers.",
    notice: "Ce texte est un projet d’information générale, pas un avis juridique. Avant une mise en ligne publique, faites-le relire et adaptez-le au droit applicable et à la situation réelle de LynoraLink.",
    sections: [
      ["Utiliser LynoraLink", "LynoraLink propose des outils pour créer un profil, découvrir des projets, partager des avancées et échanger avec d’autres membres. En créant un compte ou en utilisant ces fonctions, vous acceptez d’utiliser le service de manière légale et respectueuse."],
      ["Votre compte", "Fournissez des informations exactes, protégez vos identifiants et signalez-nous tout accès non autorisé suspecté. Vous êtes responsable de l’activité réalisée depuis votre compte."],
      ["Vos contenus et projets", "Vous restez propriétaire des contenus et éléments de projet que vous publiez. Vous autorisez LynoraLink à les héberger, afficher et diffuser dans la mesure nécessaire au fonctionnement des outils que vous choisissez d’utiliser. Ne publiez que des éléments que vous avez le droit de partager et respectez les droits de propriété intellectuelle et la vie privée d’autrui."],
      ["Comportement dans la communauté", "N’utilisez pas LynoraLink pour harceler, usurper une identité, frauder, envoyer du spam, diffuser des contenus illégaux ou perturber le service et ses membres. Ne présentez pas le travail d’autrui comme le vôtre. Chaque membre reste responsable de l’évaluation des propositions et accords conclus avec d’autres membres."],
      ["Disponibilité et évolution", "Les fonctionnalités peuvent évoluer, être suspendues ou retirées à mesure que le service se développe. Nous faisons des efforts raisonnables pour maintenir le service, sans pouvoir garantir un fonctionnement continu et sans erreur."],
      ["Restriction et fermeture", "L’accès peut être restreint lorsque cela est raisonnablement nécessaire pour protéger les membres, respecter la loi, traiter un abus ou maintenir le service. Vous pouvez cesser d’utiliser LynoraLink à tout moment; les demandes de suppression de compte peuvent être envoyées via la page Contact."],
      ["Responsabilité et mises à jour", "Dans les limites autorisées par le droit applicable, LynoraLink est fourni sans garantie que chaque projet, mise en relation ou collaboration répondra à vos attentes. Ces conditions pourront évoluer avec le service; leur version à jour sera publiée sur cette page."],
    ],
  },
} as const;

export default function TermsPage() {
  const { locale } = useTranslation();
  const content = locale === "fr" ? terms.fr : terms.en;

  return (
    <InfoPageShell eyebrow={content.eyebrow} title={content.title} description={content.description}>
      <p className="border-l-2 border-[#087d82] bg-white/70 px-5 py-4 text-sm leading-6 text-[#526779]">{content.notice}</p>
      {content.sections.map(([title, body]) => (
        <section key={title}>
          <h2 className="font-display text-lg font-semibold text-[#14273a]">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-[#526779]">{body}</p>
        </section>
      ))}
      <p className="border-t border-[#d9e5ea] pt-5 text-xs text-[#64798a]">
        {locale === "fr" ? "Dernière mise à jour : 26 septembre 2026." : "Last updated: September 26, 2026."}
      </p>
    </InfoPageShell>
  );
}