# CFX-009: Mobile Network Testing & Optimization

**Date:** 2026-03-25  
**Status:** ✅ Implemented  
**Builds on:** CFX-001 (keepalives), CFX-004 (reconnection), CFX-005 (health monitoring), CFX-006 (timeout config), CFX-007 (error handling), CFX-008 (browser compat)

---

## Overview

Mobile users connecting from phones (4G, WiFi, switching networks) face unique WebSocket challenges that don't exist on desktop:

1. **Network switching** — WiFi↔cellular handoffs silently kill TCP connections
2. **Background suspension** — iOS Safari kills WebSocket after ~30s in background, Android Chrome throttles timers
3. **High latency** — 3G/4G networks have 50-500ms RTT vs ~5ms on wired
4. **Battery optimization** — OS-level battery savers restrict background network activity
5. **Signal variability** — Packet loss spikes during movement or weak signal

## What Was Added

### 1. Client-Side: Mobile Network Adapter (`app/js/mobile-network-adapter.js`)

A comprehensive client-side module that detects and adapts to mobile network conditions:

| Feature | Description |
|---------|-------------|
| **Network Quality Detection** | Uses `navigator.connection` API to classify: fast/medium/slow/offline |
| **WiFi↔Cellular Handoff Detection** | Monitors `connection.type` and `downlink` changes |
| **Battery Awareness** | Uses Battery API; reduces ping frequency on low battery (<15%) |
| **iOS-Specific Handling** | Timer gap detection for background suspension, touch-to-reconnect |
| **Android-Specific Handling** | Doze mode awareness, detailed network type logging |
| **Stability Scoring** | Rolling window of connect/disconnect events, 0-100 score |
| **Server Reporting** | Sends `network_info` messages so server tracks mobile clients |

#### Network Quality Profiles

| Profile | Heartbeat | Timeout | Reconnect Base | Max Retries | Trigger |
|---------|-----------|---------|----------------|-------------|---------|
| **fast** | 20s | 10s | 1s | 10 | WiFi, 4G with good signal |
| **medium** | 30s | 15s | 2s | 15 | 3G, 4G with high RTT (>500ms) |
| **slow** | 45s | 25s | 3s | 20 | 2G, very slow connections |
| **offline** | — | — | 5s | 0 | No connection detected |

#### iOS Background Handling

iOS Safari suspends WebSocket connections after ~30s in background. The adapter uses three detection methods:

