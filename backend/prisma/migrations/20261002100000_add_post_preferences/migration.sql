CREATE TABLE "PostPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostPreference_userId_postId_key" ON "PostPreference"("userId", "postId");
CREATE INDEX "PostPreference_userId_saved_idx" ON "PostPreference"("userId", "saved");
CREATE INDEX "PostPreference_userId_hidden_idx" ON "PostPreference"("userId", "hidden");

ALTER TABLE "PostPreference" ADD CONSTRAINT "PostPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostPreference" ADD CONSTRAINT "PostPreference_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;