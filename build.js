/**
 * build.js - Script to build and package the extension
 * 
 * Run with Node.js: node build.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configuration
const version = require('./package.json').version;
const outputZip = `carrefour_extension_v${version}.zip`;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

// Helper to log with colors
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

// Step 1: Install dependencies if needed
log.info('Checking dependencies...');
if (!fs.existsSync('node_modules')) {
  log.info('Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  log.success('Dependencies installed');
} else {
  log.success('Dependencies already installed');
}

// Step 2: Build the project
log.info('Building the extension with webpack...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  log.success('Build completed successfully');
} catch (error) {
  log.error('Build failed');
  log.error(error);
  process.exit(1);
}

// Step 3: Create distribution directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  log.info('Created dist directory');
}

// Step 4: Package the extension
log.info(`Packaging extension as ${outputZip}...`);

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(__dirname, outputZip));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Listen for all archive data to be written
output.on('close', function() {
  log.success(`Extension packaged successfully: ${outputZip} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
});

// Handle errors during archiving
archive.on('error', function(err) {
  log.error(`Failed to create archive: ${err.message}`);
  process.exit(1);
});

// Pipe archive data to the file
archive.pipe(output);

// Add files to the archive
const filesToAdd = [
  { source: 'dist', dest: 'dist' },
  { source: 'background.js', dest: 'background.js' },
  { source: 'popup.html', dest: 'popup.html' },
  { source: 'popup.js', dest: 'popup.js' },
  { source: 'manifest.json', dest: 'manifest.json' },
  { source: 'README.md', dest: 'README.md' },
  { source: 'PRIVACY_POLICY.md', dest: 'PRIVACY_POLICY.md' },
  { source: 'images', dest: 'images' }
];

// Add each file to the archive
filesToAdd.forEach(file => {
  const sourcePath = path.join(__dirname, file.source);
  
  if (fs.existsSync(sourcePath)) {
    if (fs.lstatSync(sourcePath).isDirectory()) {
      // Add a directory
      archive.directory(sourcePath, file.dest);
      log.info(`Added directory: ${file.source}`);
    } else {
      // Add a file
      archive.file(sourcePath, { name: file.dest });
      log.info(`Added file: ${file.source}`);
    }
  } else {
    log.warn(`Missing file or directory: ${file.source}`);
  }
});

// Finalize the archive
archive.finalize(); 