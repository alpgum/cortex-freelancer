# CFX-016: Load Balancer Architecture

## Overview

Multi-platform load balancing for Cortex Freelancer across Railway, Render, DigitalOcean, and Vercel using **Cloudflare Load Balancing** as the primary solution.

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │  DNS + CDN +    │
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼────────┐ ┌──▼──────────────┐
     │   Railway     │ │   Render    │ │  DigitalOcean   │
     │  (Primary)    │ │ (Secondary) │ │   (Tertiary)    │
     │  Frankfurt    │ │  Frankfurt  │ │   Amsterdam     │
     │  Port: auto   │ │  Port:10000 │ │   Port: 3847    │
     └───────────────┘ └─────────────┘ └─────────────────┘
```

## Why Cloudflare Load Balancing

| Criteria | Cloudflare | AWS ALB | Nginx/HAProxy | DNS Round Robin |
|----------|-----------|---------|---------------|-----------------|
| Multi-cloud | ✅ Native | ❌ AWS only | ⚠️ Needs hosting | ⚠️ No health checks |
| Health checks | ✅ Global | ✅ Regional | ✅ Local | ❌ None |
| WebSocket | ✅ Supported | ✅ Supported | ✅ Supported | N/A |
| DDoS protection | ✅ Included | 💰 Extra | ❌ Manual | ❌ None |
| Geographic routing | ✅ Native | ⚠️ Route53 | ❌ No | ❌ No |
| Cost | $5/mo base | $20+/mo | $5-20/mo VPS | Free |
| Setup complexity | Low | High | Medium | Low |

**Decision: Cloudflare Load Balancing** — best fit for multi-cloud with WebSocket support, built-in DDoS, and geographic routing. Already using Cloudflare for DNS (cortexfreelancer.com).

## Traffic Flow

1. `cortexfreelancer.com` → Cloudflare DNS (proxied, orange cloud)
2. Cloudflare evaluates load balancing pool health
3. Routes to healthiest origin based on priority + geographic steering
4. WebSocket connections use session affinity (IP hash)
5. Static assets served from Cloudflare CDN cache

## Pool Configuration

### Primary Pool: `railway-primary`
- **Origin:** Railway deployment URL
- **Weight:** 1.0 (receives all traffic when healthy)
- **Health check:** `GET /api/health` every 60s
- **Region:** EU West (Frankfurt)

### Secondary Pool: `render-fallback`
- **Origin:** Render deployment URL
- **Weight:** 0 (standby — only receives traffic on Railway failure)
- **Health check:** `GET /api/health` every 60s
- **Region:** EU West (Frankfurt)

### Tertiary Pool: `digitalocean-backup`
- **Origin:** DigitalOcean droplet IP
- **Weight:** 0 (last resort)
- **Health check:** `GET /api/health` every 60s
- **Region:** EU West (Amsterdam)

## Failover Strategy

```
Railway healthy? ──Yes──► Route to Railway
       │
       No
       │
Render healthy? ──Yes──► Route to Render
       │
       No
       │
DO healthy? ──Yes──► Route to DigitalOcean
       │
       No
       │
Return 503 + maintenance page (Cloudflare custom error page)
```

## WebSocket Handling

- **Session affinity:** Cloudflare "IP Hash" steering
- **Timeout:** WebSocket connections kept alive for up to 100s idle
- **Upgrade:** Cloudflare passes `Upgrade: websocket` headers natively
- **Reconnection:** Client-side reconnect logic handles failover transparently
- **Sticky sessions:** Same client IP → same origin for duration of WS session

## Geographic Routing (Phase 2)

When traffic grows, enable geo-steering:
- **EU traffic** → Railway Frankfurt / Render Frankfurt
- **MENA traffic** → DigitalOcean Amsterdam (closest)
- **US traffic** → Future US-based origin

## Vercel Edge Proxy (SSE)

Vercel remains as the **SSE edge proxy** for Server-Sent Events:
- `cortexfreelancer.com/api/stream/*` → Vercel Edge Functions
- Not part of the load balancer pool (different traffic pattern)
- Cloudflare Page Rule: bypass LB for `/api/stream/*` paths
