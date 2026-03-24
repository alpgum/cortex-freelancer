const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getDayKey(ts = Date.now()) {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function createNdjsonStore({ dir, filenamePrefix = 'events' }) {
  ensureDir(dir);

  function filePathForDay(dayKey) {
    return path.join(dir, `${filenamePrefix}-${dayKey}.ndjson`);
  }

  function append(event) {
    const dayKey = getDayKey(event.ts);
    const fp = filePathForDay(dayKey);
    const line = JSON.stringify(event) + '\n';
    fs.appendFile(fp, line, () => {}); // fire-and-forget
  }

  function listFiles() {
    try {
      return fs.readdirSync(dir)
        .filter(f => f.startsWith(filenamePrefix + '-') && f.endsWith('.ndjson'))
        .sort();
    } catch {
      return [];
    }
  }

  function readAllEvents({ limitDays = 14 } = {}) {
    const files = listFiles().slice(-limitDays);
    const out = [];
    for (const f of files) {
      const fp = path.join(dir, f);
      let content = '';
      try { content = fs.readFileSync(fp, 'utf8'); } catch { continue; }
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try { out.push(JSON.parse(line)); } catch {}
      }
    }
    return out;
  }

  return { append, listFiles, readAllEvents, dir };
}

module.exports = { createNdjsonStore };
