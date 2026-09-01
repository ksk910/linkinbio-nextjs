-- Add type and music provider fields for music links.
ALTER TABLE "Link"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'url',
ADD COLUMN "musicProvider" TEXT;
