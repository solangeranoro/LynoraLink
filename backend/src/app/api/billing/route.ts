import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasVerifiedAccount } from "@/lib/verified-account";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  return NextResponse.json({ isVerified: await hasVerifiedAccount(userId) }, {
    headers: { "Cache-Control": "no-store" },
  });
}