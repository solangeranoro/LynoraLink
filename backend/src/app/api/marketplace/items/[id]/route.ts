import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasVerifiedAccount } from "@/lib/verified-account";
import { marketplaceItemSchema } from "@/lib/marketplace-item-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  const item = await prisma.marketplaceItem.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      priceCents: true,
      currency: true,
      isActive: true,
      moderationStatus: true,
      imageUrl: true,
      productUrl: true,
      pitch: true,
      language: true,
      sellerCity: true,
      includedItems: true,
      audience: true,
      financial: true,
      details: true,
      photos: true,
      createdAt: true,
      orders: { where: { status: "PAID" }, select: { id: true }, take: 1 },
      seller: {
        select: { id: true, name: true, image: true, handle: true },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const isOwner = session?.user?.id === item.seller.id;
  if ((!item.isActive || item.moderationStatus !== "APPROVED") && !isOwner) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (!isOwner && !(await hasVerifiedAccount(item.seller.id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const { orders, ...listing } = item;
  return NextResponse.json({ item: { ...listing, isSold: orders.length > 0, isOwner } });
}

export async function PATCH(request: Request, props: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!await hasVerifiedAccount(userId)) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }

  const params = await props.params;
  const parsed = marketplaceItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_ITEM", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { includedItems, audience, financial, details, photos, complianceAccepted, ...itemData } = parsed.data;
  const result = await prisma.marketplaceItem.updateMany({
    where: { id: params.id, sellerId: userId, orders: { none: { status: "PAID" } } },
    data: {
      ...itemData,
      imageUrl: photos[0] ?? null,
      includedItems: includedItems as Prisma.InputJsonValue,
      audience: audience as Prisma.InputJsonValue,
      financial: financial as Prisma.InputJsonValue,
      details: details as Prisma.InputJsonValue,
      photos,
      complianceAccepted,
      complianceAcceptedAt: new Date(),
      paddleProductId: null,
      paddlePriceId: null,
      moderationStatus: "PENDING",
      isActive: false,
      reviewedBy: null,
      reviewDate: null,
    },
  });
  if (result.count === 0) {
    const exists = await prisma.marketplaceItem.findUnique({
      where: { id: params.id },
      select: { id: true, sellerId: true, orders: { where: { status: "PAID" }, select: { id: true }, take: 1 } },
    });
    if (!exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (exists.sellerId !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (exists.orders.length > 0) return NextResponse.json({ error: "LISTING_SOLD" }, { status: 409 });
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
  }
  const item = await prisma.marketplaceItem.findUniqueOrThrow({
    where: { id: params.id },
    select: { id: true, title: true, description: true, type: true, priceCents: true, currency: true, moderationStatus: true, isActive: true },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, props: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await props.params;
  try {
    const result = await prisma.marketplaceItem.deleteMany({
      where: { id, sellerId: userId, orders: { none: {} } },
    });
    if (result.count > 0) return NextResponse.json({ deleted: true });

    const item = await prisma.marketplaceItem.findUnique({
      where: { id },
      select: { sellerId: true, _count: { select: { orders: true } } },
    });
    if (!item) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (item.sellerId !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (item._count.orders > 0) return NextResponse.json({ error: "LISTING_HAS_ORDERS" }, { status: 409 });
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 409 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "LISTING_HAS_ORDERS" }, { status: 409 });
    }
    console.error("Marketplace listing deletion error:", error);
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}