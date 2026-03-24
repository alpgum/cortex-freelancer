# CFX-003: Alternative Tunnel Solutions for Cortex Freelancer

> **Date:** 2026-03-25  
> **Status:** ✅ Complete  
> **Problem:** Cloudflare quick tunnel drops WebSocket connections after ~100s idle  
> **Recommendation:** **ngrok** (best WebSocket support) or **Cloudflare named tunnel with keepalive fix**

---

## Problem Analysis

The Cortex Freelancer web UI uses WebSocket (`/ws/chat`) to stream OpenClaw responses. OpenClaw CLI can take 23-120s before producing output. Cloudflare's quick tunnel (`trycloudflare.com`) has a **100-second idle timeout** on WebSocket connections — after exactly 1 minute 40 seconds of no data, the proxy drops the connection.

The current workaround in `ws-bridge.js` sends keepalive pings every 15s, but these are **application-level messages** (JSON `{ type: 'keepalive' }`), not WebSocket protocol-level pings. Cloudflare's proxy layer doesn't see application data as "activity" for its idle timeout — it tracks TCP-level activity. This means keepalives may not prevent the timeout.

### Root Cause
- Cloudflare free/pro plan: **100s WebSocket idle timeout** (non-configurable, Enterprise only)
- Quick tunnels (`trycloudflare.com`): no config file support, can't set origin parameters
- OpenClaw CLI spawn: 23-120s before first stdout byte = potential idle gap

---

## Comparison Matrix

| Feature | Cloudflare Quick Tunnel | Cloudflare Named Tunnel | ngrok (Free) | localhost.run | bore | rathole |
|---|---|---|---|---|---|---|
| **WebSocket Support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ TCP only (no HTTP upgrade) | ⚠️ TCP only |
| **WS Idle Timeout** | ❌ 100s (fixed) | ⚠️ 100s (configurable with Enterprise) | ✅ No idle timeout | ⚠️ Unknown/varies | ✅ None (raw TCP) | ✅ None (raw TCP) |
| **HTTPS** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ❌ No (TCP only) | ❌ No (TCP only) |
| **Free Tier** | ✅ Unlimited | ✅ Unlimited (needs CF account) | ⚠️ 1GB/mo, 20K req, 5K TCP | ✅ Free (limited) | ✅ Free (bore.pub) | ✅ Self-hosted only |
| **Setup Complexity** | 🟢 One command | 🟡 Account + config file | 🟡 Account + auth token | 🟢 Just SSH | 🟡 Install + run | 🔴 Need VPS + config both sides |
| **Stable URL** | ❌ Random per restart | ✅ Custom domain | ❌ Random (free) / ✅ ($8/mo) | ❌ Random | ❌ Random port | ✅ Fixed (your VPS) |
| **Reconnect** | ✅ Auto | ✅ Auto | ✅ Auto | ❌ Manual | ❌ Manual | ✅ Auto |
| **Production Ready** | ❌ No (URL changes) | ✅ Yes | ⚠️ Free tier limited | ❌ No | ❌ No | ✅ Yes (if you have VPS) |
| **Cost** | Free | Free | Free / $8/mo for stable URL | Free / $3.50/mo | Free | Free (+ VPS cost) |

---

## Detailed Analysis

### 1. Cloudflare Quick Tunnel (Current) ❌ Not Recommended

**Why it fails:**
- 100s idle timeout kills WebSocket during OpenClaw processing
- Quick tunnels don't support config files — can't set `noTLSVerify`, timeout params, etc.
- URL changes on every restart → must update Vercel env var each time
- The keepalive workaround in `ws-bridge.js` sends app-level JSON pings, but CF proxy may still count the connection as idle at TCP level

**Verdict:** Works for HTTP API calls but unreliable for WebSocket streaming.

### 2. Cloudflare Named Tunnel ⚠️ Viable with Workarounds

**How it helps:**
- Supports config file with origin parameters
- Can use `proxyType: ""` and adjust connection timeouts
- Stable URL via DNS routing

**Remaining issues:**
- The 100s idle timeout is still a Cloudflare proxy-layer limit, not a tunnel-layer limit
- Named tunnels don't bypass the CF edge proxy timeout
- Would need Enterprise plan ($200+/mo) to change WebSocket timeout

**Fix approach:** Combine named tunnel + aggressive WebSocket protocol-level pings (not just app messages):
```yaml
# ~/.cloudflared/config.yml
tunnel: openclaw-bridge
credentials-file: ~/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: bridge.yourdomain.com
    service: http://localhost:3847
    originRequest:
      connectTimeout: 120s
      noTLSVerify: true
  - service: http_status:404
```

**Verdict:** Better than quick tunnel but doesn't fully solve the WS timeout. The origin parameters control cloudflared↔origin, not client↔CF edge.

