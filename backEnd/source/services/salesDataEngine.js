const path = require('path');
const Papa = require('papaparse');
const XLSX = require('xlsx');
const {
  computeProductTons,
  extractUnitWeightKg,
} = require('./productCatalog');

const COUNTERS = new Set(['Revival (REV)', 'First Time (FT)', 'New (N/n)', 'No Counter']);

const normalizeText = (value, fallback = '') => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

const normalizeKey = value => normalizeText(value)
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/%/g, 'percent')
  .replace(/[^a-z0-9]+/g, '');

const titleCase = value => normalizeText(value)
  .toLowerCase()
  .replace(/\b[a-z]/g, char => char.toUpperCase());

const normalizeName = (value, fallback = 'Unassigned') => {
  const text = normalizeText(value);
  return text ? titleCase(text) : fallback;
};

const salesRepNamesByCode = new Map([
  ['1ema', 'Emmalyn Moloboco'],
  ['1mrky', 'Marky Cabajar'],
  ['1aga', 'Michael Angelo Blancia'],
  ['1mldy', 'Melody Santos'],
  ['1knd', 'Karen Dy'],
  ['1dlm', 'Dan Loren Mendoza'],
  ['1den', 'Dennis Espinar'],
  ['1dan', 'Daniel Justine Habana'],
  ['11ber', 'Bernabe Lanzaderas'],
  ['11bry', 'Bryan Banadera'],
]);

const normalizeSalesRep = value => salesRepNamesByCode.get(normalizeKey(value)) || normalizeName(value);

const normalizeCounter = value => {
  const key = normalizeText(value).toLowerCase();
  if (!key) return 'No Counter';
  if (key === 'n' || key === 'new' || key === 'n/n' || key === 'new (n)' || key === 'new (n/n)') return 'New (N/n)';
  if (key === 'ft' || key === 'f/t' || key.includes('first')) return 'First Time (FT)';
  if (key === 'r' || key === 'rev' || key.includes('revival')) return 'Revival (REV)';
  return COUNTERS.has(value) ? value : 'No Counter';
};

const parseNumber = value => {
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

const parseDate = value => {
  const text = normalizeText(value);
  if (!text || /^[A-Za-z]+$/.test(text)) return null;

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    const date = new Date(Math.round((serial - 25569) * 86400000));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    const date = new Date(Date.UTC(year, Number(slash[1]) - 1, Number(slash[2])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateString = value => {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
};

const extractProductName = value => {
  const text = normalizeText(value);
  const inner = normalizeText(text.slice(text.indexOf('(') + 1).replace(/\)+$/, ''));
  const description = inner && text.includes('(') ? inner : text;
  const beforeComma = description.split(',')[0];
  const withoutKgs = beforeComma.replace(/\([^)]*\d+(?:\.\d+)?\s*kgs?[^)]*\)/ig, '');
  const withoutDimensions = withoutKgs
    .replace(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|x|#|"|')\b.*$/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*x\s*.*$/i, '')
    .trim();

  if (withoutDimensions) return titleCase(withoutDimensions);

  const fallback = description
    .replace(/^[A-Z0-9./&-]+\s*/i, '')
    .replace(/\([^)]*kgs?[^)]*\)/ig, '')
    .split(',')[0];
  return titleCase(fallback || text);
};

const extractKgs = value => {
  return extractUnitWeightKg(value);
};

const computeTons = (kgs, qty) => {
  const tons = computeProductTons({ weightKgs: parseNumber(kgs), qty: parseNumber(qty) });
  return Number.isFinite(tons) ? Math.round(tons * 1000000) / 1000000 : 0;
};

const removeEmptyRows = rows => rows.filter(row => row.some(cell => normalizeText(cell)));

const parseFileRows = file => {
  const ext = path.extname(file.originalname || file.name || '').toLowerCase();
  if (['.xlsx', '.xls'].includes(ext)) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    return removeEmptyRows(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' }));
  }

  const result = Papa.parse(file.buffer.toString('utf8').replace(/^\uFEFF/, ''), {
    skipEmptyLines: false,
  });
  if (result.errors?.length) {
    const message = result.errors.map(error => error.message).join('; ');
    throw Object.assign(new Error(`CSV parse error in ${file.originalname}: ${message}`), { status: 400 });
  }
  return removeEmptyRows(result.data || []);
};

const scoreHeader = (row, groups) => {
  const keys = row.map(normalizeKey);
  return groups.reduce((score, group) => (
    score + (keys.some(key => group.some(term => key.includes(term))) ? 1 : 0)
  ), 0);
};

