import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { deleteCloudinaryAsset, uploadCloudinaryAsset } from "../src/lib/cloudinary-storage";

loadEnvConfig(process.cwd(), true);

const prisma = new PrismaClient();
const batchSize = 20;

async function migratePostAttachments() {
  let migrated = 0;
  while (true) {
    const attachments = await prisma.postAttachment.findMany({
      where: { cloudinaryPublicId: null, data: { not: null } },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (!attachments.length) return migrated;

    for (const attachment of attachments) {
      if (!attachment.data) continue;
      const asset = await uploadCloudinaryAsset(
        Buffer.from(attachment.data),
        "lynoralink/attachments/posts",
        attachment.name,
        attachment.mimeType,
      );
      try {
        await prisma.postAttachment.update({
          where: { id: attachment.id },
          data: {
            cloudinaryPublicId: asset.publicId,
            cloudinaryResourceType: asset.resourceType,
            cloudinaryFormat: asset.format,
            data: null,
          },
        });
      } catch (error) {
        await deleteCloudinaryAsset(asset);
        throw error;
      }
      migrated += 1;
    }
  }
}

async function migrateMessageAttachments() {
  let migrated = 0;
  while (true) {
    const attachments = await prisma.messageAttachment.findMany({
      where: { cloudinaryPublicId: null, data: { not: null } },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (!attachments.length) return migrated;

    for (const attachment of attachments) {
      if (!attachment.data) continue;
      const asset = await uploadCloudinaryAsset(
        Buffer.from(attachment.data),
        "lynoralink/attachments/messages",
        attachment.name,
        attachment.mimeType,
      );
      try {
        await prisma.messageAttachment.update({
          where: { id: attachment.id },
          data: {
            cloudinaryPublicId: asset.publicId,
            cloudinaryResourceType: asset.resourceType,
            cloudinaryFormat: asset.format,
            data: null,
          },
        });
      } catch (error) {
        await deleteCloudinaryAsset(asset);
        throw error;
      }
      migrated += 1;
    }
  }
}

async function main() {
  const [posts, messages] = await Promise.all([
    prisma.postAttachment.count({ where: { cloudinaryPublicId: null, data: { not: null } } }),
    prisma.messageAttachment.count({ where: { cloudinaryPublicId: null, data: { not: null } } }),
  ]);
  console.log(`Migrating ${posts} post attachments and ${messages} message attachments to Cloudinary.`);
  const migratedPosts = await migratePostAttachments();
  const migratedMessages = await migrateMessageAttachments();
  console.log(`Migration complete: ${migratedPosts} post attachments, ${migratedMessages} message attachments.`);
}

main()
  .catch((error: unknown) => {
    console.error("Cloudinary attachment migration stopped. Re-run the command to continue remaining files.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
