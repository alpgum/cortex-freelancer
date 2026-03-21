#!/usr/bin/env node
/**
 * Broken link checker — scans HTML files for internal links
 * and verifies that destination files exist on disk.
 *
 * Usage: node scripts/check-links.js
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('path');

const ROOT = path.resolve(__dirname, '..');

// Collect all HTML files
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

// Extract internal href/src from HTML
function extractLinks(html) {
  const links = [];
  const re = /(?:href|src)=["']([^"'#?]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const link = m[1];
    // Skip external URLs, data URIs, mailto, tel, javascript
    if (/^(https?:|\/\/|data:|mailto:|tel:|javascript:)/i.test(link)) continue;
    links.push(link);
  }
  return links;
}

// Resolve a link to a filesystem path
function resolveLink(link, sourceFile) {
  if (link.startsWith('/')) {
    return path.join(ROOT, link);
  }
  return path.join(path.dirname(sourceFile), link);
}

// Check if a resolved path exists (with common fallbacks)
function fileExists(resolved) {
  if (fs.existsSync(resolved)) return true;
  // Try adding .html (cleanUrls)
  if (fs.existsSync(resolved + '.html')) return true;
  // Try index.html inside directory
  if (fs.existsSync(path.join(resolved, 'index.html'))) return true;
  return false;
}

// Main
function main() {
  const htmlFiles = findHtmlFiles(ROOT);
  let brokenCount = 0;
  const issues = [];

  for (const file of htmlFiles) {
    const rel = path.relative(ROOT, file);
    const html = fs.readFileSync(file, 'utf8');
    const links = extractLinks(html);

    for (const link of links) {
      const resolved = resolveLink(link, file);
      if (!fileExists(resolved)) {
        brokenCount++;
        issues.push({ file: rel, link, resolved: path.relative(ROOT, resolved) });
      }
    }
  }

  if (issues.length === 0) {
    console.log('No broken internal links found across ' + htmlFiles.length + ' HTML files.');
    process.exit(0);
  }

  console.error('Found ' + brokenCount + ' broken internal link(s):\n');
  for (const issue of issues) {
    console.error('  ' + issue.file);
    console.error('    -> ' + issue.link + '  (resolved: ' + issue.resolved + ')');
  }
  console.error('\nScanned ' + htmlFiles.length + ' HTML files.');
  process.exit(1);
}

main();
