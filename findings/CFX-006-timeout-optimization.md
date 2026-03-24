# CFX-006: Network Timeout Optimization

> **Date:** 2026-03-25
> **Status:** ✅ Complete
> **Builds on:** CFX-001 (keepalive), CFX-003 (Cloudflare 100s limit), CFX-005 (health monitoring)

---

## Problem

Multiple timeout-related issues discovered across CFX-001 through CFX-005:
1. **OpenClaw spawn timeout (120s)** was too short — complex queries can take 2+ minutes
2. **Hardcoded timeouts** couldn't adapt to different tunnel/proxy environments
3. **No timeout profiles** — same config for localhost dev and Cloudflare tunnels
4. **Poor user feedback** on timeout errors — generic "unavailable" message

## Changes Made

### 1. Configurable Timeout Profiles (`ws-bridge.js`)

Three profiles available via `WS_TIMEOUT_PROFILE` env var:

| Setting | `development` | `production` | `aggressive` |
|---|---|---|---|
| **Spawn timeout** | 180s | 180s | 180s |
| **Processing keepalive** | 30s | 15s | 8s |
| **Health ping interval** | 30s | 20s | 15s |
| **Pong timeout** | 15s | 10s | 8s |
| **Max missed pongs** | 3 | 2 | 2 |
| **Stale connection** | 10 min | 5 min | 3 min |
| **Session TTL** | 1 hour | 30 min | 20 min |
| **Connection timeout** | 30s | 15s | 10s |

**When to use each:**
- `development` — Local dev, no tunnel, relaxed timings
- `production` — ngrok or direct connections (default)
- `aggressive` — Cloudflare tunnels with 100s idle timeout

### 2. Spawn Timeout Increased to 180s

Previously 120s. OpenClaw processing benchmarks:
- Simple query: 5-15s
- Medium complexity: 15-45s
- Complex with skill loading: 45-90s
- Edge case (cold start + complex): 90-150s

180s gives headroom for worst-case scenarios while still failing fast enough to be useful.

### 3. Environment Variable Overrides

Every timeout is individually configurable via env vars:
```bash
OPENCLAW_SPAWN_TIMEOUT_MS=180000
WS_PROCESSING_KEEPALIVE_MS=15000
WS_HEALTH_PING_INTERVAL_MS=20000
WS_PONG_TIMEOUT_MS=10000
WS_MAX_MISSED_PONGS=2
WS_STALE_CONNECTION_MS=300000
WS_CONNECTION_TIMEOUT_MS=15000
WS_SESSION_TIMEOUT_MS=1800000
```

These override the selected profile, allowing fine-tuning.

### 4. User-Friendly Timeout Errors

Timeout errors now show: *"Your request took too long to process. Try a shorter or simpler question, or try again in a moment."*

In development mode (`NODE_ENV=development`), the raw error detail is also included.

### 5. Health Endpoint Includes Timeout Config

`/ws/health` now returns the active timeout configuration, making it easy to verify settings remotely:
```json
{
  "timeoutConfig": {
    "profile": "production",
    "spawnTimeoutMs": 180000,
    "processingKeepaliveMs": 15000,
    "healthPingIntervalMs": 20000,
    "pongTimeoutMs": 10000,
    "staleConnectionMs": 300000
  }
}
```

### 6. Startup Logging

Server logs the active profile and key timeout values on startup:
```
✓ WebSocket bridge attached at /ws/chat (CFX-005 health + CFX-006 timeouts)
  Profile: production
  Spawn: 180s | Keepalive: 15s | Ping: 20s
```

## Files Modified
- `api/ws-bridge.js` — Timeout profiles, env overrides, improved error handling
- `.env.example` — Documented all timeout env vars

## Recommended Deployment Config

### For ngrok (current recommendation from CFX-003):
```bash
WS_TIMEOUT_PROFILE=production
# No other overrides needed — ngrok has no idle timeout
```

### For Cloudflare tunnel:
```bash
WS_TIMEOUT_PROFILE=aggressive
# 8s keepalive keeps connection alive well under CF's 100s limit
```

### For local development:
```bash
WS_TIMEOUT_PROFILE=development
# Relaxed timings, longer sessions, less log noise
```
