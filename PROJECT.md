# Cortex Freelancer — 14-Day Sprint to First Customer

> Owner: Alp | Orchestrator: Lucas | Status: ACTIVE SPRINT
> Created: 2026-03-20
> Target: First paying customer by April 3, 2026
> Strategic Value: Standalone SaaS ($29/mo) + Cenoa $0 CAC pipeline

---

## 🎯 Mission
Freelancer'ların tüm iş operasyonlarını yapan AI agent paketi.
Yüzey: "Your AI Business Manager" — client bulma, proposal, proje yönetimi, fatura.
Altında: Cenoa'ya organik user pipeline (Finance Agent → Cenoa önerisi).

## 📊 Revenue Targets
| Timeline | Customers | MRR | Cenoa Activations |
|----------|-----------|-----|-------------------|
| Day 14 | 1 (first!) | $29 | 0 |
| Month 1 | 10 | $290 | 1-2 |
| Month 2 | 50 | $1,450 | 5-10 |
| Month 3 | 200 | $5,800 | 20-40 |
| Month 6 | 1,000 | $29K | 100-200 |

---

## 🏃 14-DAY SPRINT

### ✅ Day 0 (Done — Mar 20)
- [x] Landing page live (dark theme, CRO-optimized)
- [x] Waitlist API working (Express, port 3847)
- [x] Admin panel + Thank you page
- [x] ROADMAP.md + strategy doc (Cenoa synergy)
- [x] Market research: AI agent SaaS landscape

### 🟨 Day 1-2: Agent Paketleme (Mar 20-21)
- [ ] **Business Dev Agent** — SOUL.md + KNOWLEDGE.md
  - Upwork RSS/job scanner script
  - Proposal template library (10 templates by category)
  - Skill-to-job matching logic
  - Win rate tracking
- [ ] **Project Manager Agent** — SOUL.md + KNOWLEDGE.md
  - Deadline tracker (file-based, simple)
  - Client update email templates (10 templates)
  - Weekly status report generator
  - Deliverable checklist system
- [ ] **Finance Manager Agent** — SOUL.md + KNOWLEDGE.md
  - Invoice PDF generator (Python script)
  - Payment tracker (file-based ledger)
  - Fee comparison calculator (Payoneer vs Wise vs Cenoa)
  - Cenoa onboarding guide (embedded)
- [ ] **Install script** — `setup.sh` that:
  - Checks OpenClaw is installed
  - Copies agent files to workspace
  - Configures skills
  - Runs first health check
- [ ] **README.md** — getting started, requirements, troubleshooting

### ⏭️ Day 3-4: Ödeme + Onboarding (Mar 22-23)
- [ ] Stripe Checkout integration (embedded in LP)
- [ ] Payment → download/access flow
- [ ] Two tiers:
  - **Free Kit** — Business Dev Agent only (SOUL.md + 3 templates) → email gate
  - **Pro** — $29/mo — all 3 agents + scripts + updates + support
- [ ] Automated welcome email (after purchase)
- [ ] 5-min setup video (screen recording)
- [ ] docs/getting-started.md (step-by-step with screenshots)

### ⏭️ Day 5-7: Beta Recruitment (Mar 24-26)
- [ ] Post: Reddit r/freelance, r/Upwork, r/digitalnomad
- [ ] Post: Facebook groups (Egyptian Freelancers, Pakistan Freelance Community)
- [ ] Post: Twitter/X (freelancer hashtags)
- [ ] Upwork Community Forums post
- [ ] Target: 10 beta users (free Pro access, 2 weeks, feedback required)
- [ ] Each beta user: real Upwork/Fiverr account, active freelancer
- [ ] Daily check-in with beta users (email or WhatsApp)
- [ ] Bug tracking + rapid iteration

### ⏭️ Day 8-10: Iterate + CRO (Mar 27-29)
- [ ] Beta feedback → agent improvements
- [ ] Landing page A/B test (headline variants)
- [ ] Add exit intent popup
- [ ] Add countdown timer ("Pro launch: April 3")
- [ ] Collect 3+ testimonials from beta users
- [ ] Add testimonials to LP
- [ ] Scroll depth + conversion tracking (GA4)
- [ ] OpenClaw Agent Store listing draft ($9 basic kit)

