# CFX-025: WebRTC Data Channel Architecture

## Overview

WebRTC data channels provide a peer-to-peer communication alternative for Cortex Freelancer's real-time chat. When network conditions allow, data channels offer the lowest possible latency by bypassing the server for message relay.

**Status:** Implemented (experimental)  
**Priority:** Low — enhancement to existing transport stack  
**Fallback:** Automatic cascade to Socket.io → SSE → HTTP Chunked

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Transport Manager                   │
│  CortexTransport.connect() → auto-selects best      │
├──────────┬──────────┬──────────┬───────────────────┤
│ WebRTC   │ Socket.io│   SSE    │  HTTP Chunked      │
│ P1 (exp) │ P2 (prod)│ P3 (edge)│  P4 (universal)    │
└────┬─────┴─────┬────┴────┬─────┴────┬──────────────┘
     │           │         │          │
     ▼           ▼         ▼          ▼
  Data Ch.    WS/Poll    EventSrc   fetch+reader
```

### WebRTC Connection Flow

```
Browser (Initiator)                    Signaling Server               Server Relay Peer
     │                                      │                              │
     │── POST create-room ────────────────►│                              │
     │◄─ { roomId, iceServers } ───────────│                              │
     │                                      │                              │
     │  createPeerConnection()              │                              │
     │  createDataChannel('cortex-chat-v1') │                              │
     │  createOffer()                       │                              │
     │                                      │                              │
     │── POST offer { sdp } ──────────────►│                              │
     │                                      │── (relay joins room) ───────►│
     │                                      │◄─ poll → gets offer ─────────│
     │                                      │                              │
     │                                      │◄─ POST answer { sdp } ──────│
     │── poll → gets answer ──────────────►│                              │
     │                                      │                              │
     │◄──────── ICE candidates ────────────►│◄────── ICE candidates ──────►│
     │                                      │                              │
     │═══════ P2P Data Channel ═══════════════════════════════════════════│
     │                                      │                              │
     │── chat-message ─────────────────────────────────────────────────────►│
     │◄─ stream-chunk ──────────────────────────────────────────────────────│
     │◄─ stream-chunk ──────────────────────────────────────────────────────│
     │◄─ stream-end ────────────────────────────────────────────────────────│
```

### For Collaborative P2P (Browser-to-Browser)

```
Browser A (Initiator)     Signaling Server     Browser B (Responder)
     │── create-room ──────►│                        │
     │── offer ────────────►│                        │
     │                       │◄── poll (gets offer) ──│
     │                       │◄── answer ─────────────│
     │── poll (gets answer)─►│                        │
     │                       │                        │
     │═══════ Direct P2P Data Channel ═══════════════│
