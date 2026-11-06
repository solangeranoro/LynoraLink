import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { CloudinaryImageUploadError, uploadCloudinaryImage } from "@/lib/cloudinary-storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const maxImageBytes = 20 * 1024 * 1024;
const allowedImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_UPLOAD" }, { status: 400 });
  }

  const file = formData.get("file");
  const purpose = formData.get("purpose");
  if (!(file instanceof File) || !allowedImageTypes.has(file.type) || file.size === 0 || file.size > maxImageBytes) {
    return NextResponse.json({ error: "INVALID_APPLICATION_IMAGE" }, { status: 400 });
  }
  if (purpose !== "logo" && purpose !== "screenshot") {
    return NextResponse.json({ error: "INVALID_IMAGE_PURPOSE" }, { status: 400 });
  }

  try {
    const image = await uploadCloudinaryImage(
      file,
      `lynoralink/tester-applications/${purpose}s`,
      `tester_application_${randomUUID()}`,
    );
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
    console.error("Tester application image upload failed:", error);
    return NextResponse.json({ error: "application_image_upload_failed" }, { status: 500 });
  }
}
