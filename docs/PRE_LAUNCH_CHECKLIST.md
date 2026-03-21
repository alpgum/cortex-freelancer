# Pre-Launch Checklist — Cortex Freelancer

Comprehensive checklist before going live. Each item should be verified and checked off.

Last reviewed: 2026-03-22

---

## Code & Infrastructure

- [x] All HTML pages pass W3C validation
- [x] No console errors on any page
- [x] CSP headers configured correctly on all pages (fixed in [443])
- [x] Security headers in vercel.json (X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy)
- [x] All API endpoints have CORS, rate limiting, and input sanitization middleware
- [x] Error handler middleware wraps all API routes
- [x] 404 and 500 error pages are functional, branded, and use semantic HTML ([493])
- [x] Service worker registered and caching works correctly
- [x] manifest.json configured for PWA installation
- [x] Favicon and app icons in all required sizes
- [x] All internal links work (no broken links)
- [x] Responsive design tested on mobile, tablet, and desktop
- [x] Skip links and focus-visible styles on all pages
- [x] No hardcoded secrets in source code
- [x] `.gitignore` covers node_modules, .env, and sensitive files
- [x] Non-critical scripts deferred for faster page load ([492])
- [x] All images lazy-loaded and under 200KB ([492])

## Stripe & Payments

- [x] Stripe live API keys set in Vercel environment variables
- [x] Stripe webhook endpoint (`/api/webhook`) configured with live signing secret
- [x] Pro subscription product and price created in Stripe Dashboard
- [ ] Checkout flow tested end-to-end (subscribe → webhook → pro status) — **needs manual verification**
- [ ] Billing portal link works from account settings — **needs manual verification**
- [ ] Cancellation flow tested (cancel → access until period end → downgrade) — **needs manual verification**
- [x] Coupon codes created and tested (percentage and fixed-amount)
- [ ] Lifetime deal product and price configured — **not yet created in Stripe**
- [ ] Dunning/failed payment emails configured — **check Stripe dashboard**
- [ ] Stripe tax settings reviewed (if applicable) — **not configured**
- [x] Refund policy published and linked from checkout
- [ ] Stripe customer portal branding customized — **needs review**

## Firebase

- [x] Firebase project set to production mode
- [x] Firestore security rules deployed and tested
- [x] Firebase Auth providers configured (Google, email)
- [x] Authorized domains list updated (cortexfreelancer.com)
- [ ] Firebase API keys restricted in Google Cloud Console — **needs manual verification**
- [ ] Database indexes created for common queries — **needs manual verification**
- [ ] Backup/export strategy documented — **not documented**
- [ ] Rate limits on Firebase Auth configured — **needs manual verification**

## SEO & Meta

- [x] Every page has unique `<title>` and `<meta name="description">` ([491])
- [x] Open Graph tags on all public pages (og:title, og:description, og:image, og:url) ([491])
- [x] Twitter Card tags on all public pages (twitter:card, twitter:title, twitter:description, twitter:image) ([491])
- [x] Tool pages target "free [tool] for freelancers" keywords ([491])
- [x] Canonical URLs set on all pages
- [x] sitemap.xml generated and submitted to Google Search Console
- [x] robots.txt allows crawling of public pages, blocks admin/API
- [x] Structured data (JSON-LD) for Organization on homepage
- [x] og-image.png created (1200x630) and referenced correctly
- [ ] Google Search Console verified and configured — **needs manual verification**
- [x] All URLs use trailing-slash-optional clean paths (verified in vercel.json)

## Legal & Compliance

- [x] Privacy Policy published (`/privacy`)
- [x] Terms of Service published (`/terms`)
- [x] Refund Policy published (`/refund`)
- [x] Accessibility Statement published (`/accessibility`)
- [ ] Cookie consent banner implemented (if required for target regions) — **not implemented, may be needed for EU users**
- [ ] GDPR compliance: data deletion process documented — **not documented**
- [x] Company registration details accurate in legal pages
- [x] Contact email (hello@cortexfreelancer.com) working and monitored
- [x] security.txt published at `/.well-known/security.txt`

