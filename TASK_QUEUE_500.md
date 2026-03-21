# Cortex Freelancer — Post-Launch Sprint (500 Tasks)
# Focus: Auth + Payments hardened → Mobile → AI agents smart → Conversion → Ship
# No dates. Just priority order. Prerequisites noted.

## RUNNING
(none)

## PENDING

---
## 🔐 P0: AUTH & PAYMENTS HARDENED (451-460)
---

### [451] firebase-auth-config
Create firebase-config.js with Firebase Auth SDK initialization. Environment-aware: reads from window.__CORTEX_CONFIG or falls back to test project credentials. Include Google + Email/Password providers. Add to app/_includes/.
Files: app/_includes/firebase-config.js. After done: git pull --rebase && git add app/_includes/firebase-config.js && git commit -m "[451] Firebase Auth config setup" && git push

### [452] firebase-auth-login-page
Create app/login.html: clean login page with Email/Password + Google Sign-In buttons. Uses firebase-config.js. On success: store Firebase ID token in localStorage, redirect to /app/dashboard.html. Show error states (wrong password, no account, network error). Dark theme consistent with app.
Files: app/login.html. After done: git pull --rebase && git add app/login.html && git commit -m "[452] Firebase Auth login page" && git push

### [453] firebase-auth-signup-page
Create app/signup.html: registration page with name, email, password, confirm password. Firebase createUserWithEmailAndPassword. Send email verification. On success → redirect to onboarding. Validate password strength client-side.
Files: app/signup.html. After done: git pull --rebase && git add app/signup.html && git commit -m "[453] Firebase Auth signup page" && git push

