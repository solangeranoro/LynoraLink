ALTER TABLE "ConversationMember" ADD COLUMN "typingAt" TIMESTAMP(3);

CREATE INDEX "ConversationMember_conversationId_typingAt_idx"
ON "ConversationMember"("conversationId", "typingAt");