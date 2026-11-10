"use client";

import { EditorialInfoLayout } from "@/components/EditorialInfoLayout";
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
    {
      question: "What should I include in my maker profile?",
      answer: "Add only information that helps other members understand your skills, interests, and the projects you want to build. Keep your details current, and do not include passwords, private customer information, or confidential business material.",
    },
    {
      question: "Who can see my profile and community posts?",
      answer: "Information you publish in profiles, projects, and community features is intended to help members discover and collaborate with one another. Treat content shared in those spaces as potentially visible to other members, and review each feature before posting sensitive details.",
    },
    {
      question: "Does LynoraLink process payments for Marketplace deals?",
      answer: "No. The Marketplace provides listings and contact tools; members arrange and complete transactions directly with one another. Verify the other party and agree on the terms before sharing work or making a payment.",
    },
    {
      question: "How do I report a problem or challenge a restriction?",
      answer: "Contact the LynoraLink team through the Contact page and explain what happened. If you are asking for a restriction to be reviewed, include enough context to identify it, but never send your password or authentication codes.",
    },
    {
      question: "Can I request deletion of my account?",
      answer: "Yes. Send an account-specific deletion request through the Contact page. The team may need to review the request and any applicable legal or security requirements before completing it.",
    },
    {
      question: "What browser information does LynoraLink save?",
      answer: "The site saves your language and appearance preferences in your browser’s local storage. Authentication cookies help maintain your sign-in. See the Cookies page for the storage keys, effects of clearing site data, and third-party sign-in notes.",
    },
    {
      question: "Why is a country shown on my account?",
      answer: "After a successful sign-in, LynoraLink uses ipinfo.io to estimate a country from the connecting IP address and stores the returned country code. It is an approximate estimate, can be affected by VPNs or network routing, and is not your precise location. See the Privacy page for details.",
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
    {
      question: "Que renseigner dans mon profil maker ?",
      answer: "Ajoutez les informations qui permettent aux autres membres de comprendre vos compétences, vos centres d’intérêt et les projets que vous souhaitez construire. Gardez votre profil à jour et n’y publiez ni mot de passe, ni donnée privée de client, ni information professionnelle confidentielle.",
    },
    {
      question: "Qui peut voir mon profil et mes publications ?",
      answer: "Les informations publiées dans les profils, les projets et les espaces communautaires servent à faciliter les rencontres et la collaboration. Considérez qu’elles peuvent être visibles par d’autres membres et vérifiez le fonctionnement de chaque espace avant d’y publier des informations sensibles.",
    },
    {
      question: "LynoraLink traite-t-il les paiements du Marketplace ?",
      answer: "Non. Le Marketplace fournit des annonces et des outils de contact; les membres organisent et réalisent directement leurs transactions. Vérifiez l’identité de votre interlocuteur et convenez des conditions avant de partager un travail ou d’effectuer un paiement.",
    },
    {
      question: "Comment signaler un problème ou contester une restriction ?",
      answer: "Contactez l’équipe LynoraLink via la page Contact et expliquez la situation. Pour demander le réexamen d’une restriction, donnez assez de contexte pour l’identifier, mais ne transmettez jamais votre mot de passe ni vos codes d’authentification.",
    },
    {
      question: "Puis-je demander la suppression de mon compte ?",
      answer: "Oui. Envoyez une demande de suppression de compte via la page Contact. L’équipe pourra examiner la demande ainsi que les éventuelles obligations légales ou de sécurité avant de la traiter.",
    },
    {
      question: "Quelles informations le navigateur mémorise-t-il ?",
      answer: "Le site enregistre vos préférences de langue et d’apparence dans le stockage local du navigateur. Les cookies d’authentification contribuent au maintien de votre connexion. Consultez la page Cookies pour connaître les clés de stockage, les effets de leur suppression et les informations sur les connexions tierces.",
    },
    {
      question: "Pourquoi un pays apparaît-il sur mon compte ?",
      answer: "Après une connexion réussie, LynoraLink utilise ipinfo.io pour estimer un pays à partir de l’adresse IP de connexion et enregistre le code pays renvoyé. Cette estimation est approximative, peut être affectée par un VPN ou le routage réseau, et ne correspond pas à votre position précise. La page Confidentialité donne plus de détails.",
    },
  ],
} as const;

export default function FAQPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const entries = isFrench ? questions.fr : questions.en;
  const sections = entries.map(({ question, answer }, index) => ({
    id: `question-${index + 1}`,
    title: question,
    body: answer,
  }));

  return (
    <InfoPageShell
      eyebrow={isFrench ? "Réponses utiles" : "Helpful answers"}
      title="FAQ"
      description={isFrench
        ? "Les réponses aux questions fréquentes sur les profils, les projets et la collaboration sur LynoraLink."
        : "Answers to common questions about profiles, projects, and collaboration on LynoraLink."}
      pageClassName="documentation-page"
      contentClassName="documentation-content !max-w-none !space-y-0"
    >
      <EditorialInfoLayout
        sections={sections}
        contentsLabel={isFrench ? "Questions fréquentes" : "Frequently asked"}
        questionLabel={isFrench ? "UNE AUTRE QUESTION ?" : "ANOTHER QUESTION?"}
        contactPrompt={isFrench ? "Notre équipe est là pour vous aider à avancer." : "Our team is here to help you move forward."}
        contactLabel={isFrench ? "Contacter l’équipe" : "Contact the team"}
      />
    </InfoPageShell>
  );
}