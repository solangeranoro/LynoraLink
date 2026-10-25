import { NextResponse } from "next/server";
import { getTopMakers } from "@/lib/gamification";

export const dynamic = "force-dynamic";

export async function GET() {
  const makers = await getTopMakers();
  return NextResponse.json({ makers });
}
