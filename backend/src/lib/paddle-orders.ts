import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Checkout = {
  id: string;
  userId: string;
  paymentOrderId: string | null;
  kind: string;
  metadata: Prisma.JsonValue;
  amountCents: number;
  currency: string;
  status: string;
};

type PaddleTransaction = Record<string, unknown> & {
  id: string;
  status: string;
  currency_code: string;
  custom_data: Record<string, unknown> | null;
};

function metadataString(metadata: Prisma.JsonValue, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function dataString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" ? value : null;
}

function centsFromPaddleAmount(value: unknown) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export async function finalizePaddlePayment(checkout: Checkout, transaction: PaddleTransaction) {
  if (
    checkout.status === "COMPLETED" ||
    checkout.paymentOrderId !== transaction.id ||
    transaction.status !== "completed" ||
    transaction.currency_code.toLowerCase() !== checkout.currency.toLowerCase() ||
    transaction.custom_data?.checkoutId !== checkout.id ||
    transaction.custom_data?.userId !== checkout.userId
  ) {
    if (checkout.status === "COMPLETED") return false;
    throw new Error("Paddle transaction does not match the pending checkout.");
  }

  const details = transaction.details;
  const totals = details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>).totals
    : null;
  const subtotal = totals && typeof totals === "object" && !Array.isArray(totals)
    ? centsFromPaddleAmount((totals as Record<string, unknown>).subtotal)
    : null;
  if (subtotal !== checkout.amountCents) {
    throw new Error("Paddle transaction amount does not match the pending checkout.");
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentCheckout.updateMany({
      where: { id: checkout.id, status: "PENDING" },
      data: { status: "COMPLETED", paidAt: new Date() },
    });
    if (claimed.count !== 1) return false;

    if (checkout.kind === "boost") {
      const projectId = metadataString(checkout.metadata, "projectId");
      if (!projectId) throw new Error("Boost checkout is missing its project.");
      await tx.boost.create({
        data: {
          userId: checkout.userId,
          projectId,
          paymentOrderId: transaction.id,
          paymentProvider: "PADDLE",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (checkout.kind === "marketplace") {
      const itemId = metadataString(checkout.metadata, "itemId");
      const sellerId = metadataString(checkout.metadata, "sellerId");
      if (!itemId || !sellerId) throw new Error("Marketplace checkout is missing listing details.");
      await tx.marketplaceOrder.create({
        data: {
          itemId,
          buyerId: checkout.userId,
          sellerId,
          paymentOrderId: transaction.id,
          paymentProvider: "PADDLE",
          amountCents: checkout.amountCents,
          platformFeeCents: 0,
          status: "PAID",
          paidAt: new Date(),
        },
      });
    } else if (checkout.kind === "copilot_subscription") {
      await savePaddleSubscription(tx, transaction, checkout.userId, "active");
    } else if (checkout.kind === "marketplace_verification") {
      await saveMarketplaceVerificationSubscription(tx, checkout, transaction);
    } else {
      throw new Error("Unsupported Paddle checkout type.");
    }
    return true;
  });
}

export async function updatePaddleMarketplaceVerification(
  subscription: Record<string, unknown>,
  fallbackUserId?: string,
) {
  const subscriptionId = dataString(subscription, "id");
  if (!subscriptionId) throw new Error("Paddle seller subscription event is missing its ID.");
  const customData = subscription.custom_data;
  const customUserId = customData && typeof customData === "object" && !Array.isArray(customData)
    ? dataString(customData as Record<string, unknown>, "userId")
    : null;
  const existing = await prisma.marketplaceVerification.findUnique({
    where: { subscriptionId },
    select: { userId: true, currentPeriodEnd: true },
  });
  const userId = customUserId ?? existing?.userId ?? fallbackUserId;
  if (!userId) throw new Error("Paddle seller subscription event cannot be matched to a user.");

  const billingPeriod = subscription.current_billing_period;
  const periodEnd = billingPeriod && typeof billingPeriod === "object" && !Array.isArray(billingPeriod)
    ? dataString(billingPeriod as Record<string, unknown>, "ends_at")
    : dataString(subscription, "next_billed_at");
  const items = subscription.items;
  const firstItem = Array.isArray(items) ? items[0] : null;
  const price = firstItem && typeof firstItem === "object" && !Array.isArray(firstItem)
    ? (firstItem as Record<string, unknown>).price
    : null;
  const priceId = price && typeof price === "object" && !Array.isArray(price)
    ? dataString(price as Record<string, unknown>, "id")
    : null;
  const managementUrls = subscription.management_urls;
  const customerPortalUrl = managementUrls && typeof managementUrls === "object" && !Array.isArray(managementUrls)
    ? dataString(managementUrls as Record<string, unknown>, "view_subscription")
    : null;
  const status = dataString(subscription, "status");
  if (!status) throw new Error("Paddle seller subscription event is missing its status.");
  const result = await prisma.marketplaceVerification.updateMany({
    where: { userId, emailVerifiedAt: { not: null } },
    data: {
      subscriptionId,
      customerId: dataString(subscription, "customer_id"),
      variantId: priceId,
      customerPortalUrl,
      status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : existing?.currentPeriodEnd ?? null,
    },
  });
  if (result.count !== 1) {
    throw new Error("Verified seller profile was not found for the Paddle subscription.");
  }
}

export async function updatePaddleSubscription(
  subscription: Record<string, unknown>,
  fallbackUserId?: string,
) {
  const subscriptionId = dataString(subscription, "id");
  if (!subscriptionId) throw new Error("Paddle subscription event is missing its ID.");
  const customData = subscription.custom_data;
  const customUserId = customData && typeof customData === "object" && !Array.isArray(customData)
    ? dataString(customData as Record<string, unknown>, "userId")
    : null;
  const existing = await prisma.paddleCopilotSubscription.findUnique({
    where: { paddleSubscriptionId: subscriptionId },
    select: { userId: true },
  });
  const userId = customUserId ?? existing?.userId ?? fallbackUserId;
  if (!userId) throw new Error("Paddle subscription event cannot be matched to a user.");

  const billingPeriod = subscription.current_billing_period;
  const periodEnd = billingPeriod && typeof billingPeriod === "object" && !Array.isArray(billingPeriod)
    ? dataString(billingPeriod as Record<string, unknown>, "ends_at")
    : dataString(subscription, "next_billed_at");
  const items = subscription.items;
  const firstItem = Array.isArray(items) ? items[0] : null;
  const price = firstItem && typeof firstItem === "object" && !Array.isArray(firstItem)
    ? (firstItem as Record<string, unknown>).price
    : null;
  const priceId = price && typeof price === "object" && !Array.isArray(price)
    ? dataString(price as Record<string, unknown>, "id")
    : null;
  const managementUrls = subscription.management_urls;
  const customerPortalUrl = managementUrls && typeof managementUrls === "object" && !Array.isArray(managementUrls)
    ? dataString(managementUrls as Record<string, unknown>, "view_subscription")
    : null;

  await prisma.paddleCopilotSubscription.upsert({
    where: { userId },
    create: {
      userId,
      paddleSubscriptionId: subscriptionId,
      paddleCustomerId: dataString(subscription, "customer_id"),
      customerPortalUrl,
      priceId,
      status: dataString(subscription, "status") ?? "active",
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    },
    update: {
      paddleSubscriptionId: subscriptionId,
      paddleCustomerId: dataString(subscription, "customer_id"),
      customerPortalUrl,
      priceId,
      status: dataString(subscription, "status") ?? "active",
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    },
  });
}

async function savePaddleSubscription(
  tx: Prisma.TransactionClient,
  transaction: PaddleTransaction,
  userId: string,
  status: string,
) {
  const subscriptionId = dataString(transaction, "subscription_id");
  if (!subscriptionId) throw new Error("Paid Copilot transaction is missing its subscription ID.");
  const existing = await tx.paddleCopilotSubscription.findUnique({
    where: { userId },
    select: { paddleSubscriptionId: true },
  });
  if (existing?.paddleSubscriptionId === subscriptionId) return;
  const billingPeriod = transaction.billing_period;
  const periodEnd = billingPeriod && typeof billingPeriod === "object" && !Array.isArray(billingPeriod)
    ? dataString(billingPeriod as Record<string, unknown>, "ends_at")
    : null;
  await tx.paddleCopilotSubscription.upsert({
    where: { userId },
    create: {
      userId,
      paddleSubscriptionId: subscriptionId,
      paddleCustomerId: dataString(transaction, "customer_id"),
      status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    },
    update: {
      paddleSubscriptionId: subscriptionId,
      paddleCustomerId: dataString(transaction, "customer_id"),
      status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    },
  });
}

async function saveMarketplaceVerificationSubscription(
  tx: Prisma.TransactionClient,
  checkout: Checkout,
  transaction: PaddleTransaction,
) {
  const subscriptionId = dataString(transaction, "subscription_id");
  if (!subscriptionId) throw new Error("Paid seller verification is missing its subscription ID.");
  const plan = metadataString(checkout.metadata, "plan");
  if (plan !== "monthly" && plan !== "yearly") {
    throw new Error("Seller verification checkout is missing a valid billing plan.");
  }
  const billingPeriod = transaction.billing_period;
  const periodEnd = billingPeriod && typeof billingPeriod === "object" && !Array.isArray(billingPeriod)
    ? dataString(billingPeriod as Record<string, unknown>, "ends_at")
    : null;
  const result = await tx.marketplaceVerification.updateMany({
    where: { userId: checkout.userId, emailVerifiedAt: { not: null } },
    data: {
      plan,
      status: "active",
      subscriptionId,
      customerId: dataString(transaction, "customer_id"),
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    },
  });
  if (result.count !== 1) {
    throw new Error("Verified seller profile was not found for the completed Paddle transaction.");
  }
}
