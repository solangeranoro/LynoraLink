ALTER TABLE "Post" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Post_isHidden_createdAt_idx" ON "Post"("isHidden", "createdAt");
