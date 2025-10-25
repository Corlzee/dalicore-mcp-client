import { configManager } from '../dist/config-manager.js';
import { handleReadFile } from '../dist/handlers/filesystem-handlers.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_FILE = path.join(__dirname, 'test-negative-debug.txt');

async function test() {
  await configManager.setValue('allowedDirectories', [__dirname]);
  
  // Create test file with 50 lines like the real test
  const lines = [];
  for (let i = 1; i <= 50; i++) {
    lines.push(`Line ${i}: This is line number ${i} in the test file.`);
  }
  await fs.writeFile(TEST_FILE, lines.join('\n'));
  
  console.log('Test file content:');
  console.log(await fs.readFile(TEST_FILE, 'utf8'));
  console.log('\n---\n');
  
  // Test negative offset
  console.log('Testing offset=-3 with show_whitespace=false:');
  const result = await handleReadFile({ path: TEST_FILE, offset: -3, show_whitespace: false });
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log('Content:', result.content[0].text);
  console.log('Content length:', result.content[0].text.length);
  
  // Test negative offset like the test does
  console.log('\nTesting offset=-10 like the failing test:');
  const result2 = await handleReadFile({ path: TEST_FILE, offset: -10, length: 20, show_whitespace: false });
  console.log('Result2:', JSON.stringify(result2, null, 2));
  console.log('Content2:', result2.content[0].text);
  console.log('Content2 length:', result2.content[0].text.length);
  console.log('Includes "Line 1"?', result2.content[0].text.includes('Line 1'));
  
  // Cleanup
  await fs.unlink(TEST_FILE);
}

test().catch(console.error);
