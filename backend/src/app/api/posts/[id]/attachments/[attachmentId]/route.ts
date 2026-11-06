import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/project-access";
import { CloudinaryStorageError, getCloudinaryAssetResponse, isCloudinaryResourceType } from "@/lib/cloudinary-storage";

export const dynamic = "force-dynamic";

const inlineMediaTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/ogg"]);

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!(await canViewPost(params.id, session?.user?.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const attachment = await prisma.postAttachment.findFirst({
    where: { id: params.attachmentId, postId: params.id },
    select: {
      name: true,
      mimeType: true,
      size: true,
      data: true,
      cloudinaryPublicId: true,
      cloudinaryResourceType: true,
      cloudinaryFormat: true,
    },
  });
  if (!attachment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const inline = new URL(req.url).searchParams.get("inline") === "1"
    && inlineMediaTypes.has(attachment.mimeType);
  const fileName = encodeURIComponent(attachment.name);
  const resourceType = attachment.cloudinaryResourceType;
  let body: BodyInit;
  if (attachment.cloudinaryPublicId && attachment.cloudinaryFormat && resourceType && isCloudinaryResourceType(resourceType)) {
    try {
      const cloudinaryResponse = await getCloudinaryAssetResponse({
        publicId: attachment.cloudinaryPublicId,
        resourceType,
        format: attachment.cloudinaryFormat,
      });
      if (!cloudinaryResponse.body) return NextResponse.json({ error: "attachment_download_failed" }, { status: 502 });
      body = cloudinaryResponse.body;
    } catch (error) {
      console.error("Post attachment download failed:", error);
      const status = error instanceof CloudinaryStorageError && error.code === "not_configured" ? 503 : 502;
      return NextResponse.json({ error: error instanceof CloudinaryStorageError ? error.code : "attachment_download_failed" }, { status });
    }
  } else if (attachment.data) {
    const fileBytes = new Uint8Array(attachment.data.byteLength);
    fileBytes.set(attachment.data);
    body = fileBytes;
  } else {
    return NextResponse.json({ error: "attachment_storage_unavailable" }, { status: 502 });
  }

  return new Response(body, {
    headers: {
      "Content-Type": inline ? attachment.mimeType : "application/octet-stream",
      "Content-Length": String(attachment.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${fileName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}