"use client";

import { InfoPageShell } from "@/components/InfoPageShell";
import { EditorialInfoLayout } from "@/components/EditorialInfoLayout";
import { useTranslation } from "@/lib/i18n";

const cookieInfo = {
  en: {
    eyebrow: "Privacy and preferences",
    title: "Cookies and browser storage",
    description: "A clear overview of the small amount of browser storage LynoraLink uses to keep sign-in and your preferences working.",
    sections: [
      ["What this page covers", [
        "This notice explains the browser storage currently described for LynoraLink: authentication cookies and local preferences. Cookies are small pieces of data managed by your browser; local storage is a separate browser feature that can retain values between visits.",
        "The exact cookies used to maintain a sign-in may depend on the authentication service and the sign-in flow you choose. This page does not claim that third-party providers use no additional storage.",
      ]],
      ["Authentication cookies", [
        "When you sign in, authentication cookies help maintain your session and protect the sign-in flow. They support access to your account and are not a preference setting that you can remove while remaining signed in.",
        "If you delete these cookies through your browser, your session may end and you may need to sign in again. Their lifetime is managed by the authentication service and browser; it is not specified here as a fixed duration.",
      ]],
      ["Language preference", [
        "LynoraLink saves your selected interface language in browser local storage under the key lynora.locale. This lets the site remember your choice of French or English on a later visit.",
        "This value is stored by your browser on your device; it is not itself a tracking cookie. Removing site data from your browser resets the saved language preference.",
      ]],
      ["Appearance preference", [
        "When you choose appearance settings, LynoraLink stores them in browser local storage under lynora.settings.appearance so the selected appearance can be restored.",
        "This preference remains in the browser until you remove it or clear the site’s stored data. Clearing it resets the saved appearance; it does not delete your LynoraLink account.",
      ]],
      ["Third-party sign-in", [
        "If you choose to sign in through an external identity provider, that provider may use cookies or other browser storage to complete authentication and apply its own security controls.",
        "Those technologies are managed by the provider, not by this preference notice. Consult the provider’s cookie and privacy information for details about its storage and choices.",
      ]],
      ["Managing browser storage", [
        "Your browser settings let you inspect or remove cookies and local storage for a site. You can also use its privacy controls to clear stored site data.",
        "Removing authentication cookies may sign you out. Removing local storage resets saved language and appearance preferences. Browser controls and names vary by browser and version.",
      ]],
      ["Changes and questions", [
        "If the browser storage used by LynoraLink changes, this page will be updated to describe the known change. Check this page periodically for the current explanation.",
        "For questions about cookies, browser storage, or your account, contact the LynoraLink team through the Contact page.",
      ]],
    ],
  },
  fr: {
    eyebrow: "Vie privée et préférences",
    title: "Cookies et stockage du navigateur",
    description: "Voici les éléments de stockage utilisés par LynoraLink pour maintenir la connexion et mémoriser vos préférences.",
    sections: [
      ["Objet de cette page", [
        "Cette notice explique les mécanismes de stockage navigateur décrits pour LynoraLink : les cookies d’authentification et les préférences locales. Un cookie est une petite donnée gérée par le navigateur; le stockage local est une fonction distincte qui peut conserver des valeurs entre les visites.",
        "Les cookies exacts utilisés pour maintenir une connexion peuvent dépendre du service d’authentification et du parcours choisi. Cette page ne prétend pas que les fournisseurs tiers n’utilisent aucun autre mécanisme de stockage.",
      ]],
      ["Cookies d’authentification", [
        "Lors de la connexion, des cookies d’authentification contribuent au maintien de la session et à la sécurisation du parcours. Ils permettent l’accès au compte et ne correspondent pas à un simple réglage de préférence que vous pourriez supprimer tout en restant connecté.",
        "Si vous supprimez ces cookies dans votre navigateur, votre session peut prendre fin et vous devrez peut-être vous reconnecter. Leur durée dépend du service d’authentification et du navigateur; aucune durée fixe n’est indiquée ici.",
      ]],
      ["Préférence de langue", [
        "LynoraLink enregistre la langue choisie dans le stockage local du navigateur sous la clé lynora.locale. Le site peut ainsi mémoriser votre choix du français ou de l’anglais lors d’une prochaine visite.",
        "Cette valeur est conservée par le navigateur sur votre appareil; elle n’est pas en elle-même un cookie de suivi. La suppression des données du site réinitialise cette préférence.",
      ]],
      ["Préférence d’apparence", [
        "Lorsque vous choisissez des paramètres d’apparence, LynoraLink les enregistre dans le stockage local du navigateur sous lynora.settings.appearance afin de pouvoir les restaurer.",
        "Cette préférence reste dans le navigateur jusqu’à sa suppression ou à l’effacement des données du site. Sa suppression réinitialise l’apparence enregistrée, mais ne supprime pas votre compte LynoraLink.",
      ]],
      ["Connexion par un service tiers", [
        "Si vous choisissez de vous connecter avec un fournisseur d’identité externe, celui-ci peut utiliser des cookies ou d’autres données navigateur pour réaliser l’authentification et appliquer ses propres mesures de sécurité.",
        "Ces mécanismes relèvent du fournisseur et non de cette notice. Consultez ses informations sur les cookies et la confidentialité pour connaître les détails de stockage et les choix disponibles.",
      ]],
      ["Gestion du stockage navigateur", [
        "Les réglages de votre navigateur vous permettent de consulter ou supprimer les cookies et le stockage local d’un site. Vous pouvez également utiliser ses fonctions de confidentialité pour effacer les données enregistrées.",
        "La suppression des cookies d’authentification peut vous déconnecter. La suppression du stockage local réinitialise les préférences de langue et d’apparence. Les commandes et leur nom varient selon le navigateur et sa version.",
      ]],
      ["Évolutions et questions", [
        "Si les mécanismes de stockage utilisés par LynoraLink changent, cette page sera mise à jour pour décrire les changements connus. Consultez-la régulièrement pour prendre connaissance de la version actuelle.",
        "Pour toute question sur les cookies, le stockage navigateur ou votre compte, contactez l’équipe LynoraLink via la page Contact.",
      ]],
    ],
  },
} as const;

export default function CookiesPage() {
  const { locale } = useTranslation();
  const content = locale === "fr" ? cookieInfo.fr : cookieInfo.en;
  const sections = content.sections.map(([title, body], index) => ({
    id: `cookies-${index + 1}`,
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
        contentsLabel={locale === "fr" ? "Dans cette page" : "On this page"}
        updatedAt={locale === "fr" ? "Dernière mise à jour : 10 novembre 2026." : "Last updated: November 10, 2026."}
        contactPrompt={locale === "fr" ? "Une question sur les cookies ou les préférences du navigateur ?" : "Have a question about cookies or browser preferences?"}
        contactLabel={locale === "fr" ? "Contacter l’équipe" : "Contact the team"}
      />
    </InfoPageShell>
  );
}