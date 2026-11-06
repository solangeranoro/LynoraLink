import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/admin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendFirebasePushNotification } from "@/lib/firebase-push";
import { getFeedCutoffDate } from "@/lib/feed-retention";

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(20).max(5000),
  problem: z.string().trim().max(2000).optional().default(""),
  testInstructions: z.string().trim().min(20).max(3000),
  logoUrl: z.string().url().optional().nullable(),
  screenshotUrls: z.array(z.string().url()).max(6).default([]),
  platform: z.enum(["IOS", "ANDROID", "WEB", "DESKTOP"]),
  createdDate: z.string().date().optional().nullable(),
  websiteUrl: z.union([z.literal(""), z.string().url().refine(isHttpUrl)]).optional().default(""),
  downloadUrl: z.string().url().refine(isHttpUrl),
  technologies: z.string().trim().max(1000).optional().default(""),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email().max(254),
  ownerTitle: z.string().trim().min(2).max(120),
  ownerCity: z.string().trim().min(2).max(100),
  ownerCountry: z.string().trim().min(2).max(100),
  ownerPhone: z.string().trim().max(40).optional().default(""),
  ownerAddress: z.string().trim().min(5).max(500),
});

function isHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isCloudinaryUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".cloudinary.com");
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const searchParams = new URL(request.url).searchParams;
  const mine = searchParams.get("mine") === "1";
  const feedOnly = searchParams.get("feed") === "1";
  const takeParam = searchParams.get("take");
  const take = takeParam === null ? undefined : Number(takeParam);
  if (take !== undefined && (!Number.isSafeInteger(take) || take < 1 || take > 20)) {
    return NextResponse.json({ error: "INVALID_LIMIT" }, { status: 422 });
  }
  const applications = await prisma.testerApplication.findMany({
    where: mine
      ? { OR: [{ status: "APPROVED" }, { ownerId: userId }] }
      : {
        status: "APPROVED",
        ...(feedOnly ? {
          OR: [
            { reviewedAt: { gte: getFeedCutoffDate() } },
            { reviewedAt: null, createdAt: { gte: getFeedCutoffDate() } },
          ],
        } : {}),
      },
    select: {
      id: true,
      name: true,
      description: true,
      problem: true,
      logoUrl: true,
      screenshotUrls: true,
      platform: true,
      createdDate: true,
      websiteUrl: true,
      downloadUrl: true,
      technologies: true,
      ownerName: true,
      ownerTitle: true,
      ownerCity: true,
      ownerCountry: true,
      status: true,
      rejectionReason: true,
      shares: true,
      ownerId: true,
      createdAt: true,
      reviewedAt: true,
    },
    orderBy: mine
      ? [{ status: "asc" }, { createdAt: "desc" }]
      : feedOnly
        ? [{ reviewedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : [{ reviewedAt: "desc" }, { createdAt: "desc" }],
    ...(take ? { take } : {}),
  });
  const reviews = applications.length
    ? await prisma.testerApplicationActivity.groupBy({
      by: ["applicationId"],
      where: {
        applicationId: { in: applications.map(({ id }) => id) },
        type: "REVIEW",
        rating: { not: null },
      },
      _avg: { rating: true },
      _count: { _all: true },
    })
    : [];
  const reviewByApplicationId = new Map(reviews.map((review) => [
    review.applicationId,
    { averageRating: review._avg.rating, reviewCount: review._count._all },
  ]));
  return NextResponse.json({
    applications: applications.map((application) => ({
      ...application,
      averageRating: reviewByApplicationId.get(application.id)?.averageRating ?? null,
      reviewCount: reviewByApplicationId.get(application.id)?.reviewCount ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_APPLICATION", details: parsed.error.flatten() }, { status: 422 });

  const { logoUrl, screenshotUrls, createdDate, websiteUrl, testInstructions, ...fields } = parsed.data;
  if ((logoUrl && !isCloudinaryUrl(logoUrl)) || screenshotUrls.some((url) => !isCloudinaryUrl(url))) {
    return NextResponse.json({ error: "INVALID_MEDIA_URL" }, { status: 422 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  if (!adminUser) {
    console.error("Tester application submission could not be notified because the platform admin account is missing.");
    return NextResponse.json({ error: "ADMIN_NOTIFICATION_UNAVAILABLE" }, { status: 503 });
  }

  const application = await prisma.$transaction(async (transaction) => {
    const id = randomUUID();
    const [created] = await transaction.$queryRaw<{ id: string; name: string; status: string; createdAt: Date }[]>`
      INSERT INTO "TesterApplication" (
        "id", "name", "description", "problem", "testInstructions", "logoUrl",
        "screenshotUrls", "platform", "createdDate", "websiteUrl", "downloadUrl",
        "technologies", "ownerName", "ownerEmail", "ownerTitle", "ownerCity",
        "ownerCountry", "ownerPhone", "ownerAddress", "status", "shares", "ownerId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${fields.name}, ${fields.description}, ${fields.problem || null}, ${testInstructions},
        ${logoUrl || null}, ${screenshotUrls}::text[], ${fields.platform}::"TesterApplicationPlatform",
        ${createdDate ? new Date(`${createdDate}T00:00:00.000Z`) : null}, ${websiteUrl || null},
        ${fields.downloadUrl}, ${fields.technologies || null}, ${fields.ownerName}, ${fields.ownerEmail},
        ${fields.ownerTitle}, ${fields.ownerCity}, ${fields.ownerCountry}, ${fields.ownerPhone || null},
        ${fields.ownerAddress}, 'PENDING'::"TesterApplicationStatus", 0, ${userId},
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING "id", "name", "status", "createdAt"
    `;
    await transaction.notification.create({
      data: {
        recipientId: adminUser.id,
        actorId: userId,
        type: "TESTER_APPLICATION_SUBMITTED",
        targetId: id,
      },
    });
    return created;
  });

  try {
    await sendFirebasePushNotification(adminUser.id, "TESTER_APPLICATION_SUBMITTED", userId);
  } catch (error) {
    console.error("Tester application was submitted, but its push notification could not be sent:", error);
  }
  return NextResponse.json({ application }, { status: 201 });
}
