# Cortex Freelancer — Getting Started

## What is Cortex Freelancer?

Cortex Freelancer is a suite of **eight AI agent packages** built for the OpenClaw platform, designed specifically for freelancers working on Upwork, Fiverr, and Freelancer.com. Whether you're in Egypt, Pakistan, Nigeria, Turkey, or anywhere else in the world, these agents cover the full lifecycle of freelancing — finding work, managing projects, communicating with clients, optimizing your schedule, building your portfolio, growing your revenue, handling contracts, and getting paid.

Each agent is a self-contained package with its own personality, domain knowledge, ready-to-use templates, and automation scripts. Together, they form your complete virtual freelance team. The suite also includes **6 deep-dive skill modules** and **4 global utility scripts** that tie everything together.

---

## Requirements

- **OpenClaw** installed ([github.com/openclaw](https://github.com/openclaw))
- **Python 3.8+** (for automation scripts)
- **API key** configured in OpenClaw (see OpenClaw docs)

---

## Quick Start

```bash
# 1. Clone and navigate to the project
cd projects/cortex-freelancer

# 2. Run setup
bash scripts/setup.sh

# 3. Run the interactive onboarding wizard
python3 scripts/onboarding_wizard.py

# 4. Verify everything is working
python3 scripts/health_check.py

# 5. Start OpenClaw
openclaw start
```

The onboarding wizard walks you through profile setup, platform connections, skill tagging, and country-specific configuration. After that, all eight agents are available in your OpenClaw workspace.

---

## Agent Overview

### 1. Business Development (`agents/business-dev/`)

Your job hunter and proposal writer. Scans platform feeds for matching jobs and generates personalized proposals using battle-tested templates.

- Scans Upwork RSS feeds for jobs matching your skills
- Generates personalized proposals for 10 freelance categories (web dev, design, writing, mobile, SEO, video, translation, data entry, consulting, and more)
- Includes short and detailed variants for every proposal
- **Templates:** 10

**Key scripts:**
```bash
python3 agents/business-dev/scripts/job_scanner.py --skills "python,django,api" --min-budget 500
python3 agents/business-dev/scripts/proposal_gen.py --job "Build a REST API" --profile profile.json
```

---

### 2. Project Manager (`agents/project-manager/`)

Your operations backbone. Tracks projects, milestones, and deadlines, and generates client-ready status reports.

- Tracks projects, milestones, and deadlines in a simple JSON file
- Generates client-ready status reports
- Handles scope creep, revision requests, and difficult client scenarios
- **Templates:** 10

**Key scripts:**
```bash
python3 agents/project-manager/scripts/deadline_tracker.py add --project "Website redesign" --deadline 2026-04-15
python3 agents/project-manager/scripts/deadline_tracker.py status
python3 agents/project-manager/scripts/status_report.py --project "Website redesign"
```

---

### 3. Finance Manager (`agents/finance-manager/`)

Your money optimizer. Generates invoices, compares payment platform fees, and guides you through the cheapest payment setup for your country.

- Generates professional invoices with fee breakdowns
- Compares payment platform fees (Cenoa, Payoneer, Wise, PayPal, direct bank wire)
- Guides you through payment platform onboarding
- Tracks quarterly earnings and provides tax prep checklists
- **Templates:** 8

**Key scripts:**
```bash
python3 agents/finance-manager/scripts/invoice_gen.py --client "Acme Corp" --amount 1000 --currency USD
python3 agents/finance-manager/scripts/fee_calculator.py --amount 5000 --from USD --to EGP
python3 agents/finance-manager/scripts/cenoa_onboard.py --country egypt
```

---

### 4. Client Communications (`agents/client-comms/`)

Your professional communicator. Drafts polished emails and messages for every client interaction scenario, from initial outreach to project wrap-up.

- Drafts client emails for onboarding, updates, follow-ups, and escalations
- Covers tone calibration for different client types and cultures
- Handles difficult conversations (late payments, scope disagreements, contract endings)
- **Templates:** 12

**Key scripts:**
```bash
python3 agents/client-comms/scripts/email_drafter.py --type onboarding --client "Acme Corp"
python3 agents/client-comms/scripts/email_drafter.py --type followup --project "Website redesign"
python3 agents/client-comms/scripts/email_drafter.py --type payment-reminder --client "Acme Corp" --days-overdue 7
```

---

### 5. Schedule Manager (`agents/schedule-manager/`)

Your time zone and capacity planner. Manages scheduling across global clients and helps you avoid overcommitting.

- Converts and compares time zones for international client calls
- Plans weekly capacity based on active projects and availability
- Prevents overbooking and burnout by tracking workload
- **Templates:** 8

**Key scripts:**
```bash
python3 agents/schedule-manager/scripts/timezone_helper.py --from "Cairo" --to "New York" --time "14:00"
python3 agents/schedule-manager/scripts/capacity_planner.py --week 2026-W13 --hours-available 40
```

---

### 6. Portfolio Builder (`agents/portfolio-builder/`)

Your personal brand manager. Optimizes your freelancer profiles and turns completed projects into compelling case studies.

- Optimizes Upwork/Fiverr/LinkedIn profiles for search visibility
- Generates case studies from project data
- Suggests skill endorsements and portfolio ordering
- **Templates:** 8

**Key scripts:**
```bash
python3 agents/portfolio-builder/scripts/profile_optimizer.py --platform upwork --profile profile.json
python3 agents/portfolio-builder/scripts/case_study_gen.py --project "Website redesign" --metrics metrics.json
```

---

### 7. Growth Strategist (`agents/growth-strategist/`)

Your revenue advisor. Analyzes your earnings, benchmarks your rates against the market, and identifies opportunities to grow.

- Analyzes revenue trends across projects and platforms
- Benchmarks your rates against market data for your niche and region
- Recommends upsell opportunities and service packaging strategies
- **Templates:** 8

**Key scripts:**
```bash
python3 agents/growth-strategist/scripts/revenue_analyzer.py --period Q1-2026 --data earnings.json
python3 agents/growth-strategist/scripts/rate_benchmarker.py --skill "python" --region "middle-east" --experience 3
```

---

### 8. Contract & Legal (`agents/contract-legal/`)

Your legal safety net. Provides contract templates, red-flag checklists, and guidance for common freelancer legal scenarios.

- Provides freelancer-friendly contract templates for different project types
- Includes NDA, MSA, SOW, and amendment templates
- Red-flag checklists for reviewing client contracts
- Covers IP assignment, payment terms, and termination clauses
- **Templates:** 10

> Note: This agent provides templates and guidance only — it does not replace professional legal advice.

---

## Global Scripts

These scripts live in `scripts/` and work across all agents.

| Script | Command | Description |
|---|---|---|
| **Morning Briefing** | `python3 scripts/daily_brief.py` | Summarizes today's deadlines, pending proposals, overdue invoices, and schedule |
| **Weekly Report** | `python3 scripts/weekly_report.py` | Generates a full weekly business summary across all agents |
| **Onboarding Wizard** | `python3 scripts/onboarding_wizard.py` | Interactive CLI setup — profile, platforms, skills, country config |
| **Health Check** | `python3 scripts/health_check.py` | Verifies all agents, scripts, templates, and dependencies are working |

---

## Skills

Skills are deep-dive knowledge modules in `skills/`. They provide domain expertise that agents can reference during conversations.

| Skill | Directory | What It Covers |
|---|---|---|
| **Upwork Mastery** | `skills/upwork-mastery/` | Algorithm mechanics, JSS optimization, Top Rated and Top Rated Plus path |
| **Fiverr Mastery** | `skills/fiverr-mastery/` | Search ranking factors, gig SEO, buyer request optimization |
| **Upwork-to-Direct** | `skills/upwork-to-direct/` | Playbook for transitioning platform clients to direct contracts |
| **Cold Outreach** | `skills/cold-outreach/` | LinkedIn and email outreach frameworks, follow-up sequences |
| **Pricing Mastery** | `skills/pricing-mastery/` | Value-based pricing strategies, rate negotiation, package structuring |
| **Tax Basics** | `skills/tax-basics/` | Freelancer tax guide for Egypt, Pakistan, Nigeria, and Turkey |

---

## Using Agents Standalone (Without OpenClaw)

Every script works independently with just Python 3.8+. No exotic dependencies required. Templates are plain markdown files with `[VARIABLE]` placeholders that you can copy and customize manually. OpenClaw adds the AI agent layer on top — the conversational interface, memory, and orchestration.

---

## FAQ

**Q: Do I need OpenClaw installed to use the scripts?**
No. The Python scripts and markdown templates work standalone. OpenClaw adds the AI agent layer — the conversational interface, memory, and cross-agent orchestration.

**Q: Which freelance platforms are supported?**
The Business Dev and Portfolio Builder agents have templates optimized for Upwork, Fiverr, and Freelancer.com. Most other agents are platform-agnostic.

**Q: What payment platforms does the Finance Manager compare?**
Cenoa, Payoneer, Wise, PayPal, and direct bank wire. The comparison includes account fees, FX markup, withdrawal fees, and net take-home for each.

**Q: Can I customize the templates?**
Absolutely. All templates are markdown files with `[VARIABLE]` placeholders. Edit them directly or let the AI agent personalize them for you.

**Q: How many templates are included in total?**
82 templates across all eight agents, covering proposals, project communications, invoices, contracts, emails, profiles, and more.

**Q: What countries are covered for tax and payment guidance?**
Egypt, Pakistan, Nigeria, and Turkey have dedicated guidance. The fee calculator and payment comparisons work for any country.

**Q: How do I run the morning briefing?**
Run `python3 scripts/daily_brief.py` from the project root. It pulls data from all agents and gives you a single summary of what needs attention today.

**Q: How do I get help or report issues?**
Join our Discord community (link coming soon) or open an issue on the GitHub repository.

---

## Support

- Discord: _coming soon_
- GitHub Issues: _coming soon_
- Email: support@openclaw.dev
