# Business Dev Agent

Freelance business development specialist — finds jobs, writes winning proposals, and optimizes your pipeline.

## What's Inside

```
business-dev/
├── SOUL.md              # Agent personality and behavioral rules
├── KNOWLEDGE.md         # Deep expertise on proposals, platforms, pricing
├── README.md            # This file
├── templates/           # 10 proposal templates (short + detailed variants)
│   ├── web-dev-proposal.md
│   ├── design-proposal.md
│   ├── writing-proposal.md
│   ├── data-entry-proposal.md
│   ├── mobile-dev-proposal.md
│   ├── seo-proposal.md
│   ├── video-editing-proposal.md
│   ├── translation-proposal.md
│   ├── consulting-proposal.md
│   └── follow-up.md
└── scripts/
    ├── job_scanner.py   # Scan Upwork RSS for matching jobs
    └── proposal_gen.py  # Generate personalized proposals
```

## Quick Start

### Scan for Jobs

```bash
python3 scripts/job_scanner.py --skills "python,django,api" --min-budget 500
python3 scripts/job_scanner.py --skills "react,typescript" --limit 5 --format json
python3 scripts/job_scanner.py --skills "design,figma" --min-rating 4.5
```

### Generate Proposals

```bash
# From a job description string
python3 scripts/proposal_gen.py --job "Build a REST API with Django and PostgreSQL for our SaaS platform"

# From a file with your profile
python3 scripts/proposal_gen.py --job-file job.txt --profile my_profile.json

# Short variant only
python3 scripts/proposal_gen.py --job "Logo design for tech startup" --variant short
```

### Create Your Profile

Create a `profile.json` file:

```json
{
  "name": "Your Name",
  "title": "Your Professional Title",
  "years_experience": 5,
  "skills": ["Python", "Django", "React"],
  "hourly_rate": 35,
  "timezone": "UTC+2",
  "platform_rating": 4.9,
  "jobs_completed": 47,
  "jss": 96,
  "portfolio": [
    {
      "name": "Project Name",
      "url": "https://your-portfolio.com/project",
      "description": "What you built and the result"
    }
  ]
}
```

## Using Templates Directly

All templates in `templates/` are markdown files with `[VARIABLE]` placeholders. You can:

1. Copy a template and fill in the variables manually
2. Use `proposal_gen.py` to auto-fill based on job description
3. Load them through OpenClaw for AI-assisted personalization

Each template includes both a **short variant** (3-5 sentences for quick bids) and a **detailed variant** (full proposal for high-value projects).

## Dependencies

- Python 3.8+ (standard library only)
- Internet connection (for RSS feed scanning)
