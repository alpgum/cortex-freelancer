# File Organizer — Automated File Organization & Retrieval

Automated file management for freelancers with content-based tagging, smart folder structures, full-text search, and project archiving.

## Quick Start

```bash
# Initialize the system
python tools/file_organizer.py init

# Ingest files for a client/project
python tools/file_organizer.py ingest ~/Documents/acme/ --client "Acme Corp" --project "Website Redesign"

# Search across all files
python tools/file_organizer.py search "proposal timeline"

# List files by category
python tools/file_organizer.py list --category invoice --client "Acme Corp"

# Archive completed project
python tools/file_organizer.py archive --client "Acme Corp" --project "Website Redesign"
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize file organization system |
| `ingest <path>` | Ingest file or directory with auto-tagging |
| `tag <id> <tags...>` | Add tags to a file |
| `untag <id> <tags...>` | Remove tags from a file |
| `search <query>` | Full-text search with fuzzy matching |
| `list` | List files with filters |
| `show <id>` | Show detailed file info |
| `organize <path>` | Create smart folder structure and ingest |
| `archive` | Archive completed project files |
| `stats` | Show organization statistics |
| `export` | Export index to CSV |

## Auto-Classification Categories

Files are automatically categorized based on filename and content analysis:

- **proposal** — Proposals, quotes, estimates, bids
- **contract** — Agreements, NDAs, SOWs, MSAs
- **invoice** — Invoices, bills, payment requests
- **deliverable** — Final files, revisions, design assets
- **communication** — Meeting notes, emails, call notes
- **brief** — Project briefs, specs, requirements
- **report** — Reports, analyses, status updates
- **receipt** — Payment confirmations
- **asset** — Fonts, icons, design resources
- **reference** — Reference materials
- **misc** — Uncategorized files

## Smart Folder Structure

When organizing files, the system creates:

```
~/.cortex-freelancer/file-org/managed/
└── acme_corp/
    └── website_redesign/
        ├── 01-briefs/
        ├── 02-proposals/
        ├── 03-contracts/
        ├── 04-invoices/
        ├── 05-deliverables/
        ├── 06-communications/
        ├── 07-assets/
        ├── 08-reports/
        └── 09-references/
```

## Tag System

- Auto-generated tags based on content analysis (category, format, status)
- Manual tagging with `tag`/`untag` commands
- Fuzzy tag matching in search (finds "invoce" when searching "invoice")
- Tag statistics tracked globally

## Data Storage

All data stored in `~/.cortex-freelancer/file-org/`:
- `file_index.json` — Master file index
- `tags.json` — Tag registry
- `managed/` — Organized file copies
- `archive/` — Archived project files
