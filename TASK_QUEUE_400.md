# Cortex Freelancer — 48-Hour Battle Plan (400 Tasks)
# Target: First LIVE paying customer (Stripe LIVE) + launch execution
# Batch: 301–400
# Created: 2026-03-21 (auto-generated)
# Priority: Stripe LIVE readiness → paid happy-path in prod → launch execution → reliability/monitoring

## RUNNING
(none)

## PENDING

---
## 💳 STRIPE LIVE READINESS (301–335)
---

### [301] stripe-live-checklist-audit
Verify docs/STRIPE_LIVE_CHECKLIST.md is accurate + complete. Add missing dashboard links and a final “GO/NO-GO” checklist. Files: docs/STRIPE_LIVE_CHECKLIST.md. After done: git add docs/STRIPE_LIVE_CHECKLIST.md && git commit -m "[301] Stripe live checklist audit" && git push

### [302] vercel-env-audit-script
Create scripts/vercel-env-audit.js that prints all required env vars for Stripe LIVE (and warns if missing). Files: scripts/vercel-env-audit.js, docs/VERCEL_ENV_SETUP.md. After done: git add scripts/vercel-env-audit.js docs/VERCEL_ENV_SETUP.md && git commit -m "[302] Vercel env audit script" && git push

### [303] stripe-live-products-doc
Document exact LIVE Stripe product/price creation steps + naming conventions + mapping to STRIPE_PRICE_PRO_MONTHLY/ANNUAL. Files: docs/STRIPE_PRODUCTS.md. After done: git add docs/STRIPE_PRODUCTS.md && git commit -m "[303] Stripe live products/price mapping doc" && git push

### [304] webhook-endpoint-doc
Document how to create Stripe webhook endpoint for production domain, events to subscribe, and how to test signature verification. Files: docs/STRIPE_WEBHOOKS.md. After done: git add docs/STRIPE_WEBHOOKS.md && git commit -m "[304] Stripe webhook endpoint doc" && git push

### [305] checkout-plan-chooser-hardening
In pricing.html ensure plan selection (monthly/annual + trial if enabled) always sends a valid plan value to /api/checkout. Add UI-level asserts/guards and user-friendly errors. Files: pricing.html. After done: git add pricing.html && git commit -m "[305] Pricing→checkout plan guardrails" && git push

### [306] checkout-status-page-smoke
Add a tiny diagnostics block (hidden behind ?debug=1) on checkout-success.html to show session_id status fetch results. Files: checkout-success.html. After done: git add checkout-success.html && git commit -m "[306] Checkout success debug smoke" && git push

### [307] portal-button-eligibility
Ensure "Manage Subscription" only appears when stripeCustomerId exists and user is Pro; otherwise show disabled hint. Files: app/dashboard.js, app/_includes/nav.js. After done: git add app/dashboard.js app/_includes/nav.js && git commit -m "[307] Portal button eligibility" && git push

### [308] stripe-live-mode-banner
Add a small admin-only banner (ADMIN_TOKEN gated) that shows whether app is in mock mode vs live mode, and which Stripe key prefix is active. Files: admin.html, app/admin-banner.js. After done: git add admin.html app/admin-banner.js && git commit -m "[308] Admin stripe mode banner" && git push

### [309] payment-happy-path-e2e-doc
Create docs/PAYMENT_E2E_SMOKE_TEST.md: step-by-step happy-path test (upgrade → checkout → webhook → Pro unlock) for mock + live. Files: docs/PAYMENT_E2E_SMOKE_TEST.md. After done: git add docs/PAYMENT_E2E_SMOKE_TEST.md && git commit -m "[309] Payment E2E smoke test doc" && git push

### [310] fail-safe-manual-pro-unlock-ui
Add an admin-only UI in admin.html to call /api/toggle-pro for a given email (manual unlock fallback). Files: admin.html, admin.js. After done: git add admin.html admin.js && git commit -m "[310] Manual Pro unlock admin UI" && git push

### [311] checkout-error-telemetry
Log checkout errors to Firestore (or localStorage fallback) with request metadata (plan, page). Files: api/checkout.js, app/error-tracker.js. After done: git add api/checkout.js app/error-tracker.js && git commit -m "[311] Checkout error telemetry" && git push

### [312] webhook-idempotency-guard
Harden api/webhook.js against duplicate events: store processed event IDs in Firestore (or in-memory fallback) and skip repeats. Files: api/webhook.js. After done: git add api/webhook.js && git commit -m "[312] Webhook idempotency guard" && git push

