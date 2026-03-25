# Upsell Opportunities (CFX-078)

Detects upsell opportunities from existing clients/projects and recommends the **right next offer** with **optimal timing**.

## What it does

- **UpsellOpportunityScorer**: deterministic score **0–100** with explainable drivers.
- **OfferGenerator**: proposes **3–5** tailored offers (retainer, maintenance, optimization, add-on, training, analytics).
- **TimingOptimizer**: picks the best window (post-milestone, post-payment, pre-renewal, planning window) + channel/tone.
- **Persistence**: stores opportunities + outcomes locally in `~/.cortex-freelancer/upsell/`.

## CLI

Run via the root `cortex` binary:

```bash
# Scan all clients and persist opportunities
node scripts/cortex-cli.js upsell scan

# Filter to only high-scoring
node scripts/cortex-cli.js upsell scan --min-score 70

# Get a recommendation for a specific client
node scripts/cortex-cli.js upsell recommend --client client-123
node scripts/cortex-cli.js upsell recommend --client "Acme"

# Log outcome to help local learning
node scripts/cortex-cli.js upsell log-outcome \
  --client "Acme" \
  --opportunity <oppId> \
  --result won \
  --notes "Chose maintenance retainer"
```

## Data inputs (offline-safe)

This module reads local JSON (when present):

- Clients (CRM): `~/.cortex-freelancer/crm/clients.json` (fallback: `data/crm/clients.json`)
- Time tracking: `data/time_tracking/time_entries.json`
- Milestones: `~/.cortex-freelancer/milestones/milestones.json`
- Payments: `~/.cortex-freelancer/payments/invoices.json`
- Competitive insights: `~/.cortex-freelancer/competitive/insights.json`
- Skill gaps: `~/.cortex-freelancer/skill-gap/gaps.json`

You can start with minimal client objects, e.g.

```json
[
  {
    "id": "client-1",
    "name": "Acme",
    "relationshipScore": 82,
    "satisfactionFlags": ["happy", "praised"],
    "budgetTier": "mid",
    "weeklyCapacityHours": 35,
    "weeklyAllocatedHours": 22,
    "scopeCreepRisk": 20,
    "activeProject": { "projectName": "Website Redesign", "type": "web" }
  }
]
```

## Files

- `scorer.js` — UpsellOpportunityScorer
- `offer-generator.js` — OfferGenerator
- `timing-optimizer.js` — TimingOptimizer
- `engine.js` — scan + aggregation
- `storage.js` — JSON persistence
- `cli.js` — `scan`, `recommend`, `log-outcome`

## Tests

```bash
cd src/tools/upsell-opportunities
npm install
npm test
```
