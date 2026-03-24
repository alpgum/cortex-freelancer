# SSL Architecture — Cortex Freelancer

## Platform SSL Strategy

| Platform | SSL Provider | Certificate Type | Renewal | Notes |
|----------|-------------|-----------------|---------|-------|
| **Vercel** (primary) | Automatic (Let's Encrypt) | Individual per domain | Auto | Zero config, edge SSL termination |
| **Railway** (fallback) | Automatic (Let's Encrypt) | Individual per domain | Auto | Managed via dashboard custom domains |
| **Render** (fallback) | Automatic (Let's Encrypt) | Individual per domain | Auto | Auto-issued on custom domain add |
| **DigitalOcean VPS** | Certbot (Let's Encrypt) | Wildcard + individual | Cron-based auto | Self-managed, Docker certbot sidecar |
| **Cloudflare** (CDN/LB) | Cloudflare Universal SSL | Edge + Origin certs | Auto | Full (Strict) mode recommended |

## Domain Architecture

```
cortexfreelancer.com          → Vercel (primary), Railway/Render (failover)
www.cortexfreelancer.com      → 301 → cortexfreelancer.com
api.cortexfreelancer.com      → DigitalOcean VPS / Railway
app.cortexfreelancer.com      → Vercel (if SPA split needed)
status.cortexfreelancer.com   → External status page (Betteruptime/etc)
```

## Certificate Strategy

### PaaS (Vercel, Railway, Render)
- **Zero-touch** — platforms handle issuance, renewal, and termination
- HSTS headers configured in `vercel.json` / app response headers
- No manual certificate management needed

### DigitalOcean VPS (Self-Managed)
- **Certbot** with Docker sidecar for automated renewal
- **Wildcard cert** (`*.cortexfreelancer.com`) via DNS-01 challenge for flexibility
- **Individual certs** via HTTP-01 for primary domain
- 12-hour renewal check loop in certbot container
- Nginx reload on successful renewal via deploy hook

### Cloudflare (if CDN/LB active)
- **Full (Strict)** SSL mode — validates origin cert
- **Origin CA cert** for origin → Cloudflare connection (15-year validity)
- **Edge cert** automatic via Cloudflare Universal SSL
- **Authenticated Origin Pulls** for mutual TLS

## TLS Configuration

### Minimum: TLS 1.2
### Preferred: TLS 1.3
### Cipher Suites (nginx):
```
ECDHE-ECDSA-AES128-GCM-SHA256
ECDHE-RSA-AES128-GCM-SHA256
ECDHE-ECDSA-AES256-GCM-SHA384
ECDHE-RSA-AES256-GCM-SHA384
ECDHE-ECDSA-CHACHA20-POLY1305
ECDHE-RSA-CHACHA20-POLY1305
```

## Security Headers

All platforms enforce:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (deprecated, CSP preferred)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: [see CSP section]`

## Target: A+ on SSL Labs

Requirements for A+:
1. ✅ TLS 1.2 + 1.3 only (no SSLv3, TLS 1.0, 1.1)
2. ✅ Strong cipher suites (AEAD only)
3. ✅ HSTS with `max-age >= 15768000` (6 months)
4. ✅ No mixed content
5. ✅ Valid certificate chain
6. ✅ OCSP stapling enabled
7. ✅ Forward secrecy (ECDHE key exchange)
