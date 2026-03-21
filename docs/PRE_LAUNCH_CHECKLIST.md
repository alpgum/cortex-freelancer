# Pre-Launch Checklist — Cortex Freelancer

Comprehensive checklist before going live. Each item should be verified and checked off.

---

## Code & Infrastructure

- [ ] All HTML pages pass W3C validation
- [ ] No console errors on any page
- [ ] CSP headers configured correctly on all pages
- [ ] Security headers in vercel.json (X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy)
- [ ] All API endpoints have CORS, rate limiting, and input sanitization middleware
- [ ] Error handler middleware wraps all API routes
- [ ] 404 and 500 error pages are functional and styled
- [ ] Service worker registered and caching works correctly
- [ ] manifest.json configured for PWA installation
- [ ] Favicon and app icons in all required sizes
- [ ] All internal links work (no broken links)
- [ ] Responsive design tested on mobile, tablet, and desktop
- [ ] Skip links and focus-visible styles on all pages
- [ ] No hardcoded secrets in source code
- [ ] `.gitignore` covers node_modules, .env, and sensitive files

## Stripe & Payments

- [ ] Stripe live API keys set in Vercel environment variables
- [ ] Stripe webhook endpoint (`/api/webhook`) configured with live signing secret
- [ ] Pro subscription product and price created in Stripe Dashboard
- [ ] Checkout flow tested end-to-end (subscribe → webhook → pro status)
- [ ] Billing portal link works from account settings
- [ ] Cancellation flow tested (cancel → access until period end → downgrade)
- [ ] Coupon codes created and tested (percentage and fixed-amount)
- [ ] Lifetime deal product and price configured
- [ ] Dunning/failed payment emails configured
- [ ] Stripe tax settings reviewed (if applicable)
- [ ] Refund policy published and linked from checkout
- [ ] Stripe customer portal branding customized

## Firebase

- [ ] Firebase project set to production mode
- [ ] Firestore security rules deployed and tested
- [ ] Firebase Auth providers configured (Google, email)
- [ ] Authorized domains list updated (cortexfreelancer.com)
- [ ] Firebase API keys restricted in Google Cloud Console
- [ ] Database indexes created for common queries
- [ ] Backup/export strategy documented
- [ ] Rate limits on Firebase Auth configured

## SEO & Meta

- [ ] Every page has unique `<title>` and `<meta name="description">`
- [ ] Open Graph tags on all public pages (og:title, og:description, og:image, og:url)
- [ ] Twitter Card tags on all public pages
- [ ] Canonical URLs set on all pages
- [ ] sitemap.xml generated and submitted to Google Search Console
- [ ] robots.txt allows crawling of public pages, blocks admin/API
- [ ] Structured data (JSON-LD) for Organization on homepage
- [ ] og-image.png created (1200x630) and referenced correctly
- [ ] Google Search Console verified and configured
- [ ] All URLs use trailing-slash-optional clean paths (verified in vercel.json)

## Legal & Compliance

- [ ] Privacy Policy published (`/privacy`)
- [ ] Terms of Service published (`/terms`)
- [ ] Refund Policy published (`/refund`)
- [ ] Accessibility Statement published (`/accessibility`)
- [ ] Cookie consent banner implemented (if required for target regions)
- [ ] GDPR compliance: data deletion process documented
- [ ] Company registration details accurate in legal pages
- [ ] Contact email (hello@cortexfreelancer.com) working and monitored
- [ ] security.txt published at `/.well-known/security.txt`

## Analytics & Monitoring

- [ ] Google Tag Manager container (GTM-NDV9WQ7) firing on all pages
- [ ] Google Analytics tracking verified in real-time reports
- [ ] Sentry error monitoring configured with correct DSN
- [ ] Sentry source maps uploaded (if using minification)
- [ ] Custom events tracked: sign_up, upgrade, tool_use, analysis_complete
- [ ] Daily metrics cron job (`/api/cron/daily-metrics`) enabled
- [ ] Subscription check cron job (`/api/cron/check-subscriptions`) enabled
- [ ] Health endpoint (`/api/health`) returns 200 OK
- [ ] Uptime monitoring set up (external service recommended)
- [ ] Error alerting configured (Sentry → email/Slack)

## Marketing & Content

- [ ] Homepage copy finalized and proofread
- [ ] Pricing page accurate (Free Kit vs Pro features, $29/mo)
- [ ] Blog posts published and indexed
- [ ] Landing pages live (Egypt, Pakistan, Nigeria, Turkey)
- [ ] Competitor comparison pages published
- [ ] Social media profiles created and linked
- [ ] Launch announcement prepared (Twitter/X, LinkedIn, Product Hunt)
- [ ] Email templates tested (welcome, pro_activated)
- [ ] Referral program page functional
- [ ] Marketing assets (ads, social posts, email campaigns) ready
- [ ] FAQ page comprehensive and up to date
- [ ] Changelog populated with launch features

## Testing

- [ ] All API endpoints tested with valid and invalid inputs
- [ ] Auth flow tested: sign up → sign in → sign out → password reset
- [ ] Pro upgrade flow tested end-to-end
- [ ] All 10+ tools tested with realistic inputs
- [ ] AI chat tested with various question types
- [ ] Profile analyzer tested with real Upwork URLs and manual input
- [ ] Mobile Safari and Chrome tested
- [ ] Desktop Chrome, Firefox, Safari, and Edge tested
- [ ] Offline mode tested (service worker, offline page)
- [ ] Rate limiting tested (verify limits are enforced)
- [ ] Form validation tested on all forms (contact, support, checkout)
- [ ] Lighthouse audit run: Performance > 90, Accessibility > 90, Best Practices > 90, SEO > 90
- [ ] Load time < 3 seconds on 3G connection
- [ ] Cross-origin requests blocked correctly (CORS)

---

**Status:** Ready for review
**Target Launch:** March 2026
**Owner:** Alp