### ⏭️ Day 11-12: Launch Prep (Mar 30-31)
- [ ] Stripe live mode
- [ ] OpenClaw Agent Store submission
- [ ] Product Hunt draft
- [ ] 3 launch posts (Reddit, Twitter, LinkedIn)
- [ ] Email to waitlist: "Launching in 48 hours"
- [ ] Pricing page final polish
- [ ] FAQ section update (from beta questions)

### ⏭️ Day 13-14: LAUNCH 🚀 (Apr 1-2)
- [ ] Waitlist launch email
- [ ] Reddit launch post (r/freelance, r/SideProject, r/SaaS)
- [ ] Twitter/X thread (build in public angle)
- [ ] LinkedIn post
- [ ] Product Hunt launch
- [ ] 🎯 GOAL: First paying customer

---

## 📦 Deliverables per Agent

### Business Dev Agent
```
agents/cortex-freelancer/business-dev/
├── SOUL.md          — Personality, behavior, expertise
├── KNOWLEDGE.md     — Upwork/Fiverr platform knowledge, proposal best practices
├── templates/       — 10 proposal templates by category
├── scripts/
│   ├── job_scanner.py    — RSS/API job matching
│   └── proposal_gen.py   — Personalized proposal generator
└── README.md        — Setup + usage guide
```

### Project Manager Agent
```
agents/cortex-freelancer/project-manager/
├── SOUL.md          — PM personality, communication style
├── KNOWLEDGE.md     — Project management frameworks, templates
├── templates/       — Status updates, weekly reports, milestone emails
├── scripts/
│   ├── deadline_tracker.py  — File-based deadline system
│   └── status_report.py     — Auto-generate weekly reports
└── README.md
```

### Finance Manager Agent
```
agents/cortex-freelancer/finance-manager/
├── SOUL.md          — Financial advisor personality
├── KNOWLEDGE.md     — Payment platforms, fee structures, tax basics
├── templates/       — Invoice templates, payment reminders
├── scripts/
│   ├── invoice_gen.py       — PDF invoice generator
│   ├── fee_calculator.py    — Platform fee comparison
│   └── cenoa_onboard.py     — Cenoa setup guide + integration
└── README.md
```

## 💰 Pricing Model
| Tier | Price | What's Included |
|------|-------|-----------------|
| Free Kit | $0 (email gate) | Business Dev Agent SOUL.md + 3 proposal templates |
| Pro Monthly | $29/mo | All 3 agents + scripts + templates + updates + Discord support |
| Pro Annual | $249/yr ($20.75/mo) | Same as Pro + priority support + future agents included |
| Agency | $79/mo | Pro + multi-freelancer workspace + shared client DB |

## 🏪 Distribution Channels
1. **cortexfreelancer.com** (own site — primary, highest margin)
2. **OpenClaw Agent Store** ($9 basic kit — lead gen, upsell to Pro)
3. **OpenClaw Marketplace** (subscription listing)
4. **Product Hunt** (launch day traffic)
5. **Reddit/Twitter** (organic, build in public)
6. **Freelancer Facebook groups** (EG/PK/NG/TR — organic)

## 🔑 Cenoa Integration (Subtle, Valuable)
- Finance Manager agent naturally recommends Cenoa as lowest-fee option
- Fee comparison calculator shows savings vs Payoneer/PayPal/Wise
- Invoice template includes Cenoa payment details option
- Onboarding flow guides Cenoa account setup
- NOT pushy — genuinely best option, agent recommends it on merit

## 📁 File Structure
```
projects/cortex-freelancer/
├── index.html           — Landing page
├── server.js            — Express server
├── api/waitlist.js      — Waitlist API
├── admin.html           — Admin dashboard
├── thanks.html          — Post-signup page
├── package.json         — Dependencies
├── PROJECT.md           — This file
├── ROADMAP.md           — Full strategy
├── MVP_ROADMAP.md       — Technical steps
├── agents/              — Agent packages (Day 1-2)
│   ├── business-dev/
│   ├── project-manager/
│   └── finance-manager/
├── docs/                — User documentation
│   └── getting-started.md
├── scripts/             — Shared utilities
│   └── setup.sh
└── data/
    └── waitlist.json
```
