import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPaddleCopilotEntitled } from "@/lib/paddle";
import { z } from "zod";

const portalSchema = z.object({
  kind: z.enum(["copilot", "marketplace_verification"]).default("copilot"),
}).strict();

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = portalSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_PORTAL_REQUEST" }, { status: 422 });
  if (parsed.data.kind === "marketplace_verification") {
    const verification = await prisma.marketplaceVerification.findUnique({
      where: { userId },
      select: { subscriptionId: true, customerPortalUrl: true },
    });
    if (!verification?.subscriptionId || !verification.customerPortalUrl) {
      return NextResponse.json({ error: "SUBSCRIPTION_NOT_ACTIVE" }, { status: 404 });
    }
    return NextResponse.json({ url: verification.customerPortalUrl });
  }

  const subscription = await prisma.paddleCopilotSubscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true, customerPortalUrl: true },
  });
  if (
    !subscription ||
    !isPaddleCopilotEntitled(subscription.status, subscription.currentPeriodEnd)
  ) {
    return NextResponse.json({ error: "SUBSCRIPTION_NOT_ACTIVE" }, { status: 404 });
  }
  if (!subscription.customerPortalUrl) {
    return NextResponse.json({ error: "PADDLE_PORTAL_NOT_READY" }, { status: 503 });
  }
  return NextResponse.json({ url: subscription.customerPortalUrl });
}
