const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const { ensureLocalPostgresReady } = require('../source/config/postgresStartup');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const backendRoot = path.join(__dirname, '..');
const serverEntry = path.join(backendRoot, 'source', 'server.js');
const nodemonEntry = path.join(backendRoot, 'node_modules', 'nodemon', 'bin', 'nodemon.js');

const spawnBackend = () => {
  const entryPoint = fs.existsSync(nodemonEntry) ? nodemonEntry : serverEntry;
  const args = fs.existsSync(nodemonEntry) ? [serverEntry] : [];

  const child = spawn(process.execPath, [entryPoint, ...args], {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit'
  });

  const forwardSignal = signal => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  process.on('exit', () => forwardSignal('SIGTERM'));

  child.on('exit', code => {
    process.exit(code ?? 0);
  });
};

const main = async () => {
  try {
    await ensureLocalPostgresReady({ waitMs: 120000 });
    spawnBackend();
  } catch (error) {
    console.error('Unable to start backend dev server:', error.message);
    process.exit(1);
  }
};

main();
