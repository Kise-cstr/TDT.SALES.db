const multer = require('multer');
const prisma = require('../config/db');
const {
  computeProductTons,
  extractUnitWeightKg,
  normalizeProductGroupKey,
} = require('../services/productCatalog');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 2,
  },
});

const SO_HEADERS = ['Date', 'Class', 'Rep', 'Num', 'Name', 'FOB', 'Salesman GK', 'Weight', 'Terms', 'Counter', 'Source', 'Amount', 'Memo'];
const SP_HEADERS = ['Qty', 'Amount', '% of Sales', 'Avg Price', 'COGS', 'Avg COGS', 'Gross Margin', 'Gross Margin %'];

const normalize = value => String(value ?? '').trim();
const compact = value => normalize(value).toLowerCase().replace(/&/g, 'and').replace(/%/g, 'pct').replace(/[^a-z0-9]+/g, '');
const normalizeGroupLabel = value => normalize(value).replace(/\s+/g, ' ');
const isBlockedProductGroup = value => normalizeProductGroupKey(value) === 'TUBULAR';
const soTemplate = SO_HEADERS.map(compact);
const spTemplate = SP_HEADERS.map(compact);
const repNamesByCode = new Map([
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

const normalizeSalesRep = value => repNamesByCode.get(compact(value)) || normalize(value);

const toNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = normalize(value);
  if (!text || /^-+$/.test(text)) return 0;
  const negativeParentheses = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/^\((.*)\)$/, '$1').replace(/,/g, '').replace(/%/g, '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negativeParentheses ? -parsed : parsed;
};

const parseDate = value => {
  const text = normalize(value);
  if (!text || /^[A-Za-z]+$/.test(text)) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    const date = new Date(Math.floor(serial - 25569) * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseCsvRows = text => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(value => normalize(value))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(value => normalize(value))) rows.push(row);
  return rows;
};

const headersMatchAt = (row, template, startIndex) => template.every((header, offset) => compact(row[startIndex + offset]) === header);

const findSalesOrderHeader = rows => rows.findIndex(row => headersMatchAt(row, soTemplate, 0));

const findSalesProductHeader = rows => {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (let startIndex = 0; startIndex <= row.length - spTemplate.length; startIndex += 1) {
      if (headersMatchAt(row, spTemplate, startIndex)) {
        return { rowIndex, startIndex };
      }
    }
  }
  return { rowIndex: -1, startIndex: -1 };
};

const detectCsvType = rows => {
  const flattenedHeaders = rows.slice(0, 30).flat().map(compact);
  if (flattenedHeaders.includes(compact('Salesman GK'))) return 'SO';
  if (flattenedHeaders.includes(compact('Gross Margin %'))) return 'SP';
  return null;
};

const cleanCategoryName = value => normalize(value).replace(/,+$/, '').replace(/\s+/g, ' ');

const getParenthetical = value => {
  const match = normalize(value).match(/^[A-Z0-9/&.\-\s]+\(([^)]*)\)\s*$/i);
  return match ? cleanCategoryName(match[1]) : '';
};

const isSectionHeader = label => {
  const text = normalize(label);
  const inside = getParenthetical(text);
  if (!text) return true;
  if (/^inventory$/i.test(text)) return true;
  if (/^total\b/i.test(text)) return true;
  if (inside && compact(inside) === compact(text.replace(/\([^)]*\)/g, ''))) return true;
  if (inside && ['bars', 'inventory'].includes(compact(inside))) return true;
  return false;
};

const isCategoryRow = (label, metrics) => {
  const category = getParenthetical(label);
  const hasMetrics = metrics.some(value => toNumber(value) !== 0);
  return Boolean(category && !hasMetrics && !isSectionHeader(label));
};

const isProductRow = (label, metrics) => {
  const text = normalize(label);
  if (!text || isSectionHeader(text)) return false;
  const hasMetrics = metrics.some(value => toNumber(value) !== 0);
  const looksLikeSku = /^[A-Z]{1,8}[A-Z0-9.-]*\d+[A-Z0-9.-]*\s*\(/i.test(text);
  return hasMetrics && (looksLikeSku || extractUnitWeightKg(text) > 0 || /\([^)]*\d[^)]*\)/.test(text));
};

const parseSalesOrders = rows => {
  const headerIndex = findSalesOrderHeader(rows);
  if (headerIndex < 0) {
    throw Object.assign(new Error('Invalid CSV structure: Sales Order file must include the exact SO headers.'), { status: 400 });
  }

  return rows.slice(headerIndex + 1)
    .filter(row => row.some(value => normalize(value)))
    .map(row => ({
      date: parseDate(row[0]),
      class: normalize(row[1]) || null,
      rep: normalizeSalesRep(row[2]) || null,
      num: normalize(row[3]) || null,
      name: normalize(row[4]) || null,
      fob: toNumber(row[5]),
      salesmanGK: toNumber(row[6]),
      weight: toNumber(row[7]),
      terms: normalize(row[8]) || null,
      counter: normalize(row[9]) || null,
      source: normalize(row[10]) || null,
      amount: toNumber(row[11]),
      memo: normalize(row[12]) || null,
    }))
    .filter(record => record.date || record.rep || record.name || record.amount || record.salesmanGK || record.weight);
};

