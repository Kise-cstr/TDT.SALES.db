const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const sourceFile = 'SO-GK_Amount_2023-Present.csv';
const csvPath = process.argv[2] || process.env.TIMELINE_SALES_CSV_PATH || path.join(__dirname, '..', '..', 'TIMELINE', sourceFile);

const toNumber = value => {
  const parsed = Number(String(value ?? '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = value => {
  const match = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const date = new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2])));
  return Number.isNaN(date.getTime()) ? null : date;
};

async function main() {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = Papa.parse(text, { skipEmptyLines: true }).data;
  const headerIndex = rows.findIndex(row => (
    row.includes('Date') &&
    row.includes('Salesman GK') &&
    row.includes('Amount')
  ));

  if (headerIndex < 0) {
    throw new Error('CSV header not found. Expected Date, Salesman GK, and Amount columns.');
  }

  const header = rows[headerIndex];
  const idx = {
    date: header.indexOf('Date'),
    invoiceNumber: header.indexOf('Num'),
    customerName: header.indexOf('Name'),
    salesmanGk: header.indexOf('Salesman GK'),
    amount: header.indexOf('Amount'),
  };

  const records = rows.slice(headerIndex + 1)
    .map(row => ({
      recordDate: parseDate(row[idx.date]),
      invoiceNumber: String(row[idx.invoiceNumber] ?? '').trim() || null,
      customerName: String(row[idx.customerName] ?? '').trim() || null,
      salesmanGk: toNumber(row[idx.salesmanGk]),
      amount: toNumber(row[idx.amount]),
    }))
    .filter(record => record.recordDate && (
      record.invoiceNumber ||
      record.customerName ||
      record.salesmanGk ||
      record.amount
    ));

  await prisma.$executeRaw`
    DELETE FROM "TimelineSalesRecord"
    WHERE "sourceFile" = ${sourceFile}
  `;

  for (const record of records) {
    await prisma.$executeRaw`
      INSERT INTO "TimelineSalesRecord" ("recordDate", "invoiceNumber", "customerName", "salesmanGk", "amount", "sourceFile", "createdAt")
      VALUES (${record.recordDate}, ${record.invoiceNumber}, ${record.customerName}, ${record.salesmanGk}, ${record.amount}, ${sourceFile}, ${new Date()})
    `;
  }

  const [summary] = await prisma.$queryRaw`
    SELECT COUNT(*) AS count, MIN("recordDate") AS "minDate", MAX("recordDate") AS "maxDate", SUM("amount") AS amount, SUM("salesmanGk") AS gk
    FROM "TimelineSalesRecord"
    WHERE "sourceFile" = ${sourceFile}
  `;

  console.log(JSON.stringify(summary, (_key, value) => (
    typeof value === 'bigint' ? Number(value) : value
  ), 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
