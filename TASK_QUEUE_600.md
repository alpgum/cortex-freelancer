# Cortex Freelancer — Depth Sprint (600 Tasks)
# Focus: Fix broken auth → real functionality → deploy quality → launch-ready
# Generated: 2026-03-22 from live site audit

## RUNNING


### [503] fix-duplicate-firebase-config
Status: RUNNING (auto-dispatch)


### [509] fix-checkout-flow-end-to-end
Status: RUNNING (auto-dispatch)

### [507] fix-csp-headers-for-auth
Status: RUNNING (auto-dispatch)

### [510] fix-vercel-env-vars-documentation
Status: RUNNING (auto-dispatch)

### [511] invoice-generator-real-pdf
Status: RUNNING (auto-dispatch)

## PENDING

---
## 🔴 P0: CRITICAL FIXES (501-510)
---


### [502] fix-auth-js-defer-timing
app/auth.js uses `defer` — inline scripts on pages that call `cortexSignIn()` or `firebase.auth()` may execute before auth.js loads. Audit ALL pages that include auth.js + inline firebase calls. Fix loading order: either remove defer and use DOMContentLoaded wrapper, or move all inline auth code into auth.js itself.
Files: app/auth.js, app/login.html, app/signup.html, app/dashboard.html. After done: git pull --rebase && git add -A && git commit -m "[502] Fix auth.js defer timing across all pages" && git push

