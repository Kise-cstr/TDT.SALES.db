import {
  computeProductTons,
  extractUnitWeightKg,
  normalizeProductGroupKey,
  productDisplayName
} from './productCatalog';
import {
  getSalesRepNameFromCode,
  normalizeSalesRepCode
} from './salesRepCatalog';

const LIVE_DASHBOARD_KEY = 'tdt_live_dashboard_data';
const LIVE_UPLOAD_MODE_KEY = 'tdt_live_upload_mode';

const normalize = value => String(value ?? '').trim();
const normalizeHeader = value => normalize(value)
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '');
const normalizeName = value => normalize(value).replace(/\s+/g, ' ');
const entityKey = value => normalizeName(value).toUpperCase();
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const toNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = normalize(value);
  if (!raw || /^-+$/.test(raw.replace(/\s/g, ''))) return 0;
  
  // Handle percentage expressions like "6%(2469.21)" or "5.04%(51171.58)"
  const percentMatch = raw.match(/\d+\.?\d*%\(?\s*\(?([\d,]+\.?\d*)\)?/);
  if (percentMatch) {
    const numStr = percentMatch[1].replace(/,/g, '');
    const parsed = Number(numStr);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  // Handle expressions like "92901.14/5.7" by taking the first number
  const divisionMatch = raw.match(/^([\d,]+\.?\d*)\s*\//);
  if (divisionMatch) {
    const numStr = divisionMatch[1].replace(/,/g, '');
    const parsed = Number(numStr);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  // Remove commas from numbers (e.g., "5,472" -> "5472") and strip non-numeric characters
  // while preserving decimal points and hyphens for negative numbers
  const cleaned = raw.replace(/,/g, '');
  const parsed = Number(cleaned.replace(/\((.*)\)/, '-$1').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveGkFromFob = (gkValue, fobValue) => {
  const gk = toNumber(gkValue);
  return gk !== 0 ? gk : toNumber(fobValue);
};

const normalizeDateString = value => {
  const raw = normalize(value);
  if (!raw) return '';
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial)) {
      const parsedSerial = new Date(Math.floor(serial - 25569) * 86400000);
      return Number.isNaN(parsedSerial.getTime()) ? '' : parsedSerial.toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
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
      if (row.some(item => normalize(item))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(item => normalize(item))) rows.push(row);
  return rows;
};

const findHeaderIndex = rows => {
  const signals = new Set(['date', 'branchclass', 'branch', 'class', 'salesrepcode', 'salesrepname', 'repcode', 'repname', 'rep', 'clientname', 'customername', 'companyname', 'name', 'amount', 'counter', 'performance', 'salesperformance']);
  return rows.findIndex(row => row.map(normalizeHeader).filter(header => signals.has(header)).length >= 4);
};

const createFinder = headers => (...keys) => {
  const normalizedKeys = keys.map(normalizeHeader);
  return normalizedKeys.map(key => headers.indexOf(key)).find(index => index >= 0) ?? -1;
};

const normalizeRep = record => {
  const code = normalizeSalesRepCode(record.repCode);
  if (!code) return 'Unassigned';
  return getSalesRepNameFromCode(code) || code;
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

const productTons = record => computeProductTons(record);
const isBlockedProductGroup = value => normalizeProductGroupKey(value) === 'TUBULAR';
const cleanProductGroupLabel = value => {
  const label = normalizeName(value);
  if (!label || /^total\b/i.test(label) || /^inventory\b/i.test(label) || isBlockedProductGroup(label)) return '';
  return label;
};

const groupRecords = (records, getLabel, getValue = () => 1) => {
  const totals = new Map();
  const labels = new Map();

  records.forEach(record => {
    const label = normalizeName(getLabel(record)) || 'Unassigned';
    const key = entityKey(label) || 'UNASSIGNED';
    if (!labels.has(key)) labels.set(key, label);
    totals.set(key, (totals.get(key) || 0) + toNumber(getValue(record)));
  });

  return Array.from(totals.entries())
    .map(([key, value]) => ({ label: labels.get(key) || key, name: labels.get(key) || key, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
};

const getUniqueCompanyGroups = (records = []) => {
  const groups = new Map();

  (Array.isArray(records) ? records : []).forEach(record => {
    const companyName = normalizeName(record.clientName || record.companyName || record.name);
    if (!companyName) return;

    const key = entityKey(companyName);
    if (!groups.has(key)) {
      groups.set(key, {
        label: companyName,
        name: companyName,
        value: 0
      });
    }

    const current = groups.get(key);
    current.value += toNumber(record.grossSales || record.sales);
    groups.set(key, current);
  });

  return Array.from(groups.values())
    .sort((a, b) => b.value - a.value);
};

const buildRepRoster = (records = []) => {
  const roster = new Map();

  (Array.isArray(records) ? records : []).forEach(record => {
    const code = normalizeSalesRepCode(record.repCode);
    const label = getSalesRepNameFromCode(code) || normalizeRep(record);
    const key = code || entityKey(label);
    if (!key || key === 'UNASSIGNED' || roster.has(key)) return;
    roster.set(key, {
      id: `live-${key}`,
      code,
      label,
      name: label,
      avatar: '',
      branch: normalizeName(record.branch) || 'Unassigned Branch',
      position: 'Sales Representative',
      accountStatus: 'approved'
    });
  });

  return Array.from(roster.values());
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
    const key = normalizeProductGroupKey(product.label);
    const raw = rawTotals.get(key);
    if (!raw) {
      console.warn(`[product-validation] Rendered product "${product.label}" was not found in raw CSV rows.`);
      return;
    }
    if (Math.abs(toNumber(product.quantity) - raw.quantity) > 0.01) {
      console.warn(`[product-validation] Quantity mismatch for "${product.label}".`, { rendered: product.quantity, raw: raw.quantity });
    }
    if (Math.abs(toNumber(product.revenue) - raw.revenue) > 0.01) {
      console.warn(`[product-validation] Sales mismatch for "${product.label}".`, { rendered: product.revenue, raw: raw.revenue });
    }
  });
};

const rowsToSalesRecords = rows => {
  const headerRowIndex = findHeaderIndex(rows);
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const find = createFinder(headers);
  const idx = {
    date: find('date'),
    branch: find('branch/class', 'branch class', 'branchclass', 'branch', 'class'),
    repCode: find('sales rep code', 'rep code', 'rep'),
    repName: find('sales rep name', 'sales rep', 'rep name', 'rep'),
    clientName: find('client name', 'customer name', 'company name', 'name'),
    type: find('type'),
    terms: find('terms', 'payment terms'),
    clientType: find('client type'),
    leadSource: find('source', 'lead source'),
    amount: find('amount', 'gross sales', 'sales'),
    finalGk: find('final gk', 'gk'),
    salesmanGk: find('salesman gk', 'gross kita'),
    weight: find('weight', 'tons', 'tonnage', 'ton'),
    fob: find('fob'),
    counter: find('counter', 'sales performance', 'salesperformance', 'performance', 'counter label'),
    memo: find('memo', 'remarks', 'notes')
  };

  const val = (row, index) => (index >= 0 ? normalize(row[index]) : '');

  return rows.slice(headerRowIndex + 1)
    .map(row => {
      const date = normalizeDateString(val(row, idx.date));
      const grossSales = toNumber(val(row, idx.amount));
      const fob = toNumber(val(row, idx.fob));
      const finalGk = toNumber(val(row, idx.finalGk));
      const salesmanGk = resolveGkFromFob(val(row, idx.salesmanGk), fob);
      const repCode = normalizeSalesRepCode(val(row, idx.repCode));
      const repName = '';
      const salesRep = getSalesRepNameFromCode(repCode) || repCode || 'Unassigned';
      const record = {
        date,
        branch: normalizeName(val(row, idx.branch)),
        repCode,
        repName,
        salesRep,
        clientName: normalizeName(val(row, idx.clientName)),
        type: normalizeName(val(row, idx.type)),
        terms: normalizeName(val(row, idx.terms)),
        clientType: normalizeName(val(row, idx.clientType)),
        leadSource: normalizeName(val(row, idx.leadSource)),
        grossSales,
        sales: grossSales,
        fob,
        finalGk,
        salesmanGk,
        gk: salesmanGk || finalGk,
        weight: toNumber(val(row, idx.weight)),
        counter: normalizeName(val(row, idx.counter)),
        memo: normalizeName(val(row, idx.memo)),
        closedDeal: grossSales > 0 ? 'Yes' : 'No'
      };
      return record;
    })
    .filter(record => record.date && (record.salesRep || record.repName || record.repCode || record.clientName));
};

const rowsToProductRecords = rows => {
  const officialHeaderIndex = rows.findIndex(row => {
    const headers = row.map(normalizeHeader);
    return headers.includes('qty') && headers.includes('amount') && headers.includes('grossmargin');
  });

  if (officialHeaderIndex >= 0) {
    const headers = rows[officialHeaderIndex].map(normalizeHeader);
    const find = key => headers.indexOf(normalizeHeader(key));
    const idx = {
      quantity: find('Qty'),
      amount: find('Amount'),
      salesPrice: find('Avg Price'),
      cogs: find('COGS'),
      grossMargin: find('Gross Margin')
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
          date: '',
          productName,
          category: category || cleanProductGroupLabel(productName),
          subCategory,
          quantity,
          kgs: unitWeightKg,
          unitWeightKg,
          tons: unitWeightKg ? (quantity * unitWeightKg) / 1000 : 0,
          amount: cogs,
          gk: toNumber(row[idx.grossMargin]),
          salesPrice: toNumber(row[idx.salesPrice]),
          branch: 'Manila'
        };
      })
      .filter(record => record?.productName && (record.quantity || record.amount || record.gk));
  }

  const signals = new Set([
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
    'amount'
  ]);
  const headerRowIndex = rows.findIndex(row => row.map(normalizeHeader).filter(header => signals.has(header)).length >= 2);
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const find = createFinder(headers);
  const idx = {
    date: find('date', 'sales date', 'transaction date', 'invoice date'),
    productName: find('product name', 'product description', 'product', 'memo', 'item description', 'item', 'item name', 'description', 'particulars', 'material', 'size'),
    category: find('category', 'product category'),
    quantity: find('quantity', 'qty', 'pcs', 'total qty'),
    kgs: find('kgs', 'kg', 'weight kg', 'unit weight', 'unit weight kg'),
    unit: find('unit', 'uom', 'u/m'),
    amount: find('amount', 'total amount', 'net amount', 'gross amount', 'gross sales', 'sales', 'revenue'),
    cogs: find('cogs', 'cost of goods sold', 'cost'),
    balance: find('balance', 'gk', 'gross kita', 'gross profit', 'profit'),
    branch: find('branch/class', 'branch/cl', 'branch', 'class')
  };
  const val = (row, index) => (index >= 0 ? normalize(row[index]) : '');

  return rows.slice(headerRowIndex + 1)
    .map(row => {
      const rawProductName = val(row, idx.productName);
      const productName = cleanProductGroupLabel(rawProductName);
      return {
        date: normalizeDateString(val(row, idx.date)),
        productName: rawProductName || productName,
        category: cleanProductGroupLabel(val(row, idx.category)) || productName,
        quantity: toNumber(val(row, idx.quantity)),
        kgs: toNumber(val(row, idx.kgs)),
        tons: productTons({ productName: rawProductName, quantity: toNumber(val(row, idx.quantity)), kgs: val(row, idx.kgs), unit: val(row, idx.unit) }),
        amount: idx.cogs >= 0 ? toNumber(val(row, idx.cogs)) : toNumber(val(row, idx.amount)),
        gk: toNumber(val(row, idx.balance)),
        branch: normalizeName(val(row, idx.branch))
      };
    })
    .filter(record => record.productName && (record.quantity || record.amount || record.gk))
    .filter(record => !isBlockedProductGroup(record.category) && !isBlockedProductGroup(record.productName));
};

const getWeekLabel = date => {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor((date - firstDay) / 86400000);
  return `W${Math.floor(dayOffset / 7) + 1}`;
};

const daysInMonth = date => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const getQuotaDays = (records = [], period = 'Monthly') => {
  const normalizedPeriod = period || 'Monthly';
  if (normalizedPeriod === 'Daily') return 1;
  if (normalizedPeriod === 'Weekly') return 7;
  const datedRows = (Array.isArray(records) ? records : [])
    .map(record => new Date(record.date))
    .filter(date => !Number.isNaN(date.getTime()));
  if (!datedRows.length) return 30;
  const latest = datedRows.reduce((max, date) => (date > max ? date : max), datedRows[0]);
  return daysInMonth(latest);
};

const getQuarterStartMonth = month => Math.floor(month / 3) * 3;

const normalizeDateRangeLabel = range => {
  const label = String(range || 'All Time').trim();
  const lower = label.toLowerCase();
  if (lower === 'current month') return 'This Month';
  if (lower === 'last 3 months') return 'Last 3 Months';
  if (lower === 'last 6 months') return 'Last 6 Months';
  if (lower === 'year to date') return 'This Year';
  if (lower === 'custom date range') return 'Custom Range';
  return label || 'All Time';
};

const getRangeWindow = (range, filters = {}) => {
  const now = new Date();
  const normalizedRange = normalizeDateRangeLabel(range);
  const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

  if (normalizedRange === 'All Time') return { rangeStart: null, rangeEnd: null };
  if (normalizedRange === 'Today') return { rangeStart: startOfDay(now), rangeEnd: endOfDay(now) };
  if (normalizedRange === 'Yesterday') {
    const yesterday = addDays(now, -1);
    return { rangeStart: startOfDay(yesterday), rangeEnd: endOfDay(yesterday) };
  }
  if (normalizedRange === 'Last 7 Days') return { rangeStart: startOfDay(addDays(now, -6)), rangeEnd: endOfDay(now) };
  if (normalizedRange === 'Last 30 Days') return { rangeStart: startOfDay(addDays(now, -29)), rangeEnd: endOfDay(now) };
  if (normalizedRange === 'This Month') return { rangeStart: new Date(now.getFullYear(), now.getMonth(), 1), rangeEnd: endOfDay(now) };
  if (normalizedRange === 'Last Month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { rangeStart: start, rangeEnd: end };
  }
  if (normalizedRange === 'This Quarter') {
    const quarterStartMonth = getQuarterStartMonth(now.getMonth());
    return { rangeStart: new Date(now.getFullYear(), quarterStartMonth, 1), rangeEnd: endOfDay(now) };
  }
  if (normalizedRange === 'This Year') return { rangeStart: new Date(now.getFullYear(), 0, 1), rangeEnd: endOfDay(now) };
  if (normalizedRange === 'Custom Range' && filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    return {
      rangeStart: Number.isNaN(start.getTime()) ? null : startOfDay(start),
      rangeEnd: Number.isNaN(end.getTime()) ? null : endOfDay(end)
    };
  }
  return { rangeStart: null, rangeEnd: null };
};

export const getPeriodScopedRows = (rows = [], filters = {}) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const datedRows = sourceRows
    .map(record => ({ record, date: new Date(record.date) }))
    .filter(item => !Number.isNaN(item.date.getTime()));

  if (!datedRows.length) return sourceRows;

  const period = filters.timeline && filters.timeline !== 'Disable'
    ? filters.timeline
    : filters.period || 'Monthly';
  if (period === 'Monthly') return datedRows.map(item => item.record);

  const latest = datedRows.reduce((max, item) => (item.date > max ? item.date : max), datedRows[0].date);
  const quarterStartMonth = getQuarterStartMonth(latest.getMonth());
  const quarterEndMonth = quarterStartMonth + 2;

  return datedRows
    .filter(({ date }) => {
      if (period === 'Daily') return date.toDateString() === latest.toDateString();
      if (period === 'Weekly') {
        const diffDays = Math.floor((latest - date) / 86400000);
        return diffDays >= 0 && diffDays < 7;
      }
      if (period === 'Quarterly') {
        return date.getFullYear() === latest.getFullYear()
          && date.getMonth() >= quarterStartMonth
          && date.getMonth() <= quarterEndMonth;
      }
      if (period === 'Yearly') return date.getFullYear() === latest.getFullYear();
      return true;
    })
    .map(item => item.record);
};

const buildSalesPerformance = (records, period = 'Monthly') => {
  const groups = new Map();
  records.forEach(record => {
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) return;
    const key = period === 'Daily'
      ? record.date
      : period === 'Weekly'
        ? `${date.getFullYear()}-${getWeekLabel(date)}`
        : period === 'Quarterly'
          ? `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
          : period === 'Yearly'
            ? `${date.getFullYear()}`
            : `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
    const label = period === 'Daily'
      ? record.date.slice(5)
      : period === 'Weekly'
        ? getWeekLabel(date)
        : period === 'Quarterly'
          ? `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
          : period === 'Yearly'
            ? String(date.getFullYear())
            : monthLabels[date.getMonth()];
    const current = groups.get(key) || { label, sales: 0, target: 0, gk: 0, fob: 0 };
    current.sales += record.grossSales;
    current.gk += record.gk;
    current.fob += toNumber(record.fob);
    current.leads = (current.leads || 0) + 1;
    current.repKeys = current.repKeys || new Set();
    current.repKeys.add(entityKey(normalizeRep(record)));
    groups.set(key, current);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => ({
      label: value.label,
      sales: value.sales,
      target: value.target,
      gk: value.gk,
      fob: value.fob,
      leads: value.leads || 0,
      reps: value.repKeys?.size || 0
    }));
};

const buildProductData = records => {
  const totals = new Map();
  const labels = new Map();

  records.forEach(record => {
    const productName = productDisplayName(record);
    const key = normalizeProductGroupKey(productName);
    if (!key || key === 'TUBULAR') return;
    if (!labels.has(key)) labels.set(key, productName);
    const current = totals.get(key) || { label: productName, quantity: 0, tons: 0, revenue: 0, gk: 0 };
    current.label = labels.get(key) || productName;
    current.quantity += toNumber(record.quantity);
    current.tons += productTons(record);
    current.revenue += toNumber(record.amount);
    current.gk += toNumber(record.gk);
    totals.set(key, current);
  });

  const products = Array.from(totals.values())
    .filter(product => product.quantity || product.revenue || product.gk)
    .sort((a, b) => a.label.localeCompare(b.label));
  validateGroupedProductTotals(records, products);
  return products;
};

const buildLiveData = (records, productRecords = [], options = {}) => {
  const totalSales = records.reduce((sum, record) => sum + record.grossSales, 0);
  const totalGk = records.reduce((sum, record) => sum + record.gk, 0);
  const totalFob = records.reduce((sum, record) => sum + toNumber(record.fob), 0);
  const totalTons = productRecords.reduce((sum, record) => sum + productTons(record), 0);
  const totalProductQuantity = productRecords.reduce((sum, record) => sum + toNumber(record.quantity), 0);
  const repRoster = buildRepRoster(records);
  const repGroups = groupRecords(records, normalizeRep, record => record.grossSales);
  const branchGroups = groupRecords(records, record => record.branch, () => 1);
  const counterGroups = buildCounterDistribution(records);
  const termsGroups = groupRecords(records, record => record.terms || 'Unspecified', () => 1);
  const companyGroups = getUniqueCompanyGroups(records);

  const repTotals = new Map(repGroups.map(group => [entityKey(group.label), group]));
  const salesByRep = repRoster.map(rep => {
    const group = repTotals.get(entityKey(rep.label)) || { label: rep.label, value: 0 };
    const repRows = records.filter(record => entityKey(normalizeRep(record)) === entityKey(rep.label));
    const uniqueCompanies = new Set(
      repRows
        .map(record => String(record.clientName || record.companyName || record.name || '').trim().toUpperCase())
        .filter(Boolean)
    );
    return {
      ...rep,
      label: rep.label,
      name: rep.name || rep.label,
      sales: group.value || 0,
      leads: repRows.length,
      deals: uniqueCompanies.size || repRows.length,
      gk: repRows.reduce((sum, record) => sum + record.gk, 0)
    };
  }).sort((a, b) => {
    const salesDelta = toNumber(b.sales) - toNumber(a.sales);
    if (salesDelta) return salesDelta;
    const gkDelta = toNumber(b.gk) - toNumber(a.gk);
    if (gkDelta) return gkDelta;
    const leadsDelta = toNumber(b.leads) - toNumber(a.leads);
    if (leadsDelta) return leadsDelta;
    return String(a.label || '').localeCompare(String(b.label || ''));
  });

  const activeRepCount = salesByRep.filter(rep => toNumber(rep.sales) || toNumber(rep.gk) || toNumber(rep.leads) || toNumber(rep.deals)).length;

  return {
    rawRows: records,
    productRows: productRecords,
    totals: {
      rows: records.length,
      sales: totalSales,
      gk: totalGk,
      fob: totalFob,
      tons: Math.round(totalTons * 10) / 10,
      inventoryQuantity: Math.round(totalProductQuantity),
      companies: companyGroups.length,
      reps: activeRepCount
    },
    salesPerformance: buildSalesPerformance(records, options.period),
    branchData: branchGroups.map(group => ({ label: group.label, count: group.value })),
    counterData: counterGroups.map(group => ({ label: group.label, count: group.count })),
    sourceData: groupRecords(records, record => record.leadSource || 'Unspecified', () => 1).map(group => {
      const sourceRows = records.filter(record => entityKey(record.leadSource || 'Unspecified') === entityKey(group.label));
      return {
        label: group.label,
        count: group.value,
        leads: sourceRows.length,
        sales: sourceRows.reduce((sum, record) => sum + record.grossSales, 0),
        gk: sourceRows.reduce((sum, record) => sum + record.gk, 0),
        reps: new Set(sourceRows.map(record => entityKey(normalizeRep(record)))).size
      };
    }),
    termsData: termsGroups.map(group => ({ label: group.label, count: group.value })),
    productData: buildProductData(productRecords),
    salesByRep,
    companies: companyGroups,
    recentSalesRows: records.slice(0, 25).map(record => [
      record.date,
      record.clientName,
      record.salesRep,
      record.terms,
      `PHP ${Math.round(record.grossSales).toLocaleString()}`,
      `PHP ${Math.round(record.gk).toLocaleString()}`
    ]),
    repPerformanceRows: salesByRep.map(rep => [
      rep.label,
      rep.leads,
      rep.deals,
      `PHP ${Math.round(rep.sales).toLocaleString()}`,
      `${Math.round((rep.deals / Math.max(1, getQuotaDays(records, options.period) * 10)) * 100)}%`,
      rep.sales ? `${Math.round((rep.gk / rep.sales) * 100)}%` : '0%'
    ])
  };
};

const readLiveData = () => {
  try {
    return JSON.parse(localStorage.getItem(LIVE_DASHBOARD_KEY) || '{}');
  } catch {
    return {};
  }
};

export function getLiveDashboardData() {
  return readLiveData();
}

export function activateLiveDashboardData(liveData = {}, options = {}) {
  localStorage.setItem(LIVE_DASHBOARD_KEY, JSON.stringify(liveData || {}));
  localStorage.setItem(LIVE_UPLOAD_MODE_KEY, options.sourceType || 'upload-history');
  window.dispatchEvent(new Event('tdt-live-data-updated'));
  return liveData;
}

export function getLiveUploadMode() {
  return localStorage.getItem(LIVE_UPLOAD_MODE_KEY) || 'csv';
}

export function clearDashboardSessionData() {
  localStorage.removeItem(LIVE_DASHBOARD_KEY);
  window.dispatchEvent(new Event('tdt-live-data-updated'));
}

export function subscribeLiveData(callback) {
  const handleUpdate = () => callback(readLiveData());
  const handleStorage = event => {
    if (event.key === LIVE_DASHBOARD_KEY) handleUpdate();
  };
  window.addEventListener('tdt-live-data-updated', handleUpdate);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('tdt-live-data-updated', handleUpdate);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function parseAndSaveCsvText(csvText, options = {}) {
  const records = rowsToSalesRecords(parseDelimitedRows(csvText || ''));
  const liveData = buildLiveData(records);
  localStorage.setItem(LIVE_DASHBOARD_KEY, JSON.stringify(liveData));
  localStorage.setItem(LIVE_UPLOAD_MODE_KEY, options.sourceType || 'csv');
  window.dispatchEvent(new Event('tdt-live-data-updated'));
  return liveData;
}

export async function parseAndSaveDashboardCsvFiles({ salesCsvText = '', productCsvText = '' } = {}, options = {}) {
  const salesRecords = rowsToSalesRecords(parseDelimitedRows(salesCsvText || ''));
  const productRecords = rowsToProductRecords(parseDelimitedRows(productCsvText || ''));
  const liveData = buildLiveData(salesRecords, productRecords);
  localStorage.setItem(LIVE_DASHBOARD_KEY, JSON.stringify(liveData));
  localStorage.setItem(LIVE_UPLOAD_MODE_KEY, options.sourceType || 'csv');
  window.dispatchEvent(new Event('tdt-live-data-updated'));
  return liveData;
}

export function saveDashboardBatchData(batch = {}, options = {}) {
  const salesRecords = (Array.isArray(batch.salesRecords) ? batch.salesRecords : []).map(record => {
    const repCode = normalizeName(record.repCode);
    const grossSales = toNumber(record.grossSales);
    const fob = toNumber(record.fob);
    const finalGk = toNumber(record.finalGk);
    const salesmanGk = resolveGkFromFob(record.salesmanGk, fob);
    return {
      date: normalizeDateString(record.date),
      branch: normalizeName(record.branch),
      repCode: normalizeSalesRepCode(repCode),
      repName: '',
      salesRep: getSalesRepNameFromCode(repCode) || normalizeSalesRepCode(repCode) || 'Unassigned',
      clientName: normalizeName(record.clientName),
      type: normalizeName(record.type),
      terms: normalizeName(record.terms),
      clientType: normalizeName(record.clientType),
      leadSource: normalizeName(record.leadSource),
      grossSales,
      sales: grossSales,
      fob,
      finalGk,
      salesmanGk,
      gk: salesmanGk || finalGk,
      weight: toNumber(record.weight),
      counter: normalizeName(record.counter),
      memo: normalizeName(record.remarks),
      closedDeal: record.closedDeal || (grossSales > 0 ? 'Yes' : 'No')
    };
  });
  const productRecords = (Array.isArray(batch.productRecords) ? batch.productRecords : []).map(record => ({
    date: normalizeDateString(record.date),
    productName: record.productName,
    category: record.category,
    subCategory: record.subCategory,
    quantity: toNumber(record.quantity),
    kgs: toNumber(record.kgs ?? record.unitWeightKg),
    unitWeightKg: toNumber(record.unitWeightKg ?? record.kgs),
    tons: productTons(record),
    unit: record.unit,
    amount: toNumber(record.amount),
    gk: toNumber(record.balance),
    salesPrice: toNumber(record.salesPrice),
    branch: normalizeName(record.branch)
  }));
  const liveData = buildLiveData(salesRecords, productRecords, options);
  localStorage.setItem(LIVE_DASHBOARD_KEY, JSON.stringify(liveData));
  localStorage.setItem(LIVE_UPLOAD_MODE_KEY, options.sourceType || 'file');
  window.dispatchEvent(new Event('tdt-live-data-updated'));
  return liveData;
}

export function filterLiveDashboardData(liveData = {}, filters = {}) {
  const salesRows = Array.isArray(liveData.rawRows) ? liveData.rawRows : [];
  const productRows = Array.isArray(liveData.productRows) ? liveData.productRows : [];
  const selectedYear = filters.year && filters.year !== 'All Years' ? Number(filters.year) : null;
  const selectedMonthIndex = filters.month && filters.month !== 'All Months' ? monthNames.indexOf(filters.month) : -1;
  const selectedBranch = filters.branch && filters.branch !== 'all' ? entityKey(filters.branch) : '';
  const range = normalizeDateRangeLabel(filters.range || 'All Time');
  const { rangeStart, rangeEnd } = getRangeWindow(range, filters);

  const matchesDate = record => {
    if (!selectedYear && selectedMonthIndex < 0 && !rangeStart && !rangeEnd) return true;
    if (!record.date) return true;
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) return false;
    if (rangeStart && date < rangeStart) return false;
    if (rangeEnd && date > rangeEnd) return false;
    if (selectedYear && date.getFullYear() !== selectedYear) return false;
    if (selectedMonthIndex >= 0 && date.getMonth() !== selectedMonthIndex) return false;
    return true;
  };

  const matchesBranch = record => {
    if (!selectedBranch) return true;
    return entityKey(record.branch).includes(selectedBranch);
  };

  return buildLiveData(
    salesRows.filter(record => matchesDate(record) && matchesBranch(record)),
    productRows.filter(record => matchesDate(record) && matchesBranch(record)),
    { period: filters.timeline && filters.timeline !== 'Disable' ? filters.timeline : filters.period }
  );
}
