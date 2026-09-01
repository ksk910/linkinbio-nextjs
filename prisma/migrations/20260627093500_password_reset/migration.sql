-- Add password reset columns to User
ALTER TABLE "User" ADD COLUMN "resetPasswordToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetPasswordExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");
