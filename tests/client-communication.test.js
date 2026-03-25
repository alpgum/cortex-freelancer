/**
 * Tests for Client Communication Automation (CFX-064)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory for test data to avoid polluting real data
const TEST_DATA_DIR = path.join(os.tmpdir(), `cortex-comm-test-${Date.now()}`);

// Patch DATA_DIR before requiring the module
const comm = require('../src/tools/client-communication');

// Override PATHS to use temp dir
const originalPaths = { ...comm.PATHS };
for (const key of Object.keys(comm.PATHS)) {
  comm.PATHS[key] = () => path.join(TEST_DATA_DIR, `${key}.json`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function setup() {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function teardown() {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
  }
}

function readTestFile(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(TEST_DATA_DIR, `${name}.json`), 'utf8'));
  } catch {
    return null;
  }
}

// ─── Test runner (minimal, no deps) ─────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log(`    ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`    ❌ ${name}`);
    console.log(`       ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertIncludes(str, sub, msg) {
  if (!String(str).includes(sub)) throw new Error(msg || `Expected "${str}" to include "${sub}"`);
}

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg || 'Expected function to throw');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

setup();

describe('detectTone', () => {
  it('detects formal tone', () => {
    assertEqual(comm.detectTone('Dear Mr. Smith, Please find attached...'), 'formal');
  });

  it('detects casual tone', () => {
    assertEqual(comm.detectTone('Hey! That sounds awesome, cheers!'), 'casual');
  });

  it('detects technical tone', () => {
    assertEqual(comm.detectTone('The API endpoint has high latency after deploy'), 'technical');
  });

  it('returns neutral for ambiguous text', () => {
    assertEqual(comm.detectTone('Hello, I have a question.'), 'neutral');
  });

  it('returns neutral for empty input', () => {
    assertEqual(comm.detectTone(''), 'neutral');
    assertEqual(comm.detectTone(null), 'neutral');
  });
});

describe('renderTemplate', () => {
  it('replaces variables', () => {
    const result = comm.renderTemplate('Hi {{name}}, your project {{project}} is ready.', {
      name: 'Alice',
      project: 'Website'
    });
    assertEqual(result, 'Hi Alice, your project Website is ready.');
  });

  it('replaces multiple occurrences', () => {
    const result = comm.renderTemplate('{{x}} and {{x}}', { x: 'ok' });
    assertEqual(result, 'ok and ok');
  });

  it('handles missing variables gracefully', () => {
    const result = comm.renderTemplate('Hi {{name}}', {});
    assertEqual(result, 'Hi ');
  });
});

describe('formatForChannel', () => {
  it('formats for email with subject extraction', () => {
    const result = comm.formatForChannel('Hi Alice,\n\nProject update here.', 'email');
    assert(typeof result === 'object', 'Should return object for email');
    assert(result.body.includes('Project update'), 'Body should contain content');
  });

  it('formats for slack (strips formalities)', () => {
    const result = comm.formatForChannel('Dear Client,\nUpdate.\nBest regards,\nMe', 'slack');
    assert(typeof result === 'string', 'Slack format should be string');
    assert(!result.includes('Best regards,'), 'Should strip "Best regards"');
  });

  it('formats for formal letter with date', () => {
    const result = comm.formatForChannel('Dear Client,\nContent here.', 'formal-letter');
    assert(typeof result === 'string', 'Formal letter should be string');
    // Should start with a date
    assert(/^\w+ \d+, \d{4}/.test(result) || /^\d/.test(result), 'Should start with date');
  });

  it('returns text as-is for unknown channel', () => {
    const text = 'Hello there';
    assertEqual(comm.formatForChannel(text, 'unknown'), text);
  });
});

describe('scheduleMessage', () => {
  it('creates a scheduled message with defaults', () => {
    const msg = comm.scheduleMessage({
      clientId: 'client-1',
      clientName: 'Alice',
      template: 'status-update',
      variables: { statusDetails: 'Phase 1 complete.' }
    });

    assertEqual(msg.clientId, 'client-1');
    assertEqual(msg.clientName, 'Alice');
    assertEqual(msg.template, 'status-update');
    assertEqual(msg.status, 'scheduled');
    assertEqual(msg.channel, 'email');
    assert(msg.id, 'Should have an id');
    assert(msg.sendAt, 'Should have sendAt');
    assertIncludes(msg.body, 'Phase 1 complete');
  });

  it('persists to messages.json', () => {
    const msg = comm.scheduleMessage({
      clientId: 'client-2',
      template: 'meeting-request',
      variables: { topic: 'Sprint review', proposedTime: 'Monday 3pm' }
    });

    const stored = readTestFile('messages');
    assert(Array.isArray(stored), 'messages.json should be an array');
    assert(stored.some(m => m.id === msg.id), 'Message should be persisted');
  });

  it('uses specified tone', () => {
    const msg = comm.scheduleMessage({
      clientId: 'client-3',
      clientName: 'Bob',
      template: 'meeting-request',
      tone: 'casual',
      variables: { topic: 'design review', proposedTime: 'tomorrow' }
    });

    assertEqual(msg.tone, 'casual');
    assertIncludes(msg.body, 'Hey Bob');
  });

  it('throws on missing clientId', () => {
    assertThrows(() => comm.scheduleMessage({ template: 'status-update' }));
  });

  it('throws on unknown template', () => {
    assertThrows(() => comm.scheduleMessage({ clientId: 'x', template: 'nonexistent' }));
  });

  it('respects urgency=critical (sends immediately)', () => {
    const before = Date.now();
    const msg = comm.scheduleMessage({
      clientId: 'client-urgent',
      template: 'status-update',
      urgency: 'critical',
      variables: { statusDetails: 'Server down!' }
    });
    const sendAtMs = new Date(msg.sendAt).getTime();
    assert(sendAtMs - before < 5000, 'Critical should be near-immediate');
  });
});

describe('generateFollowUp', () => {
  it('generates a follow-up for an existing message', () => {
    const msg = comm.scheduleMessage({
      clientId: 'fu-client',
      clientName: 'Carol',
      template: 'feedback-request',
      variables: {}
    });

    const fu = comm.generateFollowUp({ messageId: msg.id, interval: '1d' });
    assert(fu.id, 'Follow-up should have id');
    assertEqual(fu.parentId, msg.id);
    assertEqual(fu.clientId, 'fu-client');
    assertEqual(fu.followUpNumber, 1);
    assert(fu.body, 'Should have body');
  });

  it('increments followUpCount on parent', () => {
    const msg = comm.scheduleMessage({
      clientId: 'fu-count',
      template: 'status-update',
      variables: { statusDetails: 'test' }
    });

    comm.generateFollowUp({ messageId: msg.id });
    comm.generateFollowUp({ messageId: msg.id });

    const stored = readTestFile('messages');
    const parent = stored.find(m => m.id === msg.id);
    assertEqual(parent.followUpCount, 2);
  });

  it('respects maxFollowUps limit', () => {
    const msg = comm.scheduleMessage({
      clientId: 'fu-limit',
      template: 'status-update',
      variables: { statusDetails: 'test' }
    });

    comm.generateFollowUp({ messageId: msg.id, maxFollowUps: 2 });
    comm.generateFollowUp({ messageId: msg.id, maxFollowUps: 2 });
    const third = comm.generateFollowUp({ messageId: msg.id, maxFollowUps: 2 });

    assert(third.skipped, 'Third follow-up should be skipped');
    assertIncludes(third.reason, 'Max follow-ups');
  });

  it('throws for unknown messageId', () => {
    assertThrows(() => comm.generateFollowUp({ messageId: 'nonexistent' }));
  });
});

describe('trackResponse', () => {
  it('records a response and updates message status', () => {
    const msg = comm.scheduleMessage({
      clientId: 'track-client',
      template: 'status-update',
      variables: { statusDetails: 'test' }
    });

    const resp = comm.trackResponse({ messageId: msg.id, clientId: 'track-client', notes: 'Client approved' });
    assert(resp.id, 'Response should have id');
    assertEqual(resp.clientId, 'track-client');
    assertEqual(resp.notes, 'Client approved');

    const stored = readTestFile('messages');
    const updated = stored.find(m => m.id === msg.id);
    assertEqual(updated.status, 'responded');
  });

  it('updates timing analytics', () => {
    const msg = comm.scheduleMessage({
      clientId: 'timing-client',
      template: 'status-update',
      variables: { statusDetails: 'test' },
      sendAt: new Date(Date.now() - 3600_000).toISOString() // 1 hour ago
    });

    comm.trackResponse({ messageId: msg.id, clientId: 'timing-client' });

    const timing = readTestFile('timing');
    assert(timing['timing-client'], 'Should have timing data');
    assert(timing['timing-client'].responseHours.length > 0, 'Should record response hour');
  });

  it('throws when neither messageId nor clientId provided', () => {
    assertThrows(() => comm.trackResponse({}));
  });
});

describe('analyzeClientTiming', () => {
  it('returns empty for unknown client', () => {
    const result = comm.analyzeClientTiming('unknown-client-xyz');
    assertEqual(result.bestHour, null);
    assertEqual(result.responseCount, 0);
  });

  it('computes best hour from response data', () => {
    // Seed timing data directly
    const timingFile = path.join(TEST_DATA_DIR, 'timing.json');
    const data = {
      'analyzed-client': {
        responseHours: [10, 10, 10, 14, 14, 9],
        responseTimes: [3600000, 7200000, 1800000]
      }
    };
    fs.writeFileSync(timingFile, JSON.stringify(data));

    const result = comm.analyzeClientTiming('analyzed-client');
    assertEqual(result.bestHour, 10);
    assertEqual(result.responseCount, 6);
    assert(result.avgResponseTimeMs > 0, 'Should compute avg response time');
    assert(result.hourDistribution, 'Should have hour distribution');
  });
});

describe('getReEngagementSuggestion', () => {
  it('suggests re-engagement for silent clients', () => {
    // Create a message that's old (30 days ago)
    const messagesFile = path.join(TEST_DATA_DIR, 'messages.json');
    const existing = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
    existing.push({
      id: 'old-msg',
      clientId: 'silent-client',
      clientName: 'Silent Sam',
      template: 'status-update',
      channel: 'email',
      tone: 'casual',
      body: 'test',
      sendAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      status: 'sent',
      createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      followUpCount: 0
    });
    fs.writeFileSync(messagesFile, JSON.stringify(existing));

    const suggestions = comm.getReEngagementSuggestion({ thresholdDays: 14 });
    const found = suggestions.find(s => s.clientId === 'silent-client');
    assert(found, 'Should suggest silent client');
    assert(found.silenceDays >= 29, 'Should report ~30 days');
    assertIncludes(found.suggestedMessage, 'Silent Sam');
  });

  it('returns empty when no clients are silent', () => {
    // Schedule a recent message
    comm.scheduleMessage({
      clientId: 'active-client-recent',
      template: 'status-update',
      variables: { statusDetails: 'fresh update' }
    });

    const suggestions = comm.getReEngagementSuggestion({ thresholdDays: 14 });
    const found = suggestions.find(s => s.clientId === 'active-client-recent');
    assert(!found, 'Recently active client should not appear');
  });
});

describe('batchUpdate', () => {
  it('sends to multiple clients', () => {
    const result = comm.batchUpdate({
      clientIds: ['batch-1', 'batch-2', 'batch-3'],
      template: 'status-update',
      variables: { statusDetails: 'All systems go.', clientName: 'Team' }
    });

    assertEqual(result.sent, 3);
    assertEqual(result.messages.length, 3);
    assert(result.messages.every(m => m.status === 'scheduled'));
  });

  it('throws when clientIds is empty', () => {
    assertThrows(() => comm.batchUpdate({ clientIds: [] }));
  });

  it('supports per-client variable functions', () => {
    const result = comm.batchUpdate({
      clientIds: ['fn-1', 'fn-2'],
      template: 'status-update',
      variables: (id) => ({
        clientName: id.toUpperCase(),
        statusDetails: `Update for ${id}`
      })
    });

    assertEqual(result.sent, 2);
    assertIncludes(result.messages[0].body, 'FN-1');
  });
});

describe('getPendingMessages', () => {
  it('returns only scheduled messages', () => {
    const pending = comm.getPendingMessages();
    assert(Array.isArray(pending));
    assert(pending.every(m => m.status === 'scheduled'));
  });

  it('filters by clientId', () => {
    comm.scheduleMessage({
      clientId: 'filter-test',
      template: 'thank-you',
      variables: { reason: 'the collaboration' }
    });

    const filtered = comm.getPendingMessages({ clientId: 'filter-test' });
    assert(filtered.length > 0);
    assert(filtered.every(m => m.clientId === 'filter-test'));
  });
});

describe('getAnalytics', () => {
  it('returns summary statistics', () => {
    const analytics = comm.getAnalytics();
    assert(typeof analytics.totalMessages === 'number');
    assert(typeof analytics.responseRate === 'string');
    assert(analytics.byClient, 'Should have per-client breakdown');
    assert(analytics.byChannel, 'Should have per-channel breakdown');
  });
});

describe('calculateOptimalTime', () => {
  it('returns immediate for critical urgency', () => {
    const result = comm.calculateOptimalTime({ urgency: 'critical' });
    assertIncludes(result.reason, 'Critical');
    assert(result.sendAt, 'Should have sendAt');
  });

  it('returns a future business-hour time for normal urgency', () => {
    const result = comm.calculateOptimalTime({
      clientId: 'opt-client',
      clientTimezone: '+00:00',
      urgency: 'normal'
    });
    assert(result.sendAt, 'Should have sendAt');
    assert(result.reason, 'Should have reason');
  });
});

describe('CLI handler', () => {
  it('returns help for unknown command', async () => {
    const result = await comm.handleCLI(['help']);
    assert(result.commands, 'Help should list commands');
    assert(result.templates, 'Help should list templates');
  });

  it('schedules via CLI args', async () => {
    const result = await comm.handleCLI([
      'schedule',
      '--client', 'cli-client',
      '--name', 'CLI User',
      '--template', 'thank-you',
      '--tone', 'formal',
      '--vars', '{"reason":"your patience"}'
    ]);
    assertEqual(result.clientId, 'cli-client');
    assertEqual(result.tone, 'formal');
    assertIncludes(result.body, 'your patience');
  });

  it('shows analytics via CLI', async () => {
    const result = await comm.handleCLI(['analytics']);
    assert(typeof result.totalMessages === 'number');
  });

  it('shows pending via CLI', async () => {
    const result = await comm.handleCLI(['pending']);
    assert(Array.isArray(result));
  });
});

describe('BUILTIN_TEMPLATES', () => {
  it('has all expected templates', () => {
    const expected = ['meeting-request', 'status-update', 'milestone-notification', 'feedback-request', 'thank-you', 'follow-up', 're-engagement'];
    for (const t of expected) {
      assert(comm.BUILTIN_TEMPLATES[t], `Missing template: ${t}`);
    }
  });

  it('each template has all tone variants', () => {
    const tones = ['formal', 'casual', 'technical', 'neutral'];
    for (const [name, variants] of Object.entries(comm.BUILTIN_TEMPLATES)) {
      for (const tone of tones) {
        assert(variants[tone], `Template "${name}" missing tone "${tone}"`);
      }
    }
  });
});

// ─── Summary ────────────────────────────────────────────────────────────────

teardown();

console.log(`\n  ─────────────────────────────────`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log(`\n  Failures:`);
  for (const f of failures) {
    console.log(`    • ${f.name}: ${f.error}`);
  }
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
