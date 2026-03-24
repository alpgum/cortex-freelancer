# CFX-001: WebSocket Timeout Root Cause Analysis

**Date:** 2026-03-25  
**Status:** ✅ Root causes identified, fixes applied  
**Symptom:** Works locally (23s response), external users experience timeouts  

---

## Root Causes Identified

### 🔴 RC-1: Proxy Idle Timeout During OpenClaw Processing (PRIMARY)

**The Problem:**  
When a user sends a message, the server spawns `openclaw agent` which can take **23-120 seconds** before producing its first stdout chunk. During this "thinking" period, the WebSocket connection is completely idle — no data flows in either direction.

Cloudflare Quick Tunnels drop idle WebSocket connections after **~60-100 seconds**. This means:
- If OpenClaw takes >60s to start responding → tunnel drops the connection
- The client sees a timeout/disconnect, but the server-side `openclaw` process keeps running
- Even the 45s WS ping/pong heartbeat wasn't sufficient because:
  - WS-level pings may not traverse some proxy layers
  - A single missed pong cycle (45s interval) means 90s before detection

**Fix Applied:**  
Added **application-level keepalive messages** every 15 seconds during processing. The server now sends `{ type: 'keepalive', status: 'processing' }` to the client while waiting for OpenClaw's first output. This keeps the proxy connection alive because actual WebSocket frames are flowing.

### 🔴 RC-2: Port Mismatch in Test Clients

**The Problem:**  
`server.js` listens on port **3847** (`const PORT = process.env.PORT || 3847`), but both test clients (`phone-test.html`, `phone-test-mobile.html`) were configured to connect to port **3850**:
```javascript
'ws://localhost:3850/ws/chat'  // WRONG — server is on 3847
```

This means local fallback connections would always fail, making the Cloudflare tunnel the only viable path.

**Fix Applied:** Updated all local endpoints to port 3847.

### 🟡 RC-3: Heartbeat Interval Too Close to Proxy Timeout

**The Problem:**  
The WS heartbeat was set to 45 seconds. With proxy timeouts at 60-100s, this leaves only a 15-55 second margin. If a single ping is delayed or lost, the connection gets terminated.

**Fix Applied:** Reduced heartbeat interval from 45s to 20s, providing much more margin against proxy idle timeouts.

### 🟡 RC-4: No Client-Side Keepalive

**The Problem:**  
The clients relied entirely on server-side WS pings. Browser WebSocket API doesn't expose ping/pong frames, so the client had no way to keep the connection alive from its end through proxies that may not forward WS control frames.

**Fix Applied:** Added client-side application-level pings every 25 seconds:
```javascript
setInterval(() => {
    ws.send(JSON.stringify({ type: 'ping' }));
}, 25000);
```
The server already handles `type: 'ping'` and responds with `type: 'pong'`.

### 🟡 RC-5: No Reconnection Logic

**The Problem:**  
When a connection dropped, clients showed "Connection lost" and required a manual page refresh. Mobile users on flaky connections would lose their session.

**Fix Applied:** Added exponential backoff reconnection (up to 5 attempts, max 30s delay between retries).

### 🟢 RC-6: Tunnel URL Ephemerality (Informational)

Both test clients hardcode `merger-publications-bennett-doc.trycloudflare.com` — a Cloudflare Quick Tunnel URL that changes on every `cloudflared` restart. This is a deployment issue, not a code bug.

**Current State:** Two `cloudflared` processes running — one tunneling :3847, one tunneling :3850. The :3850 tunnel points to nothing (no server on that port).

---

## Timeline of a Failing External Connection (Before Fix)

```
T+0s     Client connects via Cloudflare tunnel → WS handshake ✅
T+0.1s   Client sends chat message
T+0.2s   Server spawns `openclaw agent ...`
T+0.2s   Server sends stream_start to client
T+1-30s  OpenClaw is "thinking" — NO DATA FLOWING
T+45s    Server sends WS ping frame (may not traverse proxy)
T+60-100s  Cloudflare tunnel drops idle connection ❌
T+23-120s  OpenClaw finally produces output → server tries to send → client gone
```

## Timeline After Fix

```
T+0s     Client connects via Cloudflare tunnel → WS handshake ✅
T+0.1s   Client sends chat message
T+0.2s   Server spawns `openclaw agent ...`
T+0.2s   Server sends stream_start to client
T+15s    Server sends keepalive { status: 'processing' } → proxy stays alive ✅
T+20s    Server sends WS ping frame
T+25s    Client sends application-level ping → proxy stays alive ✅
T+30s    Server sends keepalive again ✅
T+23-120s  OpenClaw produces output → streams normally to client ✅
```

---

## Files Modified

| File | Change |
|------|--------|
| `api/ws-bridge.js` | Added processing keepalive (15s), reduced heartbeat 45s→20s |
| `phone-test.html` | Fixed port 3850→3847, added client ping, reconnection, keepalive handler |
| `phone-test-mobile.html` | Same fixes as phone-test.html |

---

## Production Deployment Recommendations

1. **Use a named Cloudflare Tunnel** instead of Quick Tunnel — stable URL, survives restarts
   ```bash
   cloudflared tunnel create cortex-freelancer
   cloudflared tunnel route dns cortex-freelancer cortex.yourdomain.com
   ```

2. **Kill the stale cloudflared process** tunneling port 3850 (nothing listens there)

3. **Consider Railway/Render deployment** for always-on hosting instead of local machine + tunnel

4. **Add WebSocket compression** (`perMessageDeflate`) for mobile users on slow connections

5. **Monitor queue depth** — the single-threaded `busy` lock means concurrent users queue up. If user A's request takes 120s, user B waits 120s+ before their request even starts processing.

6. **Consider Cloudflare Tunnel WebSocket timeout settings:**
   ```bash
   cloudflared tunnel --proxy-keepalive-timeout 120s --url http://localhost:3847
   ```
