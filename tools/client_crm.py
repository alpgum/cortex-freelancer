#!/usr/bin/env python3
"""
Client CRM with Relationship Scoring and Communication History

A comprehensive client relationship management system for freelancers featuring:
- Client profiles with platform tracking (Upwork/Fiverr/direct)
- Communication history logging (emails, calls, messages)
- Relationship scoring (0-100) based on payment, responsiveness, frequency
- Client lifecycle stages (Lead → Prospect → Active → Repeat → Champion → Dormant → Lost)
- Health indicators and dormancy detection
- Red flag tracking and referral attribution
- Portfolio-wide analytics and CSV export

Usage:
    python client_crm.py add
    python client_crm.py list [--stage active] [--tag web] [--score-min 60]
    python client_crm.py show <id>
    python client_crm.py log <id>
    python client_crm.py score <id>
    python client_crm.py health
    python client_crm.py dormant
    python client_crm.py stats
    python client_crm.py export [--output clients.csv]
    python client_crm.py import <file.csv>
    python client_crm.py edit <id>
    python client_crm.py delete <id>
"""

import argparse
import json
import os
import sys
import csv
import uuid
import io
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.expanduser("~"), ".cortex-freelancer", "crm")
CLIENTS_FILE = os.path.join(DATA_DIR, "clients.json")
COMMS_FILE = os.path.join(DATA_DIR, "communications.json")

LIFECYCLE_STAGES = ["lead", "prospect", "active", "repeat", "champion", "dormant", "lost"]
PLATFORMS = ["upwork", "fiverr", "toptal", "freelancer", "direct", "referral", "other"]
BUDGET_TIERS = ["low", "mid", "high", "enterprise"]
COMM_TYPES = ["email", "call", "message", "meeting", "video_call", "other"]
COMM_DIRECTIONS = ["inbound", "outbound"]
RED_FLAG_TYPES = [
    "late_payment", "scope_creep", "difficult_communication",
    "unreasonable_deadline", "ghosting", "disrespectful", "other"
]

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

# Relationship scoring weights (tunable)
SCORING_WEIGHTS = {
    "payment_reliability": 0.25,     # How reliably they pay on time
    "responsiveness": 0.15,          # How quickly they respond
    "project_frequency": 0.15,       # How often they give repeat work
    "scope_creep_history": 0.15,     # Inverse of scope creep incidents
    "referral_potential": 0.10,      # Have they referred / likely to refer
    "communication_quality": 0.10,   # Pleasant to work with
    "budget_tier": 0.10,             # Higher budgets = higher score
}

# Dormancy thresholds (days since last contact)
DORMANCY_THRESHOLDS = {
    "champion": 60,
    "repeat": 45,
    "active": 30,
    "prospect": 21,
    "lead": 14,
}

# Communication cadence recommendations (days between contacts)
CADENCE_RECOMMENDATIONS = {
    "champion": 30,
    "repeat": 21,
    "active": 14,
    "prospect": 7,
    "lead": 5,
    "dormant": 14,
    "lost": 90,
}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class RedFlag:
    """A red flag event for a client"""
    type: str
    description: str
    date: str
    severity: int = 1  # 1-5

    def to_dict(self) -> dict:
        return {"type": self.type, "description": self.description,
                "date": self.date, "severity": self.severity}

    @classmethod
    def from_dict(cls, d: dict) -> "RedFlag":
        return cls(type=d["type"], description=d["description"],
                   date=d["date"], severity=d.get("severity", 1))


@dataclass
class Project:
    """A project record for a client"""
    name: str
    start_date: str
    end_date: Optional[str] = None
    revenue: float = 0.0
    hours: float = 0.0
    status: str = "completed"  # active, completed, cancelled
    notes: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Project":
        return cls(**d)


@dataclass
class Client:
    """A client profile"""
    id: str
    name: str
    company: str = ""
    email: str = ""
    phone: str = ""
    platform: str = "direct"
    stage: str = "lead"
    tags: List[str] = field(default_factory=list)
    industry: str = ""
    budget_tier: str = "mid"
    communication_preference: str = "email"
    projects: List[dict] = field(default_factory=list)
    red_flags: List[dict] = field(default_factory=list)
    notes: str = ""
    referred_by: str = ""  # client ID who referred this one
    referrals: List[str] = field(default_factory=list)  # client IDs this one referred
    # Scoring factors (0-100 each, manually set or derived)
    payment_reliability: int = 50
    responsiveness: int = 50
    communication_quality: int = 50
    referral_potential: int = 50
    # Metadata
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Client":
        # Handle missing fields gracefully
        valid = {}
        for f in cls.__dataclass_fields__:
            if f in d:
                valid[f] = d[f]
        return cls(**valid)

    @property
    def total_revenue(self) -> float:
        return sum(p.get("revenue", 0) for p in self.projects)

    @property
    def total_hours(self) -> float:
        return sum(p.get("hours", 0) for p in self.projects)

    @property
    def project_count(self) -> int:
        return len(self.projects)

    @property
    def completed_projects(self) -> int:
        return sum(1 for p in self.projects if p.get("status") == "completed")

    @property
    def avg_project_revenue(self) -> float:
        completed = [p for p in self.projects if p.get("status") == "completed"]
        if not completed:
            return 0.0
        return sum(p.get("revenue", 0) for p in completed) / len(completed)

    @property
    def red_flag_count(self) -> int:
        return len(self.red_flags)

    @property
    def scope_creep_count(self) -> int:
        return sum(1 for f in self.red_flags if f.get("type") == "scope_creep")

    @property
    def late_payment_count(self) -> int:
        return sum(1 for f in self.red_flags if f.get("type") == "late_payment")


@dataclass
class Communication:
    """A communication log entry"""
    id: str
    client_id: str
    type: str  # email, call, message, meeting, video_call
    direction: str  # inbound, outbound
    subject: str = ""
    summary: str = ""
    date: str = ""
    follow_up_needed: bool = False
    follow_up_date: str = ""
    notes: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Communication":
        valid = {}
        for f in cls.__dataclass_fields__:
            if f in d:
                valid[f] = d[f]
        return cls(**valid)


