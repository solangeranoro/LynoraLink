import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({
    status: session.user.accountStatus ?? "ACTIVE",
    suspendedUntil: session.user.suspendedUntil ?? null,
    reason: session.user.accountStatusReason ?? null,
  });
}