const findHeaderRow = (rows, groups, minimum = 3) => {
  let best = { index: -1, score: 0 };
  rows.slice(0, 50).forEach((row, index) => {
    const score = scoreHeader(row, groups);
    if (score > best.score) best = { index, score };
  });
  return best.score >= minimum ? best.index : -1;
};

const findColumn = (header, groups) => {
  const keys = header.map(normalizeKey);
  for (const group of groups) {
    const index = keys.findIndex(key => group.every(term => key.includes(term)));
    if (index >= 0) return index;
  }
  return -1;
};

const inferProductDescriptionColumn = rows => {
  const scores = new Map();
  rows.forEach(row => {
    row.forEach((cell, index) => {
      const text = normalizeText(cell);
      const score = (/\([^)]+,\s*[^)]/.test(text) ? 2 : 0) + (/kgs?/i.test(text) ? 3 : 0);
      if (score) scores.set(index, (scores.get(index) || 0) + score);
    });
  });
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
};

const addValidation = (messages, file, row, field, message) => {
  messages.push({ file, row, field, message });
};

const detectFileType = (fileName, rows) => {
  const name = normalizeText(fileName).toLowerCase();
  if (name.includes('product')) return 'product';
  if (name.includes('so-') || name.includes('sales order')) return 'salesOrder';
  if (inferProductDescriptionColumn(rows) >= 0) return 'product';
  return 'salesOrder';
};

