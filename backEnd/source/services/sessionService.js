const { Prisma } = require('@prisma/client');

const prisma = require('../config/db');

let sessionColumnsReady = false;

const ensureSessionColumns = async () => {
  if (sessionColumnsReady) return;
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeSessionId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeSessionAt" TIMESTAMP(3)');
  sessionColumnsReady = true;
};

const setActiveSession = async (userId, sessionId, activeSessionAt) => {
  await ensureSessionColumns();
  await prisma.$executeRaw`
    UPDATE "User"
    SET "activeSessionId" = ${sessionId},
        "activeSessionAt" = ${activeSessionAt}
    WHERE "id" = ${userId}
  `;
};

const getActiveSessionId = async userId => {
  await ensureSessionColumns();
  const rows = await prisma.$queryRaw`
    SELECT "activeSessionId"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  return rows?.[0]?.activeSessionId || null;
};

const clearActiveSession = async (userId, sessionId) => {
  await ensureSessionColumns();
  await prisma.$executeRaw`
    UPDATE "User"
    SET "activeSessionId" = NULL,
        "activeSessionAt" = NULL
    WHERE "id" = ${userId}
      AND "activeSessionId" = ${sessionId}
  `;
};

const attachSessionFieldsToUsers = async users => {
  if (!users?.length) return users || [];
  await ensureSessionColumns();

  const ids = users.map(user => user.id).filter(Boolean);
  if (!ids.length) return users;

  const rows = await prisma.$queryRaw`
    SELECT "id", "activeSessionAt"
    FROM "User"
    WHERE "id" IN (${Prisma.join(ids)})
  `;
  const sessionById = new Map(rows.map(row => [row.id, row]));

  return users.map(user => ({
    ...user,
    activeSessionAt: sessionById.get(user.id)?.activeSessionAt || null,
  }));
};

module.exports = {
  attachSessionFieldsToUsers,
  clearActiveSession,
  ensureSessionColumns,
  getActiveSessionId,
  setActiveSession,
};
