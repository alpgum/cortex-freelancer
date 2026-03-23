# Cortex Freelancer — 300-Task Sprint Queue
> Generated: 2026-03-24 | Target: Pro Launch 3 Nisan 2026
> Categories: UPWORK (80) · BUGS (40) · TOOLS (50) · PAYMENT (30) · AUTH (25) · MARKETING (35) · INFRA (20) · DESIGN (20)
> Scope: Actionable & specific tasks; each includes Priority (P0–P2) and Size (S/M/L).

---

## A) UPWORK — Profile, Jobs, Proposals, Research (80 tasks)

### [CF-001] Integrate Upwork OAuth2 for real profile data
Replace mock data in `app/engine.js` with actual Upwork API OAuth2 flow. Store tokens in Firestore per user. Priority: P0. Size: L

### [CF-002] Build Upwork profile completeness scoring algorithm
Analyze title, overview, skills, portfolio, certifications, hours, JSS and output 0-100 score with breakdown. Priority: P0. Size: M

### [CF-003] Parse Upwork profile title for keyword optimization
Extract keywords from user's title, compare against top-earning profiles in same category, suggest improvements. Priority: P0. Size: M

### [CF-004] Upwork overview/bio AI rewriter with tone selector
Use Anthropic API to rewrite profile overview in Professional/Friendly/Bold tones, preserving key skills. Priority: P0. Size: M

### [CF-005] Skill tag recommendation engine
Analyze user's current skills vs job market demand, recommend additions/removals with reasoning. Priority: P1. Size: M

### [CF-006] Portfolio item analyzer with scoring
Review portfolio items for description length, image quality indicators, client visibility, and suggest improvements. Priority: P1. Size: M

### [CF-007] JSS (Job Success Score) simulator
Let users input parameters (completed jobs, feedback, disputes) and simulate JSS impact. Priority: P1. Size: S

### [CF-008] Profile photo quality checker
Validate profile photo dimensions, face detection hints, background contrast, professional appearance tips. Priority: P2. Size: S

### [CF-009] Certification recommendation based on skill gaps
Cross-reference user skills with Upwork-recognized certifications, prioritize by ROI. Priority: P1. Size: M

### [CF-010] Employment history optimizer
Analyze work history entries for keyword density, description quality, date gaps. Priority: P2. Size: S

### [CF-011] Profile comparison tool — you vs top 10 in niche
Scrape/mock top profiles in user's category, show side-by-side comparison with action items. Priority: P1. Size: L

### [CF-012] Hourly rate benchmarking by category and region
Build dataset of rate ranges per category/country, show where user falls. Priority: P0. Size: M

### [CF-013] Profile timeline visualization
Render `profile-timeline.js` as interactive chart showing earnings, jobs, rating over time. Priority: P1. Size: M

### [CF-014] Auto-detect profile red flags
Flag issues: empty portfolio, no certifications, short overview, low hours, missing photo. Priority: P0. Size: S

### [CF-015] Profile A/B test framework
Let users save multiple profile versions, track which version gets more invites. Priority: P2. Size: L

### [CF-016] Build real-time Upwork job search via RSS/API
Implement `api/upwork-jobs.js` to fetch real jobs by keywords, category, budget range. Priority: P0. Size: L

### [CF-017] Job search filters — budget, client history, posted date
Add advanced filters: min/max budget, client spend history, hours billed, post age. Priority: P0. Size: M

### [CF-018] Job keyword alert system with email notifications
Let users set keyword alerts, check every 15 min via cron, send email for new matches. Priority: P0. Size: L

### [CF-019] Job quality scoring algorithm
Score jobs 1-10 based on: budget/hour ratio, client history, job description clarity, competition level. Priority: P0. Size: M

### [CF-020] Smart job filter — hide low-quality posts automatically
Use `smart-job-filter.js` to auto-hide jobs below quality threshold with configurable sensitivity. Priority: P1. Size: M

### [CF-021] Job red flag detector with explanations
Enhance `job-red-flags.js` to detect: unrealistic expectations, pay below market, scope creep signals, new client with no history. Priority: P0. Size: M

### [CF-022] Save/bookmark jobs to a personal queue
Implement job saving with notes, priority ranking, and application deadline tracking. Priority: P1. Size: M

### [CF-023] Job category trend analysis
Show which categories are growing/shrinking in job volume and avg budget over last 90 days. Priority: P1. Size: M

### [CF-024] Competitor job application tracker
Track how many proposals each job receives over time, show competition density. Priority: P1. Size: M

### [CF-025] Job digest email — daily/weekly summary
Wire `api/generate-digest.js` to send personalized job digest emails via SendGrid/Resend. Priority: P0. Size: M

### [CF-026] Job match percentage calculator
Compare job requirements against user profile/skills, show match % with missing skills highlighted. Priority: P0. Size: M

### [CF-027] Similar jobs recommendation engine
When viewing a job, suggest 5 similar jobs based on skills, budget range, and category. Priority: P1. Size: M

### [CF-028] Job posting language analyzer
Detect job post language quality, urgency signals, budget negotiability hints. Priority: P2. Size: S

### [CF-029] Saved search templates
Let users save common search configs (e.g., "React $50+/hr US clients") for one-click reuse. Priority: P1. Size: S

### [CF-030] Job feed infinite scroll with lazy loading
Replace paginated job list with infinite scroll, loading 20 jobs at a time. Priority: P1. Size: M

### [CF-031] AI proposal generator from job description
Enhance `proposal-generator.js` to generate tailored proposals using job description + user profile context. Priority: P0. Size: L

### [CF-032] Proposal template library — 10 pre-built templates
Create templates for: web dev, design, writing, data entry, marketing, consulting, mobile, DevOps, QA, PM. Priority: P0. Size: M

### [CF-033] Proposal A/B testing with variant tracking
Implement `proposal-ab.js` to create variants, track which version gets hired. Priority: P1. Size: M

### [CF-034] Proposal tone analyzer — professional vs casual scoring
Analyze proposal text for tone, formality level, enthusiasm, and suggest adjustments. Priority: P1. Size: S

### [CF-035] Proposal length optimizer
Warn if proposal is too short (<100 words) or too long (>500 words) with ideal range for category. Priority: P1. Size: S

### [CF-036] Cover letter vs proposal separator
Split proposal into cover letter (personal touch) and technical approach sections with independent editing. Priority: P2. Size: M