### [503] fix-duplicate-firebase-config
Firebase config exists in 3 places: firebase-config.js (root), app/_includes/firebase-config.js, and app/auth.js (inline). Consolidate to ONE source of truth (app/auth.js since it's loaded everywhere). Remove duplicates. Ensure no double firebase.initializeApp() calls.
Files: firebase-config.js, app/_includes/firebase-config.js, app/auth.js. After done: git pull --rebase && git add -A && git commit -m "[503] Consolidate Firebase config to single source" && git push


### [505] fix-app-page-css-broken
app/index.html had CSS issues reported. Audit: terminal animation, scorecard input, layout on desktop + mobile. Fix any broken styles, ensure the page is functional and visually correct.
Files: app/index.html. After done: git pull --rebase && git add app/index.html && git commit -m "[505] Fix app page CSS issues" && git push


### [507] fix-csp-headers-for-auth
Content-Security-Policy on login.html blocks some Firebase/Google auth flows. Audit CSP: ensure accounts.google.com is in frame-src AND connect-src. Add *.googleapis.com to connect-src if missing. Test Google popup works with CSP enabled.
Files: app/login.html, app/signup.html, vercel.json. After done: git pull --rebase && git add -A && git commit -m "[507] Fix CSP headers for Firebase/Google auth" && git push

### [508] end-to-end-auth-flow-test
After [501-507] are done: manually test full flow on cortexfreelancer.com: (1) Google Sign-In → success, (2) Email signup → verification email, (3) Email login → dashboard, (4) Logout → redirect, (5) Auth guard blocks /app/tools/ when not logged in. Document any remaining issues.
Files: docs/AUTH_TEST_REPORT.md. After done: git pull --rebase && git add docs/AUTH_TEST_REPORT.md && git commit -m "[508] Auth flow end-to-end test report" && git push

### [509] fix-checkout-flow-end-to-end
Test full checkout: Free user → click Upgrade → Stripe Checkout → Success page → Pro status updated. Ensure checkout.js creates real Stripe sessions, success page verifies subscription, dashboard shows Pro badge. Fix any breaks.
Files: api/checkout.js, checkout-success.html, app/dashboard.js. After done: git pull --rebase && git add -A && git commit -m "[509] Fix checkout flow end-to-end" && git push

### [510] fix-vercel-env-vars-documentation
Document ALL required Vercel env vars in .env.example with descriptions: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, FIREBASE_*, SENTRY_DSN, etc. Add setup instructions in README or docs/SETUP.md.
Files: .env.example, docs/SETUP.md. After done: git pull --rebase && git add .env.example docs/SETUP.md && git commit -m "[510] Document all required env vars" && git push

---
## 🛠️ P1: TOOL QUALITY — MAKE 5 TOOLS GENUINELY USEFUL (511-520)
---

### [511] invoice-generator-real-pdf
Upgrade invoice tool: generate a real downloadable PDF (using jsPDF or html2pdf.js client-side). Include: logo placeholder, from/to fields, line items with quantity/rate/total, tax calculation, payment terms, bank details field, due date. Professional-looking output.
Files: app/tools/invoice.html. After done: git pull --rebase && git add app/tools/invoice.html && git commit -m "[511] Invoice generator — real PDF output" && git push

### [512] proposal-writer-real-output
Upgrade proposal tool: generate a real formatted proposal document (copyable rich text or downloadable PDF). Include: executive summary, scope of work, timeline, pricing breakdown, terms. Use the tone selector and job description analysis already built.
Files: app/tools/proposal.html. After done: git pull --rebase && git add app/tools/proposal.html && git commit -m "[512] Proposal writer — real document output" && git push

### [513] rate-calculator-market-data
Upgrade rate calculator: add real market rate data for top 20 freelance skills (web dev, design, writing, etc.) by region. Show "You're charging X% below/above market rate." Include hourly → project → annual income projections.
Files: app/tools/rate-calculator.html. After done: git pull --rebase && git add app/tools/rate-calculator.html && git commit -m "[513] Rate calculator with market data" && git push

### [514] contract-review-real-analysis
Upgrade contract review: paste contract text → tool highlights risky clauses with explanations, suggests alternatives, gives overall risk score (Safe/Caution/Danger). Use the red flag patterns from [476] but make output actionable with suggested replacement text.
Files: app/tools/contract-review.html. After done: git pull --rebase && git add app/tools/contract-review.html && git commit -m "[514] Contract review — actionable analysis" && git push

### [515] time-tracker-functional
Make time tracker actually work: start/stop timer, manual entry, project/client tagging, daily/weekly/monthly views, export to CSV. Data persists in localStorage. Show billable amount based on hourly rate.
Files: app/tools/time-tracker.html. After done: git pull --rebase && git add app/tools/time-tracker.html && git commit -m "[515] Time tracker — fully functional" && git push

### [516] income-dashboard-real-charts
Upgrade income dashboard with real charts (Chart.js or lightweight alternative): monthly income trend, income by client pie chart, paid vs pending, running average. Data from localStorage entries — user adds income manually.
Files: app/tools/income-dashboard.html. After done: git pull --rebase && git add app/tools/income-dashboard.html && git commit -m "[516] Income dashboard — real charts" && git push

### [517] client-crm-functional
Make Client CRM actually useful: add/edit/delete clients, track last contact date, project history, payment status, notes. Health score from [479]. Quick actions: "Send follow-up", "Create invoice for client". Sortable/filterable list.
Files: app/tools/client-crm.html. After done: git pull --rebase && git add app/tools/client-crm.html && git commit -m "[517] Client CRM — fully functional" && git push

### [518] job-scanner-real-rss
Make job scanner fetch REAL job listings from RSS feeds (Upwork, Freelancer RSS). Show actual job titles, budgets, descriptions, post dates. Apply match scoring from [473]. "Apply" button links to original posting.
Files: app/tools/job-scanner.html. After done: git pull --rebase && git add app/tools/job-scanner.html && git commit -m "[518] Job scanner — real RSS integration" && git push

### [519] email-writer-templates
Upgrade email writer with 10+ real templates: cold outreach, follow-up, price increase notice, project complete, payment reminder, meeting request, proposal follow-up, testimonial request, referral ask, unavailability notice. Each customizable.
Files: app/tools/email-writer.html. After done: git pull --rebase && git add app/tools/email-writer.html && git commit -m "[519] Email writer — 10+ real templates" && git push

### [520] scope-analyzer-deliverables
Upgrade scope analyzer: paste project description → tool extracts deliverables, estimates hours per deliverable, flags vague requirements ("design" without specs), suggests clarifying questions to ask client. Output as shareable scope document.
Files: app/tools/scope-analyzer.html. After done: git pull --rebase && git add app/tools/scope-analyzer.html && git commit -m "[520] Scope analyzer — deliverable extraction" && git push

---
## 🔗 P2: USER FLOW & RETENTION (521-530)
---

### [521] onboarding-to-first-value
After signup → onboarding → auto-open the best tool for their skill. Track "time to first tool use" in localStorage. If user hasn't used a tool within 5 minutes of signup, show a gentle nudge: "Try creating your first invoice — it takes 30 seconds."
Files: app/onboarding.html, app/_includes/first-value-nudge.js. After done: git pull --rebase && git add -A && git commit -m "[521] Onboarding to first value nudge" && git push

### [522] tool-data-persistence-audit
Audit ALL 25 tools: does each tool save user input to localStorage? Can user return and find their data? Fix any tools that lose data on page refresh. Add "Last saved: X minutes ago" indicator.
Files: app/tools/*.html. After done: git pull --rebase && git add app/tools/ && git commit -m "[522] Tool data persistence audit + fixes" && git push

### [523] dashboard-activity-feed
Add activity feed to dashboard: "You created an invoice 2 hours ago", "Rate calculator used yesterday", "New job matches found (3)". Pull from localStorage tool usage data. Makes dashboard feel alive.
Files: app/dashboard.html, app/dashboard.js. After done: git pull --rebase && git add app/dashboard.html app/dashboard.js && git commit -m "[523] Dashboard activity feed" && git push

### [524] email-capture-non-intrusive
Add non-intrusive email capture for non-logged-in users: after they use a tool 2+ times, show a small banner: "Save your data across devices — create a free account." Not a modal, not blocking. Dismissible. Tracks dismissal.
Files: app/_includes/email-capture.js, app/_includes/email-capture.css. After done: git pull --rebase && git add -A && git commit -m "[524] Non-intrusive email capture banner" && git push

### [525] tool-results-sharing
When a tool generates output (invoice, proposal, scorecard), add "Share Result" button that generates a unique shareable URL. For MVP: encode data in URL hash (no backend needed). Recipient sees read-only view.
Files: app/share.html, app/tools/*.html. After done: git pull --rebase && git add -A && git commit -m "[525] Tool results sharing via URL" && git push

### [526] notification-system
Add simple notification center: bell icon in nav, shows unread count. Notifications for: trial expiring, usage limit approaching, new job matches, payment reminders. Stored in localStorage.
Files: app/_includes/notifications.js, app/_includes/notifications.css. After done: git pull --rebase && git add -A && git commit -m "[526] Notification system" && git push

### [527] guided-tour-first-visit
Add a 4-step guided tour for first-time visitors using spotlight/tooltip approach: (1) "This is your dashboard", (2) "Your tools are here", (3) "Try the Scorecard", (4) "Upgrade when you're ready." Only shows once. CSS-only, no heavy library.
Files: app/_includes/guided-tour.js, app/_includes/guided-tour.css. After done: git pull --rebase && git add -A && git commit -m "[527] First-visit guided tour" && git push

### [528] progress-tracking-gamification
Add progress bar to dashboard: "Your freelance setup: 40% complete." Steps: Create profile (✓), Use first tool (✓), Generate invoice (○), Set hourly rate (○), Add first client (○). Motivates tool exploration.
Files: app/dashboard.html, app/dashboard.js. After done: git pull --rebase && git add app/dashboard.html app/dashboard.js && git commit -m "[528] Progress tracking gamification" && git push

### [529] smart-tool-recommendations
On dashboard, show "Recommended for you" based on usage patterns. If user made invoices but hasn't tried payment tracker: "Track your invoice payments →". If user scanned jobs but hasn't written proposals: "Write a winning proposal →".
Files: app/dashboard.js. After done: git pull --rebase && git add app/dashboard.js && git commit -m "[529] Smart tool recommendations" && git push

### [530] return-user-welcome-back
When returning user opens dashboard, show personalized message: "Welcome back, [Name]! Last visit: 3 days ago. You have 2 unpaid invoices and 5 new job matches." Quick summary of what they missed.
Files: app/dashboard.js. After done: git pull --rebase && git add app/dashboard.js && git commit -m "[530] Return user welcome back" && git push

---
## 🎨 P3: VISUAL POLISH & BRAND (531-535)
---

### [531] consistent-design-system
Audit all pages for design consistency: same spacing, same button styles, same card patterns, same header styles. Create a shared CSS variables file if not exists. Fix any pages that look "off brand."
Files: app/theme.css, *.html. After done: git pull --rebase && git add -A && git commit -m "[531] Design system consistency pass" && git push

### [532] loading-states-all-tools
Every tool should have a proper loading state when processing: spinner/skeleton, disable submit button, show "Generating..." text. Audit all 25 tools. No tool should freeze without feedback.
Files: app/tools/*.html. After done: git pull --rebase && git add app/tools/ && git commit -m "[532] Loading states for all tools" && git push

### [533] empty-states-all-tools
Every tool with stored data (CRM, time tracker, income) should have a helpful empty state: illustration/icon + "No clients yet. Add your first client to start tracking." + CTA button. Not a blank page.
Files: app/tools/*.html. After done: git pull --rebase && git add app/tools/ && git commit -m "[533] Empty states for all tools" && git push

### [534] favicon-and-og-image
Create proper favicon (16x16, 32x32, apple-touch-icon) and OG image (1200x630) for social sharing. Use Cortex brand (dark bg, green accent, "CORTEX" text). Ensure all pages reference them correctly.
Files: favicon.ico, apple-touch-icon.png, og-image.png, *.html. After done: git pull --rebase && git add -A && git commit -m "[534] Favicon and OG image" && git push

### [535] footer-all-pages
Ensure consistent footer on ALL pages: links to Terms, Privacy, Support, Blog. Social links. © 2026 Cortex Freelancer. Currently some pages might be missing footer.
Files: app/_includes/footer.js, *.html. After done: git pull --rebase && git add -A && git commit -m "[535] Consistent footer all pages" && git push

---
## 🚀 P4: DEPLOY & LAUNCH READINESS (536-540)
---

### [536] vercel-env-vars-set
Ensure ALL required env vars are set in Vercel project settings (not just documented). If Stripe test keys aren't set, the checkout flow silently fails. Add health check endpoint that reports missing vars.
Files: api/health.js. After done: git pull --rebase && git add api/health.js && git commit -m "[536] Health endpoint reports missing env vars" && git push

### [537] smoke-test-live-site
Run e2e-smoke.sh against cortexfreelancer.com. Fix any failures. All pages return 200. All API endpoints respond. Auth pages load correctly. Tools load. Checkout endpoint works.
Files: scripts/e2e-smoke.sh. After done: BASE_URL=https://cortexfreelancer.com bash scripts/e2e-smoke.sh && git pull --rebase && git add -A && git commit -m "[537] Smoke test — all green on live" && git push

### [538] robots-txt-sitemap
Ensure robots.txt allows crawling, sitemap.xml lists all public pages (index, pricing, blog posts, tool landing pages, comparisons). Submit to Google Search Console if possible.
Files: robots.txt, sitemap.xml. After done: git pull --rebase && git add robots.txt sitemap.xml && git commit -m "[538] Robots.txt and sitemap updated" && git push

### [539] deploy-final-with-all-fixes
Deploy everything to Vercel prod. Run smoke test. Verify Google Sign-In works. Verify a tool generates output. Verify dashboard loads for logged-in user.
After done: cd /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer && git pull --rebase && npx vercel --prod --yes

### [540] launch-readiness-checklist
Final checklist: Auth works (Google + Email), 5+ tools generate real output, Checkout flow complete, Mobile responsive, SEO meta on all pages, Analytics tracking, Error pages, Blog has 5 posts. Write final status.
Files: docs/LAUNCH_READINESS.md. After done: git pull --rebase && git add docs/LAUNCH_READINESS.md && git commit -m "[540] Launch readiness checklist" && git push

## DONE
[501] [504] [506]