### 3. ngrok ✅ RECOMMENDED

**Why it wins:**
- **No idle timeout on endpoints** (confirmed in docs: "The free tier does NOT have timeouts on endpoints")
- Full WebSocket support with no proxy-layer interference
- Built-in request inspection dashboard at `localhost:4040`
- Auto-reconnect on network changes

**Free tier limits (manageable for Cortex):**
- 1 GB outbound data/month (streaming text = tiny bandwidth)
- 20,000 HTTP requests/month
- 5,000 TCP connections/month
- 100 TCP connections/min rate limit
- URL changes on restart (stable URL = $8/mo Personal plan)

**For Cortex Freelancer use case:**
- ~50-100 chat sessions/day × 30 days = 1,500-3,000 sessions ✅ well within 5K TCP limit
- Streaming text responses ≈ 10KB per response × 3,000 = 30MB/mo ✅ well within 1GB
- WebSocket stays alive during 23-120s OpenClaw processing ✅

**Setup:**
```bash
# One-time: create free account at ngrok.com, get auth token
ngrok config add-authtoken YOUR_TOKEN

# Start tunnel
ngrok http 3847
```

### 4. localhost.run ⚠️ Decent Fallback

**Pros:**
- Zero install — just SSH
- WebSocket supported
- No account needed for quick tunnels

**Cons:**
- Random URL on each connection
- Stability varies (community-run infrastructure)
- WebSocket idle timeout behavior undocumented
- Free tier has connection limits (not well documented)

**Setup:**
```bash
ssh -R 80:localhost:3847 nokey@localhost.run
```

**Verdict:** Good for quick testing, not reliable enough for production.

### 5. bore ❌ Not Suitable

**Why:**
- TCP-only tunnel — no HTTP/HTTPS layer
- No TLS termination — clients would need to handle raw TCP
- No WebSocket upgrade support at proxy level
- The free public server (bore.pub) exposes a random TCP port, not an HTTPS URL
- Would require reverse proxy (nginx) in front to handle TLS + WS upgrade

**Verdict:** Wrong tool for this use case. Bore is for raw TCP forwarding (databases, game servers), not web applications.

### 6. rathole ❌ Not Suitable (Without VPS)

**Why:**
- Requires a VPS/server with public IP to run the server component
- Both client and server need configuration
- TCP-level proxy — no built-in HTTPS or WS upgrade
- No hosted public relay (unlike ngrok/cloudflare)

**Verdict:** Powerful for self-hosted infrastructure but overkill and requires VPS. If Alp already had a VPS, this would be a strong option with nginx in front.

---

## Recommendation

### Primary: ngrok (Free tier)
Best WebSocket support, no idle timeouts, easy setup. Free tier is sufficient for current Cortex usage.

### Secondary: Cloudflare Named Tunnel + Protocol-Level Pings
If ngrok's 1GB/mo limit becomes an issue, switch to CF named tunnel with a proper domain. Mitigate the 100s timeout by ensuring the WebSocket server sends **protocol-level pings** (not app messages) every 30s. The `ws` library already does this via the heartbeat interval in `ws-bridge.js`.

### Long-term: Railway/Render Deployment
The real fix is deploying `server.js` to a container platform (Railway configs already exist in `railway.json` + `Dockerfile`). This eliminates the need for any tunnel — the server runs in the cloud with a stable URL and no timeout issues. This is the production path.

---

## WebSocket Keepalive Fix (Applies to ALL Tunnel Options)

The current `ws-bridge.js` has a keepalive that sends **JSON messages**. For maximum compatibility across tunnels, it should also use **WebSocket protocol-level pings**:

```javascript
// Current (application-level — some proxies don't count this as activity):
safeSend(ws, { type: 'keepalive', status: 'processing' });

// Better (protocol-level — all proxies recognize this):
ws.ping();  // WebSocket protocol ping frame
```

The heartbeat interval is already set at 20s with `ws.ping()`, but only for connection liveness detection. During active processing (when waiting for OpenClaw), the keepalive timer sends app-level messages. **Add `ws.ping()` calls alongside the app-level keepalives.**

---

## Working Configs

### ngrok Startup Script
See: `scripts/tunnel-ngrok.sh`

### Cloudflare Named Tunnel Config  
See: `config/cloudflared.yml`

### localhost.run Quick Start
```bash
ssh -R 80:localhost:3847 nokey@localhost.run
```

---

## Files Created
- `findings/CFX-003-alt-tunnels.md` — This document
- `scripts/tunnel-ngrok.sh` — ngrok tunnel startup script
- `config/cloudflared.yml` — Cloudflare named tunnel config template
- `scripts/tunnel-localhost-run.sh` — localhost.run tunnel script
