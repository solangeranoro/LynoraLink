import { auth } from "@/lib/auth";
import { getLynoAIQuota, isLynoAIPlatform } from "@/lib/lynoai-quota";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const platform = new URL(request.url).searchParams.get("platform");
  if (!isLynoAIPlatform(platform)) {
    return NextResponse.json({ error: "INVALID_PLATFORM" }, { status: 422 });
  }

  try {
    const quota = await getLynoAIQuota(userId, platform);
    return NextResponse.json(
      { quota },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load LynoAI quota:", error);
    return NextResponse.json({ error: "LYNOAI_QUOTA_UNAVAILABLE" }, { status: 503 });
  }
}
