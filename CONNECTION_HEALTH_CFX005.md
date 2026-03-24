# CFX-005: Connection Health Monitoring

**Date:** 2026-03-25  
**Status:** ✅ Implemented  
**Builds on:** CFX-001 (keepalive fixes)

---

## What Was Added

### 1. Per-Client Health Tracking

Every WebSocket connection now gets a health record with:

| Field | Description |
|-------|-------------|
| `state` | One of: `connected`, `healthy`, `degraded`, `stale`, `dead` |
| `connectedAt` | Timestamp of initial connection |
| `lastActivity` | Last message/pong received |
| `missedPongs` | Consecutive missed WS pongs |
| `latencyMs[]` | Rolling window of last 10 ping→pong RTTs |
| `totalPings/Pongs` | Lifetime counters |
| `messagesReceived/Sent` | Application message counters |

### 2. Connection States

```
connected → healthy → degraded → dead → terminated
                  ↘ stale → cleaned up
```

- **connected**: Just connected, no ping/pong data yet
- **healthy**: Responding to pings, low latency, active
- **degraded**: 1 missed pong OR avg latency >5s
- **stale**: No activity for 5 minutes
- **dead**: 2+ consecutive missed pongs → auto-terminated

### 3. Server-Initiated Ping with Pong Timeout

- Pings sent every **20 seconds** (WS protocol-level)
- Each ping is tracked with a timestamp
- Pong responses are matched and RTT is recorded
- After **2 consecutive missed pongs**, connection is terminated
- This replaces the old simple `isAlive` boolean heartbeat

### 4. Auto-Cleanup

- **Dead connections**: Terminated immediately after MAX_MISSED_PONGS (2)
- **Stale connections**: Connections idle for >10 minutes are gracefully closed with a notification
- Cleanup sweep runs every 30 seconds

### 5. Health Metrics Logging

Every 60 seconds (when connections exist), the server logs:

```
[ws-health] connections=3 healthy=2 degraded=1
[ws-health]   203.0.113.5: degraded latency=3200ms missed=1 msgs=5/12
```

### 6. Client Health Query

Clients can request their own health status:

```json
// Send
{ "type": "health" }

// Receive
{
  "type": "health_status",
  "state": "healthy",
  "uptimeMs": 125000,
  "avgLatencyMs": 42,
  "missedPongs": 0,
  "messagesReceived": 5,
  "messagesSent": 12
}
```

### 7. HTTP Health Endpoint

`GET /ws/health` returns aggregate connection health (served via upgrade handler):

```json
{
  "totalConnections": 2,
  "byState": { "healthy": 1, "degraded": 1 },
  "connections": [
    { "ip": "127.0.0.1", "state": "healthy", "uptimeMs": 60000, "avgLatencyMs": 15, ... },
    { "ip": "203.0.113.5", "state": "degraded", "uptimeMs": 30000, "avgLatencyMs": 3200, ... }
  ]
}
```

---

## Configuration Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `HEALTH_PING_INTERVAL_MS` | 20s | Server ping frequency |
| `PONG_TIMEOUT_MS` | 10s | (Reserved for future app-level timeout) |
| `MAX_MISSED_PONGS` | 2 | Terminate after N missed pongs |
| `STALE_CONNECTION_MS` | 5 min | Mark idle connections as stale |
| `HEALTH_LOG_INTERVAL_MS` | 60s | Aggregate health log frequency |
| `CLEANUP_INTERVAL_MS` | 30s | Stale connection cleanup frequency |

---

## Files Modified

| File | Change |
|------|--------|
| `api/ws-bridge.js` | Health states, per-client tracking, cleanup timers, health endpoint |
| `test-health-monitor.js` | **New** — automated health monitoring test suite |

## How to Test

```bash
# Start the server
node server.js

# Run automated health tests (~60s, tests ping/pong, health status, cleanup)
node test-health-monitor.js

# Manual: check health via HTTP
curl http://localhost:3847/ws/health
```

## Interaction with CFX-001

CFX-001 added:
- Application-level keepalives during processing (15s)
- Client-side pings (25s)
- Reduced WS heartbeat to 20s

CFX-005 enhances this with:
- **Tracking** — every ping/pong is counted, RTT measured
- **Detection** — degraded/stale/dead states detected automatically
- **Cleanup** — dead connections terminated, stale connections closed
- **Visibility** — health logs, client health queries, HTTP endpoint
