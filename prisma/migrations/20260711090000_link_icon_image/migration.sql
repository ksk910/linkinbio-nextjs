-- Add optional icon and image URL to links for richer presentation.
ALTER TABLE "Link"
ADD COLUMN "icon" TEXT,
ADD COLUMN "imageUrl" TEXT;
