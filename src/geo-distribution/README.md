# CFX-048: Geographic Distribution

## Architecture

Edge proxy servers in 4 regions relay WebSocket/SSE/polling traffic to the single origin OpenClaw instance. Cloudflare Workers handle geo-routing automatically based on client location, with optional manual region override.

```
                         ┌──────────────────────┐
                         │   Cloudflare Worker   │
                         │  (Geo-Router @ Edge)  │
                         │  cf-geo-router.js     │
                         └──────────┬───────────┘
                                    │
                    Resolves nearest region via
                    cf-ipcountry / latency probes
                                    │
              ┌─────────────┬───────┴───────┬─────────────┐
              │             │               │             │
     ┌────────▼──────┐ ┌───▼──────────┐ ┌──▼──────────┐ ┌▼────────────┐
     │  EU-WEST      │ │  US-EAST     │ │  US-WEST    │ │  ASIA       │
     │  edge-proxy   │ │  edge-proxy  │ │  edge-proxy │ │  edge-proxy │
     │  Frankfurt    │ │  Virginia    │ │  Oregon     │ │  Singapore  │
     │  Railway      │ │  Render      │ │  Render     │ │  DO App     │
     │  (primary)    │ │  (free tier) │ │  (free tier)│ │  Platform   │
     └───────┬───────┘ └──────┬───────┘ └─────┬──────┘ └──────┬──────┘
              │               │               │               │
              └───────────────┴───────┬───────┴───────────────┘
                                      │
                           WebSocket / SSE / HTTP
                           relay to origin
                                      │
                             ┌────────▼────────┐
                             │  Origin Server  │
                             │  (OpenClaw)     │
                             │  Alp's machine  │
                             │  via tunnel/VPS │
                             └─────────────────┘
```

## Components

| File | Purpose |
|------|---------|
| `edge-proxy/proxy-server.js` | Edge proxy — relays WS/SSE/polling to origin |
| `edge-proxy/package.json` | Dependencies for edge proxy |
| `edge-proxy/Dockerfile` | Container for deploying edge proxies |
| `cloudflare-worker/geo-router.js` | Cloudflare Worker — routes users to nearest edge |
| `cloudflare-worker/wrangler.toml` | Wrangler config for deploying the Worker |
| `client/geo-connector.js` | Client-side SDK — auto-picks best region + manual override |
| `client/region-selector.css` | Region selector UI styles |
| `health/health-aggregator.js` | Aggregates health from all edge regions |
| `deploy/regions.json` | Region definitions (URLs, providers, coordinates) |
| `deploy/deploy-all.sh` | One-command deploy to all regions |
| `deploy/railway.json` | Railway edge proxy config |
| `deploy/render.yaml` | Render edge proxy config |
| `deploy/do-app-spec.yaml` | DigitalOcean App Platform config |
| `scripts/test-latency.sh` | Latency test across all regions |
| `scripts/warm-edges.sh` | Pre-warm edge connections after deploy |

## How It Works

### 1. Client Connection
1. Client loads `geo-connector.js`
2. On init, it fetches `/_geo/resolve` from the Cloudflare Worker
3. Worker reads `cf-ipcountry` header → maps to nearest region
4. Returns edge URL + all region URLs for fallback
5. Client connects to recommended edge via WebSocket (or SSE/polling fallback)

### 2. Edge Proxy
1. Accepts client WS/SSE/HTTP connections
2. Opens upstream WS to the origin OpenClaw server
3. Bidirectionally relays messages with minimal overhead
4. Handles reconnection, buffering, and health reporting
5. Adds `X-Edge-Region` header for observability

### 3. Failover
1. If the connected edge goes down, client auto-reconnects to next-closest region
2. Health aggregator continuously checks all edges
3. Cloudflare Worker excludes unhealthy edges from routing

### 4. Manual Override
- User can click region selector in chat UI to force a specific region
- Stored in `localStorage` — persists across sessions
- Useful for testing or when auto-detection is wrong

## Deployment

### Prerequisites
- Node.js 18+
- Cloudflare account (free plan works for Workers)
- `wrangler` CLI (`npm install -g wrangler`)
- Railway CLI, Render dashboard, or DO CLI for edge proxies

### Quick Start

```bash
# 1. Configure origin URL
export ORIGIN_URL="wss://your-openclaw-origin.example.com"

# 2. Deploy Cloudflare Worker (geo-router)
cd cloudflare-worker
wrangler publish

# 3. Deploy edge proxies to all regions
cd ../deploy
chmod +x deploy-all.sh
./deploy-all.sh

# 4. Test latency from your location
cd ../scripts
chmod +x test-latency.sh
./test-latency.sh
```

### Per-Region Deployment

| Region | Provider | Deploy Command | Free Tier |
|--------|----------|---------------|-----------|
| EU-West | Railway | `railway up` in edge-proxy/ | $5/mo credit |
| US-East | Render | Push to render branch | ✅ Free |
| US-West | Render | Push to render branch (west) | ✅ Free |
| Asia | DO App Platform | `doctl apps create` | $5/mo |

### Environment Variables (per edge proxy)

| Variable | Required | Description |
|----------|----------|-------------|
| `ORIGIN_URL` | ✅ | Origin OpenClaw WebSocket URL |
| `EDGE_REGION` | ✅ | Region identifier (eu-west, us-east, us-west, asia) |
| `PORT` | ❌ | Listen port (default: 3000, auto-set by platforms) |
| `HEALTH_CHECK_INTERVAL` | ❌ | Origin health check interval ms (default: 30000) |
| `MAX_CONNECTIONS` | ❌ | Max concurrent proxy connections (default: 1000) |
| `ORIGIN_API_KEY` | ❌ | API key for origin authentication |

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Cloudflare Worker | Free (100k req/day) |
| EU-West (Railway) | ~$0 (existing deployment) |
| US-East (Render) | $0 (free tier) |
| US-West (Render) | $0 (free tier) |
| Asia (DO) | ~$5 |
| **Total** | **~$5/mo** |

## Monitoring

- Each edge exposes `/health` with origin connectivity status
- Health aggregator polls all edges and provides unified status
- Cloudflare Worker dashboard shows routing distribution
- Client-side `geo-connector.js` reports connection metrics via `onMetrics` callback
