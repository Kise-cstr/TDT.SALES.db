export const PRODUCT_CATEGORIES = [
  'DRBS',
  'ANGLE BAR',
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
  'Stainless Sheet'
];

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

const WEIGHT_PATTERN = /(\d+(?:\.\d+)?)\s*kg(?:s)?\b/gi;
const findLastWeightValue = text => {
  let lastValue = 0;
  for (const match of text.matchAll(WEIGHT_PATTERN)) {
    const parsed = parseNumeric(match[1]);
    if (parsed > 0) lastValue = parsed;
  }
  return lastValue;
};

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
  { name: 'SQUARE TUBE', pattern: /\bSQUARE\s+TUBES?\b|\bSQ\s+TUBES?\b|\bST\s*\d+\b|\bST\d+\b/ }
];

export const normalizeProductName = value => {
  const key = productKey(value);
  if (!key) return '';
  const match = PRODUCT_ALIASES.find(alias => alias.pattern.test(key));
  return match?.name || '';
};

export const normalizeProductGroupKey = value => (
  strictProductKey(value)
    .replace(/\bGI\s*\/\s*BI\s+PIPES?\b/g, 'GI/BI PIPES')
    .replace(/\bBI\s*\/\s*GI\s+PIPES?\b/g, 'GI/BI PIPES')
    .replace(/\bPLAIN\s+ROUND\s*BAR\b/g, 'PLAIN ROUND BAR')
    .replace(/\bC\s*PURLINS?\b/g, 'C PURLINS')
    .replace(/\bCOLD\s+ROLLED\s+SHAFTING\b/g, 'COLD ROLLED SHAFTING')
);

const isBlockedProductName = value => normalizeProductGroupKey(value) === 'TUBULAR';

export const productDisplayName = record => {
  const category = normalizeText(record?.category);
  const productName = normalizeText(record?.productName);
  const normalizedProduct = normalizeProductName(productName);
  const normalizedCategory = normalizeProductName(category);
  const fallback = category || productName ? 'OTHERS' : '';
  if (isBlockedProductName(productName)) return normalizedCategory;
  if (isBlockedProductName(category)) return normalizedProduct;
  return normalizedCategory || normalizedProduct || normalizeProductName(`${category} ${productName}`) || fallback;
};

export const extractUnitWeightKg = value => {
  const text = normalizeText(value);
  if (!text) return 0;
  return findLastWeightValue(text);
};

export const calculateTotalTons = rows => {
  if (!Array.isArray(rows)) return 0;

  return rows.reduce((sum, row) => {
    const quantity = parseNumeric(
      row?.quantity
      ?? row?.qty
      ?? row?.pcs
      ?? row?.units
      ?? row?.totalQty
      ?? row?.orderQty
    );
    if (!quantity || quantity <= 0) return sum;

    const inventoryText = normalizeText(
      row?.productName
      ?? row?.description
      ?? row?.productDescription
      ?? row?.inventoryDescription
      ?? row?.name
      ?? row?.itemDescription
      ?? row?.particulars
      ?? row?.material
      ?? row?.size
    );
    const weightKg = extractUnitWeightKg(inventoryText);
    if (!weightKg || weightKg <= 0) return sum;

    return sum + (weightKg * quantity) / 1000;
  }, 0);
};

export const computeInventoryProductTons = record => {
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

export const computeProductTons = record => {
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
