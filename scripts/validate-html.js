#!/usr/bin/env node
/**
 * HTML structure validator — checks for common issues:
 * - Missing alt attributes on <img> tags
 * - Duplicate IDs within a file
 * - Missing <title> tag
 * - Missing lang attribute on <html>
 * - Missing viewport meta tag
 *
 * Usage: node scripts/validate-html.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function findHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vercel') continue;
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

function validateFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  const warnings = [];

  // 1. Missing alt on <img>
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    if (!/\balt\s*=/i.test(m[0])) {
      const line = html.substring(0, m.index).split('\n').length;
      warnings.push({ file: rel, line, msg: 'Missing alt attribute on <img>' });
    }
  }

  // 2. Duplicate IDs
  const idRe = /\bid=["']([^"']+)["']/gi;
  const ids = new Map();
  while ((m = idRe.exec(html)) !== null) {
    const id = m[1];
    const line = html.substring(0, m.index).split('\n').length;
    if (ids.has(id)) {
      warnings.push({ file: rel, line, msg: 'Duplicate id="' + id + '" (first at line ' + ids.get(id) + ')' });
    } else {
      ids.set(id, line);
    }
  }

  // 3. Missing <title>
  if (!/<title\b[^>]*>/.test(html)) {
    warnings.push({ file: rel, line: 1, msg: 'Missing <title> tag' });
  }

  // 4. Missing lang on <html>
  const htmlTag = html.match(/<html\b[^>]*>/i);
  if (htmlTag && !/\blang\s*=/i.test(htmlTag[0])) {
    warnings.push({ file: rel, line: 1, msg: 'Missing lang attribute on <html>' });
  }

  // 5. Missing viewport meta
  if (!/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
    warnings.push({ file: rel, line: 1, msg: 'Missing viewport meta tag' });
  }

  return warnings;
}

function main() {
  const htmlFiles = findHtmlFiles(ROOT);
  let allWarnings = [];

  for (const file of htmlFiles) {
    allWarnings.push(...validateFile(file));
  }

  if (allWarnings.length === 0) {
    console.log('All ' + htmlFiles.length + ' HTML files passed validation.');
    process.exit(0);
  }

  console.error('Found ' + allWarnings.length + ' issue(s) across ' + htmlFiles.length + ' HTML files:\n');
  for (const w of allWarnings) {
    console.error('  ' + w.file + ':' + w.line + ' — ' + w.msg);
  }
  process.exit(1);
}

main();
