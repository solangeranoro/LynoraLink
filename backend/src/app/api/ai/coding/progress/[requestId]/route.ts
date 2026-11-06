import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLynoAICodingProgress } from "@/lib/lynoai-progress";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { requestId } = await params;
  const progress = getLynoAICodingProgress(requestId, userId);
  return progress
    ? NextResponse.json(progress, { headers: { "Cache-Control": "no-store" } })
    : new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
