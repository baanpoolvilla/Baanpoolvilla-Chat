-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "isNameCustomized" BOOLEAN NOT NULL DEFAULT false;
