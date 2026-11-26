-- AlterEnum
ALTER TYPE "AiEngineType" ADD VALUE 'MCP_AGENT';

-- CreateTable
CREATE TABLE "mcp_api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "masked_prefix" VARCHAR(32) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read:activity', 'write:activity', 'read:tasks', 'write:tasks', 'ai:summarize', 'read:reports', 'write:reports', 'read:settings', 'write:settings', 'write:parabol']::TEXT[],
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_api_keys_token_hash_key" ON "mcp_api_keys"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_api_keys_user_id_revoked_at_idx" ON "mcp_api_keys"("user_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
