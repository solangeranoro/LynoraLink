import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/admin-config";

const WELCOME_MESSAGE_PREFIXES = [
  "Bienvenue sur LynoraLink,",
  "Welcome to LynoraLink,",
];

export function isWelcomeMessageContent(content: string) {
  return WELCOME_MESSAGE_PREFIXES.some((prefix) => content.startsWith(prefix));
}

export async function findPlatformWelcomeConversations(conversationIds: string[]) {
  if (conversationIds.length === 0) return { adminId: null, conversationIds: new Set<string>() };

  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  if (!admin) return { adminId: null, conversationIds: new Set<string>() };

  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      senderId: admin.id,
      OR: WELCOME_MESSAGE_PREFIXES.map((prefix) => ({ content: { startsWith: prefix } })),
    },
    select: { conversationId: true },
    distinct: ["conversationId"],
  });

  return { adminId: admin.id, conversationIds: new Set(messages.map((message) => message.conversationId)) };
}

function welcomeContent(name: string | null, preferredLang: "EN" | "FR") {
  const greetingName = name?.trim() || "maker";
  if (preferredLang === "FR") {
    return `Bienvenue sur LynoraLink, ${greetingName}.

Nous sommes ravis de vous accueillir au sein de notre communauté de makers. LynoraLink vous aide à présenter vos compétences, rencontrer des collaborateurs et faire avancer vos projets.

Pour bien démarrer :
• Complétez votre profil afin de mettre en valeur votre expérience et vos compétences.
• Découvrez des makers qui partagent vos intérêts.
• Présentez une idée ou rejoignez une équipe pour construire ensemble.

Nous vous souhaitons une excellente expérience sur LynoraLink.

— L’équipe LynoraLink`;
  }

  return `Welcome to LynoraLink, ${greetingName}.

We’re pleased to welcome you to our maker community. LynoraLink helps you showcase your skills, meet collaborators, and move your projects forward.

Here are a few ways to get started:
• Complete your profile to highlight your experience and skills.
• Discover makers who share your interests.
• Share an idea or join a team to build something together.

We hope you enjoy your experience on LynoraLink.

— The LynoraLink team`;
}

export async function createWelcomeMessage(userId: string) {
  const [recipient, admin] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, preferredLang: true },
    }),
    prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { id: true },
    }),
  ]);
  if (!recipient) throw new Error("Cannot send welcome message: newly registered user was not found.");
  if (!admin) throw new Error("Cannot send welcome message: platform admin account was not found.");
  if (recipient.id === admin.id) return;

  const language = recipient.preferredLang === "FR" ? "FR" : "EN";
  const content = welcomeContent(recipient.name, language);

  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.conversation.findFirst({
      where: {
        isGroup: false,
        members: { some: { userId: admin.id } },
        AND: [
          { members: { some: { userId: recipient.id } } },
          { members: { every: { userId: { in: [admin.id, recipient.id] } } } },
        ],
      },
      select: { id: true },
    });
    const conversation = existing ?? await transaction.conversation.create({
      data: {
        isGroup: false,
        members: { create: [{ userId: admin.id }, { userId: recipient.id }] },
      },
      select: { id: true },
    });

    const alreadySent = await transaction.message.findFirst({
      where: {
        conversationId: conversation.id,
        senderId: admin.id,
        OR: [
          ...WELCOME_MESSAGE_PREFIXES.map((prefix) => ({ content: { startsWith: prefix } })),
        ],
      },
      select: { id: true },
    });
    if (alreadySent) return;

    await transaction.message.create({
      data: { conversationId: conversation.id, senderId: admin.id, content },
    });
    await transaction.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    await transaction.conversationMember.update({
      where: { conversationId_userId: { conversationId: conversation.id, userId: admin.id } },
      data: { lastReadAt: new Date() },
    });
  });
}
