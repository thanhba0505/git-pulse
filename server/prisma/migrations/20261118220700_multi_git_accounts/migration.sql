-- DropIndex
DROP INDEX IF EXISTS "git_accounts_userId_key";

-- AlterTable
ALTER TABLE "git_accounts" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "git_accounts_userId_isActive_idx" ON "git_accounts"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "git_accounts_userId_gitUsername_key" ON "git_accounts"("userId", "gitUsername");
