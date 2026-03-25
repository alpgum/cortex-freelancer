# Client CRM with Relationship Scoring

A comprehensive client relationship management system built for freelancers. Pure Python, no external dependencies, JSON-based persistence.

## Features

### Core CRM
- **Client profiles** — name, company, contact info, platform (Upwork/Fiverr/direct/etc.), project history, notes
- **Communication history** — log emails, calls, messages, meetings with timestamps and context
- **Relationship scoring** — 0-100 weighted score based on 7 factors (see algorithm below)
- **Lifecycle stages** — Lead → Prospect → Active → Repeat → Champion → Dormant → Lost
- **Tags & categories** — industry, budget tier (low/mid/high/enterprise), custom tags

### Relationship Intelligence
- **Health indicators** — automatic dormancy detection with stage-specific thresholds
- **Communication cadence** — recommendations based on client tier
- **Client value analysis** — total revenue, avg project size, LTV projection, effective rate
- **Red flag tracking** — late payments, scope creep, difficult communication (with severity)
- **Referral tracking** — who referred whom, referral revenue attribution

## Installation

No installation needed. Pure Python stdlib.

```bash
# Run directly
python client_crm.py <command>

# Or make executable
chmod +x client_crm.py
./client_crm.py <command>
```

## CLI Commands

### Add a Client
```bash
python client_crm.py add
# Interactive prompts for name, company, email, platform, stage, tags, etc.
```

### List Clients
```bash
python client_crm.py list
python client_crm.py list --stage active
python client_crm.py list --tag web
python client_crm.py list --platform upwork
python client_crm.py list --score-min 70
python client_crm.py list --score-min 50 --score-max 80
```

### Show Client Details
```bash
python client_crm.py show <id-or-name>
# Shows: profile, score breakdown, health status, value analysis,
#        projects, red flags, recent communications, referrals
```

### Log Communication
```bash
python client_crm.py log <id-or-name>
# Interactive: type (email/call/message/meeting/video_call),
#              direction, subject, summary, follow-up
```

### View Relationship Score
```bash
python client_crm.py score <id-or-name>
# Detailed factor breakdown with weights
```

### Health Dashboard
```bash
python client_crm.py health
# Shows: at-risk clients, warnings, upcoming follow-ups, summary
```

### Dormant Clients
```bash
python client_crm.py dormant
# Lists all clients needing attention with recommended actions
```

### Portfolio Analytics
```bash
python client_crm.py stats
# Stage distribution, revenue stats, top clients, platform breakdown,
# score distribution, communication stats, red flags, referral network
```

### Export / Import
```bash
python client_crm.py export --output clients.csv
python client_crm.py import data.csv
```

### Edit / Delete
```bash
python client_crm.py edit <id-or-name>
python client_crm.py delete <id-or-name>
```

## Relationship Scoring Algorithm

Score = Σ (weight × factor), where each factor is 0-100:

| Factor | Weight | Description |
|--------|--------|-------------|
| Payment Reliability | 25% | Manual rating, auto-penalized -15 per late payment flag |
| Responsiveness | 15% | Manual rating from profile |
| Project Frequency | 15% | Derived from completed project count (0→10, 1→30, 2-3→55, 4-6→75, 7+→95) |
| Scope Creep History | 15% | 100 minus 20 per scope creep flag (inverse) |
| Referral Potential | 10% | Manual rating + 10 bonus per actual referral |
| Communication Quality | 10% | Manual rating from profile |
| Budget Tier | 10% | low=25, mid=50, high=75, enterprise=100 |

### Grades
- **A+**: 90-100 | **A**: 80-89 | **B**: 70-79 | **C**: 60-69 | **D**: 40-59 | **F**: <40

### Tuning
Edit `SCORING_WEIGHTS` in `client_crm.py` to adjust weights. All weights must sum to 1.0.

## Dormancy Thresholds

Days since last contact before flagging at-risk:

| Stage | Threshold | Warning (70%) |
|-------|-----------|---------------|
| Champion | 60 days | 42 days |
| Repeat | 45 days | 31 days |
| Active | 30 days | 21 days |
| Prospect | 21 days | 15 days |
| Lead | 14 days | 10 days |

## Data Storage

```
~/.cortex-freelancer/crm/
├── clients.json          # Client profiles
└── communications.json   # Communication logs
```

JSON format, human-readable, easy to backup or version control.

## Programmatic API

Use `CRMApp` directly for integration with other tools:

```python
from client_crm import CRMApp, CRMStore

app = CRMApp()

# Add client
client = app.cmd_add_noninteractive(
    name="Alice Smith", company="AliceCo",
    platform="upwork", stage="active",
    budget_tier="high", tags=["web", "react"]
)

# Add project
app.add_project(client.id, "Website Redesign", revenue=5000, hours=40)

# Log communication
app.cmd_log_noninteractive(client.id, comm_type="call", subject="Kickoff")

# Add red flag
app.add_red_flag(client.id, "scope_creep", "Added 3 features mid-sprint", severity=2)

# Get score
from client_crm import RelationshipScorer
scorer = RelationshipScorer()
comms = app.store.get_client_comms(client.id)
result = scorer.calculate(client, comms)
print(f"Score: {result['score']} ({result['grade']})")
```

## Integration Points

Designed to integrate with:
- **Invoice system** — feed payment data to update `payment_reliability` and flag late payments
- **Time tracker** — sync project hours for accurate effective rate calculations
- **Email system** — auto-log communications from email templates tool

## Tests

```bash
python -m unittest test_client_crm -v
# 102 tests covering models, storage, scoring, health, CLI, edge cases
```

## File Structure

```
client_crm.py          # Main CRM application (53KB)
test_client_crm.py     # Test suite (102 tests)
README-client-crm.md   # This file
```
