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
  'Purlins',
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
  { name: 'PURLINS', pattern: /\bPURLINS?\b|\bC\s*PURLINS?\b/ },
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
    .replace(/\bCOLD\s+ROLLED\s+SHAFTING\b/g, 'COLD ROLLED SHAFTING');
  return key;
};

const isBlockedProductName = value => normalizeProductGroupKey(value) === 'TUBULAR';

const productDisplayName = record => {
  const category = normalizeText(record?.category);
  const productName = normalizeText(record?.productName);
  const normalizedProduct = normalizeProductName(productName);
  const normalizedCategory = normalizeProductName(category);
  if (isBlockedProductName(productName)) return normalizedCategory;
  if (isBlockedProductName(category)) return normalizedProduct;
  return normalizedCategory || normalizedProduct || normalizeProductName(`${category} ${productName}`) || '';
};

const extractUnitWeightKg = value => {
  const match = normalizeText(value).match(/([\d,.]+)\s*kgs?/i);
  const parsed = match ? Number(String(match[1]).replace(/,/g, '')) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeProductTons = record => {
  const explicitTons = Number(record?.tons);
  if (Number.isFinite(explicitTons) && explicitTons > 0) return explicitTons;
  const quantity = Number(record?.quantity ?? record?.qty) || 0;
  const unit = productKey(record?.unit);
  if (unit === 'TON' || unit === 'TONS') return quantity;
  const weightKg = Number(record?.weightKgs ?? record?.unitWeightKg ?? record?.kgs) || extractUnitWeightKg(record?.productName);
  if (!quantity || !weightKg) return 0;
  return (weightKg * quantity) / 1000;
};

module.exports = {
  PRODUCT_CATEGORIES,
  computeProductTons,
  extractUnitWeightKg,
  normalizeProductGroupKey,
  normalizeProductName,
  productDisplayName,
};
