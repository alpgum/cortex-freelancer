#!/usr/bin/env python3
"""
Document Version Control with Change Tracking

A version control system for freelancer documents (proposals, contracts, deliverables)
featuring:
- Full revision history with timestamps and metadata
- Diff view between any two document versions
- Semantic version stages (draft → submitted → revised → final → archived)
- Change request tracking with requester info and rationale
- Rollback to any previous version
- Integration with proposal generator and contract template tools

Usage:
    python document_version_control.py init <name> --type proposal [--content file.md]
    python document_version_control.py commit <doc_id> --content file.md [--message "msg"] [--stage draft]
    python document_version_control.py log <doc_id> [--limit 10]
    python document_version_control.py show <doc_id> [--version 3]
    python document_version_control.py diff <doc_id> <v1> <v2>
    python document_version_control.py rollback <doc_id> <version>
    python document_version_control.py stage <doc_id> <stage> [--message "reason"]
    python document_version_control.py request-change <doc_id> --requester "Client" --description "Changes needed"
    python document_version_control.py changes <doc_id> [--status pending]
    python document_version_control.py resolve <doc_id> <change_id> [--version <v>]
    python document_version_control.py list [--type proposal] [--stage draft]
    python document_version_control.py export <doc_id> [--version latest] [--output file.md]
    python document_version_control.py stats [--doc <doc_id>]
    python document_version_control.py delete <doc_id> [--force]
"""

import argparse
import json
import os
import sys
import uuid
import hashlib
import difflib
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.expanduser("~"), ".cortex-freelancer", "vcs")
DOCS_INDEX_FILE = os.path.join(DATA_DIR, "documents.json")
VERSIONS_DIR = os.path.join(DATA_DIR, "versions")
CHANGES_FILE = os.path.join(DATA_DIR, "change_requests.json")

DOC_TYPES = ["proposal", "contract", "deliverable", "invoice", "sow", "nda", "brief", "report", "other"]

STAGE_ORDER = ["draft", "submitted", "revised", "final", "archived"]
STAGE_TRANSITIONS = {
    "draft": ["submitted", "archived"],
    "submitted": ["revised", "final", "archived"],
    "revised": ["submitted", "final", "archived"],
    "final": ["archived"],
    "archived": ["draft"],
}

CHANGE_STATUSES = ["pending", "accepted", "rejected", "resolved"]

# ANSI color codes
BOLD = "\033[1m"
DIM = "\033[2m"
UNDERLINE = "\033[4m"
RESET = "\033[0m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
WHITE = "\033[97m"


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class DocumentVersion:
    version: int
    content: str
    content_hash: str
    message: str
    stage: str
    timestamp: str
    size_bytes: int
    lines: int
    change_request_id: Optional[str] = None


@dataclass
class Document:
    id: str
    name: str
    doc_type: str
    created_at: str
    updated_at: str
    current_version: int
    current_stage: str
    tags: List[str] = field(default_factory=list)
    client: str = ""
    project: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ChangeRequest:
    id: str
    doc_id: str
    requester: str
    description: str
    status: str
    created_at: str
    resolved_at: Optional[str] = None
    resolved_version: Optional[int] = None
    priority: str = "normal"
    notes: str = ""


# ---------------------------------------------------------------------------
# Storage Layer
# ---------------------------------------------------------------------------

