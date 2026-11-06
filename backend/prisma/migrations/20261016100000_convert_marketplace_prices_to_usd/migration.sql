UPDATE "MarketplaceItem"
SET "priceCents" = GREATEST(50, ROUND("priceCents"::numeric / 600))::INTEGER,
    "currency" = 'usd'
WHERE UPPER("currency") = 'XOF';

UPDATE "MarketplaceOrder"
SET "amountCents" = ROUND("amountCents"::numeric / 600)::INTEGER;

ALTER TABLE "MarketplaceItem"
ALTER COLUMN "currency" SET DEFAULT 'usd';
