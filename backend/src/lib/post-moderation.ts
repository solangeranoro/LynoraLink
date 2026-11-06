import type { ModerationCategory } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export type PostModerationAssessment = {
  category: ModerationCategory;
  confidence: number;
  reason: string;
  status: "PENDING" | "REJECTED";
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR");
}

export function assessPostContent(content: string, tags: string[] = []): PostModerationAssessment | null {
  const text = normalizeText(`${content}\n${tags.join(" ")}`);

  const directSaleIntent = /\b(?:a vendre|for sale|buy now|achetez|commandez|order now|dm to buy|contactez moi pour acheter|disponible a l'achat|prix de vente)\b/.test(text);
  const purchaseDetails = /(?:\b\d+(?:[.,]\d{1,2})?\s?(?:€|\$|eur|usd|fcfa|xof)\b|(?:€|\$)\s?\d|\b(?:whatsapp|telegram|dm|mp|inbox)\b)/.test(text);
  if (directSaleIntent && purchaseDetails) {
    return {
      category: "DIRECT_SALE",
      confidence: 96,
      reason: "Appel à l’achat ou vente directe détecté dans le fil. Les offres commerciales doivent passer par le marketplace.",
      status: "REJECTED",
    };
  }

  if (/\b(?:kill yourself|you should die|i will kill you|go die|je vais te tuer|va mourir|suicide toi|je vais te harceler)\b/.test(text)) {
    return {
      category: "HARASSMENT",
      confidence: 98,
      reason: "Menace explicite ou appel à l’automutilation détecté.",
      status: "REJECTED",
    };
  }

  if (/\b(?:pornographie|pornographique|contenu porno|services sexuels|nudes a vendre|sexual services|pornographic content)\b/.test(text)) {
    return {
      category: "SEXUAL_CONTENT",
      confidence: 95,
      reason: "Contenu sexuel explicite ou offre de services sexuels détecté.",
      status: "REJECTED",
    };
  }

  if (/\b(?:harcelez|harceler|attack them|go attack|appelez a l'attaque|let's harass)\b/.test(text)) {
    return {
      category: "PROVOCATION",
      confidence: 84,
      reason: "Appel à cibler, harceler ou attaquer une personne détecté.",
      status: "PENDING",
    };
  }

  const makerContext = /\b(?:build|builder|building|code|coding|saas|startup|software|app|application|produit|projet|developpement|developper|programme|logiciel|lancement|maker|co-build)\b/.test(text);
  if (!makerContext && /\b(?:election|politique|parti politique|religion|priere|casino|paris sportifs|rencontre amoureuse|match de football|football|basketball|recette|cuisine|voyage|vacances|musique|concert|celebrite|celebrity|movie review)\b/.test(text)) {
    return {
      category: "OFF_TOPIC",
      confidence: 68,
      reason: "Le sujet semble éloigné de la construction de projets et du co-building. Une vérification humaine est nécessaire.",
      status: "PENDING",
    };
  }

  return null;
}

export async function notifyTeamModerationReview(teamOwnerId: string | undefined, authorId: string, teamId: string | undefined) {
  if (!teamOwnerId || !teamId || teamOwnerId === authorId) return;
  try {
    await createNotification(teamOwnerId, authorId, "TEAM_MODERATION_ALERT", teamId);
  } catch (error) {
    console.error("Unable to notify the team owner about a moderation review:", error);
  }
}

export async function applyAutomaticAccountRestriction(userId: string, assessment: PostModerationAssessment | null) {
  if (!assessment || assessment.status !== "REJECTED" || assessment.confidence < 95) return null;

  const now = new Date();
  const violationCount = await prisma.postModerationCase.count({
    where: {
      subjectId: userId,
      confidence: { gte: 95 },
      status: { in: ["OPEN", "CONFIRMED"] },
      createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    },
  });
  if (violationCount < 3) return null;

  const days = violationCount >= 5 ? 30 : 7;
  const suspendedUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: "SUSPENDED",
      suspendedUntil,
      accountStatusReason: `Suspension automatique de ${days} jours après ${violationCount} violations à forte confiance en 30 jours : ${assessment.reason}`,
    },
  });
  return { days, suspendedUntil };
}
