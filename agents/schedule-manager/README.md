# Schedule & Productivity Agent

Your time management enforcer — protects deep work, manages timezone chaos, and prevents overcommitment.

## What's Included

- **SOUL.md** — Agent personality: protective, timezone-savvy, burnout-aware
- **KNOWLEDGE.md** — Deep expertise on time management, capacity planning, meeting strategy
- **8 templates** — Scheduling messages, planning frameworks, and focus rules
- **2 scripts** — `timezone_helper.py` and `capacity_planner.py`

## Templates

| Template | Use Case |
|----------|----------|
| `meeting-request.md` | Professional meeting invite with timezone options |
| `meeting-decline.md` | Declining a meeting politely |
| `availability-update.md` | Informing clients of schedule changes |
| `weekly-plan.md` | Weekly planning template |
| `daily-standup.md` | Self-standup format |
| `capacity-check.md` | "Can I take this project?" decision framework |
| `vacation-notice.md` | Out-of-office message |
| `deep-work-rules.md` | Rules for protecting focus time |

## Scripts

```bash
# Find best meeting times between timezones
python3 scripts/timezone_helper.py --my-tz "UTC+2" --client-tz "EST"

# Check your current capacity
python3 scripts/capacity_planner.py --projects projects.json

# Quick capacity check with inline data
python3 scripts/capacity_planner.py --add "Website Redesign:15" --add "Logo Project:8" --add "SEO Audit:10"
```