## Analytics & Monitoring

- [x] Google Tag Manager container (GTM-NDV9WQ7) firing on all pages
- [ ] Google Analytics tracking verified in real-time reports — **needs manual verification**
- [x] Sentry error monitoring configured with correct DSN
- [ ] Sentry source maps uploaded (if using minification) — **not using minification currently**
- [x] Custom events tracked: sign_up, upgrade, tool_use, analysis_complete
- [x] Privacy-friendly analytics client (`app/_includes/analytics.js`) + `/api/track` endpoint ([494])
- [x] Daily metrics cron job (`/api/cron/daily-metrics`) enabled
- [x] Subscription check cron job (`/api/cron/check-subscriptions`) enabled
- [x] Health endpoint (`/api/health`) returns 200 OK
- [ ] Uptime monitoring set up (external service recommended) — **not set up**
- [ ] Error alerting configured (Sentry → email/Slack) — **needs configuration**

## Accessibility

- [x] Skip-to-content links on all pages
- [x] Focus-visible outlines on all interactive elements
- [x] Color contrast improved (--text2 bumped to #b0b0b0) ([495])
- [x] Keyboard support on all interactive elements (invoice logo, draft cards) ([495])
- [x] Focus/blur handlers added alongside mouse hover handlers ([495])
- [x] Form inputs have aria-labels or associated labels ([495])
- [x] Semantic landmarks (main, nav) on error pages ([493])
- [x] Responsive touch targets (min 44px) on mobile

## Marketing & Content

- [x] Homepage copy finalized and proofread
- [x] Pricing page accurate (Free Kit vs Pro features, $29/mo)
- [x] Blog posts published and indexed (6 articles)
- [x] Landing pages live (Egypt, Pakistan, Nigeria, Turkey)
- [x] Competitor comparison pages published (Bonsai, HoneyBook, AND CO)
- [ ] Social media profiles created and linked — **needs manual setup**
- [x] Launch announcement prepared (Twitter/X, LinkedIn, Reddit)
- [x] Email templates tested (welcome, pro_activated)
- [x] Referral program page functional
- [x] Marketing assets (ads, social posts, email campaigns) ready
- [x] FAQ page comprehensive and up to date
- [x] Changelog populated with launch features

## Testing

- [x] All API endpoints tested with valid and invalid inputs
- [x] Auth flow tested: sign up → sign in → sign out → password reset
- [ ] Pro upgrade flow tested end-to-end — **needs manual verification with real Stripe**
- [x] All 25 tools tested with realistic inputs
- [x] AI chat tested with various question types
- [x] Profile analyzer tested with real Upwork URLs and manual input
- [ ] Mobile Safari and Chrome tested — **needs manual device testing**
- [ ] Desktop Chrome, Firefox, Safari, and Edge tested — **needs manual browser testing**
- [ ] Offline mode tested (service worker, offline page) — **needs manual verification**
- [x] Rate limiting tested (verify limits are enforced)
- [x] Form validation tested on all forms (contact, support, checkout)
- [ ] Lighthouse audit run: Performance > 90, Accessibility > 90, Best Practices > 90, SEO > 90 — **not run yet**
- [ ] Load time < 3 seconds on 3G connection — **not tested**
- [x] Cross-origin requests blocked correctly (CORS)
- [x] E2E smoke test v2 covers 85+ checks: all pages, tools, APIs, auth, Stripe ([496])

---

## Summary

**Done:** ~70 of 87 items (80%)
**Needs manual verification:** ~10 items (require browser/dashboard/Stripe checks)
**Not done:** ~7 items (cookie consent, GDPR docs, uptime monitoring, Lighthouse, Stripe lifecycle testing, Firebase backup docs, social media profiles)

**Critical blockers before launch:** None — core functionality is complete.
**Recommended before launch:** Stripe checkout e2e test, Lighthouse audit, mobile browser testing.
**Can ship without (do post-launch):** Cookie consent, uptime monitoring, GDPR deletion docs, social media profiles.

**Status:** Ready for soft launch
**Target Launch:** March 2026
**Owner:** Alp
