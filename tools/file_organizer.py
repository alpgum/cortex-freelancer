#!/usr/bin/env python3
"""
Automated File Organization and Retrieval with Tagging

A comprehensive file management system for freelancers featuring:
- Auto-tagging and categorization (proposals, contracts, invoices, deliverables, communications)
- Smart folder structure generation per client/project
- Full-text search across all freelancer documents
- Tag-based retrieval with fuzzy matching
- Automatic archiving of completed project files
- Content-based classification using keyword analysis

Usage:
    python file_organizer.py init
    python file_organizer.py ingest <path> [--client <name>] [--project <name>]
    python file_organizer.py tag <file_id> <tags...>
    python file_organizer.py untag <file_id> <tags...>
    python file_organizer.py search <query> [--tag <tag>] [--category <cat>] [--client <name>]
    python file_organizer.py list [--category <cat>] [--client <name>] [--project <name>] [--tag <tag>]
    python file_organizer.py show <file_id>
    python file_organizer.py organize <path> --client <name> [--project <name>]
    python file_organizer.py archive --client <name> [--project <name>]
    python file_organizer.py stats
    python file_organizer.py export [--output files.csv]
"""

import argparse
import json
import os
import sys
import csv
import uuid
import shutil
import re
import io
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.expanduser("~"), ".cortex-freelancer", "file-org")
INDEX_FILE = os.path.join(DATA_DIR, "file_index.json")
TAGS_FILE = os.path.join(DATA_DIR, "tags.json")
ARCHIVE_DIR = os.path.join(DATA_DIR, "archive")
MANAGED_ROOT = os.path.join(DATA_DIR, "managed")

CATEGORIES = [
    "proposal", "contract", "invoice", "deliverable",
    "communication", "brief", "report", "receipt",
    "asset", "reference", "misc"
]

FILE_STATUSES = ["active", "archived", "deleted"]

# ANSI color codes
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"

# ---------------------------------------------------------------------------
# Category detection keyword patterns
# ---------------------------------------------------------------------------

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "proposal": [
        "proposal", "quotation", "quote", "estimate", "bid",
        "scope of work", "project proposal", "pricing",
        "deliverables", "timeline", "we propose", "our approach",
    ],
    "contract": [
        "contract", "agreement", "terms and conditions", "parties agree",
        "effective date", "termination", "governing law", "nda",
        "non-disclosure", "confidentiality agreement", "independent contractor",
        "statement of work", "sow", "master service agreement", "msa",
    ],
    "invoice": [
        "invoice", "bill", "payment due", "amount due", "remittance",
        "net 30", "net 15", "total due", "balance due", "inv-",
        "invoice number", "billing", "payable",
    ],
    "deliverable": [
        "deliverable", "final version", "revision", "draft",
        "v1", "v2", "v3", "final", "approved", "handoff",
        "delivery", "submission", "completed",
    ],
    "communication": [
        "meeting notes", "call notes", "email", "follow-up",
        "minutes", "discussion", "feedback", "review comments",
        "action items", "agenda", "recap",
    ],
    "brief": [
        "brief", "requirements", "specification", "spec",
        "project brief", "creative brief", "design brief",
        "user stories", "acceptance criteria",
    ],
    "report": [
        "report", "analysis", "summary", "findings", "audit",
        "progress report", "status update", "weekly report",
        "monthly report", "analytics",
    ],
    "receipt": [
        "receipt", "payment received", "transaction", "paid",
        "payment confirmation", "thank you for your payment",
    ],
}

# File extension hints for categorization
EXTENSION_HINTS: Dict[str, List[str]] = {
    "deliverable": [".psd", ".ai", ".fig", ".sketch", ".xd", ".zip", ".rar",
                    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".mp4", ".mov"],
    "asset": [".ttf", ".otf", ".woff", ".woff2", ".ico", ".eps"],
    "report": [".xlsx", ".xls", ".csv"],
}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class FileEntry:
    id: str
    original_path: str
    managed_path: str
    filename: str
    extension: str
    category: str
    tags: List[str]
    client: str
    project: str
    status: str
    size_bytes: int
    content_preview: str
    content_searchable: str
    created_at: str
    updated_at: str
    archived_at: Optional[str] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "FileEntry":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class TagInfo:
    name: str
    color: str
    file_count: int
    created_at: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TagInfo":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------