class VCSStore:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.docs_file = os.path.join(data_dir, "documents.json")
        self.changes_file = os.path.join(data_dir, "change_requests.json")
        self.versions_dir = os.path.join(data_dir, "versions")
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.versions_dir, exist_ok=True)
        if not os.path.exists(self.docs_file):
            self._write_json(self.docs_file, [])
        if not os.path.exists(self.changes_file):
            self._write_json(self.changes_file, [])

    def _read_json(self, path: str) -> Any:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_json(self, path: str, data: Any):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # -- Documents ----------------------------------------------------------

    def load_documents(self) -> List[Document]:
        raw = self._read_json(self.docs_file)
        docs = []
        for r in raw:
            docs.append(Document(**{k: v for k, v in r.items() if k in Document.__dataclass_fields__}))
        return docs

    def save_documents(self, docs: List[Document]):
        self._write_json(self.docs_file, [asdict(d) for d in docs])

    def get_document(self, doc_id: str) -> Optional[Document]:
        for d in self.load_documents():
            if d.id == doc_id or d.name.lower() == doc_id.lower():
                return d
        # partial match
        for d in self.load_documents():
            if d.id.startswith(doc_id):
                return d
        return None

    def add_document(self, doc: Document):
        docs = self.load_documents()
        docs.append(doc)
        self.save_documents(docs)

    def update_document(self, doc: Document):
        docs = self.load_documents()
        for i, d in enumerate(docs):
            if d.id == doc.id:
                docs[i] = doc
                break
        self.save_documents(docs)

    def delete_document(self, doc_id: str):
        docs = self.load_documents()
        docs = [d for d in docs if d.id != doc_id]
        self.save_documents(docs)
        # Remove version files
        doc_versions_dir = os.path.join(self.versions_dir, doc_id)
        if os.path.exists(doc_versions_dir):
            import shutil
            shutil.rmtree(doc_versions_dir)

    # -- Versions -----------------------------------------------------------

    def _doc_versions_dir(self, doc_id: str) -> str:
        d = os.path.join(self.versions_dir, doc_id)
        os.makedirs(d, exist_ok=True)
        return d

    def save_version(self, doc_id: str, version: DocumentVersion):
        vdir = self._doc_versions_dir(doc_id)
        path = os.path.join(vdir, f"v{version.version}.json")
        self._write_json(path, asdict(version))

    def load_version(self, doc_id: str, version_num: int) -> Optional[DocumentVersion]:
        path = os.path.join(self._doc_versions_dir(doc_id), f"v{version_num}.json")
        if not os.path.exists(path):
            return None
        raw = self._read_json(path)
        return DocumentVersion(**raw)

    def load_all_versions(self, doc_id: str) -> List[DocumentVersion]:
        vdir = self._doc_versions_dir(doc_id)
        versions = []
        if not os.path.exists(vdir):
            return versions
        for fname in sorted(os.listdir(vdir)):
            if fname.startswith("v") and fname.endswith(".json"):
                raw = self._read_json(os.path.join(vdir, fname))
                versions.append(DocumentVersion(**raw))
        versions.sort(key=lambda v: v.version)
        return versions

    # -- Change Requests ----------------------------------------------------

    def load_changes(self) -> List[ChangeRequest]:
        raw = self._read_json(self.changes_file)
        return [ChangeRequest(**{k: v for k, v in r.items() if k in ChangeRequest.__dataclass_fields__}) for r in raw]

    def save_changes(self, changes: List[ChangeRequest]):
        self._write_json(self.changes_file, [asdict(c) for c in changes])

    def get_changes_for_doc(self, doc_id: str, status: Optional[str] = None) -> List[ChangeRequest]:
        changes = self.load_changes()
        filtered = [c for c in changes if c.doc_id == doc_id]
        if status:
            filtered = [c for c in filtered if c.status == status]
        return filtered

    def add_change(self, change: ChangeRequest):
        changes = self.load_changes()
        changes.append(change)
        self.save_changes(changes)

    def update_change(self, change: ChangeRequest):
        changes = self.load_changes()
        for i, c in enumerate(changes):
            if c.id == change.id:
                changes[i] = change
                break
        self.save_changes(changes)


# ---------------------------------------------------------------------------
# Core Operations
# ---------------------------------------------------------------------------

def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def generate_id() -> str:
    return uuid.uuid4().hex[:8]


def read_content(source: str) -> str:
    """Read content from a file path or treat as inline text."""
    if os.path.exists(source):
        with open(source, "r", encoding="utf-8") as f:
            return f.read()
    return source


