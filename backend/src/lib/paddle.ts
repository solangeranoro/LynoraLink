import { createHmac, timingSafeEqual } from "node:crypto";

type JsonObject = Record<string, unknown>;

export class PaddleConfigurationError extends Error {}
export class PaddleMarketplaceApprovalError extends Error {}
export class PaddleTaxCategoryNotApprovedError extends Error {}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function paddleEnvironment() {
  const environment = process.env.PADDLE_ENVIRONMENT ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new PaddleConfigurationError("PADDLE_ENVIRONMENT must be sandbox or production.");
  }
  return environment;
}

export function assertMarketplacePaddleApproved() {
  if (
    paddleEnvironment() === "production" &&
    process.env.PADDLE_MARKETPLACE_APPROVED !== "true"
  ) {
    throw new PaddleMarketplaceApprovalError(
      "Paddle marketplace sales are disabled until the business model is approved.",
    );
  }
}

function apiBaseUrl() {
  return paddleEnvironment() === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export async function createPaddleResource(
  resource: "products" | "prices" | "transactions",
  body: JsonObject,
  idempotencyKey: string,
) {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new PaddleConfigurationError("PADDLE_API_KEY is not configured.");

  const response = await fetch(`${apiBaseUrl()}/${resource}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isJsonObject(result) && isJsonObject(result.error) ? result.error : null;
    const message = error && typeof error.detail === "string"
      ? error.detail
      : `Paddle ${resource} request failed with status ${response.status}.`;
    if (resource === "products" && message.toLowerCase().includes("tax category not approved")) {
      throw new PaddleTaxCategoryNotApprovedError(message);
    }
    throw new Error(message);
  }
  if (!isJsonObject(result) || !isJsonObject(result.data)) {
    throw new Error(`Paddle ${resource} response did not contain data.`);
  }
  return result.data;
}

export async function createPaddleOneTimePrice(input: {
  title: string;
  description: string;
  imageUrl: string | null;
  taxCategory: "digital-goods" | "saas" | "professional-services";
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) {
    throw new Error("Paddle price must be a positive integer amount.");
  }
  const product = await createPaddleResource("products", {
    name: input.title.slice(0, 200),
    description: input.description.slice(0, 2048),
    type: "custom",
    tax_category: input.taxCategory,
    image_url: input.imageUrl,
  }, `${input.idempotencyKey}-product`);
  if (typeof product.id !== "string") throw new Error("Paddle product response is missing its ID.");

  const price = await createPaddleResource("prices", {
    product_id: product.id,
    description: "One-time purchase",
    name: "One-time",
    type: "custom",
    billing_cycle: null,
    unit_price: {
      amount: String(input.amountCents),
      currency_code: input.currency.toUpperCase(),
    },
  }, `${input.idempotencyKey}-price`);
  if (typeof price.id !== "string") throw new Error("Paddle price response is missing its ID.");
  return { productId: product.id, priceId: price.id };
}

export function verifyPaddleWebhookSignature(payload: string, signatureHeader: string | null) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(";").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "ts")?.[1];
  const signatures = parts.filter(([key]) => key === "h1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 5 * 60) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}:${payload}`).digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export type BillingPeriod = "monthly" | "yearly";
export type PaddleSubscriptionPlan = "copilot" | "seller_verification";

export function paddleSubscriptionPriceId(plan: PaddleSubscriptionPlan, period: BillingPeriod) {
  const variable = plan === "copilot"
    ? `PADDLE_COPILOT_PRICE_ID_${period.toUpperCase()}`
    : `PADDLE_SELLER_VERIFICATION_PRICE_ID_${period.toUpperCase()}`;
  const priceId = process.env[variable];
  if (!priceId) throw new PaddleConfigurationError(`${variable} is not configured.`);
  return priceId;
}

export function isPaddleCopilotEntitled(
  status: string,
  currentPeriodEnd: Date | null,
  now = new Date(),
) {
  if (status === "active" || status === "trialing") {
    return !currentPeriodEnd || currentPeriodEnd > now;
  }
  return status === "canceled" && Boolean(currentPeriodEnd && currentPeriodEnd > now);
}
