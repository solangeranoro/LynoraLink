"use client";

import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

const cookieInfo = {
  en: {
    eyebrow: "Privacy and preferences",
    title: "Cookies and browser storage",
    description: "A clear overview of the small amount of browser storage LynoraLink uses to keep sign-in and your preferences working.",
    sections: [
      ["Essential authentication cookies", "When you sign in, the authentication service uses cookies to maintain your session and protect sign-in flows. These cookies are required for account access and are not used for advertising."],
      ["Language preference", "Your selected interface language is saved in your browser’s local storage under lynora.locale so the site can remember English or French on your next visit. This is browser storage, not a tracking cookie."],
      ["Appearance preference", "If you change the theme or font size in settings, those preferences are saved in local storage under lynora.settings.appearance. They stay on your device and are used to restore your chosen appearance."],
      ["Third-party sign-in", "If you choose Google or Facebook sign-in, those providers may process information or use their own cookies as part of authentication. Their handling is governed by their respective privacy and cookie policies."],
      ["Your choices", "You can clear cookies and local storage through your browser settings. Clearing essential authentication cookies will sign you out; clearing preference storage will reset the saved language and appearance choices."],
      ["Changes to this page", "If the storage used by LynoraLink changes, this page will be updated to describe the change."],
    ],
  },
  fr: {
    eyebrow: "Vie privée et préférences",
    title: "Cookies et stockage du navigateur",
    description: "Voici les éléments de stockage utilisés par LynoraLink pour maintenir la connexion et mémoriser vos préférences.",
    sections: [
      ["Cookies indispensables à l’authentification", "Lors de la connexion, le service d’authentification utilise des cookies pour maintenir votre session et sécuriser le parcours de connexion. Ils sont nécessaires à l’accès au compte et ne servent pas à la publicité."],
      ["Préférence de langue", "La langue choisie est enregistrée dans le stockage local du navigateur sous lynora.locale afin de mémoriser le français ou l’anglais lors de votre prochaine visite. Il s’agit de stockage navigateur, pas d’un cookie de suivi."],
      ["Préférence d’apparence", "Si vous modifiez le thème ou la taille du texte dans les paramètres, ces choix sont enregistrés dans le stockage local sous lynora.settings.appearance. Ils restent sur votre appareil et servent à restaurer l’apparence choisie."],
      ["Connexion par un service tiers", "Si vous choisissez Google ou Facebook pour vous connecter, ces fournisseurs peuvent traiter des informations ou utiliser leurs propres cookies dans le cadre de l’authentification. Leur traitement est régi par leurs politiques de confidentialité et de cookies respectives."],
      ["Vos choix", "Vous pouvez effacer les cookies et le stockage local depuis les réglages de votre navigateur. La suppression des cookies d’authentification vous déconnectera; celle des préférences réinitialisera la langue et l’apparence enregistrées."],
      ["Évolution de cette page", "Si les mécanismes de stockage de LynoraLink évoluent, cette page sera mise à jour pour expliquer les changements."],
    ],
  },
} as const;

export default function CookiesPage() {
  const { locale } = useTranslation();
  const content = locale === "fr" ? cookieInfo.fr : cookieInfo.en;

  return (
    <InfoPageShell eyebrow={content.eyebrow} title={content.title} description={content.description}>
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