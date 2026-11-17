-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "GitAuthType" AS ENUM ('OAUTH', 'PAT');

-- CreateEnum
CREATE TYPE "AiEngineType" AS ENUM ('GITHUB_MODELS', 'WEB_LLM');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'NEEDS_REAUTH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authType" "GitAuthType" NOT NULL DEFAULT 'OAUTH',
    "encryptedToken" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "gitUsername" TEXT NOT NULL,
    "gitId" TEXT,
    "gitAvatar" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasExcessiveScopes" BOOLEAN NOT NULL DEFAULT false,
    "tokenStatus" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "git_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultAiEngine" "AiEngineType" NOT NULL DEFAULT 'GITHUB_MODELS',
    "githubModelName" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "webLlmModelName" TEXT NOT NULL DEFAULT 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    "summaryTone" TEXT NOT NULL DEFAULT 'STANDUP_BULLETS',
    "language" TEXT NOT NULL DEFAULT 'vi',
    "autoCopyToClipboard" BOOLEAN NOT NULL DEFAULT true,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_histories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "prCount" INTEGER NOT NULL DEFAULT 0,
    "commitCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "aiEngineUsed" "AiEngineType" NOT NULL,
    "modelName" TEXT NOT NULL,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_repo_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "git_repo_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_connections" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "api_prefix" VARCHAR(64) NOT NULL DEFAULT '/api/v1',
    "api_key" VARCHAR(255),
    "incoming_secret" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timeout_ms" INTEGER NOT NULL DEFAULT 10000,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "git_accounts_userId_key" ON "git_accounts"("userId");

-- CreateIndex
CREATE INDEX "token_audit_logs_userId_createdAt_idx" ON "token_audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "git_repo_bookmarks_userId_repoFullName_key" ON "git_repo_bookmarks"("userId", "repoFullName");

-- CreateIndex
CREATE UNIQUE INDEX "service_connections_slug_key" ON "service_connections"("slug");

-- AddForeignKey
ALTER TABLE "git_accounts" ADD CONSTRAINT "git_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_histories" ADD CONSTRAINT "report_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_repo_bookmarks" ADD CONSTRAINT "git_repo_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

