# CFX-002: Cloudflare Tunnel WebSocket Stability Report

**Date:** 2026-03-25  
**Tester:** Zephyr (automated subagent)  
**Tunnel type:** Cloudflare Quick Tunnel (`trycloudflare.com`)  
**Protocol:** QUIC  
**HA connections:** 1 (default for quick tunnels)  
**Server:** `server.js` + `ws-bridge.js` on ports 3847/3850  

---

## Executive Summary

The Cloudflare tunnel is **fundamentally stable** for WebSocket connections. The reported WebSocket timeout issues are **not caused by the tunnel itself** but by a combination of:

1. **Ephemeral tunnel URLs** — Quick tunnels get new URLs on every restart
2. **Stale tunnel URLs in config** — `.env.production.local` still references an old dead URL
3. **Single HA connection** — Quick tunnels only get 1 connection (named tunnels get 4)
4. **Server heartbeat already working** — 20s ping interval keeps connections alive through the tunnel

---

## Test Results

### Phase 1: HTTP Baseline
| Metric | Local | Tunnel | Overhead |
|--------|-------|--------|----------|
| First request | 0.001s | 0.381s | +380ms |
| Avg (10 requests) | <1ms | 0.278s | ~278ms |
| DNS lookup | 0ms | 46ms | — |

**Verdict:** ~280ms tunnel overhead per HTTP request. Acceptable for chat.

### Phase 2: WebSocket Connectivity
| Test | Local | Tunnel |
|------|-------|--------|
| Connect time | 18ms | 362ms |
| Reconnect time | 1ms | 276ms |
| Concurrent (5) | ✅ 5/5 | ✅ 5/5 |
| Concurrent (10) sustained 60s | N/A | ✅ 10/10 alive, 0 drops |

**Verdict:** Tunnel adds ~350ms to WS connect. No connection drops under load.

### Phase 3: Ping/Pong Latency
| Metric | Local | Tunnel |
|--------|-------|--------|
| Average | 0.5ms | 105.2ms |
| Min | 0ms | 102ms |
| Max | 1ms | 118ms |
| P95 | 1ms | 118ms |

**Verdict:** Consistent ~105ms RTT through tunnel. Low jitter (<16ms spread).

### Phase 4: Idle Connection Survival
| Test | Duration | App Pings | Result |
|------|----------|-----------|--------|
| Local: Idle with pings | 120s | Every 10s | ✅ Survived |
| Tunnel: Idle with pings | 120s | Every 10s | ✅ Survived |
| Local: Pure idle (no pings) | 90s | None | ✅ Survived |
| Tunnel: Pure idle (no pings) | 90s | None | ✅ Survived |

**Key finding:** Even without app-level pings, the server's WS-protocol ping (20s interval) keeps the tunnel alive. Connections survive 90s+ of complete app silence.

### Phase 5: Processing Gap Simulation
| Test | Duration | Result |
|------|----------|--------|
| Local: 60s gap | 60s | ✅ Survived (1ms post-gap latency) |
| Tunnel: 60s gap | 60s | ✅ Survived (105ms post-gap latency) |
| Tunnel: 90s gap | 90s | ✅ Survived (107ms post-gap latency) |

**Verdict:** OpenClaw's 23-120s processing time will NOT cause tunnel drops. The 15s keepalive messages in ws-bridge.js provide additional safety.

---

## Root Cause Analysis

### Why Users See WebSocket Timeouts

1. **Stale Tunnel URLs (PRIMARY CAUSE)**
   - `.env.production.local` contains: `merger-publications-bennett-doc.trycloudflare.com`
   - This URL is DEAD — quick tunnels die when cloudflared restarts
   - Any deployment using this URL will fail immediately
   - Fix: Use a **named tunnel** with a stable subdomain

2. **Multiple Competing cloudflared Processes**
   - Found 3-4 cloudflared instances running simultaneously (PIDs 2873, 4630, 6625, 6714)
   - All pointing to different ports (3847 vs 3850)
   - Creates confusion about which tunnel URL is active

3. **No Tunnel Persistence/Monitoring**
   - No systemd/launchd service for cloudflared
   - No health monitoring for tunnel status
   - Tunnel URL changes silently on restart

