-- Add theme and color customization fields to Profile
ALTER TABLE "Profile"
ADD COLUMN "theme" TEXT,
ADD COLUMN "backgroundColor" TEXT,
ADD COLUMN "textColor" TEXT,
ADD COLUMN "accentColor" TEXT;