### [CF-037] Proposal keyword injector
Auto-suggest keywords from job description to include in proposal for better matching. Priority: P1. Size: S

### [CF-038] Proposal submission tracker with status updates
Track all submitted proposals: sent, viewed, shortlisted, hired, rejected with timestamps. Priority: P0. Size: M

### [CF-039] Proposal win rate dashboard
Calculate and display win rate by category, budget range, and proposal template used. Priority: P1. Size: M

### [CF-040] Proposal response time tracker
Measure time from submission to client response, show averages by category. Priority: P1. Size: S

### [CF-041] Bulk proposal generator — batch apply to similar jobs
Select multiple matching jobs, generate customized proposals for each in batch. Priority: P1. Size: L

### [CF-042] Proposal cost estimator integration
Auto-generate cost breakdown in proposal based on scope analysis from `scope-analyzer.html`. Priority: P1. Size: M

### [CF-043] Client research — company size and budget history
Enhance `client-researcher.js` to show client's total spend, avg project size, hire rate, rehire rate. Priority: P0. Size: M

### [CF-044] Client communication style analyzer
Analyze client's job posts and reviews for communication patterns: responsive, demanding, ghosting risk. Priority: P1. Size: M

### [CF-045] Client red flag scoring system
Enhance `client-red-flags.html` with weighted scoring: low budget+high demands, payment disputes, negative reviews. Priority: P0. Size: M

### [CF-046] Client CRM — notes, tags, follow-up reminders
Build full CRM in `client-crm.html`: add notes per client, tag (hot/warm/cold), set follow-up dates. Priority: P0. Size: L

### [CF-047] Client timezone detector and overlap calculator
Show client's likely timezone from location, calculate working hour overlap with freelancer. Priority: P1. Size: S

### [CF-048] Client industry categorization
Auto-categorize clients by industry (SaaS, ecommerce, agency, startup) for pattern analysis. Priority: P2. Size: S

### [CF-049] Repeat client identification and outreach templates
Identify past clients who might need follow-up work, generate re-engagement messages. Priority: P1. Size: M

### [CF-050] Client satisfaction predictor
Based on job requirements, budget, and client history, predict likelihood of positive outcome. Priority: P2. Size: M

### [CF-051] Earnings dashboard with monthly/yearly breakdown
Enhance `earnings-analytics.js` with charts: monthly revenue, YoY growth, category breakdown. Priority: P0. Size: L

### [CF-052] Earnings goal tracker with progress bar
Set monthly/quarterly/yearly income goals, show real-time progress with projections. Priority: P0. Size: M

### [CF-053] Effective hourly rate calculator
Calculate true hourly rate including: proposal writing time, communication overhead, revision time. Priority: P0. Size: M

### [CF-054] Revenue by client pie chart
Visualize revenue distribution across clients, flag over-dependency on single client. Priority: P1. Size: S

### [CF-055] Earnings projection with trend analysis
Use historical data to project next 3/6/12 month earnings with confidence intervals. Priority: P1. Size: M

### [CF-056] Tax withholding estimator per country
Enhance `tax-estimator.html` with country-specific tax brackets and withholding calculations. Priority: P1. Size: M

### [CF-057] Currency conversion for multi-currency earnings
Auto-convert earnings to user's local currency with historical exchange rates. Priority: P1. Size: M

### [CF-058] Connects spending ROI calculator
Track Upwork connects spent per proposal, calculate cost per hire and ROI. Priority: P0. Size: M

### [CF-059] Payment milestone tracker
Track payment milestones per active contract: funded, submitted, approved, released. Priority: P1. Size: M

### [CF-060] Earnings export to CSV/PDF
Add export buttons to earnings dashboard for CSV and formatted PDF reports. Priority: P1. Size: S

### [CF-061] Competition density heatmap by category
Show which categories are oversaturated vs underserved using job-to-freelancer ratios. Priority: P1. Size: M

### [CF-062] Competitor profile tracker — monitor top 5 competitors
Let users track competitor profiles, get alerts when they change rates, skills, or availability. Priority: P1. Size: L

### [CF-063] Niche opportunity finder
Enhance `niche-finder.js` to identify underserved niches with high demand and low competition. Priority: P0. Size: M

### [CF-064] Market rate trend tracker
Track hourly rate trends by category over time, show if rates are rising or falling. Priority: P1. Size: M

### [CF-065] Top earner reverse engineering
Analyze top earners in user's category: what skills, rates, portfolio items, and profile elements they share. Priority: P1. Size: L

### [CF-066] Bid strategy advisor based on competition level
Enhance `bid-strategy.js` to recommend bid amount based on job competition, client budget, and user's win rate. Priority: P0. Size: M

### [CF-067] Auto-apply rules engine
Configure `auto-apply.js` with rules: auto-apply to jobs matching specific criteria with pre-approved proposal templates. Priority: P1. Size: L

### [CF-068] Weekly performance digest with AI insights
Generate weekly summary: proposals sent, response rate, earnings, suggestions for improvement. Priority: P0. Size: M

### [CF-069] Interview preparation coach
Enhance `interview-prep.js` with category-specific mock questions, answer frameworks, and scoring. Priority: P1. Size: M

### [CF-070] Contract negotiation advisor
AI tool to help negotiate rates, milestones, and terms with suggested counter-offers. Priority: P1. Size: M

### [CF-071] Skill gap analysis with learning path
Enhance `skill-gap-analyzer.js` to create personalized learning paths with course recommendations. Priority: P1. Size: M

### [CF-072] Action plan wizard with weekly goals
Enhance `action-plan-wizard.js` to generate 4-week action plans with daily tasks and milestones. Priority: P0. Size: M

### [CF-073] Feedback analyzer for review patterns
Enhance `feedback-analyzer.js` to find patterns in client feedback, identify recurring praise/criticism. Priority: P1. Size: M

### [CF-074] Response time optimizer with notification scheduling
Track best response times, suggest optimal hours to check for new jobs based on hiring patterns. Priority: P1. Size: M

### [CF-075] Case study generator from completed projects
Enhance `case-study-generator.js` to create portfolio case studies from project data. Priority: P1. Size: M

### [CF-076] Availability calendar with auto-status updates
Enhance `availability.html` to sync availability with Upwork status and show to potential clients. Priority: P1. Size: M

### [CF-077] Share score card to social media
Enhance `share-score.js` to generate shareable image cards of profile score for LinkedIn/Twitter. Priority: P2. Size: M

