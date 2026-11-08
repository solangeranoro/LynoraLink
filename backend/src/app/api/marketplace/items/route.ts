import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/admin";
import { hasVerifiedAccount } from "@/lib/verified-account";
import { marketplaceItemSchema } from "@/lib/marketplace-item-schema";

export async function GET(request: Request) {
  const session = await auth();
  const mine = new URL(request.url).searchParams.get("mine") === "1";
  if (mine && !session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (mine && !await hasVerifiedAccount(session!.user!.id)) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }

  const items = await prisma.marketplaceItem.findMany({
    where: mine ? { sellerId: session!.user!.id } : {
      isActive: true,
      moderationStatus: "APPROVED",
      seller: {
        OR: [
          { email: ADMIN_EMAIL },
          {
            emailVerified: { not: null },
            marketplaceVerification: { is: {
              emailVerifiedAt: { not: null },
              OR: [
                { status: { in: ["active", "on_trial", "trialing"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
                { status: { in: ["canceled", "cancelled"] }, currentPeriodEnd: { gt: new Date() } },
              ],
            } },
          },
        ],
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      priceCents: true,
      currency: true,
      isActive: true,
      isFeatured: true,
      ...(mine ? { moderationStatus: true } : {}),
      imageUrl: true,
      sellerId: true,
      productUrl: true,
      pitch: true,
      language: true,
      sellerCity: true,
      photos: true,
      createdAt: true,
      seller: { select: { id: true, name: true, image: true, handle: true } },
      orders: { where: { status: "PAID" }, select: { id: true }, take: 1 },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
  return NextResponse.json({
    items: items.map(({ orders, ...item }) => ({ ...item, isSold: orders.length > 0 })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!await hasVerifiedAccount(userId)) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = marketplaceItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_ITEM", issues: parsed.error.flatten().fieldErrors }, { status: 422 });

  const { includedItems, audience, financial, details, photos, ...itemData } = parsed.data;
  const item = await prisma.marketplaceItem.create({
    data: {
      ...itemData,
      imageUrl: photos[0] ?? null,
      includedItems: includedItems as Prisma.InputJsonValue,
      audience: audience as Prisma.InputJsonValue,
      financial: financial as Prisma.InputJsonValue,
      details: details as Prisma.InputJsonValue,
      photos,
      isActive: false,
      complianceAccepted: true,
      complianceAcceptedAt: new Date(),
      sellerId: userId,
    },
    select: { id: true, title: true, description: true, type: true, priceCents: true, currency: true, imageUrl: true, productUrl: true, sellerId: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ item }, { status: 201 });
}