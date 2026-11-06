import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };
const privateNoStoreHeaders = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };
type ManageApplicationRow = {
  id: string;
  name: string;
  description: string;
  problem: string | null;
  testInstructions: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  platform: string;
  createdDate: Date | null;
  websiteUrl: string | null;
  downloadUrl: string;
  technologies: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerTitle: string;
  ownerCity: string;
  ownerCountry: string;
  ownerPhone: string | null;
  ownerAddress: string;
  bugReportNotificationsEnabled: boolean;
};

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().min(20).max(5000).optional(),
  problem: z.string().trim().max(2000).optional(),
  testInstructions: z.string().trim().min(20).max(3000).optional(),
  logoUrl: z.union([z.literal(""), z.string().url(), z.null()]).optional(),
  screenshotUrls: z.array(z.string().url()).max(6).optional(),
  platform: z.enum(["IOS", "ANDROID", "WEB", "DESKTOP"]).optional(),
  createdDate: z.union([z.literal(""), z.string().date(), z.null()]).optional(),
  websiteUrl: z.union([z.literal(""), z.string().url(), z.null()]).optional(),
  downloadUrl: z.string().url().optional(),
  technologies: z.string().trim().max(1000).optional(),
  ownerName: z.string().trim().min(2).max(120).optional(),
  ownerEmail: z.string().trim().email().max(254).optional(),
  ownerTitle: z.string().trim().min(2).max(120).optional(),
  ownerCity: z.string().trim().min(2).max(100).optional(),
  ownerCountry: z.string().trim().min(2).max(100).optional(),
  ownerPhone: z.string().trim().max(40).optional(),
  ownerAddress: z.string().trim().min(5).max(500).optional(),
  bugReportNotificationsEnabled: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

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

async function findManageableApplication(id: string, userId: string) {
  const application = await prisma.testerApplication.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });
  if (!application) return null;
  if (application.ownerId !== userId) return null;
  return application;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateNoStoreHeaders });
  const { id } = await context.params;
  if (!(await findManageableApplication(id, userId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: privateNoStoreHeaders });
  }

  const [application] = await prisma.$queryRaw<ManageApplicationRow[]>`
    SELECT
      "id", "name", "description", "problem", "testInstructions", "logoUrl",
      "screenshotUrls", "platform"::text AS "platform", "createdDate", "websiteUrl",
      "downloadUrl", "technologies", "ownerName", "ownerEmail", "ownerTitle",
      "ownerCity", "ownerCountry", "ownerPhone", "ownerAddress",
      "bugReportNotificationsEnabled"
    FROM "TesterApplication"
    WHERE "id" = ${id}
  `;
  if (!application) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: privateNoStoreHeaders });
  return NextResponse.json({ application }, { headers: privateNoStoreHeaders });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  if (!(await findManageableApplication(id, userId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_APPLICATION_UPDATE", details: parsed.error.flatten() }, { status: 422 });

  const input = parsed.data;
  if ((input.logoUrl && !isCloudinaryUrl(input.logoUrl)) ||
    input.screenshotUrls?.some((url) => !isCloudinaryUrl(url)) ||
    (input.websiteUrl && !isHttpUrl(input.websiteUrl)) ||
    (input.downloadUrl && !isHttpUrl(input.downloadUrl))) {
    return NextResponse.json({ error: "INVALID_MEDIA_OR_LINK_URL" }, { status: 422 });
  }

  const { bugReportNotificationsEnabled, ...applicationInput } = input;
  if (bugReportNotificationsEnabled !== undefined) {
    const [updatedPreference] = await prisma.$queryRaw<{ id: string; name: string; updatedAt: Date }[]>`
      UPDATE "TesterApplication"
      SET "bugReportNotificationsEnabled" = ${bugReportNotificationsEnabled},
          "updatedAt" = NOW()
      WHERE "id" = ${id}
      RETURNING "id", "name", "updatedAt"
    `;
    if (!updatedPreference) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (Object.keys(applicationInput).length === 0) {
      return NextResponse.json({ application: updatedPreference });
    }
  }

  const application = await prisma.testerApplication.update({
    where: { id },
    data: {
      ...applicationInput,
      logoUrl: applicationInput.logoUrl === "" ? null : applicationInput.logoUrl,
      websiteUrl: applicationInput.websiteUrl === "" ? null : applicationInput.websiteUrl,
      createdDate: applicationInput.createdDate === undefined
        ? undefined
        : applicationInput.createdDate === "" || applicationInput.createdDate === null
          ? null
          : new Date(`${applicationInput.createdDate}T00:00:00.000Z`),
      problem: applicationInput.problem === "" ? null : applicationInput.problem,
      technologies: applicationInput.technologies === "" ? null : applicationInput.technologies,
      ownerPhone: applicationInput.ownerPhone === "" ? null : applicationInput.ownerPhone,
    },
    select: { id: true, name: true, updatedAt: true },
  });
  return NextResponse.json({ application });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  if (!(await findManageableApplication(id, userId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: {
        targetId: id,
        type: {
          in: [
            "TESTER_APPLICATION_BUG_REPORTED",
            "TESTER_APPLICATION_SUBMITTED",
            "TESTER_APPLICATION_APPROVED",
            "TESTER_APPLICATION_REJECTED",
          ],
        },
      },
    }),
    prisma.testerApplication.delete({ where: { id } }),
  ]);
  return NextResponse.json({ deleted: true });
}