### [CF-078] Upwork Rising Talent / Top Rated strategy guide
Interactive guide showing requirements and progress toward Rising Talent and Top Rated badges. Priority: P1. Size: M

### [CF-079] Multi-platform profile sync (Upwork + Fiverr + Freelancer)
Allow importing profile data from multiple platforms for unified analysis. Priority: P2. Size: L

### [CF-080] Upwork API rate limit handler with retry queue
Implement exponential backoff, request queuing, and rate limit dashboard for all Upwork API calls. Priority: P0. Size: M

---

## B) BUGS — CSP, Auth, Chat, Service Worker, Errors, Mobile (40 tasks)

### [CF-081] Re-add CSP headers with `unsafe-inline` allowed
Add `Content-Security-Policy` meta tag back to `app/_includes/head.js` with `'unsafe-inline'` for scripts and styles. Priority: P0. Size: M

### [CF-082] Fix CSP for external resources — GA4, GTM, Firebase, Stripe
Whitelist domains: googletagmanager.com, firebase, googleapis, stripe in CSP connect-src and script-src. Priority: P0. Size: M

### [CF-083] Move inline event handlers to addEventListener
Refactor all `onclick`, `onsubmit`, `onchange` inline handlers across 57 HTML files to JS event listeners. Priority: P1. Size: L

### [CF-084] Move inline `<style>` blocks to external CSS files
Extract inline styles from tool HTML files into `app/tools/tools.css` shared stylesheet. Priority: P2. Size: L

### [CF-085] Fix Firebase auth handler missing on Vercel
Deploy Firebase `__/auth/handler` or switch to custom redirect handler at `/auth/callback`. Priority: P0. Size: M

### [CF-086] Fix Google Sign-in redirect not completing
Debug redirect flow in `app/auth.js` — `getRedirectResult()` returns null on Vercel deployment. Priority: P0. Size: M

### [CF-087] Fix auth state persistence across page navigations
Ensure `onAuthStateChanged` fires correctly when navigating between tools (multi-page app). Priority: P0. Size: M

### [CF-088] Fix login page showing briefly before guest redirect
Add loading state to prevent flash of login page when guest mode auto-redirects. Priority: P1. Size: S

### [CF-089] Fix "Continue as Guest" button not setting localStorage flag
Ensure guest flag persists across sessions and all pages check it consistently. Priority: P0. Size: S

### [CF-090] Deploy chat API as Vercel serverless function
Fix `api/chat.js` deployment — ensure `@anthropic-ai/sdk` is in dependencies and function exports correctly. Priority: P0. Size: M

### [CF-091] Add chat rate limiting — 10 messages per minute per IP
Implement rate limiter in `api/chat.js` using Vercel KV or in-memory store. Priority: P0. Size: M

### [CF-092] Fix chat context window — messages exceeding token limit
Implement sliding window for chat history, truncate oldest messages when approaching limit. Priority: P1. Size: M

### [CF-093] Fix chat streaming response not rendering incrementally
Implement SSE streaming in chat UI to show tokens as they arrive instead of waiting for full response. Priority: P1. Size: M

### [CF-094] Add chat error handling for API failures
Show user-friendly error messages when Anthropic API is down, rate limited, or returns errors. Priority: P0. Size: S

### [CF-095] Fix chat input losing focus on mobile keyboards
Prevent scroll-to-top when mobile keyboard opens, keep input focused. Priority: P1. Size: S

### [CF-096] Service Worker — implement stale-while-revalidate strategy
Replace current cache-first strategy with stale-while-revalidate for HTML/JS files. Priority: P1. Size: M

### [CF-097] Service Worker — add cache versioning with auto-purge
On SW activation, delete all caches except current version (v4+). Priority: P0. Size: S

### [CF-098] Service Worker — fix offline fallback page
Create proper offline.html fallback and serve it when network is unavailable. Priority: P1. Size: S

### [CF-099] Service Worker — exclude API routes from caching
Ensure `/api/*` routes are never cached by service worker. Priority: P0. Size: S

### [CF-100] Service Worker — add update notification banner
Show "New version available — click to update" banner when new SW is waiting. Priority: P1. Size: M

### [CF-101] Fix uncaught promise rejections in fetch calls
Add `.catch()` handlers to all `fetch()` calls across JS files, show fallback UI on failure. Priority: P0. Size: M

### [CF-102] Fix localStorage quota exceeded on Safari
Implement storage size check before writing, clean up old data when approaching 5MB limit. Priority: P1. Size: S

### [CF-103] Fix race condition in auth + data loading
Ensure Firestore data fetch waits for auth state to resolve, not fire before user is known. Priority: P0. Size: M

### [CF-104] Add global error boundary with error reporting
Implement `window.onerror` and `unhandledrejection` handlers, send errors to logging endpoint. Priority: P1. Size: M

### [CF-105] Fix 404 on direct URL navigation to tool pages
Add Vercel rewrites in `vercel.json` for clean URLs or ensure all paths resolve correctly. Priority: P1. Size: S

### [CF-106] Fix tool pages not loading when accessed from bookmark
Ensure relative paths for JS/CSS work regardless of URL depth. Priority: P1. Size: S

### [CF-107] Fix mobile hamburger menu not closing on navigation
Add click handler to close mobile nav when a link is tapped. Priority: P1. Size: S

### [CF-108] Fix mobile tool cards overlapping on small screens (<375px)
Add responsive breakpoint for iPhone SE width, stack cards vertically. Priority: P1. Size: S

### [CF-109] Fix mobile keyboard pushing fixed bottom bar off screen
Use `visualViewport` API to adjust bottom bar position when keyboard is visible. Priority: P1. Size: S

### [CF-110] Fix touch targets too small on mobile (< 44px)
Audit all buttons/links, ensure minimum 44x44px touch target per WCAG guidelines. Priority: P1. Size: M

### [CF-111] Fix horizontal scroll on mobile landing page
Find and fix elements causing overflow-x on viewport widths 320-428px. Priority: P0. Size: S

### [CF-112] Fix dark mode color inconsistencies across tools
Audit all 25 tool pages for dark mode — fix missing CSS variables and hardcoded colors. Priority: P1. Size: M

### [CF-113] Fix proposal generator output not copying to clipboard
Debug `navigator.clipboard.writeText()` failure — add fallback `execCommand('copy')`. Priority: P0. Size: S

