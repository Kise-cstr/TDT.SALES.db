const prisma = require('../config/db');

const PASSWORD_LOGIN_LIMIT = 4;
const RECOVERY_FAILURE_LIMIT = 5;
const RECOVERY_LOCK_MINUTES = 15;

let recoveryColumnsReady = false;
let recoveryAttemptLogReady = false;

const normalizeEmail = value => String(value || '').trim().toLowerCase();

const ensurePasswordRecoveryColumns = async () => {
  if (recoveryColumnsReady) return;

  const columns = [
    ['recoveryPhraseHash', 'TEXT'],
    ['passwordFailedAttempts', 'INTEGER NOT NULL DEFAULT 0'],
    ['recoveryFailedAttempts', 'INTEGER NOT NULL DEFAULT 0'],
    ['recoveryLockedUntil', 'TIMESTAMP(3)'],
    ['recoveryLastAttemptAt', 'TIMESTAMP(3)']
  ];

  for (const [name, type] of columns) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "${name}" ${type}`);
    } catch (error) {
      if (!/duplicate column name|already exists/i.test(String(error.message || ''))) throw error;
    }
  }

  recoveryColumnsReady = true;
};

const ensureRecoveryAttemptLogTable = async () => {
  if (recoveryAttemptLogReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PasswordRecoveryAttempt" (
      "id" BIGSERIAL PRIMARY KEY,
      "userId" INTEGER,
      "email" TEXT NOT NULL,
      "phase" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "reason" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  recoveryAttemptLogReady = true;
};

const logRecoveryAttempt = async ({
  userId = null,
  email,
  phase,
  status,
  reason = null,
  ipAddress = null,
  userAgent = null,
}) => {
  await ensureRecoveryAttemptLogTable();
  await prisma.$executeRaw`
    INSERT INTO "PasswordRecoveryAttempt" ("userId", "email", "phase", "status", "reason", "ipAddress", "userAgent")
    VALUES (${userId}, ${normalizeEmail(email)}, ${phase}, ${status}, ${reason}, ${ipAddress}, ${userAgent})
  `;
};

const getRecoveryUserByEmail = async email => {
  await ensurePasswordRecoveryColumns();
  const rows = await prisma.$queryRaw`
    SELECT
      "id",
      "email",
      "password",
      "recoveryPhraseHash",
      "passwordFailedAttempts",
      "recoveryFailedAttempts",
      "recoveryLockedUntil",
      "recoveryLastAttemptAt",
      "role",
      "status"
    FROM "User"
    WHERE LOWER("email") = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return rows[0] || null;
};

const resetPasswordFailureCounters = async userId => {
  await ensurePasswordRecoveryColumns();
  await prisma.$executeRaw`
    UPDATE "User"
    SET "passwordFailedAttempts" = 0
    WHERE "id" = ${userId}
  `;
};

const recordPasswordFailure = async userId => {
  await ensurePasswordRecoveryColumns();
  const rows = await prisma.$queryRaw`
    UPDATE "User"
    SET "passwordFailedAttempts" = COALESCE("passwordFailedAttempts", 0) + 1
    WHERE "id" = ${userId}
    RETURNING "passwordFailedAttempts"
  `;
  return Number(rows?.[0]?.passwordFailedAttempts || 0);
};

const resetRecoveryFailureCounters = async userId => {
  await ensurePasswordRecoveryColumns();
  await prisma.$executeRaw`
    UPDATE "User"
    SET "recoveryFailedAttempts" = 0,
        "recoveryLockedUntil" = NULL,
        "recoveryLastAttemptAt" = NULL
    WHERE "id" = ${userId}
  `;
};

const recordRecoveryFailure = async userId => {
  await ensurePasswordRecoveryColumns();
  const rows = await prisma.$queryRaw`
    UPDATE "User"
    SET "recoveryFailedAttempts" = COALESCE("recoveryFailedAttempts", 0) + 1,
        "recoveryLastAttemptAt" = CURRENT_TIMESTAMP,
        "recoveryLockedUntil" = CASE
          WHEN COALESCE("recoveryFailedAttempts", 0) + 1 >= ${RECOVERY_FAILURE_LIMIT}
            THEN CURRENT_TIMESTAMP + INTERVAL '${RECOVERY_LOCK_MINUTES} minutes'
          ELSE "recoveryLockedUntil"
        END
    WHERE "id" = ${userId}
    RETURNING "recoveryFailedAttempts", "recoveryLockedUntil"
  `;

  return {
    recoveryFailedAttempts: Number(rows?.[0]?.recoveryFailedAttempts || 0),
    recoveryLockedUntil: rows?.[0]?.recoveryLockedUntil || null,
  };
};

module.exports = {
  PASSWORD_LOGIN_LIMIT,
  RECOVERY_FAILURE_LIMIT,
  ensurePasswordRecoveryColumns,
  ensureRecoveryAttemptLogTable,
  getRecoveryUserByEmail,
  logRecoveryAttempt,
  recordPasswordFailure,
  recordRecoveryFailure,
  resetPasswordFailureCounters,
  resetRecoveryFailureCounters,
};
