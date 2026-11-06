import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { CloudinaryStorageError, deleteCloudinaryAsset, uploadCloudinaryAsset, type CloudinaryAsset } from "@/lib/cloudinary-storage";
import {
  encryptMessageAttachment,
  encryptMessageAttachmentMetadata,
  encryptMessageContent,
  decryptMessageContent,
  MessageEncryptionError,
} from "@/lib/message-encryption";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 + MAX_ATTACHMENT_COUNT * 16;

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

function encryptionErrorResponse(error: MessageEncryptionError) {
  if (error.code === "missing_key") {
    return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_MISSING" }, { status: 503 });
  }
  if (error.code === "invalid_key") {
    return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_INVALID" }, { status: 503 });
  }
  return NextResponse.json({ error: "MESSAGE_ENCRYPTION_FAILED" }, { status: 500 });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  let files: File[] = [];
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "INVALID_FORM_DATA" }, { status: 400 });
    }
    const rawFiles = formData.getAll("attachments");
    if (rawFiles.some((file) => !isUploadedFile(file))) {
      return NextResponse.json({ error: "INVALID_ATTACHMENT" }, { status: 422 });
    }
    files = rawFiles.filter(isUploadedFile);
    const content = formData.get("content");
    const replyToId = formData.get("replyToId");
    body = {
      content: typeof content === "string" ? content : "",
      replyToId: typeof replyToId === "string" && replyToId ? replyToId : undefined,
    };
  } else {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
  }

  const parsed = z.object({
    content: z.string().max(2_100_000),
    replyToId: z.string().min(1).max(100).optional(),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });

  if (files.length > MAX_ATTACHMENT_COUNT || files.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "ATTACHMENT_LIMIT" }, { status: 413 });
  }

  let replyToContentForResponse: string | null = null;
  if (parsed.data.replyToId) {
    const replyTarget = await prisma.message.findFirst({
      where: { id: parsed.data.replyToId, conversationId: params.id },
      select: { id: true, content: true, encryptionVersion: true },
    });
    if (!replyTarget) return NextResponse.json({ error: "REPLY_NOT_FOUND" }, { status: 404 });
    if (replyTarget.encryptionVersion === 2) {
      try {
        replyToContentForResponse = decryptMessageContent(
          replyTarget.content,
          `message-body:${params.id}:${replyTarget.id}`,
        );
      } catch (error) {
        if (error instanceof MessageEncryptionError) return encryptionErrorResponse(error);
        throw error;
      }
    }
  }

  const messageId = randomUUID();
  let encryptedContent: string;
  const preparedAttachments: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    position: number;
    data: Buffer;
  }[] = [];
  try {
    encryptedContent = encryptMessageContent(
      parsed.data.content,
      `message-body:${params.id}:${messageId}`,
    );
    for (let position = 0; position < files.length; position += 1) {
      const file = files[position];
      const id = randomUUID();
      const plaintext = Buffer.from(await file.arrayBuffer());
      const encrypted = encryptMessageAttachment(
        plaintext,
        `message-attachment-bytes:${messageId}:${id}`,
      );
      preparedAttachments.push({
        id,
        name: encryptMessageAttachmentMetadata({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }, id),
        mimeType: "application/octet-stream",
        size: 0,
        position,
        data: encrypted,
      });
    }
  } catch (error) {
    if (error instanceof MessageEncryptionError) return encryptionErrorResponse(error);
    console.error("Preparing encrypted message failed:", error);
    return NextResponse.json({ error: "MESSAGE_ENCRYPTION_FAILED" }, { status: 500 });
  }

  const uploadedAssets: CloudinaryAsset[] = [];
  try {
    const attachments = [];
    for (const attachment of preparedAttachments) {
      const asset = await uploadCloudinaryAsset(
        attachment.data,
        "lynoralink/attachments/messages",
        `${attachment.id}.bin`,
        "application/octet-stream",
      );
      uploadedAssets.push(asset);
      attachments.push({
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        position: attachment.position,
        cloudinaryPublicId: asset.publicId,
        cloudinaryResourceType: asset.resourceType,
        cloudinaryFormat: asset.format,
      });
    }

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          id: messageId,
          conversationId: params.id,
          senderId: userId,
          content: encryptedContent,
          encryptionVersion: 2,
          replyToId: parsed.data.replyToId,
          attachments: attachments.length ? { create: attachments } : undefined,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          replyTo: { select: { id: true, content: true, encryptionVersion: true, keyEnvelopes: true, sender: { select: { id: true, name: true, image: true } } } },
          attachments: { select: { id: true, name: true, mimeType: true, size: true, position: true }, orderBy: { position: "asc" } },
        },
      }),
      prisma.conversation.update({ where: { id: params.id }, data: { updatedAt: new Date() } }),
      prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId: params.id, userId } },
        data: { lastReadAt: new Date(), typingAt: null },
      }),
    ]);

    try {
      const recipients = await prisma.conversationMember.findMany({
        where: { conversationId: params.id, userId: { not: userId } },
        select: { userId: true },
      });
      if (recipients.length) {
        const { sendFirebasePushNotification } = await import("@/lib/firebase-push");
        const conversationLink = `/messages?conversationId=${encodeURIComponent(params.id)}`;
        await Promise.all(recipients.map(({ userId: recipientId }) =>
          sendFirebasePushNotification(recipientId, "MESSAGE", userId, conversationLink).catch((error: unknown) => {
            console.error("Firebase message push notification is unavailable:", error);
          }),
        ));
      }
    } catch (error) {
      console.error("Unable to send Firebase message push notifications:", error);
    }

    return NextResponse.json({
      message: {
        ...message,
        content: parsed.data.content,
        replyTo: message.replyTo
          ? {
            ...message.replyTo,
            content: message.replyTo.encryptionVersion === 2
              ? replyToContentForResponse ?? ""
              : message.replyTo.content,
          }
          : null,
        attachments: preparedAttachments.map(({ data: _data, ...attachment }) => ({
          id: attachment.id,
          name: files[attachment.position].name,
          mimeType: files[attachment.position].type || "application/octet-stream",
          size: files[attachment.position].size,
          position: attachment.position,
        })),
      },
    }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Create message with attachments failed:", error);
    const cleanup = await Promise.allSettled(uploadedAssets.map(deleteCloudinaryAsset));
    if (cleanup.some((result) => result.status === "rejected")) {
      console.error("Failed to clean up one or more Cloudinary message attachments.");
    }
    if (error instanceof CloudinaryStorageError) {
      const status = error.code === "not_configured" ? 503 : 502;
      return NextResponse.json({ error: error.code === "not_configured" ? "cloudinary_not_configured" : "cloudinary_upload_failed" }, { status });
    }
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
