# Client Performance Audit

## Overview

Cortex Freelancer uses no build step — all JS and CSS are loaded as individual files.
This audit documents the current state and optimization opportunities.

## Current Bundle Analysis

### JavaScript Files (app/)

| File | Purpose | Priority |
|---|---|---|
| `auth.js` | Firebase auth | Critical |
| `analytics.js` | GA4 tracking | Deferred |
| `engine.js` | Core AI interface | Critical (tools only) |
| `theme.js` | Light/dark toggle | Low priority |
| `toast.js` | Notifications | Low priority |
| `modal.js` | Modal system | Low priority |
| `pro-status.js` | Pro checker | Medium |
| `debug.js` | Debug mode | Dev only |

### External Dependencies

| Dependency | Size (approx) | Loaded on |
|---|---|---|
| Firebase App Compat | ~50KB | All pages |
| Firebase Auth Compat | ~120KB | All pages |
| Firebase Firestore Compat | ~100KB | Admin, dashboard |
| Sentry SDK | ~30KB | All pages (via head.js) |
| Google Fonts (Inter) | ~20KB | All pages |
| Stripe.js | ~40KB | Pricing only |

### Total estimated JS: ~400KB (uncompressed) across all pages

## Recommendations

### Quick Wins
1. **Defer non-critical scripts** — analytics.js, theme.js, hotjar.js
2. **Lazy-load Firestore SDK** — only on pages that need it (admin, dashboard)
3. **Lazy-load Sentry** — load after page interactive
4. **Preload critical fonts** — add `<link rel="preload">` for Inter 400/700

### Medium Effort
5. **Code split tools** — each tool page only loads its own JS
6. **Inline critical CSS** — inline above-the-fold styles, defer rest
7. **Compress OG image** — ensure < 200KB

### Low Priority
8. **Bundle JS** — consider esbuild for production builds
9. **Tree-shake Firebase** — switch from compat to modular SDK
10. **HTTP/2 server push** — push critical assets

## Core Web Vitals Targets

| Metric | Target | Current (est) |
|---|---|---|
| LCP | < 2.5s | ~2.0s |
| FID | < 100ms | ~50ms |
| CLS | < 0.1 | ~0.05 |

## Monitoring

- Core Web Vitals tracked via `app/web-vitals.js`
- Debug mode (`?debug=1`) shows load timing in console
- Lighthouse CI recommended for regression testing
