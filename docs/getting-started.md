# Cortex Freelancer — Getting Started

## What is Cortex Freelancer?

Cortex Freelancer is a suite of three AI agent packages built for the OpenClaw platform, designed specifically for freelancers working on Upwork, Fiverr, and Freelancer.com. Whether you're in Egypt, Pakistan, Nigeria, Turkey, or anywhere else in the world, these agents handle the three biggest pain points of freelancing: finding work, managing projects, and getting paid.

Each agent is a self-contained package with its own personality, domain knowledge, ready-to-use templates, and automation scripts. They work together as your virtual freelance team — one finds the work, one manages it, and one makes sure you keep as much money as possible.

## Requirements

- **OpenClaw** installed ([github.com/openclaw](https://github.com/openclaw))
- **Python 3.8+** (for automation scripts)
- **API key** configured in OpenClaw (see OpenClaw docs)

## Quick Start

```bash
# 1. Clone and navigate to the project
cd projects/cortex-freelancer

# 2. Run setup
bash scripts/setup.sh

# 3. Start OpenClaw
openclaw start
```

That's it. All three agents are now available in your OpenClaw workspace.

## Agent Overview

### Business Dev Agent (`agents/business-dev/`)

Your job hunter and proposal writer. This agent:

- Scans Upwork RSS feeds for jobs matching your skills
- Generates personalized proposals using battle-tested templates
- Covers 10 freelance categories (web dev, design, writing, mobile, SEO, video, translation, data entry, consulting)
- Includes short and detailed variants for every proposal

**Key scripts:**
```bash
python3 agents/business-dev/scripts/job_scanner.py --skills "python,django,api" --min-budget 500
python3 agents/business-dev/scripts/proposal_gen.py --job "Build a REST API" --profile profile.json
```

### Project Manager Agent (`agents/project-manager/`)

Your operations backbone. This agent:

- Tracks projects, milestones, and deadlines in a simple JSON file
- Generates client-ready status reports
- Provides templates for every project communication scenario
- Handles scope creep, revision requests, and difficult clients

**Key scripts:**
```bash
python3 agents/project-manager/scripts/deadline_tracker.py add --project "Website redesign" --deadline 2026-04-15
python3 agents/project-manager/scripts/deadline_tracker.py status
python3 agents/project-manager/scripts/status_report.py --project "Website redesign"
```

### Finance Manager Agent (`agents/finance-manager/`)

Your money optimizer. This agent:

- Generates professional invoices with fee breakdowns
- Compares payment platform fees so you keep more of every dollar
- Guides you through the cheapest payment setup for your country
- Tracks quarterly earnings and provides tax prep checklists

**Key scripts:**
```bash
python3 agents/finance-manager/scripts/invoice_gen.py --client "Acme Corp" --amount 1000 --currency USD
python3 agents/finance-manager/scripts/fee_calculator.py --amount 5000 --from USD --to EGP
python3 agents/finance-manager/scripts/cenoa_onboard.py --country egypt
```

## Using Agents Standalone (Without OpenClaw)

Every script works independently with just Python 3.8+. No exotic dependencies required. Templates are plain markdown files you can copy and customize manually.

## FAQ

**Q: Do I need OpenClaw installed to use the scripts?**
No. The Python scripts and markdown templates work standalone. OpenClaw adds the AI agent layer on top — the conversational interface, memory, and orchestration.

**Q: Which freelance platforms are supported?**
The Business Dev agent has templates optimized for Upwork, Fiverr, and Freelancer.com. The Project Manager and Finance Manager agents are platform-agnostic.

**Q: What payment platforms does the Finance Manager compare?**
Cenoa, Payoneer, Wise, PayPal, and direct bank wire. The comparison includes account fees, FX markup, withdrawal fees, and net take-home for each.

**Q: Can I customize the templates?**
Absolutely. All templates are markdown files with `[VARIABLE]` placeholders. Edit them directly or let the AI agent personalize them for you.

**Q: How do I get help or report issues?**
Join our Discord community (link coming soon) or open an issue on the GitHub repository.

## Support

- Discord: _coming soon_
- GitHub Issues: _coming soon_
- Email: support@openclaw.dev
