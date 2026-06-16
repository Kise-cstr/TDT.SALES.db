const dotenv = require('dotenv');

const prisma = require('./db');
const { ensureLocalPostgresReady } = require('./postgresStartup');

dotenv.config();

let bootstrapStarted = false;
let databaseReady = false;
let readyResolve;
let bootstrapError = null;
const readyPromise = new Promise(resolve => {
  readyResolve = resolve;
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const DEFAULT_CONNECT_ATTEMPTS = 20;
const DEFAULT_CONNECT_BACKOFF_MS = 1000;
const DEFAULT_MAX_BACKOFF_MS = 5000;

const warmDatabaseSchema = async () => {
  const { ensureSessionColumns } = require('../services/sessionService');
  const { ensureUserLifecycleColumns } = require('../services/accountLifecycleService');
  const { ensureAccountAccessColumns, ensureScanLogTable } = require('../services/accountAccessTokenService');
  const { ensurePasswordRecoveryColumns, ensureRecoveryAttemptLogTable } = require('../services/passwordRecoveryService');

  await Promise.all([
    ensureSessionColumns(),
    ensureUserLifecycleColumns(),
    ensureAccountAccessColumns(),
    ensureScanLogTable(),
    ensurePasswordRecoveryColumns(),
    ensureRecoveryAttemptLogTable(),
  ]);
};

const connectWithRetry = async () => {
  await ensureLocalPostgresReady({
    waitMs: 120000
  });

  let lastError;
  for (let attempt = 1; attempt <= DEFAULT_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$connect();
      bootstrapError = null;
      return;
    } catch (error) {
      lastError = error;
      bootstrapError = error;
      if (attempt === DEFAULT_CONNECT_ATTEMPTS) break;
      const backoff = Math.min(DEFAULT_CONNECT_BACKOFF_MS * attempt, DEFAULT_MAX_BACKOFF_MS);
      await sleep(backoff);
    }
  }

  throw lastError;
};

const runBootstrapAttempt = async () => {
  try {
    await connectWithRetry();
    await warmDatabaseSchema();
    databaseReady = true;
    readyResolve();
    return true;
  } catch (error) {
    bootstrapError = error;
    console.error('Database bootstrap pending:', error.message);
    return false;
  }
};

const scheduleBootstrapRetry = (delayMs = 5000) => {
  if (databaseReady) return;
  setTimeout(async () => {
    if (databaseReady) return;
    const ready = await runBootstrapAttempt();
    if (!ready) {
      scheduleBootstrapRetry(Math.min(delayMs * 1.5, 60000));
    }
  }, delayMs);
};

const startDatabaseBootstrap = () => {
  if (bootstrapStarted) return readyPromise;
  bootstrapStarted = true;

  runBootstrapAttempt().then(ready => {
    if (!ready) scheduleBootstrapRetry();
  });

  return readyPromise;
};

const waitForDatabaseReady = (timeoutMs = 15000) => {
  startDatabaseBootstrap();
  if (databaseReady) return Promise.resolve(true);

  return Promise.race([
    readyPromise.then(() => true),
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('Database bootstrap timed out')), timeoutMs);
    })
  ]);
};

const getDatabaseBootstrapStatus = () => ({
  ready: databaseReady,
  error: bootstrapError ? bootstrapError.message : null,
});

module.exports = {
  databaseReady: () => databaseReady,
  getDatabaseBootstrapStatus,
  startDatabaseBootstrap,
  waitForDatabaseReady,
};