def ensure_dirs():
    """Create all required directories."""
    for d in [DATA_DIR, ARCHIVE_DIR, MANAGED_ROOT]:
        os.makedirs(d, exist_ok=True)


def load_index() -> List[Dict[str, Any]]:
    if not os.path.exists(INDEX_FILE):
        return []
    with open(INDEX_FILE, "r") as f:
        return json.load(f)


def save_index(entries: List[Dict[str, Any]]):
    ensure_dirs()
    with open(INDEX_FILE, "w") as f:
        json.dump(entries, f, indent=2)


def load_tags() -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(TAGS_FILE):
        return {}
    with open(TAGS_FILE, "r") as f:
        return json.load(f)


def save_tags(tags: Dict[str, Dict[str, Any]]):
    ensure_dirs()
    with open(TAGS_FILE, "w") as f:
        json.dump(tags, f, indent=2)


# ---------------------------------------------------------------------------
# Content analysis
# ---------------------------------------------------------------------------

READABLE_EXTENSIONS = {
    ".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm",
    ".py", ".js", ".ts", ".css", ".scss", ".yaml", ".yml",
    ".rst", ".log", ".ini", ".cfg", ".conf", ".toml",
    ".tex", ".rtf", ".org",
}


def extract_text_content(filepath: str, max_chars: int = 50000) -> str:
    """Extract searchable text content from a file."""
    ext = Path(filepath).suffix.lower()
    if ext not in READABLE_EXTENSIONS:
        return ""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read(max_chars)
    except (OSError, UnicodeDecodeError):
        return ""


def classify_category(filename: str, content: str) -> str:
    """Auto-detect file category based on filename and content analysis."""
    fn_lower = filename.lower()
    content_lower = content.lower() if content else ""
    ext = Path(filename).suffix.lower()

    # Check extension hints first
    for cat, exts in EXTENSION_HINTS.items():
        if ext in exts:
            return cat

    # Score each category by keyword matches
    scores: Dict[str, float] = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = 0.0
        for kw in keywords:
            if kw in fn_lower:
                score += 3.0  # filename match is stronger signal
            if kw in content_lower:
                score += 1.0
        if score > 0:
            scores[cat] = score

    if scores:
        return max(scores, key=scores.get)
    return "misc"


def auto_generate_tags(filename: str, content: str, category: str) -> List[str]:
    """Generate tags based on content analysis."""
    tags = [category]
    fn_lower = filename.lower()
    content_lower = content.lower() if content else ""

    # Format tags
    ext = Path(filename).suffix.lower()
    format_map = {
        ".pdf": "pdf", ".doc": "word", ".docx": "word",
        ".xls": "spreadsheet", ".xlsx": "spreadsheet", ".csv": "spreadsheet",
        ".psd": "photoshop", ".ai": "illustrator", ".fig": "figma",
        ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
        ".svg": "vector", ".mp4": "video", ".mov": "video",
        ".zip": "archive", ".rar": "archive", ".gz": "archive",
        ".md": "markdown", ".txt": "text", ".html": "html",
    }
    if ext in format_map:
        tags.append(format_map[ext])

    # Status tags from content
    status_patterns = {
        "draft": ["draft", "wip", "work in progress"],
        "final": ["final", "approved", "signed"],
        "review": ["review", "feedback", "comments"],
        "urgent": ["urgent", "asap", "rush", "priority"],
    }
    combined = fn_lower + " " + content_lower[:2000]
    for tag, patterns in status_patterns.items():
        if any(p in combined for p in patterns):
            tags.append(tag)

    return list(set(tags))


# ---------------------------------------------------------------------------
# Fuzzy matching
# ---------------------------------------------------------------------------

def fuzzy_match(query: str, target: str, threshold: float = 0.6) -> float:
    """Simple fuzzy match score using trigram similarity."""
    if not query or not target:
        return 0.0
    q = query.lower().strip()
    t = target.lower().strip()
    if q == t:
        return 1.0
    if q in t or t in q:
        return 0.9

    def trigrams(s: str) -> Set[str]:
        s = f"  {s} "
        return {s[i:i + 3] for i in range(len(s) - 2)}

    q_tri = trigrams(q)
    t_tri = trigrams(t)
    if not q_tri or not t_tri:
        return 0.0
    intersection = len(q_tri & t_tri)
    union = len(q_tri | t_tri)
    return intersection / union if union else 0.0