### [CF-114] Fix rate calculator not handling hourly ↔ project toggle
Ensure rate calculator correctly switches between hourly and fixed-price modes. Priority: P1. Size: S

### [CF-115] Fix fee calculator Upwork fee tier thresholds
Update fee tiers to current Upwork fee structure (10% flat as of 2023 changes). Priority: P0. Size: S

### [CF-116] Fix invoice generator PDF export broken
Debug PDF generation in `invoice.html` — likely jsPDF or html2canvas CDN issue. Priority: P0. Size: M

### [CF-117] Fix time tracker not persisting entries on page refresh
Ensure time entries save to localStorage on each start/stop, not just on page unload. Priority: P1. Size: S

### [CF-118] Fix waitlist form double-submission
Add loading state and disable button after first click, debounce submit handler. Priority: P0. Size: S

### [CF-119] Fix analytics events not firing on tool interactions
Verify GA4 `gtag('event', ...)` calls fire on tool usage — check GTM container is loaded. Priority: P1. Size: M

### [CF-120] Fix console errors on pages with missing DOM elements
Add null checks before `querySelector` operations — eliminate all "Cannot read properties of null" errors. Priority: P1. Size: M

---

## C) TOOLS — Enhance, Add AI, Better UX (50 tasks)

### [CF-121] Proposal Writer — add multi-language support (EN/TR/ES/DE)
Detect job language, generate proposal in matching language with translation toggle. Priority: P1. Size: M

### [CF-122] Proposal Writer — add portfolio auto-attach suggestions
Suggest relevant portfolio items to reference based on job requirements. Priority: P1. Size: M

### [CF-123] Invoice Creator — add recurring invoice scheduling
Let users set invoices to auto-generate weekly/bi-weekly/monthly with saved client details. Priority: P1. Size: M

### [CF-124] Invoice Creator — add multi-currency support with conversion
Support USD, EUR, GBP, TRY with live exchange rate conversion. Priority: P1. Size: M

### [CF-125] Rate Calculator — add market comparison visualization
Show user's rate on a bell curve against market rates for their category. Priority: P1. Size: M

### [CF-126] Rate Calculator — add cost-of-living adjustment
Factor in location-based cost of living to recommend minimum viable rate. Priority: P2. Size: M

### [CF-127] Fee Calculator — add platform comparison (Upwork vs Fiverr vs Toptal)
Show fee comparison across platforms for same project value. Priority: P1. Size: S

### [CF-128] Time Tracker — add Pomodoro mode with break reminders
Integrate 25/5 Pomodoro timer with session tracking and productivity stats. Priority: P1. Size: M

### [CF-129] Time Tracker — add project categorization and reporting
Tag time entries by project/client, generate weekly time reports. Priority: P1. Size: M

### [CF-130] Project Tracker — add Kanban board view
Add drag-and-drop Kanban (To Do / In Progress / Review / Done) for project tasks. Priority: P1. Size: L

### [CF-131] Project Tracker — add deadline countdown with notifications
Show days remaining per project, browser notification when deadline is within 48h. Priority: P1. Size: M

### [CF-132] Contract Review — add AI clause analysis
Use Anthropic API to analyze contract text, flag risky clauses, suggest modifications. Priority: P0. Size: L

### [CF-133] Contract Review — add template library for common clauses
Pre-built fair clauses for: IP ownership, payment terms, termination, NDA, non-compete. Priority: P1. Size: M

### [CF-134] Email Writer — add AI-powered tone adjustment
Generate emails in tones: professional, friendly, urgent, follow-up, complaint. Priority: P1. Size: M

### [CF-135] Email Writer — add template categories
Templates for: initial outreach, follow-up, scope change, late payment, project completion. Priority: P1. Size: S

### [CF-136] Bio Generator — add platform-specific formatting
Generate bios optimized for: Upwork (5000 char), LinkedIn (2600 char), Twitter (160 char). Priority: P1. Size: S

### [CF-137] Bio Generator — add industry-specific keywords
Inject relevant industry keywords based on selected niche for SEO optimization. Priority: P1. Size: S

### [CF-138] Client CRM — add deal pipeline with revenue forecasting
Track leads through: Lead → Proposal → Negotiation → Won → Completed with projected revenue. Priority: P0. Size: L

### [CF-139] Client CRM — add communication log
Track all client communications with timestamps, channel (email/chat/call), and notes. Priority: P1. Size: M

### [CF-140] Tax Estimator — add quarterly estimated payments calculator
Calculate quarterly tax payments for US, UK, and TR freelancers. Priority: P1. Size: M

### [CF-141] Tax Estimator — add expense deduction tracker
Track deductible expenses (software, hardware, office) and subtract from taxable income. Priority: P1. Size: M

### [CF-142] Scope Analyzer — add AI scope creep detector
Paste project messages, detect scope creep signals, generate polite pushback responses. Priority: P0. Size: M

### [CF-143] Scope Analyzer — add effort estimation with story points
Break scope into tasks, estimate hours per task, calculate total project effort. Priority: P1. Size: M

### [CF-144] SOW Generator — add milestone auto-generation
Auto-create milestones with deliverables, dates, and payment amounts from project description. Priority: P1. Size: M

### [CF-145] SOW Generator — add legal review checklist
Checklist of essential SOW elements: payment terms, IP, revisions, termination, timeline. Priority: P1. Size: S

### [CF-146] Meeting Notes — add AI summarizer with action items
Paste meeting transcript, extract summary, action items, decisions, and next steps. Priority: P0. Size: M

### [CF-147] Meeting Notes — add calendar integration for scheduling
Link notes to calendar events, auto-create note template before meetings. Priority: P2. Size: M

### [CF-148] Payment Checker — add milestone payment status tracker
Track funded/unfunded milestones across all active contracts in one view. Priority: P1. Size: M

### [CF-149] Payment Checker — add late payment alert system
Flag payments overdue by 3/7/14 days, generate professional follow-up messages. Priority: P0. Size: M

### [CF-150] Portfolio Review — add AI feedback on each portfolio item
Analyze portfolio items for: description quality, visual presentation, relevance, client impact. Priority: P1. Size: M

### [CF-151] Portfolio Review — add competitive positioning analysis
Compare portfolio against competitors in same niche, identify differentiators. Priority: P1. Size: M

### [CF-152] Job Scanner — add real-time job notifications via browser push
Implement Web Push API for instant notifications when matching jobs appear. Priority: P1. Size: L

