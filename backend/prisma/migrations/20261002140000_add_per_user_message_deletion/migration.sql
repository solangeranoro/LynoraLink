CREATE TABLE "MessageHiddenForUser" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageHiddenForUser_pkey" PRIMARY KEY ("messageId", "userId")
);

CREATE INDEX "MessageHiddenForUser_userId_idx" ON "MessageHiddenForUser"("userId");

ALTER TABLE "MessageHiddenForUser" ADD CONSTRAINT "MessageHiddenForUser_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageHiddenForUser" ADD CONSTRAINT "MessageHiddenForUser_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;