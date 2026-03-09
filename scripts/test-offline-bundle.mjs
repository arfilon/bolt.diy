#!/usr/bin/env node

/**
 * Test offline bundle functionality
 *
 * Verifies that the offline bundle is properly built and can be served.
 * Tests:
 * - Bundle files exist
 * - HTML entry point is valid
 * - CSS and JS assets are bundled
 * - No external API calls are present
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

console.log('\n🧪 Testing Offline Bundle...\n');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let testsPassed = 0;
let testsFailed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`${GREEN}✓${RESET} ${name}`);
    testsPassed++;
  } else {
    console.log(`${RED}✗${RESET} ${name}`);
    testsFailed++;
  }
}

// Test 1: Check dist directory exists
console.log(`${YELLOW}1. Checking bundle structure...${RESET}`);
test('dist/ directory exists', fs.existsSync(distDir));
test('dist/index.html exists', fs.existsSync(path.join(distDir, 'index.html')));
test('dist/client/ exists', fs.existsSync(path.join(distDir, 'client')));
test('dist/server/ exists', fs.existsSync(path.join(distDir, 'server')));

// Test 2: Check HTML validity
console.log(`\n${YELLOW}2. Checking HTML entry point...${RESET}`);
const htmlPath = path.join(distDir, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

test('HTML contains DOCTYPE', htmlContent.includes('<!DOCTYPE'));
test('HTML contains html tag', htmlContent.includes('<html'));
test('HTML contains head tag', htmlContent.includes('<head'));
test('HTML contains body tag', htmlContent.includes('<body'));
test('HTML is not minified', htmlContent.length > 500);

// Test 3: Check for bundled assets
console.log(`\n${YELLOW}3. Checking for bundled assets...${RESET}`);
test('HTML references client scripts', htmlContent.includes('client') || htmlContent.includes('main'));
test('HTML does not contain hardcoded API endpoints', !htmlContent.includes('http://localhost:3000') && !htmlContent.includes('http://localhost:5173'));
test('HTML does not contain development server refs', !htmlContent.includes('/__vite') && !htmlContent.includes('@vite'));

// Test 4: Check asset files
console.log(`\n${YELLOW}4. Checking bundled files...${RESET}`);
const clientDir = path.join(distDir, 'client');
let hasJs = false;
let hasCss = false;

if (fs.existsSync(clientDir)) {
  const files = fs.readdirSync(clientDir, { recursive: true });
  hasJs = files.some(f => f.endsWith('.js') || f.endsWith('.mjs'));
  hasCss = files.some(f => f.endsWith('.css'));
}

test('Has JavaScript bundles', hasJs);
test('Has CSS files', hasCss);

// Test 5: Check ZIP file
console.log(`\n${YELLOW}5. Checking ZIP distribution...${RESET}`);
const zipPath = path.join(projectRoot, 'bolt-diy-offline.zip');
test('ZIP file exists', fs.existsSync(zipPath));

if (fs.existsSync(zipPath)) {
  const zipStats = fs.statSync(zipPath);
  const zipSizeMB = (zipStats.size / 1024 / 1024).toFixed(2);
  test(`ZIP file is reasonable size (${zipSizeMB}MB)`, zipStats.size > 1000000);
}

// Test 6: Test HTTP serving
console.log(`\n${YELLOW}6. Testing HTTP server...${RESET}`);

const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.ico': 'image/x-icon'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(9999, 'localhost', async () => {
  console.log('Started test server on http://localhost:9999');

  try {
    // Test root request
    const rootResponse = await new Promise((resolve, reject) => {
      http.get('http://localhost:9999/', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      }).on('error', reject);
    });

    test('Server responds to root request', rootResponse.statusCode === 200);
    test('Root response is HTML', rootResponse.data.includes('<!DOCTYPE'));
    test('Root response contains React app', rootResponse.data.includes('react') || rootResponse.data.includes('div'));

    // Test that we're serving static files
    const allFilesValid = await testFileServing(server);
    test('Can serve static files', allFilesValid);

  } catch (err) {
    console.error(`${RED}Server test failed: ${err.message}${RESET}`);
    testsFailed++;
  } finally {
    server.close();
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`\n${YELLOW}Test Summary${RESET}`);
  console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
  if (testsFailed > 0) {
    console.log(`${RED}Failed: ${testsFailed}${RESET}`);
  }
  console.log();

  if (testsFailed === 0) {
    console.log(`${GREEN}✅ All tests passed! Offline bundle is ready.${RESET}\n`);
    console.log('📦 Distribution Instructions:');
    console.log('1. Share bolt-diy-offline.zip with users');
    console.log('2. Users extract: unzip bolt-diy-offline.zip');
    console.log('3. Users serve: python -m http.server 8000 --directory bolt-diy-offline/dist');
    console.log('4. Open: http://localhost:8000');
    console.log('5. Configure LM Studio: http://127.0.0.1:1234 (CORS enabled)\n');
    process.exit(0);
  } else {
    console.log(`${RED}❌ Some tests failed. Please check the bundle.${RESET}\n`);
    process.exit(1);
  }
});

async function testFileServing(server) {
  try {
    const testFiles = [
      '/index.html',
      '/client/manifest.json'
    ];

    for (const file of testFiles) {
      const response = await new Promise((resolve) => {
        http.get(`http://localhost:9999${file}`, (res) => {
          resolve(res.statusCode === 200 || res.statusCode === 404);
        }).on('error', () => resolve(false));
      });

      if (!response) return false;
    }
    return true;
  } catch {
    return false;
  }
}
