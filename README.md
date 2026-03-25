# Cortex Freelancer

AI Business Manager for Freelancers → Complete automation from job discovery to payment.

## 🎯 Current Status: Phase 3 Sprint Active

**Live Site:** https://cortexfreelancer.com  
**Sprint Progress:** Wave 1 Complete (8/50 tasks) | Wave 2 Auto-Starting  
**Target:** Full MVP in 3 weeks (27 Mar - 17 Apr 2026)

## ⚡ Quick Start

```bash
npm install
npm start        # http://localhost:3847
```

## 🚀 What's Working Now

### ✅ Wave 1 Completed (CF3-001 to CF3-008):
- **Job Discovery:** Upwork scraper with rate limiting → `scripts/upwork-job-scraper.js`
- **Job Matching:** NLP algorithm for skill-job relevance scoring
- **Proposals:** Enhanced generator with client research integration  
- **Pricing:** Market rate calculator with regional analysis
- **Portfolio:** Analyzer with improvement suggestions → `app/js/portfolio-analyzer.js`
- **Communication:** Template system for client emails/chat
- **Project Management:** Timeline planner with Gantt charts → `app/js/project-timeline-planner.js`
- **Invoicing:** PDF generator with tax integration

### 🔄 Wave 2 Auto-Starting (CF3-009 to CF3-015):
- Expense tracking with receipt parsing
- Tax document preparation  
- Competitor rate monitoring
- Win/loss analytics
- AI memory system
- Multi-language support

## 🏗️ Architecture

**Frontend:** React + WebSocket real-time chat  
**Backend:** Node.js + Express API  
**AI Layer:** OpenClaw ACP agents + Anthropic Claude  
**Automation:** Auto-dispatcher with 2-min intervals  
**Deployment:** Vercel production + local development

## 📋 Sprint System

**File:** `TASK_QUEUE_PHASE3.md` (single source of truth)  
**Velocity:** 30 tasks/hour sustained  
**Method:** 4 parallel ACP agents with auto-spawning  
**Progress:** Real-time via auto-dispatcher cron job

## 🔥 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | No | Stripe secret key. When missing: mock mode auto-creates customer records. |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret for real webhook verification. |
| `STRIPE_PRICE_PRO_MONTHLY` | No | Stripe Price ID for $29/mo plan. |
| `STRIPE_PRICE_PRO_ANNUAL` | No | Stripe Price ID for $249/yr plan. |
| `ADMIN_TOKEN` | No | Admin toggle-pro endpoint token (default: `cortex-admin-2026`). |

## 📊 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/checkout` | Create Stripe Checkout session (or mock) |
| `POST` | `/api/webhook` | Stripe webhook handler |
| `GET` | `/api/customer/:email` | Check Pro subscription status |
| `POST` | `/api/admin/toggle-pro` | Admin: grant/revoke Pro access |
| `POST` | `/api/waitlist` | Join waitlist |
| `GET` | `/api/waitlist/count` | Public waitlist count |

## 🎯 Success Metrics

**27 Mart Target:** Core automation functional (Week 1 complete)  
**3 Nisan Target:** External integrations working (Week 2 complete)  
**10 Nisan Target:** Production launch ready (Week 3 complete)  

**Current:** 53% of Week 1 complete, on track for aggressive timeline

## ⚠️ Important Notes

**ONLY PHASE 3 TASKS ARE VALID.** All previous task queues (300, 500, Sprint 1-2) are deprecated.

**Progress Tracking:** Check `PROJECT_MASTER.md` for unified status  
**Technical Details:** See `TASK_QUEUE_PHASE3.md` for active sprint  
**Git History:** Major milestones tagged with detailed commit messages

## 🚀 Deployment

Deployed on Vercel. Push to `main` to deploy.  
**Production URL:** https://cortexfreelancer.com  
**Staging:** Auto-deployed from feature branches