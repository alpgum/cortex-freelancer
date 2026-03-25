const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { makeStorage } = require('../src/storage');

test('storage saves and loads JSON state', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cfx071-'));
  const storage = makeStorage(tmpRoot);

  const id = storage.stableIdFromName('Acme Website');
  const state = { version: 1, stage: 'lead', project: { projectId: id, projectName: 'Acme Website' } };

  storage.save(id, state);
  const loaded = storage.load(id);

  assert.deepEqual(loaded, state);
  assert.ok(storage.listProjectIds().includes(id));
});
