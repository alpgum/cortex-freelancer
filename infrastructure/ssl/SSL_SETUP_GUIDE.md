# SSL Setup Guide — Cortex Freelancer

## Quick Reference

| Platform | SSL Status | Action Needed |
|----------|-----------|---------------|
| **Vercel** | ✅ Automatic | Add custom domain in dashboard → certs auto-issued |
| **Railway** | ✅ Automatic | Add custom domain → certs auto-issued |
| **Render** | ✅ Automatic | Add custom domain → certs auto-issued |
| **DigitalOcean VPS** | 🔧 Manual | Run `certbot-init.sh` (one-time), certbot container handles renewal |

---

## 1. Vercel (Primary — Zero Config)

Vercel handles SSL automatically when you add a custom domain.

### Setup:
```bash
# Via CLI
vercel domains add cortexfreelancer.com

# Or via dashboard: Settings → Domains → Add
```

### DNS Records:
```
cortexfreelancer.com    A     76.76.21.21
www.cortexfreelancer.com CNAME cname.vercel-dns.com
```

### What Vercel provides:
- Automatic Let's Encrypt certificates
- Automatic renewal (before expiry)
- Edge SSL termination (fast TLS handshake)
- TLS 1.2 + 1.3 (no older protocols)
- HTTP/2 + HTTP/3 (QUIC) support
- HSTS via `vercel.json` headers ✅

### Headers configured in `vercel.json`:
- HSTS with `preload` ✅
- CSP ✅
- X-Content-Type-Options ✅
- X-Frame-Options ✅
- Permissions-Policy ✅

---

## 2. Railway (Fallback)

### Setup:
1. Dashboard → Project → Settings → Custom Domains
2. Add `cortexfreelancer.com`
3. Add CNAME/A record as instructed
4. Railway auto-issues Let's Encrypt cert

### Notes:
- SSL termination at Railway's edge
- Auto-renewal handled by Railway
- Security headers should be set in app's response (server.js middleware)

---

## 3. Render (Fallback)

### Setup:
1. Dashboard → Web Service → Settings → Custom Domain
2. Add domain, follow DNS instructions
3. Render auto-issues Let's Encrypt cert

### Notes:
- Same as Railway — platform-managed SSL
- Security headers in app middleware

---

## 4. DigitalOcean VPS (Self-Managed)

This is where manual SSL setup is needed.

### Initial Setup (one-time):

```bash
# SSH into VPS
ssh root@your-vps-ip

# Clone/pull the repo
cd /opt/cortex-freelancer

# Run initial cert setup
chmod +x infrastructure/ssl/certbot-init.sh
./infrastructure/ssl/certbot-init.sh cortexfreelancer.com admin@cortexfreelancer.com

# For testing first (Let's Encrypt staging):
./infrastructure/ssl/certbot-init.sh cortexfreelancer.com admin@cortexfreelancer.com staging
```

### What happens:
1. Creates certbot webroot directory
2. Generates DH parameters
3. Creates temp self-signed cert (so nginx can start)
4. Starts nginx
5. Requests real Let's Encrypt cert via HTTP-01 challenge
6. Reloads nginx with production cert

### Auto-Renewal:
The certbot container in `docker-compose.yml` runs a renewal check every 12 hours.
On success, it automatically reloads nginx via deploy hook.

### Wildcard Certificate (optional):
If you need `*.cortexfreelancer.com`:

```bash
export CF_API_TOKEN="your-cloudflare-api-token"
chmod +x infrastructure/ssl/certbot-wildcard.sh
./infrastructure/ssl/certbot-wildcard.sh cortexfreelancer.com admin@cortexfreelancer.com cloudflare
```

---

## 5. Monitoring

### Daily certificate check:
```bash
chmod +x infrastructure/ssl/ssl-monitor.sh
./infrastructure/ssl/ssl-monitor.sh --alert-days 14
```

### Add to cron:
```bash
# Daily at 06:00 UTC
0 6 * * * /opt/cortex-freelancer/infrastructure/ssl/ssl-monitor.sh --alert-days 14 --slack >> /var/log/ssl-monitor.log 2>&1
```

### SSL test suite:
```bash
chmod +x infrastructure/ssl/ssl-test.sh
./infrastructure/ssl/ssl-test.sh cortexfreelancer.com
```

---

## 6. Testing & Validation

### SSL Labs (target: A+)
```
https://www.ssllabs.com/ssltest/analyze.html?d=cortexfreelancer.com&latest
```

### Security Headers (target: A+)
```
https://securityheaders.com/?q=https://cortexfreelancer.com
```

### Manual checks:
```bash
# Certificate info
echo | openssl s_client -servername cortexfreelancer.com -connect cortexfreelancer.com:443 2>/dev/null | openssl x509 -noout -text

# TLS version
curl -sI --tlsv1.3 https://cortexfreelancer.com | head -1

# HSTS header
curl -sI https://cortexfreelancer.com | grep -i strict

# HTTP → HTTPS redirect
curl -sI http://cortexfreelancer.com | head -5
```

---

## 7. Troubleshooting

### Certificate not renewing:
```bash
# Check certbot logs
docker logs cortex-certbot

# Manual renewal test
docker compose run --rm certbot renew --dry-run

# Force renewal
docker compose run --rm certbot certonly --force-renewal \
    --webroot -w /var/www/certbot \
    -d cortexfreelancer.com -d www.cortexfreelancer.com
```

### Mixed content:
- All internal links must use `https://` or protocol-relative `//`
- Check browser console for mixed content warnings
- CSP will block mixed content by default

### HSTS preload:
Once confident, submit to HSTS preload list:
```
https://hstspreload.org/?domain=cortexfreelancer.com
```
⚠️ This is hard to undo — only submit when production is stable.

---

## Files Created (CFX-018)

```
infrastructure/ssl/
├── SSL_ARCHITECTURE.md       # Architecture overview
├── SSL_SETUP_GUIDE.md        # This file
├── nginx-ssl.conf            # Reusable SSL config snippet
├── certbot-init.sh           # Initial cert setup (one-time)
├── certbot-wildcard.sh       # Wildcard cert via DNS-01
├── certbot-renew-hook.sh     # Post-renewal deploy hook
├── ssl-monitor.sh            # Certificate monitoring & alerting
└── ssl-test.sh               # SSL configuration test suite
```

### Modified files:
- `vercel.json` — Added CSP, updated XSS-Protection, enhanced Permissions-Policy
- `docker/nginx/nginx.conf` — Added OCSP stapling, CHACHA20 cipher, CSP, enhanced headers
- `loadbalancer/nginx-lb.conf` — Added full SSL hardening + security headers
- `infrastructure/digitalocean/docker-compose.yml` — Certbot deploy hook for auto nginx reload
- `infrastructure/digitalocean/nginx/conf.d/ssl.conf` — Complete production SSL server config