### [313] live-key-misconfig-warning
If STRIPE_SECRET_KEY is set but price IDs are placeholders, show a big warning on pricing page (only in prod). Files: config/stripe-prices.js, pricing.html. After done: git add config/stripe-prices.js pricing.html && git commit -m "[313] Stripe misconfig warning" && git push

### [314] receipt-email-trigger
After webhook activates Pro, ensure sendProActivatedEmail is called and failures are logged (no crash). Files: api/webhook.js, api/_services/email.js. After done: git add api/webhook.js api/_services/email.js && git commit -m "[314] Pro activation email robust" && git push

### [315] billing-portal-cancel-education
Add a short explanation before redirecting to Stripe portal: what user can do there + cancellation expectations. Files: app/dashboard.html, app/dashboard.js. After done: git add app/dashboard.html app/dashboard.js && git commit -m "[315] Billing portal education" && git push

### [316] trial-strategy-toggle
Add config to enable/disable 7-day trial without code changes (simple config flag). Files: config/feature-flags.json, api/checkout.js, pricing.html. After done: git add config/feature-flags.json api/checkout.js pricing.html && git commit -m "[316] Trial strategy feature flag" && git push

### [317] pricing-copy-live-ready
Update pricing copy: clarify trial terms, cancellation, money-back guarantee, VAT note. Files: pricing.html. After done: git add pricing.html && git commit -m "[317] Pricing live-ready copy" && git push

### [318] refund-flow-support
Add "Request refund" instructions link to refund page from pricing + dashboard. Files: pricing.html, app/dashboard.html. After done: git add pricing.html app/dashboard.html && git commit -m "[318] Refund flow links" && git push

### [319] stripe-tax-note
Add a brief note about taxes/Stripe Tax on pricing FAQ. Files: pricing.html. After done: git add pricing.html && git commit -m "[319] Stripe tax note in pricing FAQ" && git push

### [320] payment-logs-admin
Add admin section to show latest 20 payments/webhook events pulled from Firestore logs. Files: admin.html, admin.js. After done: git add admin.html admin.js && git commit -m "[320] Admin payment logs" && git push

### [321] checkout-cancel-reason-track
If user returns from cancel_url, track checkout_canceled event with plan + timestamp. Files: pricing.html, app/analytics.js. After done: git add pricing.html app/analytics.js && git commit -m "[321] Checkout cancel tracking" && git push

### [322] pricing-cta-consistency
Ensure all CTAs point to the same checkout entrypoint and preserve selected plan/trial. Files: pricing.html, index.html. After done: git add pricing.html index.html && git commit -m "[322] CTA consistency" && git push

### [323] stripe-webhook-events-doc
Document which Stripe events we listen to and why. Files: docs/STRIPE_EVENTS.md. After done: git add docs/STRIPE_EVENTS.md && git commit -m "[323] Stripe events doc" && git push

### [324] daily-metrics-include-revenue
Update api/cron/daily-metrics.js to include revenue and conversion metrics once Stripe LIVE is enabled. Files: api/cron/daily-metrics.js. After done: git add api/cron/daily-metrics.js && git commit -m "[324] Daily metrics include revenue" && git push

### [325] live-mode-smoke-script
Create scripts/smoke_live_mode.sh: curl-based smoke tests for key pages + api/health + api/checkout mock + webhook config present. Files: scripts/smoke_live_mode.sh. After done: git add scripts/smoke_live_mode.sh && git commit -m "[325] Live mode smoke script" && git push

### [326] stripe-portal-guard
If stripeCustomerId missing, portal endpoint should return a helpful error; frontend displays toast. Files: api/portal.js, app/dashboard.js. After done: git add api/portal.js app/dashboard.js && git commit -m "[326] Portal guardrails" && git push

### [327] upgrade-gate-copy-tuning
Improve upgrade-gate copy for conversion (shorter, clearer, includes guarantee). Files: app/upgrade-gate.js, app/upgrade-gate.css. After done: git add app/upgrade-gate.js app/upgrade-gate.css && git commit -m "[327] Upgrade gate copy tuning" && git push

### [328] checkout-loading-state
Add loading spinner + disable CTA during checkout session creation. Files: pricing.html, app/toast.js. After done: git add pricing.html app/toast.js && git commit -m "[328] Checkout loading state" && git push

