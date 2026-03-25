# Project Lifecycle Automation (CFX-071)

End-to-end project lifecycle orchestration for Cortex Freelancer.

Lifecycle stages:
**Lead/Opportunity → Qualification → Proposal → Contract/SOW → Kickoff → Delivery (milestones) → Invoicing → Payment follow-ups → Closeout → Referral/Testimonial**

This module provides:
- A workflow/state-machine definition format (plain JS objects)
- An engine that persists per-project state (local JSON)
- Integration hooks for Sprint-2 tools (via adapter interface; safe offline stubs by default)
- A CLI: `cortex lifecycle ...`

## Install/Run

No extra dependencies.

- Run CLI via the root `cortex` binary:

```bash
node scripts/cortex-cli.js lifecycle --help
# or if installed as bin:
# cortex lifecycle --help
```

- Run tests (Node 18+ / 20+):

```bash
node --test src/tools/project-lifecycle/__tests__/*.test.js
```

## Commands

### `cortex lifecycle init`
Create a new lifecycle for a project.

```bash
cortex lifecycle init \
  --project "Acme Website" \
  --client "Acme" \
  --job "Build marketing site + CMS" \
  --value 5000 \
  --currency USD
```

### `cortex lifecycle status`
Show current stage, blockers, and next-best actions.

```bash
cortex lifecycle status --project "Acme Website"
```

### `cortex lifecycle advance`
Advance stage or mark tasks complete.

```bash
# Mark a task done
cortex lifecycle advance --project "Acme Website" --complete "collect_requirements"

# Force stage advance (use carefully)
cortex lifecycle advance --project "Acme Website" --to proposal
```

### `cortex lifecycle automations`
Run scheduled automations (follow-ups, overdue milestones, overdue invoices).

```bash
cortex lifecycle automations --project "Acme Website"
# or run for all projects
cortex lifecycle automations --all
```

## Persistence

State is stored in:

- `data/project-lifecycles/<projectId>.json`

You can safely version-control these files or keep them local.

## Integrations

Integrations are implemented as an **adapter** (`src/tools/project-lifecycle/src/adapter.js`).

By default, the adapter is **offline-safe** and simulates tool outputs.

To wire in real Sprint-2 tools, update `makeDefaultAdapter()` to call existing module CLIs or library functions.
