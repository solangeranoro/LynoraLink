import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const orders = await prisma.marketplaceOrder.findMany({
    where: { buyerId: userId, status: "PAID" },
    select: {
      id: true,
      amountCents: true,
      paidAt: true,
      item: { select: { id: true, title: true, deliveryUrl: true } },
    },
    orderBy: { paidAt: "desc" },
  });
  return NextResponse.json({ orders });
}