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
  "Kgs" DOUBLE PRECISION,
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
