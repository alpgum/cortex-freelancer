# CDN Optimization — CFX-017

**Status:** ✅ Complete  
**Priority:** Medium  
**Impact:** Global performance improvement, reduced origin load, lower bandwidth costs

---

## Architecture Overview

```
User → Cloudflare Edge (300+ PoPs) → Origin (Railway/Render/Docker)
         ├─ HTML: 1h edge cache, revalidate
         ├─ JS/CSS: 30d edge cache, stale-while-revalidate
         ├─ Fonts: 1yr immutable cache
         ├─ Images: 7d edge cache
         └─ API/WS: bypass cache (always origin)
```

## What Was Done

### 1. Static Asset Analysis

| Asset Type | Count | Total Size | Largest File |
|-----------|-------|-----------|-------------|
| JavaScript | 433+ | ~6.5 MB | engine.js (102KB) |
| CSS | 15+ | ~172 KB | styles.css (41KB) |
| HTML | 80+ | ~2.9 MB | pricing.html (72KB) |
| Images | 5 | ~148 KB | og-image.png (18KB) |

**Key finding:** 433 individual JS files in `app/js/` — massive optimization opportunity for bundling. 81 files are >20KB each.

### 2. CDN Solution: Cloudflare (Recommended)

**Why Cloudflare over alternatives:**

| Factor | Cloudflare | CloudFront | Vercel Edge |
|--------|-----------|-----------|-------------|
| Already in use | ✅ (CF tunnels) | ❌ | Partial |
| Free tier | Generous | Limited | Limited |
| Global PoPs | 300+ | 400+ | ~50 |
| Brotli | ✅ auto | ✅ config | ✅ auto |
| Cache Rules | ✅ free | ❌ behaviors | ❌ headers only |
| Analytics | ✅ free | $$ | Basic |
| Early Hints | ✅ | ❌ | ❌ |
| Setup effort | Minimal | High | Already done |

**Verdict:** Cloudflare is the clear winner — already in the stack, zero cost, easy setup.

### 3. Files Created

| File | Purpose |
|------|---------|
| `cdn/cache-headers.js` | Express middleware — sets Cache-Control per file type |
| `cdn/resource-hints.js` | Express middleware — Link headers for preload/prefetch/preconnect |
| `cdn/compression.js` | Brotli + Gzip compression middleware (origin fallback) |
| `cdn/cloudflare-cdn.conf` | Cloudflare dashboard config documentation |
| `cdn/nginx-cdn.conf` | Nginx config with CDN-optimized caching + proxy cache |
| `cdn/asset-optimizer.sh` | Pre-deployment asset analysis + pre-compression |
| `cdn/purge-cache.sh` | Cloudflare cache purge automation |
| `vercel.json` | Updated with per-asset-type cache headers |
| `server.js` | Integrated cache-headers + resource-hints middleware |

### 4. Cache Strategy

```
┌──────────────────────────────────────────────────┐
│ Asset Type    │ Browser TTL │ Edge TTL │ Strategy │
├──────────────────────────────────────────────────┤
│ Fonts (.woff2)│ 1 year     │ 1 year   │ immutable│
│ JS (.js)      │ 30 days    │ 60 days  │ SWR 7d   │
│ CSS (.css)    │ 30 days    │ 60 days  │ SWR 7d   │
│ Images        │ 7 days     │ 14 days  │ SWR 7d   │
│ HTML (.html)  │ 1 hour     │ 4 hours  │ revalidate│
│ API (/api/*)  │ no-store   │ no-store │ bypass   │
│ WebSocket     │ no-store   │ no-store │ bypass   │
└──────────────────────────────────────────────────┘

SWR = stale-while-revalidate (serve stale, refresh in background)
```

### 5. Performance Optimizations

#### Resource Hints (via Link headers)
- **Preconnect:** Google Fonts, GTM, Firebase Auth (saves ~100-300ms per origin)
- **Preload:** styles.css, typography.css (critical render path)
- **Prefetch:** Route-specific (e.g., login page prefetches dashboard.js)

