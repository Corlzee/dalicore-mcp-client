#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory where this script lives
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ck = spawn(process.argv[0], ['./dist/index.js'], {
  cwd: __dirname,  // Use the script's directory as working directory
  stdio: ['pipe', 'pipe', 'inherit']
});

// Chrome Native Messaging protocol: 4-byte LE length prefix
process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read(4)) !== null) {
    const msgLength = chunk.readUInt32LE(0);
    const msgData = process.stdin.read(msgLength);
    
    if (msgData) {
      // dalicore-mcp-client expects raw JSON + newline
      ck.stdin.write(msgData + '\n');
    }
  }
});

// dalicore-mcp-client outputs JSON lines
ck.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      const jsonStr = JSON.stringify(msg);
      const msgLength = Buffer.byteLength(jsonStr);
      const lengthBuffer = Buffer.allocUnsafe(4);
      lengthBuffer.writeUInt32LE(msgLength, 0);
      
      process.stdout.write(lengthBuffer);
      process.stdout.write(jsonStr);
    } catch (e) {
      // Skip non-JSON output
    }
  }
});

// Handle errors
ck.on('error', (err) => {
  console.error('dalicore-mcp-client error:', err);
  process.exit(1);
});

ck.on('exit', (code) => {
  process.exit(code || 0);
});
