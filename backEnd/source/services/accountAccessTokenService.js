const crypto = require('crypto');
const prisma = require('../config/db');

const TOKEN_TTL = '30d';
const TOKEN_TTL_DAYS = 30;

const accessTokenColumns = [
  ['qrToken', 'TEXT'],
  ['qrCodeToken', 'TEXT'],
  ['barcodeToken', 'TEXT'],
  ['qrGeneratedAt', 'TIMESTAMP(3)'],
  ['barcodeGeneratedAt', 'TIMESTAMP(3)'],
  ['tokenVersion', 'INTEGER NOT NULL DEFAULT 1'],
];

let accessColumnsReady = false;
let scanLogReady = false;

const sha256 = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const generateReadableToken = () => {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(16);
  let token = '';

  for (let index = 0; index < 20; index += 1) {
    token += alphabet[bytes[index % bytes.length] % alphabet.length];
  }

  return `TDT-${token.match(/.{1,4}/g).join('-')}`;
};

const ensureAccountAccessColumns = async () => {
  if (accessColumnsReady) return;
  for (const [name, type] of accessTokenColumns) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "${name}" ${type}`);
    } catch (error) {
      if (!/duplicate column name|already exists/i.test(String(error.message || ''))) throw error;
    }
  }
  accessColumnsReady = true;
};

const ensureScanLogTable = async () => {
  if (scanLogReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuthScanLog" (
      "id" SERIAL NOT NULL,
      "userId" INTEGER,
      "email" TEXT,
      "tokenHash" TEXT,
      "scanType" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "success" BOOLEAN NOT NULL DEFAULT false,
      "reason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuthScanLog_pkey" PRIMARY KEY ("id")
    )
  `);
  scanLogReady = true;
};

