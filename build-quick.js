#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Building Mini-GL Quick Edition...\n');

// Configuration
const SOURCE_DIR = path.join(__dirname, 'editor/quick-build');
const BUILD_DIR = path.join(__dirname, 'dist-quick');
const SUBDOMAIN = 'minigl-editor'; // Change this to your desired subdomain

// Clean build directory
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true });
}
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Copy HTML
console.log('📄 Copying HTML...');
fs.copyFileSync(
  path.join(SOURCE_DIR, 'index.html'),
  path.join(BUILD_DIR, 'index.html')
);

// Copy CSS
console.log('🎨 Copying styles...');
fs.copyFileSync(
  path.join(SOURCE_DIR, 'style.css'),
  path.join(BUILD_DIR, 'style.css')
);

// Copy JavaScript source files
console.log('📦 Copying JavaScript modules...');
const srcDir = path.join(SOURCE_DIR, 'src');
const destSrcDir = path.join(BUILD_DIR, 'src');
copyRecursive(srcDir, destSrcDir);

// Copy miniGL library
console.log('📚 Copying miniGL library...');
const miniGLSrc = path.join(__dirname, 'lib/miniGL');
const miniGLDest = path.join(BUILD_DIR, 'lib/miniGL');
fs.mkdirSync(path.join(BUILD_DIR, 'lib'), { recursive: true });
copyRecursive(miniGLSrc, miniGLDest);

// Function to recursively copy directories
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Source directory not found: ${src}`);
    return;
  }
  
  fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('\n✅ Build complete!');
console.log(`📁 Output directory: ${BUILD_DIR}`);

// Check if Quick CLI is installed
try {
  execSync('quick --version', { stdio: 'ignore' });
  
  console.log('\n🌐 Quick CLI detected!');
  console.log(`\nTo deploy to Quick, run:`);
  console.log(`  quick deploy ${BUILD_DIR} ${SUBDOMAIN}`);
  console.log(`\nYour site will be available at:`);
  console.log(`  https://${SUBDOMAIN}.quick.shopify.io`);
  
  // Ask if user wants to deploy now
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\nDeploy now? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      console.log(`\n🚀 Deploying to ${SUBDOMAIN}.quick.shopify.io...`);
      try {
        execSync(`quick deploy ${BUILD_DIR} ${SUBDOMAIN}`, { stdio: 'inherit' });
        console.log('\n✅ Deployment successful!');
        console.log(`🌐 Visit: https://${SUBDOMAIN}.quick.shopify.io`);
      } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
      }
    }
    rl.close();
  });
  
} catch (error) {
  console.log('\n📦 Quick CLI not found.');
  console.log('Install it with: npm install -g @shopify/quick');
  console.log('\nThen deploy with:');
  console.log(`  quick deploy ${BUILD_DIR} ${SUBDOMAIN}`);
}