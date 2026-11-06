CREATE TYPE "AdminReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Project"
  ADD COLUMN "moderationStatus" "AdminReviewStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewDate" TIMESTAMP(3);

ALTER TABLE "Project" ALTER COLUMN "moderationStatus" SET DEFAULT 'PENDING';

ALTER TABLE "Post"
  ADD COLUMN "moderationStatus" "AdminReviewStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewDate" TIMESTAMP(3),
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MarketplaceItem"
  ADD COLUMN "moderationStatus" "AdminReviewStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewDate" TIMESTAMP(3),
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

UPDATE "MarketplaceItem"
SET "moderationStatus" = 'PENDING'
WHERE "isActive" = false;

ALTER TABLE "MarketplaceItem" ALTER COLUMN "moderationStatus" SET DEFAULT 'PENDING';

CREATE INDEX "Project_moderationStatus_createdAt_idx" ON "Project"("moderationStatus", "createdAt");
CREATE INDEX "Post_moderationStatus_createdAt_idx" ON "Post"("moderationStatus", "createdAt");
CREATE INDEX "Post_isFeatured_createdAt_idx" ON "Post"("isFeatured", "createdAt");
CREATE INDEX "MarketplaceItem_moderationStatus_createdAt_idx" ON "MarketplaceItem"("moderationStatus", "createdAt");
CREATE INDEX "MarketplaceItem_isFeatured_createdAt_idx" ON "MarketplaceItem"("isFeatured", "createdAt");