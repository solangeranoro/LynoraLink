import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CloudinaryStorageError, getCloudinaryAssetResponse, isCloudinaryResourceType } from "@/lib/cloudinary-storage";

export const dynamic = "force-dynamic";

const inlineImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; messageId: string; attachmentId: string }> }
) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const attachment = await prisma.messageAttachment.findFirst({
    where: {
      id: params.attachmentId,
      messageId: params.messageId,
      message: { is: { conversationId: params.id, hiddenForUsers: { none: { userId } } } },
    },
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

  const inline = new URL(request.url).searchParams.get("inline") === "1"
    && inlineImageTypes.has(attachment.mimeType);
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
      console.error("Message attachment download failed:", error);
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
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}