-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "DashboardImportBatch" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    CONSTRAINT "UploadedSalesRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UploadedSalesRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DashboardImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    CONSTRAINT "UploadedProductRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UploadedProductRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DashboardImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    CONSTRAINT "UploadedKpiRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UploadedKpiRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DashboardImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