```

---

## Components

### 1. Signaling Server (`api/webrtc-signaling.js`)

HTTP-based signaling for WebRTC handshake. No persistent WebSocket needed.

**Actions:**
| Action | Description |
|--------|-------------|
| `create-room` | Create signaling room, get ICE config |
| `offer` | Submit SDP offer |
| `answer` | Submit SDP answer |
| `ice-candidate` | Exchange ICE candidates |
| `poll` | Long-poll for signaling messages |
| `config` | Get ICE server configuration |

**Storage:** In-memory Map (swap to Redis for multi-instance).

### 2. WebRTC Client (`app/js/webrtc-datachannel.js`)

Browser-side WebRTC data channel management.

**Features:**
- Feature detection (graceful no-op when WebRTC unavailable)
- Automatic ICE candidate gathering
- Connection timeout with fallback trigger
- Message queuing during connection
- Keep-alive ping/pong
- Detailed RTCPeerConnection stats

### 3. Transport Manager (`app/js/transport-manager.js`)

Unified API that auto-selects the best transport and cascades on failure.

**Fallback chain:** WebRTC → Socket.io → SSE → HTTP Chunked

### 4. Message Protocol (`cortex-chat-v1`)

```json
{
  "type": "chat-message | stream-chunk | stream-end | stream-error | ping | pong | typing",
  "payload": { ... },
  "id": "msg-1-abc123",
  "timestamp": 1711324800000,
  "protocol": "cortex-chat-v1"
}
```

---

## Network Requirements & Limitations

### NAT Traversal

| Scenario | Success Rate | Notes |
|----------|-------------|-------|
| Same LAN | ~100% | Direct connection, no STUN needed |
| Home NAT (cone) | ~85% | STUN usually sufficient |
| Symmetric NAT | ~30% | Needs TURN server |
| Corporate firewall | ~10-20% | Often blocked; TURN over TCP/443 helps |
| Mobile (4G/5G) | ~60-70% | Carrier-grade NAT varies |

### STUN/TURN Servers

**Included (free):**
- `stun:stun.l.google.com:19302` — Google's public STUN
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

**Recommended for production:**
- Self-hosted coturn (open source TURN server)
- Twilio TURN service ($0.40/GB)
- Cloudflare TURN (part of Calls product)

**Configuration:**
```bash
TURN_SERVER_URL=turn:turn.example.com:3478
TURN_USERNAME=cortex
TURN_CREDENTIAL=secret
```

### Browser Support

| Browser | Data Channels | Notes |
|---------|--------------|-------|
| Chrome 26+ | ✅ | Full support |
| Firefox 22+ | ✅ | Full support |
| Safari 11+ | ✅ | Full support |
| Edge 79+ | ✅ | Chromium-based |
| iOS Safari 11+ | ✅ | Works on mobile |
| Chrome Android | ✅ | Works on mobile |
| IE 11 | ❌ | Falls back to Socket.io |

---

## Trade-offs

### Advantages
- **Lowest latency** — direct P2P, no server hop
- **Reduced server load** — messages don't transit through server
- **Privacy** — data travels directly between peers (when true P2P)
- **Bandwidth** — server doesn't pay for relay bandwidth
- **Offline collaboration** — potential for LAN-only P2P without internet

### Disadvantages
- **Unreliable connectivity** — NAT/firewall dependent, ~60-85% success rate
- **Complex setup** — ICE negotiation, STUN/TURN infrastructure
- **No guaranteed delivery** — connection can fail silently
- **Server relay still needed** — for AI chat, server must bridge to Anthropic API
- **TURN costs** — relay fallback (TURN) adds infrastructure cost
- **Debugging difficulty** — P2P issues are hard to diagnose remotely

### When WebRTC Makes Sense
- ✅ Collaborative browser-to-browser features (shared editing, real-time cursors)
- ✅ Low-latency bidirectional streaming
- ✅ Users on good networks (home broadband, university)
- ❌ Corporate environments with strict firewalls
- ❌ Reliability-critical flows (use Socket.io/SSE instead)
- ❌ Simple request-response patterns (use REST)

---

## Fallback Strategy

```
connect() {
  try WebRTC (10s timeout)
    → on success: use P2P data channel
    → on failure/timeout: 
      try Socket.io
        → on success: use WebSocket with polling fallback
        → on failure:
          try SSE
            → on success: use EventSource
            → on failure:
              use HTTP Chunked Streaming (always works)
}
```

The Transport Manager handles this automatically. Users never see transport negotiation — they just get the best available connection.

---

## Files

| File | Purpose |
|------|---------|
| `api/webrtc-signaling.js` | Signaling server (HTTP-based) |
| `app/js/webrtc-datachannel.js` | Browser WebRTC client |
| `app/js/transport-manager.js` | Unified transport with fallback |
| `tests/webrtc-datachannel.test.js` | Signaling + protocol tests |
| `docs/CFX-025-WEBRTC-ARCHITECTURE.md` | This document |

---

## Future Enhancements

1. **Server-side relay peer** — Node.js process using `wrtc` npm package to be the WebRTC "peer" that bridges to Anthropic API
2. **TURN server deployment** — coturn on Docker for corporate firewall support
3. **Connection quality scoring** — auto-disable WebRTC for users with poor P2P success rates
4. **Collaborative features** — browser-to-browser P2P for shared sessions
5. **E2E encryption** — DTLS already encrypts data channels; add application-layer encryption for extra privacy
