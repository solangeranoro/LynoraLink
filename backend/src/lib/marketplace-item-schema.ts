import { z } from "zod";

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

export const marketplaceItemSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(500).max(10000),
  type: z.enum(["TEMPLATE", "MICRO_SAAS", "SERVICE"]),
  priceCents: z.number().int().min(50).max(99999999),
  currency: z.literal("usd").default("usd"),
  productUrl: httpUrl,
  pitch: z.string().trim().min(10).max(180),
  language: z.string().min(2).max(16),
  sellerCity: z.string().trim().max(100),
  deliveryUrl: httpUrl.optional(),
  includedItems: z.object({
    sourceCodeUrl: urlOrEmpty,
    websiteUrl: urlOrEmpty,
    domain: z.string().max(255),
    visualUrls: urlList,
    socialAccounts: z.object({
      facebook: urlOrEmpty,
      instagram: urlOrEmpty,
      tiktok: urlOrEmpty,
      youtube: urlOrEmpty,
      x: urlOrEmpty,
      linkedin: urlOrEmpty,
      discord: urlOrEmpty,
      telegram: urlOrEmpty,
      subreddit: urlOrEmpty,
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
