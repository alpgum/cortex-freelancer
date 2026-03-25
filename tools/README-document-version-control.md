# Document Version Control — Tool Guide

> Track revisions, diffs, and change requests for proposals, contracts, and deliverables.

## Quick Start

```bash
# Initialize a tracked document
python tools/document_version_control.py init "Q1 Proposal" --type proposal --client "Acme Corp" --content proposal.md

# Commit a new version
python tools/document_version_control.py commit <doc_id> --content updated_proposal.md -m "Added pricing section"

# View version history
python tools/document_version_control.py log <doc_id>

# Diff between versions
python tools/document_version_control.py diff <doc_id> 1 2

# Transition stage (draft → submitted → revised → final → archived)
python tools/document_version_control.py stage <doc_id> submitted -m "Sent to client"

# Rollback to previous version
python tools/document_version_control.py rollback <doc_id> 1
```

## Change Request Tracking

```bash
# Record client change request
python tools/document_version_control.py request-change <doc_id> \
  --requester "Jane (Acme)" \
  --description "Reduce scope to 3 milestones" \
  --priority high

# View pending changes
python tools/document_version_control.py changes <doc_id> --status pending

# Resolve after addressing
python tools/document_version_control.py resolve <doc_id> CR-abc123 --version 3
```

## Commands

| Command | Description |
|---|---|
| `init` | Initialize a new tracked document |
| `commit` | Commit a new version with content |
| `log` | Show version history |
| `show` | Show content at a version (or `--meta-only`) |
| `diff` | Unified diff between two versions |
| `rollback` | Rollback to a previous version (creates new version) |
| `stage` | Transition document lifecycle stage |
| `request-change` | Record a change request with requester info |
| `changes` | List change requests for a document |
| `resolve` | Mark a change request as resolved |
| `list` | List all tracked documents with filters |
| `export` | Export document content to a file |
| `stats` | Global or per-document statistics |
| `delete` | Remove a document and all versions |

## Document Types

`proposal`, `contract`, `deliverable`, `invoice`, `sow`, `nda`, `brief`, `report`, `other`

## Stage Lifecycle

```
draft → submitted → revised → final → archived
                  ↘          ↗
                   (revised can loop back to submitted)
```

- **draft**: Work in progress
- **submitted**: Sent to client/stakeholder
- **revised**: Changes incorporated after feedback
- **final**: Approved and locked
- **archived**: No longer active

## Data Storage

All data stored in `~/.cortex-freelancer/vcs/`:
- `documents.json` — Document index
- `change_requests.json` — Change request log
- `versions/<doc_id>/v1.json` — Per-version content snapshots

## Integration

Works with existing Cortex Freelancer tools:
- **Proposal Generator**: Track proposal revisions from draft to final
- **Contract Templates**: Version control generated contracts
- **Scope Creep Detection**: Link change requests to scope changes
- **Client CRM**: Filter documents by client
