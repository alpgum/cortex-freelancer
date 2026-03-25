# Document Version Control — Skill Library

> Version tracking, change management, and document lifecycle control for freelancer deliverables.

---

## Document Lifecycle Stages

Freelancer documents follow a predictable lifecycle. Each stage has specific rules and allowed transitions:

| Stage | Meaning | Allowed Transitions | When to Use |
|---|---|---|---|
| **draft** | Work in progress, not shared | submitted, archived | Initial creation, iterating privately |
| **submitted** | Sent to client/stakeholder | revised, final, archived | Proposal sent, contract delivered |
| **revised** | Changes incorporated | submitted, final, archived | After client feedback round |
| **final** | Approved, locked down | archived | Signed contract, accepted proposal |
| **archived** | No longer active | draft (re-activate) | Project complete, doc superseded |

### Stage Transition Best Practices

1. **Never skip stages** — draft → final bypasses review, increasing risk
2. **Record reasons** — every transition should have a message explaining why
3. **Revised can loop** — revised → submitted → revised is normal for negotiation rounds
4. **Final means final** — only archive from final, never edit

## Version Numbering

Versions are sequential integers (v1, v2, v3...) with semantic meaning derived from stage:

| Version Pattern | Semantic Meaning |
|---|---|
| v1 (draft) | Initial creation |
| v2 (draft) | Internal revision |
| v3 (submitted) | First client submission |
| v4 (revised) | Post-feedback changes |
| v5 (submitted) | Re-submission |
| v6 (final) | Approved version |

## Change Request Workflow

Track who requested changes, why, and how they were resolved:

1. **Client requests change** → create change request with requester + description
2. **Freelancer evaluates** → assess impact, mark priority
3. **Implement changes** → commit new version, link to change request
4. **Resolve** → mark change request as resolved, link to version

### Priority Levels

| Priority | Response Time | Impact |
|---|---|---|
| **low** | Next revision cycle | Minor wording, formatting |
| **normal** | Within 48 hours | Scope adjustments, pricing |
| **high** | Same day | Blocking issues, legal concerns |

## Diff Analysis

When comparing versions, focus on:
- **Pricing changes** — any number changes in cost/rate sections
- **Scope modifications** — added/removed deliverables or milestones
- **Timeline shifts** — date or duration changes
- **Legal terms** — liability, IP, termination clause changes

## Integration Points

| Tool | Integration |
|---|---|
| **Proposal Generator** | Auto-init tracking when proposal is created |
| **Contract Templates** | Version control generated contracts with stage management |
| **Scope Creep Detection** | Link scope changes to change requests for audit trail |
| **Client CRM** | Filter documents by client, track revision patterns |
| **Payment Chase** | Reference final contract version in payment disputes |

## Document Type Guidelines

| Type | Typical Versions | Key Tracking Points |
|---|---|---|
| **proposal** | 2-5 | Pricing, scope, timeline per version |
| **contract** | 3-8 | Legal terms, payment terms, IP clauses |
| **deliverable** | 2-4 | Acceptance criteria, completion status |
| **sow** | 2-6 | Scope boundaries, exclusions |
| **invoice** | 1-2 | Amounts, line items, due dates |
| **nda** | 1-3 | Confidentiality scope, duration |
