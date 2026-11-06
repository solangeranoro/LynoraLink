import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CloudinaryStorageError, getCloudinaryAssetResponse, isCloudinaryResourceType } from "@/lib/cloudinary-storage";
import {
  decryptMessageAttachment,
  decryptMessageAttachmentMetadata,
  MessageEncryptionError,
} from "@/lib/message-encryption";

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
      id: true,
      name: true,
      mimeType: true,
      size: true,
      data: true,
      cloudinaryPublicId: true,
      cloudinaryResourceType: true,
      cloudinaryFormat: true,
      message: { select: { encryptionVersion: true } },
    },
  });
  if (!attachment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let name = attachment.name;
  let mimeType = attachment.mimeType;
  let size = attachment.size;
  const isServerEncrypted = attachment.message.encryptionVersion === 2;
  if (isServerEncrypted) {
    try {
      ({ name, mimeType, size } = decryptMessageAttachmentMetadata(attachment.name, attachment.id));
    } catch (error) {
      if (error instanceof MessageEncryptionError) {
        if (error.code === "missing_key") {
          return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_MISSING" }, { status: 503 });
        }
        if (error.code === "invalid_key") {
          return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_INVALID" }, { status: 503 });
        }
        return NextResponse.json({ error: "MESSAGE_DECRYPTION_FAILED" }, { status: 500 });
      }
      throw error;
    }
  }

  const inline = new URL(request.url).searchParams.get("inline") === "1"
    && inlineImageTypes.has(mimeType);
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
      if (isServerEncrypted) {
        try {
          body = decryptMessageAttachment(
            Buffer.from(await cloudinaryResponse.arrayBuffer()),
            `message-attachment-bytes:${params.messageId}:${params.attachmentId}`,
            size,
          );
        } catch (error) {
          if (error instanceof MessageEncryptionError) {
            if (error.code === "missing_key") {
              return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_MISSING" }, { status: 503 });
            }
            if (error.code === "invalid_key") {
              return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_INVALID" }, { status: 503 });
            }
            return NextResponse.json({ error: "MESSAGE_DECRYPTION_FAILED" }, { status: 500 });
          }
          throw error;
        }
      } else {
        body = cloudinaryResponse.body;
      }
    } catch (error) {
      console.error("Message attachment download failed:", error);
      const status = error instanceof CloudinaryStorageError && error.code === "not_configured" ? 503 : 502;
      return NextResponse.json({ error: error instanceof CloudinaryStorageError ? error.code : "attachment_download_failed" }, { status });
    }
  } else if (attachment.data) {
    const fileBytes = new Uint8Array(attachment.data.byteLength);
    fileBytes.set(attachment.data);
    if (isServerEncrypted) {
      try {
        body = decryptMessageAttachment(
          Buffer.from(fileBytes),
          `message-attachment-bytes:${params.messageId}:${params.attachmentId}`,
          size,
        );
      } catch (error) {
        if (error instanceof MessageEncryptionError) {
          if (error.code === "missing_key") {
            return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_MISSING" }, { status: 503 });
          }
          if (error.code === "invalid_key") {
            return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_INVALID" }, { status: 503 });
          }
          return NextResponse.json({ error: "MESSAGE_DECRYPTION_FAILED" }, { status: 500 });
        }
        throw error;
      }
    } else {
      body = fileBytes;
    }
  } else {
    return NextResponse.json({ error: "attachment_storage_unavailable" }, { status: 502 });
  }

  return new Response(body, {
    headers: {
      "Content-Type": inline ? mimeType : "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}