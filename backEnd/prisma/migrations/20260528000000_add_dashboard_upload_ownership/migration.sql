ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "uploaderUserId" INTEGER;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "uploaderEmail" TEXT;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "uploaderName" TEXT;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "datasetType" TEXT;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "signature" TEXT;
