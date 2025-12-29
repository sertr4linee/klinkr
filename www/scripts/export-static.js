#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Script pour créer un export statique depuis .next
const sourceDir = path.join(__dirname, '..', '.next');
const outDir = path.join(__dirname, '..', 'out');

// Nettoyer le dossier out
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}

fs.mkdirSync(outDir, { recursive: true });

// Copier index.html
const htmlSource = path.join(sourceDir, 'server', 'app', 'index.html');
const htmlDest = path.join(outDir, 'index.html');
fs.copyFileSync(htmlSource, htmlDest);
console.log('✓ Copied index.html');

// Copier le dossier static
const staticSource = path.join(sourceDir, 'static');
const staticDest = path.join(outDir, '_next', 'static');
if (fs.existsSync(staticSource)) {
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  fs.cpSync(staticSource, staticDest, { recursive: true });
  console.log('✓ Copied _next/static');
}

// Copier le favicon s'il existe
const faviconSource = path.join(sourceDir, 'server', 'app', 'favicon.ico.body');
if (fs.existsSync(faviconSource)) {
  const faviconDest = path.join(outDir, 'favicon.ico');
  fs.copyFileSync(faviconSource, faviconDest);
  console.log('✓ Copied favicon.ico');
}

console.log('\n✅ Static export created in /out directory');
