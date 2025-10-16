#!/usr/bin/env node

import { spawn } from 'child_process';

const ck = spawn(process.argv[0], ['./dist/index.js'], {
  cwd: '/home/konverts/projects/Commander-Keen-Dev',
  stdio: ['pipe', 'pipe', 'inherit']
});

// Chrome Native Messaging protocol: 4-byte LE length prefix
process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read(4)) !== null) {
    const msgLength = chunk.readUInt32LE(0);
    const msgData = process.stdin.read(msgLength);
    
    if (msgData) {
      // Commander Keen expects raw JSON + newline
      ck.stdin.write(msgData + '\n');
    }
  }
});

// Commander Keen outputs JSON lines
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

// Handle Commander Keen errors
ck.on('error', (err) => {
  console.error('Commander Keen error:', err);
  process.exit(1);
});

ck.on('exit', (code) => {
  process.exit(code || 0);
});
