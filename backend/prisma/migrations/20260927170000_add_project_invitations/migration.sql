ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_INVITE';

ALTER TABLE "ProjectCollaborator"
ADD COLUMN "invitedById" TEXT;

CREATE INDEX "ProjectCollaborator_invitedById_idx" ON "ProjectCollaborator"("invitedById");

ALTER TABLE "ProjectCollaborator"
ADD CONSTRAINT "ProjectCollaborator_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;