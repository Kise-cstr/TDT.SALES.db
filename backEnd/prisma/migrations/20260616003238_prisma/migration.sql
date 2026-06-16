-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifications" JSONB,
ADD COLUMN     "passwordFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "recoveryFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recoveryLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "recoveryLockedUntil" TIMESTAMP(3),
ADD COLUMN     "recoveryPhraseHash" TEXT;
