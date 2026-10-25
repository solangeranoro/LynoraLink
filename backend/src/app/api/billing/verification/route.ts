import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPaddleCopilotEntitled } from "@/lib/paddle";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const subscription = await prisma.paddleCopilotSubscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  });
  const active = isPaddleCopilotEntitled(
    subscription?.status ?? "",
    subscription?.currentPeriodEnd ?? null,
  );
  return NextResponse.json({ isPremium: active }, {
    headers: { "Cache-Control": "no-store" },
  });
}
