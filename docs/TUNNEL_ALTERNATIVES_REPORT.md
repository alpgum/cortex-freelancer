# CFX-003: Tunnel Alternative Testing Report

**Date:** 2026-03-25
**Server:** Cortex Freelancer (Express + WebSocket on port 3847)
**Goal:** Find most stable tunnel for external user access with WebSocket support

---

## Test Results Summary

| Tunnel | HTTP Latency (avg) | WebSocket | WS Connect Time | Stability (HTTP) | Setup Complexity | Cost |
|---|---|---|---|---|---|---|
| **Cloudflare Quick** | ~280ms | Works (intermittent 530s) | ~310ms | 10/10 rapid, but 530 errors seen | Zero config | Free |
| **localhost.run** | ~700ms | Works | ~800ms | Stable (429s were server-side) | Zero config (SSH) | Free |
| **bore** | ~648ms | Works | ~659ms | Stable | One command | Free |
| **ngrok** | Not tested (auth required) | Not tested | N/A | N/A | Account + auth token | Free tier limited |
| **Railway** | N/A (full deploy) | Native support | N/A | Production-grade | Docker deploy | $5/mo starter |

---

## Detailed Findings

### 1. Cloudflare Quick Tunnel (Current)

**Command:** `cloudflared tunnel --url http://localhost:3847`

**Pros:**
- Fastest HTTP latency (~280ms avg)
- Fastest WebSocket connect (~310ms)
- No account needed for quick tunnels
- HTTPS with valid TLS cert
- Auto-reconnect on network changes
- Well-known, trusted infrastructure

**Cons:**
- **Intermittent 530 errors on WebSocket** - saw connection refused errors on first attempt, then 5/5 success on retry. This confirms the reported instability.
- Random URL on every restart (e.g., `caring-porter-quantum-lol.trycloudflare.com`)
- Quick tunnels have no SLA or uptime guarantee
- Named tunnels (stable URL) require Cloudflare account + DNS setup

**WebSocket Test:**
```
Attempt 1 (cold): WS ERROR: Unexpected server response: 530
Attempt 2-6 (warm): All success, ~310ms connect, ~420ms first message
```

**Verdict:** Fast but unreliable for WebSocket. The 530 errors happen intermittently, likely during tunnel connection negotiation or when Cloudflare edge rotates.

---

### 2. localhost.run (SSH Tunnel)

**Command:** `ssh -R 80:localhost:3847 nokey@localhost.run`

**Pros:**
- Zero install required (uses SSH)
- No account needed
- HTTPS with valid TLS cert
- WebSocket works reliably
- Simple one-liner

**Cons:**
- High latency (~700ms avg, 2.5x slower than Cloudflare)
- Random URL changes on reconnect (e.g., `50c8e184d1310d.lhr.life`)
- SSH connection can drop if network is flaky
- No dashboard or monitoring
- Free tier has unstated rate limits
- Persistent domains require paid account

**WebSocket Test:**
```
WS OPEN in 801ms
WS MSG [connected] in 802ms
WS MSG [stream_start] in 1119ms
```

**Verdict:** Reliable but slow. Good emergency fallback. Not ideal for production WebSocket streaming due to latency.

---

### 3. bore (Rust-based TCP tunnel)

**Command:** `bore local 3847 --to bore.pub`

**Pros:**
- Very simple setup (one command)
- WebSocket works reliably
- Open source (self-hostable)
- No account required
- Moderate latency (~648ms)
- TCP-level tunnel (protocol agnostic)

**Cons:**
- **No TLS/HTTPS** - tunnel is plain HTTP (e.g., `http://bore.pub:64508`)
- Random port assignment on every restart
- No custom domains on public server
- Less mature than Cloudflare/ngrok
- No built-in reconnection logic
- Self-hosting bore server is needed for production

**WebSocket Test:**
```
WS OPEN in 659ms
WS MSG [connected] in 787ms
WS MSG [stream_start] in 918ms
```

**Verdict:** Reliable WebSocket support, but no HTTPS is a dealbreaker for production. Great for local development/testing.

---

### 4. ngrok

**Command:** `ngrok http 3847` (requires auth)

**Pros:**
- Industry standard tunnel tool
- Dashboard with request inspection
- Stable URLs on paid plans
- WebSocket support (documented)
- Request replay, logging
- Custom domains on paid plans

**Cons:**
- **Requires free account + auth token** (not tested due to no token)
- Free plan: random URL, 1 tunnel, rate limited
- Free plan: 40 connections/minute limit
- Paid plans: $8-25/month

**Verdict:** Would need account setup to test. Known to work well with WebSocket. Best option if willing to pay for stable URLs.

---

### 5. Railway (Full Deployment)

**Status:** Already configured (railway.json + Dockerfile exist), but CLI not authenticated.

**Pros:**
- **Eliminates tunnels entirely** - server runs in the cloud
- Native WebSocket support (no proxy issues)
- Stable URL (e.g., `cortex.up.railway.app`)
- Auto-deploy from Git
- Health checks, auto-restart
- No local machine dependency

**Cons:**
- $5/mo minimum (starter plan)
- Cannot access local OpenClaw CLI (would need cloud-hosted OpenClaw)
- Deployment adds latency for code changes
- Environment variable management needed

**Verdict:** Best long-term solution IF OpenClaw can run in the cloud. Eliminates all tunnel instability.

---

## Root Cause Analysis: 429 Rate Limiting

During testing, many "failures" turned out to be the **server's own rate limiter** (in `api/middleware/rate-limit.js`), not tunnel issues. The rate limiter allows ~10 requests per window per IP, and all tunnel traffic appears as the same IP (127.0.0.1).

**Impact:** The rate limiter may be too aggressive for development/testing. Consider:
- Whitelisting `127.0.0.1` / `::1` from rate limiting
- Increasing the limit for the `/api/health` endpoint
- Using `X-Forwarded-For` header to get real client IPs through tunnels

---

## Recommendation

### Short-term (immediate stability fix): **bore + Cloudflare hybrid**

1. **Primary:** Keep Cloudflare tunnel for HTTPS + HTTP traffic
2. **WebSocket fallback:** Use bore for WebSocket connections when Cloudflare 530s occur
3. Add reconnection logic in `ws-bridge.js` client-side to retry on 530

### Medium-term: **ngrok (with free account)**

Set up an ngrok account for:
- Reliable WebSocket support
- Request inspection dashboard
- Consistent behavior

### Long-term: **Railway deployment**

Deploy the full server to Railway to eliminate tunnels entirely. This requires:
1. `railway login` and project setup
2. Moving OpenClaw to a cloud-hosted solution or API
3. Setting all environment variables

### Quick Win: Fix WebSocket reconnection

Regardless of tunnel choice, add automatic WebSocket reconnection in the client:

```javascript
// In chat-ui.js or wherever WS client lives
function connectWS(url, maxRetries = 5) {
  let retries = 0;
  function connect() {
    const ws = new WebSocket(url);
    ws.onclose = (e) => {
      if (retries < maxRetries && e.code !== 1000) {
        retries++;
        setTimeout(connect, 1000 * retries); // exponential backoff
      }
    };
    ws.onerror = () => ws.close();
    return ws;
  }
  return connect();
}
```

---

## Test Environment

- macOS Darwin 24.6.0 (Apple Silicon)
- Node.js v25.8.1
- cloudflared (homebrew)
- bore-cli 0.6.0
- ngrok 3.37.2 (installed but not authenticated)
- Server: Express 4.21.0 + ws module