const parseSalesProducts = rows => {
  const header = findSalesProductHeader(rows);
  if (header.rowIndex < 0) {
    throw Object.assign(new Error('Invalid CSV structure: Sales Product file must include Qty, Amount, % of Sales, Avg Price, COGS, Avg COGS, Gross Margin, and Gross Margin %.'), { status: 400 });
  }

  const productColumn = Math.max(0, header.startIndex - 1);
  let activeCategory = '';
  let activeSubCategory = '';
  const records = [];

  rows.slice(header.rowIndex + 1).forEach(row => {
    const label = normalize(row[productColumn] || row.find((cell, index) => index < header.startIndex && normalize(cell)) || '');
    const metrics = row.slice(header.startIndex, header.startIndex + SP_HEADERS.length);
    if (!label || isSectionHeader(label)) return;

    if (isCategoryRow(label, metrics)) {
      activeCategory = getParenthetical(label);
      activeSubCategory = label;
      return;
    }

    if (!isProductRow(label, metrics)) return;

    const qty = toNumber(metrics[0]);
    const weightKgs = extractUnitWeightKg(label);
    const category = normalizeGroupLabel(activeCategory || label) || 'Uncategorized';
    if (isBlockedProductGroup(category) || isBlockedProductGroup(label)) return;
    records.push({
      productName: label,
      category,
      subCategory: activeSubCategory || null,
      qty,
      amount: toNumber(metrics[4]),
      percentSales: toNumber(metrics[2]),
      avgPrice: toNumber(metrics[3]),
      cogs: toNumber(metrics[4]),
      avgCogs: toNumber(metrics[5]),
      grossMargin: toNumber(metrics[6]),
      grossMarginPct: toNumber(metrics[7]),
      weightKgs,
      tons: computeProductTons({ productName: label, qty, weightKgs }),
    });
  });

  return records;
};

const readRequestFiles = req => {
  const files = [];
  if (Array.isArray(req.files)) files.push(...req.files);
  if (req.file) files.push(req.file);
  if (req.body?.csvText) files.push({ originalname: req.body.fileName || 'upload.csv', buffer: Buffer.from(req.body.csvText, 'utf8') });
  return files;
};

