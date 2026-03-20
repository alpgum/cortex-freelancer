# Cortex Freelancer — 48-Hour Battle Plan (300 Tasks)
# Target: First $29 by Monday March 23, 2026
# Auto-dispatch: 3 ACP slots, 2min cycle, ~18 tasks/hour
# Created: 2026-03-20 23:57 Istanbul
# Priority: Ship-blockers first → Revenue enablers → Polish → Marketing → Nice-to-haves

## PENDING

---
## 🏗️ BACKEND & INFRA (001-050)
---

### [001] firebase-project-init
Create Firebase project config file. Add firebase-config.js at project root with firebaseConfig object (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) using placeholder values from .env. Add FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID to .env.example. Files: firebase-config.js, .env.example. After done: git add firebase-config.js .env.example && git commit -m "[001] Firebase project config scaffold" && git push

### [002] firebase-auth-google-login
Implement Google OAuth login using Firebase Auth (client-side SDK). Create app/auth.js with: initFirebase(), signInWithGoogle(), signOut(), onAuthStateChanged listener that stores user in window.cortexUser. Add Firebase SDK scripts (v9 compat CDN) to a shared head partial. Show logged-in user avatar+name in nav, "Sign In" button when logged out. Files: app/auth.js, firebase-config.js. After done: git add app/auth.js firebase-config.js && git commit -m "[002] Firebase Auth Google login" && git push

### [003] auth-ui-login-modal
Create a login/signup modal component (pure HTML/CSS/JS). Trigger on "Sign In" button click. Show Google sign-in button with branded styling, "Continue with Google" text. Close on backdrop click or X. Add to all pages via a shared auth-modal.js include. Files: app/auth-modal.js, app/auth-modal.css. After done: git add app/auth-modal.js app/auth-modal.css && git commit -m "[003] Login modal UI component" && git push

