CREATE TABLE "CodingWorkspace" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodingFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "isDirectory" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodingExtension" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingExtension_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CodingWorkspace_ownerId_key" ON "CodingWorkspace"("ownerId");
CREATE UNIQUE INDEX "CodingFile_workspaceId_path_key" ON "CodingFile"("workspaceId", "path");
CREATE UNIQUE INDEX "CodingExtension_ownerId_slug_key" ON "CodingExtension"("ownerId", "slug");
CREATE INDEX "CodingExtension_published_name_idx" ON "CodingExtension"("published", "name");

ALTER TABLE "CodingWorkspace"
    ADD CONSTRAINT "CodingWorkspace_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodingFile"
    ADD CONSTRAINT "CodingFile_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "CodingWorkspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodingExtension"
    ADD CONSTRAINT "CodingExtension_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