def cmd_init(args, store: VCSStore):
    """Initialize a new tracked document."""
    doc_type = args.type if args.type in DOC_TYPES else "other"
    doc_id = generate_id()
    ts = now_iso()

    content = ""
    if args.content:
        content = read_content(args.content)

    doc = Document(
        id=doc_id,
        name=args.name,
        doc_type=doc_type,
        created_at=ts,
        updated_at=ts,
        current_version=1 if content else 0,
        current_stage="draft",
        tags=args.tags.split(",") if args.tags else [],
        client=args.client or "",
        project=args.project or "",
    )
    store.add_document(doc)

    if content:
        v = DocumentVersion(
            version=1,
            content=content,
            content_hash=content_hash(content),
            message=args.message or "Initial version",
            stage="draft",
            timestamp=ts,
            size_bytes=len(content.encode("utf-8")),
            lines=content.count("\n") + 1,
        )
        store.save_version(doc_id, v)

    print(f"{GREEN}✓ Document initialized{RESET}")
    print(f"  ID:      {CYAN}{doc_id}{RESET}")
    print(f"  Name:    {doc.name}")
    print(f"  Type:    {doc.doc_type}")
    print(f"  Stage:   {doc.current_stage}")
    if content:
        print(f"  Version: v1 ({len(content)} chars)")
    else:
        print(f"  {DIM}(no initial content — use 'commit' to add){RESET}")


def cmd_commit(args, store: VCSStore):
    """Commit a new version of a document."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    content = read_content(args.content)
    new_hash = content_hash(content)

    # Check for duplicate content
    if doc.current_version > 0:
        current = store.load_version(doc.id, doc.current_version)
        if current and current.content_hash == new_hash:
            print(f"{YELLOW}⚠ No changes detected (content identical to v{doc.current_version}){RESET}")
            return

    new_version = doc.current_version + 1
    stage = args.stage if args.stage else doc.current_stage

    v = DocumentVersion(
        version=new_version,
        content=content,
        content_hash=new_hash,
        message=args.message or f"Version {new_version}",
        stage=stage,
        timestamp=now_iso(),
        size_bytes=len(content.encode("utf-8")),
        lines=content.count("\n") + 1,
        change_request_id=args.change_request or None,
    )
    store.save_version(doc.id, v)

    doc.current_version = new_version
    doc.current_stage = stage
    doc.updated_at = now_iso()
    store.update_document(doc)

    # Show diff summary
    if new_version > 1:
        prev = store.load_version(doc.id, new_version - 1)
        if prev:
            added, removed = _count_diff(prev.content, content)
            print(f"  Changes: {GREEN}+{added}{RESET} / {RED}-{removed}{RESET} lines")

    print(f"{GREEN}✓ Committed v{new_version}{RESET} to {CYAN}{doc.name}{RESET}")
    print(f"  Stage:   {stage}")
    print(f"  Hash:    {new_hash}")
    print(f"  Size:    {v.size_bytes} bytes, {v.lines} lines")
    if v.change_request_id:
        print(f"  Change:  {v.change_request_id}")


def cmd_log(args, store: VCSStore):
    """Show version history for a document."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    versions = store.load_all_versions(doc.id)
    if not versions:
        print(f"{DIM}No versions recorded.{RESET}")
        return

    limit = args.limit if args.limit else len(versions)
    versions = versions[-limit:]

    print(f"{BOLD}{doc.name}{RESET} ({doc.doc_type}) — {len(versions)} version(s)\n")

    for v in reversed(versions):
        current_marker = f" {YELLOW}← current{RESET}" if v.version == doc.current_version else ""
        stage_color = _stage_color(v.stage)
        print(f"  {BOLD}v{v.version}{RESET}{current_marker}")
        print(f"    {DIM}{v.timestamp}{RESET}  {stage_color}{v.stage}{RESET}")
        print(f"    {v.message}")
        print(f"    {DIM}{v.content_hash}  {v.size_bytes}B  {v.lines}L{RESET}")
        if v.change_request_id:
            print(f"    {MAGENTA}change: {v.change_request_id}{RESET}")
        print()


