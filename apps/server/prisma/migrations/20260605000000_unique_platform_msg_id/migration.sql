-- Remove duplicate platformMsgId rows caused by race conditions (keep oldest sentAt)
DELETE FROM "Message"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "platformMsgId" ORDER BY "sentAt" ASC) AS rn
    FROM "Message"
    WHERE "platformMsgId" IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Drop old non-unique index
DROP INDEX IF EXISTS "Message_platformMsgId_idx";

-- Add unique constraint (Postgres allows multiple NULLs even with unique index)
CREATE UNIQUE INDEX "Message_platformMsgId_key" ON "Message"("platformMsgId");
