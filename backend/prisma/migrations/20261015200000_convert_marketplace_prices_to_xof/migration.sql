UPDATE "MarketplaceItem"
SET "priceCents" = ROUND("priceCents"::numeric * 6)::INTEGER * 100,
    "currency" = 'xof'
WHERE UPPER("currency") = 'USD';

UPDATE "MarketplaceOrder"
SET "amountCents" = "amountCents" * 600;

UPDATE "LiveEvent"
SET "priceCents" = ROUND("priceCents"::numeric * 6)::INTEGER * 100,
    "currency" = 'xof'
WHERE UPPER("currency") = 'USD';
