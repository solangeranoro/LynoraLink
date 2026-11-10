"use client";

import { InfoPageShell } from "@/components/InfoPageShell";
import { EditorialInfoLayout } from "@/components/EditorialInfoLayout";
import { useTranslation } from "@/lib/i18n";

const terms = {
  en: {
    eyebrow: "Legal information",
    title: "Terms of service",
    description: "These terms describe the basic rules for using LynoraLink and participating in its maker community.",
    notice: "This is a general product draft, not legal advice. Before public launch, have the terms reviewed and adapted to the laws and business details that apply to LynoraLink.",
    sections: [
      ["Using LynoraLink", [
        "LynoraLink provides online tools for makers to create profiles, discover projects, share progress, and communicate with other members. These terms apply when you access the service or use its features.",
        "Use the platform lawfully and respectfully, follow the rules in these terms, and do not interfere with other members’ access or with the operation of the service.",
      ]],
      ["Eligibility and your account", [
        "You are responsible for providing information that is accurate to the best of your knowledge and for keeping your sign-in credentials secure. Do not share credentials or allow another person to use your account in a way that compromises its security.",
        "Activity carried out through your account is your responsibility. If you suspect that someone else has accessed it, contact the team promptly so the issue can be reviewed.",
      ]],
      ["Your content and permissions", [
        "You retain ownership of content and project materials that you create and submit. You are responsible for having the rights and permissions needed to publish them.",
        "To operate the features you choose to use, you allow LynoraLink to host, reproduce, display, and transmit your submitted content as needed within the service. This permission is limited to providing and maintaining those features; it does not transfer ownership of your work.",
        "Respect the intellectual-property, privacy, and other rights of others. Do not publish another person’s work as your own or disclose information you are not authorized to share.",
      ]],
      ["Community standards", [
        "Do not use LynoraLink to harass, threaten, target, or provoke others; impersonate a person or organization; defraud or spam members; distribute unlawful or sexually explicit material; or disrupt the service.",
        "Keep community-feed posts relevant to building products, projects, and collaboration. Direct commercial offers, prices, and sales pitches belong in the Marketplace rather than the community feed. These standards also apply to team pages and team publications.",
        "Members are responsible for assessing collaboration proposals, verifying relevant details, and agreeing directly on the scope, ownership, payment, and other terms of any work together.",
      ]],
      ["Marketplace and transactions", [
        "The Marketplace provides listings and contact tools. Buyers and sellers communicate, negotiate, and complete any transaction directly with one another.",
        "LynoraLink does not collect payment for Marketplace transactions, deliver goods or services, verify every listing, or guarantee that a transaction or collaboration will be completed. Before proceeding, independently assess the other party, the offer, and any agreement.",
      ]],
      ["Moderation and reports", [
        "Automated systems may hold or hide content that appears to breach these terms, and moderators may review reports and relevant context. A review may result in content restrictions or account-level action.",
        "Repeated high-confidence violations may lead to a temporary suspension. Severe or confirmed violations may lead to longer restrictions or a ban. Team publications may be held for review, and their authors or team owners may be contacted.",
        "If you believe an account restriction was applied in error, contact the team to request a review. Include enough information to identify the restriction; do not send passwords or other sensitive credentials.",
      ]],
      ["Service availability and changes", [
        "Features may change as LynoraLink develops. We may update, suspend, or retire a feature, and will make reasonable efforts to keep the service available.",
        "The service may be interrupted for maintenance, security, technical issues, or circumstances beyond our control. Continuous, uninterrupted, or error-free operation cannot be guaranteed.",
      ]],
      ["Suspension, termination, and account requests", [
        "Access may be restricted where reasonably necessary to protect members, comply with law, address misuse, or maintain the service. The response may depend on the nature and seriousness of the issue.",
        "You may stop using LynoraLink at any time. To request account-specific changes or deletion, contact the team through the Contact page. A deletion request may be subject to applicable legal or security requirements.",
      ]],
      ["Disclaimers and responsibility", [
        "To the extent permitted by applicable law, LynoraLink is provided without a guarantee that every project, introduction, listing, or collaboration will be suitable or meet your expectations. Members make their own decisions when interacting or entering agreements with one another.",
        "Nothing in these terms limits a right or responsibility that cannot lawfully be limited. The legal effect of these terms depends on the law applicable to your use of the service.",
      ]],
      ["Changes to these terms", [
        "These terms may be revised as the service, its features, or applicable requirements change. The latest version will be published on this page.",
        "If you continue using LynoraLink after revised terms take effect, your use is subject to the version then published, to the extent permitted by applicable law.",
      ]],
    ],
  },
  fr: {
    eyebrow: "Informations juridiques",
    title: "Conditions d’utilisation",
    description: "Ces conditions présentent les règles de base pour utiliser LynoraLink et participer à sa communauté de makers.",
    notice: "Ce texte est un projet d’information générale, pas un avis juridique. Avant une mise en ligne publique, faites-le relire et adaptez-le au droit applicable et à la situation réelle de LynoraLink.",
    sections: [
      ["Utilisation de LynoraLink", [
        "LynoraLink propose des outils en ligne permettant aux makers de créer un profil, découvrir des projets, partager leurs avancées et échanger avec d’autres membres. Ces conditions s’appliquent lorsque vous accédez au service ou utilisez ses fonctionnalités.",
        "Utilisez la plateforme conformément à la loi et dans le respect des autres membres. Vous ne devez pas perturber leur accès ni le fonctionnement du service.",
      ]],
      ["Éligibilité et compte", [
        "Vous êtes responsable de fournir, à votre connaissance, des informations exactes et de protéger vos identifiants de connexion. Ne partagez pas vos identifiants et ne laissez pas une autre personne utiliser votre compte d’une manière qui compromet sa sécurité.",
        "Vous êtes responsable de l’activité réalisée depuis votre compte. Si vous pensez qu’une autre personne y a accédé, contactez rapidement l’équipe afin que la situation puisse être examinée.",
      ]],
      ["Vos contenus et autorisations", [
        "Vous restez propriétaire des contenus et éléments de projet que vous créez et soumettez. Il vous appartient de disposer des droits et autorisations nécessaires à leur publication.",
        "Pour faire fonctionner les outils que vous choisissez d’utiliser, vous autorisez LynoraLink à héberger, reproduire, afficher et transmettre vos contenus dans la mesure nécessaire au service. Cette autorisation sert à fournir et maintenir les fonctionnalités concernées; elle ne transfère pas la propriété de vos créations.",
        "Respectez la propriété intellectuelle, la vie privée et les autres droits d’autrui. Ne publiez pas le travail d’une autre personne comme s’il était le vôtre et ne divulguez pas d’informations que vous n’êtes pas autorisé à partager.",
      ]],
      ["Règles de la communauté", [
        "N’utilisez pas LynoraLink pour harceler, menacer, cibler ou provoquer autrui; usurper l’identité d’une personne ou d’une organisation; frauder ou envoyer du spam; diffuser des contenus illégaux ou sexuellement explicites; ou perturber le service.",
        "Les publications du fil communautaire doivent concerner la création de produits, les projets et la collaboration. Les offres commerciales directes, les prix et les propositions de vente doivent être publiés sur le Marketplace, pas dans le fil. Ces règles s’appliquent aussi aux pages et publications des équipes.",
        "Chaque membre est responsable d’évaluer les propositions de collaboration, de vérifier les informations pertinentes et de convenir directement du périmètre, de la propriété, du paiement et des autres conditions de tout travail commun.",
      ]],
      ["Marketplace et transactions", [
        "Le Marketplace fournit des annonces et des outils de contact. Les acheteurs et vendeurs échangent, négocient et réalisent toute transaction directement entre eux.",
        "LynoraLink n’encaisse pas les paiements des transactions du Marketplace, ne livre aucun produit ou service, ne vérifie pas chaque annonce et ne garantit pas la réalisation d’une transaction ou d’une collaboration. Avant de vous engager, évaluez de manière indépendante l’autre partie, l’offre et les conditions convenues.",
      ]],
      ["Modération et signalements", [
        "Des systèmes automatiques peuvent retenir ou masquer un contenu susceptible d’enfreindre ces conditions; les modérateurs peuvent examiner les signalements et leur contexte. Cet examen peut entraîner des restrictions visant le contenu ou le compte.",
        "Des violations répétées détectées avec un niveau de confiance élevé peuvent entraîner une suspension temporaire. Des violations graves ou confirmées peuvent entraîner des restrictions plus longues ou un bannissement. Les publications d’équipe peuvent être retenues pour examen et leurs auteurs ou responsables peuvent être contactés.",
        "Si vous pensez qu’une restriction de compte a été appliquée par erreur, contactez l’équipe pour en demander le réexamen. Fournissez assez d’informations pour identifier la restriction, mais ne transmettez jamais de mot de passe ni d’identifiant secret.",
      ]],
      ["Disponibilité et évolution du service", [
        "Les fonctionnalités peuvent évoluer avec LynoraLink. Une fonctionnalité peut être modifiée, suspendue ou retirée; nous ferons des efforts raisonnables pour maintenir le service accessible.",
        "Le service peut être interrompu pour des raisons de maintenance, de sécurité, de difficultés techniques ou de circonstances indépendantes de notre volonté. Un fonctionnement continu, ininterrompu ou sans erreur ne peut être garanti.",
      ]],
      ["Restriction, fermeture et demandes de compte", [
        "L’accès peut être restreint lorsque cela est raisonnablement nécessaire pour protéger les membres, respecter la loi, traiter un abus ou maintenir le service. La réponse dépend notamment de la nature et de la gravité de la situation.",
        "Vous pouvez cesser d’utiliser LynoraLink à tout moment. Pour demander une modification ou la suppression de votre compte, contactez l’équipe via la page Contact. Une demande de suppression peut être soumise aux obligations légales ou de sécurité applicables.",
      ]],
      ["Responsabilité et garanties", [
        "Dans les limites autorisées par le droit applicable, LynoraLink est fourni sans garantie que chaque projet, mise en relation, annonce ou collaboration vous conviendra ou répondra à vos attentes. Les membres prennent leurs propres décisions lorsqu’ils interagissent ou concluent un accord entre eux.",
        "Aucune disposition de ces conditions ne limite un droit ou une responsabilité qui ne peut légalement être limité. L’effet juridique de ces conditions dépend du droit applicable à votre utilisation du service.",
      ]],
      ["Modification des conditions", [
        "Ces conditions peuvent être révisées à mesure que le service, ses fonctionnalités ou les exigences applicables évoluent. La version la plus récente sera publiée sur cette page.",
        "Si vous continuez à utiliser LynoraLink après l’entrée en vigueur de conditions révisées, votre utilisation est soumise à la version alors publiée, dans la mesure permise par le droit applicable.",
      ]],
    ],
  },
} as const;

export default function TermsPage() {
  const { locale } = useTranslation();
  const content = locale === "fr" ? terms.fr : terms.en;
  const sections = content.sections.map(([title, body], index) => ({
    id: `terms-${index + 1}`,
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
        contentsLabel={locale === "fr" ? "Dans ces conditions" : "In these terms"}
        notice={content.notice}
        updatedAt={locale === "fr" ? "Dernière mise à jour : 10 novembre 2026." : "Last updated: November 10, 2026."}
        contactPrompt={locale === "fr" ? "Pour toute question concernant ces conditions, contactez l’équipe LynoraLink." : "If you have questions about these terms, contact the LynoraLink team."}
        contactLabel={locale === "fr" ? "Contacter l’équipe" : "Contact the team"}
      />
    </InfoPageShell>
  );
}