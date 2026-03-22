# Cortex Freelancer — Depth Sprint (600 Tasks)
# Focus: Fix broken auth → real functionality → deploy quality → launch-ready
# Generated: 2026-03-22 from live site audit

## RUNNING
(none)

## PENDING

---
## 🔴 P0: CRITICAL FIXES (501-510)
---

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

### [536] vercel-env-vars-set
Ensure ALL required env vars are set in Vercel project settings (not just documented). If Stripe test keys aren't set, the checkout flow silently fails. Add health check endpoint that reports missing vars.
Files: api/health.js. After done: git pull --rebase && git add api/health.js && git commit -m "[536] Health endpoint reports missing env vars" && git push

### [540] launch-readiness-checklist
Final checklist: Auth works (Google + Email), 5+ tools generate real output, Checkout flow complete, Mobile responsive, SEO meta on all pages, Analytics tracking, Error pages, Blog has 5 posts. Write final status.
Files: docs/LAUNCH_READINESS.md. After done: git pull --rebase && git add docs/LAUNCH_READINESS.md && git commit -m "[540] Launch readiness checklist" && git push

## DONE
[501] [502] [503] [504] [505] [506] [507] [508] [509] [510] [511] [512] [513] [520] [521] [522] [531] [532] [533] [534] [535] [537] [538] [539]