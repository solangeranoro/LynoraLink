import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasVerifiedAccount } from "@/lib/verified-account";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(500).max(10000),
  pitch: z.string().trim().min(10).max(180),
  productUrl: z.string().url().refine((value) => /^https?:\/\//i.test(value)),
  priceCents: z.number().int().min(50).max(99999999),
}).strict();

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
  return NextResponse.json({ item: { ...item, isOwner } });
}

export async function PATCH(request: Request, props: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!await hasVerifiedAccount(userId)) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }

  const params = await props.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_LISTING", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const result = await prisma.marketplaceItem.updateMany({
    where: { id: params.id, sellerId: userId },
    data: {
      ...parsed.data,
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
      select: { id: true },
    });
    return NextResponse.json({ error: exists ? "FORBIDDEN" : "NOT_FOUND" }, { status: exists ? 403 : 404 });
  }
  const item = await prisma.marketplaceItem.findUniqueOrThrow({
    where: { id: params.id },
    select: { id: true, title: true, description: true, pitch: true, productUrl: true, priceCents: true, currency: true, moderationStatus: true, isActive: true },
  });
  return NextResponse.json({ item });
}