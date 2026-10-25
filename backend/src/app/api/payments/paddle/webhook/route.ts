import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
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
  if (!checkoutId) throw new Error("Paddle transaction event is missing its checkout ID.");
  const checkout = await prisma.paymentCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout || checkout.paymentOrderId !== data.id) {
    throw new Error("Paddle checkout record is not ready for webhook processing.");
  }
  await finalizePaddlePayment(checkout, data as Parameters<typeof finalizePaddlePayment>[1]);
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
