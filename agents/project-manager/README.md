# Project Manager Agent

Freelance project management specialist — tracks deadlines, manages milestones, and handles client communication.

## What's Inside

```
project-manager/
├── SOUL.md              # Agent personality and behavioral rules
├── KNOWLEDGE.md         # Project lifecycle, scope management, client handling
├── README.md            # This file
├── templates/           # 10 communication templates
│   ├── project-kickoff.md
│   ├── milestone-update.md
│   ├── weekly-status.md
│   ├── scope-change.md
│   ├── delivery-message.md
│   ├── revision-request.md
│   ├── payment-reminder.md
│   ├── deadline-extension.md
│   ├── feedback-request.md
│   └── difficult-client.md
└── scripts/
    ├── deadline_tracker.py  # Project & milestone management
    └── status_report.py     # Weekly status report generator
```

## Quick Start

### Track Projects

```bash
# Add a project
python3 scripts/deadline_tracker.py add --project "Website Redesign" --client "Acme Corp" --deadline 2026-04-15

# Add milestones
python3 scripts/deadline_tracker.py add-milestone --project "Website Redesign" --milestone "Wireframes" --deadline 2026-03-25 --amount "$600"
python3 scripts/deadline_tracker.py add-milestone --project "Website Redesign" --milestone "Design Mockups" --deadline 2026-04-01 --amount "$750"

# View status dashboard
python3 scripts/deadline_tracker.py status

# Get today's task list
python3 scripts/deadline_tracker.py daily

# Complete a milestone
python3 scripts/deadline_tracker.py complete --project "Website Redesign" --milestone "Wireframes"
```

### Generate Status Reports

```bash
# Report for one project
python3 scripts/status_report.py --project "Website Redesign"

# Report for all active projects
python3 scripts/status_report.py --all

# Save to file
python3 scripts/status_report.py --project "Website Redesign" --output report.md
```

### Data Storage

All project data is stored in `projects.json` in the current directory. You can set a custom location:

```bash
export CORTEX_PROJECTS_FILE="/path/to/my/projects.json"
```

## Dependencies

- Python 3.8+ (standard library only)
