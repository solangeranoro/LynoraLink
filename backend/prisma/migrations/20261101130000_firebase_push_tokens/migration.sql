CREATE TABLE "FirebasePushToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirebasePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FirebasePushToken_token_key" ON "FirebasePushToken"("token");
CREATE INDEX "FirebasePushToken_userId_idx" ON "FirebasePushToken"("userId");

ALTER TABLE "FirebasePushToken" ADD CONSTRAINT "FirebasePushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
