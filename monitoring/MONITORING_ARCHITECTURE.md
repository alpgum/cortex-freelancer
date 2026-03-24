# CFX-020: Monitoring Architecture

## Overview

Comprehensive monitoring for Cortex Freelancer across Railway (primary), Render (secondary), DigitalOcean (tertiary), and Vercel (SSE edge). Combines self-hosted collection with lightweight SaaS for alerting.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Monitoring Dashboard                        │
│              monitoring/dashboard.html (SPA)                  │
│  ┌────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Uptime │  │ Response   │  │  Error   │  │  Resource   │  │
│  │ Status │  │ Times      │  │  Rates   │  │  Usage      │  │
│  └────┬───┘  └─────┬──────┘  └────┬─────┘  └──────┬──────┘  │
│       │            │              │               │          │
│       └────────────┴──────┬───────┴───────────────┘          │
│                           │                                   │
│                   ┌───────▼────────┐                          │
│                   │  /api/metrics  │                          │
│                   │  (Aggregator)  │                          │
│                   └───────┬────────┘                          │
└───────────────────────────┼──────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │  Railway    │  │   Render    │  │DigitalOcean │
    │/api/health  │  │/api/health  │  │/api/health  │
    │/api/metrics │  │/api/metrics │  │/api/metrics │
    └─────────────┘  └─────────────┘  └─────────────┘
```

## Stack Decision

### Chosen: Self-hosted metrics + UptimeRobot (Free tier)

| Requirement | Solution | Cost |
|-------------|----------|------|
| Uptime monitoring | UptimeRobot (50 free monitors) | Free |
| Response time tracking | Custom `/api/metrics` endpoint | Free |
| Error rate tracking | Custom middleware + in-memory | Free |
| Resource monitoring | Node.js `process` + `os` module | Free |
| Dashboard | Static HTML SPA (served from app) | Free |
| Alerting | UptimeRobot + custom webhook | Free |
| Historical data | JSON file rotation on server | Free |
| **Total** | | **$0/mo** |

### Why not Grafana/Prometheus?
- Overkill for current scale (< 1000 DAU)
- Requires separate hosting ($5-20/mo)
- Complex setup and maintenance
- Revisit when passing 5000+ DAU

### Why not Datadog/New Relic?
- Expensive ($23+/mo per host minimum)
- Free tiers too limited for multi-platform
- Reserved for scale-up phase

## Metrics Collection

### Platform Health (per-origin)
- **Uptime:** `status` from `/api/health` (ok/degraded/unhealthy)
- **Response time:** Time to first byte on health check
- **Memory:** heap usage from `process.memoryUsage()`
- **Event loop lag:** measured via `setImmediate()` timing
- **Disk usage:** `df` command (non-serverless only)
- **CPU:** `os.loadavg()` + `process.cpuUsage()`

### Application Metrics
- **Active WebSocket connections:** tracked in WS manager
- **HTTP requests/min:** rolling window counter
- **Error rate:** 4xx and 5xx responses per minute
- **SSE connections:** active Server-Sent Event streams
- **Chat messages processed:** from chat handler counter
- **API latency P50/P95/P99:** histogram from middleware

### Business Metrics
- **Active users (daily/weekly):** from session tracking
- **Messages per user:** chat handler counter
- **Feature usage:** endpoint hit rates
- **Trial conversions:** Stripe webhook events

## Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Uptime | < 99.5% (30d) | < 99% | Page on-call |
| Response time | > 500ms P95 | > 2000ms P95 | Scale/investigate |
| Error rate (5xx) | > 1% | > 5% | Immediate investigation |
| Memory usage | > 80% | > 95% | Restart/scale |
| Event loop lag | > 50ms | > 200ms | Profile & fix |
| WebSocket conns | > 80% of limit | > 95% | Scale horizontally |
| Disk usage | > 80% | > 90% | Clean logs/data |
| CPU load avg | > 2.0 | > 4.0 | Scale up |

## Data Retention

| Granularity | Duration | Storage |
|-------------|----------|---------|
| Per-second | 1 hour | In-memory ring buffer |
| Per-minute | 24 hours | In-memory + JSON flush |
| Per-hour | 30 days | JSON file on disk |
| Per-day | 1 year | JSON file on disk |

## Integration Points

- **Cloudflare Load Balancer:** Already checks `/api/health` every 60s
- **UptimeRobot:** External monitoring + SMS/email alerts
- **Webhook alerts:** POST to configurable URL on threshold breach
- **Status page:** Public status page at `/status`