def cmd_show(args, store: VCSStore):
    """Show document content at a specific version."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    version_num = args.version if args.version else doc.current_version
    v = store.load_version(doc.id, version_num)
    if not v:
        print(f"{RED}✗ Version {version_num} not found{RESET}")
        sys.exit(1)

    if args.meta_only:
        print(f"{BOLD}{doc.name}{RESET} v{v.version}")
        print(f"  Type:      {doc.doc_type}")
        print(f"  Stage:     {_stage_color(v.stage)}{v.stage}{RESET}")
        print(f"  Timestamp: {v.timestamp}")
        print(f"  Hash:      {v.content_hash}")
        print(f"  Size:      {v.size_bytes} bytes, {v.lines} lines")
        print(f"  Message:   {v.message}")
        if doc.client:
            print(f"  Client:    {doc.client}")
        if doc.project:
            print(f"  Project:   {doc.project}")
        if doc.tags:
            print(f"  Tags:      {', '.join(doc.tags)}")
        return

    print(f"{DIM}--- {doc.name} v{v.version} ({v.stage}) ---{RESET}\n")
    print(v.content)


def cmd_diff(args, store: VCSStore):
    """Show diff between two versions."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    v1 = store.load_version(doc.id, args.v1)
    v2 = store.load_version(doc.id, args.v2)

    if not v1:
        print(f"{RED}✗ Version {args.v1} not found{RESET}")
        sys.exit(1)
    if not v2:
        print(f"{RED}✗ Version {args.v2} not found{RESET}")
        sys.exit(1)

    if v1.content_hash == v2.content_hash:
        print(f"{YELLOW}Versions v{args.v1} and v{args.v2} are identical.{RESET}")
        return

    print(f"{BOLD}Diff: {doc.name}{RESET}")
    print(f"  {RED}--- v{args.v1}{RESET} ({v1.stage}, {v1.timestamp})")
    print(f"  {GREEN}+++ v{args.v2}{RESET} ({v2.stage}, {v2.timestamp})")
    print()

    lines1 = v1.content.splitlines(keepends=True)
    lines2 = v2.content.splitlines(keepends=True)

    diff = difflib.unified_diff(
        lines1, lines2,
        fromfile=f"v{args.v1}",
        tofile=f"v{args.v2}",
        lineterm=""
    )

    for line in diff:
        line = line.rstrip("\n")
        if line.startswith("+++") or line.startswith("---"):
            continue  # already printed header
        elif line.startswith("@@"):
            print(f"{CYAN}{line}{RESET}")
        elif line.startswith("+"):
            print(f"{GREEN}{line}{RESET}")
        elif line.startswith("-"):
            print(f"{RED}{line}{RESET}")
        else:
            print(f" {line}")

    added, removed = _count_diff(v1.content, v2.content)
    print(f"\n{DIM}Summary: {GREEN}+{added}{RESET} {RED}-{removed}{RESET} {DIM}lines{RESET}")


