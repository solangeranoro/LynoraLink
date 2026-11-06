import { requireAdmin } from "@/lib/admin";
import { sendFirebasePushNotification } from "@/lib/firebase-push";
import { sendTesterApplicationReviewEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({
    action: z.enum(["APPROVE", "REJECT"]),
    rejectionReason: z.string().trim().max(1000).optional().default(""),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REVIEW_ACTION" }, { status: 422 });

  const decision = parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED";
  const notificationType = decision === "APPROVED" ? "TESTER_APPLICATION_APPROVED" : "TESTER_APPLICATION_REJECTED";
  const application = await prisma.$transaction(async (transaction) => {
    const updatedCount = await transaction.testerApplication.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" ? parsed.data.rejectionReason || null : null,
        reviewerId: admin.userId,
        reviewedAt: new Date(),
      },
    });
    if (!updatedCount.count) return null;

    const reviewedApplication = await transaction.testerApplication.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        rejectionReason: true,
        reviewedAt: true,
        ownerId: true,
        ownerName: true,
        owner: { select: { email: true, name: true, preferredLang: true } },
      },
    });
    await transaction.notification.create({
      data: {
        recipientId: reviewedApplication.ownerId,
        actorId: admin.userId,
        type: notificationType,
        targetId: reviewedApplication.id,
      },
    });
    return reviewedApplication;
  });
  if (!application) {
    const application = await prisma.testerApplication.findUnique({ where: { id }, select: { id: true } });
    return NextResponse.json({ error: application ? "APPLICATION_ALREADY_REVIEWED" : "NOT_FOUND" }, { status: application ? 409 : 404 });
  }

  try {
    await sendFirebasePushNotification(
      application.ownerId,
      notificationType,
      admin.userId,
      `/tester-applications/${application.id}/manage`,
    );
  } catch (error) {
    console.error("Tester application decision was saved, but its push notification could not be sent:", error);
  }

  let emailSent = false;
  try {
    const result = await sendTesterApplicationReviewEmail({
      to: application.owner.email,
      name: application.owner.name ?? application.ownerName,
      applicationName: application.name,
      applicationId: application.id,
      approved: decision === "APPROVED",
      rejectionReason: application.rejectionReason,
      locale: application.owner.preferredLang,
    });
    emailSent = result.ok && !("dev" in result && result.dev);
    if (!result.ok) {
      console.error("Tester application decision was saved, but its email could not be sent:", result.error);
    }
  } catch (error) {
    console.error("Tester application decision was saved, but its email could not be sent:", error);
  }

  return NextResponse.json({
    application: {
      id: application.id,
      status: application.status,
      rejectionReason: application.rejectionReason,
      reviewedAt: application.reviewedAt,
    },
    emailSent,
  });
}
