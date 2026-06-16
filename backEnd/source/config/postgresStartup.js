const { execFile } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const parseDatabaseUrl = rawUrl => {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
};

const isLocalPostgres = databaseUrl => {
  if (!databaseUrl) return false;
  const hostname = String(databaseUrl.hostname || '').toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

const probePort = (host, port, timeoutMs = 1000) => new Promise(resolve => {
  const socket = net.createConnection({ host, port });
  const finish = isReachable => {
    socket.destroy();
    resolve(isReachable);
  };

  socket.setTimeout(timeoutMs);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
});

const waitForPort = async (host, port, timeoutMs = 120000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await probePort(host, port, 1000)) return true;
    await sleep(2000);
  }
  return false;
};

const runPowerShell = command => new Promise(resolve => {
  if (process.platform !== 'win32') {
    resolve(false);
    return;
  }

  execFile(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { windowsHide: true },
    error => {
      resolve(!error);
    }
  );
});

const getWindowsProgramFilesRoots = () => [
  process.env['ProgramW6432'],
  process.env.PROGRAMFILES,
  process.env['ProgramFiles(x86)']
].filter(Boolean);

const getInstalledPostgresDirs = () => {
  if (process.platform !== 'win32') return [];

  const directories = [];
  for (const root of getWindowsProgramFilesRoots()) {
    const postgresBase = path.join(root, 'PostgreSQL');
    if (!fs.existsSync(postgresBase)) continue;

    for (const versionName of fs.readdirSync(postgresBase, { withFileTypes: true })) {
      if (!versionName.isDirectory()) continue;
      const versionNumber = Number.parseInt(versionName.name, 10);
      const installDir = path.join(postgresBase, versionName.name);
      const pgCtl = path.join(installDir, 'bin', 'pg_ctl.exe');
      const dataDir = path.join(installDir, 'data');

      directories.push({
        version: Number.isFinite(versionNumber) ? versionNumber : 0,
        installDir,
        pgCtl,
        dataDir
      });
    }
  }

  return directories.sort((a, b) => b.version - a.version);
};

const startWindowsPostgresServices = async () => {
  if (process.platform !== 'win32') return false;

  const command = `
    $services = Get-Service -ErrorAction SilentlyContinue |
      Where-Object {
        $_.Name -like 'postgresql*' -or
        $_.DisplayName -match 'PostgreSQL'
      }

    if (-not $services) {
      exit 1
    }

    foreach ($service in $services) {
      if ($service.Status -ne 'Running') {
        try {
          Start-Service -InputObject $service -ErrorAction Stop
        } catch {}
      }
    }

    exit 0
  `;

  return runPowerShell(command);
};

const startWindowsPostgresCtl = async () => {
  if (process.platform !== 'win32') return false;

  const install = getInstalledPostgresDirs().find(candidate => fs.existsSync(candidate.pgCtl) && fs.existsSync(candidate.dataDir));
  if (!install) return false;

  return new Promise(resolve => {
    execFile(
      install.pgCtl,
      ['start', '-D', install.dataDir, '-w', '-t', '60'],
      { windowsHide: true },
      error => {
        resolve(!error);
      }
    );
  });
};

const ensureLocalPostgresReady = async ({ databaseUrl: rawDatabaseUrl, waitMs = 120000 } = {}) => {
  const databaseUrl = parseDatabaseUrl(rawDatabaseUrl || process.env.DATABASE_URL);
  if (!isLocalPostgres(databaseUrl)) {
    return { attempted: false, ready: true, host: databaseUrl?.hostname || null, port: Number(databaseUrl?.port || 5432) };
  }

  const host = databaseUrl.hostname || 'localhost';
  const port = Number(databaseUrl.port || 5432);

  if (await probePort(host, port, 800)) {
    return { attempted: false, ready: true, host, port };
  }

  let startupMethod = 'none';
  if (process.platform === 'win32') {
    const serviceStarted = await startWindowsPostgresServices();
    if (serviceStarted) startupMethod = 'service';

    if (!(await waitForPort(host, port, 5000))) {
      const ctlStarted = await startWindowsPostgresCtl();
      if (ctlStarted) startupMethod = startupMethod === 'service' ? 'service+pg_ctl' : 'pg_ctl';
    }
  }

  const ready = await waitForPort(host, port, waitMs);
  if (!ready) {
    throw new Error(
      `PostgreSQL at ${host}:${port} is not reachable. ` +
      `Tried local startup via ${startupMethod === 'none' ? 'auto-check' : startupMethod}. ` +
      `Make sure the database service is installed, allowed to start, and the data directory is valid.`
    );
  }

  return { attempted: true, ready: true, host, port, startupMethod };
};

module.exports = {
  ensureLocalPostgresReady,
  getInstalledPostgresDirs,
  isLocalPostgres,
  parseDatabaseUrl,
  probePort,
  waitForPort,
};
