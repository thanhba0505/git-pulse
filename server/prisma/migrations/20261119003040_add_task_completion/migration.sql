-- AlterTable
ALTER TABLE "tracking_tasks" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "is_completed" BOOLEAN NOT NULL DEFAULT false;
