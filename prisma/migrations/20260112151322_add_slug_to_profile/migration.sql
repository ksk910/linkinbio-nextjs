/*
 Make adding `slug` safe on non-empty tables:
 1) Add column as nullable
 2) Backfill existing rows (use id as initial slug)
 3) Enforce NOT NULL
 4) Add UNIQUE index
*/

-- 1) Add column as nullable
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- 2) Backfill existing rows
UPDATE "Profile" SET "slug" = "id" WHERE "slug" IS NULL;

-- 3) Enforce NOT NULL
ALTER TABLE "Profile" ALTER COLUMN "slug" SET NOT NULL;

-- 4) Add UNIQUE index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Profile_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");
  END IF;
END
$$;
