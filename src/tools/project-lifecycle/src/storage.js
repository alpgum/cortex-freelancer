const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function stableIdFromName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'project';
}

function makeStorage(projectRoot) {
  const baseDir = path.join(projectRoot, 'data', 'project-lifecycles');
  ensureDir(baseDir);

  function filePath(projectId) {
    return path.join(baseDir, `${projectId}.json`);
  }

  function listProjectIds() {
    ensureDir(baseDir);
    return fs
      .readdirSync(baseDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  }

  function load(projectId) {
    const p = filePath(projectId);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  }

  function save(projectId, state) {
    ensureDir(baseDir);
    const p = filePath(projectId);
    fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
    return p;
  }

  return {
    baseDir,
    stableIdFromName,
    listProjectIds,
    load,
    save
  };
}

module.exports = {
  makeStorage,
  stableIdFromName
};