1. **Visibility API** (from CFX-008's ws-visibility-bridge.js) — fires on tab switch
2. **Touch events** — if user touches screen while disconnected → instant reconnect
3. **Timer gap detection** — 1s interval timer; if >5s gap detected → was backgrounded → reconnect

#### Battery-Aware Behavior

When battery <15% and not charging:
- `fast` profile downgrades to `medium` (less frequent pings)
- Reduces unnecessary network activity to preserve battery

### 2. Server-Side: Mobile Timeout Profile

New `mobile` timeout profile in `ws-bridge.js`:

| Setting | Production | Mobile | Difference |
|---------|-----------|--------|------------|
| Keepalive | 15s | 12s | Slightly more frequent for proxy keepalive |
| Ping Interval | 20s | 25s | Less frequent to save battery |
| Pong Timeout | 10s | 15s | Generous for cellular latency spikes |
| Max Missed Pongs | 2 | 3 | More tolerant of brief drops |
| Stale Timeout | 5 min | 8 min | Mobile users background more |
| Connection Timeout | 15s | 20s | Slow handshake on cellular |
| Session Timeout | 30 min | 45 min | Longer mobile sessions |

### 3. Server-Side: Per-Client Mobile Detection

The server now detects mobile clients from User-Agent and tracks:

- `isMobile` / `isIOS` / `isAndroid` flags per connection
- `networkSwitchCount` — how many WiFi↔cellular switches the client reported
- `lastNetworkType` — last reported connection type (4g, 3g, wifi, etc.)

Mobile info appears in the `/ws/health` endpoint:

```json
{
  "connections": [{
    "ip": "203.0.113.5",
    "state": "healthy",
    "isMobile": true,
    "platform": "iOS",
    "networkSwitchCount": 2,
    "lastNetworkType": "4g"
  }]
}
```

### 4. Server-Side: Network Info Messages

Clients can send `{ type: "network_info", networkType: "4g", downlink: 10, rtt: 50 }` to report their network conditions. Server acknowledges with `{ type: "network_info_ack", profile: "mobile" }`.

### 5. Mobile Network Test Page (`tests/mobile-network-test.html`)

A full diagnostic page for testing on real devices:

| Feature | Description |
|---------|-------------|
| **Network Info Panel** | Live display of connection type, downlink, RTT, battery |
| **Stability Meter** | Visual 10-bar score of connection stability |
| **Ping/Pong Test** | 5 pings with RTT measurement |
| **Background Test** | Instructions to background the app, monitors state changes |
| **Rapid Reconnect Test** | 3 forced disconnect/reconnect cycles |
| **Message Queue Test** | Disconnect → queue message → reconnect → verify delivery |
| **Network Drop Simulation** | Force kill connection and measure recovery |
| **Quick Chat** | Send actual chat messages to verify end-to-end |

---

## Mobile Network Scenarios Covered

### ✅ 4G Connections (Varying Signal)
- Network quality detection via `navigator.connection`
- Adaptive profile (fast/medium/slow) based on RTT and downlink
- Generous pong timeout (15s) for latency spikes

### ✅ WiFi → 4G Handoffs
- `connection.change` event detection
- Pre-emptive ping to verify connection after network switch
- Auto-reconnect if connection is dead after switch
- Server-side tracking of network switch count

### ✅ Network Interruptions & Drops
- Exponential backoff reconnection (CFX-004)
- Message queue preserves unsent messages during disconnect (up to 50)
- Queue is flushed on reconnect

### ✅ High Latency / Packet Loss
- Medium profile: 15s pong timeout (vs 10s default)
- Slow profile: 25s pong timeout
- 3 missed pongs tolerated (vs 2 default)

### ✅ Background App Switching
- iOS: Timer gap detection + touch-to-reconnect
- Android: Visibility bridge (CFX-008) + focus event reconnect
- Chrome: Page Lifecycle freeze/resume (CFX-008)
- All: `online`/`offline` events for network restoration

### ✅ Battery Optimization
- Low battery (<15%) reduces to medium profile
- Charging state monitored for profile adjustment
- Less aggressive pinging on battery power

---

## Files Created/Modified

| File | Change |
|------|--------|
| `app/js/mobile-network-adapter.js` | **NEW** — Mobile network detection, adaptation, iOS/Android handlers |
| `tests/mobile-network-test.html` | **NEW** — Mobile diagnostic/test page |
| `api/ws-bridge.js` | Added mobile timeout profile, per-client mobile detection, network_info handler |
| `MOBILE_NETWORK_CFX009.md` | **NEW** — This documentation |

## Integration

Add to any page using the WebSocket stack:

```html
<script src="/app/js/ws-reconnect.js"></script>
<script src="/app/js/ws-visibility-bridge.js"></script>
<script src="/app/js/mobile-network-adapter.js"></script> <!-- NEW: CFX-009 -->
<script src="/app/js/chat-dispatcher.js"></script>
```

To use the mobile timeout profile on the server:
```bash
WS_TIMEOUT_PROFILE=mobile node server.js
```

## Testing Checklist

### Real Device Testing

- [ ] **iOS Safari** — Open test page, send message, background app for 30s, return
- [ ] **iOS Chrome** — Same flow (uses WebKit under the hood)
- [ ] **Android Chrome** — Open test page, switch to airplane mode, disable, verify reconnect
- [ ] **Android Samsung Internet** — Chromium-based, should work like Chrome
- [ ] **WiFi → Cellular** — Connect on WiFi, disable WiFi, verify reconnect via cellular
- [ ] **Cellular → WiFi** — Connect on cellular, join WiFi, verify connection stays alive
- [ ] **Low Signal** — Test in area with 1-2 bars, verify medium/slow profile activates
- [ ] **Background Long Duration** — Background for 5 minutes, return, verify reconnect

### Automated Tests (via test page)

1. Navigate to `https://your-domain/tests/mobile-network-test.html`
2. Click **Run All Tests**
3. Results should show:
   - Ping RTT < 500ms on 4G
   - Reconnect time < 5s
   - Message queue delivery after disconnect

---

## Architecture: How CFX-001 through CFX-009 Work Together

```
CFX-001: Application keepalive (15s) during OpenClaw processing
    ↓
CFX-004: Exponential backoff reconnection + message queue
    ↓
CFX-005: Server health monitoring (ping/pong tracking, state machine)
    ↓
CFX-006: Configurable timeout profiles (dev/prod/aggressive/mobile)
    ↓
CFX-007: Structured error codes with retry hints
    ↓
CFX-008: Browser visibility bridge (background tab detection)
    ↓
CFX-009: Mobile network adapter (network quality, iOS/Android specifics)

Client Load Order:
  ws-reconnect.js → ws-visibility-bridge.js → mobile-network-adapter.js → chat-dispatcher.js
```

---

*Report generated: CFX-009 Mobile Network Testing & Optimization*
*Dependencies: CFX-001, CFX-004, CFX-005, CFX-006, CFX-007, CFX-008*