### [329] payment-method-icons-refresh
Ensure payment method icons render and are optimized (SVG preferred). Files: pricing.html, icons/*.svg. After done: git add pricing.html icons && git commit -m "[329] Payment icons refresh" && git push

### [330] ensure-refund-page-linked-footer
Ensure refund.html is linked in footer across all pages. Files: app/_includes/footer.js. After done: git add app/_includes/footer.js && git commit -m "[330] Link refund in footer" && git push

### [331] stripe-customer-portal-copy
Add a short “manage subscription” microcopy near the Pro badge/nav for clarity. Files: app/_includes/nav.js, app/_includes/nav.css. After done: git add app/_includes/nav.js app/_includes/nav.css && git commit -m "[331] Portal microcopy" && git push

### [332] webhook-failure-alert
If webhook signature verification fails, send Slack alert (if SLACK_WEBHOOK_URL set). Files: api/webhook.js. After done: git add api/webhook.js && git commit -m "[332] Webhook failure slack alert" && git push

### [333] test-price-ids-dev-sandbox
Add docs for creating test prices and using them locally. Files: docs/STRIPE_TESTING.md. After done: git add docs/STRIPE_TESTING.md && git commit -m "[333] Stripe dev testing doc" && git push

### [334] stripe-live-switch-runbook
Create docs/STRIPE_LIVE_SWITCH_RUNBOOK.md: exact steps from mock → live, with rollback plan. Files: docs/STRIPE_LIVE_SWITCH_RUNBOOK.md. After done: git add docs/STRIPE_LIVE_SWITCH_RUNBOOK.md && git commit -m "[334] Stripe live switch runbook" && git push

### [335] post-payment-onboarding
After successful checkout, show "Next steps" checklist and deep links into top tools + dashboard. Files: checkout-success.html. After done: git add checkout-success.html && git commit -m "[335] Post-payment onboarding checklist" && git push

---
## 🚀 LAUNCH EXECUTION + GROWTH (336–370)
---

### [336] launch-page-press-kit-link
Add link to marketing/press-kit.md from footer or support page. Files: support.html, marketing/press-kit.md. After done: git add support.html marketing/press-kit.md && git commit -m "[336] Link press kit" && git push

### [337] launch-day-checklist
Create docs/LAUNCH_DAY_CHECKLIST.md: posting schedule + who/where + reply plan. Files: docs/LAUNCH_DAY_CHECKLIST.md. After done: git add docs/LAUNCH_DAY_CHECKLIST.md && git commit -m "[337] Launch day checklist" && git push

### [338] reddit-posting-sop
Create docs/REDDIT_POSTING_SOP.md: do’s/don’ts, anti-spam, comment templates. Files: docs/REDDIT_POSTING_SOP.md. After done: git add docs/REDDIT_POSTING_SOP.md && git commit -m "[338] Reddit posting SOP" && git push

### [339] hn-posting-sop
Create docs/HN_POSTING_SOP.md: guidelines + first comment template + follow-up cadence. Files: docs/HN_POSTING_SOP.md. After done: git add docs/HN_POSTING_SOP.md && git commit -m "[339] HN posting SOP" && git push

### [340] ph-assets-checklist
Create docs/PH_ASSETS_CHECKLIST.md: screenshots/GIF plan + copy blocks. Files: docs/PH_ASSETS_CHECKLIST.md. After done: git add docs/PH_ASSETS_CHECKLIST.md && git commit -m "[340] Product Hunt assets checklist" && git push

### [341] launch-utm-templates
Create marketing/utm-templates.md: recommended UTM conventions for each channel/post. Files: marketing/utm-templates.md. After done: git add marketing/utm-templates.md && git commit -m "[341] UTM templates" && git push

### [342] landing-page-speed-pass
Run a quick performance pass: compress OG image, inline minimal CSS, defer non-critical scripts. Files: index.html, og-image.png. After done: git add index.html og-image.png && git commit -m "[342] Landing speed pass" && git push

### [343] social-proof-counter-seeding
Ensure social proof counter uses a realistic seeded number and increments safely. Files: api/stats.js, index.html. After done: git add api/stats.js index.html && git commit -m "[343] Social proof counter seeding" && git push

### [344] waitlist-popup
Add a simple waitlist modal (trigger exit intent / 30s) with UTM capture. Files: app/modal.js, index.html, app/utm-tracker.js. After done: git add app/modal.js index.html app/utm-tracker.js && git commit -m "[344] Waitlist popup" && git push

### [345] email-signup-embed
Add email input on index final CTA that hits /api/waitlist with UTM. Files: index.html, api/waitlist.js. After done: git add index.html api/waitlist.js && git commit -m "[345] Email signup embed" && git push

### [346] launch-announcement-page
Create /launch page summarizing what’s new + links. Files: launch.html, vercel.json. After done: git add launch.html vercel.json && git commit -m "[346] Launch announcement page" && git push

### [347] publish-schedule-md
Create marketing/publish-schedule.md: 7-day posting schedule referencing prepared content files. Files: marketing/publish-schedule.md. After done: git add marketing/publish-schedule.md && git commit -m "[347] Publish schedule" && git push

### [348] referral-cta-placement
Add subtle referral CTA in dashboard for Pro users. Files: app/dashboard.html, app/dashboard.js. After done: git add app/dashboard.html app/dashboard.js && git commit -m "[348] Referral CTA placement" && git push

### [349] lifetime-deal-expiry-copy
Add clear expiry copy + scarcity UI sanity check (avoid fake urgency) on lifetime-deal page. Files: lifetime-deal.html. After done: git add lifetime-deal.html && git commit -m "[349] Lifetime deal expiry copy" && git push

### [350] improve-help-center-nav
Ensure help pages are linked from footer and support page. Files: app/_includes/footer.js, support.html. After done: git add app/_includes/footer.js support.html && git commit -m "[350] Help center nav links" && git push

### [351] add-contact-email-everywhere
Ensure support email address appears on pricing, refund, support pages. Files: pricing.html, refund.html, support.html. After done: git add pricing.html refund.html support.html && git commit -m "[351] Contact email visibility" && git push

### [352] launch-metrics-dashboard
Create a simple launch metrics markdown dashboard in docs/LAUNCH_METRICS.md with KPIs + where to check. Files: docs/LAUNCH_METRICS.md. After done: git add docs/LAUNCH_METRICS.md && git commit -m "[352] Launch metrics dashboard doc" && git push

### [353] social-proof-testimonials-refresh
Rotate testimonials copy to be shorter + more credible. Files: index.html, pricing.html. After done: git add index.html pricing.html && git commit -m "[353] Testimonials refresh" && git push

### [354] add-live-chat-link
Add link to /chat in footer/nav. Files: app/_includes/nav.js, app/_includes/footer.js. After done: git add app/_includes/nav.js app/_includes/footer.js && git commit -m "[354] Live chat link" && git push

### [355] enhance-demo-video-embed
Embed promo_v2_final.mp4 (lightweight) or GIF in index tool showcase (lazy loaded). Files: index.html, marketing/video/v2/promo_v2_final.mp4. After done: git add index.html && git commit -m "[355] Demo video embed" && git push

### [356] add-press-mentions-placeholder
Add “As seen in” placeholder logos row (no false claims). Files: index.html. After done: git add index.html && git commit -m "[356] Press mentions placeholder" && git push

### [357] signup-activation-nudge
If user signs up but no tool use in 1 session, show a gentle nudge banner linking to top tool. Files: app/dashboard.js. After done: git add app/dashboard.js && git commit -m "[357] Activation nudge banner" && git push

### [358] launch-analytics-tags
Add consistent data-attributes to CTAs so analytics can attribute clicks. Files: index.html, pricing.html, app/tools/*.html. After done: git add -A && git commit -m "[358] Analytics CTA tags" && git push

### [359] share-on-twitter-ux
Improve share UX after scorecard generation and on checkout success page. Files: app/index.html, checkout-success.html. After done: git add app/index.html checkout-success.html && git commit -m "[359] Share UX improvements" && git push

### [360] launch-announcement-email-template
Create a plain-text + HTML launch email template for Resend. Files: marketing/emails/launch-email.md. After done: git add marketing/emails/launch-email.md && git commit -m "[360] Launch email template" && git push

### [361] founder-bio-page
Create /about page with founder bio + mission (minimal). Files: about.html, vercel.json. After done: git add about.html vercel.json && git commit -m "[361] About page" && git push

### [362] careers-placeholder
Create /careers placeholder with “Not hiring yet” (optional). Files: careers.html, vercel.json. After done: git add careers.html vercel.json && git commit -m "[362] Careers placeholder" && git push

### [363] legal-footer-links-audit
Audit footer links across all pages; ensure all legal/support pages reachable. Files: app/_includes/footer.js. After done: git add app/_includes/footer.js && git commit -m "[363] Footer links audit" && git push

### [364] reduce-hero-text-density
Make hero copy shorter on mobile. Files: index.html. After done: git add index.html && git commit -m "[364] Hero copy mobile density" && git push

### [365] landing-page-cta-sticky-mobile
Add sticky CTA on mobile for index page. Files: index.html, app/buttons.css. After done: git add index.html app/buttons.css && git commit -m "[365] Sticky mobile CTA" && git push

### [366] make-pricing-cta-sticky
Add sticky CTA bar on pricing page. Files: pricing.html. After done: git add pricing.html && git commit -m "[366] Pricing sticky CTA" && git push

### [367] onboarding-quick-start
After onboarding wizard, show quick-start: “Try invoice”, “Analyze profile”, “Upgrade”. Files: app/onboarding.js, app/onboarding.html. After done: git add app/onboarding.js app/onboarding.html && git commit -m "[367] Onboarding quick start" && git push

### [368] tool-hub-featured-tools
Add “Featured tools” row on tools hub. Files: app/tools/index.html. After done: git add app/tools/index.html && git commit -m "[368] Tools hub featured row" && git push

### [369] template-browser-featured
Add “Most used templates” section to template browser. Files: app/tools/templates.html. After done: git add app/tools/templates.html && git commit -m "[369] Template browser featured" && git push

### [370] add-language-badges
Add language badges on landing pages (EN/TR/AR). Files: landing/*.html. After done: git add landing && git commit -m "[370] Landing language badges" && git push

---
## 🛠️ RELIABILITY / MONITORING / OPS (371–400)
---

### [371] error-log-admin-view
Add admin view for client error logs (from Firestore). Files: admin.html, app/error-tracker.js. After done: git add admin.html app/error-tracker.js && git commit -m "[371] Admin error log view" && git push

### [372] health-endpoint-extended
Extend /api/health to include dependency checks (Stripe key set? Firestore reachable?) without leaking secrets. Files: api/health.js. After done: git add api/health.js && git commit -m "[372] Health endpoint extended" && git push

### [373] uptime-monitoring-config
Add docs for UptimeRobot monitors for /, /pricing, /api/health, /status. Files: docs/MONITORING.md. After done: git add docs/MONITORING.md && git commit -m "[373] Uptime monitoring config" && git push

### [374] log-rotation-doc
Document how to manage logs/exports and keep repo clean. Files: docs/LOG_MAINTENANCE.md. After done: git add docs/LOG_MAINTENANCE.md && git commit -m "[374] Log maintenance doc" && git push

### [375] ga4-id-config
Add support for reading GA_MEASUREMENT_ID from a config file in addition to window.__GA_MEASUREMENT_ID. Files: app/analytics.js, config/analytics.json. After done: git add app/analytics.js config/analytics.json && git commit -m "[375] GA4 ID config support" && git push

### [376] hotjar-id-config
Add HOTJAR_ID config with safe fallback. Files: config/analytics.json, app/hotjar.js. After done: git add config/analytics.json app/hotjar.js && git commit -m "[376] Hotjar ID config" && git push

### [377] firehose-event-export
Add an admin endpoint to export recent events for debugging (admin token). Files: api/export-events.js, vercel.json. After done: git add api/export-events.js vercel.json && git commit -m "[377] Export events admin endpoint" && git push

### [378] sitemap-auto-extend
Ensure sitemap includes blog/comparisons/landing/help pages. Files: sitemap.xml. After done: git add sitemap.xml && git commit -m "[378] Extend sitemap" && git push

### [379] robots-txt-audit
Audit robots.txt for correct sitemap link and allow rules. Files: robots.txt. After done: git add robots.txt && git commit -m "[379] Robots.txt audit" && git push

### [380] accessibility-quick-audit
Run a quick accessibility pass: contrast, labels, focus outlines. Fix obvious issues. Files: app/*.css, app/tools/*.html. After done: git add -A && git commit -m "[380] Accessibility quick audit" && git push

### [381] broken-link-check-script
Create scripts/check-links.js to scan HTML files for internal links and verify file existence. Files: scripts/check-links.js. After done: git add scripts/check-links.js && git commit -m "[381] Broken link check script" && git push

### [382] html-validate-script
Add script to validate HTML structure and report missing alt tags/duplicate IDs. Files: scripts/validate-html.js. After done: git add scripts/validate-html.js && git commit -m "[382] HTML validate script" && git push

### [383] ci-workflow-extend
Extend GitHub Actions lint workflow to run link checker and HTML validator. Files: .github/workflows/lint.yml. After done: git add .github/workflows/lint.yml && git commit -m "[383] CI: link + html validate" && git push

### [384] vercel-route-audit
Audit vercel.json routes: remove duplicates, ensure cleanUrls works for all new pages. Files: vercel.json. After done: git add vercel.json && git commit -m "[384] Vercel route audit" && git push

### [385] 404-monitoring
Add a small JS snippet to track 404 occurrences (path) in GA4 (consent gated). Files: 404.html, app/analytics.js. After done: git add 404.html app/analytics.js && git commit -m "[385] Track 404 events" && git push

### [386] rate-limit-dashboard
Add an admin widget that shows recent rate-limit hits (stored in memory fallback) for debugging abuse. Files: admin.html, api/_middleware/rate-limit.js. After done: git add admin.html api/_middleware/rate-limit.js && git commit -m "[386] Rate limit admin widget" && git push

### [387] abuse-incidents-log
Log abuse-prevention blocks into Firestore with timestamp/IP hash/user-agent. Files: api/_middleware/abuse-prevention.js. After done: git add api/_middleware/abuse-prevention.js && git commit -m "[387] Abuse incidents log" && git push

### [388] pro-status-cache-bugfix
Audit pro-status caching edge cases (localStorage stale). Fix. Files: app/pro-status.js. After done: git add app/pro-status.js && git commit -m "[388] Pro status cache edge cases" && git push

### [389] firebase-auth-reconnect
Handle auth state changes across tabs and after refresh. Files: app/auth.js. After done: git add app/auth.js && git commit -m "[389] Auth state reconnect" && git push

### [390] firestore-rules-deploy-doc
Document how to deploy firestore.rules and indexes. Files: docs/FIRESTORE_DEPLOY.md. After done: git add docs/FIRESTORE_DEPLOY.md && git commit -m "[390] Firestore deploy doc" && git push

### [391] backup-customers-json
Add a script to backup data/customers.json and prevent accidental commit of sensitive data. Files: scripts/backup-data.sh, .gitignore. After done: git add scripts/backup-data.sh .gitignore && git commit -m "[391] Backup customers data script" && git push

### [392] debug-mode-flag
Add a global debug flag (?debug=1) to show extra diagnostics (non-PII). Files: app/debug.js. After done: git add app/debug.js && git commit -m "[392] Debug mode flag" && git push

### [393] client-bundle-audit
Audit client JS bundle sizes and remove heavy libs if unused. Files: docs/PERF_AUDIT.md. After done: git add docs/PERF_AUDIT.md && git commit -m "[393] Client perf audit doc" && git push

### [394] service-worker-cache-audit
Audit service worker caching to avoid stale HTML on deploy. Files: service-worker.js. After done: git add service-worker.js && git commit -m "[394] Service worker cache audit" && git push

### [395] cache-busting-strategy
Add cache busting for key assets (version query param). Files: app/_includes/head.js. After done: git add app/_includes/head.js && git commit -m "[395] Cache busting strategy" && git push

### [396] security-headers-audit
Audit security headers and add missing ones if needed. Files: vercel.json. After done: git add vercel.json && git commit -m "[396] Security headers audit" && git push

### [397] csp-tuning
Tune CSP meta tags to match actual CDNs used (GA4, Firebase, Stripe). Files: index.html, pricing.html, app/_includes/head.js. After done: git add index.html pricing.html app/_includes/head.js && git commit -m "[397] CSP tuning" && git push

### [398] dependency-audit
Run npm audit and patch critical vulnerabilities; document results. Files: package.json, package-lock.json, docs/DEPENDENCY_AUDIT.md. After done: git add package.json package-lock.json docs/DEPENDENCY_AUDIT.md && git commit -m "[398] Dependency audit" && git push

### [399] final-preprod-smoke
Create scripts/smoke_prod.sh to check core URLs return 200 and key DOM markers exist. Files: scripts/smoke_prod.sh. After done: git add scripts/smoke_prod.sh && git commit -m "[399] Prod smoke script" && git push

### [400] batch-400-complete
Update TASK_QUEUE_400.md: move all tasks to DONE once completed, and create TASK_QUEUE_500.md placeholder. Files: TASK_QUEUE_400.md, TASK_QUEUE_500.md. After done: git add TASK_QUEUE_400.md TASK_QUEUE_500.md && git commit -m "[400] Batch 400 complete" && git push

## DONE
(none)
