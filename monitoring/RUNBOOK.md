# CFX-020: Monitoring Operations Runbook

## Quick Reference

| Resource | Location |
|----------|----------|
| Ops Dashboard | `https://cortexfreelancer.com/ops/dashboard?key=<OPS_DASHBOARD_KEY>` |
| Public Status | `https://cortexfreelancer.com/status` |
| Metrics API | `GET /api/metrics?view=dashboard&key=<METRICS_API_KEY>` |
| Health Check | `GET /api/health` (each origin) |
| UptimeRobot | `https://uptimerobot.com/dashboard` |
| Alert Webhook | Configured via `ALERT_WEBHOOK_URL` env var |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `METRICS_API_KEY` | API key for `/api/metrics` endpoint | Recommended |
| `OPS_DASHBOARD_KEY` | Key for `/ops/dashboard` access | Recommended |
| `ALERT_WEBHOOK_URL` | Slack/Discord webhook for alerts | Optional |
| `ALERT_EMAIL_WEBHOOK_URL` | Email webhook (via Zapier/etc) | Optional |
| `ALERT_COOLDOWN_MS` | Alert cooldown in ms (default: 300000 = 5min) | Optional |
| `ALERTS_ENABLED` | Set to `false` to disable alerting | Optional |
| `MONITORING_ORIGINS` | JSON array of origins to monitor | Optional |
| `UPTIME_CHECK_INTERVAL_MS` | Health check interval (default: 60000) | Optional |
| `RAILWAY_HEALTH_URL` | Railway origin URL for health checks | Optional |
| `RENDER_HEALTH_URL` | Render origin URL for health checks | Optional |
| `DO_HEALTH_URL` | DigitalOcean origin URL for health checks | Optional |

## Server Integration

Add to `server.js` after existing middleware but before route mounting:

```js
// ── CFX-020: Monitoring ──
const { setupMonitoring } = require('./monitoring/setup-monitoring');
setupMonitoring(app);
```

For WebSocket integration, add to your WS handler:

```js
const metrics = app.locals.metrics;

wss.on('connection', (ws) => {
  metrics.trackWsConnect();
  ws.on('message', (msg) => {
    const start = Date.now();
    // ... handle message ...
    metrics.trackWsMessage(Date.now() - start);
  });
  ws.on('close', () => metrics.trackWsDisconnect());
});
```

## API Endpoints

### GET /api/metrics
Current metrics snapshot with system/connection/business data.

### GET /api/metrics?view=history&period=1h
Historical data. Periods: `1h`, `6h`, `24h`, `7d`, `30d`.

### GET /api/metrics?view=slow
Top 20 slowest endpoints with P50/P95/P99 latencies.

### GET /api/metrics?view=uptime
Origin health status and uptime percentages.

### GET /api/metrics?view=alerts
Active alerts, recent history, and current thresholds.

### GET /api/metrics?view=dashboard
Full payload combining all views (used by dashboard SPA).

## Alert Handling

### Alert Levels

| Level | Response Time | Action |
|-------|---------------|--------|
| Warning | < 1 hour | Investigate, plan fix |
| Critical | < 15 minutes | Immediate investigation |
| Recovery | Informational | Verify service restored |

### Common Alert Scenarios

**Error rate > 5% (Critical)**
1. Check `/api/metrics?view=slow` for failing endpoints
2. Check server logs: `railway logs` / Render dashboard / `journalctl -u cortex`
3. If one origin: let Cloudflare LB failover, investigate offline
4. If all origins: check shared dependencies (Anthropic API, Stripe, Firebase)

**Memory > 95% (Critical)**
1. Check active WebSocket/SSE connections
2. Restart affected origin if needed
3. Review for memory leaks in slow endpoint data

**Response time P95 > 2s (Critical)**
1. Check CPU load and event loop lag
2. Review `/api/metrics?view=slow` for bottleneck endpoints
3. Check external API latency (Anthropic, Stripe)
4. Consider scaling horizontally

**WebSocket connections near limit**
1. Check for stale/zombie connections (health monitor should clean these)
2. Review session affinity in Cloudflare LB
3. Consider adding capacity or adjusting max connections

## UptimeRobot Setup

### Monitors to Create (Free tier: up to 50)

1. **cortexfreelancer.com** — HTTP(s), check every 5 min
   - URL: `https://cortexfreelancer.com/api/health`
   - Keyword: `"status":"ok"`

2. **Railway Origin** — HTTP(s), check every 5 min
   - URL: `https://<railway-url>/api/health`
   - Keyword: `"status":"ok"`

3. **Render Origin** — HTTP(s), check every 5 min
   - URL: `https://cortex-freelancer.onrender.com/api/health`
   - Keyword: `"status":"ok"`

4. **DigitalOcean Origin** — HTTP(s), check every 5 min
   - URL: `https://<do-ip>:3847/api/health`
   - Keyword: `"status":"ok"`

5. **WebSocket** — Port check or keyword
   - URL: `https://cortexfreelancer.com/api/health`
   - Monitors that the main domain responds

### Alert Contacts
- Email (primary)
- SMS (critical only, if UptimeRobot Pro)
- Webhook → `ALERT_WEBHOOK_URL` (Slack/Discord)

## Incident Response

### Severity Definitions

| P1 — Outage | All origins down, users cannot access service |
|---|---|
| Response | Immediate — all hands |
| Communication | Update status page within 5 minutes |

| P2 — Degraded | Partial outage or significant performance degradation |
|---|---|
| Response | Within 30 minutes |
| Communication | Update status page within 15 minutes |

| P3 — Minor | Single origin down (LB handling failover) |
|---|---|
| Response | Within 2 hours |
| Communication | Internal only unless prolonged |

### Post-Incident
1. Update `monitoring/incidents/` with incident report
2. Review alert thresholds — were alerts timely?
3. Update runbook if new failure mode discovered
4. Commit and document any configuration changes