const formatMonth = date => date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthSortKey = label => {
  const parsed = new Date(`1 ${label}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const groupBy = (rows, keyGetter, valueGetter) => {
  const map = new Map();
  rows.forEach(row => {
    const label = normalize(keyGetter(row)) || 'Unassigned';
    const key = compact(label) || 'unassigned';
    const current = map.get(key) || { name: label, value: 0, count: 0 };
    current.value += toNumber(valueGetter(row));
    current.count += 1;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
};

const buildAnalyticsPayload = async (query = {}) => {
  const [orders, products] = await Promise.all([
    prisma.salesOrder.findMany({ orderBy: { date: 'asc' } }),
    prisma.salesProduct.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  const filteredOrders = orders.filter(order => {
    if (query.year && order.date?.getUTCFullYear?.() !== Number(query.year)) return false;
    if (query.month && query.month !== 'All Months') {
      const month = order.date?.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
      if (month !== query.month) return false;
    }
    if (query.rep && normalize(order.rep) !== query.rep) return false;
    if (query.branch && query.branch !== 'all' && normalize(order.class) !== query.branch) return false;
    return true;
  });

  const filteredProducts = products.filter(product => !query.category || normalize(product.category) === query.category);
  const hasSO = orders.length > 0;
  const hasSP = products.length > 0;
  const title = hasSO && hasSP
    ? 'Enterprise Sales Intelligence Dashboard'
    : hasSP
      ? 'Sales Product Performance Dashboard'
      : hasSO
        ? 'Sales Order Analytics Dashboard'
        : 'No data uploaded';

  const datedOrders = orders.filter(order => order.date);
  const firstDate = datedOrders[0]?.date || null;
  const lastDate = datedOrders[datedOrders.length - 1]?.date || null;
  const reportingPeriod = firstDate && lastDate
    ? `Reporting Period: ${firstDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} - ${lastDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${lastDate.getUTCFullYear()}`
    : 'Reporting Period: No dated sales order data';

  const totalSales = filteredOrders.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const totalWeight = filteredOrders.reduce((sum, row) => sum + toNumber(row.weight), 0);
  const totalGK = filteredOrders.reduce((sum, row) => sum + toNumber(row.salesmanGK), 0);
  const totalQty = filteredProducts.reduce((sum, row) => sum + toNumber(row.qty), 0);
  const totalTons = filteredProducts.reduce((sum, row) => sum + toNumber(row.tons), 0);
  const totalGrossMargin = filteredProducts.reduce((sum, row) => sum + toNumber(row.grossMargin), 0);
  const avgGrossMarginPct = filteredProducts.length
    ? filteredProducts.reduce((sum, row) => sum + toNumber(row.grossMarginPct), 0) / filteredProducts.length
    : 0;

  const topCompanies = groupBy(filteredOrders, row => row.name, row => row.amount).slice(0, 10);
  const salesRepRankings = groupBy(filteredOrders, row => row.rep, row => row.amount).map(row => ({ ...row, deals: row.count })).slice(0, 10);
  const productCategories = groupBy(filteredProducts, row => row.category, row => row.cogs);
  const totalProductSales = productCategories.reduce((sum, item) => sum + item.value, 0);
  const productTonnage = groupBy(filteredProducts, row => row.category, row => row.tons);
  const topProducts = groupBy(filteredProducts, row => row.productName, row => row.tons).slice(0, 10);

  const monthlyMap = new Map();
  filteredOrders.forEach(order => {
    if (!order.date) return;
    const label = formatMonth(order.date);
    const current = monthlyMap.get(label) || { label, sales: 0, gk: 0 };
    current.sales += toNumber(order.amount);
    current.gk += toNumber(order.salesmanGK);
    monthlyMap.set(label, current);
  });

  return {
    title,
    reportingPeriod,
    sourceTypes: { salesOrder: hasSO, salesProduct: hasSP },
    empty: !hasSO && !hasSP,
    kpis: {
      salesOrder: {
        totalSales,
        totalWeight,
        totalGK,
        totalTransactions: filteredOrders.length,
        activeReps: new Set(filteredOrders.map(row => normalize(row.rep)).filter(Boolean)).size,
        topCustomer: topCompanies[0]?.name || 'N/A',
      },
      salesProduct: {
        totalQty,
        totalTons,
        totalGrossMargin,
        topProduct: topProducts[0]?.name || 'N/A',
        highestSellingCategory: productCategories[0]?.name || 'N/A',
        avgGrossMarginPct,
      },
    },
    charts: {
      salesComparison: [...monthlyMap.values()].sort((a, b) => monthSortKey(a.label) - monthSortKey(b.label)),
      productDonut: productCategories.map(row => ({
        name: row.name,
        value: row.value,
        percentage: totalProductSales ? (row.value / totalProductSales) * 100 : 0,
      })),
      topCompanies,
      salesRepRankings,
      categoryTons: productTonnage,
      topTonnageProducts: topProducts,
    },
    filters: {
      years: [...new Set(orders.map(row => row.date?.getUTCFullYear()).filter(Boolean))].sort(),
      months: [...new Set(orders.map(row => row.date?.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })).filter(Boolean))],
      reps: [...new Set(orders.map(row => normalize(row.rep)).filter(Boolean))].sort(),
      categories: [...new Set(products.map(row => normalize(row.category)).filter(Boolean))].sort(),
      branches: [...new Set(orders.map(row => normalize(row.class)).filter(Boolean))].sort(),
    },
  };
};

const importSalesIntelligenceCsv = async (req, res) => {
  try {
    const files = readRequestFiles(req);
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No CSV file or csvText payload provided.' });
    }

    const imported = [];
    for (const file of files) {
      const rows = parseCsvRows(file.buffer.toString('utf8'));
      const type = detectCsvType(rows);
      if (!type) {
        return res.status(400).json({ success: false, message: `Invalid CSV structure in ${file.originalname || 'upload.csv'}. Expected Salesman GK or Gross Margin % header.` });
      }

      if (type === 'SO') {
        const records = parseSalesOrders(rows);
        if (!records.length) return res.status(400).json({ success: false, message: 'Invalid CSV structure: no usable Sales Order rows found.' });
        await prisma.salesOrder.createMany({ data: records });
        imported.push({ fileName: file.originalname, type: 'SALES_ORDER', rows: records.length });
      } else {
        const records = parseSalesProducts(rows);
        if (!records.length) return res.status(400).json({ success: false, message: 'Invalid CSV structure: no usable Sales Product rows found.' });
        await prisma.salesProduct.createMany({ data: records });
        imported.push({ fileName: file.originalname, type: 'SALES_PRODUCT', rows: records.length });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Enterprise sales intelligence CSV imported.',
      data: { imported, analytics: await buildAnalyticsPayload(req.query) },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'CSV import failed.' });
  }
};

const getSalesIntelligenceAnalytics = async (req, res) => {
  try {
    return res.json({ success: true, message: 'Enterprise sales intelligence analytics loaded.', data: await buildAnalyticsPayload(req.query) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to load analytics.' });
  }
};

module.exports = {
  upload,
  importSalesIntelligenceCsv,
  getSalesIntelligenceAnalytics,
};
