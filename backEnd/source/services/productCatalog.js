const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');
const productKey = value => normalizeText(value)
  .toUpperCase()
  .replace(/&/g, ' AND ')
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim();
const strictProductKey = value => normalizeText(value)
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim();

const parseNumeric = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = normalizeText(value)
    .replace(/,/g, '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PRODUCT_CATEGORIES = [
  'DRBS',
  'AngBar',
  'Welding Rod',
  'Channel Bar',
  'MS Plate',
  'Wide Flange',
  'Plain Roundbar',
  'Sheet Pile',
  'Square Bar',
  'GI/BI Pipe',
  'CRS (Cold Rolled Shafting)',
  'BI/GI Sheets',
  'C Purlins',
  'Rectangular Tube',
  'Square Tube',
  'GIW (Galvanized Iron Wire)',
  'Flat Bar',
  'Stainless Sheet',
];

const PRODUCT_ALIASES = [
  { name: 'DRBS', pattern: /\bDRB[S]?\b|\bDEFORMED(?:\s+ROUND)?\s*BARS?\b|\bREBARS?\b/ },
  { name: 'ANGLE BAR', pattern: /\bANG(?:LE)?\s*BARS?\b|\bAB\s*\d*\b|\bAB\d+\b/ },
  { name: 'WELDING ROD', pattern: /\bWELDING\s+RODS?\b|\bWR\b/ },
  { name: 'CHANNEL BAR', pattern: /\bC\s*BARS?\b|\bCB\s*\d*\b|\bCB\d+\b|\bCHANNEL\s+BARS?\b|\bC\s*CHANNEL\b/ },
  { name: 'MS PLATE', pattern: /\bMS\s*PLATES?\b|\bMILD\s+STEEL\s+PLATES?\b|\bSTEEL\s+PLATES?\b|\bCHECKERED\s+PLATES?\b|\bPLATES?\b/ },
  { name: 'WIDE FLANGE', pattern: /\bWIDE\s+FLANGE\b|\bWF\s*\d*\b|\bWF\d+\b|\bI\s*BEAMS?\b|\bH\s*BEAMS?\b/ },
  { name: 'PLAIN ROUND BAR', pattern: /\bPLAIN\s+ROUND\s*BARS?\b|\bROUND\s*BARS?\b|\bPRB\s*\d*\b|\bPRB\d+\b/ },
  { name: 'SHEET PILE', pattern: /\bSHEET\s*PILES?\b|\bSHEETPILE\b/ },
  { name: 'SQUARE BAR', pattern: /\bSQUARE\s+BARS?\b|\bSB\s*\d*\b|\bSB\d+\b/ },
  { name: 'GI/BI PIPES', pattern: /\b(GI|BI)\b.*\bPIPES?\b|\bPIPES?\b.*\b(GI|BI)\b/ },
  { name: 'COLD ROLLED SHAFTING', pattern: /\bCRS\b|\bCOLD\s+ROLLED\s+SHAFTING\b/ },
  { name: 'FLAT BAR', pattern: /\bFLAT\s+BARS?\b|\bFB\s*\d*\b|\bFB\d+\b/ },
  { name: 'STAINLESS SHEET', pattern: /\bSTAINLESS(?:\s+STEEL)?\s+SHEETS?\b|\bSSHT\b/ },
  { name: 'BI/GI SHEETS', pattern: /\b(BI|GI)\b.*\bSHEETS?\b|\bSHEETS?\b.*\b(BI|GI)\b/ },
  { name: 'C PURLINS', pattern: /\bC\s*PURLINS?\b|\bPURLINS?\b/ },
  { name: 'GIW', pattern: /\bGIW\b|\bGALVANIZED\s+IRON\s+WIRE\b|\bG\.?I\.?\s*WIRE\b/ },
  { name: 'RECTANGULAR TUBE', pattern: /\bRECTANGULAR\s+TUBES?\b|\bRECT\s+TUBES?\b|\bRT\s*\d+\b|\bRT\d+\b/ },
  { name: 'SQUARE TUBE', pattern: /\bSQUARE\s+TUBES?\b|\bSQ\s+TUBES?\b|\bST\s*\d+\b|\bST\d+\b/ },
];

