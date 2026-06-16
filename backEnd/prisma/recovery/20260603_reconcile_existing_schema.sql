-- Safe Prisma migration recovery for an existing PostgreSQL database.
-- This file is additive only: no DROP, TRUNCATE, DELETE, or migrate reset.

CREATE TABLE IF NOT EXISTS "User" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sales',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "qrToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeSessionId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeSessionAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "animationSpeed" TEXT NOT NULL DEFAULT 'Balanced';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionTimeout" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "forced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "forcedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scheduledDeletionAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionCancelledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "qrCodeToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "barcodeToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "qrGeneratedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "barcodeGeneratedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "Lead" (
    "id" SERIAL NOT NULL,
    "customerName" TEXT NOT NULL,
    "contactNumber" TEXT,
    "email" TEXT,
    "leadSource" TEXT,
    "notes" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DashboardImportBatch" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardImportBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "uploaderUserId" INTEGER;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "uploaderEmail" TEXT;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "uploaderName" TEXT;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "datasetType" TEXT;
ALTER TABLE "DashboardImportBatch" ADD COLUMN IF NOT EXISTS "signature" TEXT;

CREATE TABLE IF NOT EXISTS "UploadedSalesRecord" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "date" TEXT,
    "branch" TEXT,
    "repCode" TEXT,
    "repName" TEXT,
    "clientName" TEXT,
    "type" TEXT,
    "terms" TEXT,
    "clientType" TEXT,
    "grossSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalGk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesmanGk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closedDeal" TEXT,
    "leadSource" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedSalesRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UploadedSalesRecord" ADD COLUMN IF NOT EXISTS "salesmanGkPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "UploadedSalesRecord" ADD COLUMN IF NOT EXISTS "fob" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "UploadedSalesRecord" ADD COLUMN IF NOT EXISTS "counter" TEXT;
ALTER TABLE "UploadedSalesRecord" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UploadedProductRecord" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "date" TEXT,
    "invoiceNumber" TEXT,
    "productCode" TEXT,
    "productName" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "salesPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "branch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedProductRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UploadedKpiRecord" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "branch" TEXT,
    "repCode" TEXT,
    "repName" TEXT,
    "kpiType" TEXT,
    "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "month" TEXT,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedKpiRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuthScanLog" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER,
  "email" TEXT,
  "tokenHash" TEXT,
  "scanType" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthScanLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesOrder" (
  "id" SERIAL NOT NULL,
  "date" TIMESTAMP(3),
  "class" TEXT,
  "rep" TEXT,
  "num" TEXT,
  "name" TEXT,
  "fob" DOUBLE PRECISION,
  "salesmanGK" DOUBLE PRECISION,
  "weight" DOUBLE PRECISION,
  "terms" TEXT,
  "counter" TEXT,
  "source" TEXT,
  "amount" DOUBLE PRECISION,
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesProduct" (
  "id" SERIAL NOT NULL,
  "productName" TEXT,
  "category" TEXT,
  "subCategory" TEXT,
  "qty" DOUBLE PRECISION,
  "amount" DOUBLE PRECISION,
  "percentSales" DOUBLE PRECISION,
  "avgPrice" DOUBLE PRECISION,
  "cogs" DOUBLE PRECISION,
  "avgCogs" DOUBLE PRECISION,
  "grossMargin" DOUBLE PRECISION,
  "grossMarginPct" DOUBLE PRECISION,
  "weightKgs" DOUBLE PRECISION,
  "tons" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TimelineSalesRecord" (
  "id" SERIAL NOT NULL,
  "recordDate" TIMESTAMP(3) NOT NULL,
  "invoiceNumber" TEXT,
  "customerName" TEXT,
  "salesmanGk" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sourceFile" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimelineSalesRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TimelineSalesRecord_recordDate_idx" ON "TimelineSalesRecord"("recordDate");
CREATE INDEX IF NOT EXISTS "TimelineSalesRecord_sourceFile_idx" ON "TimelineSalesRecord"("sourceFile");