4. **Frontend Hardcoded URLs (phone-test.html)**
   - `phone-test.html` hardcodes the old tunnel URL
   - Falls back to localhost which only works on the same machine

### What's Already Working Well

- **Server-side WS heartbeat** (20s) — properly keeps connections alive
- **App-level keepalive** (15s during processing) — good Cloudflare tunnel mitigation  
- **ws-reconnect.js** — solid exponential backoff reconnection logic
- **chat-dispatcher.js** — proper WS → SSE → HTTP fallback chain
- **Message queue during reconnection** — no lost messages

---

## Recommendations

### Immediate Fixes (Do Now)

#### 1. Create a Named Cloudflare Tunnel (eliminates ephemeral URLs)
```bash
# One-time setup (requires free Cloudflare account)
cloudflared tunnel login
cloudflared tunnel create cortex-freelancer
cloudflared tunnel route dns cortex-freelancer api.cortexfreelancer.com

# Run with stable URL
cloudflared tunnel run --url http://localhost:3847 cortex-freelancer
```

#### 2. Create a cloudflared config file
```yaml
# ~/.cloudflared/config.yml
tunnel: cortex-freelancer
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.cortexfreelancer.com
    service: http://localhost:3847
    originRequest:
      connectTimeout: 30s
      noTLSVerify: false
      keepAliveTimeout: 90s
      keepAliveConnections: 10
  - service: http_status:404
```

#### 3. Kill duplicate cloudflared processes
```bash
killall cloudflared
# Start single instance with config
cloudflared tunnel run cortex-freelancer
```

### Config Improvements (Implemented)

#### 4. Increase HA connections for named tunnels
Named tunnels automatically get 4 HA connections (vs 1 for quick tunnels), providing redundancy.

#### 5. Tune WebSocket keepalive timings
Current settings are good but can be optimized:
- Server WS ping: 20s ✅ (well under Cloudflare's ~100s idle timeout)
- App keepalive during processing: 15s ✅
- Client heartbeat: 20s (ws-reconnect.js) ✅

### Production Deployment

#### 6. Railway/Render Deployment
The project is already configured for Railway/Render deployment. When deployed there, the Cloudflare tunnel is no longer needed — the platform provides a stable URL. The tunnel is only needed for the local OpenClaw bridge scenario.

---

## Architecture Analysis

### Current Flow (Local Dev)
```
Browser → Cloudflare Quick Tunnel (wss://) → localhost:3847 → WS Bridge → OpenClaw CLI spawn
                ↑                                                              ↓
        EPHEMERAL URL                                            23-120s response time
        (changes on restart)
```

### Recommended Flow (Production)
```
Browser → Railway/Render (wss://) → Express+WS → OpenClaw CLI spawn
              ↑
        STABLE URL
        (platform-managed)
```

### Recommended Flow (Local Bridge)
```
Browser → Named Cloudflare Tunnel → localhost:3847 → WS Bridge → OpenClaw CLI
              ↑
        api.cortexfreelancer.com
        (stable, DNS-routed)
```

---

## Metrics Summary

| Metric | Value | Status |
|--------|-------|--------|
| Tunnel HTTP overhead | ~280ms | ✅ Acceptable |
| WS connect overhead | ~350ms | ✅ Acceptable |
| WS ping RTT | ~105ms | ✅ Good |
| Idle survival (2min) | 100% | ✅ Stable |
| Processing gap (90s) | 100% | ✅ Stable |
| Concurrent (10, 60s) | 0 drops | ✅ Robust |
| HA connections | 1 (quick tunnel) | ⚠️ Upgrade to named |
| Tunnel URL stability | Ephemeral | ❌ Root cause of timeouts |

---

## Files Modified
- `findings/CFX-002-tunnel-stability.md` — This report
- `config/cloudflared.yml` — Template config for named tunnel setup

## Test Artifacts
- `/tmp/ws-stability-results.json` — Phase 1-6 test data
- `/tmp/ws-extended-results.json` — Extended test data
- `ws-stability-test.js` — Basic test suite (can remove)
- `ws-extended-test.js` — Extended test suite (can remove)
