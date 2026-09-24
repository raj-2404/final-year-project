#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distCli = path.join(__dirname, '..', 'dist', 'cli', 'index.js');

if (fs.existsSync(distCli)) {
  const { runCli } = await import(distCli);
  runCli(process.argv);
} else {
  // If running in development without build, run tsx
  const { spawn } = await import('child_process');
  const srcCli = path.join(__dirname, '..', 'src', 'cli', 'index.ts');
  const tsxPath = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');

  const child = spawn(tsxPath, [srcCli, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
