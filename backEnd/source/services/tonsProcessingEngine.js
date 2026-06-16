const path = require('path');
const Papa = require('papaparse');
const {
  computeProductTons,
  extractUnitWeightKg,
  normalizeProductName,
} = require('./productCatalog');

const normalizeText = value => String(value ?? '').replace(/\s+/g, ' ').trim();

const normalizeKey = value => normalizeText(value)
  .toLowerCase()
  .replace(/%/g, 'percent')
  .replace(/[^a-z0-9]+/g, '');

const toNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = normalizeText(value);
  if (!text || /^-+$/.test(text)) return 0;
  const isNegative = /^\(.*\)$/.test(text);
  const cleaned = text
    .replace(/^\((.*)\)$/, '$1')
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
};

const roundTons = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0;
};

function extractKgs(description) {
  return extractUnitWeightKg(description);
}

function extractProductName(description) {
  const text = normalizeText(description);
  if (!text) return '';
  const normalized = normalizeProductName(text);
  if (normalized) return normalized;

  const openIndex = text.indexOf('(');
  const inner = openIndex >= 0
    ? normalizeText(text.slice(openIndex + 1).replace(/\)+$/, ''))
    : text;

  const beforeComma = inner.split(',')[0];
  const withoutKgs = beforeComma.replace(/\([^)]*\d+(?:\.\d+)?\s*kgs?[^)]*\)/ig, '');
  const withoutDimensions = withoutKgs
    .replace(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|x|#|"|')\b.*$/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*x\s*.*$/i, '')
    .trim();

  const product = withoutDimensions || withoutKgs || text.replace(/^[A-Z0-9./&-]+\s*/i, '').split(',')[0];
  return normalizeText(product)
    .toLowerCase()
    .replace(/\b[a-z]/g, char => char.toUpperCase());
}

function computeTons(kgs, qty) {
  return roundTons(computeProductTons({ weightKgs: toNumber(kgs), qty: toNumber(qty) }));
}

function computeTotalTons(rows) {
  return roundTons((rows || []).reduce((sum, row) => sum + toNumber(row.tons), 0));
}

const parseCsvRows = file => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext !== '.csv') {
    throw Object.assign(new Error('Only CSV files are supported by the tons processor.'), { status: 400 });
  }

  const result = Papa.parse(file.buffer.toString('utf8').replace(/^\uFEFF/, ''), {
    skipEmptyLines: false,
  });
  if (result.errors?.length) {
    throw Object.assign(new Error(result.errors.map(error => error.message).join('; ')), { status: 400 });
  }
  return (result.data || []).filter(row => row.some(cell => normalizeText(cell)));
};

const findProductColumn = rows => {
  const scores = new Map();
  rows.forEach(row => {
    row.forEach((cell, index) => {
      const text = normalizeText(cell);
      const score = (/kgs?/i.test(text) ? 5 : 0) + (/\([^)]+/.test(text) ? 1 : 0);
      if (score) scores.set(index, (scores.get(index) || 0) + score);
    });
  });
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
};

const findHeaderRow = rows => {
  let best = { index: -1, score: 0 };
  rows.slice(0, 40).forEach((row, index) => {
    const score = row.map(normalizeKey).filter(key => ['qty', 'quantity', 'pcs', 'amount'].includes(key)).length;
    if (score > best.score) best = { index, score };
  });
  return best.index;
};

const findQtyColumn = (rows, productColumn) => {
  const headerIndex = findHeaderRow(rows);
  const header = rows[headerIndex] || [];
  const headerIndexMatch = header.findIndex(cell => ['qty', 'quantity', 'pcs'].includes(normalizeKey(cell)));
  if (headerIndexMatch >= 0) return headerIndexMatch;

  const numericScores = new Map();
  rows.forEach(row => {
    if (!extractKgs(row[productColumn])) return;
    row.forEach((cell, index) => {
      if (index === productColumn) return;
      const value = toNumber(cell);
      if (value > 0) numericScores.set(index, (numericScores.get(index) || 0) + 1);
    });
  });
  return [...numericScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
};

function normalizeRow(row, mapping) {
  const description = normalizeText(row[mapping.productColumn]);
  const qty = toNumber(row[mapping.qtyColumn]);
  const kgs = extractKgs(description);
  return {
    product: extractProductName(description),
    description,
    qty,
    kgs,
    tons: computeTons(kgs, qty),
  };
}

function validateRow(row) {
  const errors = [];
  if (!row.description) errors.push('Missing product description.');
  if (!row.product) errors.push('Missing product name.');
  if (row.qty <= 0) errors.push('Invalid quantity.');
  if (row.kgs <= 0) errors.push('Missing or invalid KGS.');
  return { valid: errors.length === 0, errors };
}

const isProductCandidate = description => {
  const text = normalizeText(description);
  if (!text || !text.includes('(')) return false;
  if (/^total\b/i.test(text)) return false;
  return /[a-z]/i.test(text);
};

const processTonsCsvFiles = files => {
  const processedRows = [];
  const validation = { errors: [], warnings: [] };
  const mappings = [];

  files.forEach(file => {
    const rows = parseCsvRows(file);
    const productColumn = findProductColumn(rows);
    const qtyColumn = findQtyColumn(rows, productColumn);
    const fileName = file.originalname || 'upload.csv';

    mappings.push({ fileName, productColumn, qtyColumn });
    if (productColumn < 0 || qtyColumn < 0) {
      validation.errors.push({ file: fileName, message: 'Unable to detect product or quantity column.' });
      return;
    }

    rows.forEach((row, index) => {
      if (!isProductCandidate(row[productColumn])) return;
      const normalized = normalizeRow(row, { productColumn, qtyColumn });
      const result = validateRow(normalized);
      if (!result.valid) {
        validation.warnings.push({ file: fileName, row: index + 1, errors: result.errors });
        return;
      }
      processedRows.push(normalized);
    });
  });

  return {
    rows: processedRows,
    totalTons: computeTotalTons(processedRows),
    mappings,
    validation,
  };
};

module.exports = {
  computeTons,
  computeTotalTons,
  extractKgs,
  extractProductName,
  normalizeRow,
  processTonsCsvFiles,
  validateRow,
};
