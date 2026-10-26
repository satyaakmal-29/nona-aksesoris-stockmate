-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'English',
ADD COLUMN     "notification" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "profileImage" TEXT;