def search_files(entries: List[Dict], query: str, tag: Optional[str] = None,
                 category: Optional[str] = None, client: Optional[str] = None) -> List[Tuple[Dict, float]]:
    """Full-text search with tag and category filtering. Returns (entry, score) tuples."""
    results = []
    q_lower = query.lower()
    q_words = q_lower.split()

    for entry in entries:
        if entry.get("status") == "deleted":
            continue
        if category and entry.get("category") != category:
            continue
        if client and entry.get("client", "").lower() != client.lower():
            continue
        if tag:
            entry_tags = [t.lower() for t in entry.get("tags", [])]
            if not any(fuzzy_match(tag.lower(), et) >= 0.7 for et in entry_tags):
                continue

        score = 0.0
        fn_lower = entry.get("filename", "").lower()
        content_lower = entry.get("content_searchable", "").lower()
        tags_str = " ".join(entry.get("tags", [])).lower()

        # Filename match (highest weight)
        for w in q_words:
            if w in fn_lower:
                score += 5.0
        # Tag match
        for w in q_words:
            if w in tags_str:
                score += 3.0
        # Content match
        for w in q_words:
            count = content_lower.count(w)
            if count > 0:
                score += min(count * 0.5, 5.0)
        # Fuzzy filename match
        fn_fuzzy = fuzzy_match(query, entry.get("filename", ""))
        if fn_fuzzy >= 0.6:
            score += fn_fuzzy * 3.0

        if score > 0:
            results.append((entry, score))

    results.sort(key=lambda x: x[1], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Folder structure generation
# ---------------------------------------------------------------------------

STANDARD_FOLDERS = [
    "01-briefs",
    "02-proposals",
    "03-contracts",
    "04-invoices",
    "05-deliverables",
    "06-communications",
    "07-assets",
    "08-reports",
    "09-references",
]

CATEGORY_FOLDER_MAP = {
    "brief": "01-briefs",
    "proposal": "02-proposals",
    "contract": "03-contracts",
    "invoice": "04-invoices",
    "deliverable": "05-deliverables",
    "communication": "06-communications",
    "asset": "07-assets",
    "report": "08-reports",
    "reference": "09-references",
    "receipt": "04-invoices",
    "misc": "09-references",
}


def get_client_project_dir(client: str, project: str = "") -> str:
    """Get the managed directory for a client/project."""
    safe_client = re.sub(r'[^\w\-]', '_', client.strip().lower())
    base = os.path.join(MANAGED_ROOT, safe_client)
    if project:
        safe_project = re.sub(r'[^\w\-]', '_', project.strip().lower())
        return os.path.join(base, safe_project)
    return base


def create_folder_structure(client: str, project: str = "") -> str:
    """Create a standard folder structure for a client/project."""
    base = get_client_project_dir(client, project)
    for folder in STANDARD_FOLDERS:
        os.makedirs(os.path.join(base, folder), exist_ok=True)
    return base


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def fmt_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes}B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f}KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f}MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.1f}GB"


