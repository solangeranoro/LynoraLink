"use client";

import { EditorialInfoLayout } from "@/components/EditorialInfoLayout";
import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

const privacyContent = {
  en: {
    eyebrow: "Privacy and data",
    title: "Privacy policy",
    description: "Understand what information LynoraLink uses, why it is needed, and how to contact us about your account and privacy.",
    contentsLabel: "In this policy",
    sections: [
      {
        title: "Scope and approach",
        body: [
          "This policy explains the information processed when you visit LynoraLink, create an account, or use its maker-community features. It should be read alongside the Cookies and browser storage page, which describes the preferences saved by your browser.",
          "We aim to use information in ways connected to operating the service, supporting member interactions, and maintaining a reliable experience. Information you choose to publish may be visible to other members according to the feature in which you share it.",
        ],
      },
      {
        title: "Information associated with your account",
        body: [
          "When you create and use an account, you may provide account details and profile information, such as your name, biography, skills, interests, and project information. The exact information depends on the fields and features you choose to use.",
          "Content you submit—such as project descriptions, community posts, comments, or messages—is processed to provide the corresponding feature. Before sharing, consider whether the information is intended for other members; do not publish passwords, private customer data, or confidential material.",
        ],
      },
      {
        title: "Approximate country from sign-in",
        body: [
          "After a successful sign-in, LynoraLink sends the connecting IP address to ipinfo.io to estimate a country. The country estimate can be inaccurate, including when you use a VPN or when network routing affects the result.",
          "LynoraLink stores the returned ISO country code with the account, rather than the raw IP address for this country lookup. If a country cannot be resolved, the account may show “Unknown.” The lookup is used for approximate geographic understanding of the community, not to determine your precise location.",
        ],
      },
      {
        title: "How information is used",
        body: [
          "Information is used to provide account access and the features you request, display profiles and projects, enable member communication, and respond to support or account requests.",
          "The approximate country code may be used to understand the geographic distribution of the community. Browser language and appearance preferences are stored locally on your device; their details are described in the Cookies and browser storage page.",
        ],
      },
      {
        title: "Services that may receive information",
        body: [
          "The country lookup described above involves sending an IP address to ipinfo.io. That provider processes the request under its own terms and privacy information.",
          "If you choose to authenticate through a third-party identity provider, that provider may process information as part of the sign-in flow and may use its own cookies. Review the provider’s privacy notice for its practices. This policy does not replace those notices.",
        ],
      },
      {
        title: "Publication and member interactions",
        body: [
          "Profiles, projects, and community contributions are intended to support discovery and collaboration. Content made available through a public or community-facing feature may be seen by other members; private communications should be treated as communications with their recipients, not as a guarantee of absolute confidentiality.",
          "Only share information you have the right to disclose. If content contains another person’s personal information, obtain any permission required before publishing it.",
        ],
      },
      {
        title: "Retention, security, and your requests",
        body: [
          "Account and content information is handled to provide the service and respond to legitimate account requests. You can contact the team to ask about your information or request an account-related change or deletion. Some information may need to be retained where required by law or to address security and abuse concerns.",
          "No internet service can promise absolute security. Use a strong, unique password, protect access to your email account, and contact us if you suspect unauthorized access to your LynoraLink account.",
          "Privacy rights depend on the law that applies to you. Contact us through the Contact page to ask a question or make a request; we will review it in light of the applicable requirements.",
        ],
      },
      {
        title: "Updates and contact",
        body: [
          "This policy may be revised as LynoraLink’s features or data practices change. The current version will be published on this page.",
          "For questions about this policy or your account information, contact the LynoraLink team through the Contact page.",
        ],
      },
    ],
  },
  fr: {
    eyebrow: "Confidentialité et données",
    title: "Politique de confidentialité",
    description: "Comprenez quelles informations LynoraLink utilise, dans quel but et comment nous contacter au sujet de votre compte et de votre vie privée.",
    contentsLabel: "Dans cette politique",
    sections: [
      {
        title: "Portée et principes",
        body: [
          "Cette politique explique les informations traitées lorsque vous consultez LynoraLink, créez un compte ou utilisez ses fonctionnalités communautaires. Elle complète la page Cookies et stockage du navigateur, qui décrit les préférences enregistrées par votre navigateur.",
          "Nous cherchons à utiliser les informations pour faire fonctionner le service, permettre les échanges entre membres et maintenir une expérience fiable. Les informations que vous choisissez de publier peuvent être visibles par d’autres membres selon la fonctionnalité utilisée.",
        ],
      },
      {
        title: "Informations liées à votre compte",
        body: [
          "Lors de la création et de l’utilisation d’un compte, vous pouvez fournir des informations de compte et de profil, comme votre nom, votre présentation, vos compétences, vos centres d’intérêt et des informations sur vos projets. Les données exactes dépendent des champs et fonctionnalités que vous choisissez d’utiliser.",
          "Les contenus que vous soumettez — descriptions de projets, publications, commentaires ou messages — sont traités pour fournir la fonctionnalité correspondante. Avant de partager, vérifiez à qui le contenu est destiné. Ne publiez pas de mots de passe, de données privées de clients ni d’informations confidentielles.",
        ],
      },
      {
        title: "Pays approximatif lors de la connexion",
        body: [
          "Après une connexion réussie, LynoraLink transmet l’adresse IP de connexion à ipinfo.io afin d’estimer le pays. Cette estimation peut être inexacte, notamment en cas d’utilisation d’un VPN ou de routage réseau particulier.",
          "Pour cette recherche, LynoraLink enregistre le code ISO du pays renvoyé par le service, et non l’adresse IP brute. Si le pays ne peut pas être déterminé, le compte peut afficher « Inconnu ». Cette donnée sert à comprendre la répartition géographique approximative de la communauté, et non à déterminer votre position précise.",
        ],
      },
      {
        title: "Utilisation des informations",
        body: [
          "Les informations servent à fournir l’accès au compte et les fonctionnalités demandées, afficher les profils et projets, permettre les échanges entre membres et répondre aux demandes d’assistance ou liées au compte.",
          "Le code pays approximatif peut aider à comprendre la répartition géographique de la communauté. La langue et les préférences d’apparence sont stockées localement sur votre appareil; leurs détails figurent sur la page Cookies et stockage du navigateur.",
        ],
      },
      {
        title: "Services susceptibles de recevoir des informations",
        body: [
          "La recherche du pays décrite ci-dessus implique l’envoi d’une adresse IP à ipinfo.io. Ce fournisseur traite cette requête selon ses propres conditions et informations de confidentialité.",
          "Si vous choisissez de vous authentifier avec un fournisseur d’identité tiers, celui-ci peut traiter des informations dans le cadre de la connexion et utiliser ses propres cookies. Consultez sa politique de confidentialité pour connaître ses pratiques. La présente politique ne remplace pas ces informations.",
        ],
      },
      {
        title: "Publication et échanges entre membres",
        body: [
          "Les profils, projets et contributions communautaires sont destinés à faciliter la découverte et la collaboration. Un contenu publié dans une fonctionnalité publique ou communautaire peut être vu par d’autres membres; une communication privée doit être considérée comme destinée à ses destinataires, sans garantie de confidentialité absolue.",
          "Ne partagez que des informations que vous avez le droit de communiquer. Si un contenu comporte des données personnelles concernant autrui, obtenez les autorisations nécessaires avant sa publication.",
        ],
      },
      {
        title: "Conservation, sécurité et demandes",
        body: [
          "Les informations de compte et les contenus sont traités pour fournir le service et répondre aux demandes légitimes liées au compte. Vous pouvez contacter l’équipe pour poser une question sur vos informations ou demander une modification ou suppression de compte. Certaines informations peuvent devoir être conservées si la loi l’exige ou pour traiter des enjeux de sécurité et d’abus.",
          "Aucun service en ligne ne peut garantir une sécurité absolue. Utilisez un mot de passe robuste et unique, protégez l’accès à votre messagerie et contactez-nous si vous soupçonnez un accès non autorisé à votre compte LynoraLink.",
          "Les droits relatifs à la vie privée varient selon la législation applicable. Contactez-nous via la page Contact pour poser une question ou formuler une demande; nous l’examinerons selon les exigences qui s’appliquent.",
        ],
      },
      {
        title: "Mises à jour et contact",
        body: [
          "Cette politique pourra évoluer si les fonctionnalités ou les pratiques de traitement de LynoraLink changent. Sa version en vigueur sera publiée sur cette page.",
          "Pour toute question sur cette politique ou les informations de votre compte, contactez l’équipe LynoraLink via la page Contact.",
        ],
      },
    ],
  },
} as const;

export default function PrivacyPage() {
  const { locale } = useTranslation();
  const content = locale === "fr" ? privacyContent.fr : privacyContent.en;
  const sections = content.sections.map(({ title, body }, index) => ({
    id: `privacy-${index + 1}`,
    title,
    body,
  }));

  return (
    <InfoPageShell
      eyebrow={content.eyebrow}
      title={content.title}
      description={content.description}
      pageClassName="documentation-page"
      contentClassName="documentation-content !max-w-none !space-y-0"
    >
      <EditorialInfoLayout
        sections={sections}
        contentsLabel={content.contentsLabel}
        updatedAt={locale === "fr" ? "Dernière mise à jour : 10 novembre 2026." : "Last updated: November 10, 2026."}
        contactPrompt={locale === "fr" ? "Pour toute question ou demande relative à vos données, notre équipe peut vous orienter." : "For questions or requests about your information, our team can point you in the right direction."}
        contactLabel={locale === "fr" ? "Contacter l’équipe" : "Contact the team"}
      />
    </InfoPageShell>
  );
}
