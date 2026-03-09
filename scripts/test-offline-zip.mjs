#!/usr/bin/env node

/**
 * Integration test for offline ZIP distribution
 *
 * Verifies that the ZIP file can be properly extracted and served.
 * Simulates user workflow:
 * 1. Extract ZIP file
 * 2. Serve with HTTP server
 * 3. Verify app loads in browser context
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const zipPath = path.join(projectRoot, 'bolt-diy-offline.zip');
const testDir = path.join(projectRoot, '.test-extraction');

console.log('\n🧪 Testing ZIP Extraction & Distribution...\n');

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

// Cleanup function
function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
}

async function runTests() {
  try {
    console.log(`${YELLOW}1. Checking ZIP file...${RESET}`);
    test('ZIP file exists', fs.existsSync(zipPath));

    if (!fs.existsSync(zipPath)) {
      console.log(`${RED}ZIP file not found!${RESET}`);
      return;
    }

    console.log(`\n${YELLOW}2. Extracting ZIP file...${RESET}`);

    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });

    // Read ZIP and extract
    const zipData = fs.readFileSync(zipPath);
    const zip = new JSZip();
    await zip.loadAsync(zipData);

    let fileCount = 0;
    const files = [];

    zip.forEach((relativePath, file) => {
      files.push(relativePath);
      if (!file.dir) fileCount++;
    });

    test('ZIP contains files', fileCount > 0);
    test('ZIP contains index.html', files.some(f => f === 'index.html' || f.includes('index.html')));
    test('ZIP contains client assets', files.some(f => f.startsWith('client')));

    // Extract all files
    for (const [relativePath, file] of Object.entries(zip.files)) {
      const filePath = path.join(testDir, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (!file.dir) {
        const content = await file.async('arraybuffer');
        fs.writeFileSync(filePath, Buffer.from(content));
      }
    }

    test('Files extracted successfully', fs.existsSync(path.join(testDir, 'index.html')));

    console.log(`\n${YELLOW}3. Verifying extracted structure...${RESET}`);

    const extractedDist = testDir;
    test('Extracted index.html exists', fs.existsSync(path.join(extractedDist, 'index.html')));
    test('Extracted client/ exists', fs.existsSync(path.join(extractedDist, 'client')));

    const indexContent = fs.readFileSync(path.join(extractedDist, 'index.html'), 'utf-8');
    test('Extracted HTML is valid', indexContent.includes('<!DOCTYPE'));
    test('Extracted HTML contains app', indexContent.includes('react') || indexContent.includes('div'));

    console.log(`\n${YELLOW}4. Testing served extraction...${RESET}`);

    // Start server serving extracted files
    const server = http.createServer((req, res) => {
      let filePath = path.join(extractedDist, req.url === '/' ? 'index.html' : req.url);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.png': 'image/png'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(9998, 'localhost', async () => {
      try {
        const response = await new Promise((resolve, reject) => {
          http.get('http://localhost:9998/', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
          }).on('error', reject);
        });

        test('Extracted files serve over HTTP', response.statusCode === 200);
        test('Served HTML is valid', response.data.includes('<!DOCTYPE'));
        test('Server responds with React app', response.data.includes('react') || response.data.includes('div'));

      } catch (err) {
        console.error(`${RED}Server test error: ${err.message}${RESET}`);
        testsFailed++;
      } finally {
        server.close();
        printSummary();
      }
    });

  } catch (err) {
    console.error(`${RED}Error during tests: ${err.message}${RESET}`);
    testsFailed++;
    printSummary();
  }
}

function printSummary() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`\n${YELLOW}Test Summary${RESET}`);
  console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
  if (testsFailed > 0) {
    console.log(`${RED}Failed: ${testsFailed}${RESET}`);
  }
  console.log();

  if (testsFailed === 0) {
    console.log(`${GREEN}✅ ZIP distribution ready for users!${RESET}\n`);
    console.log('📋 User Setup Instructions:');
    console.log('1. Download bolt-diy-offline.zip');
    console.log('2. Extract: mkdir bolt && unzip bolt-diy-offline.zip -d bolt');
    console.log('3. Serve: cd bolt && python -m http.server 8000');
    console.log('4. Open: http://localhost:8000');
    console.log('5. Ensure LM Studio running at: http://127.0.0.1:1234 with CORS enabled\n');
  } else {
    console.log(`${RED}❌ ZIP tests failed.${RESET}\n`);
  }

  cleanup();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests();
