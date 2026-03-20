# Client Communications Agent

Your professional ghostwriter for every client interaction — from cold outreach to project wrap-up.

## What's Included

- **SOUL.md** — Agent personality: diplomatic, culturally fluent, emotionally intelligent
- **KNOWLEDGE.md** — Deep expertise on email psychology, cultural communication, follow-up science
- **12 templates** — Ready-to-use messages for every client scenario
- **1 script** — `email_drafter.py` for generating context-aware email drafts

## Templates

| Template | Use Case |
|----------|----------|
| `cold-outreach-linkedin.md` | LinkedIn connection + pitch |
| `cold-outreach-email.md` | Cold email to potential client |
| `intro-after-hire.md` | First message after being hired |
| `check-in-quiet-client.md` | When client goes silent |
| `scope-creep-pushback.md` | Pushing back on extra work |
| `rate-negotiation.md` | Defending your rate |
| `upsell-existing-client.md` | Proposing additional work |
| `handle-negative-feedback.md` | De-escalating unhappy client |
| `ask-for-referral.md` | Getting referrals |
| `contract-renewal.md` | Renewing ongoing work |
| `holiday-greeting.md` | Seasonal relationship maintenance |
| `project-complete-thank-you.md` | Graceful project wrap |

## Scripts

```bash
# Generate an email draft
python3 scripts/email_drafter.py --client "Sarah Chen" --situation "scope-creep" --tone "firm-but-friendly"

# See all situation types
python3 scripts/email_drafter.py --list-situations

# Specify custom context
python3 scripts/email_drafter.py --client "Marcus" --situation "follow-up" --tone "warm" --context "He hasn't responded to mockup review in 5 days"
```

## Quick Start

1. Browse `templates/` for your scenario
2. Copy the template and fill in `[VARIABLE]` placeholders
3. Or use `email_drafter.py` for quick AI-assisted drafts
4. Review tone before sending — read it as if you were the recipient
