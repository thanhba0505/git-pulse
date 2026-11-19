-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "fetch_preferences" JSONB;

-- CreateTable
CREATE TABLE "tracking_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "color" VARCHAR(32) NOT NULL DEFAULT 'sky',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_task_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repo" VARCHAR(255) NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "prUrl" VARCHAR(500) NOT NULL,
    "state" VARCHAR(32) NOT NULL DEFAULT 'open',
    "owner_type" VARCHAR(32) NOT NULL DEFAULT 'personal',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_task_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracking_tasks_userId_updatedAt_idx" ON "tracking_tasks"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_task_items_taskId_repo_pr_number_key" ON "tracking_task_items"("taskId", "repo", "pr_number");

-- AddForeignKey
ALTER TABLE "tracking_tasks" ADD CONSTRAINT "tracking_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_task_items" ADD CONSTRAINT "tracking_task_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tracking_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