### [004] auth-nav-integration
Update navigation on ALL pages (index.html, pricing.html, app/index.html, all app/tools/*.html) to include auth state: show "Sign In" when logged out, show avatar+name+"Sign Out" when logged in. Import auth.js on every page. Files: index.html, pricing.html, app/index.html, app/tools/*.html. After done: git add -A && git commit -m "[004] Auth nav integration all pages" && git push

### [005] firestore-user-schema
On first Google login, create/update Firestore document at users/{uid} with fields: email, displayName, photoURL, createdAt, lastLoginAt, isPro (boolean, default false), proExpiresAt (null), stripeCustomerId (null), toolUsage (map: {toolName: count}), savedAnalyses (array), plan ('free'). Use set with merge. Files: app/auth.js (extend onAuthStateChanged). After done: git add app/auth.js && git commit -m "[005] Firestore user document on login" && git push

### [006] firestore-pro-status-sync
Replace localStorage Pro check with Firestore lookup. Create app/pro-status.js: checkProStatus(uid) reads users/{uid}.isPro from Firestore, caches in localStorage as fallback, returns boolean. All tool pages import this and gate Pro features. Files: app/pro-status.js. After done: git add app/pro-status.js && git commit -m "[006] Firestore Pro status sync" && git push

### [007] stripe-checkout-auth-link
Update api/checkout.js to accept uid (Firebase UID) alongside email. Store uid in Stripe checkout session metadata so webhook can link payment to Firestore user. Files: api/checkout.js. After done: git add api/checkout.js && git commit -m "[007] Stripe checkout links Firebase UID" && git push

### [008] stripe-webhook-firestore-update
Update api/webhook.js: on checkout.session.completed, read uid from metadata, update Firestore users/{uid} with isPro=true, plan='pro_monthly' or 'pro_annual', proExpiresAt, stripeCustomerId, stripeSubscriptionId. On customer.subscription.deleted, set isPro=false. Files: api/webhook.js. After done: git add api/webhook.js && git commit -m "[008] Webhook updates Firestore Pro status" && git push

### [009] stripe-customer-portal-api
Create api/portal.js: POST endpoint that takes stripeCustomerId, creates a Stripe billing portal session, returns URL. Frontend redirects user to manage subscription. Add route to vercel.json. Files: api/portal.js, vercel.json. After done: git add api/portal.js vercel.json && git commit -m "[009] Stripe customer portal API" && git push

### [010] stripe-checkout-error-handling
Update api/checkout.js to handle errors gracefully: invalid email, missing plan, Stripe API errors. Return JSON {error: message, code: number}. Frontend shows user-friendly error toast. Files: api/checkout.js. After done: git add api/checkout.js && git commit -m "[010] Stripe checkout error handling" && git push

### [011] api-rate-limiter
Create api/_middleware/rate-limit.js using in-memory Map with IP-based tracking. Free: 10 req/min, Pro: 100 req/min. Return 429 with retry-after header. Apply to all api/ endpoints. Files: api/_middleware/rate-limit.js, update all api/*.js to import. After done: git add api/_middleware/rate-limit.js && git commit -m "[011] API rate limiting middleware" && git push

### [012] api-cors-headers
Create api/_middleware/cors.js that adds proper CORS headers: Allow-Origin for cortexfreelancer.com and localhost:3847, Allow-Methods, Allow-Headers. Apply to all API routes. Files: api/_middleware/cors.js. After done: git add api/_middleware/cors.js && git commit -m "[012] CORS middleware for API" && git push

### [013] api-input-sanitization
Create api/_middleware/sanitize.js: sanitize all string inputs (trim, strip HTML tags, limit length to 1000 chars). Apply to checkout, waitlist, toggle-pro, download endpoints. Prevent XSS and injection. Files: api/_middleware/sanitize.js. After done: git add api/_middleware/sanitize.js && git commit -m "[013] Input sanitization middleware" && git push

### [014] api-health-endpoint
Create api/health.js: GET endpoint returns {status: 'ok', timestamp, version, uptime}. Add to vercel.json routes. Useful for uptime monitoring. Files: api/health.js, vercel.json. After done: git add api/health.js vercel.json && git commit -m "[014] Health check API endpoint" && git push

### [015] env-vars-vercel-checklist
Create docs/VERCEL_ENV_SETUP.md listing every env var needed in Vercel dashboard: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL, ADMIN_TOKEN, FIREBASE_* vars. Include step-by-step setup instructions. Files: docs/VERCEL_ENV_SETUP.md. After done: git add docs/VERCEL_ENV_SETUP.md && git commit -m "[015] Vercel env vars setup guide" && git push

### [016] vercel-routes-all-tools
Update vercel.json to add clean URL routes for ALL tool pages: /app/tools/invoice → invoice.html, /app/tools/proposal → proposal.html, /app/tools/fee-calculator, /app/tools/contract-review, /app/tools/scope-analyzer, /app/tools/email-writer, /app/tools/payment-checker, /app/tools/templates. Files: vercel.json. After done: git add vercel.json && git commit -m "[016] Vercel routes for all tool pages" && git push

### [017] server-js-cleanup
Review and clean up server.js: ensure all routes match vercel.json, remove dead code, add proper error handling for 404s, serve static files correctly. Files: server.js. After done: git add server.js && git commit -m "[017] Server.js cleanup and route sync" && git push

### [018] api-usage-tracking
Create api/track.js: POST endpoint accepts {uid, event, properties}. Stores event in Firestore collection events/{auto-id} with timestamp, uid, event name, properties. For tracking tool_used, upgrade_clicked, etc. Files: api/track.js, vercel.json. After done: git add api/track.js vercel.json && git commit -m "[018] Usage tracking API endpoint" && git push

### [019] firestore-tool-usage-limits
Create app/usage-limits.js: checkUsageLimit(uid, toolName) reads today's usage count from Firestore. Free users: 3 uses/day per tool. Pro users: unlimited. Returns {allowed: bool, remaining: number, limit: number}. Increment count on tool use. Files: app/usage-limits.js. After done: git add app/usage-limits.js && git commit -m "[019] Tool usage limits (free tier caps)" && git push

### [020] upgrade-gate-component
Create app/upgrade-gate.js: showUpgradeGate(toolName) displays a blurred overlay with "You've used 3 free analyses today. Upgrade to Pro for unlimited access — $29/mo" with CTA button linking to pricing. Styled consistently with brand. Files: app/upgrade-gate.js, app/upgrade-gate.css. After done: git add app/upgrade-gate.js app/upgrade-gate.css && git commit -m "[020] Upgrade gate overlay component" && git push

### [021] security-headers-vercel
Add security headers to vercel.json: X-Content-Type-Options: nosniff, X-Frame-Options: DENY, X-XSS-Protection: 1;mode=block, Strict-Transport-Security, Referrer-Policy: strict-origin-when-cross-origin. Files: vercel.json. After done: git add vercel.json && git commit -m "[021] Security headers in vercel.json" && git push

### [022] csp-meta-tags
Add Content-Security-Policy meta tags to all HTML pages: default-src 'self', script-src 'self' trusted CDNs (firebase, stripe, google analytics), style-src 'self' 'unsafe-inline', img-src 'self' data: https:. Files: all *.html files. After done: git add -A && git commit -m "[022] CSP meta tags on all pages" && git push

### [023] error-monitoring-sentry
Add Sentry free tier: include Sentry CDN script in all pages, init with DSN from env. Capture unhandled errors and promise rejections. Add SENTRY_DSN to .env.example. Files: app/sentry-init.js, .env.example. After done: git add app/sentry-init.js .env.example && git commit -m "[023] Sentry error monitoring setup" && git push

### [024] ssl-mixed-content-audit
Audit ALL html files for mixed content: any http:// references to scripts, stylesheets, images, fonts. Replace all with https:// or protocol-relative //. Files: all *.html. After done: git add -A && git commit -m "[024] Fix mixed content — all HTTPS" && git push

### [025] favicon-manifest-pwa
Create PWA manifest.json with: name "Cortex Freelancer", short_name "Cortex", icons (192x192, 512x512), theme_color, background_color, display: standalone, start_url: /app. Add <link rel="manifest"> to all pages. Create basic service-worker.js that caches app shell. Files: manifest.json, service-worker.js, update all HTML <head>. After done: git add manifest.json service-worker.js && git commit -m "[025] PWA manifest and service worker" && git push

### [026] api-webhook-signature-verify
Harden api/webhook.js: properly verify Stripe webhook signature using STRIPE_WEBHOOK_SECRET. Reject requests with invalid signatures (return 400). Log signature verification failures. Files: api/webhook.js. After done: git add api/webhook.js && git commit -m "[026] Stripe webhook signature verification" && git push

### [027] api-checkout-session-verify
Harden api/checkout-status.js: verify session_id format before Stripe API call, handle expired sessions, handle already-used sessions. Return clear status codes. Files: api/checkout-status.js. After done: git add api/checkout-status.js && git commit -m "[027] Checkout status verification hardening" && git push

### [028] data-directory-gitignore
Ensure data/ directory for waitlist/customer JSON files is in .gitignore but directory exists. Create data/.gitkeep. Verify no sensitive data is committed. Files: .gitignore, data/.gitkeep. After done: git add .gitignore data/.gitkeep && git commit -m "[028] Data directory gitignore safety" && git push

### [029] api-admin-auth-harden
Harden api/toggle-pro.js: add timing-safe comparison for ADMIN_TOKEN, add request logging (IP, email, action), add rate limit (5 req/min). Files: api/toggle-pro.js. After done: git add api/toggle-pro.js && git commit -m "[029] Admin endpoint security hardening" && git push

### [030] stripe-price-ids-config
Create config/stripe-prices.js that exports price IDs from env vars with validation. Used by checkout.js. Log warning if using test keys in production. Files: config/stripe-prices.js, update api/checkout.js. After done: git add config/stripe-prices.js api/checkout.js && git commit -m "[030] Centralized Stripe price config" && git push

### [031] api-customer-endpoint-enhance
Update api/customer.js: return richer data — plan type, subscription status (active/past_due/canceled), current period end, tool usage counts, member since date. Files: api/customer.js. After done: git add api/customer.js && git commit -m "[031] Enhanced customer status endpoint" && git push

### [032] vercel-deploy-production
Create deployment checklist script scripts/deploy-check.sh: verify all env vars set, run basic lint, check no console.log in api files, verify vercel.json routes. Print GO/NO-GO. Files: scripts/deploy-check.sh. After done: git add scripts/deploy-check.sh && git commit -m "[032] Deployment checklist script" && git push

### [033] stripe-annual-plan-checkout
Update api/checkout.js to handle plan='annual' — use STRIPE_PRICE_PRO_ANNUAL price ID. Update checkout flow on pricing.html to pass plan parameter based on monthly/annual toggle. Files: api/checkout.js, pricing.html. After done: git add api/checkout.js pricing.html && git commit -m "[033] Annual plan checkout support" && git push

### [034] stripe-subscription-status-api
Create api/subscription.js: GET endpoint takes email or uid, returns current subscription details from Stripe (status, current_period_end, cancel_at_period_end, plan). Files: api/subscription.js, vercel.json. After done: git add api/subscription.js vercel.json && git commit -m "[034] Subscription status API" && git push

### [035] email-service-setup
Create api/_services/email.js: wrapper around Resend API (free tier, 100 emails/day). Functions: sendWelcomeEmail(to, name), sendProActivatedEmail(to, name), sendReceiptEmail(to, name, amount). Add RESEND_API_KEY to .env.example. Files: api/_services/email.js, .env.example. After done: git add api/_services/email.js .env.example && git commit -m "[035] Email service setup (Resend)" && git push

### [036] welcome-email-on-signup
After Firebase Auth first login (createdAt === lastLoginAt), call api/send-email endpoint to send welcome email. "Welcome to Cortex — here are your free tools." Files: api/send-email.js, vercel.json. After done: git add api/send-email.js vercel.json && git commit -m "[036] Welcome email on first signup" && git push

### [037] pro-activated-email
After Stripe webhook sets isPro=true, send Pro activation email: "You're now a Pro! Here's everything you unlocked." Include quick links to all Pro tools. Files: api/webhook.js (extend). After done: git add api/webhook.js && git commit -m "[037] Pro activated confirmation email" && git push

### [038] api-waitlist-enhance
Update api/waitlist.js: add name field, source (utm_source), timestamp, validate email format, prevent duplicates, return count. Files: api/waitlist.js. After done: git add api/waitlist.js && git commit -m "[038] Enhanced waitlist endpoint" && git push

### [039] uptime-monitoring-setup
Create docs/MONITORING.md with instructions to set up free UptimeRobot monitors for: cortexfreelancer.com (HTTPS), /api/health (keyword: ok), /api/waitlist/count (keyword). Include alert email config. Files: docs/MONITORING.md. After done: git add docs/MONITORING.md && git commit -m "[039] Uptime monitoring setup guide" && git push

### [040] github-actions-lint
Create .github/workflows/lint.yml: on push to main and PRs, run basic checks — verify all HTML files are valid (no unclosed tags), check no secrets in code (grep for sk_live, sk_test patterns), verify vercel.json is valid JSON. Files: .github/workflows/lint.yml. After done: git add .github/workflows/lint.yml && git commit -m "[040] GitHub Actions lint workflow" && git push

### [041] api-error-response-format
Create api/_middleware/error-handler.js: standardized error response format {success: false, error: {message, code, type}}. Wrap all API endpoints. Never expose stack traces in production. Files: api/_middleware/error-handler.js. After done: git add api/_middleware/error-handler.js && git commit -m "[041] Standardized API error responses" && git push

### [042] firestore-indexes
Create firestore.indexes.json with composite indexes needed: users by email, events by uid+timestamp, events by event+timestamp. Files: firestore.indexes.json. After done: git add firestore.indexes.json && git commit -m "[042] Firestore index definitions" && git push

### [043] firestore-security-rules
Create firestore.rules: users/{uid} readable/writable only by that uid. Events writable by authenticated users, readable by admins only. Pro status writable only by server (admin SDK). Files: firestore.rules. After done: git add firestore.rules && git commit -m "[043] Firestore security rules" && git push

### [044] env-audit-no-secrets-client
Audit ALL client-side JS and HTML files: ensure no API keys, secrets, or tokens are hardcoded. Firebase config is OK (it's public). Flag any sk_test, sk_live, whsec_, admin tokens. Files: all *.html, all *.js in app/. After done: git add -A && git commit -m "[044] Client-side secrets audit — clean" && git push

### [045] api-docs-openapi
Create docs/api-spec.yaml: OpenAPI 3.0 spec for all API endpoints. Document request/response schemas, status codes, auth requirements. Files: docs/api-spec.yaml. After done: git add docs/api-spec.yaml && git commit -m "[045] OpenAPI spec for all endpoints" && git push

### [046] vercel-cron-subscription-check
Create api/cron/check-subscriptions.js: daily cron that checks Firestore for users with proExpiresAt < now and isPro=true, sets isPro=false. Add cron config to vercel.json. Files: api/cron/check-subscriptions.js, vercel.json. After done: git add api/cron/check-subscriptions.js vercel.json && git commit -m "[046] Daily subscription expiry cron" && git push

### [047] package-json-scripts
Update package.json: add scripts for dev, start, lint, deploy-check. Ensure all dependencies listed (stripe, express, firebase-admin if used server-side). Files: package.json. After done: git add package.json && git commit -m "[047] Package.json scripts and deps" && git push

### [048] shared-html-head
Create app/_includes/head.html (or a JS function that injects shared <head> content): meta charset, viewport, favicon, manifest, GA4 snippet, Sentry init, Firebase SDK, common CSS. Reduces duplication. Files: app/_includes/head.js. After done: git add app/_includes/head.js && git commit -m "[048] Shared HTML head component" && git push

### [049] shared-nav-component
Create app/_includes/nav.js: dynamic nav component injected on all pages. Shows: logo, Home, Tools, Pricing, Sign In/User avatar. Highlights active page. Responsive hamburger on mobile. Files: app/_includes/nav.js, app/_includes/nav.css. After done: git add app/_includes/nav.js app/_includes/nav.css && git commit -m "[049] Shared navigation component" && git push

### [050] shared-footer-component
Create app/_includes/footer.js: consistent footer on all pages. Links: Tools, Pricing, Terms, Privacy, Contact. Social icons. "© 2026 Cortex Freelancer" copyright. Files: app/_includes/footer.js, app/_includes/footer.css. After done: git add app/_includes/footer.js app/_includes/footer.css && git commit -m "[050] Shared footer component" && git push

---
## 🧰 TOOL POLISH & NEW TOOLS (051-100)
---

### [051] invoice-validation-edge-cases
Update app/tools/invoice.html: validate all fields before generate (client name required, amount > 0, valid email format, due date in future). Show inline error messages. Disable generate button until valid. Files: app/tools/invoice.html. After done: git add app/tools/invoice.html && git commit -m "[051] Invoice generator validation" && git push

### [052] invoice-pdf-improvement
Update app/tools/invoice.html: improve PDF output — add company logo placeholder, proper table formatting, subtotal/tax/total breakdown, payment terms section, bank details section. Files: app/tools/invoice.html. After done: git add app/tools/invoice.html && git commit -m "[052] Invoice PDF quality improvement" && git push

### [053] invoice-save-drafts
Update app/tools/invoice.html: add "Save Draft" button that saves invoice data to localStorage (invoices array). Add "Load Draft" dropdown showing saved invoices. Add "Delete Draft" option. Files: app/tools/invoice.html. After done: git add app/tools/invoice.html && git commit -m "[053] Invoice save/load drafts" && git push

### [054] invoice-numbering-auto
Update app/tools/invoice.html: auto-generate sequential invoice numbers (INV-2026-001, INV-2026-002...) stored in localStorage. Allow manual override. Show last used number. Files: app/tools/invoice.html. After done: git add app/tools/invoice.html && git commit -m "[054] Auto invoice numbering" && git push

### [055] proposal-more-templates
Update app/tools/proposal.html: add 3 more proposal templates — "Quick Quote" (short, price-focused), "Case Study Proposal" (with portfolio examples section), "Retainer Proposal" (monthly ongoing work). Files: app/tools/proposal.html. After done: git add app/tools/proposal.html && git commit -m "[055] 3 new proposal templates" && git push

### [056] proposal-save-drafts
Update app/tools/proposal.html: add Save/Load/Delete draft functionality using localStorage. Show saved proposals list with client name and date. Files: app/tools/proposal.html. After done: git add app/tools/proposal.html && git commit -m "[056] Proposal save/load drafts" && git push

### [057] proposal-word-count
Update app/tools/proposal.html: add live word count, reading time estimate, and character count below the editor. Add "ideal length" guidance (300-500 words for most proposals). Files: app/tools/proposal.html. After done: git add app/tools/proposal.html && git commit -m "[057] Proposal word/character count" && git push

### [058] rate-calculator-more-countries
Update app/tools/rate-calculator.html: add market data for Egypt, Pakistan, Nigeria, Turkey, Philippines, India, Bangladesh. Include average rates by skill category, cost of living index, typical platform fees. Files: app/tools/rate-calculator.html. After done: git add app/tools/rate-calculator.html && git commit -m "[058] Rate calculator — 7 new countries" && git push

### [059] rate-calculator-skill-categories
Update app/tools/rate-calculator.html: add skill-specific rates for: Web Development, Mobile Development, UI/UX Design, Graphic Design, Content Writing, SEO, Digital Marketing, Video Editing, Data Entry, Virtual Assistant. Files: app/tools/rate-calculator.html. After done: git add app/tools/rate-calculator.html && git commit -m "[059] Rate calculator skill categories" && git push

### [060] fee-calculator-more-platforms
Update app/tools/fee-calculator.html: add Toptal (0% fee), PeoplePerHour (15-20%), 99designs (varies), Guru (5-9%), FlexJobs (subscription), We Work Remotely (flat fee). Update comparison table. Files: app/tools/fee-calculator.html. After done: git add app/tools/fee-calculator.html && git commit -m "[060] Fee calculator — 6 more platforms" && git push

### [061] fee-calculator-annual-savings
Update app/tools/fee-calculator.html: add "Annual Savings with Cenoa" section — calculate how much freelancer saves per year by using Cenoa vs each platform. Show compelling dollar amounts. Files: app/tools/fee-calculator.html. After done: git add app/tools/fee-calculator.html && git commit -m "[061] Fee calculator annual savings view" && git push

### [062] contract-review-more-patterns
Update app/tools/contract-review.html: add 15 more red flag patterns — non-compete clauses, IP ownership traps, unlimited revision clauses, "work for hire" without fair compensation, payment net-90+, auto-renewal traps, penalty clauses, confidentiality overreach. Files: app/tools/contract-review.html. After done: git add app/tools/contract-review.html && git commit -m "[062] Contract review — 15 more red flags" && git push

### [063] contract-review-score-explanation
Update app/tools/contract-review.html: add detailed explanation for each risk score factor. Show "Why this matters" tooltip/expandable for each detected flag. Add "How to negotiate this" suggestion. Files: app/tools/contract-review.html. After done: git add app/tools/contract-review.html && git commit -m "[063] Contract review score explanations" && git push

### [064] scope-analyzer-industry-templates
Update app/tools/scope-analyzer.html: add industry-specific scope templates — Web Development (frontend, backend, full-stack), Design (logo, branding, UI/UX), Writing (blog, copywriting, technical), Marketing (SEO, social media, email). Pre-fill deliverables. Files: app/tools/scope-analyzer.html. After done: git add app/tools/scope-analyzer.html && git commit -m "[064] Scope analyzer industry templates" && git push

### [065] scope-analyzer-export
Update app/tools/scope-analyzer.html: add "Export as PDF" and "Copy as Text" buttons for scope analysis results. PDF includes deliverables table, hour estimates, suggested quote range. Files: app/tools/scope-analyzer.html. After done: git add app/tools/scope-analyzer.html && git commit -m "[065] Scope analyzer export options" && git push

### [066] email-writer-more-scenarios
Update app/tools/email-writer.html: add 5 more email scenarios — "Scope Change Request" (client wants more work), "Payment Reminder" (overdue invoice), "Project Completion" (final delivery), "Testimonial Request" (ask for review), "Rate Increase Notice" (annual rate bump). Files: app/tools/email-writer.html. After done: git add app/tools/email-writer.html && git commit -m "[066] Email writer — 5 new scenarios" && git push

### [067] email-writer-tone-selector
Update app/tools/email-writer.html: add tone selector — Professional, Friendly, Firm, Apologetic, Enthusiastic. Adjust generated email language based on selected tone. Files: app/tools/email-writer.html. After done: git add app/tools/email-writer.html && git commit -m "[067] Email writer tone selector" && git push

### [068] payment-checker-more-platforms
Update app/tools/payment-checker.html: add payment timeline data for more platforms — Toptal (weekly), PeoplePerHour (varies), 99designs (on release), Guru (varies), direct clients (net-30 typical). Files: app/tools/payment-checker.html. After done: git add app/tools/payment-checker.html && git commit -m "[068] Payment checker — more platforms" && git push

### [069] payment-checker-calendar-view
Update app/tools/payment-checker.html: add visual calendar showing expected payment dates. Color-coded: green (received), yellow (pending), red (overdue). Helps freelancers plan cash flow. Files: app/tools/payment-checker.html. After done: git add app/tools/payment-checker.html && git commit -m "[069] Payment checker calendar view" && git push

### [070] tools-hub-redesign
Redesign app/tools/index.html: card grid layout with tool icons (emoji or SVG), tool name, one-line description, "Free" or "Pro" badge, usage count. Search/filter by category. Responsive 2-col mobile, 3-col desktop. Files: app/tools/index.html. After done: git add app/tools/index.html && git commit -m "[070] Tools hub redesign — card grid" && git push

### [071] tools-hub-categories
Update app/tools/index.html: add category tabs/filters — "Money" (invoice, fee calc, rate calc, payment checker), "Clients" (proposal, email, contract), "Business" (scope analyzer, templates). Show tool count per category. Files: app/tools/index.html. After done: git add app/tools/index.html && git commit -m "[071] Tools hub category filters" && git push

### [072] tool-loading-states
Add skeleton loading screens to ALL tool pages: when processing/calculating, show animated placeholder blocks instead of blank space. Create shared app/loading-skeleton.css with reusable skeleton classes. Files: app/loading-skeleton.css, update all app/tools/*.html. After done: git add app/loading-skeleton.css && git commit -m "[072] Skeleton loading states all tools" && git push

### [073] tool-empty-states
Add friendly empty states to ALL tool pages: when no data/results yet, show illustration (CSS art or emoji) + helpful text + CTA. "No invoices yet — create your first one!" style. Files: update all app/tools/*.html. After done: git add -A && git commit -m "[073] Empty states for all tools" && git push

### [074] tool-result-share-button
Add "Share Result" button to every tool output: generates a unique URL or copies result summary to clipboard. "📋 Copied!" toast notification. Files: app/share-result.js, update all app/tools/*.html. After done: git add app/share-result.js && git commit -m "[074] Share result button on all tools" && git push

### [075] tool-feedback-widget
Add mini feedback widget at bottom of every tool page: "Was this helpful? 👍 👎" with optional text feedback. Store in localStorage, batch send to api/feedback endpoint. Files: app/feedback-widget.js, api/feedback.js. After done: git add app/feedback-widget.js api/feedback.js && git commit -m "[075] Tool feedback widget" && git push

### [076] bio-generator-tool
Create app/tools/bio-generator.html: new tool. Input: name, skills (multi-select), years of experience, niche, tone (professional/casual/creative). Output: 3 bio variants — Upwork bio (500 char), LinkedIn summary (300 word), Twitter bio (160 char). Copy buttons for each. Files: app/tools/bio-generator.html, update app/tools/index.html, vercel.json. After done: git add app/tools/bio-generator.html app/tools/index.html vercel.json && git commit -m "[076] Bio generator tool" && git push

### [077] portfolio-review-tool
Create app/tools/portfolio-review.html: new tool. Input: paste portfolio URL or describe portfolio. Output: checklist-based review — has clear CTA? shows pricing? has testimonials? mobile-friendly? fast loading? SEO basics? Score out of 100 with improvement suggestions. Files: app/tools/portfolio-review.html, update app/tools/index.html, vercel.json. After done: git add app/tools/portfolio-review.html && git commit -m "[077] Portfolio review tool" && git push

### [078] meeting-notes-tool
Create app/tools/meeting-notes.html: new tool. Input: paste raw meeting notes/transcript. Output: structured summary — key decisions, action items with owners, deadlines, follow-up needed. Copy as formatted text or email. Files: app/tools/meeting-notes.html, update app/tools/index.html, vercel.json. After done: git add app/tools/meeting-notes.html && git commit -m "[078] Meeting notes tool" && git push

### [079] tax-estimator-tool
Create app/tools/tax-estimator.html: new tool. Input: annual income, country (EG/PK/NG/TR/UK/US), expenses. Output: estimated tax liability, effective tax rate, quarterly payment amounts, deduction suggestions. Disclaimer: "Not tax advice." Files: app/tools/tax-estimator.html, update app/tools/index.html, vercel.json. After done: git add app/tools/tax-estimator.html && git commit -m "[079] Tax estimator tool" && git push

### [080] project-brief-generator
Create app/tools/project-brief.html: new tool. Input: project type, client industry, objectives, budget range, timeline. Output: professional project brief document — overview, objectives, deliverables, timeline, budget breakdown, terms. Copy or PDF export. Files: app/tools/project-brief.html, update app/tools/index.html, vercel.json. After done: git add app/tools/project-brief.html && git commit -m "[080] Project brief generator tool" && git push

### [081] sow-generator-tool
Create app/tools/sow-generator.html: new tool. Input: project name, scope items, milestones, rates, payment terms. Output: Statement of Work document with sections — Scope, Deliverables, Timeline, Payment Schedule, Change Request Process, Signatures. PDF export. Files: app/tools/sow-generator.html, update app/tools/index.html, vercel.json. After done: git add app/tools/sow-generator.html && git commit -m "[081] Statement of Work generator" && git push

### [082] client-red-flag-tool
Create app/tools/client-red-flags.html: new tool. Input: paste job posting or client communication. Output: red flag analysis — vague scope? unrealistic timeline? below-market rate? spec work request? too many revisions? Score: Safe/Caution/Avoid. Files: app/tools/client-red-flags.html, update app/tools/index.html, vercel.json. After done: git add app/tools/client-red-flags.html && git commit -m "[082] Client red flag detector tool" && git push

### [083] invoice-all-tools-pro-badges
Update ALL tool pages: add "Pro" badge on Pro-only features within each tool. Free users see the feature but blurred/locked with "Unlock with Pro" micro-CTA. Consistent badge styling across tools. Files: app/pro-badge.css, update all app/tools/*.html. After done: git add app/pro-badge.css && git commit -m "[083] Pro badges on all tool features" && git push

### [084] tool-keyboard-shortcuts
Add keyboard shortcuts to all tools: Ctrl+Enter to generate/submit, Ctrl+C to copy result, Ctrl+S to save draft, Ctrl+P to export PDF. Show shortcuts hint at bottom of each tool. Files: app/keyboard-shortcuts.js. After done: git add app/keyboard-shortcuts.js && git commit -m "[084] Keyboard shortcuts for tools" && git push

### [085] tool-recent-history
Create app/tool-history.js: track last 5 uses of each tool in localStorage. Show "Recent" section at top of each tool with quick-reload links. Helps users re-access previous calculations. Files: app/tool-history.js. After done: git add app/tool-history.js && git commit -m "[085] Tool usage history (last 5)" && git push

### [086] tool-data-interconnection
Enable data flow between tools: invoice data can pre-fill proposal (client name, project, amount). Scope analyzer output feeds into invoice line items. Rate calculator feeds into scope analyzer hourly rate. Files: app/tool-data-bridge.js. After done: git add app/tool-data-bridge.js && git commit -m "[086] Tool data interconnection bridge" && git push

### [087] tool-print-friendly
Add print-friendly CSS to all tool result pages: @media print styles that hide nav, footer, buttons; show clean formatted output. "Print" button on each tool. Files: app/print-tools.css, update tools. After done: git add app/print-tools.css && git commit -m "[087] Print-friendly tool outputs" && git push

### [088] templates-search-improve
Update app/tools/templates.html: improve search — fuzzy matching, search by category, search by skill/industry. Highlight matching text in results. Show "No results — try broader terms" empty state. Files: app/tools/templates.html. After done: git add app/tools/templates.html && git commit -m "[088] Templates search improvement" && git push

### [089] templates-preview-modal
Update app/tools/templates.html: click template card opens modal with full preview — formatted content, "Use This Template" button that opens the relevant tool with template pre-filled, "Copy" button. Files: app/tools/templates.html. After done: git add app/tools/templates.html && git commit -m "[089] Template preview modal" && git push

### [090] templates-categories-filter
Update app/tools/templates.html: add category filter chips — Proposals, Invoices, Contracts, Emails, Briefs, SOW. Show count per category. Active filter highlighted. Multiple filters combinable. Files: app/tools/templates.html. After done: git add app/tools/templates.html && git commit -m "[090] Template category filter chips" && git push

### [091] tool-usage-analytics-display
Update app/tools/index.html: show usage stats per tool — "Used 1,234 times" (aggregate from Firestore or hardcoded initial numbers). Creates social proof. Update weekly via cron. Files: app/tools/index.html. After done: git add app/tools/index.html && git commit -m "[091] Tool usage stats display" && git push

### [092] invoice-multi-currency
Update app/tools/invoice.html: add currency selector — USD, EUR, GBP, EGP, PKR, NGN, TRY, PHP, INR, BDT. Currency symbol updates in preview and PDF. Files: app/tools/invoice.html. After done: git add app/tools/invoice.html && git commit -m "[092] Invoice multi-currency support" && git push

### [093] invoice-line-items-table
Update app/tools/invoice.html: allow multiple line items — add/remove rows. Each row: description, quantity, rate, amount (auto-calc). Subtotal, tax %, total auto-calculated. Files: app/tools/invoice.html. After done: git add app/tools/invoice.html && git commit -m "[093] Invoice multi-line items" && git push

### [094] proposal-ai-enhance-placeholder
Update app/tools/proposal.html: add "✨ AI Enhance" button (Pro feature) that shows placeholder: "Coming soon — AI will rewrite your proposal for maximum impact." Blurred for free users. Builds anticipation. Files: app/tools/proposal.html. After done: git add app/tools/proposal.html && git commit -m "[094] Proposal AI enhance placeholder" && git push

### [095] contract-review-export
Update app/tools/contract-review.html: add "Export Review" button — generates PDF report of contract analysis: risk score, flags found, recommendations. Professional formatting. Files: app/tools/contract-review.html. After done: git add app/tools/contract-review.html && git commit -m "[095] Contract review PDF export" && git push

### [096] tool-onboarding-tooltips
Add first-time tooltips to each tool: highlight key features with step-by-step tooltips (1/3, 2/3, 3/3). Show once per tool, track in localStorage. "Got it" to dismiss. Files: app/onboarding-tooltips.js, app/onboarding-tooltips.css. After done: git add app/onboarding-tooltips.js app/onboarding-tooltips.css && git commit -m "[096] Tool onboarding tooltips" && git push

### [097] tool-accessibility-aria
Add ARIA labels, roles, and keyboard navigation to ALL tool forms. Ensure tab order is logical, inputs have labels, buttons have aria-label, error messages linked with aria-describedby. Files: update all app/tools/*.html. After done: git add -A && git commit -m "[097] Accessibility ARIA labels all tools" && git push

### [098] email-writer-copy-formatting
Update app/tools/email-writer.html: "Copy" button copies with proper formatting (paragraphs, greeting, signature). Add "Copy as Plain Text" and "Copy as HTML" options. Files: app/tools/email-writer.html. After done: git add app/tools/email-writer.html && git commit -m "[098] Email writer copy formatting" && git push

### [099] scope-analyzer-comparison
Update app/tools/scope-analyzer.html: add "Compare Scopes" feature — save multiple scope analyses and compare side by side (hours, cost, deliverables). Helps when evaluating different project approaches. Files: app/tools/scope-analyzer.html. After done: git add app/tools/scope-analyzer.html && git commit -m "[099] Scope analyzer comparison view" && git push

### [100] tools-powered-by-cortex
Add "Powered by Cortex Freelancer" watermark to all free-tier PDF/text exports. Pro users get clean exports without watermark. Subtle branding that drives viral awareness. Files: app/export-watermark.js. After done: git add app/export-watermark.js && git commit -m "[100] Powered by Cortex watermark on free exports" && git push

---
## 🚀 FRONTEND & UX (101-150)
---

### [101] onboarding-wizard-3step
Create app/onboarding.html: 3-step wizard for first-time users. Step 1: "What do you do?" (developer, designer, writer, marketer, VA, other). Step 2: "Where do you work?" (Upwork, Fiverr, Freelancer, direct clients, multiple). Step 3: "What's your biggest challenge?" (finding clients, pricing, invoicing, time management). Save answers to localStorage and Firestore. Recommend relevant tools based on answers. Files: app/onboarding.html, app/onboarding.js. After done: git add app/onboarding.html app/onboarding.js && git commit -m "[101] 3-step onboarding wizard" && git push

### [102] user-dashboard-main
Create app/dashboard.html: post-login home page. Sections: "Welcome back, [Name]" greeting, Quick Actions (4 most-used tools), Recent Activity (last 5 tool uses), Pro Status card (free → upgrade CTA, pro → subscription details), Saved Items count. Responsive grid layout. Files: app/dashboard.html, app/dashboard.js, app/dashboard.css. After done: git add app/dashboard.html app/dashboard.js app/dashboard.css && git commit -m "[102] User dashboard main page" && git push

### [103] dashboard-saved-analyses
Add "Saved Analyses" section to dashboard: list of past Upwork profile analyses with date, profile name, score. Click to re-view. "Analyze Another Profile" CTA. Store in Firestore for Pro, localStorage for free. Files: app/dashboard.js (extend). After done: git add app/dashboard.js && git commit -m "[103] Dashboard saved analyses section" && git push

### [104] dashboard-saved-invoices
Add "My Invoices" section to dashboard: list of saved invoice drafts with client name, amount, date, status (draft/sent/paid). Quick actions: edit, duplicate, download PDF. Files: app/dashboard.js (extend). After done: git add app/dashboard.js && git commit -m "[104] Dashboard saved invoices section" && git push

### [105] dashboard-saved-proposals
Add "My Proposals" section to dashboard: list of saved proposal drafts with project name, client, date. Quick actions: edit, duplicate, copy. Files: app/dashboard.js (extend). After done: git add app/dashboard.js && git commit -m "[105] Dashboard saved proposals section" && git push

### [106] dashboard-subscription-card
Add subscription status card to dashboard: Free users see "Free Plan — 3 uses/day" with usage bar and "Upgrade to Pro" CTA. Pro users see "Pro Plan — Unlimited" with next billing date and "Manage Subscription" link to Stripe portal. Files: app/dashboard.js (extend). After done: git add app/dashboard.js && git commit -m "[106] Dashboard subscription status card" && git push

### [107] nav-redesign-responsive
Redesign navigation: desktop — horizontal top nav with logo, tool links, pricing, dashboard, auth. Mobile — hamburger menu with slide-out sidebar. Active page indicator. Sticky on scroll. Smooth transitions. Files: app/_includes/nav.js, app/_includes/nav.css (update). After done: git add app/_includes/nav.js app/_includes/nav.css && git commit -m "[107] Navigation redesign responsive" && git push

### [108] landing-page-hero-rewrite
Rewrite index.html hero section: headline "Your AI Business Manager" → more specific "Stop Losing Money on Bad Rates, Late Invoices, and Weak Proposals". Add sub-headline with 3 specific pain points solved. Bigger CTA: "Analyze Your Profile Free →". Social proof: "Join 500+ freelancers" (aspirational). Files: index.html. After done: git add index.html && git commit -m "[108] Landing page hero copy rewrite" && git push

### [109] landing-page-tool-showcase
Add tool showcase section to index.html: 6 cards showing top tools with mini-preview screenshots (CSS mockups), tool name, one-line value prop, "Try Free →" link. Carousel on mobile, grid on desktop. Files: index.html. After done: git add index.html && git commit -m "[109] Landing page tool showcase section" && git push

### [110] landing-page-social-proof
Add social proof section to index.html: 3 testimonial cards (placeholder with realistic names/photos/quotes from target markets — EG, PK, TR). Star ratings. "As featured in" logos placeholder row. Files: index.html. After done: git add index.html && git commit -m "[110] Landing page social proof section" && git push

### [111] landing-page-how-it-works
Add "How It Works" section to index.html: 3 steps with icons — 1. "Analyze Your Profile" (paste URL, get score), 2. "Use AI Tools" (invoices, proposals, contracts), 3. "Grow Your Business" (track earnings, find jobs). Clean numbered steps design. Files: index.html. After done: git add index.html && git commit -m "[111] Landing page how-it-works section" && git push

### [112] landing-page-pricing-preview
Add pricing preview section to index.html: side-by-side Free vs Pro comparison. Free: 3 daily uses, basic tools. Pro: unlimited, all tools, job scanner, email support. "$29/mo — Start Free →" CTA. Links to /pricing for details. Files: index.html. After done: git add index.html && git commit -m "[112] Landing page pricing preview" && git push

### [113] landing-page-faq
Add FAQ section to index.html: 6 accordion items — "Is it really free?", "What platforms do you support?", "How does the profile analysis work?", "Can I cancel anytime?", "Is my data secure?", "What's included in Pro?". Collapsible/expandable. Files: index.html. After done: git add index.html && git commit -m "[113] Landing page FAQ section" && git push

### [114] landing-page-final-cta
Add strong final CTA section above footer on index.html: "Ready to Level Up Your Freelance Business?" with email input + "Get Started Free" button. Or just a big button linking to /app. Dark background, high contrast. Files: index.html. After done: git add index.html && git commit -m "[114] Landing page final CTA section" && git push

### [115] pricing-page-redesign
Redesign pricing.html: monthly/annual toggle (annual shows "Save 28%"), 2-column comparison (Free vs Pro), feature checklist with checkmarks/x-marks, highlight "Most Popular" on Pro, FAQ section, money-back guarantee badge. Files: pricing.html. After done: git add pricing.html && git commit -m "[115] Pricing page redesign" && git push

### [116] pricing-page-annual-toggle
Add functional monthly/annual toggle to pricing.html: default monthly ($29/mo), click annual shows $249/yr ($20.75/mo) with "Save $99/year" badge. Toggle updates price display and checkout CTA link. Smooth animation. Files: pricing.html. After done: git add pricing.html && git commit -m "[116] Pricing page annual toggle" && git push

### [117] checkout-success-polish
Update checkout-success.html: show plan details purchased, "What's Next" guide (3 quick-start steps: try invoice gen, analyze profile, set up job alerts), confetti animation, "Share on Twitter" button with pre-filled text. Files: checkout-success.html. After done: git add checkout-success.html && git commit -m "[117] Checkout success page polish" && git push

### [118] page-404-branded
Create 404.html: branded 404 page — "Oops, this page doesn't exist" with illustration (CSS art), search bar, links to: Home, Tools, Pricing, Support. Fun tone: "Even the best freelancers get lost sometimes." Add 404 route to vercel.json. Files: 404.html, vercel.json. After done: git add 404.html vercel.json && git commit -m "[118] Branded 404 page" && git push

### [119] page-500-error
Create 500.html: server error page — "Something went wrong on our end" with apologetic message, "Try Again" button, "Contact Support" link. Add to vercel.json error handling. Files: 500.html, vercel.json. After done: git add 500.html vercel.json && git commit -m "[119] 500 error page" && git push

### [120] page-offline
Create offline.html: offline fallback page (served by service worker). "You're offline — but your saved tools still work!" Link to cached tool pages. Show last sync time. Files: offline.html, update service-worker.js. After done: git add offline.html service-worker.js && git commit -m "[120] Offline fallback page" && git push

### [121] dark-mode-toggle
Implement dark/light mode: CSS custom properties for all colors, toggle button in nav (sun/moon icon), persist preference in localStorage, respect prefers-color-scheme media query as default. Create app/theme.js and app/theme.css with dark mode variables. Files: app/theme.js, app/theme.css. After done: git add app/theme.js app/theme.css && git commit -m "[121] Dark/light mode toggle" && git push

### [122] dark-mode-all-pages
Apply dark mode CSS variables to ALL pages: index.html, pricing.html, all app/*.html, all app/tools/*.html. Ensure readable contrast, proper borders, input fields styled. Test every page in both modes. Files: all *.html, app/theme.css. After done: git add -A && git commit -m "[122] Dark mode applied to all pages" && git push

### [123] animations-page-transitions
Add subtle page entry animations: sections fade-in-up on scroll using IntersectionObserver. Tool cards scale-in on load. Buttons have hover lift effect. Keep animations under 300ms, respect prefers-reduced-motion. Files: app/animations.css, app/animations.js. After done: git add app/animations.css app/animations.js && git commit -m "[123] Page transition animations" && git push

### [124] animations-tool-results
Add result reveal animations to all tools: when calculation/generation completes, result section slides in from right with fade. Score numbers count up. Progress bars fill with animation. Files: app/result-animations.js. After done: git add app/result-animations.js && git commit -m "[124] Tool result reveal animations" && git push

### [125] confetti-first-invoice
Add confetti celebration when user generates their first invoice: detect first-time via localStorage flag, trigger confetti CSS animation, show "🎉 Your first invoice!" toast. Same for first proposal. Files: app/celebrations.js, app/celebrations.css. After done: git add app/celebrations.js app/celebrations.css && git commit -m "[125] First invoice/proposal confetti" && git push

### [126] responsive-audit-mobile
Audit ALL pages at 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1024px (iPad landscape), 1440px (desktop). Fix any overflow, cut-off text, unreadable fonts, broken layouts. Document fixes. Files: update all *.html CSS. After done: git add -A && git commit -m "[126] Responsive audit — all breakpoints fixed" && git push

### [127] responsive-tool-forms
Ensure all tool forms work perfectly on mobile: full-width inputs, large touch targets (44px min), visible labels, no horizontal scroll, keyboard doesn't cover inputs. Files: update all app/tools/*.html. After done: git add -A && git commit -m "[127] Mobile-perfect tool forms" && git push

### [128] typography-system
Create consistent typography system: app/typography.css with font scale (h1-h6, body, small, caption), line heights, letter spacing. Use system font stack (Inter, -apple-system, etc). Apply to all pages. Files: app/typography.css. After done: git add app/typography.css && git commit -m "[128] Typography system" && git push

### [129] color-system-consistent
Create app/colors.css: CSS custom properties for all brand colors — primary (blue), secondary, accent, success (green), warning (amber), error (red), neutral grays. Replace all hardcoded colors across pages. Files: app/colors.css. After done: git add app/colors.css && git commit -m "[129] Consistent color system" && git push

### [130] button-component-system
Create app/buttons.css: button component system — .btn-primary, .btn-secondary, .btn-outline, .btn-ghost, .btn-danger. Sizes: .btn-sm, .btn-md, .btn-lg. States: hover, active, disabled, loading. Apply to all pages. Files: app/buttons.css. After done: git add app/buttons.css && git commit -m "[130] Button component system" && git push

### [131] input-component-system
Create app/inputs.css: input/form component system — text inputs, textareas, selects, checkboxes, radio buttons. Consistent styling, focus states (visible outline), error states (red border + message), disabled states. Files: app/inputs.css. After done: git add app/inputs.css && git commit -m "[131] Input/form component system" && git push

### [132] toast-notification-system
Create app/toast.js: toast notification system — showToast(message, type, duration). Types: success (green), error (red), info (blue), warning (amber). Auto-dismiss after 3s. Stack multiple toasts. Position: bottom-right. Files: app/toast.js, app/toast.css. After done: git add app/toast.js app/toast.css && git commit -m "[132] Toast notification system" && git push

### [133] modal-component-system
Create app/modal.js: reusable modal component — openModal(content, options), closeModal(). Options: size (sm/md/lg), closable, onClose callback. Backdrop click closes. Escape key closes. Trap focus inside modal. Files: app/modal.js, app/modal.css. After done: git add app/modal.js app/modal.css && git commit -m "[133] Modal component system" && git push

### [134] breadcrumb-navigation
Add breadcrumb navigation to all tool pages: Home > Tools > Invoice Generator. Helps users understand where they are. Styled subtly above page title. Files: app/breadcrumbs.js, app/breadcrumbs.css. After done: git add app/breadcrumbs.js app/breadcrumbs.css && git commit -m "[134] Breadcrumb navigation" && git push

### [135] scroll-to-top-button
Add "scroll to top" button that appears when user scrolls down 500px. Smooth scroll animation. Subtle arrow-up icon, fixed bottom-right. Files: app/scroll-top.js, app/scroll-top.css. After done: git add app/scroll-top.js app/scroll-top.css && git commit -m "[135] Scroll to top button" && git push

### [136] page-loading-progress
Add thin progress bar at top of page (like YouTube/GitHub) that shows page load progress. Visible during navigation and tool processing. Files: app/progress-bar.js, app/progress-bar.css. After done: git add app/progress-bar.js app/progress-bar.css && git commit -m "[136] Page loading progress bar" && git push

### [137] image-optimization
Optimize all images: compress PNGs/JPGs, convert to WebP where possible, add width/height attributes to prevent layout shift, add loading="lazy" to below-fold images. Files: all *.html with images. After done: git add -A && git commit -m "[137] Image optimization and lazy loading" && git push

### [138] lighthouse-performance-audit
Run Lighthouse checks and fix: add preconnect hints for Firebase/Stripe/GA CDNs, defer non-critical JS, inline critical CSS, minify inline scripts, add meta description to all pages. Target >90 performance score. Files: all *.html. After done: git add -A && git commit -m "[138] Lighthouse performance fixes" && git push

### [139] meta-tags-all-pages
Ensure ALL pages have proper meta tags: title (unique per page), description (unique per page), og:title, og:description, og:image, twitter:card, canonical URL. Files: all *.html. After done: git add -A && git commit -m "[139] Meta tags on all pages" && git push

### [140] structured-data-schema
Add JSON-LD structured data to key pages: index.html (Organization, SoftwareApplication), pricing.html (Product with offers), tool pages (WebApplication). Helps Google rich results. Files: index.html, pricing.html. After done: git add index.html pricing.html && git commit -m "[140] Schema.org structured data" && git push

### [141] sitemap-xml
Create sitemap.xml listing all public pages with lastmod dates and priority. Include: /, /app, /pricing, /terms, /privacy, all /app/tools/* pages. Files: sitemap.xml, robots.txt. After done: git add sitemap.xml robots.txt && git commit -m "[141] Sitemap.xml and robots.txt" && git push

### [142] cookie-consent-banner
Create app/cookie-consent.js: GDPR cookie consent banner at bottom of screen. "We use cookies to improve your experience." Accept/Decline buttons. If declined, don't load GA4. Persist choice in localStorage. Files: app/cookie-consent.js, app/cookie-consent.css. After done: git add app/cookie-consent.js app/cookie-consent.css && git commit -m "[142] Cookie consent banner" && git push

### [143] keyboard-navigation-audit
Audit keyboard navigation on all pages: ensure all interactive elements are focusable, tab order is logical, focus is visible (outline), skip-to-content link on every page, no keyboard traps. Files: update all *.html. After done: git add -A && git commit -m "[143] Keyboard navigation audit fixes" && git push

### [144] screen-reader-audit
Add screen reader support: alt text on all images, aria-live regions for dynamic content (tool results), proper heading hierarchy (h1>h2>h3), form labels, button text. Files: update all *.html. After done: git add -A && git commit -m "[144] Screen reader accessibility fixes" && git push

### [145] viral-app-edge-cases
Update app/index.html: handle edge cases — invalid URLs (show "Please enter a valid Upwork profile URL"), private profiles ("This profile appears to be private"), rate limiting ("Please wait 30 seconds"), empty profiles, network errors. Friendly error messages. Files: app/index.html. After done: git add app/index.html && git commit -m "[145] Viral app edge case handling" && git push

### [146] viral-app-share-scorecard
Update app/index.html: add "Share Your Score" button after analysis. Generate shareable image (canvas to PNG) with profile score, key metrics, Cortex branding. "Share on Twitter" with pre-filled tweet. Copy link button. Files: app/index.html, app/scorecard-generator.js. After done: git add app/index.html app/scorecard-generator.js && git commit -m "[146] Shareable profile scorecard" && git push

### [147] viral-app-comparison
Update app/index.html: after analysis, add "Compare with Another Profile" button. Show side-by-side comparison of two profiles — who scores higher in each category. Drives second analysis (more engagement). Files: app/index.html. After done: git add app/index.html && git commit -m "[147] Profile comparison feature" && git push

### [148] viral-app-recommendations
Update app/index.html: after analysis, show "Personalized Recommendations" section — 3-5 specific tips based on score weaknesses (e.g., low description score → "Try our Bio Generator tool"). Links to relevant tools. Files: app/index.html. After done: git add app/index.html && git commit -m "[148] Post-analysis tool recommendations" && git push

### [149] admin-dashboard-enhance
Update admin.html: add sections for user stats (total users, Pro users, free users), recent signups, revenue summary (MRR, total), tool usage ranking, waitlist count. Require ADMIN_TOKEN to view. Files: admin.html. After done: git add admin.html && git commit -m "[149] Admin dashboard enhancement" && git push

### [150] contact-support-page
Create support.html: contact/support page with FAQ section, contact form (name, email, subject, message → sends to api/support), email link, response time expectation ("We reply within 24 hours"). Add to nav/footer. Files: support.html, api/support.js, vercel.json. After done: git add support.html api/support.js vercel.json && git commit -m "[150] Contact support page" && git push

---
## 💳 PAYMENT & MONETIZATION (151-180)
---

### [151] stripe-live-env-prep
Prepare for Stripe live mode: create docs/STRIPE_LIVE_CHECKLIST.md with step-by-step — create live products/prices, copy price IDs, set webhook endpoint, configure portal, test with real card. Include exact Stripe Dashboard URLs. Files: docs/STRIPE_LIVE_CHECKLIST.md. After done: git add docs/STRIPE_LIVE_CHECKLIST.md && git commit -m "[151] Stripe live mode checklist" && git push

### [152] stripe-billing-portal-ui
Add "Manage Subscription" button on dashboard and pricing page for Pro users. Calls api/portal.js to create Stripe portal session, redirects user. Shows: update payment method, cancel, view invoices. Files: app/dashboard.js, pricing.html. After done: git add app/dashboard.js pricing.html && git commit -m "[152] Billing portal UI integration" && git push

### [153] upgrade-prompts-contextual
Add contextual upgrade prompts throughout the app: after 3rd free tool use "You've used 3 of 3 free uses today", on Pro-only features "This is a Pro feature", on tool hub "Unlock all tools with Pro". Non-annoying, dismissible, max 1 per session. Files: app/upgrade-prompts.js. After done: git add app/upgrade-prompts.js && git commit -m "[153] Contextual upgrade prompts" && git push

### [154] pricing-comparison-table
Add detailed feature comparison table to pricing.html: rows for each tool/feature, columns Free vs Pro. Checkmarks and x-marks. Tooltips explaining each feature. Sticky header on scroll. Files: pricing.html. After done: git add pricing.html && git commit -m "[154] Pricing feature comparison table" && git push

### [155] pricing-faq-section
Add FAQ section to pricing.html: 8 questions — payment methods, cancellation, refunds, data after cancel, team pricing, discounts, annual savings, enterprise. Accordion style. Files: pricing.html. After done: git add pricing.html && git commit -m "[155] Pricing page FAQ section" && git push

### [156] pricing-money-back-guarantee
Add "7-Day Money Back Guarantee" badge to pricing.html and checkout flow. Shield icon with guarantee text. Add refund policy details in FAQ. Builds trust for first-time buyers. Files: pricing.html, checkout-success.html. After done: git add pricing.html checkout-success.html && git commit -m "[156] Money-back guarantee badge" && git push

### [157] receipt-email-config
Configure Stripe to send automatic receipt emails: document how to enable in Stripe Dashboard (Settings > Emails > Successful payments). Create branded receipt email template copy. Files: docs/STRIPE_EMAILS.md. After done: git add docs/STRIPE_EMAILS.md && git commit -m "[157] Stripe receipt email configuration" && git push

### [158] dunning-failed-payment
Configure Stripe dunning: document Smart Retries setup (3 attempts over 7 days). Create failed payment email template copy: "Your payment failed — update your card to keep Pro access." Files: docs/STRIPE_DUNNING.md. After done: git add docs/STRIPE_DUNNING.md && git commit -m "[158] Failed payment dunning setup" && git push

### [159] refund-policy-page
Create refund.html: clear refund policy — 7-day unconditional refund, how to request (email support@cortexfreelancer.com), processing time (3-5 business days), what happens to Pro access. Link from pricing + footer. Files: refund.html. After done: git add refund.html && git commit -m "[159] Refund policy page" && git push

### [160] coupon-system-stripe
Document how to create Stripe coupon codes: LAUNCH50 (50% off first month), FRIEND20 (20% off), ANNUAL10 (10% off annual). Create api/apply-coupon.js that validates coupon and applies to checkout session. Files: api/apply-coupon.js, docs/STRIPE_COUPONS.md, vercel.json. After done: git add api/apply-coupon.js docs/STRIPE_COUPONS.md vercel.json && git commit -m "[160] Coupon system with Stripe" && git push

### [161] coupon-ui-pricing-page
Add coupon code input field on pricing.html: "Have a coupon?" expandable section, text input, "Apply" button, shows discount if valid ("50% off your first month!"), updates displayed price. Files: pricing.html. After done: git add pricing.html && git commit -m "[161] Coupon code UI on pricing page" && git push

### [162] pro-badge-nav
Add "Pro" badge/icon in navigation for subscribed users: small crown or star icon next to user name. Visible on all pages. Gold/purple accent color. For free users, show subtle "Upgrade" link instead. Files: app/_includes/nav.js, app/_includes/nav.css. After done: git add app/_includes/nav.js app/_includes/nav.css && git commit -m "[162] Pro badge in navigation" && git push

### [163] free-to-pro-upgrade-flow
Create smooth upgrade flow: user clicks upgrade → pricing page → select plan → Stripe checkout → success page → dashboard with Pro active. No dead ends, clear progress. Test end-to-end. Files: pricing.html, checkout-success.html. After done: git add pricing.html checkout-success.html && git commit -m "[163] Smooth free-to-Pro upgrade flow" && git push

### [164] cancel-subscription-flow
Create cancellation flow: "Manage Subscription" → Stripe portal → cancel. Before redirect, show exit survey modal: "Why are you leaving?" options (too expensive, not enough features, found alternative, not using enough, other). Save response. Files: app/cancel-survey.js. After done: git add app/cancel-survey.js && git commit -m "[164] Cancel subscription with exit survey" && git push

### [165] subscription-expired-grace
Handle subscription expiry gracefully: when isPro goes false, show "Your Pro subscription has ended" banner with "Resubscribe" CTA, keep saved data accessible for 30 days (read-only), downgrade tool limits gradually. Files: app/pro-status.js (extend). After done: git add app/pro-status.js && git commit -m "[165] Graceful subscription expiry handling" && git push

### [166] revenue-admin-dashboard
Update admin.html: add revenue section — MRR (count Pro users × $29), total revenue all-time, new subscribers this week, churn count, average revenue per user. Pull from Firestore. Files: admin.html. After done: git add admin.html && git commit -m "[166] Admin revenue dashboard" && git push

### [167] pricing-social-proof
Add social proof to pricing.html: "Trusted by freelancers in 50+ countries", 3 mini testimonials with star ratings, "1,000+ invoices generated" stats counter. Builds buying confidence. Files: pricing.html. After done: git add pricing.html && git commit -m "[167] Pricing page social proof" && git push

### [168] pricing-urgency-banner
Add optional urgency banner to pricing.html: "Launch Special: 50% off your first month — ends Sunday" with countdown timer. Controlled via config so it can be turned on/off. Files: pricing.html, config/launch-promo.js. After done: git add pricing.html config/launch-promo.js && git commit -m "[168] Pricing urgency countdown banner" && git push

### [169] stripe-tax-config
Document VAT/GST handling: create docs/STRIPE_TAX.md explaining Stripe Tax setup for UK-based business selling to global customers. Stripe handles calculation and collection automatically. Files: docs/STRIPE_TAX.md. After done: git add docs/STRIPE_TAX.md && git commit -m "[169] Stripe tax configuration guide" && git push

### [170] free-trial-7day
Implement 7-day free trial: update Stripe checkout to include trial_period_days: 7. Update pricing page: "Start 7-Day Free Trial — No Credit Card Required" (or with card, depending on strategy). Update checkout-success for trial state. Files: api/checkout.js, pricing.html, checkout-success.html. After done: git add api/checkout.js pricing.html checkout-success.html && git commit -m "[170] 7-day free trial implementation" && git push

### [171] trial-expiry-email
Set up trial expiry reminder: 2 days before trial ends, show in-app banner "Your trial ends in 2 days — upgrade now to keep Pro features." Create email template for trial ending notification. Files: api/_services/email.js (add template), app/trial-banner.js. After done: git add api/_services/email.js app/trial-banner.js && git commit -m "[171] Trial expiry reminder" && git push

### [172] revenue-goals-tracker
Update admin.html: add revenue goals section — Target: $29 (1st customer), $290 (10 customers), $1,450 (50 customers). Show progress bar for each milestone. Celebrate when hit. Files: admin.html. After done: git add admin.html && git commit -m "[172] Revenue milestone goals tracker" && git push

### [173] pricing-ab-variant
Create pricing-b.html: A/B test variant of pricing page — different layout (horizontal cards vs vertical), different copy ("Investment" vs "Pricing"), different CTA ("Start Free" vs "Get Pro"). Track which converts better. Files: pricing-b.html. After done: git add pricing-b.html && git commit -m "[173] Pricing page A/B variant" && git push

### [174] checkout-abandoned-track
Track checkout abandonment: when user clicks "Get Pro" but doesn't complete Stripe checkout, log event. Show "Still thinking about Pro?" banner on next visit with 10% discount offer. Files: app/checkout-recovery.js. After done: git add app/checkout-recovery.js && git commit -m "[174] Checkout abandonment tracking" && git push

### [175] team-pricing-placeholder
Add "Team / Agency" section to pricing.html: "Coming Soon — $79/mo for 3 seats. Join waitlist for early access." Email capture form. Validates demand before building. Files: pricing.html. After done: git add pricing.html && git commit -m "[175] Team pricing placeholder" && git push

### [176] referral-program-v1
Create app/referral.html: referral program page. Each user gets unique referral link. "Invite a friend → both get 1 free month of Pro." Show: invite link, share buttons (Twitter, WhatsApp, email, copy), referral count. Store in Firestore. Files: app/referral.html, app/referral.js. After done: git add app/referral.html app/referral.js && git commit -m "[176] Referral program v1" && git push

### [177] referral-tracking-api
Create api/referral.js: track referrals — generate unique code per user, track clicks and signups from referral links, validate referral on signup, apply rewards. Files: api/referral.js, vercel.json. After done: git add api/referral.js vercel.json && git commit -m "[177] Referral tracking API" && git push

### [178] lifetime-deal-page
Create lifetime-deal.html: limited-time offer — "$149 one-time = Lifetime Pro access (normally $348/year)". Counter showing "47 of 100 spots remaining." Strong CTA, countdown timer, FAQ about lifetime deal. Files: lifetime-deal.html. After done: git add lifetime-deal.html && git commit -m "[178] Lifetime deal landing page" && git push

### [179] payment-methods-display
Add accepted payment methods display on pricing.html and checkout: Visa, Mastercard, Amex, Apple Pay, Google Pay logos/icons. "Secure payment powered by Stripe" trust badge. Files: pricing.html. After done: git add pricing.html && git commit -m "[179] Payment methods display" && git push

### [180] revenue-notification-slack
Create api/notify-revenue.js: when Stripe webhook fires for successful payment, send Slack notification to founder channel: "💰 New Pro subscriber: email@example.com — $29 MRR" using Slack webhook URL. Files: api/notify-revenue.js, .env.example. After done: git add api/notify-revenue.js .env.example && git commit -m "[180] Revenue Slack notification" && git push
