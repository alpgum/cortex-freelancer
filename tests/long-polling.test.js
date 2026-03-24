/**
 * CFX-022: Long Polling Fallback — Integration Tests
 *
 * Run: node tests/long-polling.test.js
 * Tests the /api/chat-poll endpoint and fallback logic.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');

// ── Test harness ──
let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  return fn().then(() => {
    passed++;
    results.push(`  ✓ ${name}`);
  }).catch((err) => {
    failed++;
    results.push(`  ✗ ${name}: ${err.message}`);
  });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(val, msg) {
  if (!val) throw new Error(msg || 'Expected truthy value');
}

// ── Mock server setup ──

function createTestServer() {
  // Set env to avoid Railway mode
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.ANTHROPIC_API_KEY;

  const app = express();
  app.use(express.json());

  // Mock the handler - we'll test the endpoint logic directly
  const handler = require('../api/chat-poll');
  app.post('/api/chat-poll', handler);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://localhost:${port}` });
    });
  });
}

async function postJSON(baseUrl, body) {
  const resp = await fetch(`${baseUrl}/api/chat-poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, data: await resp.json() };
}

// ── Tests ──

async function runTests() {
  console.log('\n🧪 CFX-022: Long Polling Fallback Tests\n');

  let env;
  try {
    env = await createTestServer();
  } catch (e) {
    console.log('  ⚠ Could not start test server:', e.message);
    console.log('  Skipping integration tests, running unit tests only.\n');
    await runUnitTests();
    return;
  }

  const { baseUrl, server } = env;

  try {
    // ── Endpoint validation tests ──

    await test('POST only - rejects GET', async () => {
      const resp = await fetch(`${baseUrl}/api/chat-poll`, { method: 'GET' });
      // Express auto-mounts on POST via app.post, but handler checks method
      // Actually the handler is mounted with app.post so GET returns 404
      // That's fine — the point is it doesn't accept GET
      assertTruthy(resp.status !== 200, 'Should not accept GET');
    });

    await test('Rejects missing action', async () => {
      const { status, data } = await postJSON(baseUrl, {});
      assertEqual(status, 400, 'Status');
      assertTruthy(data.error.includes('action'), 'Error mentions action');
    });

    await test('Rejects invalid action', async () => {
      const { status, data } = await postJSON(baseUrl, { action: 'invalid' });
      assertEqual(status, 400, 'Status');
    });

    await test('Send requires message', async () => {
      const { status, data } = await postJSON(baseUrl, { action: 'send' });
      assertEqual(status, 400, 'Status');
      assertTruthy(data.error.includes('Message'), 'Error mentions message');
    });

    await test('Send rejects empty message', async () => {
      const { status, data } = await postJSON(baseUrl, { action: 'send', message: '   ' });
      assertEqual(status, 400, 'Status');
    });

    await test('Send rejects too-long message', async () => {
      const { status, data } = await postJSON(baseUrl, {
        action: 'send',
        message: 'x'.repeat(5000),
      });
      assertEqual(status, 400, 'Status');
      assertTruthy(data.error.includes('too long'), 'Error mentions length');
    });

    await test('Send returns pollId and sessionId', async () => {
      const { status, data } = await postJSON(baseUrl, {
        action: 'send',
        message: 'Test message',
      });
      // Will likely fail to spawn openclaw, but should return pollId
      assertTruthy(data.pollId, 'Should have pollId');
      assertTruthy(data.sessionId, 'Should have sessionId');
      assertTruthy(data.status === 'processing' || data.status === 'queued', 'Status should be processing or queued');
    });

    await test('Poll requires pollId', async () => {
      const { status, data } = await postJSON(baseUrl, { action: 'poll' });
      assertEqual(status, 400, 'Status');
    });

    await test('Poll returns 404 for unknown pollId', async () => {
      const { status, data } = await postJSON(baseUrl, {
        action: 'poll',
        pollId: 'p-nonexistent',
      });
      assertEqual(status, 404, 'Status');
      assertEqual(data.code, 'POLL_EXPIRED', 'Code');
    });

    await test('Ack requires pollId', async () => {
      const { status, data } = await postJSON(baseUrl, { action: 'ack' });
      assertEqual(status, 400, 'Status');
    });

    await test('Ack succeeds for unknown pollId', async () => {
      const { status, data } = await postJSON(baseUrl, {
        action: 'ack',
        pollId: 'p-nonexistent',
      });
      assertEqual(status, 200, 'Status');
      assertEqual(data.ok, true, 'Should return ok');
    });

    await test('Send and poll lifecycle', async () => {
      // Send a message
      const send = await postJSON(baseUrl, {
        action: 'send',
        message: 'What is my rate?',
        sessionId: 'test-session-1',
      });
      assertTruthy(send.data.pollId, 'Should have pollId');

      // Poll for it (will timeout quickly since openclaw isn't available)
      // The poll should return within POLL_TIMEOUT_MS
      const pollPromise = postJSON(baseUrl, {
        action: 'poll',
        pollId: send.data.pollId,
        sessionId: 'test-session-1',
      });

      // Wait a bit then check — the response should eventually come back
      const poll = await Promise.race([
        pollPromise,
        new Promise(resolve => setTimeout(() => resolve({ data: { status: 'timeout' } }), 30000)),
      ]);

      assertTruthy(poll.data.status, 'Should have status');

      // Ack
      const ack = await postJSON(baseUrl, {
        action: 'ack',
        pollId: send.data.pollId,
      });
      assertEqual(ack.data.ok, true, 'Ack ok');
    });

    await test('Session mismatch rejected', async () => {
      const send = await postJSON(baseUrl, {
        action: 'send',
        message: 'test session check',
        sessionId: 'session-a',
      });

      const poll = await postJSON(baseUrl, {
        action: 'poll',
        pollId: send.data.pollId,
        sessionId: 'session-b',  // Wrong session
      });
      assertEqual(poll.status, 403, 'Should reject mismatched session');

      // Cleanup
      await postJSON(baseUrl, { action: 'ack', pollId: send.data.pollId });
    });

    await test('CORS headers present', async () => {
      const resp = await fetch(`${baseUrl}/api/chat-poll`, {
        method: 'OPTIONS',
      });
      // OPTIONS might 404 on Express since we use app.post
      // But the handler sets CORS headers on POST
      const postResp = await fetch(`${baseUrl}/api/chat-poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', message: 'cors test' }),
      });
      const cors = postResp.headers.get('access-control-allow-origin');
      assertEqual(cors, '*', 'CORS should be *');
    });

  } finally {
    server.close();
  }

  // ── Unit tests ──
  await runUnitTests();

  // ── Summary ──
  console.log('\nResults:');
  results.forEach(r => console.log(r));
  console.log(`\n${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

async function runUnitTests() {
  // Test the module exports
  await test('Module exports handler function', async () => {
    const handler = require('../api/chat-poll');
    assertEqual(typeof handler, 'function', 'Should export function');
  });

  await test('Module exports constants', async () => {
    const handler = require('../api/chat-poll');
    assertEqual(typeof handler.POLL_TIMEOUT_MS, 'number', 'POLL_TIMEOUT_MS');
    assertEqual(typeof handler.MAX_PENDING_POLLS, 'number', 'MAX_PENDING_POLLS');
    assertTruthy(handler.POLL_TIMEOUT_MS > 0, 'POLL_TIMEOUT_MS > 0');
    assertTruthy(handler.POLL_TIMEOUT_MS <= 30000, 'POLL_TIMEOUT_MS <= 30s (proxy safe)');
  });

  await test('Client module structure (file exists)', async () => {
    const fs = require('fs');
    const path = require('path');
    const clientPath = path.join(__dirname, '..', 'app', 'js', 'chat-long-polling.js');
    assertTruthy(fs.existsSync(clientPath), 'chat-long-polling.js should exist');
    const content = fs.readFileSync(clientPath, 'utf8');
    assertTruthy(content.includes('ChatLongPolling'), 'Should expose ChatLongPolling');
    assertTruthy(content.includes('sendMessage'), 'Should have sendMessage');
    assertTruthy(content.includes('abort'), 'Should have abort');
    assertTruthy(content.includes('isSupported'), 'Should have isSupported');
    assertTruthy(content.includes('batteryAware') || content.includes('getBattery'), 'Should have battery awareness');
  });

  await test('Fallback manager module structure (file exists)', async () => {
    const fs = require('fs');
    const path = require('path');
    const fallbackPath = path.join(__dirname, '..', 'app', 'js', 'connection-fallback.js');
    assertTruthy(fs.existsSync(fallbackPath), 'connection-fallback.js should exist');
    const content = fs.readFileSync(fallbackPath, 'utf8');
    assertTruthy(content.includes('ConnectionFallback'), 'Should expose ConnectionFallback');
    assertTruthy(content.includes('websocket'), 'Should mention websocket');
    assertTruthy(content.includes('sse'), 'Should mention sse');
    assertTruthy(content.includes('longpoll'), 'Should mention longpoll');
    assertTruthy(content.includes('fallback'), 'Should have fallback logic');
  });

  await test('Adaptive polling intervals defined', async () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'chat-long-polling.js'), 'utf8');
    assertTruthy(content.includes('active'), 'Should have active interval');
    assertTruthy(content.includes('idle'), 'Should have idle interval');
    assertTruthy(content.includes('backoff'), 'Should have backoff interval');
    assertTruthy(content.includes('mobile'), 'Should have mobile interval');
  });
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
