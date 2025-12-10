#!/usr/bin/env node
// Start Next.js server for Tauri production build
const { spawn } = require('child_process');
const path = require('path');

const nextPath = path.join(__dirname, 'node_modules', '.bin', 'next');
const server = spawn('node', [nextPath, 'start'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3000' }
});

server.on('error', (err) => {
  console.error('Failed to start Next.js server:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  process.exit(0);
});

