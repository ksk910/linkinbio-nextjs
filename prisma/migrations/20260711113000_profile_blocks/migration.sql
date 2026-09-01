-- Add Block table for page block composition and ordering.
CREATE TABLE "Block" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Block"
ADD CONSTRAINT "Block_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Block_profileId_order_idx" ON "Block"("profileId", "order");