def cmd_rollback(args, store: VCSStore):
    """Rollback document to a previous version."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    target = store.load_version(doc.id, args.version)
    if not target:
        print(f"{RED}✗ Version {args.version} not found{RESET}")
        sys.exit(1)

    if args.version == doc.current_version:
        print(f"{YELLOW}Already at v{args.version}.{RESET}")
        return

    # Create a new version with the old content
    new_version = doc.current_version + 1
    v = DocumentVersion(
        version=new_version,
        content=target.content,
        content_hash=target.content_hash,
        message=f"Rollback to v{args.version}: {target.message}",
        stage=target.stage,
        timestamp=now_iso(),
        size_bytes=target.size_bytes,
        lines=target.lines,
    )
    store.save_version(doc.id, v)

    doc.current_version = new_version
    doc.current_stage = target.stage
    doc.updated_at = now_iso()
    store.update_document(doc)

    print(f"{GREEN}✓ Rolled back to v{args.version}{RESET} (saved as v{new_version})")
    print(f"  Stage reset to: {target.stage}")
    print(f"  Original message: {target.message}")


def cmd_stage(args, store: VCSStore):
    """Transition document to a new stage."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    new_stage = args.stage.lower()
    if new_stage not in STAGE_ORDER:
        print(f"{RED}✗ Invalid stage: {new_stage}{RESET}")
        print(f"  Valid stages: {', '.join(STAGE_ORDER)}")
        sys.exit(1)

    allowed = STAGE_TRANSITIONS.get(doc.current_stage, [])
    if new_stage not in allowed:
        print(f"{RED}✗ Cannot transition from '{doc.current_stage}' to '{new_stage}'{RESET}")
        print(f"  Allowed transitions: {', '.join(allowed)}")
        sys.exit(1)

    old_stage = doc.current_stage

    # Create a new version recording the stage change
    current = store.load_version(doc.id, doc.current_version)
    if current:
        new_version = doc.current_version + 1
        v = DocumentVersion(
            version=new_version,
            content=current.content,
            content_hash=current.content_hash,
            message=args.message or f"Stage transition: {old_stage} → {new_stage}",
            stage=new_stage,
            timestamp=now_iso(),
            size_bytes=current.size_bytes,
            lines=current.lines,
        )
        store.save_version(doc.id, v)
        doc.current_version = new_version

    doc.current_stage = new_stage
    doc.updated_at = now_iso()
    store.update_document(doc)

    old_color = _stage_color(old_stage)
    new_color = _stage_color(new_stage)
    print(f"{GREEN}✓ Stage transition:{RESET} {old_color}{old_stage}{RESET} → {new_color}{new_stage}{RESET}")
    print(f"  Document: {doc.name}")
    if args.message:
        print(f"  Reason:   {args.message}")


def cmd_request_change(args, store: VCSStore):
    """Record a change request against a document."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    change_id = f"CR-{generate_id()}"
    change = ChangeRequest(
        id=change_id,
        doc_id=doc.id,
        requester=args.requester,
        description=args.description,
        status="pending",
        created_at=now_iso(),
        priority=args.priority or "normal",
        notes=args.notes or "",
    )
    store.add_change(change)

    print(f"{GREEN}✓ Change request created{RESET}")
    print(f"  ID:          {CYAN}{change_id}{RESET}")
    print(f"  Document:    {doc.name} (v{doc.current_version})")
    print(f"  Requester:   {change.requester}")
    print(f"  Description: {change.description}")
    print(f"  Priority:    {change.priority}")
    print(f"  Status:      {YELLOW}pending{RESET}")


def cmd_changes(args, store: VCSStore):
    """List change requests for a document."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    status = args.status if args.status else None
    changes = store.get_changes_for_doc(doc.id, status)

    if not changes:
        label = f" ({status})" if status else ""
        print(f"{DIM}No change requests{label} for {doc.name}.{RESET}")
        return

    print(f"{BOLD}Change Requests — {doc.name}{RESET}\n")
    for c in changes:
        status_color = {
            "pending": YELLOW,
            "accepted": GREEN,
            "rejected": RED,
            "resolved": CYAN,
        }.get(c.status, "")
        priority_indicator = f" {RED}[{c.priority}]{RESET}" if c.priority == "high" else ""

        print(f"  {BOLD}{c.id}{RESET}{priority_indicator}")
        print(f"    Status:    {status_color}{c.status}{RESET}")
        print(f"    Requester: {c.requester}")
        print(f"    Desc:      {c.description}")
        print(f"    Created:   {DIM}{c.created_at}{RESET}")
        if c.resolved_at:
            print(f"    Resolved:  {DIM}{c.resolved_at} (v{c.resolved_version}){RESET}")
        if c.notes:
            print(f"    Notes:     {c.notes}")
        print()