### [CF-153] Job Scanner — add salary/budget negotiation range predictor
Predict negotiable budget range based on client history and job category. Priority: P1. Size: M

### [CF-154] Job Digest — add personalized difficulty ranking
Score jobs by estimated difficulty relative to user's skill level. Priority: P1. Size: M

### [CF-155] Income Dashboard — add cash flow forecast chart
Project income/expenses for next 3 months based on active contracts and history. Priority: P0. Size: M

### [CF-156] Income Dashboard — add comparison with previous period
Show month-over-month and year-over-year revenue comparison. Priority: P1. Size: M

### [CF-157] Weekly Summary — add AI-generated insights and recommendations
Auto-generate weekly performance insights: what went well, what to improve, focus areas. Priority: P0. Size: M

### [CF-158] Weekly Summary — add goal tracking integration
Show progress toward weekly goals (proposals sent, interviews, revenue) set in Action Plan. Priority: P1. Size: M

### [CF-159] Templates — add community template sharing
Let users share and browse community-contributed templates with ratings. Priority: P2. Size: L

### [CF-160] Templates — add AI template customization
Take a template and auto-customize it based on user's profile and project details. Priority: P1. Size: M

### [CF-161] Add new tool: Client Onboarding Checklist
Interactive checklist for onboarding new clients: contract, payment setup, communication channels, kickoff. Priority: P1. Size: M

### [CF-162] Add new tool: Revision Tracker
Track revision requests per project, enforce revision limits from contract, alert on scope creep. Priority: P1. Size: M

### [CF-163] Add new tool: Testimonial Request Generator
Generate professional testimonial request messages based on completed project details. Priority: P2. Size: S

### [CF-164] Add new tool: Rate Negotiation Simulator
Practice rate negotiations with AI playing the client role, get scored on outcome. Priority: P1. Size: M

### [CF-165] Add new tool: Freelancer Health Check
Monthly business health assessment: income stability, client diversification, skill relevance, pipeline strength. Priority: P0. Size: M

### [CF-166] Add tool autosave across all tools
Extend `tool-autosave.js` to work on all 25 tools — save form state every 30 seconds to localStorage. Priority: P0. Size: M

### [CF-167] Add tool usage analytics tracking
Track which tools users use most, time spent per tool, feature adoption via `tool-stats.js` API. Priority: P1. Size: M

### [CF-168] Add tool feedback widget to all tools
Extend `tool-feedback.js` — add thumbs up/down + comment on every tool page, send to `api/feedback.js`. Priority: P1. Size: M

### [CF-169] Add tool sharing — generate shareable result links
Extend `tool-share.js` to encode tool output as shareable URL or downloadable PDF. Priority: P1. Size: M

### [CF-170] Add tool onboarding tooltips for first-time users
Show guided tooltips on first visit to each tool explaining key features. Priority: P2. Size: M

---

## D) PAYMENT — Stripe, Pro Tier, Paywall (30 tasks)

### [CF-171] Configure Stripe products and prices for Pro tier
Create Stripe products: Pro Monthly ($19/mo), Pro Yearly ($149/yr) in Stripe Dashboard. Priority: P0. Size: S

### [CF-172] Implement Stripe Checkout session creation
Wire `api/checkout.js` to create Checkout sessions with correct price IDs and success/cancel URLs. Priority: P0. Size: M

### [CF-173] Implement Stripe webhook handler for subscription events
Handle `checkout.session.completed`, `customer.subscription.updated/deleted` in `api/stripe-webhook.js`. Priority: P0. Size: L

### [CF-174] Store subscription status in Firestore per user
On webhook events, update user document with: plan, status, period_end, stripe_customer_id. Priority: P0. Size: M

### [CF-175] Build subscription verification middleware
Create `api/verify-subscription.js` that checks Firestore for active Pro subscription before allowing access. Priority: P0. Size: M

### [CF-176] Implement client-side Pro feature gating
Check subscription status on page load, show upgrade prompt for Pro-only features. Priority: P0. Size: M

### [CF-177] Define Free vs Pro feature matrix
Free: 5 tools, 3 proposals/day, basic profile score. Pro: all tools, unlimited proposals, AI features, priority support. Priority: P0. Size: S

### [CF-178] Build upgrade prompt modal with pricing comparison
Design and implement modal showing Free vs Pro features side-by-side with CTA. Priority: P0. Size: M

### [CF-179] Implement Stripe Customer Portal for self-service billing
Wire `api/customer-portal.js` to create Stripe billing portal sessions for plan management. Priority: P0. Size: M

### [CF-180] Add billing history page in user dashboard
Show past invoices, payment amounts, dates, and receipt download links from Stripe. Priority: P1. Size: M

### [CF-181] Implement coupon/promo code system
Wire `api/apply-coupon.js` to validate and apply Stripe coupon codes at checkout. Priority: P1. Size: M

### [CF-182] Add annual billing discount with savings badge
Show "Save 35%" badge on annual plan, calculate and display monthly equivalent. Priority: P0. Size: S

### [CF-183] Implement trial period — 7-day Pro trial
Configure Stripe subscription with 7-day trial, send reminder email at day 5. Priority: P0. Size: M

### [CF-184] Build trial expiration flow with grace period
Show countdown during trial, send expiration warning, allow 3-day grace period before downgrade. Priority: P1. Size: M

### [CF-185] Implement usage-based soft limits for free tier
Track daily usage (proposals generated, AI queries) and show limit warning at 80%. Priority: P0. Size: M

### [CF-186] Add payment failed retry flow
Handle `invoice.payment_failed` webhook, show in-app banner, send retry email with update payment link. Priority: P0. Size: M

### [CF-187] Implement subscription pause/resume
Let users pause subscription for up to 3 months, maintain data but restrict Pro features. Priority: P2. Size: M

### [CF-188] Add referral credit system
Wire `api/referral.js` — give referrer 1 free month when referred user subscribes to Pro. Priority: P1. Size: L

### [CF-189] Implement team/agency pricing tier
Add Team plan ($49/mo for 5 seats) with shared workspace and team analytics. Priority: P2. Size: L

### [CF-190] Build pricing page with toggle (monthly/yearly)
Create standalone pricing page with plan comparison, FAQ, testimonials, and CTA buttons. Priority: P0. Size: M

### [CF-191] Add Stripe revenue tracking to HQ dashboard
Show MRR, churn rate, new subscriptions, trial conversions on `cortex-hq.html`. Priority: P0. Size: M

