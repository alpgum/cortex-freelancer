/**
 * CFX-002: Extended Stability Tests
 * Focus: Long-duration idle, high-connections, simulated OpenClaw processing gaps
 */

const WebSocket = require('ws');

const TUNNEL_URL = process.env.TUNNEL_URL || 'https://burst-strike-documents-beef.trycloudflare.com';
const WS_TUNNEL = TUNNEL_URL.replace('https://', 'wss://') + '/ws/chat';
const WS_LOCAL = 'ws://localhost:3847/ws/chat';

function log(msg) {
  console.log(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`);
}

// Test: Long idle with periodic health checks
function testLongIdle(url, label, durationSec = 300) {
  return new Promise((resolve) => {
    log(`${label}: Long idle test for ${durationSec}s...`);
    const ws = new WebSocket(url);
    const start = Date.now();
    const events = [];
    let lastActivity = start;
    
    ws.on('open', () => {
      events.push({ type: 'open', elapsed: 0 });
      
      // Send a ping every 30s to check if still alive
      const checker = setInterval(() => {
        const elapsed = Math.round((Date.now() - start) / 1000);
        if (elapsed >= durationSec) {
          clearInterval(checker);
          const survived = ws.readyState === 1;
          log(`${label}: Long idle result - survived=${survived}, events=${events.length}`);
          ws.close();
          resolve({ survived, events, durationSec, label });
          return;
        }
        
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'ping' }));
          events.push({ type: 'ping_sent', elapsed });
        }
      }, 30000);
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        const elapsed = Math.round((Date.now() - start) / 1000);
        lastActivity = Date.now();
        if (msg.type === 'pong') {
          events.push({ type: 'pong', elapsed });
        }
      });
    });

    ws.on('close', (code) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (elapsed < durationSec) {
        events.push({ type: 'dropped', elapsed, code });
        log(`❌ ${label}: Connection DROPPED at ${elapsed}s, code=${code}`);
        resolve({ survived: false, events, droppedAt: elapsed, label });
      }
    });
    
    ws.on('error', (err) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      events.push({ type: 'error', elapsed, message: err.message });
      log(`❌ ${label}: Error at ${elapsed}s: ${err.message}`);
    });
  });
}

// Test: Simulate OpenClaw processing gap (no app-level messages for extended period)
// Server still sends WS pings at 20s, but no app data flows
function testProcessingGap(url, label, gapSec = 60) {
  return new Promise((resolve) => {
    log(`${label}: Simulating ${gapSec}s processing gap...`);
    const ws = new WebSocket(url);
    const start = Date.now();
    
    ws.on('open', () => {
      // Send initial message
      ws.send(JSON.stringify({ type: 'ping' }));
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected' || msg.type === 'pong') {
          // Now go silent for gapSec seconds (no app messages)
          log(`${label}: Going silent for ${gapSec}s...`);
          
          setTimeout(() => {
            if (ws.readyState !== 1) {
              log(`❌ ${label}: Connection died during ${gapSec}s gap`);
              resolve({ survived: false, gapSec, label });
              return;
            }
            
            // Try sending after the gap
            const pingStart = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
            
            const handler = (data) => {
              const msg = JSON.parse(data.toString());
              if (msg.type === 'pong') {
                const latency = Date.now() - pingStart;
                log(`✅ ${label}: Survived ${gapSec}s gap, post-gap latency: ${latency}ms`);
                ws.removeListener('message', handler);
                ws.close();
                resolve({ survived: true, gapSec, postGapLatencyMs: latency, label });
              }
            };
            ws.on('message', handler);
          }, gapSec * 1000);
        }
      });
    });

    ws.on('close', (code) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      log(`❌ ${label}: Closed at ${elapsed}s, code=${code}`);
      resolve({ survived: false, gapSec, droppedAt: elapsed, closeCode: code, label });
    });
    
    ws.on('error', (err) => {
      log(`❌ ${label}: Error: ${err.message}`);
    });
    
    // Safety timeout
    setTimeout(() => {
      ws.close();
      resolve({ survived: false, error: 'timeout', label });
    }, (gapSec + 15) * 1000);
  });
}

// Test: 10 concurrent connections sustained for 60s
function testSustainedConcurrent(url, label, count = 10, durationSec = 60) {
  return new Promise(async (resolve) => {
    log(`${label}: ${count} sustained connections for ${durationSec}s...`);
    const connections = [];
    const start = Date.now();
    
    for (let i = 0; i < count; i++) {
      const ws = new WebSocket(url);
      const conn = { id: i, ws, connected: false, drops: 0, pongs: 0 };
      
      ws.on('open', () => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connected') conn.connected = true;
          if (msg.type === 'pong') conn.pongs++;
        });
      });
      
      ws.on('close', () => {
        conn.drops++;
      });
      
      connections.push(conn);
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Wait for all to connect
    await new Promise(r => setTimeout(r, 3000));
    
    const connected = connections.filter(c => c.connected).length;
    log(`${label}: ${connected}/${count} connected`);
    
    // Periodically ping all connections
    const pinger = setInterval(() => {
      connections.forEach(c => {
        if (c.ws.readyState === 1) {
          c.ws.send(JSON.stringify({ type: 'ping' }));
        }
      });
    }, 10000);
    
    // Wait for duration
    await new Promise(r => setTimeout(r, durationSec * 1000));
    clearInterval(pinger);
    
    const alive = connections.filter(c => c.ws.readyState === 1).length;
    const totalDrops = connections.reduce((s, c) => s + c.drops, 0);
    
    log(`${label}: After ${durationSec}s: ${alive}/${count} alive, ${totalDrops} drops`);
    
    // Cleanup
    connections.forEach(c => c.ws.close());
    
    resolve({ label, count, connected, alive, totalDrops, durationSec });
  });
}

// Test: Quick tunnel HA behavior (only 1 HA connection by default)
async function testTunnelHAInfo() {
  log('Checking tunnel HA configuration...');
  const { execSync } = require('child_process');
  try {
    const metrics = execSync('curl -s http://127.0.0.1:20241/metrics 2>/dev/null').toString();
    const tunnelConns = metrics.match(/cloudflared_tunnel_active_streams \d+/g);
    const haConns = metrics.match(/cloudflared_tunnel_ha_connections \d+/g);
    log(`HA connections: ${haConns || 'not found'}`);
    log(`Active streams: ${tunnelConns || 'not found'}`);
    return { tunnelConns, haConns, metricsAvailable: true };
  } catch (e) {
    log('Could not fetch cloudflared metrics');
    return { metricsAvailable: false };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('CFX-002: Extended WebSocket Stability Tests');
  console.log('='.repeat(60));

  // Check tunnel metrics
  const haInfo = await testTunnelHAInfo();

  // Test 1: Processing gaps (60s, 90s)
  log('--- Test: Processing Gap 60s ---');
  const gap60Local = await testProcessingGap(WS_LOCAL, 'LOCAL', 60);
  const gap60Tunnel = await testProcessingGap(WS_TUNNEL, 'TUNNEL', 60);

  // Test 2: Processing gap 90s (near Cloudflare's suspected timeout)
  log('--- Test: Processing Gap 90s ---');
  const gap90Tunnel = await testProcessingGap(WS_TUNNEL, 'TUNNEL', 90);

  // Test 3: 10 sustained concurrent connections for 60s
  log('--- Test: Sustained Concurrent (10 conns, 60s) ---');
  const sustained = await testSustainedConcurrent(WS_TUNNEL, 'TUNNEL', 10, 60);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('EXTENDED TEST RESULTS');
  console.log('='.repeat(60));
  console.log('\nHA Info:', JSON.stringify(haInfo, null, 2));
  console.log('\nProcessing Gap 60s:');
  console.log('  LOCAL:', gap60Local.survived ? '✅ Survived' : '❌ Failed', JSON.stringify(gap60Local));
  console.log('  TUNNEL:', gap60Tunnel.survived ? '✅ Survived' : '❌ Failed', JSON.stringify(gap60Tunnel));
  console.log('\nProcessing Gap 90s:');
  console.log('  TUNNEL:', gap90Tunnel.survived ? '✅ Survived' : '❌ Failed', JSON.stringify(gap90Tunnel));
  console.log('\nSustained 10 Concurrent (60s):');
  console.log('  TUNNEL:', JSON.stringify(sustained));

  // Save
  const fs = require('fs');
  fs.writeFileSync('/tmp/ws-extended-results.json', JSON.stringify({
    haInfo, gap60Local, gap60Tunnel, gap90Tunnel, sustained
  }, null, 2));
  console.log('\nSaved to /tmp/ws-extended-results.json');
}

main().catch(console.error);
