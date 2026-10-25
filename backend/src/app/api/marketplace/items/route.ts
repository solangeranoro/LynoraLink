import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/admin";
import { hasVerifiedAccount } from "@/lib/verified-account";

const httpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value));
const urlOrEmpty = httpUrl.or(z.literal(""));
const urlList = z.array(httpUrl).max(20);
const detailSchemas = {
  MICRO_SAAS: z.object({
    stack: z.array(z.string().min(1).max(80)).min(1).max(30),
    integrations: z.array(z.string().min(1).max(80)).max(30),
    createdYear: z.number().int().min(1990).max(new Date().getFullYear() + 1),
    category: z.string().trim().min(2).max(80),
    screenshots: urlList.min(1),
    documentationUrl: z.string().url(),
  }).strict(),
  TEMPLATE: z.object({
    templateType: z.enum(["UI/UX", "Site web", "Application mobile", "Dashboard"]),
    technologies: z.array(z.string().min(1).max(80)).min(1).max(30),
    license: z.enum(["PERSONAL", "COMMERCIAL", "BOTH"]),
    includedCount: z.number().int().min(1).max(10000),
    previews: urlList.min(1),
    documentationUrl: z.string().url(),
  }).strict(),
  SERVICE: z.object({
    serviceType: z.enum(["Design", "Développement", "Marketing", "Consulting"]),
    experience: z.string().trim().min(10).max(3000),
    portfolioUrl: urlOrEmpty,
    modalities: z.string().trim().min(2).max(500),
    tools: z.array(z.string().min(1).max(80)).min(1).max(30),
    caseStudies: z.string().trim().min(20).max(3000),
    supportTerms: z.string().trim().min(10).max(2000),
  }).strict(),
} as const;

const itemSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(500).max(10000),
  type: z.enum(["TEMPLATE", "MICRO_SAAS", "SERVICE"]),
  priceCents: z.number().int().min(50).max(99999999),
  currency: z.literal("usd").default("usd"),
  productUrl: z.string().url(),
  pitch: z.string().trim().min(10).max(180),
  language: z.string().min(2).max(16),
  sellerCity: z.string().trim().max(100),
  deliveryUrl: z.string().url(),
  includedItems: z.object({
    sourceCodeUrl: urlOrEmpty,
    websiteUrl: urlOrEmpty,
    domain: z.string().max(255),
    visualUrls: urlList,
    socialAccounts: z.object({
      facebook: urlOrEmpty, instagram: urlOrEmpty, tiktok: urlOrEmpty, youtube: urlOrEmpty,
      x: urlOrEmpty, linkedin: urlOrEmpty, discord: urlOrEmpty, telegram: urlOrEmpty, subreddit: urlOrEmpty,
    }).strict(),
  }).strict(),
  audience: z.object({
    followers: z.number().int().min(0).max(1000000000000),
    monthlyViews: z.number().int().min(0).max(1000000000000),
    trafficSource: z.string().trim().min(2).max(500),
    geographicDistribution: z.string().trim().max(2000),
    gscProperty: urlOrEmpty,
  }).strict(),
  financial: z.object({
    monthlyRevenueUsd: z.number().finite().min(0).max(1000000000000),
    annualCostsUsd: z.number().finite().min(0).max(1000000000000),
    revenueSources: z.array(z.enum(["ADS", "AFFILIATE", "SALES", "SUBSCRIPTION", "SPONSORSHIP"])).min(1),
    businessModel: z.enum(["MRR", "ONE_SHOT"]),
  }).strict(),
  details: z.record(z.unknown()),
  photos: urlList,
  complianceAccepted: z.literal(true),
}).strict().superRefine((value, context) => {
  const included = value.includedItems;
  if (![included.sourceCodeUrl, included.websiteUrl, included.domain, ...included.visualUrls, ...Object.values(included.socialAccounts)].some(Boolean)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["includedItems"], message: "At least one asset must be included" });
  }
  const parsedDetails = detailSchemas[value.type].safeParse(value.details);
  if (!parsedDetails.success) {
    for (const issue of parsedDetails.error.issues) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["details", ...issue.path], message: issue.message });
    }
  }
});

export async function GET(request: Request) {
  const session = await auth();
  const mine = new URL(request.url).searchParams.get("mine") === "1";
  if (mine && !session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (mine && !await hasVerifiedAccount(session!.user!.id)) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }

  const items = await prisma.marketplaceItem.findMany({
    where: mine ? { sellerId: session!.user!.id } : {
      isActive: true,
      moderationStatus: "APPROVED",
      seller: {
        OR: [
          { email: ADMIN_EMAIL },
          {
            emailVerified: { not: null },
            marketplaceVerification: { is: {
              emailVerifiedAt: { not: null },
              OR: [
                { status: { in: ["active", "on_trial", "trialing"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
                { status: { in: ["canceled", "cancelled"] }, currentPeriodEnd: { gt: new Date() } },
              ],
            } },
          },
        ],
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      priceCents: true,
      currency: true,
      isActive: true,
      isFeatured: true,
      ...(mine ? { moderationStatus: true } : {}),
      imageUrl: true,
      sellerId: true,
      productUrl: true,
      pitch: true,
      language: true,
      sellerCity: true,
      photos: true,
      createdAt: true,
      seller: { select: { id: true, name: true, image: true, handle: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!await hasVerifiedAccount(userId)) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_ITEM", issues: parsed.error.flatten().fieldErrors }, { status: 422 });

  const { includedItems, audience, financial, details, photos, ...itemData } = parsed.data;
  const item = await prisma.marketplaceItem.create({
    data: {
      ...itemData,
      imageUrl: photos[0] ?? null,
      includedItems: includedItems as Prisma.InputJsonValue,
      audience: audience as Prisma.InputJsonValue,
      financial: financial as Prisma.InputJsonValue,
      details: details as Prisma.InputJsonValue,
      photos,
      isActive: false,
      complianceAccepted: true,
      complianceAcceptedAt: new Date(),
      sellerId: userId,
    },
    select: { id: true, title: true, description: true, type: true, priceCents: true, currency: true, imageUrl: true, productUrl: true, sellerId: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ item }, { status: 201 });
}