### [CF-192] Implement downgrade flow with data retention
When downgrading to Free, keep all data but restrict feature access with clear messaging. Priority: P1. Size: M

### [CF-193] Add payment receipt email via SendGrid
Send formatted receipt email after successful payment with invoice PDF attachment. Priority: P1. Size: M

### [CF-194] Implement Stripe tax collection for EU/UK VAT
Configure Stripe Tax for automatic VAT collection based on customer location. Priority: P1. Size: M

### [CF-195] Add lifetime deal option for early adopters
Create one-time payment product ($299 lifetime) available for first 100 customers. Priority: P1. Size: M

### [CF-196] Implement checkout abandonment recovery email
Track incomplete checkouts, send follow-up email after 1 hour with direct checkout link. Priority: P1. Size: M

### [CF-197] Build revenue notification system
Wire `api/notify-revenue.js` to send Slack/email notification on every new subscription. Priority: P1. Size: S

### [CF-198] Add Stripe test mode toggle for development
Implement environment-based Stripe key switching (test/live) via `api/stripe-config.js`. Priority: P0. Size: S

### [CF-199] Implement subscription analytics dashboard
Track: trial → paid conversion, churn reasons, ARPU, LTV, expansion revenue. Priority: P1. Size: L

### [CF-200] Add PCI compliance badge and security assurance
Display "Payments secured by Stripe" badge, link to security page explaining data handling. Priority: P1. Size: S

---

## E) AUTH — Firebase, Google Sign-in, User Dashboard (25 tasks)

### [CF-201] Enable Email/Password auth in Firebase Console
Activate Email/Password provider in Firebase Console for `tets-e825e` project. Priority: P0. Size: S

### [CF-202] Build email/password registration flow with validation
Add registration form with: email validation, password strength meter (8+ chars, mixed case, number), confirm password. Priority: P0. Size: M

### [CF-203] Implement email verification flow
Send verification email on registration, show "verify your email" banner until confirmed. Priority: P0. Size: M

### [CF-204] Build password reset flow
Implement forgot password page with Firebase `sendPasswordResetEmail()`, custom email template. Priority: P0. Size: M

### [CF-205] Fix Google Sign-in — deploy Firebase auth handler
Either deploy Firebase hosting for `__/auth/handler` or implement custom OAuth callback route. Priority: P0. Size: M

### [CF-206] Add Apple Sign-in provider
Configure Apple Sign-in in Firebase Console, add button to login page (required for iOS). Priority: P2. Size: L

### [CF-207] Implement auth session timeout
Auto-logout after 30 days of inactivity, show re-login prompt with context preservation. Priority: P1. Size: M

### [CF-208] Build user profile settings page
Create settings page: display name, email, photo upload, timezone, notification preferences. Priority: P0. Size: L

### [CF-209] Implement account deletion flow
Wire `api/delete-account.js` to delete Firestore data, cancel Stripe subscription, delete Firebase user. Priority: P0. Size: M

### [CF-210] Add data export (GDPR compliance)
Wire `api/export-data.js` to generate downloadable JSON/ZIP of all user data within 24 hours. Priority: P0. Size: M

### [CF-211] Build user onboarding wizard (3-step)
Step 1: Name + niche selection. Step 2: Import Upwork profile or manual setup. Step 3: Choose 3 priority tools. Priority: P0. Size: L

### [CF-212] Implement role-based access (free/pro/admin)
Store role in Firestore user doc, check role in middleware and client-side for feature gating. Priority: P0. Size: M

### [CF-213] Build admin panel for user management
Add admin-only page: view all users, subscription status, usage stats, impersonate user. Priority: P1. Size: L

### [CF-214] Implement auth state sync across browser tabs
Use `BroadcastChannel` API to sync login/logout state across all open tabs. Priority: P1. Size: S

### [CF-215] Add social login buttons styling consistency
Unify Google, Apple, Email login buttons with consistent sizing, spacing, and branding guidelines. Priority: P1. Size: S

### [CF-216] Implement progressive auth — use tools first, prompt signup later
Let guests use 3 tools before showing signup prompt, preserving their data on registration. Priority: P0. Size: M

### [CF-217] Build user dashboard — overview of all activity
Dashboard showing: profile score, recent proposals, earnings summary, tool usage, upcoming tasks. Priority: P0. Size: L

### [CF-218] Add notification center in dashboard
In-app notification bell: new job matches, payment received, subscription updates, tips. Priority: P1. Size: M

### [CF-219] Implement user preferences persistence in Firestore
Save: preferred tools, dashboard layout, theme, notification settings per user. Priority: P1. Size: M

### [CF-220] Add login analytics tracking
Track: login method, login frequency, session duration, pages visited per session. Priority: P1. Size: S

### [CF-221] Implement Firebase Security Rules
Write Firestore security rules: users can only read/write own data, admins can read all. Priority: P0. Size: M

### [CF-222] Add CAPTCHA to registration form
Integrate hCaptcha or reCAPTCHA v3 on signup form to prevent bot registrations. Priority: P1. Size: S

### [CF-223] Implement magic link login (passwordless)
Add Firebase email link authentication as alternative to password-based login. Priority: P2. Size: M

### [CF-224] Build account linking — merge guest data with registered account
When guest signs up, migrate localStorage data to Firestore under new user document. Priority: P0. Size: M

### [CF-225] Add multi-device session management
Show active sessions (device, location, last active), allow remote logout from settings. Priority: P2. Size: M

---

## F) MARKETING — CRO, SEO, Viral, Email, Product Hunt (35 tasks)

### [CF-226] Landing page hero section A/B test
Test two hero variants: "AI-Powered Upwork Assistant" vs "Win More Freelance Clients" — track conversion. Priority: P0. Size: M

### [CF-227] Add social proof section — waitlist counter + testimonials
Show live waitlist count (1,247+), add 3 beta tester testimonials with photos and quotes. Priority: P0. Size: M

### [CF-228] Add exit-intent popup with lead magnet
Show popup on mouse-leave: "Get our Free Freelancer Rate Guide" — capture email. Priority: P1. Size: M

### [CF-229] Optimize CTA button copy and placement
Test CTA variations: "Start Free" vs "Try Free Tools" vs "Boost Your Upwork Profile". Priority: P0. Size: S

### [CF-230] Add pricing comparison table (Free vs Pro)
Clear feature comparison table on landing page with checkmarks and X marks. Priority: P0. Size: M