def cmd_resolve(args, store: VCSStore):
    """Resolve a change request, optionally linking to a version."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    changes = store.load_changes()
    target = None
    for c in changes:
        if c.id == args.change_id:
            target = c
            break

    if not target:
        print(f"{RED}✗ Change request not found: {args.change_id}{RESET}")
        sys.exit(1)

    if target.status == "resolved":
        print(f"{YELLOW}Already resolved at v{target.resolved_version}.{RESET}")
        return

    target.status = "resolved"
    target.resolved_at = now_iso()
    target.resolved_version = args.version if args.version else doc.current_version
    if args.notes:
        target.notes = args.notes
    store.update_change(target)

    print(f"{GREEN}✓ Change request {target.id} resolved{RESET}")
    print(f"  Linked to version: v{target.resolved_version}")


def cmd_list(args, store: VCSStore):
    """List all tracked documents."""
    docs = store.load_documents()

    if args.type:
        docs = [d for d in docs if d.doc_type == args.type]
    if args.stage:
        docs = [d for d in docs if d.current_stage == args.stage]
    if args.client:
        docs = [d for d in docs if args.client.lower() in d.client.lower()]

    if not docs:
        print(f"{DIM}No documents found.{RESET}")
        return

    print(f"{BOLD}Tracked Documents ({len(docs)}){RESET}\n")

    # Table header
    print(f"  {'ID':<10} {'Name':<30} {'Type':<12} {'Stage':<12} {'Ver':<5} {'Updated':<20}")
    print(f"  {'─'*10} {'─'*30} {'─'*12} {'─'*12} {'─'*5} {'─'*20}")

    for d in sorted(docs, key=lambda x: x.updated_at, reverse=True):
        stage_color = _stage_color(d.current_stage)
        name = d.name[:28] + ".." if len(d.name) > 30 else d.name
        updated = d.updated_at[:19]
        print(f"  {CYAN}{d.id:<10}{RESET} {name:<30} {d.doc_type:<12} {stage_color}{d.current_stage:<12}{RESET} v{d.current_version:<4} {DIM}{updated}{RESET}")

    # Summary
    pending_changes = len([c for c in store.load_changes() if c.status == "pending"])
    if pending_changes:
        print(f"\n  {YELLOW}⚠ {pending_changes} pending change request(s){RESET}")


def cmd_export(args, store: VCSStore):
    """Export document content to a file."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    version_num = args.version if args.version else doc.current_version
    v = store.load_version(doc.id, version_num)
    if not v:
        print(f"{RED}✗ Version {version_num} not found{RESET}")
        sys.exit(1)

    output = args.output
    if not output:
        safe_name = doc.name.replace(" ", "_").lower()
        output = f"{safe_name}_v{version_num}.md"

    with open(output, "w", encoding="utf-8") as f:
        f.write(v.content)

    print(f"{GREEN}✓ Exported{RESET} {doc.name} v{version_num} → {CYAN}{output}{RESET}")
    print(f"  Size: {v.size_bytes} bytes, {v.lines} lines")


def cmd_stats(args, store: VCSStore):
    """Show statistics for a document or all documents."""
    docs = store.load_documents()
    changes = store.load_changes()

    if args.doc:
        doc = store.get_document(args.doc)
        if not doc:
            print(f"{RED}✗ Document not found: {args.doc}{RESET}")
            sys.exit(1)
        _show_doc_stats(doc, store, changes)
    else:
        _show_global_stats(docs, store, changes)


def cmd_delete(args, store: VCSStore):
    """Delete a tracked document and all its versions."""
    doc = store.get_document(args.doc_id)
    if not doc:
        print(f"{RED}✗ Document not found: {args.doc_id}{RESET}")
        sys.exit(1)

    if not args.force:
        print(f"{YELLOW}⚠ This will permanently delete '{doc.name}' and all {doc.current_version} version(s).{RESET}")
        print(f"  Use --force to confirm.")
        sys.exit(1)

    # Remove associated change requests
    changes = store.load_changes()
    changes = [c for c in changes if c.doc_id != doc.id]
    store.save_changes(changes)

    store.delete_document(doc.id)
    print(f"{GREEN}✓ Deleted{RESET} {doc.name} ({doc.current_version} versions removed)")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _count_diff(old: str, new: str) -> tuple:
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
    added = removed = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "replace":
            removed += i2 - i1
            added += j2 - j1
        elif tag == "delete":
            removed += i2 - i1
        elif tag == "insert":
            added += j2 - j1
    return added, removed


