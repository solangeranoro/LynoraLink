import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appUrl, sendEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/admin";
import { hasVerifiedAccount } from "@/lib/verified-account";

export const dynamic = "force-dynamic";

const moderationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVE"), itemId: z.string().cuid() }),
  z.object({ action: z.literal("REJECT"), itemId: z.string().cuid() }),
  z.object({ action: z.literal("FEATURE"), itemId: z.string().cuid(), featured: z.boolean() }),
]);
const deleteSchema = z.object({ itemId: z.string().trim().min(1).max(191) });
const reviewStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const params = new URL(request.url).searchParams;
  const itemId = params.get("id");
  if (itemId) {
    const item = await prisma.marketplaceItem.findUnique({
      where: { id: itemId },
      select: {
        id: true, title: true, description: true, type: true, priceCents: true, currency: true,
        imageUrl: true, productUrl: true, pitch: true, language: true, sellerCity: true,
        includedItems: true, audience: true, financial: true, details: true, photos: true,
        moderationStatus: true, isActive: true, isFeatured: true, createdAt: true,
        seller: { select: { id: true, name: true, image: true, handle: true, email: true } },
      },
    });
    if (!item) return NextResponse.json({ error: "LISTING_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ item });
  }

  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize")) || 20));
  const search = params.get("q")?.trim();
  const requestedStatus = params.get("status") ?? "ALL";
  if (requestedStatus !== "ALL" && !reviewStatuses.includes(requestedStatus as typeof reviewStatuses[number])) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  const where: Prisma.MarketplaceItemWhereInput = {
    ...(requestedStatus === "ALL" ? {} : { moderationStatus: requestedStatus as typeof reviewStatuses[number] }),
    ...(search ? { OR: [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };
  const [items, total, statusCounts] = await Promise.all([
    prisma.marketplaceItem.findMany({
      where,
      orderBy: [{ moderationStatus: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, title: true, description: true, imageUrl: true, type: true, priceCents: true, currency: true,
        isActive: true, isFeatured: true, moderationStatus: true, reviewedBy: true, reviewDate: true, createdAt: true,
        seller: { select: { id: true, name: true, email: true, handle: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.marketplaceItem.count({ where }),
    prisma.marketplaceItem.groupBy({ by: ["moderationStatus"], _count: { _all: true } }),
  ]);
  return NextResponse.json({
    items,
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    statusCounts: Object.fromEntries(statusCounts.map(({ moderationStatus, _count }) => [moderationStatus, _count._all])),
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  const input = parsed.data;
  if (input.action === "APPROVE") {
    const listing = await prisma.marketplaceItem.findUnique({
      where: { id: input.itemId },
      select: { sellerId: true },
    });
    if (!listing) return NextResponse.json({ error: "LISTING_NOT_FOUND" }, { status: 404 });
    if (!await hasVerifiedAccount(listing.sellerId)) {
      return NextResponse.json({ error: "SELLER_VERIFICATION_REQUIRED" }, { status: 409 });
    }
  }

  try {
    const item = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.marketplaceItem.update({
        where: { id: input.itemId },
        data: input.action === "FEATURE"
          ? { isFeatured: input.featured }
          : {
            moderationStatus: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
            isActive: input.action === "APPROVE",
            reviewedBy: access.userId,
            reviewDate: new Date(),
          },
        select: {
          id: true, title: true, isActive: true, isFeatured: true, moderationStatus: true,
          seller: { select: { email: true, name: true } },
        },
      });
      await transaction.auditLog.create({
        data: { adminId: access.admin.id, action: `ADMIN_MARKETPLACE_${input.action}`, targetId: input.itemId },
      });
      return updated;
    });

    let notificationSent: boolean | null = null;
    if (input.action !== "FEATURE") {
      const approved = input.action === "APPROVE";
      const safeTitle = escapeHtml(item.title);
      try {
        const result = await sendEmail({
          to: item.seller.email,
          subject: approved ? `Votre annonce « ${item.title} » est publiée` : `Mise à jour de votre annonce « ${item.title} »`,
          text: approved
            ? `Bonjour ${item.seller.name ?? ""}, votre annonce « ${item.title} » a été approuvée et publiée sur LynoraLink. ${appUrl()}/marketplace`
            : `Bonjour ${item.seller.name ?? ""}, votre annonce « ${item.title} » n'a pas été approuvée. Vous pouvez la modifier puis la soumettre à nouveau depuis votre espace vendeur.`,
          html: `<p>Bonjour ${escapeHtml(item.seller.name ?? "")},</p><p>${approved ? `Votre annonce « ${safeTitle} » a été approuvée et publiée.` : `Votre annonce « ${safeTitle} » n’a pas été approuvée. Vous pouvez la modifier puis la soumettre à nouveau depuis votre espace vendeur.`}</p>${approved ? `<p><a href="${appUrl()}/marketplace">Voir la marketplace</a></p>` : ""}`,
          locale: "FR",
        });
        notificationSent = result.ok;
      } catch (emailError) {
        console.error("Marketplace seller notification error:", emailError);
        notificationSent = false;
      }
    }
    return NextResponse.json({ item: { ...item, seller: undefined }, notificationSent });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "LISTING_NOT_FOUND" }, { status: 404 });
    }
    console.error("Admin marketplace moderation error:", error);
    return NextResponse.json({ error: "REVIEW_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  try {
    await prisma.$transaction(async (transaction) => {
      const item = await transaction.marketplaceItem.findUnique({
        where: { id: parsed.data.itemId },
        select: { id: true, _count: { select: { orders: true } } },
      });
      if (!item) throw new Error("LISTING_NOT_FOUND");
      if (item._count.orders > 0) throw new Error("LISTING_HAS_ORDERS");
      await transaction.marketplaceItem.delete({ where: { id: item.id } });
      await transaction.auditLog.create({
        data: { adminId: access.admin.id, action: "ADMIN_MARKETPLACE_DELETE", targetId: item.id },
      });
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "LISTING_NOT_FOUND") return NextResponse.json({ error: "LISTING_NOT_FOUND" }, { status: 404 });
    if (error instanceof Error && error.message === "LISTING_HAS_ORDERS") return NextResponse.json({ error: "LISTING_HAS_ORDERS" }, { status: 409 });
    console.error("Admin marketplace delete error:", error);
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}