### [CF-231] Build "How It Works" section with 3-step visual
Step 1: Connect profile → Step 2: Get AI analysis → Step 3: Win more clients. Priority: P0. Size: M

### [CF-232] Add video demo embed on landing page
Record 60-second Loom walkthrough, embed above the fold with play button overlay. Priority: P1. Size: M

### [CF-233] Implement scroll-triggered animations on landing page
Add subtle fade-in/slide-up animations for sections as user scrolls down. Priority: P2. Size: M

### [CF-234] Add trust badges — "As seen on", security, money-back guarantee
Display trust indicators: SSL secured, Stripe payments, 30-day money-back guarantee. Priority: P1. Size: S

### [CF-235] Create FAQ section with accordion UI
10 FAQs: pricing, data security, Upwork TOS compliance, cancellation, supported platforms. Priority: P0. Size: M

### [CF-236] Implement meta tags and Open Graph for all pages
Add og:title, og:description, og:image, twitter:card to landing, tools, and pricing pages. Priority: P0. Size: M

### [CF-237] Create XML sitemap and submit to Google Search Console
Generate sitemap.xml with all public pages, submit to GSC, verify indexing. Priority: P0. Size: S

### [CF-238] Add structured data (JSON-LD) for SaaS product
Implement SoftwareApplication schema markup on landing page for rich search results. Priority: P1. Size: S

### [CF-239] Optimize page speed — target Lighthouse 90+ on all pages
Compress images, defer non-critical JS, minimize CSS, enable Vercel edge caching. Priority: P0. Size: L

### [CF-240] Write 10 SEO blog posts for organic traffic
Topics: "How to write Upwork proposals", "Freelancer rate calculator", "Upwork fee explained". Priority: P1. Size: L

### [CF-241] Build blog section with CMS-like structure
Create `/blog/` directory with markdown-to-HTML rendering, pagination, and categories. Priority: P1. Size: L

### [CF-242] Create "Free Tools" landing pages for each tool (SEO)
Build standalone SEO-optimized pages for top 5 tools: proposal writer, rate calculator, fee calculator, invoice, bio generator. Priority: P0. Size: L

### [CF-243] Implement UTM parameter tracking end-to-end
Capture UTM params on landing, pass through to waitlist signup, store in analytics. Priority: P0. Size: M

### [CF-244] Build referral program page with unique share links
Create `/referral` page: generate unique links, track signups, show referral leaderboard. Priority: P1. Size: L

### [CF-245] Set up email drip campaign for waitlist (5 emails)
Email sequence: Welcome → Value props → Tool spotlight → Social proof → Launch invite. Priority: P0. Size: L

### [CF-246] Implement email capture on tool pages
Show email signup prompt after user completes a tool action: "Save your results — create free account". Priority: P0. Size: M

### [CF-247] Create Product Hunt launch checklist and assets
Prepare: tagline, description, 5 screenshots, maker comment, first-day supporter list. Priority: P0. Size: L

### [CF-248] Build Product Hunt launch page variant
Create special landing page for PH traffic with "Featured on Product Hunt" badge. Priority: P1. Size: M

### [CF-249] Set up Twitter/X automation for launch
Schedule 20 launch tweets: countdown, feature spotlights, behind-the-scenes, testimonials. Priority: P1. Size: M

### [CF-250] Create LinkedIn content series (5 posts)
Posts about: building in public, freelancer pain points, tool demos, launch announcement. Priority: P1. Size: M

### [CF-251] Build viral share mechanism — profile score cards
Generate shareable image cards: "My Upwork Profile Score: 87/100 — powered by Cortex Freelancer". Priority: P1. Size: M

### [CF-252] Implement in-app viral loops — invite friends for perks
"Invite 3 friends, get 1 month Pro free" with tracking and automated reward. Priority: P1. Size: L

### [CF-253] Create "Freelancer of the Week" community feature
Weekly spotlight of a user (with permission) on social media and in-app. Priority: P2. Size: M

### [CF-254] Set up Google Ads campaign targeting freelancer keywords
Create campaigns targeting: "upwork proposal generator", "freelance rate calculator", "upwork tool". Priority: P1. Size: L

### [CF-255] Implement Intercom or Crisp live chat for support
Add live chat widget on landing page and app for real-time user support. Priority: P1. Size: M

### [CF-256] Create comparison pages — Cortex vs competitors
Build pages: "Cortex vs Freelancer Map", "Cortex vs Upwork's Built-in Tools". Priority: P1. Size: M

### [CF-257] Set up affiliate program infrastructure
Build affiliate signup, unique tracking links, commission tracking (20% recurring). Priority: P2. Size: L

### [CF-258] Create email templates for transactional emails
Design templates: welcome, verification, password reset, payment receipt, trial ending. Priority: P0. Size: M

### [CF-259] Implement NPS survey after 7 days of usage
Show Net Promoter Score survey in-app, track responses, segment by plan type. Priority: P1. Size: M

### [CF-260] Build public roadmap page
Create `/roadmap` page with planned features, voting, and status updates (planned/building/shipped). Priority: P1. Size: M

---

## G) INFRA — Deploy, Security, Testing (20 tasks)

### [CF-261] Set up Vercel environment variables for production
Configure all env vars in Vercel dashboard: ANTHROPIC_API_KEY, STRIPE keys, Firebase config, SENDGRID key. Priority: P0. Size: S

### [CF-262] Implement API key rotation strategy
Document and implement quarterly rotation for all API keys with zero-downtime switchover. Priority: P1. Size: M

### [CF-263] Add rate limiting to all API endpoints
Implement IP-based rate limiting on all `/api/*` routes: 60 req/min general, 10 req/min for AI endpoints. Priority: P0. Size: M

### [CF-264] Implement request validation and sanitization
Add input validation (zod/joi) to all API endpoints — reject malformed requests before processing. Priority: P0. Size: L

### [CF-265] Set up error monitoring with Sentry
Integrate Sentry for both frontend JS errors and API serverless function errors. Priority: P0. Size: M

### [CF-266] Add structured logging to all API functions
Implement consistent JSON logging with request ID, user ID, action, and timing in all API routes. Priority: P1. Size: M

### [CF-267] Set up uptime monitoring with Vercel analytics + UptimeRobot
Monitor key endpoints: landing, app, /api/health, /api/chat with 1-minute checks. Priority: P0. Size: S

