import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  centsFromPaddleAmount,
  finalizePaddlePayment,
  updatePaddleMarketplaceVerification,
  updatePaddleSubscription,
} from "@/lib/paddle-orders";
import { verifyPaddleWebhookSignature } from "@/lib/paddle";

export const runtime = "nodejs";

type PaddleEvent = {
  event_id: string;
  event_type: string;
  data: Record<string, unknown>;
};

function isPaddleEvent(value: unknown): value is PaddleEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return typeof event.event_id === "string"
    && typeof event.event_type === "string"
    && Boolean(event.data && typeof event.data === "object" && !Array.isArray(event.data));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

async function processTransaction(data: Record<string, unknown>) {
  const customData = data.custom_data;
  const checkoutId = customData && typeof customData === "object" && !Array.isArray(customData)
    ? stringValue((customData as Record<string, unknown>).checkoutId)
    : null;
  const checkout = checkoutId
    ? await prisma.paymentCheckout.findUnique({ where: { id: checkoutId } })
    : null;
  if (checkout && checkout.paymentOrderId === data.id) {
    await finalizePaddlePayment(checkout, data as Parameters<typeof finalizePaddlePayment>[1]);
    return;
  }

  const subscriptionId = stringValue(data.subscription_id);
  if (!subscriptionId || data.status !== "completed") {
    throw new Error("Paddle transaction is missing a completed checkout or subscription.");
  }
  const [premiumSubscription, sellerVerification] = await Promise.all([
    prisma.paddleCopilotSubscription.findUnique({
      where: { paddleSubscriptionId: subscriptionId },
      select: { userId: true },
    }),
    prisma.marketplaceVerification.findUnique({
      where: { subscriptionId },
      select: { userId: true },
    }),
  ]);
  const subscription = premiumSubscription
    ? { userId: premiumSubscription.userId, kind: "copilot_subscription" }
    : sellerVerification
      ? { userId: sellerVerification.userId, kind: "marketplace_verification" }
      : null;
  if (!subscription) throw new Error("Paddle renewal could not be matched to a known subscription.");

  const transactionId = stringValue(data.id);
  const details = data.details;
  const totals = details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>).totals
    : null;
  const amountCents = totals && typeof totals === "object" && !Array.isArray(totals)
    ? centsFromPaddleAmount((totals as Record<string, unknown>).total)
    : null;
  const currency = stringValue(data.currency_code);
  if (!transactionId || amountCents === null || amountCents < 1 || !currency) {
    throw new Error("Paddle renewal has an invalid amount or currency.");
  }

  await prisma.paymentCheckout.create({
    data: {
      id: randomUUID(),
      userId: subscription.userId,
      paymentOrderId: transactionId,
      kind: subscription.kind,
      metadata: { subscriptionId, recurring: true },
      amountCents,
      currency,
      returnPath: subscription.kind === "copilot_subscription" ? "/copilot" : "/marketplace?tab=sell",
      status: "COMPLETED",
      paidAt: new Date(),
    },
  });
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyPaddleWebhookSignature(payload, request.headers.get("paddle-signature"))) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }
  if (!isPaddleEvent(event)) {
    return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });
  }

  try {
    if (await prisma.paymentWebhookEvent.findUnique({ where: { id: event.event_id } })) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.event_type === "transaction.completed") {
      await processTransaction(event.data);
    } else if (event.event_type.startsWith("subscription.")) {
      const subscriptionId = stringValue(event.data.id);
      const transactionId = stringValue(event.data.transaction_id);
      const [checkout, existingSubscription, sellerVerification] = await Promise.all([
        transactionId
          ? prisma.paymentCheckout.findUnique({
              where: { paymentOrderId: transactionId },
              select: { userId: true, kind: true },
            })
          : Promise.resolve(null),
        subscriptionId
          ? prisma.paddleCopilotSubscription.findUnique({
              where: { paddleSubscriptionId: subscriptionId },
              select: { userId: true },
            })
          : Promise.resolve(null),
        subscriptionId
          ? prisma.marketplaceVerification.findUnique({
              where: { subscriptionId },
              select: { userId: true },
            })
          : Promise.resolve(null),
      ]);
      const customData = event.data.custom_data;
      const customKind = customData && typeof customData === "object" && !Array.isArray(customData)
        ? stringValue((customData as Record<string, unknown>).kind)
        : null;
      if (customKind === "marketplace_verification" || checkout?.kind === "marketplace_verification" || sellerVerification) {
        await updatePaddleMarketplaceVerification(
          event.data,
          checkout?.kind === "marketplace_verification" ? checkout.userId : sellerVerification?.userId,
        );
      } else if (customKind === "copilot_subscription" || checkout?.kind === "copilot_subscription" || existingSubscription) {
        await updatePaddleSubscription(
          event.data,
          checkout?.kind === "copilot_subscription"
            ? checkout.userId
            : existingSubscription?.userId,
        );
      }
    }

    await prisma.paymentWebhookEvent.create({
      data: { id: event.event_id, type: event.event_type },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Paddle webhook processing failed:", error);
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