const normalizeProductName = value => {
  const key = productKey(value);
  if (!key) return '';
  const match = PRODUCT_ALIASES.find(alias => alias.pattern.test(key));
  return match?.name || '';
};

const normalizeProductGroupKey = value => {
  const key = strictProductKey(value)
    .replace(/\bGI\s*\/\s*BI\s+PIPES?\b/g, 'GI/BI PIPES')
    .replace(/\bBI\s*\/\s*GI\s+PIPES?\b/g, 'GI/BI PIPES')
    .replace(/\bPLAIN\s+ROUND\s*BAR\b/g, 'PLAIN ROUND BAR')
    .replace(/\bC\s*PURLINS?\b/g, 'C PURLINS')
    .replace(/\bCOLD\s+ROLLED\s+SHAFTING\b/g, 'COLD ROLLED SHAFTING');
  return key;
};

const isBlockedProductName = value => normalizeProductGroupKey(value) === 'TUBULAR';

const productDisplayName = record => {
  const category = normalizeText(record?.category);
  const productName = normalizeText(record?.productName);
  const normalizedProduct = normalizeProductName(productName);
  const normalizedCategory = normalizeProductName(category);
  const fallback = category || productName ? 'OTHERS' : '';
  if (isBlockedProductName(productName)) return normalizedCategory;
  if (isBlockedProductName(category)) return normalizedProduct;
  return normalizedCategory || normalizedProduct || normalizeProductName(`${category} ${productName}`) || fallback;
};

/**
 * Extract unit weight in KG from inventory description.
 * Supports formats like: (10.00kgs), (12.50kgs), (5.80kgs)
 * Also supports: 10.00kgs, 10.00 kg, 10kgs
 */
const extractUnitWeightKg = value => {
  const text = normalizeText(value);
  if (!text) return 0;

  for (const parenMatch of text.matchAll(/\(([^)]*)\)/g)) {
    const weightMatch = parenMatch[1].match(/(\d+(?:\.\d+)?)\s*(?:kgs?|kg)\b/i);
    if (weightMatch) return parseNumeric(weightMatch[1]);
  }

  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:kgs?|kg)\b/i);
  return match ? parseNumeric(match[1]) : 0;
};

const computeInventoryProductTons = record => {
  const quantity = parseNumeric(record?.quantity ?? record?.qty);
  if (!quantity || quantity <= 0) return 0;

  const inventoryText = normalizeText(
    record?.productName
    ?? record?.description
    ?? record?.productDescription
    ?? record?.inventoryDescription
    ?? record?.name
  );
  const weightKg = extractUnitWeightKg(inventoryText);
  if (!weightKg || weightKg <= 0) return 0;
  return (weightKg * quantity) / 1000;
};

const computeProductTons = record => {
  const quantity = parseNumeric(record?.quantity ?? record?.qty);
  if (!quantity || quantity <= 0) return 0;
  const unit = productKey(record?.unit);
  if (unit === 'TON' || unit === 'TONS') return quantity;
  const weightKg = parseNumeric(
    record?.weightKgs
    ?? record?.weightKg
    ?? record?.unitWeightKg
    ?? record?.kgs
    ?? record?.weight
  ) || extractUnitWeightKg(record?.productName);
  if (!weightKg || weightKg <= 0) return 0;
  return (weightKg * quantity) / 1000;
};

/**
 * Round tons value to 2 decimal places
 */
const roundTons = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
};

/**
 * Round percentage value to 2 decimal places
 */
const roundPercentage = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
};

const formatAuditRow = (product, index) => {
  const inventory = normalizeText(
    product?.productName
    ?? product?.description
    ?? product?.productDescription
    ?? product?.inventoryDescription
    ?? product?.name
  );
  const quantity = parseNumeric(product?.quantity ?? product?.qty);
  const weightKg = extractUnitWeightKg(inventory);
  const lineTons = roundTons((weightKg * quantity) / 1000);
  const category = productDisplayName(product) || (inventory ? 'OTHERS' : '');

  return {
    row: index + 1,
    inventory,
    weightKg,
    quantity,
    lineTons,
    category: category || 'UNMAPPED',
    included: Boolean(inventory && quantity > 0 && weightKg > 0),
  };
};

