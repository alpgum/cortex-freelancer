# CFX-016: Load Balancer Operations Runbook

## Quick Reference

| Component | Location |
|-----------|----------|
| Cloudflare Dashboard | `dash.cloudflare.com` → Traffic → Load Balancing |
| Health endpoint | `GET /api/health` on each origin |
| Test suite | `./failover-test.sh cortexfreelancer.com` |
| Monitor dashboard | `loadbalancer/monitor-dashboard.html` |
| Config reference | `loadbalancer/cloudflare-lb-config.json` |
| Setup script | `loadbalancer/setup-cloudflare-lb.sh` |

## Architecture Summary

```
Cloudflare LB (cortexfreelancer.com)
├── Railway (Primary, weight=1.0, Frankfurt)
├── Render (Secondary/Fallback, Frankfurt)
└── DigitalOcean (Tertiary/Backup, Amsterdam)
```

- **Steering:** Priority-based (Railway first, then Render, then DO)
- **Session affinity:** IP Cookie (1800s TTL, 3600s for WebSocket)
- **Health checks:** HTTPS GET `/api/health` every 60s, expect `"status":"ok"`
- **Failover:** Automatic, adaptive routing across pools

---

## Operational Procedures

### 1. Check Current Health Status

```bash
# Quick check — all origins
for url in RAILWAY_URL RENDER_URL DO_URL; do
  echo "=== $url ==="
  curl -s "https://${url}/api/health" | jq .
done

# Or via Cloudflare dashboard:
# Traffic → Load Balancing → Pools → Health status
```

### 2. Manual Failover (Disable an Origin)

**Via Cloudflare Dashboard:**
1. Go to Traffic → Load Balancing → Pools
2. Click the pool to disable (e.g., `railway-primary`)
3. Toggle "Enabled" off
4. Traffic automatically routes to next healthy pool

**Via API:**
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/load_balancers/pools/${POOL_ID}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### 3. Add a New Origin

```bash
# 1. Create a new pool
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/load_balancers/pools" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "new-origin-name",
    "origins": [{"name": "origin-1", "address": "new-origin.example.com", "weight": 1.0}],
    "monitor": "MONITOR_ID"
  }'

# 2. Add pool to load balancer default_pools array
# Update via dashboard or PATCH the LB
```

### 4. Investigate Failover Event

When you get a notification that an origin went unhealthy:

1. **Check the origin directly:**
   ```bash
   curl -v "https://ORIGIN_URL/api/health"
   ```

2. **Check Cloudflare health logs:**
   Dashboard → Traffic → Load Balancing → Logs

3. **Common causes:**
   - Platform deployment in progress (Railway/Render redeploy)
   - Memory exceeded (check `checks.memory.percent`)
   - Event loop blocked (check `checks.eventLoop.lagMs`)
   - SSL certificate expired on origin
   - Platform outage (check status pages)

4. **Recovery:**
   - Most failovers auto-recover when health check passes again
   - Cloudflare waits for 2 consecutive healthy checks before re-adding
   - If stuck, manually toggle pool off/on

### 5. Deploy Health Endpoint to All Platforms

The health endpoint (`health-endpoint.js`) must be deployed to ALL origins:

```bash
# Copy to project API directory
cp loadbalancer/health-endpoint.js api/health.js

# For Express-based server (Railway/Render/DO):
# Add to server.js:
#   const healthCheck = require('./api/health');
#   app.get('/api/health', healthCheck);

# For Vercel:
# File at api/health.js with default export already works
```

### 6. WebSocket Failover Handling

WebSocket connections are sticky (IP Cookie affinity). When an origin goes down:

1. Existing WS connections will drop
2. Client reconnect logic should:
   - Detect disconnection
   - Wait 1-3s with exponential backoff
   - Reconnect to same URL (Cloudflare routes to new healthy origin)
3. Session state should be stored server-side (Firebase/Redis) to survive failover

**Client-side reconnect pattern:**
```javascript
let ws;
let reconnectAttempts = 0;

function connect() {
  ws = new WebSocket('wss://cortexfreelancer.com/ws/chat');
  ws.onopen = () => { reconnectAttempts = 0; };
  ws.onclose = () => {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;
    setTimeout(connect, delay);
  };
}
```

---

## Monitoring & Alerts

### Cloudflare Notifications
Set up in Cloudflare Dashboard → Notifications:
- **Pool health change** → Email + Slack webhook
- **Load balancer health** → Email alert

### Custom Monitoring
The `monitor-dashboard.html` provides a visual status page:
1. Update the `ORIGINS` array with real URLs
2. Host at `/hq/lb-monitor.html` or open locally
3. Auto-refreshes every 60s

### Key Metrics to Watch
| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Health check | 200 + `"ok"` | 200 + `"degraded"` | Non-200 or timeout |
| Response time | < 300ms | < 1000ms | > 2000ms |
| Memory | < 70% | < 90% | ≥ 90% |
| Event loop lag | < 10ms | < 50ms | > 100ms |
| Failover count/day | 0 | 1-2 | 3+ |

---

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Cloudflare LB (1 LB + 3 pools) | ~$5-15 |
| Health checks (3 origins × 60s) | Included |
| Railway hosting | $5-20 |
| Render hosting | $0-7 (free tier possible) |
| DigitalOcean droplet | $4-12 |
| **Total** | **~$14-54/mo** |

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| All origins unhealthy | Health endpoint not deployed | Deploy `health-endpoint.js` to all platforms |
| Frequent failovers | Origin instability | Check platform status pages, increase health check interval |
| WebSocket drops on failover | Expected behavior | Ensure client reconnect logic works |
| 522 errors | Origin not responding | Check origin server logs, restart if needed |
| Uneven traffic distribution | Priority steering working as designed | Switch to "random" steering for even distribution |
| Session affinity not working | Cookies blocked | Check `session_affinity: ip_cookie` is set |

---

## Files in This Directory

```
loadbalancer/
├── ARCHITECTURE.md          # Architecture design & decisions
├── RUNBOOK.md              # This file — operational procedures
├── cloudflare-lb-config.json # Cloudflare LB configuration reference
├── setup-cloudflare-lb.sh  # Automated setup via Cloudflare API
├── health-endpoint.js      # Health check endpoint (deploy to all origins)
├── failover-test.sh        # Test suite for LB verification
├── nginx-lb.conf           # Alternative: Nginx-based LB config
├── monitor-dashboard.html  # Visual health monitoring dashboard
└── state.json              # Created by setup script (IDs & state)
```
