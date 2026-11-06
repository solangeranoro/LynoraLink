import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendFirebasePushNotification } from "@/lib/firebase-push";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

async function findPublishedApplication(id: string) {
  const [application] = await prisma.$queryRaw<{ id: string; ownerId: string; bugReportNotificationsEnabled: boolean }[]>`
    SELECT "id", "ownerId", "bugReportNotificationsEnabled"
    FROM "TesterApplication"
    WHERE "id" = ${id} AND "status" = 'APPROVED'::"TesterApplicationStatus"
  `;
  return application ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  if (!(await findPublishedApplication(id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const reports = await prisma.testerApplicationActivity.findMany({
    where: { applicationId: id, type: "BUG_REPORT" },
    include: { author: { select: { id: true, name: true, handle: true, image: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({ reports });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  if (!(await findPublishedApplication(id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({
    title: z.string().trim().min(3).max(120),
    content: z.string().trim().min(10).max(3000),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_BUG_REPORT", details: parsed.error.flatten() }, { status: 422 });

  const result = await prisma.$transaction(async (transaction) => {
    const [application] = await transaction.$queryRaw<{ id: string; ownerId: string; bugReportNotificationsEnabled: boolean }[]>`
      SELECT "id", "ownerId", "bugReportNotificationsEnabled"
      FROM "TesterApplication"
      WHERE "id" = ${id} AND "status" = 'APPROVED'::"TesterApplicationStatus"
      FOR UPDATE
    `;
    if (!application) return null;
    const report = await transaction.testerApplicationActivity.create({
      data: { applicationId: id, authorId: userId, type: "BUG_REPORT", ...parsed.data },
      include: { author: { select: { id: true, name: true, handle: true, image: true } } },
    });
    const notifyOwner = application.bugReportNotificationsEnabled && application.ownerId !== userId;
    if (notifyOwner) {
      await transaction.$executeRaw`
        INSERT INTO "Notification" ("id", "recipientId", "actorId", "type", "targetId", "createdAt")
        VALUES (
          ${randomUUID()},
          ${application.ownerId},
          ${userId},
          'TESTER_APPLICATION_BUG_REPORTED'::"NotificationType",
          ${id},
          NOW()
        )
      `;
    }
    return { report, recipientId: notifyOwner ? application.ownerId : null };
  });
  if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (result.recipientId) {
    try {
      await sendFirebasePushNotification(result.recipientId, "TESTER_APPLICATION_BUG_REPORTED", userId, `/tester-applications/${id}#tester-bugs`);
    } catch (error) {
      console.error("Bug report was saved, but its push notification could not be sent:", error);
    }
  }
  return NextResponse.json({ report: result.report }, { status: 201 });
}