# ---------------------------------------------------------------------------
# Data Storage
# ---------------------------------------------------------------------------

class CRMStore:
    """JSON file-based storage for CRM data"""

    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.clients_file = os.path.join(data_dir, "clients.json")
        self.comms_file = os.path.join(data_dir, "communications.json")
        self._ensure_dir()

    def _ensure_dir(self):
        os.makedirs(self.data_dir, exist_ok=True)

    def _load_json(self, path: str) -> list:
        if not os.path.exists(path):
            return []
        with open(path, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []

    def _save_json(self, path: str, data: list):
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    # --- Clients ---
    def load_clients(self) -> List[Client]:
        raw = self._load_json(self.clients_file)
        return [Client.from_dict(r) for r in raw]

    def save_clients(self, clients: List[Client]):
        self._save_json(self.clients_file, [c.to_dict() for c in clients])

    def get_client(self, client_id: str) -> Optional[Client]:
        for c in self.load_clients():
            if c.id == client_id or c.name.lower() == client_id.lower():
                return c
        # Partial match
        for c in self.load_clients():
            if client_id.lower() in c.id.lower() or client_id.lower() in c.name.lower():
                return c
        return None

    def add_client(self, client: Client) -> Client:
        clients = self.load_clients()
        clients.append(client)
        self.save_clients(clients)
        return client

    def update_client(self, client: Client):
        clients = self.load_clients()
        for i, c in enumerate(clients):
            if c.id == client.id:
                client.updated_at = datetime.now().isoformat()
                clients[i] = client
                break
        self.save_clients(clients)

    def delete_client(self, client_id: str) -> bool:
        clients = self.load_clients()
        original_len = len(clients)
        clients = [c for c in clients if c.id != client_id]
        if len(clients) < original_len:
            self.save_clients(clients)
            return True
        return False

    # --- Communications ---
    def load_communications(self) -> List[Communication]:
        raw = self._load_json(self.comms_file)
        return [Communication.from_dict(r) for r in raw]

    def save_communications(self, comms: List[Communication]):
        self._save_json(self.comms_file, [c.to_dict() for c in comms])

    def get_client_comms(self, client_id: str) -> List[Communication]:
        return [c for c in self.load_communications() if c.client_id == client_id]

    def add_communication(self, comm: Communication) -> Communication:
        comms = self.load_communications()
        comms.append(comm)
        self.save_communications(comms)
        return comm

    def get_last_contact(self, client_id: str) -> Optional[Communication]:
        comms = sorted(self.get_client_comms(client_id),
                       key=lambda c: c.date, reverse=True)
        return comms[0] if comms else None


# ---------------------------------------------------------------------------
# Relationship Scoring Engine
# ---------------------------------------------------------------------------

class RelationshipScorer:
    """
    Calculates a 0-100 relationship score based on weighted factors.

    Algorithm:
    Score = Σ (weight_i × factor_i) where factors are 0-100

    Factors:
    - payment_reliability (25%): Manual rating + auto-adjusted by late_payment flags
    - responsiveness (15%): Manual rating from client profile
    - project_frequency (15%): Derived from project count & recency
    - scope_creep_history (15%): 100 minus penalty per scope_creep flag
    - referral_potential (10%): Manual rating + bonus if referrals exist
    - communication_quality (10%): Manual rating from client profile
    - budget_tier (10%): Mapped from budget tier label
    """

    BUDGET_SCORES = {"low": 25, "mid": 50, "high": 75, "enterprise": 100}

    def calculate(self, client: Client, comms: List[Communication]) -> dict:
        """Return {score, factors, grade, details}"""
        factors = {}

        # Payment reliability: base from profile, penalise per late payment
        payment = max(0, client.payment_reliability - client.late_payment_count * 15)
        factors["payment_reliability"] = min(100, max(0, payment))

        # Responsiveness: direct from profile
        factors["responsiveness"] = min(100, max(0, client.responsiveness))

        # Project frequency
        factors["project_frequency"] = self._project_frequency_score(client)

        # Scope creep history (inverse)
        scope_penalty = client.scope_creep_count * 20
        factors["scope_creep_history"] = max(0, 100 - scope_penalty)

        # Referral potential + bonus
        ref_score = client.referral_potential
        if client.referrals:
            ref_score = min(100, ref_score + len(client.referrals) * 10)
        factors["referral_potential"] = min(100, max(0, ref_score))

        # Communication quality
        factors["communication_quality"] = min(100, max(0, client.communication_quality))

        # Budget tier
        factors["budget_tier"] = self.BUDGET_SCORES.get(client.budget_tier, 50)

        # Weighted sum
        score = sum(SCORING_WEIGHTS[k] * factors[k] for k in SCORING_WEIGHTS)
        score = round(min(100, max(0, score)), 1)

        grade = self._grade(score)

        return {
            "score": score,
            "factors": factors,
            "grade": grade,
            "details": self._details(factors),
        }

    def _project_frequency_score(self, client: Client) -> int:
        count = client.completed_projects
        if count == 0:
            return 10
        if count == 1:
            return 30
        if count <= 3:
            return 55
        if count <= 6:
            return 75
        return 95

    @staticmethod
    def _grade(score: float) -> str:
        if score >= 90:
            return "A+"
        if score >= 80:
            return "A"
        if score >= 70:
            return "B"
        if score >= 60:
            return "C"
        if score >= 40:
            return "D"
        return "F"

    @staticmethod
    def _details(factors: dict) -> List[str]:
        details = []
        if factors["payment_reliability"] < 40:
            details.append("⚠️  Payment reliability is concerning")
        if factors["scope_creep_history"] < 50:
            details.append("⚠️  History of scope creep issues")
        if factors["responsiveness"] < 30:
            details.append("⚠️  Client is often unresponsive")
        if factors["referral_potential"] >= 80:
            details.append("🌟 High referral potential")
        if factors["project_frequency"] >= 75:
            details.append("🔁 Strong repeat client")
        return details


# ---------------------------------------------------------------------------
# Health Monitor
# ---------------------------------------------------------------------------

class HealthMonitor:
    """Monitors client relationship health and dormancy"""

    def check_dormancy(self, client: Client, last_contact: Optional[Communication]) -> dict:
        """Check if a client is going dormant"""
        if client.stage in ("dormant", "lost"):
            return {"status": "already_dormant", "days": None, "action": None}

        if not last_contact or not last_contact.date:
            return {
                "status": "no_contact",
                "days": None,
                "action": "Schedule initial outreach",
            }

        try:
            last_date = datetime.fromisoformat(last_contact.date)
        except (ValueError, TypeError):
            return {"status": "unknown", "days": None, "action": None}

        days_since = (datetime.now() - last_date).days
        threshold = DORMANCY_THRESHOLDS.get(client.stage, 30)

        if days_since > threshold:
            return {
                "status": "at_risk",
                "days": days_since,
                "threshold": threshold,
                "action": f"Reach out ASAP — {days_since} days since last contact (threshold: {threshold})",
            }
        elif days_since > threshold * 0.7:
            return {
                "status": "warning",
                "days": days_since,
                "threshold": threshold,
                "action": f"Schedule follow-up soon — {days_since} days since contact",
            }
        else:
            return {
                "status": "healthy",
                "days": days_since,
                "threshold": threshold,
                "action": None,
            }

    def cadence_recommendation(self, client: Client) -> str:
        """Suggest communication cadence based on stage"""
        days = CADENCE_RECOMMENDATIONS.get(client.stage, 30)
        return f"Reach out every {days} days"

    def client_value_analysis(self, client: Client) -> dict:
        """Analyze client's monetary value"""
        total = client.total_revenue
        avg = client.avg_project_revenue
        count = client.completed_projects

        # Simple LTV projection: avg revenue * projected future projects
        # Based on stage, project more
        stage_multipliers = {
            "champion": 8, "repeat": 5, "active": 3,
            "prospect": 1, "lead": 0.5, "dormant": 0.5, "lost": 0,
        }
        mult = stage_multipliers.get(client.stage, 1)
        projected_ltv = total + (avg * mult)

        effective_rate = 0.0
        if client.total_hours > 0:
            effective_rate = total / client.total_hours

        return {
            "total_revenue": total,
            "avg_project_revenue": round(avg, 2),
            "project_count": count,
            "projected_ltv": round(projected_ltv, 2),
            "effective_hourly_rate": round(effective_rate, 2),
            "total_hours": client.total_hours,
        }


# ---------------------------------------------------------------------------
# CLI Formatters
# ---------------------------------------------------------------------------

def format_score_bar(score: float, width: int = 20) -> str:
    """Render a colored score bar"""
    filled = int(score / 100 * width)
    empty = width - filled
    if score >= 70:
        color = GREEN
    elif score >= 40:
        color = YELLOW
    else:
        color = RED
    return f"{color}{'█' * filled}{'░' * empty}{RESET} {score:.0f}/100"


def format_stage_badge(stage: str) -> str:
    """Colored badge for lifecycle stage"""
    colors = {
        "lead": BLUE, "prospect": CYAN, "active": GREEN,
        "repeat": GREEN + BOLD, "champion": MAGENTA + BOLD,
        "dormant": YELLOW, "lost": RED + DIM,
    }
    c = colors.get(stage, WHITE)
    return f"{c}[{stage.upper()}]{RESET}"


def format_health_indicator(status: str) -> str:
    indicators = {
        "healthy": f"{GREEN}● Healthy{RESET}",
        "warning": f"{YELLOW}◐ Warning{RESET}",
        "at_risk": f"{RED}◉ At Risk{RESET}",
        "no_contact": f"{RED}○ No Contact{RESET}",
        "already_dormant": f"{DIM}◌ Dormant{RESET}",
        "unknown": f"{DIM}? Unknown{RESET}",
    }
    return indicators.get(status, status)


def format_currency(amount: float) -> str:
    if amount >= 1000:
        return f"${amount:,.0f}"
    return f"${amount:,.2f}"


def print_header(text: str):
    print(f"\n{BOLD}{CYAN}{'═' * 60}{RESET}")
    print(f"{BOLD}{CYAN}  {text}{RESET}")
    print(f"{BOLD}{CYAN}{'═' * 60}{RESET}\n")


def print_section(text: str):
    print(f"\n{BOLD}{WHITE}── {text} ──{RESET}")


# ---------------------------------------------------------------------------
# CLI Commands
# ---------------------------------------------------------------------------

class CRMApp:
    """Main CRM application"""

    def __init__(self, store: Optional[CRMStore] = None):
        self.store = store or CRMStore()
        self.scorer = RelationshipScorer()
        self.health = HealthMonitor()

    # --- ADD ---
    def cmd_add(self, args):
        """Add a new client interactively"""
        print_header("Add New Client")

        name = input(f"  {BOLD}Name:{RESET} ").strip()
        if not name:
            print(f"{RED}Name is required.{RESET}")
            return

        company = input(f"  {BOLD}Company:{RESET} ").strip()
        email = input(f"  {BOLD}Email:{RESET} ").strip()
        phone = input(f"  {BOLD}Phone:{RESET} ").strip()

        print(f"  {DIM}Platforms: {', '.join(PLATFORMS)}{RESET}")
        platform = input(f"  {BOLD}Platform:{RESET} ").strip().lower() or "direct"

        print(f"  {DIM}Stages: {', '.join(LIFECYCLE_STAGES)}{RESET}")
        stage = input(f"  {BOLD}Stage:{RESET} ").strip().lower() or "lead"

        industry = input(f"  {BOLD}Industry:{RESET} ").strip()

        print(f"  {DIM}Budget tiers: {', '.join(BUDGET_TIERS)}{RESET}")
        budget = input(f"  {BOLD}Budget tier:{RESET} ").strip().lower() or "mid"

        tags_raw = input(f"  {BOLD}Tags (comma-separated):{RESET} ").strip()
        tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

        notes = input(f"  {BOLD}Notes:{RESET} ").strip()

        referred_by = input(f"  {BOLD}Referred by (client ID, optional):{RESET} ").strip()

        now = datetime.now().isoformat()
        client = Client(
            id=uuid.uuid4().hex[:8],
            name=name,
            company=company,
            email=email,
            phone=phone,
            platform=platform if platform in PLATFORMS else "other",
            stage=stage if stage in LIFECYCLE_STAGES else "lead",
            tags=tags,
            industry=industry,
            budget_tier=budget if budget in BUDGET_TIERS else "mid",
            notes=notes,
            referred_by=referred_by,
            created_at=now,
            updated_at=now,
        )

        self.store.add_client(client)

        # Track referral on the referring client
        if referred_by:
            referrer = self.store.get_client(referred_by)
            if referrer:
                referrer.referrals.append(client.id)
                self.store.update_client(referrer)

        print(f"\n{GREEN}✓ Client added: {client.name} (ID: {client.id}){RESET}")

    def cmd_add_noninteractive(self, name: str, company: str = "", email: str = "",
                               phone: str = "", platform: str = "direct",
                               stage: str = "lead", industry: str = "",
                               budget_tier: str = "mid", tags: Optional[List[str]] = None,
                               notes: str = "", referred_by: str = "") -> Client:
        """Add a client programmatically (for testing/integration)"""
        now = datetime.now().isoformat()
        client = Client(
            id=uuid.uuid4().hex[:8],
            name=name, company=company, email=email, phone=phone,
            platform=platform if platform in PLATFORMS else "other",
            stage=stage if stage in LIFECYCLE_STAGES else "lead",
            tags=tags or [], industry=industry,
            budget_tier=budget_tier if budget_tier in BUDGET_TIERS else "mid",
            notes=notes, referred_by=referred_by,
            created_at=now, updated_at=now,
        )
        self.store.add_client(client)

        if referred_by:
            referrer = self.store.get_client(referred_by)
            if referrer:
                referrer.referrals.append(client.id)
                self.store.update_client(referrer)

        return client

    # --- LIST ---
    def cmd_list(self, args):
        """List clients with optional filters"""
        clients = self.store.load_clients()

        if hasattr(args, "stage") and args.stage:
            clients = [c for c in clients if c.stage == args.stage.lower()]
        if hasattr(args, "tag") and args.tag:
            tag = args.tag.lower()
            clients = [c for c in clients if tag in [t.lower() for t in c.tags]]
        if hasattr(args, "platform") and args.platform:
            clients = [c for c in clients if c.platform == args.platform.lower()]

        # Score filtering
        score_min = getattr(args, "score_min", None)
        score_max = getattr(args, "score_max", None)
        if score_min is not None or score_max is not None:
            scored_clients = []
            for c in clients:
                comms = self.store.get_client_comms(c.id)
                result = self.scorer.calculate(c, comms)
                s = result["score"]
                if score_min is not None and s < score_min:
                    continue
                if score_max is not None and s > score_max:
                    continue
                scored_clients.append(c)
            clients = scored_clients

        if not clients:
            print(f"{YELLOW}No clients found.{RESET}")
            return

        print_header(f"Clients ({len(clients)})")
        print(f"  {BOLD}{'ID':<10} {'Name':<20} {'Stage':<14} {'Platform':<10} {'Revenue':>10} {'Score':>6}{RESET}")
        print(f"  {DIM}{'─' * 74}{RESET}")

        for c in sorted(clients, key=lambda x: x.name):
            comms = self.store.get_client_comms(c.id)
            result = self.scorer.calculate(c, comms)
            score = result["score"]
            stage_str = format_stage_badge(c.stage)

            # Score color
            if score >= 70:
                sc = f"{GREEN}{score:.0f}{RESET}"
            elif score >= 40:
                sc = f"{YELLOW}{score:.0f}{RESET}"
            else:
                sc = f"{RED}{score:.0f}{RESET}"

            print(f"  {DIM}{c.id:<10}{RESET} {c.name:<20} {stage_str:<25} {c.platform:<10} {format_currency(c.total_revenue):>10} {sc:>6}")

        print()

    # --- SHOW ---
    def cmd_show(self, args):
        """Show detailed client profile"""
        client = self.store.get_client(args.id)
        if not client:
            print(f"{RED}Client not found: {args.id}{RESET}")
            return

        comms = self.store.get_client_comms(client.id)
        score_result = self.scorer.calculate(client, comms)
        last = self.store.get_last_contact(client.id)
        health_status = self.health.check_dormancy(client, last)
        value = self.health.client_value_analysis(client)

        print_header(f"Client: {client.name}")

        # Basic info
        print(f"  {BOLD}ID:{RESET}       {client.id}")
        print(f"  {BOLD}Company:{RESET}  {client.company or '—'}")
        print(f"  {BOLD}Email:{RESET}    {client.email or '—'}")
        print(f"  {BOLD}Phone:{RESET}    {client.phone or '—'}")
        print(f"  {BOLD}Platform:{RESET} {client.platform}")
        print(f"  {BOLD}Stage:{RESET}    {format_stage_badge(client.stage)}")
        print(f"  {BOLD}Industry:{RESET} {client.industry or '—'}")
        print(f"  {BOLD}Budget:{RESET}   {client.budget_tier.upper()}")
        print(f"  {BOLD}Tags:{RESET}     {', '.join(client.tags) if client.tags else '—'}")
        if client.notes:
            print(f"  {BOLD}Notes:{RESET}    {client.notes}")

        # Relationship score
        print_section("Relationship Score")
        print(f"  {format_score_bar(score_result['score'])}  Grade: {BOLD}{score_result['grade']}{RESET}")
        for k, v in score_result["factors"].items():
            label = k.replace("_", " ").title()
            weight = SCORING_WEIGHTS.get(k, 0) * 100
            bar_char = "█" * int(v / 10) + "░" * (10 - int(v / 10))
            print(f"    {label:<25} {bar_char} {v:>3}/100  ({weight:.0f}%)")
        for detail in score_result["details"]:
            print(f"    {detail}")

        # Health
        print_section("Health")
        print(f"  {BOLD}Status:{RESET}  {format_health_indicator(health_status['status'])}")
        if health_status.get("days") is not None:
            print(f"  {BOLD}Days since contact:{RESET} {health_status['days']}")
        if health_status.get("action"):
            print(f"  {BOLD}Action:{RESET} {health_status['action']}")
        print(f"  {BOLD}Cadence:{RESET} {self.health.cadence_recommendation(client)}")

        # Value
        print_section("Value Analysis")
        print(f"  {BOLD}Total Revenue:{RESET}      {format_currency(value['total_revenue'])}")
        print(f"  {BOLD}Avg Project:{RESET}        {format_currency(value['avg_project_revenue'])}")
        print(f"  {BOLD}Projects:{RESET}           {value['project_count']}")
        print(f"  {BOLD}Total Hours:{RESET}        {value['total_hours']:.1f}h")
        print(f"  {BOLD}Effective Rate:{RESET}     {format_currency(value['effective_hourly_rate'])}/hr")
        print(f"  {BOLD}Projected LTV:{RESET}      {format_currency(value['projected_ltv'])}")

        # Projects
        if client.projects:
            print_section(f"Projects ({len(client.projects)})")
            for p in client.projects:
                status_icon = "✓" if p.get("status") == "completed" else "⏳" if p.get("status") == "active" else "✗"
                print(f"    {status_icon} {p.get('name', '?'):<30} {format_currency(p.get('revenue', 0)):>10}  {p.get('hours', 0):.1f}h  {p.get('start_date', '')}")

        # Red flags
        if client.red_flags:
            print_section(f"Red Flags ({len(client.red_flags)})")
            for f in client.red_flags:
                sev = "🔴" * f.get("severity", 1)
                print(f"    {sev} [{f.get('type', '?')}] {f.get('description', '')} — {f.get('date', '')}")

        # Recent communications
        if comms:
            recent = sorted(comms, key=lambda c: c.date, reverse=True)[:5]
            print_section(f"Recent Communications ({len(comms)} total)")
            for cm in recent:
                direction = "→" if cm.direction == "outbound" else "←"
                print(f"    {direction} {cm.date[:10]}  {cm.type:<10} {cm.subject}")

        # Referrals
        if client.referred_by:
            ref = self.store.get_client(client.referred_by)
            ref_name = ref.name if ref else client.referred_by
            print(f"\n  {BOLD}Referred by:{RESET} {ref_name}")
        if client.referrals:
            print(f"  {BOLD}Referred:{RESET}")
            for rid in client.referrals:
                ref = self.store.get_client(rid)
                ref_name = ref.name if ref else rid
                print(f"    → {ref_name}")

        print(f"\n  {DIM}Created: {client.created_at[:10]}  Updated: {client.updated_at[:10]}{RESET}\n")

    # --- LOG ---
    def cmd_log(self, args):
        """Log a communication event"""
        client = self.store.get_client(args.id)
        if not client:
            print(f"{RED}Client not found: {args.id}{RESET}")
            return

        print_header(f"Log Communication — {client.name}")

        print(f"  {DIM}Types: {', '.join(COMM_TYPES)}{RESET}")
        comm_type = input(f"  {BOLD}Type:{RESET} ").strip().lower() or "email"

        print(f"  {DIM}Directions: {', '.join(COMM_DIRECTIONS)}{RESET}")
        direction = input(f"  {BOLD}Direction:{RESET} ").strip().lower() or "outbound"

        subject = input(f"  {BOLD}Subject:{RESET} ").strip()
        summary = input(f"  {BOLD}Summary:{RESET} ").strip()

        date_str = input(f"  {BOLD}Date (YYYY-MM-DD, Enter for today):{RESET} ").strip()
        if not date_str:
            date_str = datetime.now().isoformat()

        follow_up = input(f"  {BOLD}Follow-up needed? (y/n):{RESET} ").strip().lower() == "y"
        follow_up_date = ""
        if follow_up:
            follow_up_date = input(f"  {BOLD}Follow-up date (YYYY-MM-DD):{RESET} ").strip()

        notes = input(f"  {BOLD}Notes:{RESET} ").strip()

        comm = Communication(
            id=uuid.uuid4().hex[:8],
            client_id=client.id,
            type=comm_type if comm_type in COMM_TYPES else "other",
            direction=direction if direction in COMM_DIRECTIONS else "outbound",
            subject=subject,
            summary=summary,
            date=date_str,
            follow_up_needed=follow_up,
            follow_up_date=follow_up_date,
            notes=notes,
        )

        self.store.add_communication(comm)
        print(f"\n{GREEN}✓ Communication logged for {client.name}{RESET}")

    def cmd_log_noninteractive(self, client_id: str, comm_type: str = "email",
                               direction: str = "outbound", subject: str = "",
                               summary: str = "", date_str: str = "",
                               follow_up: bool = False, follow_up_date: str = "",
                               notes: str = "") -> Optional[Communication]:
        """Log communication programmatically"""
        client = self.store.get_client(client_id)
        if not client:
            return None

        if not date_str:
            date_str = datetime.now().isoformat()

        comm = Communication(
            id=uuid.uuid4().hex[:8],
            client_id=client.id,
            type=comm_type if comm_type in COMM_TYPES else "other",
            direction=direction if direction in COMM_DIRECTIONS else "outbound",
            subject=subject, summary=summary, date=date_str,
            follow_up_needed=follow_up, follow_up_date=follow_up_date,
            notes=notes,
        )
        self.store.add_communication(comm)
        return comm

    # --- SCORE ---
    def cmd_score(self, args):
        """Show/recalculate relationship score for a client"""
        client = self.store.get_client(args.id)
        if not client:
            print(f"{RED}Client not found: {args.id}{RESET}")
            return

        comms = self.store.get_client_comms(client.id)
        result = self.scorer.calculate(client, comms)

        print_header(f"Score: {client.name}")
        print(f"  {format_score_bar(result['score'])}  Grade: {BOLD}{result['grade']}{RESET}")
        print()
        for k, v in result["factors"].items():
            label = k.replace("_", " ").title()
            weight = SCORING_WEIGHTS.get(k, 0) * 100
            color = GREEN if v >= 70 else YELLOW if v >= 40 else RED
            print(f"    {label:<25} {color}{v:>3}{RESET}/100  (weight: {weight:.0f}%)")
        print()
        for d in result["details"]:
            print(f"    {d}")
        print()

    # --- HEALTH ---
    def cmd_health(self, args):
        """Show relationship health dashboard"""
        clients = self.store.load_clients()
        if not clients:
            print(f"{YELLOW}No clients in CRM.{RESET}")
            return

        print_header("Relationship Health Dashboard")

        at_risk = []
        warnings = []
        healthy = []
        follow_ups = []

        for c in clients:
            last = self.store.get_last_contact(c.id)
            status = self.health.check_dormancy(c, last)

            entry = {"client": c, "status": status, "last": last}
            if status["status"] == "at_risk":
                at_risk.append(entry)
            elif status["status"] in ("warning", "no_contact"):
                warnings.append(entry)
            else:
                healthy.append(entry)

            # Check follow-ups
            comms = self.store.get_client_comms(c.id)
            for cm in comms:
                if cm.follow_up_needed and cm.follow_up_date:
                    try:
                        fu_date = datetime.fromisoformat(cm.follow_up_date)
                        if fu_date <= datetime.now() + timedelta(days=7):
                            follow_ups.append({"client": c, "comm": cm, "date": fu_date})
                    except ValueError:
                        pass

        # At-risk clients
        if at_risk:
            print(f"  {RED}{BOLD}🚨 AT RISK ({len(at_risk)}){RESET}")
            for e in at_risk:
                c = e["client"]
                s = e["status"]
                print(f"    {RED}●{RESET} {c.name:<25} {s.get('days', '?')} days  {s.get('action', '')}")
            print()

        # Warnings
        if warnings:
            print(f"  {YELLOW}{BOLD}⚠️  WARNINGS ({len(warnings)}){RESET}")
            for e in warnings:
                c = e["client"]
                s = e["status"]
                days = s.get("days", "?")
                print(f"    {YELLOW}◐{RESET} {c.name:<25} {days} days  {s.get('action', '')}")
            print()

        # Upcoming follow-ups
        if follow_ups:
            print(f"  {CYAN}{BOLD}📅 FOLLOW-UPS DUE ({len(follow_ups)}){RESET}")
            for e in sorted(follow_ups, key=lambda x: x["date"]):
                c = e["client"]
                cm = e["comm"]
                print(f"    {CYAN}→{RESET} {c.name:<25} {cm.follow_up_date[:10]}  re: {cm.subject}")
            print()

        # Summary
        total = len(clients)
        print(f"  {BOLD}Summary:{RESET} {GREEN}{len(healthy)} healthy{RESET}, {YELLOW}{len(warnings)} warning{RESET}, {RED}{len(at_risk)} at-risk{RESET} / {total} total")
        print()

    # --- DORMANT ---
    def cmd_dormant(self, args):
        """List clients needing attention (dormant or going dormant)"""
        clients = self.store.load_clients()
        if not clients:
            print(f"{YELLOW}No clients in CRM.{RESET}")
            return

        print_header("Clients Needing Attention")

        needs_attention = []
        for c in clients:
            last = self.store.get_last_contact(c.id)
            status = self.health.check_dormancy(c, last)
            if status["status"] in ("at_risk", "warning", "no_contact"):
                comms = self.store.get_client_comms(c.id)
                score = self.scorer.calculate(c, comms)["score"]
                needs_attention.append({"client": c, "status": status, "score": score})

        if not needs_attention:
            print(f"  {GREEN}✓ All client relationships are healthy!{RESET}\n")
            return

        needs_attention.sort(key=lambda x: x["status"].get("days") or 999, reverse=True)

        print(f"  {BOLD}{'Name':<25} {'Stage':<14} {'Days':>6} {'Score':>6} Action{RESET}")
        print(f"  {DIM}{'─' * 80}{RESET}")
        for e in needs_attention:
            c = e["client"]
            s = e["status"]
            days = str(s.get("days", "?"))
            indicator = format_health_indicator(s["status"])
            print(f"  {c.name:<25} {format_stage_badge(c.stage):<25} {days:>6} {e['score']:>5.0f}  {indicator}")
            if s.get("action"):
                print(f"  {DIM}  → {s['action']}{RESET}")

        print(f"\n  {BOLD}Total needing attention: {len(needs_attention)}{RESET}\n")

    # --- STATS ---
    def cmd_stats(self, args):
        """Portfolio-wide analytics"""
        clients = self.store.load_clients()
        comms = self.store.load_communications()

        if not clients:
            print(f"{YELLOW}No clients in CRM.{RESET}")
            return

        print_header("Portfolio Analytics")

        # Stage distribution
        stage_counts = {}
        for c in clients:
            stage_counts[c.stage] = stage_counts.get(c.stage, 0) + 1

        print_section("Client Stages")
        for stage in LIFECYCLE_STAGES:
            count = stage_counts.get(stage, 0)
            bar = "█" * count + "░" * max(0, 5 - count)
            print(f"    {format_stage_badge(stage):<25} {bar} {count}")

        # Revenue stats
        total_revenue = sum(c.total_revenue for c in clients)
        total_hours = sum(c.total_hours for c in clients)
        total_projects = sum(c.project_count for c in clients)
        avg_rate = total_revenue / total_hours if total_hours > 0 else 0

        print_section("Revenue")
        print(f"    {BOLD}Total Revenue:{RESET}       {format_currency(total_revenue)}")
        print(f"    {BOLD}Total Hours:{RESET}         {total_hours:.1f}h")
        print(f"    {BOLD}Total Projects:{RESET}      {total_projects}")
        print(f"    {BOLD}Avg Effective Rate:{RESET}  {format_currency(avg_rate)}/hr")

        # Top clients by revenue
        by_revenue = sorted(clients, key=lambda c: c.total_revenue, reverse=True)[:5]
        if any(c.total_revenue > 0 for c in by_revenue):
            print_section("Top Clients by Revenue")
            for c in by_revenue:
                if c.total_revenue > 0:
                    pct = (c.total_revenue / total_revenue * 100) if total_revenue > 0 else 0
                    print(f"    {c.name:<25} {format_currency(c.total_revenue):>10}  ({pct:.0f}%)")

        # Platform distribution
        platform_counts = {}
        platform_revenue = {}
        for c in clients:
            platform_counts[c.platform] = platform_counts.get(c.platform, 0) + 1
            platform_revenue[c.platform] = platform_revenue.get(c.platform, 0) + c.total_revenue

        print_section("Platforms")
        for p in sorted(platform_counts, key=lambda x: platform_revenue.get(x, 0), reverse=True):
            print(f"    {p:<15} {platform_counts[p]} clients  {format_currency(platform_revenue.get(p, 0))}")

        # Score distribution
        scores = []
        for c in clients:
            c_comms = self.store.get_client_comms(c.id)
            s = self.scorer.calculate(c, c_comms)["score"]
            scores.append(s)

        if scores:
            avg_score = sum(scores) / len(scores)
            print_section("Relationship Health")
            print(f"    {BOLD}Average Score:{RESET}  {avg_score:.0f}/100")
            print(f"    {GREEN}High (70+):{RESET}     {sum(1 for s in scores if s >= 70)}")
            print(f"    {YELLOW}Medium (40-69):{RESET} {sum(1 for s in scores if 40 <= s < 70)}")
            print(f"    {RED}Low (<40):{RESET}      {sum(1 for s in scores if s < 40)}")

        # Communication stats
        if comms:
            print_section("Communications")
            print(f"    {BOLD}Total Logged:{RESET}    {len(comms)}")
            type_counts = {}
            for cm in comms:
                type_counts[cm.type] = type_counts.get(cm.type, 0) + 1
            for t, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"    {t:<15} {count}")

        # Red flags
        total_flags = sum(c.red_flag_count for c in clients)
        if total_flags > 0:
            print_section("Red Flags")
            print(f"    {BOLD}Total:{RESET} {RED}{total_flags}{RESET}")
            flag_types = {}
            for c in clients:
                for f in c.red_flags:
                    ft = f.get("type", "other")
                    flag_types[ft] = flag_types.get(ft, 0) + 1
            for ft, count in sorted(flag_types.items(), key=lambda x: x[1], reverse=True):
                print(f"    {ft:<25} {count}")

        # Referral network
        referrals = [c for c in clients if c.referred_by]
        if referrals:
            ref_revenue = sum(c.total_revenue for c in referrals)
            print_section("Referral Network")
            print(f"    {BOLD}Referred Clients:{RESET}    {len(referrals)}")
            print(f"    {BOLD}Referral Revenue:{RESET}    {format_currency(ref_revenue)}")

        print()

    # --- EXPORT ---
    def cmd_export(self, args):
        """Export clients to CSV"""
        clients = self.store.load_clients()
        if not clients:
            print(f"{YELLOW}No clients to export.{RESET}")
            return

        output = getattr(args, "output", None) or "clients_export.csv"

        with open(output, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "id", "name", "company", "email", "phone", "platform",
                "stage", "industry", "budget_tier", "tags", "total_revenue",
                "total_hours", "project_count", "score", "notes",
                "created_at",
            ])
            for c in clients:
                comms = self.store.get_client_comms(c.id)
                score = self.scorer.calculate(c, comms)["score"]
                writer.writerow([
                    c.id, c.name, c.company, c.email, c.phone, c.platform,
                    c.stage, c.industry, c.budget_tier,
                    ";".join(c.tags), c.total_revenue, c.total_hours,
                    c.project_count, score, c.notes, c.created_at,
                ])

        print(f"{GREEN}✓ Exported {len(clients)} clients to {output}{RESET}")

    def export_to_string(self) -> str:
        """Export to CSV string (for testing)"""
        clients = self.store.load_clients()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "name", "company", "email", "phone", "platform",
            "stage", "industry", "budget_tier", "tags", "total_revenue",
            "total_hours", "project_count", "score", "notes", "created_at",
        ])
        for c in clients:
            comms = self.store.get_client_comms(c.id)
            score = self.scorer.calculate(c, comms)["score"]
            writer.writerow([
                c.id, c.name, c.company, c.email, c.phone, c.platform,
                c.stage, c.industry, c.budget_tier,
                ";".join(c.tags), c.total_revenue, c.total_hours,
                c.project_count, score, c.notes, c.created_at,
            ])
        return output.getvalue()

    # --- IMPORT ---
    def cmd_import(self, args):
        """Import clients from CSV"""
        filepath = args.file
        if not os.path.exists(filepath):
            print(f"{RED}File not found: {filepath}{RESET}")
            return

        count = 0
        with open(filepath, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tags = [t.strip() for t in row.get("tags", "").split(";") if t.strip()]
                self.cmd_add_noninteractive(
                    name=row.get("name", ""),
                    company=row.get("company", ""),
                    email=row.get("email", ""),
                    phone=row.get("phone", ""),
                    platform=row.get("platform", "direct"),
                    stage=row.get("stage", "lead"),
                    industry=row.get("industry", ""),
                    budget_tier=row.get("budget_tier", "mid"),
                    tags=tags,
                    notes=row.get("notes", ""),
                )
                count += 1

        print(f"{GREEN}✓ Imported {count} clients from {filepath}{RESET}")

    # --- EDIT ---
    def cmd_edit(self, args):
        """Edit a client interactively"""
        client = self.store.get_client(args.id)
        if not client:
            print(f"{RED}Client not found: {args.id}{RESET}")
            return

        print_header(f"Edit Client: {client.name}")
        print(f"  {DIM}Press Enter to keep current value{RESET}\n")

        name = input(f"  Name [{client.name}]: ").strip() or client.name
        company = input(f"  Company [{client.company}]: ").strip() or client.company
        email = input(f"  Email [{client.email}]: ").strip() or client.email
        phone = input(f"  Phone [{client.phone}]: ").strip() or client.phone
        platform = input(f"  Platform [{client.platform}]: ").strip().lower() or client.platform
        stage = input(f"  Stage [{client.stage}]: ").strip().lower() or client.stage
        industry = input(f"  Industry [{client.industry}]: ").strip() or client.industry
        budget = input(f"  Budget tier [{client.budget_tier}]: ").strip().lower() or client.budget_tier

        # Scoring factors
        print(f"\n  {BOLD}Scoring Factors (0-100):{RESET}")
        pr = input(f"  Payment reliability [{client.payment_reliability}]: ").strip()
        resp = input(f"  Responsiveness [{client.responsiveness}]: ").strip()
        cq = input(f"  Communication quality [{client.communication_quality}]: ").strip()
        rp = input(f"  Referral potential [{client.referral_potential}]: ").strip()

        client.name = name
        client.company = company
        client.email = email
        client.phone = phone
        client.platform = platform if platform in PLATFORMS else client.platform
        client.stage = stage if stage in LIFECYCLE_STAGES else client.stage
        client.industry = industry
        client.budget_tier = budget if budget in BUDGET_TIERS else client.budget_tier
        if pr:
            client.payment_reliability = max(0, min(100, int(pr)))
        if resp:
            client.responsiveness = max(0, min(100, int(resp)))
        if cq:
            client.communication_quality = max(0, min(100, int(cq)))
        if rp:
            client.referral_potential = max(0, min(100, int(rp)))

        self.store.update_client(client)
        print(f"\n{GREEN}✓ Client updated: {client.name}{RESET}")

    # --- DELETE ---
    def cmd_delete(self, args):
        """Delete a client"""
        client = self.store.get_client(args.id)
        if not client:
            print(f"{RED}Client not found: {args.id}{RESET}")
            return

        confirm = input(f"  Delete {BOLD}{client.name}{RESET}? (yes/no): ").strip().lower()
        if confirm != "yes":
            print(f"{YELLOW}Cancelled.{RESET}")
            return

        self.store.delete_client(client.id)
        print(f"{GREEN}✓ Client deleted: {client.name}{RESET}")

    # --- ADD PROJECT ---
    def add_project(self, client_id: str, name: str, revenue: float = 0,
                    hours: float = 0, start_date: str = "",
                    end_date: str = "", status: str = "completed",
                    notes: str = "") -> bool:
        """Add a project to a client"""
        client = self.store.get_client(client_id)
        if not client:
            return False

        if not start_date:
            start_date = datetime.now().strftime("%Y-%m-%d")

        project = {
            "name": name, "start_date": start_date, "end_date": end_date,
            "revenue": revenue, "hours": hours, "status": status, "notes": notes,
        }
        client.projects.append(project)
        self.store.update_client(client)
        return True

    # --- ADD RED FLAG ---
    def add_red_flag(self, client_id: str, flag_type: str,
                     description: str = "", severity: int = 1) -> bool:
        """Add a red flag to a client"""
        client = self.store.get_client(client_id)
        if not client:
            return False

        flag = {
            "type": flag_type if flag_type in RED_FLAG_TYPES else "other",
            "description": description,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "severity": max(1, min(5, severity)),
        }
        client.red_flags.append(flag)
        self.store.update_client(client)
        return True


# ---------------------------------------------------------------------------
# CLI Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="client_crm",
        description="Client CRM with Relationship Scoring for Freelancers",
    )
    sub = parser.add_subparsers(dest="command", help="Available commands")

    # add
    sub.add_parser("add", help="Add a new client interactively")

    # list
    p_list = sub.add_parser("list", help="List clients with filters")
    p_list.add_argument("--stage", help="Filter by lifecycle stage")
    p_list.add_argument("--tag", help="Filter by tag")
    p_list.add_argument("--platform", help="Filter by platform")
    p_list.add_argument("--score-min", type=float, help="Minimum score")
    p_list.add_argument("--score-max", type=float, help="Maximum score")

    # show
    p_show = sub.add_parser("show", help="Show detailed client profile")
    p_show.add_argument("id", help="Client ID or name")

    # log
    p_log = sub.add_parser("log", help="Log a communication event")
    p_log.add_argument("id", help="Client ID or name")

    # score
    p_score = sub.add_parser("score", help="Show/recalculate relationship score")
    p_score.add_argument("id", help="Client ID or name")

    # health
    sub.add_parser("health", help="Show relationship health dashboard")

    # dormant
    sub.add_parser("dormant", help="List clients needing attention")

    # stats
    sub.add_parser("stats", help="Portfolio-wide analytics")

    # export
    p_export = sub.add_parser("export", help="Export clients to CSV")
    p_export.add_argument("--output", "-o", default="clients_export.csv",
                          help="Output CSV file path")

    # import
    p_import = sub.add_parser("import", help="Import clients from CSV")
    p_import.add_argument("file", help="CSV file to import")

    # edit
    p_edit = sub.add_parser("edit", help="Edit a client")
    p_edit.add_argument("id", help="Client ID or name")

    # delete
    p_del = sub.add_parser("delete", help="Delete a client")
    p_del.add_argument("id", help="Client ID or name")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    app = CRMApp()

    commands = {
        "add": app.cmd_add,
        "list": app.cmd_list,
        "show": app.cmd_show,
        "log": app.cmd_log,
        "score": app.cmd_score,
        "health": app.cmd_health,
        "dormant": app.cmd_dormant,
        "stats": app.cmd_stats,
        "export": app.cmd_export,
        "import": app.cmd_import,
        "edit": app.cmd_edit,
        "delete": app.cmd_delete,
    }

    cmd_func = commands.get(args.command)
    if cmd_func:
        cmd_func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
