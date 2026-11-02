#!/usr/bin/env node
/**
 * Runs the SAFEPATH API (port 4000) and the Vite dev server (port 3000) together.
 * Usage: npm run dev
 */
import { spawn } from 'node:child_process';

const procs = [];

function run(name, command, args, color) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: process.platform === 'win32',
  });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  child.stdout.on('data', (data) => process.stdout.write(prefix + data.toString()));
  child.stderr.on('data', (data) => process.stderr.write(prefix + data.toString()));
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`${prefix}exited with code ${code}`);
  });
  procs.push(child);
  return child;
}

run('api', process.execPath, ['--watch', 'server/index.js'], '35');
run('web', 'npm', ['--prefix', 'client', 'run', 'dev'], '36');

function shutdown() {
  for (const child of procs) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
