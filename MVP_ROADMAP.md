# Cortex Freelancer — MVP Roadmap

## Phase 0: Landing Page Polish (Today)
- [x] CRO improvements to existing page (sticky CTA, micro-animations, urgency text)
- [x] Working waitlist form with backend storage (JSON-file-based)
- [x] SEO meta tags, OG tags, Twitter cards
- [x] Social proof elements (live counter with seed number)
- [x] Mobile optimization pass
- [x] Smooth scroll to waitlist from all CTAs
- [x] Country flag emojis in dropdown

## Phase 1: Waitlist Backend (Today)
- [x] Node.js/Express server on port 3847
- [x] POST `/api/waitlist` — accepts {email, country, name}
- [x] Email format validation, duplicate detection
- [x] JSON-file storage (`data/waitlist.json`)
- [x] GET `/api/waitlist/count` — returns total signup count
- [x] GET `/api/waitlist/admin?token=...` — returns all signups (token-protected)
- [x] Thank you page after signup (`thanks.html`)
- [x] Admin dashboard (`admin.html`)
- [x] `start.sh` — install deps and launch server

## Phase 2: CRO Optimization (This Week)
- [ ] A/B test headlines (swap hero text variants, track CTR)
- [ ] Optimize CTA placement and copy (test button colors, text)
- [ ] Add urgency elements (countdown timer, limited spots messaging)
- [ ] Testimonial/social proof section enhancement (video testimonials, logos)
- [ ] Exit intent popup (detect mouse leaving viewport, show overlay)
- [ ] Scroll depth tracking (fire events at 25%, 50%, 75%, 100%)

## Phase 3: Marketing Prep (Next Week — by 2026-03-27)
- [ ] OG images (design 1200x630 cards for social sharing)
- [ ] Shareable social cards (per-country variants)
- [ ] Referral mechanism (unique share links with tracking, bonus for referrals)
- [ ] Email drip sequence for waitlist signees (welcome, day 3, day 7, pre-launch)

## Tech Stack
- **Server:** Node.js + Express
- **Storage:** JSON file (MVP) → PostgreSQL (post-launch)
- **Port:** 3847
- **Deployment:** Single `server.js` entry point serves static files + API
