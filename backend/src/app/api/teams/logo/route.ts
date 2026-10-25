import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { CloudinaryImageUploadError, uploadCloudinaryImage } from "@/lib/cloudinary-storage";

export const runtime = "nodejs";

const maxLogoBytes = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let session: Session | null;
  try {
    session = await auth();
  } catch (error) {
    console.error("Team logo upload authentication failed:", error);
    return NextResponse.json({ error: "upload_session_unavailable" }, { status: 503 });
  }
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_upload" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || !allowedImageTypes.has(file.type) || file.size === 0 || file.size > maxLogoBytes) {
    return NextResponse.json({ error: "invalid_team_logo" }, { status: 400 });
  }

  const teamId = formData.get("teamId");
  if (teamId !== null) {
    if (typeof teamId !== "string" || !teamId) return NextResponse.json({ error: "invalid_team" }, { status: 400 });
    let team;
    try {
      team = await prisma.project.findFirst({
        where: { id: teamId, creatorId: session.user.id, teamName: { not: null } },
        select: { id: true },
      });
    } catch (error) {
      console.error("Team logo upload authorization lookup failed:", error);
      return NextResponse.json({ error: "team_lookup_unavailable" }, { status: 503 });
    }
    if (!team) return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const image = await uploadCloudinaryImage(file, "lynoralink/team-logos", `team_${randomUUID()}`);
    if (typeof teamId === "string") {
      try {
        await prisma.project.update({
          where: { id: teamId },
          data: { logoUrl: image },
        });
      } catch (error) {
        console.error("Team logo database update failed:", error);
        return NextResponse.json({ error: "team_logo_update_unavailable" }, { status: 503 });
      }
    }
    return NextResponse.json({ image });
  } catch (error) {
    if (error instanceof CloudinaryImageUploadError) {
      const status = error.code === "not_configured" || error.code === "service_unavailable" ? 503 : 502;
      return NextResponse.json({
        error: error.code === "not_configured" ? "cloudinary_not_configured"
          : error.code === "unreachable" ? "cloudinary_unreachable"
            : error.code === "service_unavailable" ? "cloudinary_temporarily_unavailable"
              : "cloudinary_upload_failed",
        details: error.code === "rejected" ? error.message : undefined,
      }, { status });
    }
    console.error("Team logo upload failed:", error);
    return NextResponse.json({ error: "team_logo_upload_failed" }, { status: 500 });
  }
}
