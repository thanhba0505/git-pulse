-- CreateTable
CREATE TABLE "parabol_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "parabol_user_id" TEXT NOT NULL,
    "parabol_name" TEXT,
    "parabol_email" TEXT,
    "encrypted_token" TEXT NOT NULL,
    "token_iv" TEXT NOT NULL,
    "token_tag" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "masked_prefix" VARCHAR(32) NOT NULL,
    "base_url" TEXT NOT NULL DEFAULT 'https://action.parabol.co',
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_verified_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parabol_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parabol_connections_user_id_is_active_idx" ON "parabol_connections"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "parabol_connections_user_id_parabol_user_id_key" ON "parabol_connections"("user_id", "parabol_user_id");

-- AddForeignKey
ALTER TABLE "parabol_connections" ADD CONSTRAINT "parabol_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