const getAccessRow = async userId => {
  await ensureAccountAccessColumns();
  const rows = await prisma.$queryRaw`
    SELECT "id", "email", "role", "status", "forced", "qrCodeToken", "qrToken", "barcodeToken", "qrGeneratedAt", "barcodeGeneratedAt", "tokenVersion"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
};

const getAccessRowByToken = async (tokenHash, token) => {
  await ensureAccountAccessColumns();
  const rows = await prisma.$queryRaw`
    SELECT "id", "email", "role", "status", "forced", "qrCodeToken", "qrToken", "barcodeToken", "qrGeneratedAt", "barcodeGeneratedAt", "tokenVersion"
    FROM "User"
    WHERE "qrCodeToken" = ${tokenHash}
       OR "qrCodeToken" = ${token}
       OR "qrToken" = ${tokenHash}
       OR "qrToken" = ${token}
    LIMIT 1
  `;
  return rows[0] || null;
};

const logScan = async ({ userId = null, email = null, tokenHash = null, scanType = 'scan', ipAddress = null, userAgent = null, success = false, reason = null } = {}) => {
  try {
    await ensureScanLogTable();
    await prisma.$executeRaw`
      INSERT INTO "AuthScanLog" ("userId", "email", "tokenHash", "scanType", "ipAddress", "userAgent", "success", "reason")
      VALUES (${userId}, ${email}, ${tokenHash}, ${scanType}, ${ipAddress}, ${userAgent}, ${success}, ${reason})
    `;
  } catch {
    // Scan logging must never make authentication less available.
  }
};

const assertScannableAccount = user => {
  if (!user) throw Object.assign(new Error('Account does not exist.'), { status: 401, reason: 'missing_account' });
  if (!['approved', 'active'].includes(user.status)) {
    throw Object.assign(new Error('Account is not active for QR login.'), { status: 403, reason: `status_${user.status || 'unknown'}` });
  }
  if (user.forced) {
    throw Object.assign(new Error('Account is pending deletion or disabled.'), { status: 403, reason: 'forced_account' });
  }
};

const generateAccountAccessToken = async user => {
  await ensureAccountAccessColumns();
  const row = await getAccessRow(user.id);
  assertScannableAccount(row);

  const tokenVersion = Number(row.tokenVersion || 1) + 1;
  const generatedAt = new Date();
  const token = generateReadableToken();
  const tokenHash = sha256(token);

  await prisma.$executeRaw`
    UPDATE "User"
    SET "qrCodeToken" = ${tokenHash},
        "barcodeToken" = NULL,
        "qrToken" = ${token},
        "qrGeneratedAt" = ${generatedAt},
        "barcodeGeneratedAt" = NULL,
        "tokenVersion" = ${tokenVersion}
    WHERE "id" = ${row.id}
  `;

  return {
    token,
    qrCodeToken: token,
    qrToken: token,
    generatedAt,
    expiresIn: TOKEN_TTL,
    tokenVersion,
  };
};

const validateAccountAccessToken = async (rawToken, scanContext = {}) => {
  // Normalize token: accept common scanner variants (different dash chars,
  // missing hyphens, extra whitespace) and canonicalize to the generated format.
  const raw = String(rawToken || '');
  // Uppercase and trim first
  let token = raw.trim().toUpperCase();

  // If scanner produced a URL or JSON-like payload, attempt to extract token param
  try {
    const parsed = JSON.parse(token);
    token = String(parsed.token || parsed.id || parsed.identity || parsed.email || token);
  } catch (e) {
    try {
      const url = new URL(token);
      token = String(url.searchParams.get('token') || url.searchParams.get('id') || token);
    } catch (err) {
      // not JSON or URL — continue
    }
  }

  // Replace various unicode dash/space characters with ASCII hyphen, then remove any non-alphanumeric or hyphen
  token = token.replace(/[\u2010-\u2015\u2212\u2043\u00AD\s]+/g, '-');
  // If token contains no ASCII hyphens, but looks like TDT + 20 chars, insert hyphens
  const alnum = token.replace(/[^A-Z0-9]/g, '');
  if (/^TDT[2-9A-HJ-NP-Z]{20}$/.test(alnum)) {
    const prefix = alnum.slice(0, 3); // TDT
    const rest = alnum.slice(3);
    const groups = rest.match(/.{1,4}/g) || [];
    token = `${prefix}-${groups.join('-')}`;
  }

  const tokenHash = sha256(token);

  try {
    if (!/^TDT-[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){4}$/.test(token)) {
      throw Object.assign(new Error('QR token format is invalid.'), { status: 401, reason: 'invalid_format' });
    }

    const row = await getAccessRowByToken(tokenHash, token);
    assertScannableAccount(row);

    const generatedAt = row.qrGeneratedAt ? new Date(row.qrGeneratedAt) : null;
    if (!generatedAt || Number.isNaN(generatedAt.getTime())) {
      throw Object.assign(new Error('QR token generation date is invalid.'), { status: 401, reason: 'missing_generated_at' });
    }
    if (Date.now() - generatedAt.getTime() > TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) {
      throw Object.assign(new Error('QR token has expired.'), { status: 401, reason: 'expired_token' });
    }
    const storedTokenValues = new Set([
      row.qrCodeToken,
      row.qrToken,
      row.barcodeToken,
    ].filter(Boolean));
    if (!storedTokenValues.has(tokenHash) && !storedTokenValues.has(token)) {
      throw Object.assign(new Error('QR token is not active for this account.'), { status: 401, reason: 'inactive_token' });
    }

    await logScan({ ...scanContext, userId: row.id, email: row.email, tokenHash, success: true, reason: 'accepted' });
    return row;
  } catch (error) {
    await logScan({
      ...scanContext,
      userId: null,
      email: null,
      tokenHash,
      success: false,
      reason: error.reason || 'validation_failed',
    });
    throw error;
  }
};

module.exports = {
  ensureAccountAccessColumns,
  ensureScanLogTable,
  generateAccountAccessToken,
  validateAccountAccessToken,
};
