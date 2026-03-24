/**
 * CFX-002: WebSocket Tunnel Stability Test Suite
 * Tests WebSocket connections through Cloudflare tunnel
 */

const WebSocket = require('ws');

const TUNNEL_URL = process.env.TUNNEL_URL || 'https://burst-strike-documents-beef.trycloudflare.com';
const LOCAL_URL = 'http://localhost:3847';
const WS_TUNNEL = TUNNEL_URL.replace('https://', 'wss://') + '/ws/chat';
const WS_LOCAL = 'ws://localhost:3847/ws/chat';

const results = {
  tests: [],
  summary: {}
};

function log(msg) {
  const ts = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${ts}] ${msg}`);
}

function addResult(name, passed, details) {
  results.tests.push({ name, passed, details, timestamp: new Date().toISOString() });
  log(`${passed ? '✅' : '❌'} ${name}: ${JSON.stringify(details)}`);
}

// Test 1: Basic WebSocket connection through tunnel
function testBasicConnection(url, label) {
  return new Promise((resolve) => {
    const start = Date.now();
    let connected = false;
    const ws = new WebSocket(url);
    
    const timeout = setTimeout(() => {
      if (!connected) {
        ws.close();
        addResult(`${label}: Basic Connection`, false, { error: 'Timeout after 10s' });
        resolve(false);
      }
    }, 10000);

    ws.on('open', () => {
      connected = true;
      const connectTime = Date.now() - start;
      clearTimeout(timeout);
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          addResult(`${label}: Basic Connection`, true, { connectTimeMs: connectTime, serverTimestamp: msg.timestamp });
          ws.close();
          resolve(true);
        }
      });
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      addResult(`${label}: Basic Connection`, false, { error: err.message });
      resolve(false);
    });
  });
}

// Test 2: Ping/Pong latency
function testPingLatency(url, label, count = 20) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const latencies = [];
    let pingSent = 0;
    
    ws.on('open', () => {
      // Wait for connected message
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'connected' || msg.type === 'pong') {
          if (msg.type === 'pong' && pingSent > 0) {
            latencies.push(Date.now() - pingSent);
          }
          
          if (latencies.length >= count) {
            const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            const min = Math.min(...latencies);
            const max = Math.max(...latencies);
            const p95 = latencies.sort((a, b) => a - b)[Math.floor(count * 0.95)];
            addResult(`${label}: Ping Latency (${count}x)`, true, { avgMs: avg.toFixed(1), minMs: min, maxMs: max, p95Ms: p95 });
            ws.close();
            resolve(true);
            return;
          }
          
          // Send next ping
          setTimeout(() => {
            pingSent = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }, 100);
        }
      });
    });

    ws.on('error', (err) => {
      addResult(`${label}: Ping Latency`, false, { error: err.message, completedPings: latencies.length });
      resolve(false);
    });

    setTimeout(() => {
      addResult(`${label}: Ping Latency`, false, { error: 'Timeout', completedPings: latencies.length });
      ws.close();
      resolve(false);
    }, 30000);
  });
}

// Test 3: Idle connection survival (how long before tunnel drops it)
function testIdleSurvival(url, label, durationSec = 120) {
  return new Promise((resolve) => {
    log(`${label}: Testing idle survival for ${durationSec}s...`);
    const ws = new WebSocket(url);
    const start = Date.now();
    let lastPong = null;
    let pongCount = 0;
    let drops = 0;
    const checkInterval = 10000; // Check every 10s
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'pong') {
          lastPong = Date.now();
          pongCount++;
        }
      });
      
      // Periodically send app-level pings
      const checker = setInterval(() => {
        const elapsed = Date.now() - start;
        if (elapsed >= durationSec * 1000) {
          clearInterval(checker);
          const survived = ws.readyState === WebSocket.OPEN;
          addResult(`${label}: Idle Survival (${durationSec}s)`, survived, {
            durationSec,
            survived,
            pongCount,
            drops,
            finalState: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState]
          });
          ws.close();
          resolve(survived);
          return;
        }
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else {
          drops++;
        }
      }, checkInterval);
    });

    ws.on('close', (code, reason) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (elapsed < durationSec) {
        addResult(`${label}: Idle Survival (${durationSec}s)`, false, {
          droppedAfterSec: elapsed,
          closeCode: code,
          reason: reason?.toString() || 'none',
          pongCount
        });
        resolve(false);
      }
    });

    ws.on('error', (err) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      addResult(`${label}: Idle Survival`, false, { error: err.message, afterSec: elapsed });
      resolve(false);
    });
  });
}

// Test 4: Idle connection WITHOUT app-level pings (pure idle)
function testPureIdleSurvival(url, label, durationSec = 90) {
  return new Promise((resolve) => {
    log(`${label}: Testing PURE idle (no pings) for ${durationSec}s...`);
    const ws = new WebSocket(url);
    const start = Date.now();
    
    ws.on('open', () => {
      // Do nothing — just sit idle
      ws.on('message', () => {}); // Consume but ignore
    });

    const timer = setTimeout(() => {
      const survived = ws.readyState === WebSocket.OPEN;
      addResult(`${label}: Pure Idle Survival (${durationSec}s, no pings)`, survived, {
        durationSec,
        survived,
        finalState: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState]
      });
      ws.close();
      resolve(survived);
    }, durationSec * 1000);

    ws.on('close', (code, reason) => {
      clearTimeout(timer);
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (elapsed < durationSec) {
        addResult(`${label}: Pure Idle Survival (${durationSec}s, no pings)`, false, {
          droppedAfterSec: elapsed,
          closeCode: code,
          reason: reason?.toString() || 'none'
        });
        resolve(false);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      const elapsed = Math.round((Date.now() - start) / 1000);
      addResult(`${label}: Pure Idle`, false, { error: err.message, afterSec: elapsed });
      resolve(false);
    });
  });
}

// Test 5: Concurrent connections
function testConcurrentConnections(url, label, count = 5) {
  return new Promise(async (resolve) => {
    log(`${label}: Opening ${count} concurrent connections...`);
    const connections = [];
    let connected = 0;
    let failed = 0;
    
    for (let i = 0; i < count; i++) {
      const p = new Promise((res) => {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
          ws.close();
          failed++;
          res(false);
        }, 15000);
        
        ws.on('open', () => {
          ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'connected') {
              clearTimeout(timeout);
              connected++;
              connections.push(ws);
              res(true);
            }
          });
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          failed++;
          res(false);
        });
      });
      connections.push(p);
      // Stagger slightly to avoid thundering herd
      await new Promise(r => setTimeout(r, 200));
    }
    
    await Promise.allSettled(connections);
    
    addResult(`${label}: Concurrent Connections (${count})`, failed === 0, {
      attempted: count,
      connected,
      failed,
    });
    
    // Close all
    connections.forEach(ws => {
      if (ws && ws.close) ws.close();
    });
    
    resolve(failed === 0);
  });
}

// Test 6: Reconnection after drop
function testReconnection(url, label) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    let connected = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected' && !connected) {
          connected = true;
          // Force close from client side
          ws.terminate();
          
          // Immediately try to reconnect
          const start = Date.now();
          const ws2 = new WebSocket(url);
          
          ws2.on('open', () => {
            ws2.on('message', (data2) => {
              const msg2 = JSON.parse(data2.toString());
              if (msg2.type === 'connected') {
                const reconnectTime = Date.now() - start;
                addResult(`${label}: Reconnection`, true, { reconnectTimeMs: reconnectTime });
                ws2.close();
                resolve(true);
              }
            });
          });
          
          ws2.on('error', (err) => {
            addResult(`${label}: Reconnection`, false, { error: err.message });
            resolve(false);
          });
          
          setTimeout(() => {
            addResult(`${label}: Reconnection`, false, { error: 'Reconnect timeout' });
            ws2.close();
            resolve(false);
          }, 10000);
        }
      });
    });
    
    ws.on('error', (err) => {
      addResult(`${label}: Reconnection`, false, { error: err.message });
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('CFX-002: WebSocket Tunnel Stability Test');
  console.log(`Tunnel: ${WS_TUNNEL}`);
  console.log(`Local:  ${WS_LOCAL}`);
  console.log('='.repeat(60));
  console.log('');

  // Phase 1: Basic connectivity
  log('--- Phase 1: Basic Connectivity ---');
  await testBasicConnection(WS_LOCAL, 'LOCAL');
  await testBasicConnection(WS_TUNNEL, 'TUNNEL');

  // Phase 2: Latency comparison
  log('--- Phase 2: Latency ---');
  await testPingLatency(WS_LOCAL, 'LOCAL');
  await testPingLatency(WS_TUNNEL, 'TUNNEL');

  // Phase 3: Reconnection
  log('--- Phase 3: Reconnection ---');
  await testReconnection(WS_LOCAL, 'LOCAL');
  await testReconnection(WS_TUNNEL, 'TUNNEL');

  // Phase 4: Concurrent connections
  log('--- Phase 4: Concurrent Connections ---');
  await testConcurrentConnections(WS_LOCAL, 'LOCAL', 5);
  await testConcurrentConnections(WS_TUNNEL, 'TUNNEL', 5);

  // Phase 5: Idle survival with pings
  log('--- Phase 5: Idle Survival (with app pings, 120s) ---');
  // Run local and tunnel in parallel
  await Promise.all([
    testIdleSurvival(WS_LOCAL, 'LOCAL', 120),
    testIdleSurvival(WS_TUNNEL, 'TUNNEL', 120)
  ]);

  // Phase 6: Pure idle (no pings) — this is the critical failure mode test
  log('--- Phase 6: Pure Idle (NO pings, 90s) ---');
  await Promise.all([
    testPureIdleSurvival(WS_LOCAL, 'LOCAL', 90),
    testPureIdleSurvival(WS_TUNNEL, 'TUNNEL', 90)
  ]);

  // Summary
  const passed = results.tests.filter(t => t.passed).length;
  const total = results.tests.length;
  results.summary = { passed, total, passRate: `${((passed/total)*100).toFixed(0)}%` };

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed}/${total} tests passed (${results.summary.passRate})`);
  console.log('='.repeat(60));
  results.tests.forEach(t => {
    console.log(`  ${t.passed ? '✅' : '❌'} ${t.name}`);
  });

  // Write JSON results
  const fs = require('fs');
  fs.writeFileSync('/tmp/ws-stability-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to /tmp/ws-stability-results.json');
}

runAllTests().catch(console.error);
