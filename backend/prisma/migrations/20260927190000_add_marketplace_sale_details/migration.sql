ALTER TABLE "MarketplaceItem"
  ADD COLUMN "productUrl" TEXT,
  ADD COLUMN "pitch" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "sellerCity" TEXT,
  ADD COLUMN "includedItems" JSONB,
  ADD COLUMN "audience" JSONB,
  ADD COLUMN "financial" JSONB,
  ADD COLUMN "details" JSONB,
  ADD COLUMN "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "complianceAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "complianceAcceptedAt" TIMESTAMP(3);