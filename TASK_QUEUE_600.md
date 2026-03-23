# Cortex Freelancer — Upwork Integration Sprint
# Focus: Real Upwork profile connection, data extraction, live analysis
# Generated: 2026-03-23

## RUNNING

## PENDING

---
## 🔴 P0: UPWORK PROFILE SCRAPER & API (601-606)
---

### [601] upwork-profile-scraper
Build a Vercel serverless function at `/api/upwork-profile.js` that accepts a Upwork profile URL, scrapes the public profile page using cheerio (or similar), and returns structured JSON: { name, title, hourlyRate, totalEarnings, jobSuccess, totalJobs, totalHours, skills[], portfolio[], description, memberSince, location, categories[] }. Handle edge cases: private profiles, invalid URLs, rate limiting. Add proper error responses. Use fetch + cheerio (no puppeteer — keep it serverless-friendly). If Upwork blocks, implement a fallback that extracts data from the Upwork RSS feed or cached Google results.
Repo: /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer

### [602] upwork-profile-ui-integration
Update `/app/index.html` and `/app/engine.js` to call the real `/api/upwork-profile` endpoint instead of generating mock data. When user pastes an Upwork URL and clicks "Analyze": (1) show loading spinner, (2) call API, (3) populate all dashboard panels with REAL data (score, earnings, rate, skills, job success). Keep the seeded mock as fallback if API fails. Display a "✅ Live data from Upwork" or "⚠️ Estimated data" badge so users know which mode they're in.
Repo: /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer

### [603] upwork-profile-storage
After successfully fetching an Upwork profile, save it to Firebase Firestore under `profiles/{uid}/upwork`. For guest users, save to localStorage. This enables: returning users see their last analysis, dashboard pre-populates, and other tools (proposal writer, rate calculator) can pull their real data. Add a "Refresh Profile" button. Structure: { url, data: {...}, fetchedAt, source: 'live'|'cached' }.
Repo: /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer

### [604] upwork-data-to-tools
Wire the stored Upwork profile data into existing tools: (1) Rate Calculator auto-fills hourly rate + skills + location, (2) Proposal Writer pre-fills "Your Role" and experience level from profile, (3) Bio Generator pulls current bio for improvement suggestions, (4) Job Scanner uses skills for matching. Each tool checks `localStorage.cortex_upwork_profile` or Firestore on load and pre-populates relevant fields. Add a small "From your Upwork profile" label on auto-filled fields.
Repo: /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer

### [605] upwork-profile-score-algorithm
Replace the mock scoring in engine.js with a real scoring algorithm based on actual Upwork data. Scoring criteria: (1) Job Success Score weight 25%, (2) Hourly Rate vs market benchmark 20%, (3) Total Earnings tier 15%, (4) Profile completeness 15%, (5) Skills diversity & demand 10%, (6) Portfolio items 10%, (7) Response time estimate 5%. Output: overall score 0-100, letter grade, category scores, and 3-5 specific improvement recommendations based on weak areas. Make recommendations actionable ("Your rate of $25/hr is 30% below market for React developers — consider raising to $35/hr").
Repo: /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer

### [606] upwork-multi-platform-support
Extend the profile analyzer to also accept Fiverr and Freelancer.com profile URLs. Add platform detection (regex on URL). For Fiverr: scrape seller page for level, rating, reviews, gigs, response time. For Freelancer.com: scrape profile for skills, earnings, reviews, hourly rate. Normalize all platforms into the same data schema so the rest of the app (scoring, tools, dashboard) works identically regardless of platform. Update the input placeholder to "Paste your Upwork, Fiverr, or Freelancer.com profile URL..."
Repo: /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer

---
## DONE
[501] [502] [503] [504] [505] [506] [507] [508] [509] [510] [511] [512] [513] [514] [515] [516] [517] [518] [520] [521] [522] [523] [524] [525] [526] [527] [528] [529] [530] [531] [532] [533] [534] [535] [536] [537] [538] [539] [540]
