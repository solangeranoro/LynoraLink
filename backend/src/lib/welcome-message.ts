import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/admin-config";

function welcomeContent(name: string | null, preferredLang: "EN" | "FR") {
  const greetingName = name?.trim() || (preferredLang === "FR" ? "maker" : "maker");
  if (preferredLang === "FR") {
    return `Bienvenue sur LynoraLink, ${greetingName} ! 👋

Ici, les makers partagent leurs avancées, trouvent des co-builders et font grandir leurs projets ensemble.

Pour commencer :
• Complétez votre profil et ajoutez vos compétences.
• Découvrez des makers avec qui construire.
• Présentez votre projet ou rejoignez une équipe.

Au plaisir de découvrir ce que vous allez construire !
— L’équipe LynoraLink`;
  }

  return `Welcome to LynoraLink, ${greetingName}! 👋

This is where makers share progress, find co-builders, and bring projects to life together.

To get started:
• Complete your profile and add your skills.
• Discover makers to build with.
• Share your project or join a team.

Looking forward to seeing what you build!
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
      where: { conversationId: conversation.id, senderId: admin.id, content },
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
