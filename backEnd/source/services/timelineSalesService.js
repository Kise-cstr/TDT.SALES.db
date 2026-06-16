const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const prisma = require('../config/db');

let timelineSeeded = false;

const TIMELINE_CSV_NAME = 'SO-GK_Amount_2023-Present.csv';
const TIMELINE_SOURCE_FILE = TIMELINE_CSV_NAME;

const getTimelineCsvPath = () => (
  process.env.TIMELINE_SALES_CSV_PATH
  || path.join(__dirname, '..', '..', '..', 'TIMELINE', TIMELINE_CSV_NAME)
);

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

const parseTimelineRows = csvText => {
  const rows = Papa.parse(csvText, { skipEmptyLines: true }).data || [];
  const headerIndex = rows.findIndex(row => (
    row.includes('Date') &&
    row.includes('Salesman GK') &&
    row.includes('Amount')
  ));

  if (headerIndex < 0) {
    throw new Error('Timeline CSV header not found. Expected Date, Salesman GK, and Amount columns.');
  }

  const header = rows[headerIndex];
  const idx = {
    date: header.indexOf('Date'),
    invoiceNumber: header.indexOf('Num'),
    customerName: header.indexOf('Name'),
    salesmanGk: header.indexOf('Salesman GK'),
    amount: header.indexOf('Amount'),
  };

  return rows.slice(headerIndex + 1)
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
};

const importTimelineSalesCsv = async csvPath => {
  if (!fs.existsSync(csvPath)) {
    return { ok: false, message: `Timeline CSV not found at ${csvPath}` };
  }

  const text = fs.readFileSync(csvPath, 'utf8');
  const records = parseTimelineRows(text);

  await prisma.$executeRaw`
    DELETE FROM "TimelineSalesRecord"
    WHERE "sourceFile" = ${TIMELINE_SOURCE_FILE}
  `;

  for (const record of records) {
    await prisma.$executeRaw`
      INSERT INTO "TimelineSalesRecord" ("recordDate", "invoiceNumber", "customerName", "salesmanGk", "amount", "sourceFile", "createdAt")
      VALUES (${record.recordDate}, ${record.invoiceNumber}, ${record.customerName}, ${record.salesmanGk}, ${record.amount}, ${TIMELINE_SOURCE_FILE}, ${new Date()})
    `;
  }

  const [summary] = await prisma.$queryRaw`
    SELECT COUNT(*) AS count, MIN("recordDate") AS "minDate", MAX("recordDate") AS "maxDate", SUM("amount") AS amount, SUM("salesmanGk") AS gk
    FROM "TimelineSalesRecord"
    WHERE "sourceFile" = ${TIMELINE_SOURCE_FILE}
  `;

  return {
    ok: true,
    count: Number(summary?.count || records.length || 0),
    minDate: summary?.minDate || null,
    maxDate: summary?.maxDate || null,
    amount: summary?.amount || 0,
    gk: summary?.gk || 0,
  };
};

const ensureTimelineSalesSeeded = async () => {
  if (timelineSeeded) return { ok: true, seeded: false };

  const [summary] = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM "TimelineSalesRecord"
  `;

  if (Number(summary?.count || 0) > 0) {
    timelineSeeded = true;
    return { ok: true, seeded: false };
  }

  const result = await importTimelineSalesCsv(getTimelineCsvPath());
  timelineSeeded = result.ok;
  return { ...result, seeded: true };
};

module.exports = {
  ensureTimelineSalesSeeded,
  getTimelineCsvPath,
  importTimelineSalesCsv,
  parseTimelineRows,
};
