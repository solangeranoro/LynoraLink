import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { CloudinaryImageUploadError, uploadCloudinaryImage } from "@/lib/cloudinary-storage";

export const runtime = "nodejs";

const maxImageBytes = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let session: Session | null;
  try {
    session = await auth();
  } catch (error) {
    console.error("Project image upload authentication failed:", error);
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
  const purpose = formData.get("purpose");
  if (!(file instanceof File) || !allowedImageTypes.has(file.type) || file.size === 0 || file.size > maxImageBytes) {
    return NextResponse.json({ error: "invalid_project_image" }, { status: 400 });
  }
  if (purpose !== "logo" && purpose !== "cover") {
    return NextResponse.json({ error: "invalid_image_purpose" }, { status: 400 });
  }

  try {
    const image = await uploadCloudinaryImage(file, `lynoralink/projects/${purpose}s`, `project_${randomUUID()}`);
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
    console.error("Project image upload failed:", error);
    return NextResponse.json({ error: "project_image_upload_failed" }, { status: 500 });
  }
}