const dedupeBy = (rows, keyGetter) => {
  const seen = new Set();
  return rows.filter(row => {
    const key = keyGetter(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isSubtotalOrReportRow = value => /^total\b/i.test(normalizeText(value));

const parseSalesOrders = (rows, fileName) => {
  const errors = [];
  const warnings = [];
  const headerIndex = findHeaderRow(rows, [
    ['date'], ['rep'], ['num'], ['name'], ['source'], ['counter'], ['amount']
  ], 4);

  if (headerIndex < 0) {
    return { records: [], errors: [{ file: fileName, message: 'Unable to detect sales order headers.' }], warnings, mapping: {} };
  }

  const header = rows[headerIndex];
  const mapping = {
    date: findColumn(header, [['date']]),
    salesRep: findColumn(header, [['rep'], ['salesman']]),
    salesOrderNo: findColumn(header, [['num'], ['orderno'], ['invoice'], ['dr']]),
    customer: findColumn(header, [['name'], ['customer'], ['client']]),
    source: findColumn(header, [['source'], ['leadsource']]),
    counter: findColumn(header, [['counter']]),
    totalSales: findColumn(header, [['amount'], ['grosssales'], ['sales']]),
  };

  ['date', 'salesRep', 'customer', 'totalSales'].forEach(field => {
    if (mapping[field] < 0) errors.push({ file: fileName, message: `Missing required sales order column: ${field}.` });
  });
  if (errors.length) return { records: [], errors, warnings, mapping };

  const records = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const date = toDateString(row[mapping.date]);
    const totalSales = parseNumber(row[mapping.totalSales]);
    const customer = normalizeName(row[mapping.customer], '');

    if (!date && !totalSales && !customer) return;
    if (!date) {
      addValidation(warnings, fileName, rowNumber, 'date', 'Invalid date. Row skipped.');
      return;
    }
    if (totalSales <= 0) {
      addValidation(warnings, fileName, rowNumber, 'totalSales', 'Invalid sales amount. Row skipped.');
      return;
    }

    records.push({
      type: 'salesOrder',
      date,
      salesOrderNo: normalizeText(row[mapping.salesOrderNo]),
      salesRep: normalizeSalesRep(row[mapping.salesRep]),
      customer,
      source: normalizeName(row[mapping.source], 'Unspecified'),
      counter: normalizeCounter(row[mapping.counter]),
      totalSales,
    });
  });

  return {
    records,
    errors,
    warnings,
    mapping,
  };
};

const parseProducts = (rows, fileName) => {
  const errors = [];
  const warnings = [];
  const headerIndex = findHeaderRow(rows, [['qty'], ['cogs'], ['grossmargin']], 2);
  const header = rows[headerIndex] || [];
  const description = inferProductDescriptionColumn(rows);
  const mapping = {
    description,
    qty: findColumn(header, [['qty'], ['quantity']]),
    cogs: findColumn(header, [['cogs'], ['cost']]),
  };

  if (mapping.description < 0) errors.push({ file: fileName, message: 'Unable to detect product description column.' });
  if (mapping.qty < 0) errors.push({ file: fileName, message: 'Unable to detect product quantity column.' });
  if (errors.length) return { records: [], errors, warnings, mapping };

  const records = [];
  rows.slice(Math.max(headerIndex + 1, 0)).forEach((row, offset) => {
    const rowNumber = Math.max(headerIndex + 1, 0) + offset + 1;
    const descriptionText = normalizeText(row[mapping.description]);
    if (!descriptionText || !descriptionText.includes('(') || isSubtotalOrReportRow(descriptionText)) return;

    const qty = parseNumber(row[mapping.qty]);
    const kgs = extractKgs(descriptionText);
    const amount = mapping.cogs >= 0 ? parseNumber(row[mapping.cogs]) : 0;

    if (qty <= 0 && amount <= 0) return;
    if (qty <= 0) {
      addValidation(warnings, fileName, rowNumber, 'qty', 'Invalid quantity. Row skipped.');
      return;
    }
    if (!kgs) {
      addValidation(warnings, fileName, rowNumber, 'kgs', 'KGS not found. Row skipped because tons cannot be computed accurately.');
      return;
    }

    records.push({
      type: 'product',
      product: extractProductName(descriptionText),
      productDescription: descriptionText,
      qty,
      kgs,
      tons: computeTons(kgs, qty),
      amount,
    });
  });

  return {
    records: dedupeBy(records, row => `${row.productDescription}|${row.qty}|${row.amount}`),
    errors,
    warnings,
    mapping,
  };
};

const buildSummary = (salesOrders, products) => ({
  totalSales: salesOrders.reduce((sum, row) => sum + row.totalSales, 0),
  totalQuantity: products.reduce((sum, row) => sum + row.qty, 0),
  totalTons: Math.round(products.reduce((sum, row) => sum + row.tons, 0) * 1000000) / 1000000,
  totalProducts: new Set(products.map(row => normalizeKey(row.product)).filter(Boolean)).size,
  totalCustomers: new Set(salesOrders.map(row => normalizeKey(row.customer)).filter(Boolean)).size,
  totalSalesOrders: salesOrders.length,
});

const buildProductTotals = products => {
  const totals = new Map();
  products.forEach(row => {
    const key = normalizeKey(row.product) || 'unassigned';
    const current = totals.get(key) || {
      product: row.product || 'Unassigned',
      totalQty: 0,
      totalKgs: 0,
      totalTons: 0,
      totalSales: 0,
      rowCount: 0,
    };
    current.totalQty += row.qty;
    current.totalKgs += row.kgs * row.qty;
    current.totalTons += row.tons;
    current.totalSales += row.amount;
    current.rowCount += 1;
    totals.set(key, current);
  });

  return [...totals.values()]
    .map(row => ({
      ...row,
      totalQty: Math.round(row.totalQty * 1000000) / 1000000,
      totalKgs: Math.round(row.totalKgs * 1000000) / 1000000,
      totalTons: Math.round(row.totalTons * 1000000) / 1000000,
      totalSales: Math.round(row.totalSales * 100) / 100,
    }))
    .sort((a, b) => b.totalTons - a.totalTons);
};

const processSalesFiles = files => {
  const output = {
    salesOrders: [],
    products: [],
    productTotals: [],
    combinedRows: [],
    summary: {},
    validation: { errors: [], warnings: [] },
    mappings: {},
  };

  files.forEach(file => {
    const rows = parseFileRows(file);
    const fileName = file.originalname || file.name || 'upload';
    const type = detectFileType(fileName, rows);
    const result = type === 'product' ? parseProducts(rows, fileName) : parseSalesOrders(rows, fileName);

    output.validation.errors.push(...result.errors);
    output.validation.warnings.push(...result.warnings);
    output.mappings[type] = { fileName, ...result.mapping };
    if (type === 'product') output.products.push(...result.records);
    else output.salesOrders.push(...result.records);
  });

  output.salesOrders = output.salesOrders.map((row, index) => ({ ...row, rowSequence: index + 1 }));
  output.products = dedupeBy(output.products, row => `${row.productDescription}|${row.qty}|${row.amount}`);
  output.productTotals = buildProductTotals(output.products);
  output.summary = buildSummary(output.salesOrders, output.products);
  output.combinedRows = output.productTotals.map(product => ({
    product: product.product,
    qty: product.totalQty,
    kgs: product.totalKgs,
    tons: product.totalTons,
    totalSales: product.totalSales,
  }));

  return output;
};

module.exports = {
  computeTons,
  extractKgs,
  extractProductName,
  normalizeCounter,
  normalizeText,
  parseDate,
  parseNumber,
  processSalesFiles,
};