const buildProductTonAuditReport = (products = [], options = {}) => {
  const rows = [];
  const categoryTotals = new Map();
  let totalTons = 0;

  (Array.isArray(products) ? products : []).forEach((product, index) => {
    const row = formatAuditRow(product, index);
    rows.push(row);
    if (options.log) {
      console.log('[product-ton-audit] row', row);
    }

    if (!row.included) return;
    totalTons += row.lineTons;
    categoryTotals.set(row.category, (categoryTotals.get(row.category) || 0) + row.lineTons);
  });

  const categories = Array.from(categoryTotals.entries())
    .map(([category, tons]) => ({
      category,
      tons: roundTons(tons),
    }))
    .sort((a, b) => b.tons - a.tons || String(a.category).localeCompare(String(b.category)));

  if (options.log) {
    console.log('[product-ton-audit] category totals', categories);
    console.log('[product-ton-audit] total tons', roundTons(totalTons));
  }

  return {
    rows,
    categories,
    totalTons: roundTons(totalTons),
  };
};

/**
 * Compute product breakdown with tons and percentages
 * @param {Array} products - Array of product records
 * @param {Object} options - Options for filtering (dateRange, filters)
 * @returns {Object} - { totalTons, productBreakdown: [{ name, tons, percentage }] }
 */
const computeProductBreakdown = (products, options = {}) => {
  const { dateRange, filters } = options;
  
  // Filter products based on options
  let filteredProducts = Array.isArray(products) ? products : [];
  
  if (dateRange) {
    const { startDate, endDate } = dateRange;
    if (startDate) {
      const start = new Date(startDate);
      filteredProducts = filteredProducts.filter(p => {
        if (!p.date) return true;
        const productDate = p.date instanceof Date ? p.date : new Date(p.date);
        return productDate >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      filteredProducts = filteredProducts.filter(p => {
        if (!p.date) return true;
        const productDate = p.date instanceof Date ? p.date : new Date(p.date);
        return productDate <= end;
      });
    }
  }
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all' || value === 'All Months') return;
      filteredProducts = filteredProducts.filter(p => {
        const productValue = p[key];
        if (!productValue) return false;
        return String(productValue).toUpperCase() === String(value).toUpperCase();
      });
    });
  }
  
  // Group by product category/name and calculate tons
  const productMap = new Map();
  
  filteredProducts.forEach(product => {
    // Skip products without valid weight
    const productName = productDisplayName(product);
    if (!productName) return;
    
    const key = normalizeProductGroupKey(productName);
    if (!key || isBlockedProductName(key)) return;
    
    const tons = roundTons(computeInventoryProductTons(product));
    if (tons <= 0) return;
    
    const current = productMap.get(key) || { name: productName, totalTons: 0 };
    current.totalTons += tons;
    productMap.set(key, current);
  });
  
  // Calculate total tons
  let totalTons = 0;
  productMap.forEach(item => {
    totalTons += item.totalTons;
  });
  totalTons = roundTons(totalTons);
  
  // Build product breakdown with percentages
  const productBreakdown = [];
  productMap.forEach(item => {
    const tons = roundTons(item.totalTons);
    const percentage = totalTons > 0 ? roundPercentage((tons / totalTons) * 100) : 0;
    productBreakdown.push({
      name: item.name,
      tons,
      percentage,
    });
  });
  
  // Sort by tons descending
  productBreakdown.sort((a, b) => b.tons - a.tons);
  
  return {
    totalTons,
    productBreakdown,
  };
};

module.exports = {
  PRODUCT_CATEGORIES,
  computeProductBreakdown,
  computeProductTons,
  computeInventoryProductTons,
  buildProductTonAuditReport,
  extractUnitWeightKg,
  normalizeProductGroupKey,
  normalizeProductName,
  productDisplayName,
  roundPercentage,
  roundTons,
};