#### Compression
- **Brotli** at quality 4 (origin) — 15-25% smaller than gzip
- **Gzip** fallback for older clients
- **Pre-compression** via asset-optimizer.sh for nginx `gzip_static`

#### Nginx Proxy Cache
- Local disk cache (`/var/cache/nginx/static`) for Docker deployments
- `proxy_cache_use_stale` — serves stale on origin errors
- Open file cache — reduces disk I/O for repeated static file requests

### 6. Cache Invalidation Strategy

| Trigger | Action | Command |
|---------|--------|---------|
| Deploy (all changes) | Purge all | `./cdn/purge-cache.sh all` |
| Single file update | Purge file(s) | `./cdn/purge-cache.sh files /app/styles.css` |
| Feature group update | Purge by tag | `./cdn/purge-cache.sh tags app-assets` |
| Emergency | Purge all | CF Dashboard → Quick Actions → Purge Cache |

### 7. Future Optimization Roadmap

#### High Impact (Next Sprint)
1. **Bundle JS files** — 433 files → ~5-10 chunks via esbuild/rollup
   - Expected savings: ~60-70% reduction after minification + tree-shaking
   - Critical: engine.js + dashboard.js as entry points
2. **Lazy-load tool JS** — Only load tool-specific JS when page is visited
3. **Content-hash filenames** — `styles.a3f2b1.css` for infinite cache + instant invalidation

#### Medium Impact
4. **Image optimization** — Convert PNG to WebP/AVIF, add responsive srcset
5. **Critical CSS inlining** — Inline above-fold CSS, defer the rest
6. **Service Worker caching** — sw.js already exists, enhance with CDN-aware strategy

#### Low Impact / Nice to Have
7. **HTTP/3 QUIC** — Enable in Cloudflare (toggle)
8. **Cloudflare Workers** — Edge-side HTML transforms, A/B testing
9. **Smart Tiered Caching** — Reduce origin hits via CF upper-tier cache

---

## Deployment Checklist

### Cloudflare Dashboard Setup
- [ ] Enable Auto Minify (JS, CSS, HTML)
- [ ] Enable Brotli compression
- [ ] Enable Early Hints
- [ ] Enable HTTP/3 (QUIC)
- [ ] Enable 0-RTT Connection Resumption
- [ ] Enable Always Use HTTPS
- [ ] Disable Rocket Loader (conflicts with module scripts)
- [ ] Configure Cache Rules per `cloudflare-cdn.conf`
- [ ] Enable Smart Tiered Caching
- [ ] Set Browser Cache TTL: Respect Existing Headers

### Server Integration
- [x] cache-headers.js middleware integrated in server.js
- [x] resource-hints.js middleware integrated in server.js
- [x] vercel.json updated with per-asset cache headers
- [x] nginx-cdn.conf ready for Docker deployment
- [ ] Add `./cdn/purge-cache.sh all` to CI/CD pipeline post-deploy
- [ ] Set CF_API_TOKEN and CF_ZONE_ID environment variables

### Monitoring
- [ ] Cloudflare Analytics → Cache tab for hit ratios
- [ ] Monitor X-Cache-Status header in nginx logs
- [ ] Set up Cloudflare Web Analytics (free, privacy-friendly)

---

## Expected Impact

| Metric | Before | After (Projected) |
|--------|--------|-------------------|
| TTFB (global avg) | ~500-800ms | ~50-100ms (edge hit) |
| JS load time | ~2-3s (433 files) | ~300-500ms (bundled + cached) |
| Cache hit ratio | 0% (no CDN) | 85-95% |
| Origin bandwidth | 100% | ~10-20% |
| Monthly bandwidth cost | Full | ~80% reduction |

*Note: Bundling (future sprint) is required for the JS load time improvement.*