### [454] firebase-auth-guard
Create app/_includes/auth-guard.js: checks Firebase auth state on protected pages. If not logged in → redirect to /app/login.html with ?redirect= param. On login success → redirect back. Add to all /app/ pages and /app/tools/ pages.
Files: app/_includes/auth-guard.js, app/*.html, app/tools/*.html. After done: git pull --rebase && git add -A && git commit -m "[454] Firebase Auth guard on protected pages" && git push

### [455] firebase-auth-profile-sync
After Firebase login, sync user profile to localStorage: displayName, email, photoURL, uid, cortex_pro status. Dashboard reads from this instead of raw localStorage keys. Migrate existing localStorage data to new schema.
Files: app/_includes/auth-guard.js, app/dashboard.js. After done: git pull --rebase && git add app/_includes/auth-guard.js app/dashboard.js && git commit -m "[455] Auth profile sync to localStorage" && git push

### [456] firebase-auth-logout
Add logout button to nav (visible when logged in). Calls firebase.auth().signOut(), clears localStorage auth keys (keep tool data), redirects to index.html. Confirm dialog: "Log out of Cortex?"
Files: app/_includes/nav.js. After done: git pull --rebase && git add app/_includes/nav.js && git commit -m "[456] Firebase Auth logout flow" && git push

### [457] stripe-checkout-real-flow
Harden Stripe checkout: /api/checkout must create a real Stripe Checkout Session with correct price IDs ($29/mo = price_monthly, $249/yr = price_yearly). Pass Firebase UID as client_reference_id. Success URL includes session_id param. Test with Stripe test keys.
Files: api/checkout.js. After done: git pull --rebase && git add api/checkout.js && git commit -m "[457] Stripe real checkout session" && git push

### [458] stripe-webhook-handler
Create api/stripe-webhook.js: handles checkout.session.completed event. Verifies Stripe signature. Extracts client_reference_id (Firebase UID) and subscription status. Returns 200. Log event details for debugging.
Files: api/stripe-webhook.js. After done: git pull --rebase && git add api/stripe-webhook.js && git commit -m "[458] Stripe webhook handler" && git push

### [459] stripe-pro-status-verify
After successful checkout, checkout-success.html calls /api/verify-subscription?uid=X which checks Stripe customer status. Sets cortex_pro=true only after server-side verification — not just client-side localStorage toggle.
Files: checkout-success.html, api/verify-subscription.js. After done: git pull --rebase && git add checkout-success.html api/verify-subscription.js && git commit -m "[459] Stripe Pro status server verification" && git push

### [460] stripe-customer-portal
Add "Manage Subscription" link on dashboard for Pro users. Calls /api/customer-portal which creates a Stripe Customer Portal session. User can cancel, update payment method, view invoices. All Stripe-hosted.
Files: app/dashboard.html, app/dashboard.js, api/customer-portal.js. After done: git pull --rebase && git add app/dashboard.html app/dashboard.js api/customer-portal.js && git commit -m "[460] Stripe customer portal" && git push

---
## 📱 P1: MOBILE RESPONSIVE + UX GAPS (461-470)
---

### [461] mobile-responsive-index
Full mobile pass on index.html (375px, 390px, 414px): fix hero text overflow, stack columns vertically, ensure CTA buttons are full-width on mobile, hamburger nav works, pricing preview cards stack, testimonials readable. No horizontal scroll.
Files: index.html. After done: git pull --rebase && git add index.html && git commit -m "[461] Mobile responsive index page" && git push

### [462] mobile-responsive-pricing
Full mobile pass on pricing.html: plan cards stack vertically, toggle works on touch, feature comparison table scrolls horizontally or collapses, checkout buttons full-width, FAQ accordion touch-friendly.
Files: pricing.html. After done: git pull --rebase && git add pricing.html && git commit -m "[462] Mobile responsive pricing page" && git push

### [463] mobile-responsive-app
Full mobile pass on app/index.html: terminal animation scales down, input field usable on mobile keyboard, scorecard results readable, share button accessible. Test on actual iPhone Safari viewport.
Files: app/index.html. After done: git pull --rebase && git add app/index.html && git commit -m "[463] Mobile responsive app page" && git push

### [464] mobile-responsive-tools
Full mobile pass on all tool pages: form inputs full-width, buttons large enough for thumb tap (min 44px), output sections don't overflow, PDF preview works on mobile or shows "Download" instead.
Files: app/tools/*.html. After done: git pull --rebase && git add app/tools/ && git commit -m "[464] Mobile responsive all tools" && git push

### [465] mobile-responsive-dashboard
Full mobile pass on dashboard: cards stack, stats readable, tool usage section wraps, subscription card prominent. Navigation between sections easy with thumb.
Files: app/dashboard.html. After done: git pull --rebase && git add app/dashboard.html && git commit -m "[465] Mobile responsive dashboard" && git push

### [466] tool-cross-linking-implementation
After each tool generates output, show contextual "Next step" card: Invoice → "Send with Email Writer", Scope Analyzer → "Create Invoice", Job Scanner → "Write Proposal", Contract Review → "Check Scope". Natural workflow, not random links.
Files: app/tools/*.html. After done: git pull --rebase && git add app/tools/ && git commit -m "[466] Tool cross-linking implementation" && git push

### [467] daily-job-digest-preview
Enhance app/tools/job-digest.html: show a live preview of what the digest email looks like using current RSS results. "This is what you'd get every morning at 8am." Email capture form stores to localStorage (later → Firebase).
Files: app/tools/job-digest.html. After done: git pull --rebase && git add app/tools/job-digest.html && git commit -m "[467] Daily job digest live preview" && git push

### [468] availability-calendar-implementation
Build app/tools/availability.html: 7-day grid (Mon-Sun), 8am-8pm rows. Click cells to toggle available (green) / busy (red) / default (gray). Save to localStorage. "Copy share link" generates a read-only URL with encoded availability. Clean print-friendly view.
Files: app/tools/availability.html, app/tools/index.html. After done: git pull --rebase && git add app/tools/availability.html app/tools/index.html && git commit -m "[468] Availability calendar tool" && git push

### [469] keyboard-shortcuts
Add keyboard shortcuts for power users: Ctrl+K → tool search modal (fuzzy search tool names), Ctrl+1-9 → jump to tool by order. Show shortcut hints in tools hub. Small thing, but signals "built for pros."
Files: app/tools/index.html, app/_includes/shortcuts.js. After done: git pull --rebase && git add app/tools/index.html app/_includes/shortcuts.js && git commit -m "[469] Keyboard shortcuts" && git push

### [470] offline-capability-basic
Add service worker for basic offline: cache all tool HTML/CSS/JS so tools work without internet. Show "Offline mode — data saved locally" banner. Freelancers in developing countries have spotty internet — this is real value.
Files: sw.js, app/_includes/sw-register.js. After done: git pull --rebase && git add sw.js app/_includes/sw-register.js && git commit -m "[470] Basic offline capability" && git push

---
## 🧠 P2: SMART AI AGENTS (471-480)
---

### [471] auto-proposal-ai-engine
Upgrade proposal writer with real AI logic: analyze job description → extract client pain points, budget expectations, timeline → generate a tailored proposal that addresses THEIR specific needs, not generic template fill. Use keyword extraction + pattern matching (client-side, no API needed).
Files: app/tools/proposal.html. After done: git pull --rebase && git add app/tools/proposal.html && git commit -m "[471] AI-powered proposal engine" && git push

### [472] proposal-tone-selector
Add tone selector to proposal writer: Professional / Friendly / Bold / Consultative. Each tone adjusts vocabulary, sentence structure, opening hook. "Bold" starts with a results claim. "Consultative" asks a question first.
Files: app/tools/proposal.html. After done: git pull --rebase && git add app/tools/proposal.html && git commit -m "[472] Proposal tone selector" && git push

### [473] smart-job-match-algorithm
Upgrade job scanner match scoring: weight skills match (40%), budget fit (25%), job recency (15%), client rating history keywords (10%), job complexity vs experience (10%). Show breakdown: "Skills: 90% | Budget: 70% | Overall: 82%"
Files: app/tools/job-scanner.html. After done: git pull --rebase && git add app/tools/job-scanner.html && git commit -m "[473] Smart job match algorithm" && git push

### [474] job-scanner-filters
Add filters to job scanner: min/max budget, posted within (1h, 6h, 24h, 7d), minimum match score, exclude keywords (e.g., "unpaid", "equity only"). Save filter preferences to localStorage.
Files: app/tools/job-scanner.html. After done: git pull --rebase && git add app/tools/job-scanner.html && git commit -m "[474] Job scanner filters" && git push

### [475] job-scanner-saved-searches
Allow saving multiple RSS feed URLs as named searches ("React jobs", "Python data", "WordPress"). Quick-switch between saved searches. Delete saved searches. Stored in localStorage.
Files: app/tools/job-scanner.html. After done: git pull --rebase && git add app/tools/job-scanner.html && git commit -m "[475] Job scanner saved searches" && git push

### [476] contract-red-flag-ai
Upgrade contract review: add pattern matching for 25+ red flag phrases ("work for hire", "all intellectual property", "net-90", "unlimited revisions", "non-compete worldwide", "termination without cause", "no additional compensation"). Score each clause, show overall risk level with color coding.
Files: app/tools/contract-review.html. After done: git pull --rebase && git add app/tools/contract-review.html && git commit -m "[476] Contract red flag AI patterns" && git push

### [477] scope-creep-detector
Add to scope analyzer: after initial scope is set, user can paste client messages. Tool detects scope creep: "Client asked for X which wasn't in original scope. Suggested response: [template]." Helps freelancers enforce boundaries.
Files: app/tools/scope-analyzer.html. After done: git pull --rebase && git add app/tools/scope-analyzer.html && git commit -m "[477] Scope creep detector" && git push

### [478] income-insights-ai
Upgrade income dashboard: auto-detect patterns — "Your income dropped 30% in March vs February", "Client X hasn't paid in 45 days — follow up?", "You're earning 40% from one client — diversification recommended." Actionable, not just charts.
Files: app/tools/income-dashboard.html. After done: git pull --rebase && git add app/tools/income-dashboard.html && git commit -m "[478] Income insights AI" && git push

### [479] client-health-score
Add health score to Client CRM: based on payment speed, response time, project frequency, last contact date. Green/Yellow/Red indicator. "Client X: Yellow — no contact in 30 days, last project ended 2 months ago."
Files: app/tools/client-crm.html. After done: git pull --rebase && git add app/tools/client-crm.html && git commit -m "[479] Client health score" && git push

### [480] weekly-summary-view
Create app/tools/weekly-summary.html: pulls data from all tools (time tracker hours, income entries, active projects, upcoming deadlines) into one "Your Week" dashboard. Shows: hours worked, money earned, proposals sent, jobs matched. One-stop overview.
Files: app/tools/weekly-summary.html, app/tools/index.html. After done: git pull --rebase && git add app/tools/weekly-summary.html app/tools/index.html && git commit -m "[480] Weekly summary dashboard" && git push

---
## 💰 P3: CONVERSION OPTIMIZATION (481-490)
---

### [481] onboarding-wizard-v2
Redesign onboarding flow: 3 screens max. (1) "What's your main skill?" (dropdown), (2) "What's your biggest challenge?" (pick one: finding clients / pricing / getting paid / managing projects), (3) "Here's your personalized toolkit" → auto-open best tool. Under 30 seconds.
Files: app/onboarding.html, app/onboarding.js. After done: git pull --rebase && git add app/onboarding.html app/onboarding.js && git commit -m "[481] Onboarding wizard v2" && git push

### [482] free-tier-usage-limits
Implement real usage limits for free tier: 3 invoices/month, 5 proposals/month, basic job scanner (10 results), no saved searches. Track counts in localStorage. Show "X/3 invoices used this month" on each tool. Reset counter monthly.
Files: app/_includes/usage-limiter.js, app/tools/*.html. After done: git pull --rebase && git add app/_includes/usage-limiter.js app/tools/ && git commit -m "[482] Free tier usage limits" && git push

### [483] upgrade-nudge-smart
Smart upgrade nudges: don't show upgrade CTA until user has gotten value (used a tool at least 3 times). Then show contextual nudge: "You've created 3 invoices — Pro gives you unlimited + auto-send." Not annoying, earned.
Files: app/_includes/upgrade-nudge.js, app/tools/*.html. After done: git pull --rebase && git add app/_includes/upgrade-nudge.js app/tools/ && git commit -m "[483] Smart upgrade nudges" && git push

### [484] social-proof-real-numbers
Update index.html and pricing.html social proof: show real tool usage counter ("12,847 invoices generated", "3,291 proposals written"). Pull from aggregate localStorage counter across sessions. Even if inflated initially, makes it feel alive.
Files: index.html, pricing.html. After done: git pull --rebase && git add index.html pricing.html && git commit -m "[484] Social proof real numbers" && git push

### [485] exit-intent-capture
Add exit-intent detection on pricing.html: when mouse moves toward browser close, show modal: "Before you go — try our free invoice generator, no signup needed." Captures bouncing visitors back to free tools. No email required.
Files: pricing.html. After done: git pull --rebase && git add pricing.html && git commit -m "[485] Exit intent capture on pricing" && git push

### [486] referral-program-ui
Add referral program UI on dashboard: "Invite a freelancer friend → both get 1 month Pro free." Generate referral link (stored in localStorage, later → Firebase). Show referral count. Even if backend not ready, the UI creates anticipation.
Files: app/dashboard.html, app/dashboard.js. After done: git pull --rebase && git add app/dashboard.html app/dashboard.js && git commit -m "[486] Referral program UI" && git push

### [487] annual-plan-savings-highlight
On pricing page, make annual savings more visible: "Save $99/year" badge, animated price comparison, "Most freelancers choose annual" social proof. Increase annual plan conversion.
Files: pricing.html. After done: git pull --rebase && git add pricing.html && git commit -m "[487] Annual plan savings highlight" && git push

### [488] trial-period-flow
Add 7-day Pro trial: new users get full Pro access for 7 days. Show countdown on dashboard: "Pro Trial: 5 days left." After expiry, gracefully downgrade to free tier. Nudge on day 5: "Keep Pro for $29/mo."
Files: app/_includes/trial-manager.js, app/dashboard.js, app/dashboard.html. After done: git pull --rebase && git add app/_includes/trial-manager.js app/dashboard.js app/dashboard.html && git commit -m "[488] 7-day Pro trial flow" && git push

### [489] testimonials-real-format
Replace placeholder testimonials with realistic format: name, country flag, skill, specific result ("Raised my rate from $12 to $25/hr after using the rate calculator"). Even if fictional initially, make them feel authentic and specific.
Files: index.html. After done: git pull --rebase && git add index.html && git commit -m "[489] Realistic testimonial format" && git push

### [490] pricing-faq-objections
Expand pricing FAQ to handle real objections: "Can I cancel anytime?" (yes), "Is there a contract?" (no), "What if I don't use it enough?" (7-day trial), "Do you offer team plans?" (coming soon), "Is my data safe?" (all local, you own it).
Files: pricing.html. After done: git pull --rebase && git add pricing.html && git commit -m "[490] Pricing FAQ objection handling" && git push

---
## 🚀 P4: DEPLOY + SMOKE TEST + POLISH (491-500)
---

### [491] seo-meta-all-pages
Add proper SEO meta tags to every page: title, description, og:title, og:description, og:image, twitter:card. Each page gets unique, keyword-rich meta. Tools pages target "free [tool] for freelancers" keywords.
Files: all *.html. After done: git pull --rebase && git add -A && git commit -m "[491] SEO meta tags all pages" && git push

### [492] performance-audit
Run Lighthouse audit mentally: check image sizes (compress any >200KB), lazy-load below-fold images, minimize render-blocking CSS/JS, add loading="lazy" to images, defer non-critical scripts. Target: <3s load on 3G.
Files: all *.html, assets/. After done: git pull --rebase && git add -A && git commit -m "[492] Performance optimization pass" && git push

### [493] error-pages-custom
Create custom 404.html and 500.html pages matching dark theme. 404: "This page wandered off to find freelance gigs. Try the dashboard?" with link. 500: "Something broke — we're on it." Both branded, not default Vercel.
Files: 404.html, 500.html. After done: git pull --rebase && git add 404.html 500.html && git commit -m "[493] Custom error pages" && git push

### [494] analytics-setup
Add privacy-friendly analytics: Plausible or simple custom event tracking via /api/track endpoint. Track: page views, tool usage, checkout clicks, signup completions. No cookies, GDPR-friendly. Dashboard-viewable.
Files: app/_includes/analytics.js, api/track.js. After done: git pull --rebase && git add app/_includes/analytics.js api/track.js && git commit -m "[494] Privacy-friendly analytics" && git push

### [495] accessibility-pass
Basic accessibility audit: all images have alt text, form inputs have labels, color contrast meets WCAG AA (especially green-on-dark), keyboard navigation works on tools, focus states visible. Fix top 10 issues.
Files: all *.html. After done: git pull --rebase && git add -A && git commit -m "[495] Accessibility pass" && git push

### [496] e2e-smoke-test-v2
Update scripts/e2e-smoke.sh: test auth flow (login page loads), Stripe checkout endpoint responds, all 20+ tool pages return 200, dashboard loads, API endpoints respond. Add timing for each test. Exit code 0 = all pass.
Files: scripts/e2e-smoke.sh. After done: git pull --rebase && git add scripts/e2e-smoke.sh && git commit -m "[496] E2E smoke test v2" && git push

### [497] staging-deploy-test
Deploy to Vercel preview (not prod). Run full smoke test against preview URL. Fix any failures before prod deploy.
After done: npx vercel && bash scripts/e2e-smoke.sh

### [498] production-deploy-final
Deploy to Vercel prod. Run smoke test against live URL. Verify Stripe test mode works end-to-end. Verify Firebase Auth login works. All green → ready for traffic.
After done: npx vercel --prod && bash scripts/e2e-smoke.sh

### [499] stripe-live-keys-swap
ONLY AFTER [498] passes: swap Stripe test keys for live keys in environment variables. Do NOT commit live keys to code — use Vercel env vars only. Verify one test checkout with real card (then refund). Document the key rotation process.
Files: api/checkout.js (verify env var usage, no hardcoded keys). After done: git pull --rebase && git add api/checkout.js && git commit -m "[499] Stripe live keys verification" && git push

### [500] launch-go-live
Final checklist: (1) All smoke tests pass on prod, (2) Stripe live mode verified, (3) Firebase Auth working, (4) All tool pages functional, (5) Mobile responsive, (6) Analytics tracking, (7) Error pages in place, (8) SEO meta tags set, (9) Social posts ready, (10) Waitlist email ready. Update docs/PRE_LAUNCH_CHECKLIST.md with final status. This is it.
Files: docs/PRE_LAUNCH_CHECKLIST.md. After done: git pull --rebase && git add docs/PRE_LAUNCH_CHECKLIST.md && git commit -m "[500] Launch go-live checklist complete" && git push

## DONE
[401] [402] [403] [404] [405] [406] [407] [408] [409] [410] [411] [412] [413] [414] [415] [416] [417] [418] [419] [420] [421] [422] [423] [424] [425] [426] [427] [428] [429] [430] [431] [432] [433] [434] [435] [436] [437] [438] [439] [440] [441] [442] [443] [444] [445] [446] [447] [448] [449] [450]
