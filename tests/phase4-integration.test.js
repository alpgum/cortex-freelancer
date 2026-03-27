/**
 * Phase 4 Integration Tests — Google Workspace + Email Analytics
 * Run: node tests/phase4-integration.test.js
 */

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

// ── Google Workspace lib tests ──────────────────────────────────────────

console.log('\n📁 Google Workspace Library');

const workspace = require('../api/lib/google-workspace');

test('exports all Drive functions', () => {
  assert.strictEqual(typeof workspace.listFiles, 'function');
  assert.strictEqual(typeof workspace.searchFiles, 'function');
  assert.strictEqual(typeof workspace.getFile, 'function');
  assert.strictEqual(typeof workspace.createFile, 'function');
  assert.strictEqual(typeof workspace.trashFile, 'function');
  assert.strictEqual(typeof workspace.createProjectFolder, 'function');
});

test('exports all Docs functions', () => {
  assert.strictEqual(typeof workspace.getDocument, 'function');
  assert.strictEqual(typeof workspace.createDocFromTemplate, 'function');
  assert.strictEqual(typeof workspace.batchUpdateDocument, 'function');
  assert.strictEqual(typeof workspace.appendToDocument, 'function');
});

test('exports all Sheets functions', () => {
  assert.strictEqual(typeof workspace.getSpreadsheet, 'function');
  assert.strictEqual(typeof workspace.getSheetValues, 'function');
  assert.strictEqual(typeof workspace.updateSheetValues, 'function');
  assert.strictEqual(typeof workspace.appendSheetValues, 'function');
  assert.strictEqual(typeof workspace.createSpreadsheet, 'function');
  assert.strictEqual(typeof workspace.createProjectTracker, 'function');
});

test('WORKSPACE_SCOPES includes required permissions', () => {
  assert.ok(workspace.WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/drive.file'));
  assert.ok(workspace.WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/documents'));
  assert.ok(workspace.WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/spreadsheets'));
});

test('getAllScopes includes Gmail + Workspace scopes', () => {
  const allScopes = workspace.getAllScopes();
  assert.ok(allScopes.includes('gmail.send'));
  assert.ok(allScopes.includes('drive.file'));
  assert.ok(allScopes.includes('documents'));
  assert.ok(allScopes.includes('spreadsheets'));
});

test('MIME_TYPES has correct Google types', () => {
  assert.strictEqual(workspace.MIME_TYPES.doc, 'application/vnd.google-apps.document');
  assert.strictEqual(workspace.MIME_TYPES.sheet, 'application/vnd.google-apps.spreadsheet');
  assert.strictEqual(workspace.MIME_TYPES.folder, 'application/vnd.google-apps.folder');
});

// ── Email Analytics tests ───────────────────────────────────────────────

console.log('\n📊 Email Analytics');

test('email analytics module loads', () => {
  const analytics = require('../api/email-analytics');
  assert.strictEqual(typeof analytics, 'function');
});

// ── Google Workspace API tests ──────────────────────────────────────────

console.log('\n🔗 Google Workspace API');

test('workspace API module loads', () => {
  const api = require('../api/google-workspace');
  assert.strictEqual(typeof api, 'function');
});

// ── Upwork OAuth lib tests ──────────────────────────────────────────────

console.log('\n🔑 Upwork OAuth');

const upwork = require('../api/lib/upwork-oauth');

test('exports all Upwork OAuth functions', () => {
  assert.strictEqual(typeof upwork.getConfig, 'function');
  assert.strictEqual(typeof upwork.buildAuthUrl, 'function');
  assert.strictEqual(typeof upwork.exchangeCode, 'function');
  assert.strictEqual(typeof upwork.refreshToken, 'function');
  assert.strictEqual(typeof upwork.getValidToken, 'function');
  assert.strictEqual(typeof upwork.apiRequest, 'function');
  assert.strictEqual(typeof upwork.getMyProfile, 'function');
  assert.strictEqual(typeof upwork.searchJobs, 'function');
  assert.strictEqual(typeof upwork.getJobDetails, 'function');
  assert.strictEqual(typeof upwork.getContracts, 'function');
  assert.strictEqual(typeof upwork.getEarnings, 'function');
});

test('getConfig returns null without env vars', () => {
  const config = upwork.getConfig();
  // Should return null if UPWORK_CLIENT_ID not set
  if (process.env.UPWORK_CLIENT_ID) {
    assert.ok(config);
  } else {
    assert.strictEqual(config, null);
  }
});

// ── Gmail lib tests ─────────────────────────────────────────────────────

console.log('\n📧 Gmail OAuth');

const gmail = require('../api/lib/gmail');

test('exports all Gmail functions', () => {
  assert.strictEqual(typeof gmail.getConfig, 'function');
  assert.strictEqual(typeof gmail.buildAuthUrl, 'function');
  assert.strictEqual(typeof gmail.exchangeCode, 'function');
  assert.strictEqual(typeof gmail.refreshToken, 'function');
  assert.strictEqual(typeof gmail.getValidToken, 'function');
  assert.strictEqual(typeof gmail.sendEmail, 'function');
  assert.strictEqual(typeof gmail.listMessages, 'function');
  assert.strictEqual(typeof gmail.getMessage, 'function');
  assert.strictEqual(typeof gmail.parseMessage, 'function');
  assert.strictEqual(typeof gmail.getProfile, 'function');
});

test('parseMessage extracts headers correctly', () => {
  const mockMsg = {
    id: 'test123',
    threadId: 'thread456',
    snippet: 'Test snippet',
    labelIds: ['INBOX'],
    payload: {
      headers: [
        { name: 'From', value: 'test@example.com' },
        { name: 'Subject', value: 'Test Subject' },
        { name: 'To', value: 'me@example.com' },
        { name: 'Date', value: 'Thu, 27 Mar 2026 08:00:00 +0000' },
      ],
      mimeType: 'text/plain',
      body: {
        data: Buffer.from('Hello test body').toString('base64url'),
      },
    },
  };

  const parsed = gmail.parseMessage(mockMsg);
  assert.strictEqual(parsed.id, 'test123');
  assert.strictEqual(parsed.from, 'test@example.com');
  assert.strictEqual(parsed.subject, 'Test Subject');
  assert.strictEqual(parsed.bodyText, 'Hello test body');
});

// ── Gmail Templates tests ───────────────────────────────────────────────

console.log('\n📝 Gmail Templates');

test('templates module loads', () => {
  const templates = require('../api/gmail-templates');
  assert.strictEqual(typeof templates, 'function');
});

// ── Integration API tests ───────────────────────────────────────────────

console.log('\n🔌 Integration APIs');

test('upwork integration API class loads', () => {
  const UpworkAPI = require('../api/integrations/upwork-api');
  assert.strictEqual(typeof UpworkAPI, 'function');
  const api = new UpworkAPI();
  assert.strictEqual(typeof api.searchJobs, 'function');
  assert.strictEqual(typeof api.submitProposal, 'function');
  assert.strictEqual(typeof api.getEarnings, 'function');
  assert.strictEqual(typeof api.healthCheck, 'function');
});

// ── Summary ─────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50));
console.log(`Phase 4 Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('═'.repeat(50));

if (failed > 0) process.exit(1);
