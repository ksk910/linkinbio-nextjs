-- Add account visibility status to profiles.
ALTER TABLE "Profile"
ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'active';
