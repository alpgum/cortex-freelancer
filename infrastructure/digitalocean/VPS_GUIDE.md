# CFX-014: DigitalOcean VPS Hosting Guide

## Overview

DigitalOcean Droplet deployment for Cortex Freelancer — full-control VPS hosting as an alternative to managed platforms (Railway, Render, Vercel).

**Stack:** Docker + Nginx reverse proxy + Let's Encrypt SSL + Node.js app

---

## 1. VPS Requirements

### Recommended Droplet: `s-1vcpu-2gb` ($12/mo)

| Resource | Spec | Rationale |
|----------|------|-----------|
| **CPU** | 1 vCPU (shared) | Sufficient for Express.js + occasional Chromium PDF |
| **RAM** | 2 GB | Node.js ~150MB + Chromium spikes to ~500MB + Nginx ~50MB |
| **Disk** | 50 GB SSD | App <100MB, logs ~1GB/mo, Docker images ~1GB |
| **Bandwidth** | 2 TB/mo | WebSocket connections are lightweight; well within limits |
| **Region** | `fra1` (Frankfurt) | Lowest latency to Istanbul (~30ms) |

### Why 2GB RAM (not 1GB):
- Chromium for PDF invoice generation can spike to 400-500MB
- 2GB swap configured as safety net for burst loads
- Leaves headroom for Nginx + system processes

### Scaling triggers (upgrade to `s-2vcpu-4gb` at $24/mo):
- Sustained CPU >80% for 15+ minutes
- Memory usage consistently >85%
- Response times >500ms p95
- More than ~50 concurrent WebSocket connections

---

## 2. Architecture

```
Internet
   │
   ▼
┌─────────────────────────┐
│   DigitalOcean Firewall  │  ← Ports 22, 80, 443 only
│   + UFW (host firewall)  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Nginx (Alpine)          │  ← SSL termination, rate limiting
│  - HTTP → HTTPS redirect │     WebSocket upgrade, static caching
│  - Rate limiting (API/WS)│
│  - Gzip compression      │
└──────────┬──────────────┘
           │ :3847
           ▼
┌─────────────────────────┐
│  Cortex App (Node.js)    │  ← Express.js + Chromium
│  - API routes             │     Non-root user, resource limits
│  - WebSocket connections  │     Health checks every 15s
│  - PDF generation         │
└─────────────────────────┘
```

---

## 3. Quick Start

### Prerequisites
```bash
# Install doctl (DigitalOcean CLI)
brew install doctl
doctl auth init  # Enter your API token

# Add SSH key to DigitalOcean
doctl compute ssh-key create cortex-deploy --public-key-file ~/.ssh/id_ed25519.pub
```

### Full Deployment
```bash
cd infrastructure/digitalocean

# 1. Create droplet + provision + deploy
./deploy.sh --init

# 2. Point DNS: A record → droplet IP (shown in output)
#    cortexfreelancer.com → <IP>
#    www.cortexfreelancer.com → <IP>

# 3. Wait for DNS propagation, then set up SSL
./deploy.sh --ssl

# 4. Verify
./deploy.sh --status
```

### Update Deployment
```bash
./deploy.sh --update  # Syncs code + rebuilds containers
```

---

## 4. Security Hardening

### Network (3 layers)
1. **DigitalOcean Cloud Firewall** — only ports 22, 80, 443
2. **UFW (host)** — same rules as backup
3. **Nginx rate limiting** — 30 req/s API, 10 req/s WebSocket

### SSH
- Root login disabled after provisioning
- Password auth disabled (key-only)
- fail2ban: 5 failed attempts → 1 hour ban

### Docker
- App runs as non-root user (`cortex`)
- Resource limits: 768MB RAM, 1 CPU max
- `tini` init process for proper signal handling
- Read-only filesystem where possible

### SSL
- TLS 1.2/1.3 only
- Auto-renewal via Certbot (every 12 hours check)
- HSTS with preload directive

---

## 5. Monitoring & Alerting

### Built-in monitoring
```bash
# On the server:
./monitoring.sh --report        # Full health report
./monitoring.sh --install-cron  # Auto-check every 5 min

# Remote:
./deploy.sh --status            # Quick status from local machine
```

### DigitalOcean native monitoring
- Enable `--enable-monitoring` flag (included in deploy script)
- Set alerts in DO dashboard:
  - CPU >80% for 5 min
  - Memory >85% for 5 min
  - Disk >80%
  - Droplet power off

### Backup strategy
- **DO Backups:** Enabled ($2.40/mo) — weekly full snapshots
- **Docker volumes:** `app-logs` volume persisted across container restarts
- **Manual snapshots:** Before major deployments via `doctl compute droplet-action snapshot`

