-- Add hidden flag to links for temporary visibility control.
ALTER TABLE "Link"
ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
