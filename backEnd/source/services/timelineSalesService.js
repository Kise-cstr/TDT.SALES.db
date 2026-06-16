const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const prisma = require('../config/db');

let timelineSeeded = false;

const getTimelineFolderPath = () => (
  process.env.TIMELINE_SALES_FOLDER_PATH
  || path.join(__dirname, '..', '..', '..', 'TIMELINE')
);

const getTimelineCsvPaths = () => {
  const folderPath = getTimelineFolderPath();
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return [];

  return fs.readdirSync(folderPath)
    .filter(file => file.toLowerCase().endsWith('.csv'))
    .map(file => path.join(folderPath, file))
    .sort((left, right) => left.localeCompare(right));
};

const toNumber = value => {
  const str = String(value ?? '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(str);
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
    .map(row => {
      const salesmanGkRaw = String(row[idx.salesmanGk] ?? '').trim();
      const salesmanGk = salesmanGkRaw ? toNumber(salesmanGkRaw) : 0;
      return {
        recordDate: parseDate(row[idx.date]),
        invoiceNumber: String(row[idx.invoiceNumber] ?? '').trim() || null,
        customerName: String(row[idx.customerName] ?? '').trim() || null,
        salesmanGk,
        amount: toNumber(row[idx.amount]),
      };
    })
    .filter(record => record.recordDate && (
      record.invoiceNumber ||
      record.customerName ||
      record.salesmanGk ||
      record.amount
    ));
};

const importTimelineCsvFile = async csvPath => {
  if (!fs.existsSync(csvPath)) {
    return { ok: false, message: `Timeline CSV not found at ${csvPath}` };
  }

  const sourceFile = path.basename(csvPath);
  const text = fs.readFileSync(csvPath, 'utf8');
  const records = parseTimelineRows(text);

  for (const record of records) {
    await prisma.$executeRaw`
      INSERT INTO "TimelineSalesRecord" ("recordDate", "invoiceNumber", "customerName", "salesmanGk", "amount", "sourceFile", "createdAt")
      VALUES (${record.recordDate}, ${record.invoiceNumber}, ${record.customerName}, ${record.salesmanGk}, ${record.amount}, ${sourceFile}, ${new Date()})
    `;
  }

  return {
    ok: true,
    sourceFile,
    count: records.length,
    minDate: records.reduce((min, record) => (!min || record.recordDate < min ? record.recordDate : min), null),
    maxDate: records.reduce((max, record) => (!max || record.recordDate > max ? record.recordDate : max), null),
    amount: records.reduce((sum, record) => sum + toNumber(record.amount), 0),
    gk: records.reduce((sum, record) => sum + toNumber(record.salesmanGk), 0),
  };
};

const importTimelineSalesFolder = async () => {
  const csvPaths = getTimelineCsvPaths();
  if (!csvPaths.length) {
    return { ok: false, message: `No timeline CSV files found in ${getTimelineFolderPath()}` };
  }

  await prisma.$executeRaw`DELETE FROM "TimelineSalesRecord"`;

  const summaries = [];
  const errors = [];

  for (const csvPath of csvPaths) {
    try {
      const summary = await importTimelineCsvFile(csvPath);
      if (summary?.ok) summaries.push(summary);
    } catch (error) {
      errors.push({ file: path.basename(csvPath), error: error?.message || String(error) });
    }
  }

  if (errors.length) {
    console.error('[timeline-sales] Some timeline CSV files failed to import.', errors);
  }

  const [summary] = await prisma.$queryRaw`
    SELECT COUNT(*) AS count, MIN("recordDate") AS "minDate", MAX("recordDate") AS "maxDate", SUM("amount") AS amount, SUM("salesmanGk") AS gk
    FROM "TimelineSalesRecord"
  `;

  return {
    ok: summaries.length > 0,
    count: Number(summary?.count || 0),
    minDate: summary?.minDate || null,
    maxDate: summary?.maxDate || null,
    amount: summary?.amount || 0,
    gk: summary?.gk || 0,
    files: summaries.length,
    errors,
  };
};

const ensureTimelineSalesSeeded = async () => {
  if (timelineSeeded) return { ok: true, seeded: false };

  const csvPaths = getTimelineCsvPaths();
  if (!csvPaths.length) {
    console.warn('[timeline-sales] No CSV files found in the timeline folder.');
    timelineSeeded = true;
    return { ok: false, seeded: true, message: 'No timeline CSV files found.' };
  }

  const result = await importTimelineSalesFolder();
  timelineSeeded = result.ok;
  return { ...result, seeded: true };
};

module.exports = {
  ensureTimelineSalesSeeded,
  getTimelineFolderPath,
  getTimelineCsvPaths,
  importTimelineCsvFile,
  importTimelineSalesFolder,
  parseTimelineRows,
};
