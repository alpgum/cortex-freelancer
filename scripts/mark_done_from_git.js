#!/usr/bin/env node
/**
 * Mark DONE tasks in TASK_QUEUE_300.md based on git log messages.
 * Supports patterns:
 *  - CF-123
 *  - CF-100→132
 *  - CF-100-132
 *  - [CF-100,101,102]
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const queuePath = path.join(repoRoot, 'TASK_QUEUE_300.md');

function getGitLog() {
  return execSync('git log --oneline', { cwd: repoRoot, encoding: 'utf8' });
}

function parseDoneSet(log) {
  const done = new Set();

  // CF-123
  for (const m of log.matchAll(/\bCF-(\d{1,3})\b/g)) {
    done.add(Number(m[1]));
  }

  // CF-051,052,053  (where only the first item has CF- prefix)
  // Also covers commit messages like: [CF-051,052,053,054]
  for (const m of log.matchAll(/\bCF-(\d{1,3})(?:\s*,\s*\d{1,3})+\b/g)) {
    const nums = m[0].match(/\d{1,3}/g) || [];
    for (const n of nums) done.add(Number(n));
  }

  // CF-100→132 or CF-100->132 (ranges)
  for (const m of log.matchAll(/\bCF-(\d{1,3})\s*(?:→|->|—|–|-)\s*(\d{1,3})\b/g)) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      if (b < a) [a, b] = [b, a];
      for (let i = a; i <= b; i++) done.add(i);
    }
  }

  return done;
}

function markQueue(queue, doneSet) {
  const lines = queue.split(/\r?\n/);
  let changed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^### \[CF-(\d{3})\] (.*)$/);
    if (!m) continue;
    const id = Number(m[1]);
    if (!doneSet.has(id)) continue;

    if (!/\s—\sDONE\s*$/.test(line)) {
      lines[i] = line + ' — DONE';
      changed++;
    }
  }

  return { text: lines.join('\n'), changed };
}

function main() {
  if (!fs.existsSync(queuePath)) {
    console.error('Missing TASK_QUEUE_300.md at', queuePath);
    process.exit(1);
  }

  const log = getGitLog();
  const doneSet = parseDoneSet(log);
  const queue = fs.readFileSync(queuePath, 'utf8');

  const { text, changed } = markQueue(queue, doneSet);
  if (changed > 0) {
    fs.writeFileSync(queuePath, text, 'utf8');
  }

  console.log(JSON.stringify({ doneCount: doneSet.size, markedLines: changed }, null, 2));
}

main();