def fmt_date(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return iso_str or "—"


def print_file_row(entry: Dict, show_score: float = 0):
    """Print a single file entry as a formatted row."""
    cat_colors = {
        "proposal": BLUE, "contract": MAGENTA, "invoice": YELLOW,
        "deliverable": GREEN, "communication": CYAN, "brief": BLUE,
        "report": MAGENTA, "receipt": YELLOW, "asset": GREEN,
        "reference": DIM, "misc": DIM,
    }
    color = cat_colors.get(entry.get("category", ""), DIM)
    status_icon = "📦" if entry.get("status") == "archived" else "📄"
    short_id = entry["id"][:8]
    tags_str = ", ".join(entry.get("tags", [])[:5])
    score_str = f" (score: {show_score:.1f})" if show_score else ""

    print(f"  {status_icon} {BOLD}{short_id}{RESET}  "
          f"{color}{entry.get('category', 'misc'):14s}{RESET}  "
          f"{entry.get('filename', ''):40s}  "
          f"{fmt_size(entry.get('size_bytes', 0)):>8s}  "
          f"{DIM}{tags_str}{RESET}{score_str}")


def print_file_detail(entry: Dict):
    """Print detailed file information."""
    print(f"\n{BOLD}File Details{RESET}")
    print(f"{'─' * 60}")
    print(f"  {'ID:':<20s} {entry['id']}")
    print(f"  {'Filename:':<20s} {entry.get('filename', '')}")
    print(f"  {'Category:':<20s} {entry.get('category', 'misc')}")
    print(f"  {'Status:':<20s} {entry.get('status', 'active')}")
    print(f"  {'Client:':<20s} {entry.get('client', '—')}")
    print(f"  {'Project:':<20s} {entry.get('project', '—')}")
    print(f"  {'Size:':<20s} {fmt_size(entry.get('size_bytes', 0))}")
    print(f"  {'Tags:':<20s} {', '.join(entry.get('tags', []))}")
    print(f"  {'Original path:':<20s} {entry.get('original_path', '—')}")
    print(f"  {'Managed path:':<20s} {entry.get('managed_path', '—')}")
    print(f"  {'Created:':<20s} {fmt_date(entry.get('created_at', ''))}")
    print(f"  {'Updated:':<20s} {fmt_date(entry.get('updated_at', ''))}")
    if entry.get("archived_at"):
        print(f"  {'Archived:':<20s} {fmt_date(entry['archived_at'])}")
    if entry.get("notes"):
        print(f"  {'Notes:':<20s} {entry['notes']}")
    preview = entry.get("content_preview", "")
    if preview:
        print(f"\n  {DIM}Preview:{RESET}")
        for line in preview[:500].split("\n")[:10]:
            print(f"    {DIM}{line}{RESET}")
    print()


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_init(_args):
    """Initialize the file organization system."""
    ensure_dirs()
    if not os.path.exists(INDEX_FILE):
        save_index([])
    if not os.path.exists(TAGS_FILE):
        save_tags({})
    print(f"{GREEN}✓ File organization system initialized at {DATA_DIR}{RESET}")
    print(f"  Index:   {INDEX_FILE}")
    print(f"  Tags:    {TAGS_FILE}")
    print(f"  Archive: {ARCHIVE_DIR}")
    print(f"  Managed: {MANAGED_ROOT}")


def cmd_ingest(args):
    """Ingest a file or directory into the managed file system."""
    target = os.path.abspath(args.path)
    if not os.path.exists(target):
        print(f"{RED}Error: Path not found: {target}{RESET}", file=sys.stderr)
        sys.exit(1)

    ensure_dirs()
    entries = load_index()
    tags_db = load_tags()
    client = args.client or "unassigned"
    project = args.project or ""

    files_to_ingest = []
    if os.path.isfile(target):
        files_to_ingest.append(target)
    elif os.path.isdir(target):
        for root, _dirs, filenames in os.walk(target):
            for fn in filenames:
                if fn.startswith("."):
                    continue
                files_to_ingest.append(os.path.join(root, fn))
    else:
        print(f"{RED}Error: Unsupported path type: {target}{RESET}", file=sys.stderr)
        sys.exit(1)

    if not files_to_ingest:
        print(f"{YELLOW}No files found to ingest.{RESET}")
        return

    # Create folder structure
    base_dir = create_folder_structure(client, project)
    ingested = 0

    for filepath in files_to_ingest:
        # Check for duplicates by original path
        if any(e["original_path"] == filepath for e in entries):
            print(f"  {DIM}Skip (already indexed): {os.path.basename(filepath)}{RESET}")
            continue

        filename = os.path.basename(filepath)
        ext = Path(filepath).suffix.lower()
        size = os.path.getsize(filepath)
        content = extract_text_content(filepath)
        category = classify_category(filename, content)
        auto_tags = auto_generate_tags(filename, content, category)

        # Determine target folder
        target_folder = CATEGORY_FOLDER_MAP.get(category, "09-references")
        dest_dir = os.path.join(base_dir, target_folder)
        os.makedirs(dest_dir, exist_ok=True)

        # Copy file to managed location (avoid overwrite)
        dest_path = os.path.join(dest_dir, filename)
        if os.path.exists(dest_path):
            stem = Path(filename).stem
            dest_path = os.path.join(dest_dir, f"{stem}_{uuid.uuid4().hex[:6]}{ext}")
        shutil.copy2(filepath, dest_path)

        now = datetime.now().isoformat()
        preview = content[:500] if content else ""
        searchable = content[:10000] if content else ""

        entry = FileEntry(
            id=uuid.uuid4().hex,
            original_path=filepath,
            managed_path=dest_path,
            filename=filename,
            extension=ext,
            category=category,
            tags=auto_tags,
            client=client,
            project=project,
            status="active",
            size_bytes=size,
            content_preview=preview,
            content_searchable=searchable,
            created_at=now,
            updated_at=now,
        )
        entries.append(entry.to_dict())

        # Update tag counts
        for t in auto_tags:
            if t not in tags_db:
                tags_db[t] = TagInfo(name=t, color="", file_count=0, created_at=now).to_dict()
            tags_db[t]["file_count"] = tags_db[t].get("file_count", 0) + 1

        ingested += 1
        print(f"  {GREEN}✓{RESET} {filename}  →  {BLUE}{category}{RESET}  [{', '.join(auto_tags)}]")

    save_index(entries)
    save_tags(tags_db)
    print(f"\n{GREEN}Ingested {ingested} file(s) into {base_dir}{RESET}")


def cmd_tag(args):
    """Add tags to a file."""
    entries = load_index()
    tags_db = load_tags()
    entry = _find_entry(entries, args.file_id)
    if not entry:
        return

    now = datetime.now().isoformat()
    new_tags = [t.lower().strip() for t in args.tags if t.lower().strip() not in entry.get("tags", [])]
    entry["tags"] = entry.get("tags", []) + new_tags
    entry["updated_at"] = now

    for t in new_tags:
        if t not in tags_db:
            tags_db[t] = TagInfo(name=t, color="", file_count=0, created_at=now).to_dict()
        tags_db[t]["file_count"] = tags_db[t].get("file_count", 0) + 1

    save_index(entries)
    save_tags(tags_db)
    print(f"{GREEN}✓ Added tags: {', '.join(new_tags)}{RESET}")
    print(f"  All tags: {', '.join(entry['tags'])}")


def cmd_untag(args):
    """Remove tags from a file."""
    entries = load_index()
    tags_db = load_tags()
    entry = _find_entry(entries, args.file_id)
    if not entry:
        return

    removed = []
    for t in args.tags:
        t_lower = t.lower().strip()
        if t_lower in entry.get("tags", []):
            entry["tags"].remove(t_lower)
            removed.append(t_lower)
            if t_lower in tags_db:
                tags_db[t_lower]["file_count"] = max(0, tags_db[t_lower].get("file_count", 1) - 1)

    entry["updated_at"] = datetime.now().isoformat()
    save_index(entries)
    save_tags(tags_db)
    print(f"{GREEN}✓ Removed tags: {', '.join(removed)}{RESET}")
    print(f"  Remaining tags: {', '.join(entry.get('tags', []))}")


def cmd_search(args):
    """Full-text search across all indexed files."""
    entries = load_index()
    results = search_files(entries, args.query, tag=args.tag,
                           category=args.category, client=args.client)

    if not results:
        print(f"{YELLOW}No results found for: {args.query}{RESET}")
        return

    print(f"\n{BOLD}Search results for \"{args.query}\"{RESET} ({len(results)} found)\n")
    for entry, score in results[:30]:
        print_file_row(entry, show_score=score)
    if len(results) > 30:
        print(f"\n  {DIM}... and {len(results) - 30} more results{RESET}")
    print()


def cmd_list(args):
    """List indexed files with optional filters."""
    entries = load_index()
    filtered = []
    for e in entries:
        if e.get("status") == "deleted":
            continue
        if args.category and e.get("category") != args.category:
            continue
        if args.client and e.get("client", "").lower() != args.client.lower():
            continue
        if args.project and e.get("project", "").lower() != args.project.lower():
            continue
        if args.tag:
            entry_tags = [t.lower() for t in e.get("tags", [])]
            if not any(fuzzy_match(args.tag.lower(), et) >= 0.7 for et in entry_tags):
                continue
        if args.status and e.get("status") != args.status:
            continue
        filtered.append(e)

    if not filtered:
        print(f"{YELLOW}No files found matching filters.{RESET}")
        return

    print(f"\n{BOLD}Files{RESET} ({len(filtered)} total)\n")
    for e in filtered:
        print_file_row(e)
    print()


def cmd_show(args):
    """Show detailed file information."""
    entries = load_index()
    entry = _find_entry(entries, args.file_id)
    if entry:
        print_file_detail(entry)


def cmd_organize(args):
    """Organize a directory by creating structure and ingesting files."""
    target = os.path.abspath(args.path)
    if not os.path.isdir(target):
        print(f"{RED}Error: Directory not found: {target}{RESET}", file=sys.stderr)
        sys.exit(1)
    if not args.client:
        print(f"{RED}Error: --client is required for organize{RESET}", file=sys.stderr)
        sys.exit(1)

    base_dir = create_folder_structure(args.client, args.project or "")
    print(f"{GREEN}✓ Created folder structure at:{RESET} {base_dir}")
    for folder in STANDARD_FOLDERS:
        print(f"  📁 {folder}")
    print()

    # Ingest all files
    args.path = target
    cmd_ingest(args)


def cmd_archive(args):
    """Archive files for a completed client/project."""
    entries = load_index()
    if not args.client:
        print(f"{RED}Error: --client is required{RESET}", file=sys.stderr)
        sys.exit(1)

    now = datetime.now().isoformat()
    archived_count = 0
    for e in entries:
        if e.get("status") != "active":
            continue
        if e.get("client", "").lower() != args.client.lower():
            continue
        if args.project and e.get("project", "").lower() != args.project.lower():
            continue

        # Move managed file to archive
        managed = e.get("managed_path", "")
        if managed and os.path.exists(managed):
            archive_dest = os.path.join(
                ARCHIVE_DIR, e.get("client", "unassigned"),
                e.get("project", "general"),
                e.get("filename", f"file_{e['id'][:8]}")
            )
            os.makedirs(os.path.dirname(archive_dest), exist_ok=True)
            if os.path.exists(archive_dest):
                stem = Path(archive_dest).stem
                ext = Path(archive_dest).suffix
                archive_dest = os.path.join(os.path.dirname(archive_dest),
                                            f"{stem}_{e['id'][:6]}{ext}")
            shutil.move(managed, archive_dest)
            e["managed_path"] = archive_dest

        e["status"] = "archived"
        e["archived_at"] = now
        e["updated_at"] = now
        archived_count += 1

    save_index(entries)
    label = f"{args.client}"
    if args.project:
        label += f"/{args.project}"
    print(f"{GREEN}✓ Archived {archived_count} file(s) for {label}{RESET}")


def cmd_stats(_args):
    """Show file organization statistics."""
    entries = load_index()
    tags_db = load_tags()
    active = [e for e in entries if e.get("status") == "active"]
    archived = [e for e in entries if e.get("status") == "archived"]

    print(f"\n{BOLD}File Organization Statistics{RESET}")
    print(f"{'─' * 50}")
    print(f"  {'Total indexed:':<25s} {len(entries)}")
    print(f"  {'Active:':<25s} {GREEN}{len(active)}{RESET}")
    print(f"  {'Archived:':<25s} {DIM}{len(archived)}{RESET}")
    total_size = sum(e.get("size_bytes", 0) for e in entries)
    print(f"  {'Total size:':<25s} {fmt_size(total_size)}")
    print(f"  {'Unique tags:':<25s} {len(tags_db)}")

    # Category breakdown
    print(f"\n{BOLD}By Category{RESET}")
    cat_counts: Dict[str, int] = {}
    for e in active:
        cat = e.get("category", "misc")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    for cat in sorted(cat_counts, key=cat_counts.get, reverse=True):
        bar = "█" * min(cat_counts[cat], 40)
        print(f"  {cat:<18s} {cat_counts[cat]:>4d}  {BLUE}{bar}{RESET}")

    # Client breakdown
    print(f"\n{BOLD}By Client{RESET}")
    client_counts: Dict[str, int] = {}
    for e in active:
        cl = e.get("client", "unassigned")
        client_counts[cl] = client_counts.get(cl, 0) + 1
    for cl in sorted(client_counts, key=client_counts.get, reverse=True)[:15]:
        print(f"  {cl:<25s} {client_counts[cl]:>4d} files")

    # Top tags
    print(f"\n{BOLD}Top Tags{RESET}")
    sorted_tags = sorted(tags_db.values(), key=lambda t: t.get("file_count", 0), reverse=True)
    for t in sorted_tags[:15]:
        print(f"  {t['name']:<25s} {t.get('file_count', 0):>4d} files")
    print()


def cmd_export(args):
    """Export file index to CSV."""
    entries = load_index()
    output = args.output or "file_index.csv"

    fieldnames = [
        "id", "filename", "category", "status", "client", "project",
        "tags", "size_bytes", "extension", "original_path", "managed_path",
        "created_at", "updated_at", "archived_at",
    ]

    buf = io.StringIO() if output == "-" else open(output, "w", newline="")
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for e in entries:
        row = dict(e)
        row["tags"] = "; ".join(row.get("tags", []))
        writer.writerow(row)

    if output == "-":
        print(buf.getvalue())
    else:
        buf.close()
        print(f"{GREEN}✓ Exported {len(entries)} entries to {output}{RESET}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_entry(entries: List[Dict], file_id: str) -> Optional[Dict]:
    """Find an entry by ID or ID prefix."""
    for e in entries:
        if e["id"] == file_id or e["id"].startswith(file_id):
            return e
    print(f"{RED}Error: File not found with ID: {file_id}{RESET}", file=sys.stderr)
    return None


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="file_organizer",
        description="Automated file organization and retrieval for freelancers"
    )
    sub = parser.add_subparsers(dest="command")

    # init
    sub.add_parser("init", help="Initialize the file organization system")

    # ingest
    p = sub.add_parser("ingest", help="Ingest a file or directory")
    p.add_argument("path", help="File or directory to ingest")
    p.add_argument("--client", default="", help="Client name")
    p.add_argument("--project", default="", help="Project name")

    # tag
    p = sub.add_parser("tag", help="Add tags to a file")
    p.add_argument("file_id", help="File ID or prefix")
    p.add_argument("tags", nargs="+", help="Tags to add")

    # untag
    p = sub.add_parser("untag", help="Remove tags from a file")
    p.add_argument("file_id", help="File ID or prefix")
    p.add_argument("tags", nargs="+", help="Tags to remove")

    # search
    p = sub.add_parser("search", help="Full-text search across files")
    p.add_argument("query", help="Search query")
    p.add_argument("--tag", help="Filter by tag")
    p.add_argument("--category", choices=CATEGORIES, help="Filter by category")
    p.add_argument("--client", help="Filter by client")

    # list
    p = sub.add_parser("list", help="List indexed files")
    p.add_argument("--category", choices=CATEGORIES, help="Filter by category")
    p.add_argument("--client", help="Filter by client")
    p.add_argument("--project", help="Filter by project")
    p.add_argument("--tag", help="Filter by tag (fuzzy)")
    p.add_argument("--status", choices=FILE_STATUSES, help="Filter by status")

    # show
    p = sub.add_parser("show", help="Show file details")
    p.add_argument("file_id", help="File ID or prefix")

    # organize
    p = sub.add_parser("organize", help="Organize a directory with smart structure")
    p.add_argument("path", help="Directory to organize")
    p.add_argument("--client", required=True, help="Client name")
    p.add_argument("--project", default="", help="Project name")

    # archive
    p = sub.add_parser("archive", help="Archive completed project files")
    p.add_argument("--client", required=True, help="Client name")
    p.add_argument("--project", default="", help="Project name")

    # stats
    sub.add_parser("stats", help="Show organization statistics")

    # export
    p = sub.add_parser("export", help="Export index to CSV")
    p.add_argument("--output", default="file_index.csv", help="Output file")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "init": cmd_init,
        "ingest": cmd_ingest,
        "tag": cmd_tag,
        "untag": cmd_untag,
        "search": cmd_search,
        "list": cmd_list,
        "show": cmd_show,
        "organize": cmd_organize,
        "archive": cmd_archive,
        "stats": cmd_stats,
        "export": cmd_export,
    }

    cmd_fn = commands.get(args.command)
    if cmd_fn:
        cmd_fn(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
