# Cortex Freelancer — Upwork Real Profile Analysis Sprint
# Goal: User pastes Upwork URL → gets real, AI-powered profile analysis
# Generated: 2026-03-23

## PENDING

### [U-001] Fix Vercel serverless API routing
API routes return 404 on Vercel. The api/ files use Express-style middleware (withErrorHandler, cors, rateLimit) but Vercel serverless needs direct (req, res) exports. Fix: either add Vercel serverless adapter wrapper or configure vercel.json functions properly. Test /api/upwork-profile returns 200.
Priority: P0 BLOCKER

### [U-002] Fix Upwork scraping — handle Cloudflare/bot protection  
Current fetch() with fake UA gets blocked by Cloudflare. Implement: (1) Try direct fetch first, (2) If 403/blocked → use ScrapingBee/ScraperAPI free tier as proxy, (3) If still blocked → Google cache fallback already exists. Add SCRAPING_API_KEY env var support.
Priority: P0

### [U-003] Test real Upwork profile parsing with 5 different profiles
Fetch 5 real Upwork profiles (varying: top-rated, new, different countries). Log what fields parse correctly vs null. Create test-results.json with actual output. This tells us what data we CAN extract reliably.
Priority: P0

### [U-004] Real scoring algorithm based on extracted data
Replace mock scoring. Inputs: jobSuccess (25%), hourlyRate vs market (20%), totalEarnings (15%), profile completeness (15%), skills demand (10%), portfolio (10%), response time (5%). Output: 0-100 score, letter grade, category breakdown, 3-5 actionable recommendations.
Priority: P0

### [U-005] AI-powered analysis with Anthropic Claude
Add real AI analysis: send parsed profile data to Claude API → get personalized recommendations. Sections: (1) Profile Strength, (2) Rate Optimization, (3) Skill Gap Analysis, (4) Competition Positioning, (5) Actionable Next Steps. Use ANTHROPIC_API_KEY env. Fallback to rule-based if no key.
Priority: P0

### [U-006] Frontend — show real analysis results (not mock)
Update the profile analyzer UI to display real scraped data + AI analysis. Show: profile card (name, photo, title, rate, JSS), score wheel, category breakdown bars, AI recommendations as expandable cards. Loading states while scraping + analyzing.
Priority: P0

### [U-007] Rate comparison database — market benchmarks
Build a static JSON of market rate benchmarks by skill category + country. Sources: Upwork rate reports, Payoneer surveys, public data. Used by scoring algorithm to compare user's rate vs market. At least 20 skill categories × 5 experience levels.
Priority: P1

### [U-008] Profile completeness checker
Score profile completeness: has title? (10%), description length >200 chars? (15%), skills >5? (10%), portfolio >0? (15%), JSS exists? (10%), hourlyRate set? (10%), profile photo? (10%), categories set? (10%), member >6mo? (10%). Show checklist UI with green/red items.
Priority: P1

### [U-009] Competitor comparison — find similar freelancers
Given user's skills + category, search Upwork for 5 similar freelancers. Compare: rate, JSS, earnings, response time. Show "You vs Market" comparison table. This is a premium feature (Pro).
Priority: P2

### [U-010] Save analysis to localStorage + share link
After analysis, save result to localStorage with timestamp. Generate shareable URL with encoded profile data (or short hash → server store). Show "Share Your Score" card with Twitter/LinkedIn share buttons.
Priority: P1
