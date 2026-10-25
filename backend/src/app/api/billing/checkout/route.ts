import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasVerifiedAccount } from "@/lib/verified-account";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";
import {
  createPaddleOneTimePrice,
  createPaddleResource,
  assertMarketplacePaddleApproved,
  isPaddleCopilotEntitled,
  type BillingPeriod,
  PaddleConfigurationError,
  PaddleMarketplaceApprovalError,
  PaddleTaxCategoryNotApprovedError,
  paddleSubscriptionPriceId,
} from "@/lib/paddle";

export const dynamic = "force-dynamic";

const checkoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("boost"), projectId: z.string().min(1) }),
  z.object({ kind: z.literal("marketplace"), itemId: z.string().min(1) }),
  z.object({ kind: z.literal("copilot_subscription"), period: z.enum(["monthly", "yearly"]) }),
  z.object({ kind: z.literal("marketplace_verification"), period: z.enum(["monthly", "yearly"]) }),
]);

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
}

function successUrl(baseUrl: string, returnPath: string) {
  const url = new URL(returnPath, baseUrl);
  url.searchParams.set("checkout", "pending");
  return url.toString();
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
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CHECKOUT" }, { status: 422 });

  const baseUrl = appBaseUrl(request);
  let checkoutId: string | null = null;

  try {
    let amountCents = 0;
    let currency = "USD";
    let kind = parsed.data.kind;
    let returnPath = "/marketplace";
    let priceId: string;
    let metadata: Record<string, string> = {};

    if (parsed.data.kind === "copilot_subscription") {
      const period: BillingPeriod = parsed.data.period;
      const currentSubscription = await prisma.paddleCopilotSubscription.findUnique({
        where: { userId },
        select: { status: true, currentPeriodEnd: true },
      });
      if (currentSubscription && isPaddleCopilotEntitled(currentSubscription.status, currentSubscription.currentPeriodEnd)) {
        return NextResponse.json({ error: "COPILOT_SUBSCRIPTION_ACTIVE" }, { status: 409 });
      }
      priceId = paddleSubscriptionPriceId("copilot", period);
      amountCents = period === "monthly" ? 1000 : 12000;
      metadata = { plan: period };
      returnPath = "/copilot";
    } else if (parsed.data.kind === "marketplace_verification") {
      assertMarketplacePaddleApproved();
      const period: BillingPeriod = parsed.data.period;
      const verification = await prisma.marketplaceVerification.findUnique({
        where: { userId },
        select: { status: true, emailVerifiedAt: true, currentPeriodEnd: true, subscriptionId: true },
      });
      if (!verification?.emailVerifiedAt) {
        return NextResponse.json({ error: "SELLER_EMAIL_VERIFICATION_REQUIRED" }, { status: 409 });
      }
      if (
        verification.subscriptionId &&
        (
          hasActiveMarketplaceVerification(verification) ||
          ["past_due", "paused"].includes(verification.status)
        )
      ) {
        return NextResponse.json({ error: "SELLER_VERIFICATION_ACTIVE" }, { status: 409 });
      }
      priceId = paddleSubscriptionPriceId("seller_verification", period);
      amountCents = period === "monthly" ? 1500 : 18000;
      metadata = { plan: period };
      returnPath = "/marketplace?tab=sell";
    } else if (parsed.data.kind === "boost") {
      const project = await prisma.project.findUnique({
        where: { id: parsed.data.projectId },
        select: { id: true, title: true, creatorId: true },
      });
      if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
      if (project.creatorId !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      const activeBoost = await prisma.boost.findFirst({
        where: { projectId: project.id, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (activeBoost) return NextResponse.json({ error: "BOOST_ACTIVE" }, { status: 409 });
      amountCents = 500;
      returnPath = "/projects";
      metadata = { projectId: project.id };
      const price = await createPaddleOneTimePrice({
        title: `Project boost: ${project.title}`,
        description: "Seven-day LynoraLink project boost.",
        imageUrl: null,
        taxCategory: "saas",
        amountCents,
        currency,
        idempotencyKey: `boost-${userId}-${project.id}-${randomUUID()}`,
      });
      priceId = price.priceId;
    } else {
      assertMarketplacePaddleApproved();
      const item = await prisma.marketplaceItem.findFirst({
        where: { id: parsed.data.itemId },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          imageUrl: true,
          sellerId: true,
          priceCents: true,
          currency: true,
          isActive: true,
          moderationStatus: true,
          updatedAt: true,
          paddleProductId: true,
          paddlePriceId: true,
        },
      });
      if (!item || !item.isActive || item.moderationStatus !== "APPROVED") {
        return NextResponse.json({ error: "ITEM_NOT_FOUND" }, { status: 404 });
      }
      if (item.sellerId === userId) return NextResponse.json({ error: "CANNOT_BUY_OWN_ITEM" }, { status: 409 });
      if (!await hasVerifiedAccount(item.sellerId)) {
        return NextResponse.json({ error: "ITEM_NOT_FOUND" }, { status: 404 });
      }
      if (!Number.isSafeInteger(item.priceCents) || item.priceCents < 50) {
        return NextResponse.json({ error: "INVALID_ITEM_PRICE" }, { status: 422 });
      }
      if (item.currency.toUpperCase() !== currency) {
        return NextResponse.json({ error: "UNSUPPORTED_CURRENCY" }, { status: 422 });
      }
      amountCents = item.priceCents;
      returnPath = `/marketplace/${encodeURIComponent(item.id)}`;
      metadata = {
        itemId: item.id,
        sellerId: item.sellerId,
      };

      if (item.paddlePriceId) {
        priceId = item.paddlePriceId;
      } else {
        const price = await createPaddleOneTimePrice({
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl,
          taxCategory: item.type === "MICRO_SAAS"
            ? "saas"
            : item.type === "SERVICE"
              ? "professional-services"
              : "digital-goods",
          amountCents,
          currency,
          idempotencyKey: `listing-${item.id}-${item.updatedAt.getTime()}`,
        });
        const cached = await prisma.marketplaceItem.updateMany({
          where: {
            id: item.id,
            priceCents: item.priceCents,
            paddlePriceId: null,
          },
          data: { paddleProductId: price.productId, paddlePriceId: price.priceId },
        });
        if (cached.count === 1) {
          priceId = price.priceId;
        } else {
          const latest = await prisma.marketplaceItem.findUnique({
            where: { id: item.id },
            select: { priceCents: true, paddlePriceId: true },
          });
          if (latest?.priceCents !== item.priceCents || !latest.paddlePriceId) {
            throw new Error("Marketplace listing changed while its Paddle price was being prepared.");
          }
          priceId = latest.paddlePriceId;
        }
      }
    }

    checkoutId = randomUUID();
    await prisma.paymentCheckout.create({
      data: { id: checkoutId, userId, kind, metadata, amountCents, currency, returnPath },
    });
    const account = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!account?.email) throw new Error("Checkout user email is missing.");

    const transaction = await createPaddleResource("transactions", {
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: "automatic",
      custom_data: { checkoutId, userId, kind, ...metadata },
    }, checkoutId);
    if (typeof transaction.id !== "string") {
      throw new Error("Paddle transaction response is missing its ID.");
    }
    await prisma.paymentCheckout.update({
      where: { id: checkoutId },
      data: { paymentOrderId: transaction.id },
    });

    return NextResponse.json({
      transactionId: transaction.id,
      customerEmail: account.email,
      successUrl: successUrl(baseUrl, returnPath),
    });
  } catch (error) {
    if (checkoutId) {
      try {
        await prisma.paymentCheckout.updateMany({
          where: { id: checkoutId, status: "PENDING" },
          data: { status: "FAILED" },
        });
      } catch (cleanupError) {
        console.error("Failed to close the unsuccessful Paddle checkout record:", cleanupError);
      }
    }
    if (error instanceof PaddleConfigurationError) {
      return NextResponse.json({ error: "BILLING_NOT_CONFIGURED" }, { status: 503 });
    }
    if (error instanceof PaddleMarketplaceApprovalError) {
      return NextResponse.json({ error: "PADDLE_MARKETPLACE_NOT_APPROVED" }, { status: 503 });
    }
    if (error instanceof PaddleTaxCategoryNotApprovedError) {
      return NextResponse.json({ error: "PADDLE_TAX_CATEGORY_NOT_APPROVED" }, { status: 503 });
    }
    console.error("Create Paddle checkout failed:", error);
    return NextResponse.json({ error: "CHECKOUT_FAILED" }, { status: 502 });
  }
}