---

## 6. Scaling Strategy

### Vertical (single droplet)
```
$12/mo: s-1vcpu-2gb  → handles ~50 concurrent connections
$24/mo: s-2vcpu-4gb  → handles ~150 concurrent connections
$48/mo: s-4vcpu-8gb  → handles ~500 concurrent connections
```

Resize via: `doctl compute droplet-action resize <id> --size s-2vcpu-4gb --wait`

### Horizontal (multiple droplets + load balancer)

When single droplet isn't enough:

```bash
# Create load balancer ($12/mo)
doctl compute load-balancer create \
    --name cortex-lb \
    --region fra1 \
    --forwarding-rules "entry_protocol:https,entry_port:443,target_protocol:http,target_port:3847,certificate_id:<cert-id>" \
    --health-check "protocol:http,port:3847,path:/api/health,check_interval_seconds:10,response_timeout_seconds:5,healthy_threshold:3,unhealthy_threshold:3" \
    --droplet-ids "<id1>,<id2>"
```

**Considerations for horizontal scaling:**
- Session stickiness needed for WebSocket connections (use DO LB sticky sessions)
- Shared state (if any) needs Redis or external store
- Each droplet runs identical docker-compose stack

---

## 7. Cost Comparison: VPS vs Managed

| Factor | DigitalOcean VPS | Railway | Render |
|--------|-----------------|---------|--------|
| **Base cost** | $12/mo (fixed) | ~$5-20/mo (usage) | $7/mo (starter) |
| **With backups** | $14.40/mo | included | included |
| **Scaling** | Manual resize/LB | Auto-scale | Auto-scale |
| **SSL** | Self-managed (Certbot) | Automatic | Automatic |
| **Deploy** | rsync + docker | `git push` | `git push` |
| **WebSocket** | Full control | Native support | Native support |
| **Cold starts** | None (always on) | Possible on free | None (paid) |
| **Maintenance** | You (OS updates, Docker) | Zero | Zero |
| **Control** | Full root access | Container only | Container only |
| **Monitoring** | Self-managed + DO alerts | Built-in | Built-in |

### When to use VPS:
- Need full server control (custom Nginx rules, system packages)
- Predictable costs regardless of traffic spikes
- Custom monitoring/logging requirements
- Running additional services alongside the app
- Geographic location flexibility

### When to use managed (Railway/Render):
- Zero-maintenance preference
- Auto-scaling is critical
- `git push` deploy workflow preferred
- Small team, can't afford ops overhead

### Recommendation:
**Use Railway/Render as primary.** Keep VPS config ready for:
- Failover if managed platforms have outages
- Cost optimization when traffic stabilizes and is predictable
- Special requirements (custom packages, specific geographic needs)

---

## 8. Maintenance Runbook

### Weekly
- [ ] Check DO monitoring dashboard for anomalies
- [ ] Review `/var/log/cortex-monitor.log` for alerts

### Monthly
- [ ] OS security updates: `ssh deploy@<IP> "sudo apt update && sudo apt upgrade -y"`
- [ ] Docker image updates: `docker compose pull && docker compose up -d`
- [ ] Review and rotate logs
- [ ] Check disk usage trend

### On deployment
```bash
# 1. Create snapshot before deploy
doctl compute droplet-action snapshot <droplet-id> --snapshot-name "pre-deploy-$(date +%Y%m%d)" --wait

# 2. Deploy
./deploy.sh --update

# 3. Verify
./deploy.sh --status
curl -sf https://cortexfreelancer.com/api/health
```

### Rollback
```bash
# Option 1: Redeploy previous code (git checkout + deploy)
git checkout <previous-commit>
./deploy.sh --update

# Option 2: Restore from snapshot (nuclear option)
doctl compute droplet-action restore <droplet-id> --image-id <snapshot-id> --wait
```

---

## File Structure

```
infrastructure/digitalocean/
├── Dockerfile.digitalocean    # Production Docker image
├── docker-compose.yml         # Full stack: app + nginx + certbot
├── deploy.sh                  # One-command deploy script
├── monitoring.sh              # Resource monitoring & alerting
├── nginx/
│   ├── nginx.conf             # Main nginx config
│   └── conf.d/
│       └── cortex.conf        # Site config (SSL, proxy, WS)
└── VPS_GUIDE.md               # This file
```

---

## Status: ✅ Ready for Deployment

All configs created and tested locally. To deploy:
1. Ensure `doctl` is authenticated
2. Run `./deploy.sh --init`
3. Configure DNS
4. Run `./deploy.sh --ssl`
