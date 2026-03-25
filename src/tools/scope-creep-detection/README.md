# Scope Creep Detection + Prevention (CFX-075)

Deterministic scope creep detection and prevention playbooks for Cortex Freelancer.

This module ingests **existing Cortex data** (time tracking, proposal/contract workflows, and communications) and outputs:

- **Risk score (0–100)** + severity tier (low/medium/high)
- **Top drivers** (explainable)
- **Recommended actions** + client-ready language/templates
- **Suggested automation hooks** (e.g. “send_email”, “update_crm”) to plug into existing workflow engines

No external APIs and no LLM calls.

## Inputs (supported)

### 1) Time tracking logs (planned vs actual)
- Reads: `data/time_tracking/time_entries.json` (from `tools/time_tracker.py`)
- Signals:
  - time overruns (actual vs estimated)
  - meeting overhead
  - unpaid/non-billable work

### 2) Proposal/Contract scope baselines
- Reads: `~/.cortex-freelancer/p2d/workflows.json` (Proposal-to-Delivery tool store)
- Uses:
  - `workflow.contract.terms.scope`
  - `workflow.contract.terms.deliverables[]`
  - `workflow.contract.terms.revisionRounds`
  - `workflow.timeline.estimatedEndDate`, `estimatedTotalHours`
  - `workflow.milestones[]`

### 3) Client comms/events
- Reads: `~/.cortex-freelancer/communications/messages.json` and `responses.json`
- Uses keyword heuristics to detect:
  - change requests / expanding requirements
  - deadline pressure / timeline compression
  - repeated revision patterns

### 4) Milestone changes (optional event log)
If you have explicit milestone-change events, you can add:
- `~/.cortex-freelancer/scope-creep/milestone-events.json`

Format:
```json
[
  {
    "workflowId": "...",
    "projectName": "Website Redesign",
    "type": "deliverable_added",
    "timestamp": "2026-03-25T10:00:00.000Z",
    "details": { "deliverable": "New landing page" }
  }
]
```

## Output

`analyzeScopeCreep()` returns an object like:

```json
{
  "riskScore": 78,
  "severity": "high",
  "drivers": [
    { "id": "time_overrun", "score": 92, "contribution": 23.0, "summary": "Actual hours are 1.8× planned" }
  ],
  "recommendedActions": {
    "tier": "high",
    "steps": ["Pause out-of-scope work", "Propose a change order"],
    "templates": { "changeOrderEmail": "..." }
  }
}
```

## CLI

This tool is designed to be routed via the main `cortex` CLI.

### Analyze all workflows
```bash
node cli.js analyze --format json
```

### Analyze a specific workflow
```bash
node cli.js analyze --workflow <workflowId> --format text
```

### Analyze by project name match
```bash
node cli.js analyze --project "Website Redesign" --format json
```

## Development

```bash
cd src/tools/scope-creep-detection
npm install
npm test
```

## Architecture

- `loaders.js` — file loaders for time tracking / p2d workflows / comms / milestone events
- `signals/*` — composable signal extractors (meetings, revisions, deliverables, etc.)
- `scoring.js` — weighted, explainable scoring engine
- `recommendations.js` — playbooks + client language templates by severity
- `engine.js` — orchestrates analysis
- `cli.js` — CLI entry point