### [CF-268] Implement CI/CD pipeline with GitHub Actions
Create workflow: lint → test → build → deploy preview → deploy prod on merge to main. Priority: P0. Size: L

### [CF-269] Add ESLint configuration for all JS files
Configure ESLint with recommended rules, fix all existing errors, add to CI pipeline. Priority: P1. Size: M

### [CF-270] Write unit tests for API endpoints (20+ tests)
Test all critical API routes: checkout, webhook, chat, waitlist, verify-subscription using Vitest. Priority: P0. Size: L

### [CF-271] Write integration tests for auth flows
Test: email signup, Google sign-in, guest mode, session persistence, logout using Playwright. Priority: P1. Size: L

### [CF-272] Write E2E tests for critical user journeys
Test: landing → signup → use tool → upgrade → manage subscription using Playwright. Priority: P1. Size: L

### [CF-273] Set up staging environment on Vercel
Create staging branch with auto-deploy, separate Firebase project, test Stripe keys. Priority: P0. Size: M

### [CF-274] Implement database backup strategy for Firestore
Set up daily Firestore export to Cloud Storage bucket, test restore procedure. Priority: P1. Size: M

### [CF-275] Add CORS configuration for API routes
Configure proper CORS headers in `vercel.json` — allow only cortexfreelancer.com origin. Priority: P0. Size: S

### [CF-276] Implement API versioning strategy
Add `/api/v1/` prefix to all endpoints, document versioning policy for future breaking changes. Priority: P2. Size: M

### [CF-277] Set up performance budgets and monitoring
Define budgets: LCP < 2.5s, FID < 100ms, CLS < 0.1. Monitor with Web Vitals and alert on regression. Priority: P1. Size: M

### [CF-278] Implement DDoS protection configuration
Configure Vercel's built-in DDoS protection, add Cloudflare if needed for additional layer. Priority: P1. Size: M

### [CF-279] Create disaster recovery runbook
Document procedures for: API key compromise, database corruption, deployment rollback, provider outage. Priority: P1. Size: M

### [CF-280] Set up dependency vulnerability scanning
Configure Dependabot or Snyk for automated dependency vulnerability alerts and PRs. Priority: P1. Size: S

---

## H) DESIGN — Design System, Themes, Accessibility (20 tasks)

### [CF-281] Create design tokens file (colors, typography, spacing)
Define CSS custom properties for: 8 brand colors, 4 font sizes, 4 spacing units, 3 border radius values. Priority: P0. Size: M

### [CF-282] Build component library — buttons, inputs, cards, modals
Create reusable CSS classes for all common UI components with consistent styling. Priority: P0. Size: L

### [CF-283] Standardize typography across all pages
Apply consistent font family, sizes, and line heights: headings (Inter Bold), body (Inter Regular). Priority: P0. Size: M

### [CF-284] Fix dark mode — complete theme with proper contrast ratios
Audit all pages for WCAG AA contrast (4.5:1 for text), fix all failing elements. Priority: P0. Size: L

### [CF-285] Add system theme detection with manual override
Detect `prefers-color-scheme`, apply matching theme, allow manual toggle that persists. Priority: P1. Size: S

### [CF-286] Design loading states for all async operations
Create skeleton screens, spinners, and progress indicators for: tool loading, API calls, page transitions. Priority: P0. Size: M

### [CF-287] Design empty states for all tools
Create helpful empty states with illustrations and CTAs for when tools have no data. Priority: P1. Size: M

### [CF-288] Design error states with recovery actions
Create error UI components: inline errors, toast notifications, full-page error with retry button. Priority: P0. Size: M

### [CF-289] Implement toast notification system
Build reusable toast component: success (green), error (red), warning (yellow), info (blue) with auto-dismiss. Priority: P0. Size: M

### [CF-290] Add keyboard navigation support across all pages
Ensure all interactive elements are keyboard-accessible: tab order, focus indicators, Enter/Space activation. Priority: P0. Size: L

### [CF-291] Add ARIA labels to all interactive elements
Audit all buttons, inputs, links, and dynamic content for proper ARIA attributes. Priority: P0. Size: L

### [CF-292] Add screen reader announcements for dynamic content
Implement `aria-live` regions for: tool results, form validation, notifications, loading states. Priority: P1. Size: M

### [CF-293] Implement skip navigation link
Add "Skip to main content" link as first focusable element on every page. Priority: P1. Size: S

### [CF-294] Design responsive breakpoint system
Define breakpoints: mobile (< 640px), tablet (640-1024px), desktop (> 1024px) with fluid typography. Priority: P0. Size: M

### [CF-295] Create icon system with consistent style
Choose icon library (Lucide/Phosphor), replace inconsistent icons across all pages. Priority: P1. Size: M

### [CF-296] Design onboarding illustrations (5 custom graphics)
Create or source illustrations for: welcome, profile analysis, tools, upgrade, success states. Priority: P2. Size: L

### [CF-297] Add micro-interactions and hover effects
Add subtle hover animations to cards, buttons, and links for polished feel. Priority: P2. Size: M

### [CF-298] Implement print stylesheet for reports and invoices
Create `@media print` styles for invoice, earnings report, and proposal pages. Priority: P1. Size: S

### [CF-299] Add high contrast mode option
Implement accessibility toggle for high contrast theme meeting WCAG AAA (7:1 ratio). Priority: P2. Size: M

### [CF-300] Create brand guidelines document
Document: logo usage, color palette, typography, spacing rules, component patterns, do's and don'ts. Priority: P1. Size: M

---

## Summary

| Category | Range | Count |
|----------|-------|-------|
| A) UPWORK | CF-001 → CF-080 | 80 |
| B) BUGS | CF-081 → CF-120 | 40 |
| C) TOOLS | CF-121 → CF-170 | 50 |
| D) PAYMENT | CF-171 → CF-200 | 30 |
| E) AUTH | CF-201 → CF-225 | 25 |
| F) MARKETING | CF-226 → CF-260 | 35 |
| G) INFRA | CF-261 → CF-280 | 20 |
| H) DESIGN | CF-281 → CF-300 | 20 |
| **TOTAL** | | **300** |

### Priority Distribution
- **P0** (Must-have for launch): ~85 tasks
- **P1** (Important, post-launch OK): ~155 tasks
- **P2** (Nice-to-have): ~60 tasks

### Size Distribution
- **S** (< 2 hours): ~55 tasks
- **M** (2-8 hours): ~185 tasks
- **L** (1-3 days): ~60 tasks
