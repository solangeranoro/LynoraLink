"use client";

import Link from "next/link";
import { ChevronDown } from "@/components/FontAwesomeIcons";
import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

const questions = {
  en: [
    {
      question: "What is LynoraLink?",
      answer: "LynoraLink is a co-building space for indie makers and solopreneurs. Create a profile, discover projects, share progress, and talk with potential collaborators in one place.",
    },
    {
      question: "Who can join the community?",
      answer: "Anyone working on independent digital products can join: founders, developers, designers, marketers, product people, and others who want to contribute to a project.",
    },
    {
      question: "How do I get started?",
      answer: "Create an account, verify your email, and add a few details to your maker profile. Then browse projects or publish your own idea and describe the help you are looking for.",
    },
    {
      question: "How can I find a project to join?",
      answer: "Explore the project listings and review each project's stage, description, tags, team, and desired roles. If the project looks like a fit, message its creator to discuss expectations and next steps.",
    },
    {
      question: "Can I build in public on LynoraLink?",
      answer: "Yes. Share updates, questions, milestones, and lessons in the feed so other makers can follow your progress and respond. Do not post passwords, private customer data, or confidential business information.",
    },
    {
      question: "How do direct messages work?",
      answer: "Once signed in, you can start a one-to-one conversation with another maker from Messages. Use it to discuss a project, ask a question, or agree on how to collaborate.",
    },
    {
      question: "Can I use LynoraLink in French?",
      answer: "Yes. The interface is available in French and English. Use the language control in the landing-page header to switch languages; your choice is saved in this browser.",
    },
    {
      question: "Where can I ask for help or request account changes?",
      answer: "Use the Contact page to send a message to the LynoraLink team. For a password you cannot access, use the password-reset link on the sign-in page.",
    },
  ],
  fr: [
    {
      question: "Qu’est-ce que LynoraLink ?",
      answer: "LynoraLink est un espace de co-création pour les indie makers et les solopreneurs. Créez un profil, découvrez des projets, partagez vos avancées et échangez avec de potentiels partenaires au même endroit.",
    },
    {
      question: "Qui peut rejoindre la communauté ?",
      answer: "Toute personne qui crée un produit numérique indépendant peut rejoindre LynoraLink : fondateurs, développeurs, designers, marketeurs, spécialistes produit et autres personnes souhaitant contribuer à un projet.",
    },
    {
      question: "Comment commencer ?",
      answer: "Créez un compte, vérifiez votre adresse email et renseignez quelques informations sur votre profil maker. Vous pourrez ensuite explorer les projets ou présenter votre idée et les compétences recherchées.",
    },
    {
      question: "Comment trouver un projet à rejoindre ?",
      answer: "Parcourez les projets et consultez leur étape, leur description, leurs tags, leur équipe et les rôles recherchés. Si le projet vous correspond, écrivez à son créateur pour discuter des attentes et de la suite.",
    },
    {
      question: "Puis-je construire en public sur LynoraLink ?",
      answer: "Oui. Publiez des avancées, questions, étapes et apprentissages pour que les autres makers suivent votre progression et vous répondent. Ne partagez pas de mots de passe, de données privées de clients ou d’informations professionnelles confidentielles.",
    },
    {
      question: "Comment fonctionnent les messages privés ?",
      answer: "Une fois connecté, vous pouvez démarrer une conversation individuelle avec un maker depuis la page Messages. Servez-vous-en pour parler d’un projet, poser une question ou convenir des modalités d’une collaboration.",
    },
    {
      question: "LynoraLink est-il disponible en français ?",
      answer: "Oui. L’interface est disponible en français et en anglais. Utilisez le sélecteur de langue dans le header de la landing pour changer de langue; votre choix est mémorisé dans ce navigateur.",
    },
    {
      question: "Comment demander de l’aide ou modifier mon compte ?",
      answer: "Utilisez la page Contact pour écrire à l’équipe LynoraLink. Si vous ne pouvez plus accéder à votre mot de passe, utilisez le lien de réinitialisation sur la page de connexion.",
    },
  ],
} as const;

export default function FAQPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const entries = isFrench ? questions.fr : questions.en;

  return (
    <InfoPageShell
      eyebrow={isFrench ? "Réponses utiles" : "Helpful answers"}
      title="FAQ"
      description={isFrench
        ? "Les réponses aux questions fréquentes sur les profils, les projets et la collaboration sur LynoraLink."
        : "Answers to common questions about profiles, projects, and collaboration on LynoraLink."}
    >
      <div className="divide-y divide-[#d9e5ea] border-y border-[#d9e5ea]">
        {entries.map(({ question, answer }, index) => (
          <details key={question} className="group py-1" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-semibold text-[#14273a] marker:hidden sm:py-5 sm:text-lg">
              <span>{question}</span>
              <ChevronDown size={18} className="shrink-0 text-[#367586] transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="max-w-2xl pb-5 pr-8 text-sm leading-7 text-[#526779]">{answer}</p>
          </details>
        ))}
      </div>
      <section className="border-l-2 border-[#087d82] bg-white/70 px-5 py-4">
        <h2 className="font-display text-base font-semibold text-[#14273a]">
          {isFrench ? "Vous avez encore une question ?" : "Still have a question?"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#526779]">
          {isFrench ? "Écrivez-nous et l’équipe vous répondra." : "Send us a message and the team will get back to you."}
        </p>
        <Link href="/contact" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[#086f58] px-4 text-sm font-semibold text-[#071827] transition hover:bg-[#0a795e]">
          {isFrench ? "Contacter l’équipe" : "Contact the team"}
        </Link>
      </section>
    </InfoPageShell>
  );
}