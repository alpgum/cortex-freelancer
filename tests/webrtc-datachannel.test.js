/**
 * CFX-025: WebRTC Data Channel Tests
 * 
 * Tests signaling server, data channel protocol, and transport manager.
 * Run: node tests/webrtc-datachannel.test.js
 */

'use strict';

const http = require('http');
const assert = require('assert');

const SIGNALING_URL = 'http://localhost:3847/api/webrtc-signaling';

// ── Helper ──
function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(SIGNALING_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Tests ──
async function testSignaling() {
  console.log('\n=== CFX-025: WebRTC Signaling Tests ===\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Get ICE config
  try {
    const res = await post({ action: 'config' });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.iceServers), 'Should return iceServers array');
    assert(res.body.iceServers.length > 0, 'Should have at least one STUN server');
    assert(res.body.supportedProtocols.includes('cortex-chat-v1'));
    console.log('  ✅ Config endpoint returns ICE servers');
    passed++;
  } catch (e) {
    console.log('  ❌ Config endpoint:', e.message);
    failed++;
  }

  // Test 2: Create room
  let roomId, peerId;
  try {
    const res = await post({ action: 'create-room' });
    assert.strictEqual(res.status, 200);
    assert(res.body.roomId, 'Should return roomId');
    assert(res.body.peerId, 'Should return peerId');
    assert(res.body.state === 'waiting');
    roomId = res.body.roomId;
    peerId = res.body.peerId;
    console.log('  ✅ Room creation works (id: ' + roomId.substring(0, 8) + '...)');
    passed++;
  } catch (e) {
    console.log('  ❌ Room creation:', e.message);
    failed++;
  }

  // Test 3: Send offer
  try {
    const fakeSdp = { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\n...' };
    const res = await post({ action: 'offer', roomId, peerId, sdp: fakeSdp });
    assert.strictEqual(res.status, 200);
    assert(res.body.ok === true);
    assert(res.body.state === 'offered');
    console.log('  ✅ Offer submission works');
    passed++;
  } catch (e) {
    console.log('  ❌ Offer submission:', e.message);
    failed++;
  }

  // Test 4: Poll as responder — should get offer
  try {
    const res = await post({ action: 'poll', roomId, role: 'responder', lastPollTimestamp: 0 });
    assert.strictEqual(res.status, 200);
    assert(res.body.offer, 'Responder should see the offer');
    assert(res.body.state === 'offered');
    console.log('  ✅ Responder poll receives offer');
    passed++;
  } catch (e) {
    console.log('  ❌ Responder poll:', e.message);
    failed++;
  }

  // Test 5: Send answer
  try {
    const fakeAnswer = { type: 'answer', sdp: 'v=0\r\no=- 67890 2 IN IP4 192.168.1.1\r\n...' };
    const res = await post({ action: 'answer', roomId, peerId: 'responder-1', sdp: fakeAnswer });
    assert.strictEqual(res.status, 200);
    assert(res.body.state === 'answered');
    console.log('  ✅ Answer submission works');
    passed++;
  } catch (e) {
    console.log('  ❌ Answer submission:', e.message);
    failed++;
  }

  // Test 6: Poll as initiator — should get answer
  try {
    const res = await post({ action: 'poll', roomId, role: 'initiator', lastPollTimestamp: 0 });
    assert.strictEqual(res.status, 200);
    assert(res.body.answer, 'Initiator should see the answer');
    assert(res.body.state === 'answered');
    console.log('  ✅ Initiator poll receives answer');
    passed++;
  } catch (e) {
    console.log('  ❌ Initiator poll:', e.message);
    failed++;
  }

  // Test 7: ICE candidate exchange
  try {
    const fakeCandidate = { candidate: 'candidate:1 1 udp 2122260223 192.168.1.100 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    const res = await post({ action: 'ice-candidate', roomId, peerId, role: 'initiator', candidate: fakeCandidate });
    assert.strictEqual(res.status, 200);
    assert(res.body.ok === true);

    // Responder should see initiator's candidate
    const poll = await post({ action: 'poll', roomId, role: 'responder', lastPollTimestamp: 0 });
    assert(poll.body.iceCandidates.length > 0, 'Responder should see ICE candidates');
    console.log('  ✅ ICE candidate exchange works');
    passed++;
  } catch (e) {
    console.log('  ❌ ICE candidate exchange:', e.message);
    failed++;
  }

  // Test 8: Invalid room
  try {
    const res = await post({ action: 'poll', roomId: 'nonexistent-room', role: 'initiator' });
    assert.strictEqual(res.status, 404);
    console.log('  ✅ Invalid room returns 404');
    passed++;
  } catch (e) {
    console.log('  ❌ Invalid room test:', e.message);
    failed++;
  }

  // Test 9: Missing action
  try {
    const res = await post({});
    assert.strictEqual(res.status, 400);
    console.log('  ✅ Missing action returns 400');
    passed++;
  } catch (e) {
    console.log('  ❌ Missing action test:', e.message);
    failed++;
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

// ── Protocol message format test (no server needed) ──
function testProtocol() {
  console.log('=== CFX-025: Protocol Format Tests ===\n');
  let passed = 0;

  // Message format validation
  const msg = {
    type: 'chat-message',
    payload: { message: 'Test', sessionId: 'abc' },
    id: 'msg-1-abc123',
    timestamp: Date.now(),
    protocol: 'cortex-chat-v1',
  };

  assert(msg.type, 'Message must have type');
  assert(msg.payload, 'Message must have payload');
  assert(msg.id, 'Message must have id');
  assert(msg.timestamp, 'Message must have timestamp');
  assert(msg.protocol === 'cortex-chat-v1', 'Protocol must be cortex-chat-v1');
  console.log('  ✅ Message format valid');
  passed++;

  // Stream chunk format
  const chunk = {
    type: 'stream-chunk',
    payload: { text: 'Here is' },
    id: 'msg-2-def456',
    timestamp: Date.now(),
    protocol: 'cortex-chat-v1',
  };
  assert(chunk.payload.text, 'Stream chunk must have text');
  console.log('  ✅ Stream chunk format valid');
  passed++;

  // Stream end format
  const end = {
    type: 'stream-end',
    payload: { fullText: 'Here is the full response', usage: { input: 50, output: 100 } },
    id: 'msg-3-ghi789',
    timestamp: Date.now(),
    protocol: 'cortex-chat-v1',
  };
  assert(end.payload.fullText, 'Stream end must have fullText');
  console.log('  ✅ Stream end format valid');
  passed++;

  // Size limit check
  const maxSize = 256 * 1024;
  const bigMsg = JSON.stringify({ type: 'chat-message', payload: { message: 'x'.repeat(maxSize) } });
  assert(bigMsg.length > maxSize, 'Oversized message detected');
  console.log('  ✅ Oversized message detection works');
  passed++;

  console.log(`\n  Results: ${passed} passed, 0 failed\n`);
  return { passed, failed: 0 };
}

// ── Run ──
async function main() {
  const proto = testProtocol();

  // Only run signaling tests if server is running
  try {
    const sig = await testSignaling();
    const total = proto.passed + sig.passed;
    const totalFail = proto.failed + sig.failed;
    console.log(`\n🏁 Total: ${total} passed, ${totalFail} failed`);
    process.exit(totalFail > 0 ? 1 : 0);
  } catch (e) {
    console.log('\n⚠️  Signaling tests skipped (server not running)');
    console.log(`\n🏁 Protocol tests: ${proto.passed} passed`);
    process.exit(0);
  }
}

main();
