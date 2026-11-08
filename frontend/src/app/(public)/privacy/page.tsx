"use client";

import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

const privacyContent = {
  en: {
    eyebrow: "Privacy",
    title: "Privacy policy",
    description: "How LynoraLink handles account information and approximate country-level location.",
    sections: [
      ["Approximate country location", "When you successfully sign in, we process your IP address through ipinfo.io to determine an approximate country. We collect this information to improve usage statistics and understand the geographic distribution of our community. The result is an ISO country code stored on your account; LynoraLink does not store the raw IP address. If the IP address cannot be resolved, the country is recorded as Unknown. This is an approximate estimate and may be affected by VPNs or network routing."],
      ["Third-party processing", "To obtain the country estimate, the IP address is sent to ipinfo.io for lookup. LynoraLink only stores the country code returned by the service. Please consult ipinfo.io’s privacy information for details about its processing."],
      ["Questions", "For questions about this information or your account data, contact us through the Contact page."],
    ],
  },
  fr: {
    eyebrow: "Confidentialité",
    title: "Politique de confidentialité",
    description: "Comment LynoraLink traite les informations de compte et la localisation approximative au niveau du pays.",
    sections: [
      ["Localisation approximative par pays", "Nous collectons automatiquement votre localisation approximative (pays) via votre adresse IP afin d’améliorer nos statistiques d’utilisation. Lors d’une connexion réussie, l’adresse IP est transmise à ipinfo.io pour déterminer le pays approximatif. LynoraLink ne conserve pas l’adresse IP brute : seul le code ISO du pays est enregistré dans votre profil. Si l’adresse IP est masquée ou ne peut pas être résolue, le pays reste « Inconnu ». Cette estimation peut être affectée par l’utilisation d’un VPN ou le routage réseau."],
      ["Traitement par un service tiers", "Pour obtenir cette estimation, l’adresse IP est envoyée à ipinfo.io. LynoraLink ne conserve que le code pays renvoyé par le service. Consultez les informations de confidentialité d’ipinfo.io pour en savoir plus sur son traitement."],
      ["Questions", "Pour toute question sur ces informations ou les données de votre compte, contactez-nous via la page Contact."],
    ],
  },
} as const;

export default function PrivacyPage() {
  const { locale } = useTranslation();
  const content = locale === "fr" ? privacyContent.fr : privacyContent.en;

  return (
    <InfoPageShell eyebrow={content.eyebrow} title={content.title} description={content.description}>
      {content.sections.map(([title, body]) => (
        <section key={title}>
          <h2 className="font-display text-lg font-semibold text-[#14273a]">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-[#526779]">{body}</p>
        </section>
      ))}
    </InfoPageShell>
  );
}
