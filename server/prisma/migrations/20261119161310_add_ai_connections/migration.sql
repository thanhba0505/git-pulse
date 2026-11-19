-- CreateEnum
CREATE TYPE "AiProviderType" AS ENUM ('GOOGLE_GEMINI');

-- AlterEnum
ALTER TYPE "AiEngineType" ADD VALUE 'GOOGLE_GEMINI';

-- CreateTable
CREATE TABLE "ai_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AiProviderType" NOT NULL DEFAULT 'GOOGLE_GEMINI',
    "label" VARCHAR(80) NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "key_iv" TEXT NOT NULL,
    "key_tag" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "masked_key" VARCHAR(32) NOT NULL,
    "available_models" JSONB,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_connections_user_id_provider_idx" ON "ai_connections"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "ai_connections" ADD CONSTRAINT "ai_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
