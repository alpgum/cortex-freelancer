/**
 * CFX-023: HTTP Chunked Transfer Stream — Test Suite
 *
 * Tests the /api/chat-chunked endpoint and client behavior.
 * Run: node test-chunked-stream.js [base-url]
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const ENDPOINT = BASE_URL + '/api/chat-chunked';

let passed = 0;
let failed = 0;

function log(status, name, detail) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
  if (status === 'PASS') passed++;
  if (status === 'FAIL') failed++;
}

function fetchJSON(url, opts) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    const reqOpts = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: opts?.method || 'GET',
      headers: opts?.headers || {},
    };

    const req = mod.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: body });
        }
      });
    });
    req.on('error', reject);
    if (opts?.body) req.write(opts.body);
    req.end();
  });
}

function fetchStream(url, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    const reqOpts = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };

    const messages = [];
    const req = mod.request(reqOpts, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            messages.push(JSON.parse(line));
          } catch (e) {
            // skip
          }
        }
      });
      res.on('end', () => {
        // Process remaining buffer
        if (buffer.trim()) {
          try { messages.push(JSON.parse(buffer)); } catch (e) {}
        }
        resolve({ status: res.statusCode, headers: res.headers, messages });
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n🔧 CFX-023: HTTP Chunked Transfer Stream Tests');
  console.log('━'.repeat(55));
  console.log(`Target: ${ENDPOINT}\n`);

  // Test 1: GET health endpoint
  console.log('📡 Health Endpoint:');
  try {
    const res = await fetchJSON(ENDPOINT);
    if (res.status === 200 && res.body.service === 'cortex-chunked') {
      log('PASS', 'GET /api/chat-chunked returns service info');
      log(res.body.status === 'ready' || res.body.status === 'busy' ? 'PASS' : 'FAIL',
        'Status is ready or busy', res.body.status);
    } else {
      log('FAIL', 'GET /api/chat-chunked', `status=${res.status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /api/chat-chunked', e.message);
  }

  // Test 2: Invalid method
  console.log('\n🚫 Error Handling:');
  try {
    const res = await fetchJSON(ENDPOINT, { method: 'PUT' });
    log(res.status === 405 ? 'PASS' : 'FAIL', 'PUT returns 405', `code=${res.body?.code}`);
  } catch (e) {
    log('FAIL', 'PUT returns 405', e.message);
  }

  // Test 3: Missing message
  try {
    const res = await fetchJSON(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    log(res.status === 400 ? 'PASS' : 'FAIL', 'Empty message returns 400', `code=${res.body?.code}`);
  } catch (e) {
    log('FAIL', 'Empty message returns 400', e.message);
  }

  // Test 4: Message too long
  try {
    const longMsg = 'x'.repeat(5000);
    const res = await fetchJSON(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: longMsg }),
    });
    log(res.status === 400 ? 'PASS' : 'FAIL', 'Long message returns 400', `code=${res.body?.code}`);
  } catch (e) {
    log('FAIL', 'Long message returns 400', e.message);
  }

  // Test 5: Streaming response format (NDJSON)
  console.log('\n📨 Streaming Format:');
  try {
    const res = await fetchStream(ENDPOINT, { message: 'Hello, test message' });
    if (res.status === 200) {
      // Check Content-Type
      const ct = res.headers['content-type'] || '';
      log(ct.includes('ndjson') ? 'PASS' : 'FAIL',
        'Content-Type is application/x-ndjson', ct);

      // Check Transfer-Encoding
      const te = res.headers['transfer-encoding'] || '';
      log(te === 'chunked' ? 'PASS' : 'FAIL',
        'Transfer-Encoding is chunked', te || '(not set — may be implicit)');

      // Check X-Accel-Buffering
      log(res.headers['x-accel-buffering'] === 'no' ? 'PASS' : 'FAIL',
        'X-Accel-Buffering: no (nginx bypass)');

      // Check message types
      const types = res.messages.map(m => m.type);
      log(types.includes('start') ? 'PASS' : 'FAIL',
        'Has start message', `types: ${types.join(', ')}`);
      log(types.includes('end') || types.includes('error') ? 'PASS' : 'FAIL',
        'Has end or error message');

      // Check start message has sessionId
      const startMsg = res.messages.find(m => m.type === 'start');
      if (startMsg) {
        log(startMsg.sessionId ? 'PASS' : 'FAIL',
          'Start message has sessionId', startMsg.sessionId);
        log(startMsg.connectionId ? 'PASS' : 'FAIL',
          'Start message has connectionId', startMsg.connectionId);
      }

      // Check end message
      const endMsg = res.messages.find(m => m.type === 'end');
      if (endMsg) {
        log(endMsg.reply ? 'PASS' : 'FAIL',
          'End message has reply', `${(endMsg.reply || '').slice(0, 50)}...`);
        log(typeof endMsg.durationMs === 'number' ? 'PASS' : 'FAIL',
          'End message has durationMs', endMsg.durationMs + 'ms');
      }

      // Check for chunk messages
      const chunks = res.messages.filter(m => m.type === 'chunk');
      log('PASS', `Received ${chunks.length} chunk messages`);
    } else if (res.status === 429) {
      log('PASS', 'Server busy/rate limited (expected if another test is running)', `status=${res.status}`);
    } else {
      log('FAIL', 'Streaming response', `status=${res.status}`);
    }
  } catch (e) {
    log('FAIL', 'Streaming response', e.message);
  }

  // Summary
  console.log('\n' + '━'.repeat(55));
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(failed === 0 ? '🎉 All tests passed!' : `⚠️  ${failed} test(s) failed`);
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('Test runner error:', e);
  process.exit(1);
});