def _stage_color(stage: str) -> str:
    return {
        "draft": BLUE,
        "submitted": YELLOW,
        "revised": MAGENTA,
        "final": GREEN,
        "archived": DIM,
    }.get(stage, "")


def _show_doc_stats(doc: Document, store: VCSStore, changes: List[ChangeRequest]):
    versions = store.load_all_versions(doc.id)
    doc_changes = [c for c in changes if c.doc_id == doc.id]

    print(f"{BOLD}Statistics — {doc.name}{RESET}\n")
    print(f"  Type:              {doc.doc_type}")
    print(f"  Current stage:     {_stage_color(doc.current_stage)}{doc.current_stage}{RESET}")
    print(f"  Total versions:    {len(versions)}")
    print(f"  Created:           {doc.created_at}")
    print(f"  Last updated:      {doc.updated_at}")

    if doc.client:
        print(f"  Client:            {doc.client}")
    if doc.project:
        print(f"  Project:           {doc.project}")

    if versions:
        sizes = [v.size_bytes for v in versions]
        print(f"\n  {BOLD}Content{RESET}")
        print(f"    Current size:    {sizes[-1]} bytes")
        print(f"    Largest version: {max(sizes)} bytes")
        print(f"    Smallest:        {min(sizes)} bytes")

        # Stage history
        stage_transitions = []
        for i, v in enumerate(versions):
            if i == 0 or v.stage != versions[i-1].stage:
                stage_transitions.append((v.version, v.stage))
        print(f"\n  {BOLD}Stage History{RESET}")
        for ver, stage in stage_transitions:
            print(f"    v{ver}: {_stage_color(stage)}{stage}{RESET}")

    if doc_changes:
        pending = len([c for c in doc_changes if c.status == "pending"])
        resolved = len([c for c in doc_changes if c.status == "resolved"])
        print(f"\n  {BOLD}Change Requests{RESET}")
        print(f"    Total:    {len(doc_changes)}")
        print(f"    Pending:  {YELLOW}{pending}{RESET}")
        print(f"    Resolved: {GREEN}{resolved}{RESET}")


def _show_global_stats(docs: List[Document], store: VCSStore, changes: List[ChangeRequest]):
    print(f"{BOLD}Document Version Control — Global Stats{RESET}\n")
    print(f"  Total documents:       {len(docs)}")

    if not docs:
        return

    # By type
    type_counts = {}
    for d in docs:
        type_counts[d.doc_type] = type_counts.get(d.doc_type, 0) + 1
    print(f"\n  {BOLD}By Type{RESET}")
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {t:<15} {count}")

    # By stage
    stage_counts = {}
    for d in docs:
        stage_counts[d.current_stage] = stage_counts.get(d.current_stage, 0) + 1
    print(f"\n  {BOLD}By Stage{RESET}")
    for s in STAGE_ORDER:
        count = stage_counts.get(s, 0)
        if count:
            print(f"    {_stage_color(s)}{s:<15}{RESET} {count}")

    # Total versions
    total_versions = sum(d.current_version for d in docs)
    print(f"\n  Total versions:        {total_versions}")
    print(f"  Avg versions/doc:      {total_versions / len(docs):.1f}")

    # Change requests
    pending = len([c for c in changes if c.status == "pending"])
    resolved = len([c for c in changes if c.status == "resolved"])
    print(f"\n  {BOLD}Change Requests{RESET}")
    print(f"    Total:    {len(changes)}")
    print(f"    Pending:  {YELLOW}{pending}{RESET}")
    print(f"    Resolved: {GREEN}{resolved}{RESET}")


