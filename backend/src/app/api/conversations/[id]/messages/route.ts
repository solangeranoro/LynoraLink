import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAttachmentMimeType, safeAttachmentFileName } from "@/lib/attachment-files";
import { CloudinaryStorageError, deleteCloudinaryAsset, uploadCloudinaryAsset, type CloudinaryAsset } from "@/lib/cloudinary-storage";
import { prisma } from "@/lib/prisma";

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
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
    const content = formData.get("content");
    const replyToId = formData.get("replyToId");
    const rawFiles = formData.getAll("attachments");
    if (rawFiles.some((file) => !isUploadedFile(file))) {
      return NextResponse.json({ error: "INVALID_ATTACHMENT" }, { status: 422 });
    }
    files = rawFiles.filter(isUploadedFile);
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
    content: z.string().trim().max(5000).optional(),
    replyToId: z.string().cuid().optional(),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  const content = parsed.data.content?.trim() ?? "";
  if (!content && files.length === 0) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });

  if (files.length > MAX_ATTACHMENT_COUNT || files.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "ATTACHMENT_LIMIT" }, { status: 413 });
  }
  const attachmentMimeTypes = files.map(getAttachmentMimeType);
  if (attachmentMimeTypes.some((mimeType) => mimeType === null)) {
    return NextResponse.json({ error: "UNSUPPORTED_ATTACHMENT" }, { status: 415 });
  }

  if (parsed.data.replyToId) {
    const replyTarget = await prisma.message.findFirst({
      where: { id: parsed.data.replyToId, conversationId: params.id },
      select: { id: true },
    });
    if (!replyTarget) return NextResponse.json({ error: "REPLY_NOT_FOUND" }, { status: 404 });
  }

  const uploadedAssets: CloudinaryAsset[] = [];
  try {
    const attachments = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const asset = await uploadCloudinaryAsset(
        Buffer.from(await file.arrayBuffer()),
        "lynoralink/attachments/messages",
        file.name,
        attachmentMimeTypes[index]!,
      );
      uploadedAssets.push(asset);
      attachments.push({
        name: safeAttachmentFileName(file.name),
        mimeType: attachmentMimeTypes[index]!,
        size: file.size,
        cloudinaryPublicId: asset.publicId,
        cloudinaryResourceType: asset.resourceType,
        cloudinaryFormat: asset.format,
      });
    }

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: params.id,
          senderId: userId,
          content,
          replyToId: parsed.data.replyToId,
          attachments: attachments.length ? { create: attachments } : undefined,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true, image: true } } } },
          attachments: { select: { id: true, name: true, mimeType: true, size: true } },
        },
      }),
      prisma.conversation.update({ where: { id: params.id }, data: { updatedAt: new Date() } }),
      prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId: params.id, userId } },
        data: { lastReadAt: new Date(), typingAt: null },
      }),
    ]);

    return NextResponse.json({ message }, { status: 201 });
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