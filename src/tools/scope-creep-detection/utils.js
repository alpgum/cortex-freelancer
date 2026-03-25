const fs = require('fs');
const path = require('path');

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toIso(d) {
  try { return new Date(d).toISOString(); } catch { return new Date().toISOString(); }
}

function parseDate(d) {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function hours(seconds) {
  return (Number(seconds) || 0) / 3600;
}

function sum(nums) {
  return (nums || []).reduce((a, b) => a + (Number(b) || 0), 0);
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function normalizeText(s) {
  return String(s || '').toLowerCase();
}

function matchAny(text, patterns) {
  const t = normalizeText(text);
  return patterns.some(p => (p instanceof RegExp ? p.test(t) : t.includes(String(p).toLowerCase())));
}

function pickTopDrivers(signals, topN = 3) {
  return [...signals]
    .sort((a, b) => (b.contribution || 0) - (a.contribution || 0))
    .slice(0, topN);
}

function formatPct(x, digits = 0) {
  if (!isFinite(x)) return '0%';
  return `${(x * 100).toFixed(digits)}%`;
}

function formatHours(h, digits = 1) {
  return `${(Number(h) || 0).toFixed(digits)}h`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  readJson,
  writeJson,
  clamp,
  toIso,
  parseDate,
  hours,
  sum,
  uniq,
  normalizeText,
  matchAny,
  pickTopDrivers,
  formatPct,
  formatHours,
};
