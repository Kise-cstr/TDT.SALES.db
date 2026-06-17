const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const zlib = require('zlib');
const {
  publishUploadNotification,
} = require('../services/notificationService');
const { ensureTimelineSalesSeeded } = require('../services/timelineSalesService');
const {
  computeProductTons,
  extractUnitWeightKg,
  normalizeProductGroupKey,
  productDisplayName,
} = require('../services/productCatalog');

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 1,
  notation: 'compact',
});

const toNumber = value => {
  const cleaned = typeof value === 'number'
    ? value
    : String(value || '')
      .replace(/\((.*)\)/, '-$1')
      .replace(/^\s*-\s*$/, '')
      .replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveGkFromFob = (gkValue, fobValue) => {
  const gk = toNumber(gkValue);
  return gk !== 0 ? gk : toNumber(fobValue);
};

const resolveCounterValue = row => (
  row?.counter
  || row?.salesPerformance
  || row?.performance
  || row?.counterLabel
  || ''
);

const normalizeCounterPerformance = value => {
  const label = String(value || '').trim().toLowerCase();
  const key = label.replace(/\s+/g, '');
  if (key === 'acquisition') return 'Acquisition';
  if (key === 'retention') return 'Retention';
  if (key === 'revival') return 'Revival';
  if (key.includes('revival') || key.includes('rev/rev') || key.includes('rev') || key === 'r') return 'Revival';
  if (key.includes('first') || key === 'ft' || key === 'f/t') return 'Acquisition';
  if (!key || key === 'n' || key === 'n/n' || key === 'new' || key === 'new(n)' || key === 'new(n/n)' || key === '---' || key === 'nocounter' || key === 'blank' || key === '-') return 'Retention';
  return 'Retention';
};

const counterPerformanceRank = value => {
  const label = normalizeCounterPerformance(value);
  if (label === 'Acquisition') return 3;
  if (label === 'Revival') return 2;
  return 1;
};

const pickCounterPerformance = (totals, fallback = 'Retention') => {
  const entries = Array.from((totals || new Map()).entries());
  if (!entries.length) return fallback;
  const explicitEntries = entries.filter(([label]) => normalizeCounterPerformance(label) !== 'Retention');
  const candidateEntries = explicitEntries.length ? explicitEntries : entries;
  const [winner] = candidateEntries.sort((a, b) => {
    const rankDelta = counterPerformanceRank(b[0]) - counterPerformanceRank(a[0]);
    if (rankDelta) return rankDelta;
    const countDelta = b[1] - a[1];
    if (countDelta) return countDelta;
    return String(a[0]).localeCompare(String(b[0]));
  })[0] || [];
  return normalizeCounterPerformance(winner || fallback);
};

const buildCounterDistribution = (records = []) => {
  const companies = new Map();

  (Array.isArray(records) ? records : []).forEach(record => {
    const companyName = String(record.clientName || record.companyName || record.name || '').trim();
    if (!companyName) return;

    const key = companyName.toUpperCase();
    const performance = normalizeCounterPerformance(resolveCounterValue(record));
    const current = companies.get(key) || {
      performanceTotals: new Map(),
      bestPerformance: 'Retention'
    };

    current.performanceTotals.set(performance, (current.performanceTotals.get(performance) || 0) + 1);
    if (counterPerformanceRank(performance) > counterPerformanceRank(current.bestPerformance)) {
      current.bestPerformance = performance;
    }
    companies.set(key, current);
  });

  const totals = new Map([
    ['Acquisition', { label: 'Acquisition', count: 0 }],
    ['Retention', { label: 'Retention', count: 0 }],
    ['Revival', { label: 'Revival', count: 0 }]
  ]);

  companies.forEach(company => {
    const bucket = pickCounterPerformance(company.performanceTotals, company.bestPerformance || 'Retention');
    const current = totals.get(bucket) || { label: bucket, count: 0 };
    current.count += 1;
    totals.set(bucket, current);
  });

  return ['Acquisition', 'Retention', 'Revival'].map(label => totals.get(label) || { label, count: 0 });
};

const normalize = value => String(value || '').trim();
const upper = value => normalize(value).toUpperCase();
const normalizeHeader = value => normalize(value)
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '');
const SALES_ORDER_TEMPLATE = ['date', 'class', 'rep', 'num', 'name', 'fob', 'salesmangk', 'weight', 'terms', 'counter', 'source', 'amount', 'memo'];
const SALES_PRODUCT_TEMPLATE = ['qty', 'amount', 'ofsales', 'avgprice', 'cogs', 'avgcogs', 'grossmargin', 'grossmargin'];
const compactCurrency = value => `PHP ${pesoFormatter.format(toNumber(value))}`;
const normalizeEntityName = value => normalize(value).replace(/\s+/g, ' ');
const entityKey = value => normalizeEntityName(value).toUpperCase();

/** Official rep code → display name (overrides Excel when the code matches). */
const CANONICAL_SALES_REP_NAMES_BY_CODE = new Map(
  [
    ['1Mrky', 'Marky Cabajar'],
    ['1Aga', 'Michael Angelo Blancia'],
    ['1DLM', 'Dan Loren Mendoza'],
    ['1Dan', 'Daniel Justine Habana'],
    ['1Mldy', 'Melody Santos'],
    ['1Ema', 'Emmalyn Moloboco'],
    ['11ber', 'Bernabe Lanzaderas'],
    ['11Bry', 'Bryan Banadera'],
    ['1Den', 'Dennis Espinar'],
    ['1KND', 'Karen Dy'],
  ].map(([code, name]) => [entityKey(code), name])
);
const CANONICAL_SALES_REP_NAMES_BY_ALIAS = new Map(
  [
    ['Marky', 'Marky Cabajar'],
    ['Aga', 'Michael Angelo Blancia'],
    ['Michael', 'Michael Angelo Blancia'],
    ['Dan', 'Daniel Justine Habana'],
    ['DLM', 'Dan Loren Mendoza'],
    ['Melody', 'Melody Santos'],
    ['Emma', 'Emmalyn Moloboco'],
    ['Berns', 'Bernabe Lanzaderas'],
    ['Bryan', 'Bryan Banadera'],
    ['Dennis', 'Dennis Espinar'],
    ['Karen', 'Karen Dy'],
  ].map(([alias, name]) => [entityKey(alias), name])
);

const isBlockedProductGroup = value => normalizeProductGroupKey(value) === 'TUBULAR';

const cleanProductGroupLabel = value => {
  const label = normalizeEntityName(value);
  if (!label || /^total\b/i.test(label) || /^inventory\b/i.test(label) || isBlockedProductGroup(label)) return '';
  return label;
};

