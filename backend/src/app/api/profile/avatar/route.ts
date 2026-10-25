import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { CloudinaryImageUploadError, uploadCloudinaryImage } from "@/lib/cloudinary-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const maxAvatarBytes = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let session: Session | null;
  try {
    session = await auth();
  } catch (error) {
    console.error("Avatar upload authentication failed:", error);
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
  if (!(file instanceof File) || !allowedImageTypes.has(file.type) || file.size === 0 || file.size > maxAvatarBytes) {
    return NextResponse.json({ error: "invalid_avatar_file" }, { status: 400 });
  }

  try {
    const image = await uploadCloudinaryImage(file, "lynoralink/avatars", `user_${session.user.id}_${randomUUID()}`);
    try {
      const profile = await prisma.user.update({
        where: { id: session.user.id },
        data: { image },
        select: { image: true },
      });
      return NextResponse.json({ image: profile.image });
    } catch (error) {
      console.error("Profile avatar database update failed:", error);
      return NextResponse.json({ error: "profile_update_unavailable" }, { status: 503 });
    }
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
    console.error("Profile avatar upload failed:", error);
    return NextResponse.json({ error: "avatar_upload_failed" }, { status: 500 });
  }
}