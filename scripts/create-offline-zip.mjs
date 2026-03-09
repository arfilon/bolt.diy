#!/usr/bin/env node

/**
 * Create ZIP file of offline bundle
 *
 * Packages the dist/ directory into a single zip file for easy distribution.
 * Output: bolt-diy-offline.zip
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('\n📦 Creating offline bundle ZIP file...\n');

const distDir = path.join(projectRoot, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist/ directory not found');
  console.error('   Run "pnpm run build:offline:complete" first');
  process.exit(1);
}

// Create ZIP file
const zip = new JSZip();

function addDirToZip(dir, zipFolder, relativePath = '') {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const zipPath = path.join(relativePath, file);

    if (stat.isDirectory()) {
      addDirToZip(filePath, zipFolder.folder(file), zipPath);
    } else {
      const fileContent = fs.readFileSync(filePath);
      zipFolder.file(file, fileContent);
    }
  }
}

console.log('📂 Adding files to ZIP...');
addDirToZip(distDir, zip);

const outputPath = path.join(projectRoot, 'bolt-diy-offline.zip');

console.log('💾 Writing ZIP file...');
zip
  .generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  .then((zipBuffer) => {
    fs.writeFileSync(outputPath, zipBuffer);
    const sizeKB = (zipBuffer.length / 1024).toFixed(2);
    const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(2);

    console.log('\n✅ ZIP file created successfully!\n');
    console.log(`📦 File: bolt-diy-offline.zip`);
    console.log(`📊 Size: ${sizeKB} KB (${sizeMB} MB)`);
    console.log(`📍 Location: ${projectRoot}/\n`);

    console.log('🚀 Distribution Instructions:\n');
    console.log('1. Share bolt-diy-offline.zip with users');
    console.log('2. Users extract the ZIP file');
    console.log('3. Users serve with HTTP server:');
    console.log('   python -m http.server 8000 --directory bolt-diy-offline/dist\n');
    console.log('4. Open in browser:');
    console.log('   http://localhost:8000\n');
    console.log('5. Make sure LM Studio is running at:');
    console.log('   http://127.0.0.1:1234 (CORS enabled)\n');
  })
  .catch((err) => {
    console.error('❌ Error creating ZIP file:', err);
    process.exit(1);
  });