const extractProductCode = value => {
  const match = normalize(value).match(/^"?\s*([A-Z0-9-]+)\s*\(/i);
  return match ? match[1] : null;
};

const productTons = record => computeProductTons(record);

const parseDate = value => {
  const text = normalize(value);
  if (!text) return null;
  if (/^[A-Za-z]+$/.test(text)) return null;
  let normalizedDate = text;

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (Number.isFinite(serial)) {
      const date = new Date(Math.floor(serial - 25569) * 86400000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)) {
    const [first, second, third] = text.split(/[/-]/);
    const year = third.length === 2 ? `20${third}` : third;
    normalizedDate = `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
  }

  if (!/^\d{4}-\d{1,2}-\d{1,2}/.test(normalizedDate)) {
    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [year, month, day] = normalizedDate.slice(0, 10).split('-');
  const date = new Date(`${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDateString = value => {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
};

const monthKey = value => {
  const date = parseDate(value);
  if (!date) return 'Undated';
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const weekKey = value => {
  const date = parseDate(value);
  if (!date) return 'Undated';
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - start) / 86400000) + start.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()} W${String(week).padStart(2, '0')}`;
};

const dayName = value => {
  const date = parseDate(value);
  if (!date) return 'Undated';
  return date.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
};
const dayKey = value => {
  const date = parseDate(value);
  if (!date) return 'Undated';
  return date.toISOString().slice(0, 10);
};
const quarterKey = value => {
  const date = parseDate(value);
  if (!date) return 'Undated';
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
};
const yearKey = value => {
  const date = parseDate(value);
  if (!date) return 'Undated';
  return String(date.getUTCFullYear());
};

const decodeXml = value => String(value || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const columnIndexFromCellRef = ref => {
  const letters = String(ref || '').replace(/[^A-Z]/gi, '').toUpperCase();
  return letters.split('').reduce((sum, letter) => (sum * 26) + letter.charCodeAt(0) - 64, 0) - 1;
};

const unzipXlsxEntries = buffer => {
  const entries = new Map();
  let offset = 0;

  while (offset + 30 < buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;

    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = buffer.slice(nameStart, nameStart + fileNameLength).toString('utf8').replace(/\\/g, '/');

    if (flags & 0x08) throw new Error('Unsupported XLSX zip format');

    const data = buffer.slice(dataStart, dataStart + compressedSize);
    const content = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : null;
    if (content && !name.endsWith('/')) entries.set(name, content.toString('utf8'));
    offset = dataStart + compressedSize;
  }

  return entries;
};

const parseAttributes = tag => {
  const attrs = {};
  String(tag || '').replace(/([\w:]+)="([^"]*)"/g, (_, key, value) => {
    attrs[key] = decodeXml(value);
    return _;
  });
  return attrs;
};

const parseSharedStrings = xml => {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map(match => (
    [...match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(textMatch => decodeXml(textMatch[1]))
      .join('')
  ));
};

const parseXlsxCellValue = (cellXml, sharedStrings) => {
  const tag = cellXml.match(/^<c\b[^>]*>/)?.[0] || '';
  const attrs = parseAttributes(tag);

  if (attrs.t === 'inlineStr') {
    return [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(match => decodeXml(match[1]))
      .join('')
      .trim();
  }

  const raw = decodeXml(cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || '').trim();
  if (attrs.t === 's') return normalize(sharedStrings[Number(raw)] ?? raw);
  return raw;
};

const parseXlsxRows = base64 => {
  const buffer = Buffer.from(String(base64 || '').replace(/^data:.*?;base64,/, ''), 'base64');
  const entries = unzipXlsxEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml'));
  const workbookXml = entries.get('xl/workbook.xml') || '';
  const relsXml = entries.get('xl/_rels/workbook.xml.rels') || '';
  const rels = new Map([...relsXml.matchAll(/<Relationship\b[^>]*\/>/g)].map(match => {
    const attrs = parseAttributes(match[0]);
    return [attrs.Id, attrs.Target];
  }));

  const sheets = [...workbookXml.matchAll(/<sheet\b[^>]*\/>/g)]
    .map(match => parseAttributes(match[0]))
    .map(attrs => {
      const target = rels.get(attrs['r:id']) || '';
      const path = target.startsWith('xl/') ? target : `xl/${target.replace(/^\//, '')}`;
      return { name: attrs.name, path: path.replace('xl/../', '') };
    })
    .filter(sheet => entries.has(sheet.path));

  const sheet = sheets.find(item => normalizeHeader(item.name) !== 'quickbooksexporttips') || sheets[0];
  if (!sheet) return [];

  const sheetXml = entries.get(sheet.path) || '';
  return [...sheetXml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)].map(rowMatch => {
    const row = [];
    [...rowMatch[0].matchAll(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)].forEach(cellMatch => {
      const attrs = parseAttributes(cellMatch[0].match(/^<c\b[^>]*>/)?.[0] || cellMatch[0]);
      const index = columnIndexFromCellRef(attrs.r);
      if (index < 0) return;
      while (row.length <= index) row.push('');
      row[index] = parseXlsxCellValue(cellMatch[0], sharedStrings);
    });
    return row;
  }).filter(row => row.some(normalize));
};

const matches = (value, filter) => !filter || upper(value) === upper(filter);

const buildRepCodeToNameLookup = records => {
  const codeToNameCounts = new Map();
  records.forEach(record => {
    const code = normalizeEntityName(record.repCode || '');
    const name = normalizeEntityName(record.repName || '');
    if (!code || !name) return;
    if (entityKey(name) === entityKey(code)) return;
    const ck = entityKey(code);
    if (!codeToNameCounts.has(ck)) codeToNameCounts.set(ck, new Map());
    const counts = codeToNameCounts.get(ck);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const lookup = new Map();
  codeToNameCounts.forEach((nameCounts, ck) => {
    let bestName = '';
    let bestCount = -1;
    nameCounts.forEach((count, name) => {
      if (count > bestCount || (count === bestCount && name.length > bestName.length)) {
        bestCount = count;
        bestName = name;
      }
    });
    if (bestName) lookup.set(ck, bestName);
  });
  CANONICAL_SALES_REP_NAMES_BY_CODE.forEach((name, ck) => {
    lookup.set(ck, name);
  });
  return lookup;
};

const repDisplayName = (record, lookup = new Map()) => {
  const name = normalizeEntityName(record.repName || '');
  const code = normalizeEntityName(record.repCode || '');
  const ck = entityKey(code);
  const nk = entityKey(name);
  if (ck && CANONICAL_SALES_REP_NAMES_BY_CODE.has(ck)) {
    return CANONICAL_SALES_REP_NAMES_BY_CODE.get(ck);
  }
  if (nk && CANONICAL_SALES_REP_NAMES_BY_CODE.has(nk)) {
    return CANONICAL_SALES_REP_NAMES_BY_CODE.get(nk);
  }
  if (nk && CANONICAL_SALES_REP_NAMES_BY_ALIAS.has(nk)) {
    return CANONICAL_SALES_REP_NAMES_BY_ALIAS.get(nk);
  }
  const nameSameAsCode = Boolean(name && code && entityKey(name) === ck);
  const nameLooksDistinct = Boolean(name && !nameSameAsCode);
  if (nameLooksDistinct) return name;
  if (ck && lookup.has(ck)) return lookup.get(ck);
  if (name) return name;
  return code || 'Unassigned';
};

const groupRecords = (records, keyGetter, valueGetter) => {
  const totals = new Map();
  const labels = new Map();
  records.forEach(record => {
    const label = normalizeEntityName(keyGetter(record)) || 'Unassigned';
    const key = entityKey(label) || 'UNASSIGNED';
    if (!labels.has(key)) labels.set(key, label);
    totals.set(key, (totals.get(key) || 0) + toNumber(valueGetter(record)));
  });
  return Array.from(totals.entries())
    .map(([key, value]) => ({ name: labels.get(key) || key, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
};

const groupProductRecords = (records, valueGetter) => {
  const totals = new Map();
  const labels = new Map();
  records.forEach(record => {
    const label = productDisplayName(record);
    const key = normalizeProductGroupKey(label);
    if (!key || key === 'TUBULAR') return;
    if (!labels.has(key)) labels.set(key, label);
    totals.set(key, (totals.get(key) || 0) + toNumber(valueGetter(record)));
  });
  return Array.from(totals.entries())
    .map(([key, value]) => ({ name: labels.get(key) || key, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
};

const validateGroupedProductTotals = (records, groupedProducts) => {
  const rawTotals = new Map();
  records.forEach(record => {
    const label = productDisplayName(record);
    const key = normalizeProductGroupKey(label);
    if (!key || key === 'TUBULAR') return;
    const current = rawTotals.get(key) || { quantity: 0, revenue: 0 };
    current.quantity += toNumber(record.quantity);
    current.revenue += toNumber(record.amount);
    rawTotals.set(key, current);
  });

  groupedProducts.forEach(product => {
    const key = normalizeProductGroupKey(product.label || product.name);
    const raw = rawTotals.get(key);
    if (!raw) {
      console.warn(`[product-validation] Rendered product "${product.label || product.name}" was not found in raw CSV rows.`);
      return;
    }
    if (Math.abs(toNumber(product.quantity ?? product.value) - raw.quantity) > 0.01 && product.quantity !== undefined) {
      console.warn(`[product-validation] Quantity mismatch for "${product.label || product.name}".`, { rendered: product.quantity, raw: raw.quantity });
    }
    if (Math.abs(toNumber(product.revenue) - raw.revenue) > 0.01 && product.revenue !== undefined) {
      console.warn(`[product-validation] Sales mismatch for "${product.label || product.name}".`, { rendered: product.revenue, raw: raw.revenue });
    }
  });
};

const groupTimeRecords = (records, keyGetter, valueGetter) => {
  const totals = new Map();
  records.forEach(record => {
    const name = keyGetter(record);
    const key = name || 'Undated';
    const current = totals.get(key) || { name: key, value: 0 };
    current.value += toNumber(valueGetter(record));
    totals.set(key, current);
  });
  const sortValue = label => {
    const parsedMonth = new Date(`1 ${label}`);
    if (!Number.isNaN(parsedMonth.getTime())) return parsedMonth.getTime();
    const quarter = String(label).match(/^Q([1-4])\s+(\d{4})$/);
    if (quarter) return Date.UTC(Number(quarter[2]), (Number(quarter[1]) - 1) * 3, 1);
    const week = String(label).match(/^(\d{4})\s+W(\d{2})$/);
    if (week) return Date.UTC(Number(week[1]), 0, 1 + (Number(week[2]) - 1) * 7);
    const date = parseDate(label);
    return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
  };
  return Array.from(totals.values()).sort((a, b) => sortValue(a.name) - sortValue(b.name));
};

const normalizeTimelineGranularity = value => {
  const label = upper(value || 'MONTHLY');
  if (label.startsWith('YEAR')) return 'Yearly';
  if (label.startsWith('WEEK')) return 'Weekly';
  return 'Monthly';
};

const timelinePeriod = (date, granularity) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return { key: 'Undated', label: 'Undated' };
  }

  if (granularity === 'Yearly') {
    return {
      key: String(date.getUTCFullYear()),
      label: String(date.getUTCFullYear()),
    };
  }

  if (granularity === 'Weekly') {
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - start) / 86400000) + start.getUTCDay() + 1) / 7);
    return {
      key: `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
      label: `${date.getUTCFullYear()} W${String(week).padStart(2, '0')}`,
    };
  }

  return {
    key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  };
};

const buildTimelineComparisonRows = (records, granularity) => {
  const groups = new Map();

  records.forEach(record => {
    const period = timelinePeriod(record.recordDate, granularity);
    const current = groups.get(period.key) || {
      key: period.key,
      label: period.label,
      sales: 0,
      gk: 0,
      leads: 0,
    };
    current.sales += toNumber(record.amount);
    current.gk += toNumber(record.salesmanGk);
    current.leads += 1;
    groups.set(period.key, current);
  });

  return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
};

const percent = (value, total) => (total ? Math.round((value / total) * 1000) / 10 : 0);

const applyFilters = (salesRecords, productRecords, kpiRecords, query = {}, repLookup = new Map()) => {
  const resolveRep = record => repDisplayName(record, repLookup);
  const now = new Date();
  const rangeStart = (() => {
    if (query.range === 'Current Month') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if (query.range === 'Last 3 Months') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    if (query.range === 'Last 6 Months') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    if (query.range === 'Year to Date') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    if (query.range === 'Custom Date Range' && query.startDate) return parseDate(query.startDate);
    return null;
  })();
  const rangeEnd = query.range === 'Custom Date Range' && query.endDate ? parseDate(query.endDate) : null;
  const repFilterMatches = record => {
    if (!query.salesRep) return true;
    const f = upper(query.salesRep);
    return upper(resolveRep(record)) === f
      || upper(normalize(record.repCode || '')) === f
      || upper(normalize(record.repName || '')) === f;
  };

  const monthMatches = record => {
    if (!query.month) return true;
    const date = parseDate(record.date);
    const month = date
      ? date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
      : record.month;
    return upper(month).startsWith(upper(query.month).slice(0, 3));
  };

  const yearMatches = record => {
    if (!query.year) return true;
    const date = parseDate(record.date);
    const year = date ? date.getUTCFullYear() : record.year;
    return String(year || '') === String(query.year);
  };

  const rangeMatches = record => {
    if (!rangeStart && !rangeEnd) return true;
    const date = parseDate(record.date);
    if (!date) return true;
    if (rangeStart && date < rangeStart) return false;
    if (rangeEnd && date > rangeEnd) return false;
    return true;
  };

  const sales = salesRecords.filter(record => (
    rangeMatches(record) &&
    monthMatches(record) &&
    yearMatches(record) &&
    repFilterMatches(record) &&
    matches(record.terms, query.terms) &&
    matches(record.leadSource, query.leadSource) &&
    matches(record.clientType, query.clientType) &&
    matches(record.branch, query.branch)
  ));

  const products = productRecords.filter(record => (
    rangeMatches(record) &&
    monthMatches(record) &&
    yearMatches(record) &&
    matches(productDisplayName(record), query.product) &&
    matches(record.branch, query.branch)
  ));

  const kpis = kpiRecords.filter(record => (
    rangeMatches(record) &&
    repFilterMatches(record) &&
    matches(record.branch, query.branch) &&
    (!query.month || upper(record.month).startsWith(upper(query.month).slice(0, 3))) &&
    (!query.year || String(record.year || '') === String(query.year))
  ));

  return { sales, products, kpis };
};

const buildAnalytics = (batch, query = {}) => {
  const salesRecords = batch?.salesRecords || [];
  const productRecords = batch?.productRecords || [];
  const kpiRecords = batch?.kpiRecords || [];
  const repLookup = buildRepCodeToNameLookup(salesRecords);
  const resolveRep = record => repDisplayName(record, repLookup);
  const { sales, products, kpis } = applyFilters(salesRecords, productRecords, kpiRecords, query, repLookup);
  const validProducts = products.filter(record => productDisplayName(record));

  const totalGrossSales = sales.reduce((sum, record) => sum + toNumber(record.grossSales), 0);
  const totalGk = sales.reduce((sum, record) => sum + resolveGkFromFob(record.finalGk || record.salesmanGk, record.fob), 0);
  const totalFob = sales.reduce((sum, record) => sum + toNumber(record.fob), 0);
  const closedDeals = sales.length;
  const uniqueClients = new Set(sales.map(record => entityKey(record.clientName)).filter(Boolean)).size;
  const activeReps = new Set(
    sales
      .map(record => normalizeEntityName(resolveRep(record)))
      .filter(n => n && n !== 'Unassigned')
  ).size;
  const monthly = groupTimeRecords(sales, record => monthKey(record.date), record => record.grossSales);
  const monthlyGk = groupTimeRecords(sales, record => monthKey(record.date), record => resolveGkFromFob(record.finalGk || record.salesmanGk, record.fob));
  const repPerformance = groupRecords(sales, record => resolveRep(record), record => record.grossSales);
  const productRevenue = groupProductRecords(validProducts, record => record.amount);
  const productPieces = groupProductRecords(validProducts, record => record.quantity);
  const productTonnage = groupProductRecords(validProducts, productTons);
  const totalProductRevenue = productRevenue.reduce((sum, item) => sum + item.value, 0);

  const sourceLabel = record => record.leadSource || record.clientType || 'Unspecified';
  const clientTypeDistribution = groupRecords(sales, record => record.clientType || 'Unspecified', () => 1)
    .map(item => ({ ...item, percentage: percent(item.value, sales.length) }));
  const leadSourceDistribution = groupRecords(sales, sourceLabel, () => 1)
    .map(item => ({ ...item, percentage: percent(item.value, sales.length) }));
  const counterDistribution = buildCounterDistribution(sales);
  const totalCounterCompanies = counterDistribution.reduce((sum, item) => sum + toNumber(item.count), 0) || 1;
  const counterDistributionWithPercent = counterDistribution
    .map(item => ({ ...item, percentage: percent(item.count, totalCounterCompanies) }));
  const termsDistribution = groupRecords(sales, record => record.terms, () => 1)
    .map(item => ({ ...item, percentage: percent(item.value, sales.length) }));
  const ordersPerClientType = leadSourceDistribution;
  const closedDealsPerClientType = groupRecords(
    sales.filter(record => upper(record.closedDeal) === 'YES' || toNumber(record.grossSales) > 0),
    sourceLabel,
    () => 1
  );
  const conversionPerClientType = ordersPerClientType.map(source => {
    const closed = closedDealsPerClientType.find(item => item.name === source.name)?.value || 0;
    return { name: source.name, value: percent(closed, source.value), closed, leads: source.value, orders: source.value };
  });

  const kpiTarget = kpis.reduce((sum, record) => sum + toNumber(record.targetValue), 0);
  const kpiActual = totalGrossSales;
  const kpiCompletion = percent(kpiActual, kpiTarget);
  const period = upper(query.period || (query.month ? 'DAILY' : 'MONTHLY'));
  const performanceKey = period.startsWith('YEAR')
    ? yearKey
    : period.startsWith('QUART')
      ? quarterKey
      : period.startsWith('WEEK')
        ? weekKey
        : period.startsWith('DAY')
          ? dayKey
          : monthKey;
  const salesPerformanceTrend = groupTimeRecords(sales, record => performanceKey(record.date), record => record.grossSales);
  const gkPerformanceTrend = groupTimeRecords(sales, record => performanceKey(record.date), record => resolveGkFromFob(record.finalGk || record.salesmanGk, record.fob));
  const salesPerformanceSeries = salesPerformanceTrend.map(item => ({
    label: item.name,
    sales: item.value,
    gk: gkPerformanceTrend.find(g => g.name === item.name)?.value || 0,
  }));
  const productFilterOptions = groupProductRecords(productRecords, () => 1).map(item => item.name);
  const productBreakdownTable = productRevenue.slice(0, 25).map(item => {
    const itemKey = normalizeProductGroupKey(item.name);
    const productRows = validProducts.filter(record => normalizeProductGroupKey(productDisplayName(record)) === itemKey);
    return {
      product: item.name,
      quantity: productRows.reduce((sum, record) => sum + toNumber(record.quantity), 0),
      tons: productRows.reduce((sum, record) => sum + productTons(record), 0),
      revenue: item.value,
      gk: productRows.reduce((sum, record) => sum + toNumber(record.balance), 0),
    };
  });
  validateGroupedProductTotals(validProducts, productBreakdownTable.map(item => ({
    label: item.product,
    quantity: item.quantity,
    revenue: item.revenue,
  })));

  return {
    batch: batch ? {
      id: batch.id,
      fileName: batch.fileName,
      uploadedBy: batch.uploadedBy,
      uploaderUserId: batch.uploaderUserId,
      uploaderEmail: batch.uploaderEmail,
      uploaderName: batch.uploaderName,
      datasetType: batch.datasetType,
      signature: batch.signature,
      createdAt: batch.createdAt,
    } : null,
    filters: {
      salesReps: groupRecords(salesRecords, record => resolveRep(record), () => 1).map(item => item.name),
      terms: groupRecords(salesRecords, record => record.terms, () => 1).map(item => item.name),
      leadSources: groupRecords(salesRecords, sourceLabel, () => 1).map(item => item.name),
      products: productFilterOptions,
      clientTypes: groupRecords(salesRecords, record => record.clientType, () => 1).map(item => item.name),
      branches: groupRecords([...salesRecords, ...productRecords], record => record.branch, () => 1).map(item => item.name),
    },
    kpis: [
      { metric: 'totalGrossSales', title: 'Total Gross Sales', value: compactCurrency(totalGrossSales), rawValue: totalGrossSales, trend: 'up', trendValue: `${monthly.length} months`, icon: 'dollar' },
      { metric: 'totalGk', title: 'Total GK', value: compactCurrency(totalGk), rawValue: totalGk, trend: 'up', trendValue: `${percent(totalGk, totalGrossSales)}% GK`, icon: 'chart' },
      { metric: 'totalOrders', title: 'Total Sales Orders', value: String(sales.length), rawValue: sales.length, trend: 'up', trendValue: `${uniqueClients} clients`, icon: 'users' },
      { metric: 'totalFob', title: 'Total FOB', value: compactCurrency(totalFob), rawValue: totalFob, trend: 'up', trendValue: `${counterDistributionWithPercent.length} counters`, icon: 'chart' },
      { metric: 'closedDeals', title: 'Counted Sales', value: String(closedDeals), rawValue: closedDeals, trend: 'up', trendValue: `${percent(closedDeals, sales.length)}% with sales`, icon: 'target' },
      { metric: 'activeReps', title: 'Active Sales Reps', value: String(activeReps), rawValue: activeReps, trend: 'up', trendValue: `${repPerformance.length} ranked`, icon: 'users' },
    ],
    charts: {
      monthlySalesTrend: monthly.map(item => ({ month: item.name, sales: item.value })),
      monthlyGkTrend: monthlyGk.map(item => ({ month: item.name, gk: item.value })),
      dailySalesTrend: groupTimeRecords(sales, record => record.date, record => record.grossSales),
      dailyGkTrend: groupTimeRecords(sales, record => record.date, record => resolveGkFromFob(record.finalGk || record.salesmanGk, record.fob)),
      weeklySalesTrend: groupTimeRecords(sales, record => weekKey(record.date), record => record.grossSales),
      weeklyGkTrend: groupTimeRecords(sales, record => weekKey(record.date), record => resolveGkFromFob(record.finalGk || record.salesmanGk, record.fob)),
      salesPerformanceSeries,
      salesByRep: repPerformance,
      top10SalesReps: repPerformance.slice(0, 10),
      salesPerBranch: groupRecords(sales, record => record.branch, record => record.grossSales),
      salesPerClientType: groupRecords(sales, record => record.clientType, record => record.grossSales),
      gkPerClientType: groupRecords(sales, record => record.clientType, record => resolveGkFromFob(record.finalGk || record.salesmanGk, record.fob)),
      fobPerBranch: groupRecords(sales, record => record.branch, record => record.fob),
      counterDistribution: counterDistributionWithPercent,
      salesHeatmapByDay: groupRecords(sales, record => dayName(record.date), record => record.grossSales),
      leadSourceDistribution,
      leadsPerSource: ordersPerClientType,
      leadConversionPerSource: conversionPerClientType,
      clientTypeDistribution,
      ordersPerClientType,
      conversionPerClientType,
      monthlyLeadTrend: groupTimeRecords(sales, record => monthKey(record.date), () => 1),
      monthlyOrderTrend: groupTimeRecords(sales, record => monthKey(record.date), () => 1),
      topLeadSource: ordersPerClientType[0] || null,
      closedDealsPerSource: closedDealsPerClientType,
      termsDistribution,
      salesPerTerms: groupRecords(sales, record => record.terms, record => record.grossSales),
      mostUsedTerms: groupRecords(sales, record => record.terms, () => 1),
      gkPerTerms: groupRecords(sales, record => record.terms, record => resolveGkFromFob(record.finalGk || record.salesmanGk, record.fob)),
      topSellingProducts: productTonnage,
      productRevenueBreakdown: productRevenue,
      productQuantitySold: productPieces,
      productTonsSold: productTonnage,
      productGkAnalysis: groupProductRecords(validProducts, record => record.balance),
      productContribution: productRevenue.map(item => ({ ...item, percentage: percent(item.value, totalProductRevenue) })),
      mostProfitableProducts: groupProductRecords(validProducts, record => record.balance || record.amount),
      productSalesTrend: groupTimeRecords(validProducts, record => monthKey(record.date), record => record.amount),
      kpiTargetVsActual: [{ name: 'Sales KPI', target: kpiTarget, actual: kpiActual }],
      kpiCompletion: [{ name: 'Completion', value: kpiCompletion }],
      teamRanking: groupRecords(sales, record => record.branch, record => record.grossSales),
      repRanking: repPerformance,
      monthlyKpiProgress: monthly.map(item => ({ month: item.name, actual: item.value, target: kpiTarget / (monthly.length || 1) })),
      remainingTargetNeeded: [{ name: 'Remaining', value: Math.max(0, kpiTarget - kpiActual) }],
    },
    tables: {
      recentSales: [...sales].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 25),
      productBreakdown: productBreakdownTable,
      repPerformance: repPerformance.map(item => {
        const repRows = sales.filter(record => entityKey(resolveRep(record)) === entityKey(item.name));
        const closed = repRows.length;
        const gk = repRows.reduce((sum, record) => sum + resolveGkFromFob(record.salesmanGk || record.finalGk, record.fob), 0);
        return {
          salesRep: item.name,
          orders: repRows.length,
          leads: repRows.length,
          closedDeals: closed,
          deals: closed,
          grossSales: item.value,
          conversionRate: percent(closed, repRows.length),
          gkPercent: percent(gk, item.value),
        };
      }),
    },
  };
};

const getUserDisplayName = user => (
  [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
  user?.email ||
  'Unknown user'
);

const getUploadOwnerData = (req, fallbackUploadedBy) => ({
  uploadedBy: req.user ? getUserDisplayName(req.user) : (fallbackUploadedBy || 'frontend-upload'),
  uploaderUserId: req.user?.id || null,
  uploaderEmail: req.user?.email || null,
  uploaderName: req.user ? getUserDisplayName(req.user) : (fallbackUploadedBy || 'frontend-upload'),
});

const canAccessBatch = (req, batch) => (
  req.user?.role === 'admin' ||
  (batch?.uploaderUserId && batch.uploaderUserId === req.user?.id)
);

const summarizeBatch = batch => ({
  id: batch.id,
  name: batch.fileName || 'Dashboard upload',
  fileName: batch.fileName || 'Dashboard upload',
  uploadedBy: batch.uploaderName || batch.uploadedBy || batch.uploaderEmail || 'Unknown user',
  uploaderUserId: batch.uploaderUserId,
  uploaderEmail: batch.uploaderEmail,
  uploaderName: batch.uploaderName,
  datasetType: batch.datasetType || 'Dataset',
  signature: batch.signature,
  status: 'Ready',
  uploadedAt: batch.createdAt,
  createdAt: batch.createdAt,
  salesRows: batch.salesRecords?.length || 0,
  productRows: batch.productRecords?.length || 0,
  kpiRows: batch.kpiRecords?.length || 0,
});

const includeBatchRecords = {
  salesRecords: true,
  productRecords: true,
  kpiRecords: true,
};

const uploadRetentionDays = 15;
const uploadRetentionMs = uploadRetentionDays * 24 * 60 * 60 * 1000;

const cleanupExpiredDashboardUploads = async () => {
  const expiresBefore = new Date(Date.now() - uploadRetentionMs);
  await prisma.dashboardImportBatch.deleteMany({
    where: {
      createdAt: {
        lt: expiresBefore,
      },
    },
  });
};

let ownershipColumnsReady = false;

const ensureUploadOwnershipColumns = async () => {
  if (ownershipColumnsReady) return;
  const columns = [
    ['uploaderUserId', 'INTEGER'],
    ['uploaderEmail', 'TEXT'],
    ['uploaderName', 'TEXT'],
    ['datasetType', 'TEXT'],
    ['signature', 'TEXT'],
  ];
  for (const [name, type] of columns) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "DashboardImportBatch" ADD COLUMN "${name}" ${type}`);
    } catch (error) {
      if (!/duplicate column name|already exists/i.test(String(error.message || ''))) throw error;
    }
  }
  ownershipColumnsReady = true;
};

const updateBatchOwnership = async (batchId, owner, { datasetType, signature }) => {
  await ensureUploadOwnershipColumns();
  await prisma.$executeRaw`
    UPDATE "DashboardImportBatch"
    SET "uploadedBy" = ${owner.uploadedBy},
        "uploaderUserId" = ${owner.uploaderUserId},
        "uploaderEmail" = ${owner.uploaderEmail},
        "uploaderName" = ${owner.uploaderName},
        "datasetType" = ${datasetType || 'Dataset'},
        "signature" = ${signature || null}
    WHERE "id" = ${batchId}
  `;
};

const attachBatchOwnership = async batch => {
  if (!batch) return batch;
  await ensureUploadOwnershipColumns();
  const rows = await prisma.$queryRaw`
    SELECT "uploaderUserId", "uploaderEmail", "uploaderName", "datasetType", "signature"
    FROM "DashboardImportBatch"
    WHERE "id" = ${batch.id}
    LIMIT 1
  `;
  return { ...batch, ...(rows[0] || {}) };
};

const getAccessibleUploadIds = async req => {
  await ensureUploadOwnershipColumns();
  if (req.user?.role === 'admin') {
    return prisma.$queryRaw`
      SELECT "id"
      FROM "DashboardImportBatch"
      ORDER BY "createdAt" DESC
    `;
  }
  return prisma.$queryRaw`
    SELECT "id"
    FROM "DashboardImportBatch"
    WHERE "uploaderUserId" = ${req.user?.id || -1}
    ORDER BY "createdAt" DESC
  `;
};

const deleteDuplicateOwnerUploads = async ({ uploaderUserId, signature }) => {
  if (!uploaderUserId || !signature) return;
  await ensureUploadOwnershipColumns();
  const duplicateRows = await prisma.$queryRaw`
    SELECT "id"
    FROM "DashboardImportBatch"
    WHERE "uploaderUserId" = ${uploaderUserId}
      AND "signature" = ${signature}
  `;
  const duplicateIds = duplicateRows.map(row => row.id);
  if (duplicateIds.length) {
    await prisma.dashboardImportBatch.deleteMany({
      where: { id: { in: duplicateIds } },
    });
  }
};

const importDashboardData = async (req, res) => {
  try {
    const {
      fileName,
      uploadedBy,
      datasetType = 'Dataset',
      signature,
      salesRecords = [],
      productRecords = [],
      kpiRecords = [],
    } = req.body;
    const owner = getUploadOwnerData(req, uploadedBy);
    await deleteDuplicateOwnerUploads({ uploaderUserId: owner.uploaderUserId, signature });

    const batch = await prisma.dashboardImportBatch.create({
      data: {
        fileName,
        uploadedBy: owner.uploadedBy,
        salesRecords: {
          create: salesRecords.map(record => ({
            date: record.date || null,
            branch: record.branch || null,
            repCode: record.repCode || null,
            repName: record.repName || null,
            clientName: normalizeEntityName(record.clientName) || null,
            type: record.type || null,
            terms: record.terms || null,
            clientType: record.clientType || null,
            grossSales: toNumber(record.grossSales),
            finalGk: toNumber(record.finalGk),
            salesmanGk: toNumber(record.salesmanGk),
            salesmanGkPercent: toNumber(record.salesmanGkPercent),
            fob: toNumber(record.fob),
            weight: toNumber(record.weight),
            counter: record.counter || null,
            closedDeal: record.closedDeal || null,
            leadSource: record.leadSource || null,
            remarks: record.remarks || null,
          })),
        },
        productRecords: {
          create: productRecords.map(record => ({
            date: record.date || null,
            invoiceNumber: record.invoiceNumber || null,
            productCode: record.productCode || null,
            productName: normalizeEntityName(record.productName) || record.category || null,
            category: cleanProductGroupLabel(record.category) || null,
            subCategory: record.subCategory || null,
            quantity: toNumber(record.quantity),
            unit: record.unit || null,
            salesPrice: toNumber(record.salesPrice),
            amount: toNumber(record.amount),
            balance: toNumber(record.balance),
            branch: record.branch || null,
          })),
        },
        kpiRecords: {
          create: kpiRecords.map(record => ({
            branch: record.branch || null,
            repCode: record.repCode || null,
            repName: record.repName || null,
            kpiType: record.kpiType || null,
            targetValue: toNumber(record.targetValue),
            month: record.month || null,
            year: record.year ? Number(record.year) : null,
          })),
        },
      },
      include: {
        salesRecords: true,
        productRecords: true,
        kpiRecords: true,
      },
    });
    await updateBatchOwnership(batch.id, owner, { datasetType, signature });
    await publishUploadNotification({
      uploadedByUser: req.user,
      fileName: batch.fileName || 'Dashboard upload',
      fileNames: [batch.fileName || 'Dashboard upload'],
      uploadedAt: batch.createdAt,
      uploaderName: owner.uploaderName || owner.uploadedBy || req.user?.name || '',
    });

    res.status(201).json({
      success: true,
      message: 'Dashboard upload imported',
      data: await attachBatchOwnership(batch),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getLatestDashboardImport = async (req, res) => {
  try {
    const accessibleRows = await getAccessibleUploadIds(req);
    const latestId = accessibleRows[0]?.id || 0;
    const batch = await prisma.dashboardImportBatch.findFirst({
      where: { id: latestId },
      orderBy: { createdAt: 'desc' },
      include: includeBatchRecords,
    });

    res.json({
      success: true,
      data: await attachBatchOwnership(batch),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getDashboardAnalytics = async (req, res) => {
  try {
    const batchId = Number(req.query.batchId || req.query.uploadId || 0);
    const batch = batchId
      ? await prisma.dashboardImportBatch.findUnique({
        where: { id: batchId },
        include: includeBatchRecords,
      })
      : await (async () => {
        const accessibleRows = await getAccessibleUploadIds(req);
        const latestId = accessibleRows[0]?.id || 0;
        return prisma.dashboardImportBatch.findUnique({
          where: { id: latestId },
          include: includeBatchRecords,
        });
      })();
    const ownedBatch = await attachBatchOwnership(batch);

    if (batchId && (!ownedBatch || !canAccessBatch(req, ownedBatch))) {
      return res.status(403).json({
        success: false,
        message: 'Upload access denied',
      });
    }

    res.json({
      success: true,
      data: buildAnalytics(ownedBatch, req.query),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTimelineSalesComparison = async (req, res) => {
  try {
    await ensureTimelineSalesSeeded();
    const granularity = normalizeTimelineGranularity(req.query.granularity || req.query.timeline);
    const records = await prisma.$queryRaw`
      SELECT "recordDate", "salesmanGk", "amount"
      FROM "TimelineSalesRecord"
      ORDER BY "recordDate" ASC
    `;
    const rows = buildTimelineComparisonRows(records.map(record => ({
      ...record,
      recordDate: new Date(record.recordDate),
    })), granularity);

    res.json({
      success: true,
      message: 'Timeline sales comparison loaded',
      data: {
        granularity,
        totalRows: records.length,
        rows,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getGoogleAccessToken = async () => {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Missing GOOGLE_SHEETS_CLIENT_EMAIL or GOOGLE_SHEETS_PRIVATE_KEY');

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    { algorithm: 'RS256' }
  );

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenResponse.ok) throw new Error(`Google token error ${tokenResponse.status}`);
  const tokenJson = await tokenResponse.json();
  return tokenJson.access_token;
};

const mapSheetRowsToSalesRecords = rows => {
  if (!rows?.length) return [];
  const headerSignals = new Set(['date', 'branch', 'branchclass', 'salesrepcode', 'salesrepname', 'clientname', 'amount', 'counter', 'performance', 'salesperformance']);
  const headerRowIndex = rows.findIndex(row => row
    .map(normalizeHeader)
    .filter(header => headerSignals.has(header)).length >= 2);
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const find = (...keys) => {
    const normalizedKeys = keys.map(normalizeHeader);
    return normalizedKeys.map(key => headers.indexOf(key)).find(i => i >= 0) ?? -1;
  };

  const idx = {
    date: find('date'),
    branch: find('branch/class', 'branch/cl', 'branch', 'class'),
    repCode: find('sales rep code', 'rep code', 'rep'),
    repName: find('sales rep name', 'sales rep', 'rep name', 'rep names', 'rep_names', 'sr', 'rep'),
    clientName: find('client name', 'name'),
    type: find('type', 'transaction type', 'num', 'number'),
    terms: find('terms'),
    clientType: find('client type'),
    leadSource: find('source', 'lead source'),
    grossSales: find('amount', 'gross sales'),
    finalGk: find('final gk', 'gk', 'gross profit', 'profit'),
    salesmanGk: find('salesman gk', 'gross kita'),
    salesmanGkPercent: find('salesman gk %', 'salesman gk percent', 'salesman percent', 'salesman percentage', 'salesman', 'gk %'),
    fob: find('fob', 'free on board'),
    weight: find('weight', 'tons', 'tonnage', 'ton'),
    counter: find('counter', 'sales performance', 'salesperformance', 'performance', 'counter label'),
    remarks: find('memo', 'remarks', 'notes'),
  };
  idx.salesmanGkPercent = rows[headerRowIndex].findIndex((header, index) => {
    const raw = normalize(header).toLowerCase();
    const normalized = normalizeHeader(header);
    return index > idx.salesmanGk && (
      raw.includes('%') ||
      normalized === 'salesman' ||
      normalized.includes('percent') ||
      normalized.includes('percentage')
    ) && (normalized.includes('salesmangk') || normalized.includes('gk') || normalized === 'salesman');
  });

  const val = (row, i) => (i >= 0 ? String(row[i] ?? '').trim() : '');
  return rows.slice(headerRowIndex + 1)
    .filter(r => r.some(c => String(c || '').trim()))
    .filter(row => {
      const date = normalizeDateString(val(row, idx.date));
      const hasIdentity = Boolean(val(row, idx.repCode) || val(row, idx.repName) || val(row, idx.clientName));
      const hasAmount = [idx.grossSales, idx.finalGk, idx.salesmanGk, idx.fob, idx.weight].some(i => toNumber(val(row, i)) !== 0);
      return date && hasIdentity && hasAmount;
    })
    .map(row => {
      const grossSales = toNumber(val(row, idx.grossSales));
      const salesmanGk = resolveGkFromFob(val(row, idx.salesmanGk), val(row, idx.fob));
      const finalGk = toNumber(val(row, idx.finalGk)) || salesmanGk;
      return {
      date: normalizeDateString(val(row, idx.date)),
      branch: val(row, idx.branch) || null,
      repCode: val(row, idx.repCode) || null,
      repName: val(row, idx.repName) || null,
      clientName: val(row, idx.clientName) || null,
      type: val(row, idx.type) || null,
      terms: val(row, idx.terms) || null,
      clientType: val(row, idx.clientType) || null,
      grossSales,
      finalGk,
      salesmanGk,
      salesmanGkPercent: toNumber(val(row, idx.salesmanGkPercent)),
      fob: toNumber(val(row, idx.fob)),
      weight: toNumber(val(row, idx.weight)),
      counter: val(row, idx.counter) || null,
      closedDeal: grossSales > 0 ? 'Yes' : 'No',
      leadSource: val(row, idx.leadSource) || null,
      remarks: val(row, idx.remarks) || null,
      };
    });
};

const mapSheetRowsToProductRecords = rows => {
  if (!rows?.length) return [];
  const officialHeaderIndex = rows.findIndex(row => (
    row.map(normalizeHeader).includes('qty') &&
    row.map(normalizeHeader).includes('amount') &&
    row.map(normalizeHeader).includes('grossmargin')
  ));

  if (officialHeaderIndex >= 0) {
    const header = rows[officialHeaderIndex].map(normalizeHeader);
    const find = key => header.indexOf(normalizeHeader(key));
    const idx = {
      quantity: find('Qty'),
      amount: find('Amount'),
      salesPrice: find('Avg Price'),
      cogs: find('COGS'),
      grossMargin: find('Gross Margin'),
    };
    let category = '';
    let subCategory = '';
    return rows.slice(officialHeaderIndex + 1)
      .map(row => {
        const firstText = row.map(normalize).find(Boolean) || '';
        const productCellIndex = row.findIndex(cell => /\([^)]+\)/.test(normalize(cell)) && /\d/.test(normalize(cell)));
        if (productCellIndex < 0) {
          const groupLabel = cleanProductGroupLabel(firstText);
          if (groupLabel) {
            if (/^[A-Z0-9&/\s-]+\s*\([^)]+\)$/i.test(firstText)) {
              subCategory = firstText;
            } else {
              category = groupLabel;
              subCategory = '';
            }
          }
          return null;
        }

        const productName = normalize(row[productCellIndex]);
        if (/^total\b/i.test(productName)) return null;
        if (isBlockedProductGroup(category) || isBlockedProductGroup(productName)) return null;
        const unitWeightKg = extractUnitWeightKg(productName);
        const quantity = toNumber(row[idx.quantity]);
        const cogs = toNumber(row[idx.cogs]);
        return {
          productCode: extractProductCode(productName),
          productName,
          category: category || cleanProductGroupLabel(productName),
          subCategory: subCategory || null,
          quantity,
          unit: unitWeightKg ? 'pcs' : 'qty',
          salesPrice: toNumber(row[idx.salesPrice]),
          amount: cogs,
          balance: toNumber(row[idx.grossMargin]),
          branch: 'Manila',
        };
      })
      .filter(record => record?.productName && (record.quantity || record.amount || record.balance));
  }

  const headerSignals = new Set([
    'date',
    'num',
    'memo',
    'invoiceno',
    'invoicenumber',
    'productcode',
    'productname',
    'productdescription',
    'itemdescription',
    'description',
    'particulars',
    'size',
    'quantity',
    'qty',
    'amount',
  ]);
  const headerRowIndex = rows.findIndex(row => row
    .map(normalizeHeader)
    .filter(header => headerSignals.has(header)).length >= 2);
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const find = (...keys) => {
    const normalizedKeys = keys.map(normalizeHeader);
    return normalizedKeys.map(key => headers.indexOf(key)).find(i => i >= 0) ?? -1;
  };

  const idx = {
    date: find('date', 'sales date', 'transaction date', 'invoice date'),
    invoiceNumber: find('num', 'invoice no', 'invoice number', 'invoice', 'si no', 'dr no'),
    productCode: find('product code', 'item code', 'sku', 'code'),
    productName: find('product name', 'product description', 'product', 'memo', 'item description', 'item', 'item name', 'description', 'particulars', 'material', 'size'),
    category: find('category', 'product category'),
    subCategory: find('sub category', 'subcategory', 'sub-category'),
    quantity: find('quantity', 'qty', 'pcs', 'total qty'),
    unit: find('unit', 'uom', 'u/m'),
    salesPrice: find('sales price', 'selling price', 'unit price', 'price', 'rate'),
    amount: find('amount', 'total amount', 'net amount', 'gross amount', 'gross sales', 'sales', 'revenue'),
    cogs: find('cogs', 'cost of goods sold', 'cost'),
    balance: find('balance', 'gk', 'gross kita', 'gross profit', 'profit'),
    branch: find('branch/class', 'branch/cl', 'branch', 'class'),
  };

  const val = (row, i) => (i >= 0 ? String(row[i] ?? '').trim() : '');
  return rows.slice(headerRowIndex + 1)
    .filter(r => r.some(c => String(c || '').trim()))
    .filter(row => {
      const productName = cleanProductGroupLabel(val(row, idx.productName));
      const quantity = toNumber(val(row, idx.quantity));
      const amount = toNumber(val(row, idx.amount));
      const price = toNumber(val(row, idx.salesPrice));
      return productName && (quantity || amount || price);
    })
    .map(row => ({
      date: normalizeDateString(val(row, idx.date)),
      invoiceNumber: val(row, idx.invoiceNumber) || null,
      productCode: val(row, idx.productCode) || null,
      productName: val(row, idx.productName) || null,
      category: cleanProductGroupLabel(val(row, idx.category)) || null,
      subCategory: val(row, idx.subCategory) || null,
      quantity: toNumber(val(row, idx.quantity)),
      unit: val(row, idx.unit) || null,
      salesPrice: toNumber(val(row, idx.salesPrice)),
      amount: idx.cogs >= 0 ? toNumber(val(row, idx.cogs)) : toNumber(val(row, idx.amount)),
      balance: toNumber(val(row, idx.balance)),
      branch: val(row, idx.branch) || null,
    }))
    .filter(record => !isBlockedProductGroup(record.category) && !isBlockedProductGroup(record.productName));
};

const parseDelimitedRows = text => {
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

const compactHeaderRow = row => row.map(normalizeHeader).filter(Boolean);

const rowIncludesRequiredHeaders = (headers, template) => {
  const availableCounts = headers.reduce((counts, header) => {
    counts.set(header, (counts.get(header) || 0) + 1);
    return counts;
  }, new Map());

  return template.every(header => {
    const count = availableCounts.get(header) || 0;
    if (!count) return false;
    availableCounts.set(header, count - 1);
    return true;
  });
};

const findTemplateHeaderIndex = (rows, template) => rows.findIndex(row => rowIncludesRequiredHeaders(compactHeaderRow(row), template));

const validateTemplateRows = (rows, template, label) => {
  if (!rows?.length) {
    return { valid: false, message: `${label} file is empty.` };
  }
  const headerRowIndex = findTemplateHeaderIndex(rows, template);
  if (headerRowIndex < 0) {
    return {
      valid: false,
      message: `${label} CSV is missing one or more required columns.`,
    };
  }
  return { valid: true, headerRowIndex };
};

const createDashboardImportBatch = async ({
  fileName,
  uploadedBy,
  uploaderUserId,
  uploaderEmail,
  uploaderName,
  datasetType = 'Dataset',
  signature,
  salesRecords = [],
  productRecords = [],
  kpiRecords = [],
}) => {
  await deleteDuplicateOwnerUploads({ uploaderUserId, signature });

  const batch = await prisma.dashboardImportBatch.create({
    data: {
      fileName,
      uploadedBy,
      salesRecords: {
        create: salesRecords.map(record => ({
          date: record.date || null,
          branch: record.branch || null,
          repCode: record.repCode || null,
          repName: record.repName || null,
          clientName: normalizeEntityName(record.clientName) || null,
          type: record.type || null,
          terms: record.terms || null,
          clientType: record.clientType || null,
          grossSales: toNumber(record.grossSales),
          finalGk: toNumber(record.finalGk),
          salesmanGk: toNumber(record.salesmanGk),
          salesmanGkPercent: toNumber(record.salesmanGkPercent),
          fob: toNumber(record.fob),
          weight: toNumber(record.weight),
          counter: record.counter || null,
          closedDeal: record.closedDeal || null,
          leadSource: record.leadSource || null,
          remarks: record.remarks || null,
        })),
      },
      productRecords: {
        create: productRecords.map(record => ({
          date: record.date || null,
          invoiceNumber: record.invoiceNumber || null,
          productCode: record.productCode || null,
          productName: normalizeEntityName(record.productName) || record.category || null,
          category: cleanProductGroupLabel(record.category) || null,
          subCategory: record.subCategory || null,
          quantity: toNumber(record.quantity),
          unit: record.unit || null,
          salesPrice: toNumber(record.salesPrice),
          amount: toNumber(record.amount),
          balance: toNumber(record.balance),
          branch: record.branch || null,
        })),
      },
      kpiRecords: {
        create: kpiRecords.map(record => ({
          branch: record.branch || null,
          repCode: record.repCode || null,
          repName: record.repName || null,
          kpiType: record.kpiType || null,
          targetValue: toNumber(record.targetValue),
          month: record.month || null,
          year: record.year ? Number(record.year) : null,
        })),
      },
    },
    include: {
      salesRecords: true,
      productRecords: true,
      kpiRecords: true,
    },
  });
  await updateBatchOwnership(batch.id, {
    uploadedBy,
    uploaderUserId,
    uploaderEmail,
    uploaderName,
  }, { datasetType, signature });
  return attachBatchOwnership(batch);
};

const importDashboardCsv = async (req, res) => {
  try {
    const {
      fileName = 'dashboard-upload.csv',
      productFileName = '',
      uploadedBy = 'frontend-upload',
      datasetType = 'CSV',
      signature,
      csvText,
      salesCsvText,
      productCsvText,
    } = req.body;
    const owner = getUploadOwnerData(req, uploadedBy);
    const salesText = csvText || salesCsvText;
    if (!normalize(salesText) && !normalize(productCsvText)) {
      return res.status(400).json({ success: false, message: 'At least one CSV content field is required' });
    }

    const salesRows = parseDelimitedRows(salesText);
    const productRows = parseDelimitedRows(productCsvText);
    if (normalize(salesText)) {
      const salesTemplate = validateTemplateRows(salesRows, SALES_ORDER_TEMPLATE, 'Sales Order (SO)');
      if (!salesTemplate.valid) return res.status(400).json({ success: false, message: salesTemplate.message });
    }
    if (normalize(productCsvText)) {
      const productTemplate = validateTemplateRows(productRows, SALES_PRODUCT_TEMPLATE, 'Sales Product (SP)');
      if (!productTemplate.valid) return res.status(400).json({ success: false, message: productTemplate.message });
    }

    const salesRecords = mapSheetRowsToSalesRecords(salesRows);
    const productRecords = mapSheetRowsToProductRecords(productRows);
    if (!salesRecords.length && !productRecords.length) {
      return res.status(400).json({
        success: false,
        message: 'No usable rows found. Check that your sales CSV has Date, Sales Rep, Client, and Amount/Gross Sales columns, or your product CSV has Product, Quantity, and Amount columns.',
      });
    }

    const batch = await createDashboardImportBatch({
      fileName: productFileName ? `${fileName} + ${productFileName}` : fileName,
      uploadedBy: owner.uploadedBy,
      uploaderUserId: owner.uploaderUserId,
      uploaderEmail: owner.uploaderEmail,
      uploaderName: owner.uploaderName,
      datasetType,
      signature,
      salesRecords,
      productRecords,
    });
    await publishUploadNotification({
      uploadedByUser: req.user,
      fileName: productFileName ? `${fileName} + ${productFileName}` : fileName,
      fileNames: [fileName, productFileName].filter(Boolean),
      uploadedAt: batch.createdAt,
      uploaderName: owner.uploaderName || owner.uploadedBy || req.user?.name || '',
    });
    res.status(201).json({
      success: true,
      message: 'CSV dashboard upload imported',
      data: { id: batch.id, rows: salesRecords.length, productRows: productRecords.length, batch },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const parseUploadedTabularFile = file => {
  if (!file?.base64) return [];
  const name = normalize(file.name).toLowerCase();
  if (name.endsWith('.xlsx')) return parseXlsxRows(file.base64);
  return parseDelimitedRows(Buffer.from(String(file.base64).replace(/^data:.*?;base64,/, ''), 'base64').toString('utf8'));
};

const importDashboardFiles = async (req, res) => {
  try {
    const {
      salesFile,
      productFile,
      uploadedBy = 'frontend-upload',
      datasetType = 'XLSX',
      signature,
    } = req.body;
    const owner = getUploadOwnerData(req, uploadedBy);

    if (!salesFile?.base64 && !productFile?.base64) {
      return res.status(400).json({ success: false, message: 'At least one spreadsheet file is required' });
    }

    const salesRows = parseUploadedTabularFile(salesFile);
    const productRows = parseUploadedTabularFile(productFile);
    if (salesFile?.base64) {
      const salesTemplate = validateTemplateRows(salesRows, SALES_ORDER_TEMPLATE, 'Sales Order (SO)');
      if (!salesTemplate.valid) return res.status(400).json({ success: false, message: salesTemplate.message });
    }
    if (productFile?.base64) {
      const productTemplate = validateTemplateRows(productRows, SALES_PRODUCT_TEMPLATE, 'Sales Product (SP)');
      if (!productTemplate.valid) return res.status(400).json({ success: false, message: productTemplate.message });
    }

    const salesRecords = mapSheetRowsToSalesRecords(salesRows);
    const productRecords = mapSheetRowsToProductRecords(productRows);
    if (!salesRecords.length && !productRecords.length) {
      return res.status(400).json({
        success: false,
        message: 'No usable rows found. Check the sales file columns or product summary columns.',
      });
    }

    const batch = await createDashboardImportBatch({
      fileName: [salesFile?.name, productFile?.name].filter(Boolean).join(' + '),
      uploadedBy: owner.uploadedBy,
      uploaderUserId: owner.uploaderUserId,
      uploaderEmail: owner.uploaderEmail,
      uploaderName: owner.uploaderName,
      datasetType,
      signature,
      salesRecords,
      productRecords,
    });
    await publishUploadNotification({
      uploadedByUser: req.user,
      fileName: [salesFile?.name, productFile?.name].filter(Boolean).join(' + '),
      fileNames: [salesFile?.name, productFile?.name].filter(Boolean),
      uploadedAt: batch.createdAt,
      uploaderName: owner.uploaderName || owner.uploadedBy || req.user?.name || '',
    });

    res.status(201).json({
      success: true,
      message: 'Dashboard spreadsheet upload imported',
      data: { id: batch.id, rows: salesRecords.length, productRows: productRecords.length, batch },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const parseGoogleSheetReference = value => {
  const raw = normalize(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    return match ? {
      spreadsheetId: match[1],
      gid: url.searchParams.get('gid') || '0',
    } : null;
  } catch {
    return { spreadsheetId: raw, gid: '0' };
  }
};

const syncGoogleSheetsData = async (req, res) => {
  try {
    const sheetReference = parseGoogleSheetReference(req.body?.sheetUrl);
    const spreadsheetId = sheetReference?.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const range = process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A:Z';
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_SPREADSHEET_ID');

    let salesRecords = [];

    if (sheetReference?.spreadsheetId && !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${encodeURIComponent(sheetReference.gid)}`;
      const csvResponse = await fetch(csvUrl);
      if (!csvResponse.ok) throw new Error(`Google Sheets CSV export error ${csvResponse.status}`);
      salesRecords = mapSheetRowsToSalesRecords(parseDelimitedRows(await csvResponse.text()));
    } else {
      const accessToken = await getGoogleAccessToken();
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const sheetsResponse = await fetch(apiUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!sheetsResponse.ok) throw new Error(`Google Sheets API error ${sheetsResponse.status}`);
      const sheetsJson = await sheetsResponse.json();
      salesRecords = mapSheetRowsToSalesRecords(sheetsJson.values || []);
    }

    if (!salesRecords.length) throw new Error('No usable rows from Google Sheets API');

    const signature = `google-sheets:${spreadsheetId}:${range}`;
    const owner = getUploadOwnerData(req, 'google-sheets');
    const batch = await createDashboardImportBatch({
      fileName: sheetReference?.spreadsheetId ? `google-sheets:${spreadsheetId}` : `google-sheets-api:${range}`,
      uploadedBy: owner.uploadedBy,
      uploaderUserId: owner.uploaderUserId,
      uploaderEmail: owner.uploaderEmail,
      uploaderName: owner.uploaderName,
      datasetType: 'Google Sheets',
      signature,
      salesRecords,
    });
    await publishUploadNotification({
      uploadedByUser: req.user,
      fileName: batch.fileName || `google-sheets:${spreadsheetId}`,
      fileNames: [batch.fileName || `google-sheets:${spreadsheetId}`],
      uploadedAt: batch.createdAt,
      uploaderName: owner.uploaderName || owner.uploadedBy || req.user?.name || '',
    });

    res.json({ success: true, message: 'Google Sheets synced', data: { id: batch.id, rows: salesRecords.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardUploads = async (req, res) => {
  try {
    await cleanupExpiredDashboardUploads();
    const accessibleRows = await getAccessibleUploadIds(req);
    const accessibleIds = accessibleRows.map(row => row.id);
    const batches = accessibleIds.length
      ? await prisma.dashboardImportBatch.findMany({
        where: { id: { in: accessibleIds } },
        orderBy: { createdAt: 'desc' },
        include: includeBatchRecords,
      })
      : [];
    const ownedBatches = await Promise.all(batches.map(attachBatchOwnership));
    const seenGlobalSignatures = new Set();
    const uploads = ownedBatches.filter(batch => {
      if (req.user?.role !== 'admin' || !batch.signature) return true;
      if (seenGlobalSignatures.has(batch.signature)) return false;
      seenGlobalSignatures.add(batch.signature);
      return true;
    }).map(summarizeBatch);

    res.json({
      success: true,
      message: req.user?.role === 'admin' ? 'Global uploads loaded' : 'Personal uploads loaded',
      data: uploads,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardUploadById = async (req, res) => {
  try {
    await cleanupExpiredDashboardUploads();
    const batch = await prisma.dashboardImportBatch.findUnique({
      where: { id: Number(req.params.id) },
      include: includeBatchRecords,
    });
    const ownedBatch = await attachBatchOwnership(batch);

    if (!ownedBatch || !canAccessBatch(req, ownedBatch)) {
      return res.status(403).json({
        success: false,
        message: 'Upload access denied',
      });
    }

    res.json({
      success: true,
      message: 'Upload loaded',
      data: { ...summarizeBatch(ownedBatch), batch: ownedBatch },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  importDashboardData,
  importDashboardCsv,
  importDashboardFiles,
  getLatestDashboardImport,
  getDashboardAnalytics,
  getTimelineSalesComparison,
  getDashboardUploads,
  getDashboardUploadById,
  syncGoogleSheetsData,
};
