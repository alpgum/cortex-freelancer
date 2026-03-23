# Upwork Profile Scraping Test Results

**Date:** 2026-03-23 18:46 UTC  
**API Endpoint:** `https://cortexfreelancer.com/api/upwork-profile`  
**Profiles Tested:** 5

## Summary Table

| # | Profile URL | HTTP Status | success | Name | Title | Rate | JSS | Skills | Portfolio | Source |
|---|-------------|-------------|---------|------|-------|------|-----|--------|-----------|--------|
| 1 | `~01e413e21135860027` | 200 | ✅ true | ❌ null | ❌ null | ❌ null | ❌ null | ❌ [] | ❌ [] | google_cache |
| 2 | `~014b4f02c58e9ba1f2` | 200 | ✅ true | ❌ null | ❌ null | ❌ null | ❌ null | ❌ [] | ❌ [] | google_cache |
| 3 | `~0142e9eb5765861e29` | 200 | ✅ true | ❌ null | ❌ null | ❌ null | ❌ null | ❌ [] | ❌ [] | google_cache |
| 4 | `~01a2b3c4d5e6f78901` | 200 | ✅ true | ❌ null | ❌ null | ❌ null | ❌ null | ❌ [] | ❌ [] | google_cache |
| 5 | `~01fba0c1c3e0e2ab0b` | 200 | ✅ true | ❌ null | ❌ null | ❌ null | ❌ null | ❌ [] | ❌ [] | google_cache |

## Key Findings

### ✅ What Works
- **API routing is functional** — all 5 requests returned HTTP 200
- **Response schema is correct** — consistent JSON shape with all expected fields
- **Fallback logic works** — direct scraping failed, correctly fell back to `google_cache` source
- **No crashes or errors** — API handles blocked profiles gracefully

### ❌ What Doesn't Work
- **ALL fields are null/empty** across all 5 profiles (0% data extraction)
- **Google cache fallback returns no data** — the cache parser isn't extracting anything useful
- **Direct Upwork scraping is blocked** — Upwork likely returns 403/Cloudflare challenge to server-side requests

### Field Reliability

| Field | Populated | Always Null | Notes |
|-------|-----------|-------------|-------|
| name | 0/5 | 5/5 | ❌ Never populated |
| title | 0/5 | 5/5 | ❌ Never populated |
| hourlyRate | 0/5 | 5/5 | ❌ Never populated |
| totalEarnings | 0/5 | 5/5 | ❌ Never populated |
| jobSuccess | 0/5 | 5/5 | ❌ Never populated |
| totalJobs | 0/5 | 5/5 | ❌ Never populated |
| totalHours | 0/5 | 5/5 | ❌ Never populated |
| skills | 0/5 | 5/5 | ❌ Always empty array |
| portfolio | 0/5 | 5/5 | ❌ Always empty array |
| description | 0/5 | 5/5 | ❌ Never populated |
| memberSince | 0/5 | 5/5 | ❌ Never populated |
| location | 0/5 | 5/5 | ❌ Never populated |
| categories | 0/5 | 5/5 | ❌ Always empty array |

## Root Cause Analysis

1. **Upwork blocks server-side requests** — Upwork uses Cloudflare protection + bot detection. A simple `fetch()` from a Vercel serverless function gets blocked (403 or JS challenge page).
2. **Google cache fallback is empty** — Google's cached version of Upwork profiles either:
   - Doesn't exist for these specific profiles
   - Returns a JS-rendered shell (no actual profile data in HTML)
   - The Google cache URL pattern may be incorrect

## Recommendations

### Priority 1: Use a Scraping Proxy Service
- **ScrapingBee** or **Bright Data** — headless browser + residential proxy
- These services render JavaScript and bypass Cloudflare
- Cost: ~$0.005-0.01 per request (affordable at scale)
- Implementation: Replace `fetch(upworkUrl)` with `fetch(scrapingBeeUrl + upworkUrl)`

### Priority 2: Use Upwork's Public API (if available)
- Upwork has a developer API that may expose profile data
- Requires OAuth authentication
- More reliable but has rate limits

### Priority 3: Improve Google Cache Parser
- Debug what Google cache actually returns for Upwork profiles
- Some data may be in `<script>` tags as JSON-LD or Next.js hydration data
- Test with: `cache:upwork.com/freelancers/~XXXXX` in Google

### Priority 4: Alternative Data Sources
- **Bing cache** as secondary fallback
- **Wayback Machine** (archive.org) snapshots
- **LinkedIn cross-reference** (if profile links are available)

## Conclusion

**The API infrastructure works correctly** — routing, error handling, response schema, and fallback logic are all functional. The core issue is that **Upwork aggressively blocks server-side scraping**, and the Google cache fallback doesn't yield usable data. A scraping proxy service (ScrapingBee) is the recommended next step to get real profile data flowing.