# ---------------------------------------------------------------------------
# CLI Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="document_version_control",
        description="Version control for freelancer documents with change tracking",
    )
    sub = parser.add_subparsers(dest="command", help="Available commands")

    # init
    p = sub.add_parser("init", help="Initialize a new tracked document")
    p.add_argument("name", help="Document name")
    p.add_argument("--type", "-t", default="other", choices=DOC_TYPES, help="Document type")
    p.add_argument("--content", "-c", help="Initial content (file path or inline text)")
    p.add_argument("--message", "-m", help="Initial version message")
    p.add_argument("--tags", help="Comma-separated tags")
    p.add_argument("--client", help="Client name")
    p.add_argument("--project", help="Project name")

    # commit
    p = sub.add_parser("commit", help="Commit a new version")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("--content", "-c", required=True, help="Content (file path or inline text)")
    p.add_argument("--message", "-m", help="Version message")
    p.add_argument("--stage", "-s", choices=STAGE_ORDER, help="Set stage")
    p.add_argument("--change-request", help="Link to change request ID")

    # log
    p = sub.add_parser("log", help="Show version history")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("--limit", "-n", type=int, help="Limit entries shown")

    # show
    p = sub.add_parser("show", help="Show document content")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("--version", "-v", type=int, help="Version number (default: latest)")
    p.add_argument("--meta-only", action="store_true", help="Show metadata only")

    # diff
    p = sub.add_parser("diff", help="Diff between two versions")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("v1", type=int, help="First version number")
    p.add_argument("v2", type=int, help="Second version number")

    # rollback
    p = sub.add_parser("rollback", help="Rollback to a previous version")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("version", type=int, help="Target version number")

    # stage
    p = sub.add_parser("stage", help="Transition document stage")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("stage", help="Target stage")
    p.add_argument("--message", "-m", help="Reason for transition")

    # request-change
    p = sub.add_parser("request-change", help="Record a change request")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("--requester", "-r", required=True, help="Who requested the change")
    p.add_argument("--description", "-d", required=True, help="Change description")
    p.add_argument("--priority", "-p", choices=["low", "normal", "high"], default="normal")
    p.add_argument("--notes", "-n", help="Additional notes")

    # changes
    p = sub.add_parser("changes", help="List change requests")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("--status", choices=CHANGE_STATUSES, help="Filter by status")

    # resolve
    p = sub.add_parser("resolve", help="Resolve a change request")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("change_id", help="Change request ID")
    p.add_argument("--version", "-v", type=int, help="Link to version")
    p.add_argument("--notes", "-n", help="Resolution notes")

    # list
    p = sub.add_parser("list", help="List all tracked documents")
    p.add_argument("--type", "-t", choices=DOC_TYPES, help="Filter by type")
    p.add_argument("--stage", "-s", choices=STAGE_ORDER, help="Filter by stage")
    p.add_argument("--client", help="Filter by client name")

    # export
    p = sub.add_parser("export", help="Export document to file")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("--version", "-v", type=int, help="Version to export (default: latest)")
    p.add_argument("--output", "-o", help="Output file path")

    # stats
    p = sub.add_parser("stats", help="Show statistics")
    p.add_argument("--doc", "-d", help="Specific document ID (or global stats)")

    # delete
    p = sub.add_parser("delete", help="Delete a tracked document")
    p.add_argument("doc_id", help="Document ID or name")
    p.add_argument("--force", "-f", action="store_true", help="Skip confirmation")

    return parser


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    store = VCSStore()

    commands = {
        "init": cmd_init,
        "commit": cmd_commit,
        "log": cmd_log,
        "show": cmd_show,
        "diff": cmd_diff,
        "rollback": cmd_rollback,
        "stage": cmd_stage,
        "request-change": cmd_request_change,
        "changes": cmd_changes,
        "resolve": cmd_resolve,
        "list": cmd_list,
        "export": cmd_export,
        "stats": cmd_stats,
        "delete": cmd_delete,
    }

    handler = commands.get(args.command)
    if handler:
        handler(args, store)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
