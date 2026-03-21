# QA Report — Cortex Freelancer

**Date:** 2026-03-21
**Scope:** Comprehensive review of all HTML, JS, CSS, and API files
**Files checked:** 61 HTML, 107 JS, 25 CSS = **193 total**

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| WARNING  | 7 |
| INFO     | 6 |

---

## CRITICAL Issues

### 1. Broken API imports — `api/_lib/firebase-admin.js` does not exist

**Files affected:**
- `api/stats.js` (line 1) — `require('./_lib/firebase-admin')` → **runtime crash** (`MODULE_NOT_FOUND`)
- `api/support.js` (line 45) — same broken require inside try/catch → **silently fails every time**

**Fix:** Replace with `require('./_lib/firestore')` and use the `getFirestore()` export.

### 2. Missing JS file `app/auth-ui.js` referenced from HTML

**Files affected:**
- `index-b.html` (line 647) — `<script src="app/auth-ui.js">`
- `app/tools/project-brief.html` (line 504) — `<script src="../auth-ui.js">`

**Fix:** Replace references with `app/auth.js` or `app/auth-modal.js`.

### 3. 15 broken internal links — `/tools/*` missing `/app/` prefix

**Files affected:**
- `help/tools-guide.html` — 13 links use `/tools/...` instead of `/app/tools/...`
- `app/tools/templates.html` — 2 links use `/tools/rate-calculator.html` and `/tools/invoice.html`

**Fix:** Add `/app` prefix to all tool links.

---

## WARNING Issues

### 4. `/app/settings` page does not exist (3 broken links)

- `help/billing.html` (lines 140, 147)
- `faq.html` (line 163)

### 5. `api/webhook.js` — Vercel config overwritten (line 30-43)

`module.exports.config = { api: { bodyParser: false } }` is set, then `module.exports` is overwritten by `withErrorHandler(...)`. The `bodyParser: false` config is lost, which may break Stripe webhook signature verification in production.

### 6. `api/tool-stats.js` — duplicated Firebase init

Initializes Firebase Admin directly instead of using `api/_lib/firestore.js`. Uses wildcard CORS (`*`) instead of the shared middleware. Inconsistent with all other endpoints.

### 7. `api/send-email.js` — missing `plan` argument (line 32)

Calls `sendProActivatedEmail(email, displayName)` but the function expects `(to, name, plan)`. Plan always defaults to `'Monthly'` regardless of actual plan.

### 8. Missing `#social-proof` section ID in `index.html`

The social proof bar uses `class="social-proof-bar"` (no ID) and the social proof ticker uses `id="socialProof"` (camelCase). Neither matches `#social-proof` for anchor navigation.

### 9. Orphaned files — not referenced anywhere

| File | Notes |
|------|-------|
| `app/onboarding-tooltips.css` | Not imported by any HTML/JS |
| `app/onboarding-tooltips.js` | Not imported by any HTML/JS |
| `app/tools/tool-feedback.js` | Likely superseded by `app/feedback-widget.js` |
| `app/tools/tool-share.js` | Likely superseded by `app/_includes/share-feedback.js` |

### 10. `index-b.html` has no route in `vercel.json`

A/B test variant exists but has no route configured, so it's unreachable via clean URLs.

---

## INFO Items

### 11. CSS class conflicts across files

These classes are defined in 3+ CSS files and may cause styling conflicts:

| Class | File count |
|-------|-----------|
| `.toast` | 4 files (toast.css, styles.css, theme.css, print-tools.css) |
| `.nav-links` | 5 files |
| `.site-footer` | 4 files |
| `.site-nav` | 4 files |
| `.active` | 4 files |
| `.visible` | 4 files |
| `.open` | 5 files |

Most 2-file overlaps (styles.css + theme.css, *.css + rtl.css) are intentional dark/RTL overrides.

### 12. Duplicate JS function names across files

High-risk duplicates (may conflict if both files load on the same page):

| Function | Files |
|----------|-------|
| `isPro()` | engine.js, tool-upgrade-cta.js, upgrade-prompts.js |
| `t()` | engine.js, i18n.js |
| `updateAuthUI()` | nav.js, auth.js |
| `getSessionId()` | journey-tracker.js, session-log.js |
| `showToast()` | toast.js, tool-share.js |

### 13. Express-only API routes (not Vercel-compatible)

These files export Express route-setup functions, not Vercel serverless handlers:
- `api/stripe.js` → `{ setupStripeRoutes }`
- `api/download.js` → `{ setupDownloadRoutes }`
- `api/waitlist.js` → `{ setupRoutes }`

This is intentional (used with `server.js`) but they won't work as standalone Vercel functions.

### 14. `.reveal` CSS class only defined inline

The `.reveal` animation class is used in 100+ elements in `index.html` but is only defined in inline `<style>` blocks (index.html, index-b.html). Not available in a shared CSS file — any other page using `class="reveal"` would have invisible content.

### 15. Duplicate `@keyframes fadeIn`

Defined in both `index.html` inline styles and `app/styles.css`. No runtime conflict since they're in different scopes.

### 16. A/B test files

`index-b.html` and `pricing-b.html` exist as A/B variants. `pricing-b.html` is routed in `vercel.json`; `index-b.html` is not.

---

## Checks Passed

- **All 61 HTML files** have proper DOCTYPE, head, body, title, viewport, and description meta tags
- **All 56 app/*.js files** pass `node --check` syntax validation
- **All 34 API files** pass `node --check` syntax validation
- **No git conflict markers** found in any file
- **No empty project files** found
- **No duplicate section IDs** in index.html
- **All section IDs verified** in index.html: `#how`, `#tools-showcase`, `#pricing-preview`, `#faq` (except `#social-proof`)
- **Shared includes** (nav.js, footer.js, head.js) are properly structured and referenced

---

## Recommendations

1. **Immediate:** Fix the 2 broken `firebase-admin` imports in `api/stats.js` and `api/support.js`
2. **Immediate:** Fix the `auth-ui.js` references → `auth.js` or `auth-modal.js`
3. **Immediate:** Fix 15 broken `/tools/*` links → `/app/tools/*`
4. **High:** Fix `api/webhook.js` config overwrite to preserve `bodyParser: false`
5. **Medium:** Create `/app/settings` page or update links in `help/billing.html` and `faq.html`
6. **Medium:** Add `id="social-proof"` to the social proof section in index.html
7. **Low:** Consolidate duplicate CSS classes (especially `.toast`)
8. **Low:** Remove or wire up orphaned files (onboarding-tooltips, tool-feedback, tool-share)
9. **Low:** Consider extracting `.reveal` CSS to a shared file
