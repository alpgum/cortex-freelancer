#!/usr/bin/env python3
"""
Job Analyzer — AI-Powered Red Flag Detection with Scoring Algorithm
Helps freelancers evaluate job postings before applying.
"""

import json
import os
import re
import sys
import math
import argparse
from dataclasses import dataclass, asdict, field
from typing import Dict, List, Optional, Tuple
from enum import Enum

# Add the current directory to path to import siblings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from market_research import MarketResearchAPI


# ---------------------------------------------------------------------------
# Enums & Constants
# ---------------------------------------------------------------------------

class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

    def weight(self) -> float:
        return {"low": 1, "medium": 3, "high": 6, "critical": 10}[self.value]


class Verdict(str, Enum):
    APPLY = "apply"
    APPLY_WITH_CAUTION = "apply_with_caution"
    SKIP = "skip"


class JobType(str, Enum):
    FIXED_PRICE = "fixed_price"
    HOURLY = "hourly"
    RETAINER = "retainer"
    PROJECT_BASED = "project_based"


class DifficultyLevel(str, Enum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------

@dataclass
class RedFlag:
    """A single red flag found in a job posting."""
    category: str
    description: str
    severity: Severity
    evidence: str  # the text snippet that triggered it

    def to_dict(self) -> dict:
        d = asdict(self)
        d["severity"] = self.severity.value
        return d


@dataclass
class ScoreBreakdown:
    """Transparent scoring with per-dimension breakdown."""
    budget_adequacy: float = 0.0     # 0-100
    client_quality: float = 0.0      # 0-100
    scope_clarity: float = 0.0       # 0-100
    timeline_feasibility: float = 0.0  # 0-100
    overall: float = 0.0             # weighted composite

    # Weights (must sum to 1.0)
    WEIGHTS: dict = field(default_factory=lambda: {
        "budget_adequacy": 0.30,
        "client_quality": 0.25,
        "scope_clarity": 0.25,
        "timeline_feasibility": 0.20,
    })

    def compute_overall(self) -> float:
        w = self.WEIGHTS
        self.overall = round(
            self.budget_adequacy * w["budget_adequacy"]
            + self.client_quality * w["client_quality"]
            + self.scope_clarity * w["scope_clarity"]
            + self.timeline_feasibility * w["timeline_feasibility"],
            1,
        )
        return self.overall

    def to_dict(self) -> dict:
        return {
            "budget_adequacy": self.budget_adequacy,
            "client_quality": self.client_quality,
            "scope_clarity": self.scope_clarity,
            "timeline_feasibility": self.timeline_feasibility,
            "overall": self.overall,
            "weights": self.WEIGHTS,
        }


@dataclass
class JobClassification:
    """Classification metadata for a job posting."""
    job_type: JobType
    matched_skills: List[str]
    missing_skills: List[str]
    difficulty: DifficultyLevel
    estimated_hours: float       # our estimate
    client_claimed_hours: Optional[float]  # what client says

    def to_dict(self) -> dict:
        d = asdict(self)
        d["job_type"] = self.job_type.value
        d["difficulty"] = self.difficulty.value
        return d


@dataclass
class Recommendation:
    """Actionable recommendation for the freelancer."""
    verdict: Verdict
    suggested_rate: float
    questions_to_ask: List[str]
    negotiation_points: List[str]

    def to_dict(self) -> dict:
        d = asdict(self)
        d["verdict"] = self.verdict.value
        return d


@dataclass
class JobPosting:
    """Parsed job posting input."""
    title: str = ""
    description: str = ""
    budget: Optional[float] = None
    budget_type: str = "unknown"       # fixed, hourly, monthly
    timeline_days: Optional[int] = None
    skills_required: List[str] = field(default_factory=list)
    client_history: Optional[Dict] = None  # reviews, hire_rate, spend, etc.
    platform: str = "unknown"


@dataclass
class AnalysisResult:
    """Complete analysis output."""
    job: JobPosting
    red_flags: List[RedFlag]
    scores: ScoreBreakdown
    classification: JobClassification
    recommendation: Recommendation

    def to_dict(self) -> dict:
        return {
            "job": asdict(self.job),
            "red_flags": [rf.to_dict() for rf in self.red_flags],
            "scores": self.scores.to_dict(),
            "classification": self.classification.to_dict(),
            "recommendation": self.recommendation.to_dict(),
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


# ---------------------------------------------------------------------------
# Red-Flag Detector
# ---------------------------------------------------------------------------

class RedFlagDetector:
    """Scans job descriptions for warning signs."""

    # Patterns: (regex or keyword list, category, description template, severity)
    SCOPE_CREEP_PHRASES = [
        r"\band also\b", r"\bplus we need\b", r"\bon top of that\b",
        r"\bwhile you'?re at it\b", r"\boh and\b", r"\bas well as\b.*\bas well as\b",
        r"\balso need\b", r"\badditionally\b.*\badditionally\b",
    ]

    SPEC_WORK_PHRASES = [
        r"\bfree (test|trial|sample)\b", r"\bunpaid (test|trial)\b",
        r"\bspec work\b", r"\bdo a (test|trial) (first|project)\b",
        r"\bprove yourself\b", r"\bshow us what you can do (first|before)\b",
        r"\btest task\b.*\bno pay\b", r"\bwork for free\b",
    ]

    VAGUE_PHRASES = [
        r"\bsomething (like|similar)\b", r"\bmake it (pop|nice|good|cool)\b",
        r"\bi'?ll know (it )?when i see it\b", r"\bjust (do|make) (it|something)\b",
        r"\bsimple (website|app|project)\b", r"\bquick (and easy|job)\b",
        r"\bshould(n'?t| not) (take|be) (long|hard|difficult)\b",
    ]

    REVISION_PHRASES = [
        r"\bunlimited revisions?\b", r"\bas many (revisions?|changes) as\b",
        r"\buntil (i'?m |we'?re )?(happy|satisfied)\b",
        r"\bperfect(ion)?\b.*\brevision\b",
    ]

    COMMUNICATION_FLAGS = [
        r"\bASAP\b.*\bASAP\b",  # repeated urgency
        r"\bdo not (contact|message|call)\b",
        r"\bno questions\b",
    ]

    PAYMENT_RISK_PHRASES = [
        r"\bpay(ment)? (after|upon|once) (launch|completion|delivery|live)\b",
        r"\bno (escrow|milestone|upfront)\b",
        r"\bpay later\b", r"\brevenue shar(e|ing)\b",
        r"\bequity (only|instead)\b", r"\bexposure\b.*\bpay\b",
    ]

    TIMELINE_PHRASES = [
        r"\bneed(ed)? (by )?(today|tomorrow|tonight|asap)\b",
        r"\b(24|48) hours?\b", r"\bend of (day|week)\b",
        r"\bvery urgent\b", r"\bimmediately\b",
    ]

    def detect(self, job: JobPosting) -> List[RedFlag]:
        """Run all detectors and return list of red flags."""
        flags: List[RedFlag] = []
        text = f"{job.title} {job.description}".strip()
        text_lower = text.lower()

        flags.extend(self._check_patterns(text_lower, self.SCOPE_CREEP_PHRASES, "scope_creep",
                                          "Scope creep indicator detected", Severity.MEDIUM))
        flags.extend(self._check_patterns(text_lower, self.SPEC_WORK_PHRASES, "spec_work",
                                          "Unpaid test / spec work request", Severity.HIGH))
        flags.extend(self._check_patterns(text_lower, self.VAGUE_PHRASES, "vague_requirements",
                                          "Vague or unclear requirements", Severity.MEDIUM))
        flags.extend(self._check_patterns(text_lower, self.REVISION_PHRASES, "unlimited_revisions",
                                          "Excessive / unlimited revisions expected", Severity.HIGH))
        flags.extend(self._check_patterns(text_lower, self.COMMUNICATION_FLAGS, "communication",
                                          "Communication red flag", Severity.MEDIUM))
        flags.extend(self._check_patterns(text_lower, self.PAYMENT_RISK_PHRASES, "payment_risk",
                                          "Payment risk signal", Severity.CRITICAL))
        flags.extend(self._check_patterns(text_lower, self.TIMELINE_PHRASES, "unreasonable_timeline",
                                          "Unreasonable timeline", Severity.HIGH))

        # Budget analysis
        flags.extend(self._check_budget(job, text_lower))

        # Client history checks
        flags.extend(self._check_client_history(job))

        return flags

    # -- helpers --

    def _check_patterns(self, text: str, patterns: List[str], category: str,
                        desc: str, severity: Severity) -> List[RedFlag]:
        flags = []
        for pat in patterns:
            match = re.search(pat, text)
            if match:
                flags.append(RedFlag(
                    category=category,
                    description=desc,
                    severity=severity,
                    evidence=match.group(0),
                ))
        return flags

    def _check_budget(self, job: JobPosting, text: str) -> List[RedFlag]:
        flags = []
        if job.budget is not None and job.budget < 50 and "website" in text:
            flags.append(RedFlag("low_budget", "Budget appears unrealistically low for scope",
                                 Severity.HIGH, f"${job.budget} for website work"))
        if job.budget is not None and job.budget < 10:
            flags.append(RedFlag("low_budget", "Extremely low budget",
                                 Severity.CRITICAL, f"${job.budget}"))
        # Check for keywords suggesting large scope with small budget
        big_scope_words = ["full stack", "complete website", "mobile app",
                           "e-commerce", "saas", "platform", "marketplace"]
        if job.budget is not None and job.budget < 500:
            for w in big_scope_words:
                if w in text:
                    flags.append(RedFlag("low_budget",
                                         f"Budget too low for '{w}' scope",
                                         Severity.HIGH,
                                         f"${job.budget} for {w}"))
                    break  # one is enough
        return flags

    def _check_client_history(self, job: JobPosting) -> List[RedFlag]:
        flags = []
        ch = job.client_history
        if ch is None:
            flags.append(RedFlag("payment_risk", "No client history available",
                                 Severity.MEDIUM, "client_history is missing"))
            return flags

        if ch.get("total_spent", 0) == 0:
            flags.append(RedFlag("payment_risk", "Client has zero spend history",
                                 Severity.HIGH, "total_spent=0"))
        if ch.get("hire_rate", 100) < 20:
            flags.append(RedFlag("payment_risk",
                                 "Client rarely hires after posting jobs",
                                 Severity.MEDIUM,
                                 f"hire_rate={ch.get('hire_rate')}%"))
        avg_review = ch.get("avg_review", None)
        if avg_review is not None and avg_review < 3.5:
            flags.append(RedFlag("client_quality",
                                 "Client has poor freelancer reviews",
                                 Severity.HIGH,
                                 f"avg_review={avg_review}"))
        if ch.get("payment_verified", True) is False:
            flags.append(RedFlag("payment_risk", "Client payment method not verified",
                                 Severity.HIGH, "payment_verified=False"))
        return flags


# ---------------------------------------------------------------------------
# Scoring Engine
# ---------------------------------------------------------------------------

class ScoringEngine:
    """Compute a 0-100 score across multiple dimensions."""

    def __init__(self, benchmarks_path: Optional[str] = None):
        if benchmarks_path is None:
            benchmarks_path = os.path.join(
                os.path.dirname(__file__), '..', 'references', 'rate_benchmarks.json'
            )
        with open(benchmarks_path, 'r') as f:
            self.benchmarks = json.load(f)

    def score(self, job: JobPosting, red_flags: List[RedFlag],
              freelancer_skills: Optional[List[str]] = None) -> ScoreBreakdown:
        sb = ScoreBreakdown()
        sb.budget_adequacy = self._score_budget(job)
        sb.client_quality = self._score_client(job, red_flags)
        sb.scope_clarity = self._score_scope(job, red_flags)
        sb.timeline_feasibility = self._score_timeline(job, red_flags)
        sb.compute_overall()
        return sb

    # -- dimension scorers --

    def _score_budget(self, job: JobPosting) -> float:
        if job.budget is None:
            return 50.0  # unknown → neutral

        # Estimate market rate for the skills
        skill_key = self._map_skill(job.skills_required)
        skill_data = self.benchmarks["skill_categories"].get(skill_key, {})
        mid_median = skill_data.get("mid", {}).get("median", 50)

        if job.budget_type == "hourly":
            ratio = job.budget / mid_median if mid_median else 1.0
        else:
            # Fixed price: estimate hours then compare
            est_hours = self._estimate_hours_from_text(job.description, job.budget)
            effective_hourly = job.budget / max(est_hours, 1)
            ratio = effective_hourly / mid_median if mid_median else 1.0

        # Map ratio → 0-100
        if ratio >= 1.2:
            return min(100.0, 70 + ratio * 10)
        elif ratio >= 0.8:
            return 60 + (ratio - 0.8) * 100  # 60-100
        elif ratio >= 0.5:
            return 30 + (ratio - 0.5) * 100  # 30-60
        else:
            return max(0, ratio * 60)          # 0-30

    def _score_client(self, job: JobPosting, red_flags: List[RedFlag]) -> float:
        score = 70.0  # baseline

        ch = job.client_history
        if ch is None:
            return 40.0  # unknown client is risky

        # Positive signals
        if ch.get("total_spent", 0) > 10000:
            score += 15
        elif ch.get("total_spent", 0) > 1000:
            score += 8

        if ch.get("avg_review", 0) >= 4.5:
            score += 10
        elif ch.get("avg_review", 0) >= 4.0:
            score += 5

        if ch.get("hire_rate", 0) >= 50:
            score += 5

        if ch.get("payment_verified", False):
            score += 5

        # Negative: deduct for client-related red flags
        client_flags = [rf for rf in red_flags
                        if rf.category in ("payment_risk", "client_quality")]
        for rf in client_flags:
            score -= rf.severity.weight() * 2

        return max(0, min(100, round(score, 1)))

    def _score_scope(self, job: JobPosting, red_flags: List[RedFlag]) -> float:
        text = f"{job.title} {job.description}"
        score = 70.0

        # Longer descriptions tend to be clearer
        word_count = len(text.split())
        if word_count > 200:
            score += 10
        elif word_count > 100:
            score += 5
        elif word_count < 30:
            score -= 20

        # Has deliverables / requirements list?
        if re.search(r"(\d+[\.\)]\s|\-\s|•)", text):
            score += 10  # numbered or bulleted list

        # Has tech stack / specific tools mentioned?
        if len(job.skills_required) >= 3:
            score += 5

        # Deduct for scope-related flags
        scope_flags = [rf for rf in red_flags
                       if rf.category in ("scope_creep", "vague_requirements", "unlimited_revisions")]
        for rf in scope_flags:
            score -= rf.severity.weight() * 2.5

        return max(0, min(100, round(score, 1)))

    def _score_timeline(self, job: JobPosting, red_flags: List[RedFlag]) -> float:
        score = 75.0

        if job.timeline_days is not None:
            est_hours = self._estimate_hours_from_text(job.description, job.budget)
            # Assume 6 productive hours per day
            min_days = math.ceil(est_hours / 6)
            if job.timeline_days >= min_days * 1.5:
                score += 15  # generous timeline
            elif job.timeline_days >= min_days:
                score += 5
            elif job.timeline_days >= min_days * 0.5:
                score -= 15
            else:
                score -= 30

        timeline_flags = [rf for rf in red_flags if rf.category == "unreasonable_timeline"]
        for rf in timeline_flags:
            score -= rf.severity.weight() * 3

        return max(0, min(100, round(score, 1)))

    # -- helpers --

    def _map_skill(self, skills: List[str]) -> str:
        """Map a list of freeform skills to a benchmark category."""
        mapping = {
            "web_development": ["web", "html", "css", "javascript", "react", "vue",
                                "angular", "node", "php", "django", "flask", "wordpress",
                                "frontend", "backend", "full stack", "fullstack"],
            "mobile_app_development": ["ios", "android", "swift", "kotlin", "flutter",
                                       "react native", "mobile"],
            "data_science": ["data science", "data analysis", "pandas", "sql",
                             "tableau", "power bi", "analytics"],
            "ai_ml": ["machine learning", "ai", "deep learning", "tensorflow",
                       "pytorch", "nlp", "computer vision", "llm"],
            "digital_marketing": ["seo", "sem", "ppc", "google ads", "facebook ads",
                                  "marketing", "social media"],
            "copywriting": ["copywriting", "copy", "sales copy", "email copy"],
            "graphic_design": ["graphic design", "illustrator", "photoshop",
                               "figma", "ui", "ux", "ui/ux", "branding", "logo"],
            "video_editing": ["video", "premiere", "after effects", "final cut",
                              "animation", "motion graphics"],
            "content_writing": ["content writing", "blog", "article", "writing",
                                "technical writing"],
            "virtual_assistance": ["virtual assistant", "data entry", "admin",
                                   "executive assistant"],
        }
        skills_lower = [s.lower() for s in skills]
        best_cat = "web_development"
        best_count = 0
        for cat, keywords in mapping.items():
            count = sum(1 for kw in keywords if any(kw in s for s in skills_lower))
            if count > best_count:
                best_count = count
                best_cat = cat
        return best_cat

    def _estimate_hours_from_text(self, description: str, budget: Optional[float] = None) -> float:
        """Rough estimate of actual hours from description length and budget."""
        word_count = len(description.split())

        # Base estimate from description complexity
        if word_count < 50:
            base = 10
        elif word_count < 150:
            base = 25
        elif word_count < 300:
            base = 50
        else:
            base = 80

        # Adjust by scope keywords
        scope_multipliers = {
            "full stack": 1.5, "e-commerce": 1.4, "mobile app": 1.5,
            "saas": 2.0, "marketplace": 2.0, "platform": 1.8,
            "api": 1.2, "integration": 1.2, "database": 1.2,
            "dashboard": 1.3, "admin panel": 1.3, "authentication": 1.1,
        }
        desc_lower = description.lower()
        for kw, mult in scope_multipliers.items():
            if kw in desc_lower:
                base *= mult
                break  # only the highest impact one

        return round(base, 1)


# ---------------------------------------------------------------------------
# Job Classifier
# ---------------------------------------------------------------------------

class JobClassifier:
    """Classify job type, difficulty, skill match, and estimate hours."""

    DIFFICULTY_KEYWORDS = {
        DifficultyLevel.SENIOR: [
            "architect", "lead", "principal", "staff", "system design",
            "scalab", "microservices", "distributed", "enterprise",
            "performance optimization", "security audit",
        ],
        DifficultyLevel.MID: [
            "develop", "implement", "build", "integrate", "api",
            "database", "deploy", "test", "ci/cd",
        ],
        DifficultyLevel.JUNIOR: [
            "simple", "basic", "update", "fix", "change", "tweak",
            "landing page", "wordpress", "template", "bug fix",
        ],
    }

    JOB_TYPE_SIGNALS = {
        JobType.HOURLY: ["hourly", "per hour", "/hr", "hour rate"],
        JobType.RETAINER: ["retainer", "monthly", "ongoing", "long-term",
                           "per month", "weekly hours"],
        JobType.FIXED_PRICE: ["fixed price", "fixed budget", "project budget",
                              "total budget", "lump sum"],
    }

    def classify(self, job: JobPosting,
                 freelancer_skills: Optional[List[str]] = None) -> JobClassification:
        text_lower = f"{job.title} {job.description}".lower()

        job_type = self._detect_job_type(job, text_lower)
        difficulty = self._detect_difficulty(text_lower)
        matched, missing = self._match_skills(job.skills_required, freelancer_skills or [])
        est_hours = ScoringEngine()._estimate_hours_from_text(job.description, job.budget)

        # Client claimed hours
        claimed = self._extract_claimed_hours(text_lower)

        return JobClassification(
            job_type=job_type,
            matched_skills=matched,
            missing_skills=missing,
            difficulty=difficulty,
            estimated_hours=est_hours,
            client_claimed_hours=claimed,
        )

    def _detect_job_type(self, job: JobPosting, text: str) -> JobType:
        if job.budget_type == "hourly":
            return JobType.HOURLY
        for jt, keywords in self.JOB_TYPE_SIGNALS.items():
            if any(kw in text for kw in keywords):
                return jt
        return JobType.PROJECT_BASED

    def _detect_difficulty(self, text: str) -> DifficultyLevel:
        scores = {level: 0 for level in DifficultyLevel}
        for level, keywords in self.DIFFICULTY_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    scores[level] += 1
        best = max(scores, key=lambda k: scores[k])
        if scores[best] == 0:
            return DifficultyLevel.MID  # default
        return best

    def _match_skills(self, required: List[str],
                      freelancer: List[str]) -> Tuple[List[str], List[str]]:
        req_lower = {s.lower() for s in required}
        fl_lower = {s.lower() for s in freelancer}
        matched = sorted(req_lower & fl_lower)
        missing = sorted(req_lower - fl_lower)
        return matched, missing

    def _extract_claimed_hours(self, text: str) -> Optional[float]:
        patterns = [
            r"(\d+)\s*(?:hours?|hrs?)\b",
            r"(?:estimated?|approx(?:imately)?)\s*(\d+)\s*(?:hours?|hrs?)",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return float(m.group(1))
        return None


# ---------------------------------------------------------------------------
# Recommendation Engine
# ---------------------------------------------------------------------------

class RecommendationEngine:
    """Produce actionable recommendations from analysis."""

    def __init__(self, benchmarks_path: Optional[str] = None):
        if benchmarks_path is None:
            benchmarks_path = os.path.join(
                os.path.dirname(__file__), '..', 'references', 'rate_benchmarks.json'
            )
        with open(benchmarks_path, 'r') as f:
            self.benchmarks = json.load(f)

    def recommend(self, job: JobPosting, scores: ScoreBreakdown,
                  red_flags: List[RedFlag],
                  classification: JobClassification) -> Recommendation:
        verdict = self._decide_verdict(scores, red_flags)
        rate = self._suggest_rate(job, classification)
        questions = self._generate_questions(job, red_flags, classification)
        negotiation = self._generate_negotiation_points(job, red_flags, classification, rate)
        return Recommendation(
            verdict=verdict,
            suggested_rate=rate,
            questions_to_ask=questions,
            negotiation_points=negotiation,
        )

    def _decide_verdict(self, scores: ScoreBreakdown,
                        red_flags: List[RedFlag]) -> Verdict:
        critical_count = sum(1 for rf in red_flags if rf.severity == Severity.CRITICAL)
        high_count = sum(1 for rf in red_flags if rf.severity == Severity.HIGH)

        if critical_count >= 2 or scores.overall < 30:
            return Verdict.SKIP
        if critical_count >= 1 or high_count >= 3 or scores.overall < 50:
            return Verdict.APPLY_WITH_CAUTION
        if scores.overall >= 50:
            return Verdict.APPLY
        return Verdict.APPLY_WITH_CAUTION

    def _suggest_rate(self, job: JobPosting,
                      classification: JobClassification) -> float:
        skill_key = ScoringEngine()._map_skill(job.skills_required)
        skill_data = self.benchmarks["skill_categories"].get(skill_key, {})
        level = classification.difficulty.value
        level_data = skill_data.get(level, skill_data.get("mid", {}))
        median = level_data.get("median", 50)

        # Adjust for job type
        if classification.job_type == JobType.RETAINER:
            median *= 0.9  # slight discount for guaranteed work
        elif classification.job_type == JobType.FIXED_PRICE:
            median *= 1.1  # premium for fixed scope risk

        return round(median, 2)

    def _generate_questions(self, job: JobPosting, red_flags: List[RedFlag],
                            classification: JobClassification) -> List[str]:
        questions = []

        # Always relevant
        if job.budget is None:
            questions.append("What is the budget range for this project?")

        if job.timeline_days is None:
            questions.append("What is the expected timeline / deadline?")

        # Based on red flags
        flag_cats = {rf.category for rf in red_flags}
        if "vague_requirements" in flag_cats:
            questions.append("Can you provide a detailed list of deliverables and acceptance criteria?")
        if "scope_creep" in flag_cats:
            questions.append("Is the scope finalized, or are additional features expected?")
        if "payment_risk" in flag_cats:
            questions.append("Are you open to milestone-based payments with escrow?")
        if "unlimited_revisions" in flag_cats:
            questions.append("How many revision rounds are included in the project scope?")
        if "spec_work" in flag_cats:
            questions.append("Is the test task compensated? I'm happy to do a small paid trial.")
        if "unreasonable_timeline" in flag_cats:
            questions.append("Is the deadline flexible? The scope may require more time than estimated.")

        # Based on classification
        if classification.missing_skills:
            questions.append(
                f"I notice the role requires {', '.join(classification.missing_skills[:3])}. "
                "Is expertise in all listed skills mandatory?"
            )

        if (classification.client_claimed_hours is not None
                and classification.estimated_hours > classification.client_claimed_hours * 1.5):
            questions.append(
                f"You estimate ~{classification.client_claimed_hours:.0f} hours, "
                f"but similar projects typically take ~{classification.estimated_hours:.0f}. "
                "Can we discuss the scope in detail?"
            )

        return questions[:6]  # cap at 6

    def _generate_negotiation_points(self, job: JobPosting,
                                     red_flags: List[RedFlag],
                                     classification: JobClassification,
                                     suggested_rate: float) -> List[str]:
        points = []

        if job.budget is not None:
            effective_hourly = job.budget / max(classification.estimated_hours, 1)
            if effective_hourly < suggested_rate * 0.7:
                points.append(
                    f"Budget (${job.budget}) implies ~${effective_hourly:.0f}/hr — "
                    f"market rate is ${suggested_rate:.0f}/hr. Negotiate up or reduce scope."
                )

        if any(rf.category == "unlimited_revisions" for rf in red_flags):
            points.append("Cap revisions at 2-3 rounds; additional rounds billed hourly.")

        if classification.job_type == JobType.FIXED_PRICE:
            points.append("Include a change-order clause: scope changes beyond spec are billed separately.")

        if any(rf.category == "unreasonable_timeline" for rf in red_flags):
            points.append("Propose a phased delivery: MVP first, enhancements in follow-up sprints.")

        if any(rf.category == "payment_risk" for rf in red_flags):
            points.append("Request 30-50% upfront deposit or milestone escrow before starting.")

        if classification.difficulty == DifficultyLevel.SENIOR:
            points.append("Position your rate as senior-level — emphasize architecture and mentoring value.")

        return points[:5]


# ---------------------------------------------------------------------------
# Main Analyzer (Facade)
# ---------------------------------------------------------------------------

class JobAnalyzer:
    """Facade that orchestrates red-flag detection, scoring, classification,
    and recommendation into a single `analyze()` call."""

    def __init__(self, benchmarks_path: Optional[str] = None):
        if benchmarks_path is None:
            benchmarks_path = os.path.join(
                os.path.dirname(__file__), '..', 'references', 'rate_benchmarks.json'
            )
        self.detector = RedFlagDetector()
        self.scorer = ScoringEngine(benchmarks_path)
        self.classifier = JobClassifier()
        self.recommender = RecommendationEngine(benchmarks_path)

    def analyze(self, job: JobPosting,
                freelancer_skills: Optional[List[str]] = None) -> AnalysisResult:
        """Run full analysis on a job posting.

        Args:
            job: Parsed job posting.
            freelancer_skills: Optional list of the freelancer's skills for matching.

        Returns:
            AnalysisResult with red flags, scores, classification, and recommendation.
        """
        red_flags = self.detector.detect(job)
        scores = self.scorer.score(job, red_flags, freelancer_skills)
        classification = self.classifier.classify(job, freelancer_skills)
        recommendation = self.recommender.recommend(job, scores, red_flags, classification)
        return AnalysisResult(
            job=job,
            red_flags=red_flags,
            scores=scores,
            classification=classification,
            recommendation=recommendation,
        )

    @staticmethod
    def parse_description(text: str, **overrides) -> JobPosting:
        """Best-effort parser that extracts structured data from raw text.

        Override any field via keyword arguments.
        """
        title = overrides.get("title", "")
        if not title:
            # Use first line as title
            lines = text.strip().splitlines()
            title = lines[0].strip() if lines else "Untitled"

        budget = overrides.get("budget")
        if budget is None:
            m = re.search(r"\$\s?([\d,]+(?:\.\d+)?)", text)
            if m:
                budget = float(m.group(1).replace(",", ""))

        budget_type = overrides.get("budget_type", "unknown")
        if budget_type == "unknown":
            tl = text.lower()
            if "hourly" in tl or "/hr" in tl or "per hour" in tl:
                budget_type = "hourly"
            elif "fixed" in tl or "project budget" in tl:
                budget_type = "fixed"
            elif "month" in tl and "retainer" in tl:
                budget_type = "monthly"

        timeline_days = overrides.get("timeline_days")
        if timeline_days is None:
            m = re.search(r"(\d+)\s*(day|week|month)s?", text.lower())
            if m:
                num = int(m.group(1))
                unit = m.group(2)
                if unit == "week":
                    timeline_days = num * 7
                elif unit == "month":
                    timeline_days = num * 30
                else:
                    timeline_days = num

        skills = overrides.get("skills_required", [])
        if not skills:
            # Attempt extraction from "Skills:" section or common patterns
            sm = re.search(r"skills?\s*(?:required|needed)?:?\s*(.+?)(?:\n\n|\Z)", text, re.I | re.S)
            if sm:
                raw = sm.group(1)
                skills = [s.strip().strip("-•*") for s in re.split(r"[,\n]", raw) if s.strip()]

        return JobPosting(
            title=title,
            description=text,
            budget=budget,
            budget_type=budget_type,
            timeline_days=timeline_days,
            skills_required=skills[:20],
            client_history=overrides.get("client_history"),
            platform=overrides.get("platform", "unknown"),
        )


# ---------------------------------------------------------------------------
# Pretty Printer
# ---------------------------------------------------------------------------

def print_analysis(result: AnalysisResult) -> None:
    """Print a human-readable analysis report."""
    j = result.job
    s = result.scores
    c = result.classification
    r = result.recommendation

    print("\n" + "=" * 60)
    print(f"📋 JOB ANALYSIS: {j.title}")
    print("=" * 60)

    # Scores
    print(f"\n🎯 SCORE: {s.overall}/100")
    print(f"   Budget adequacy:     {s.budget_adequacy:5.1f}/100  (weight {s.WEIGHTS['budget_adequacy']:.0%})")
    print(f"   Client quality:      {s.client_quality:5.1f}/100  (weight {s.WEIGHTS['client_quality']:.0%})")
    print(f"   Scope clarity:       {s.scope_clarity:5.1f}/100  (weight {s.WEIGHTS['scope_clarity']:.0%})")
    print(f"   Timeline feasibility:{s.timeline_feasibility:5.1f}/100  (weight {s.WEIGHTS['timeline_feasibility']:.0%})")

    # Red Flags
    if result.red_flags:
        print(f"\n🚩 RED FLAGS ({len(result.red_flags)}):")
        severity_icons = {
            Severity.LOW: "🟡", Severity.MEDIUM: "🟠",
            Severity.HIGH: "🔴", Severity.CRITICAL: "💀",
        }
        for rf in sorted(result.red_flags, key=lambda x: -x.severity.weight()):
            icon = severity_icons.get(rf.severity, "⚪")
            print(f"   {icon} [{rf.severity.value.upper()}] {rf.description}")
            print(f"      Evidence: \"{rf.evidence}\"")
    else:
        print("\n✅ No red flags detected!")

    # Classification
    print(f"\n📂 CLASSIFICATION:")
    print(f"   Type:       {c.job_type.value}")
    print(f"   Difficulty: {c.difficulty.value}")
    print(f"   Est. hours: {c.estimated_hours:.0f}h"
          + (f"  (client claims {c.client_claimed_hours:.0f}h)" if c.client_claimed_hours else ""))
    if c.matched_skills:
        print(f"   Skills ✅:  {', '.join(c.matched_skills)}")
    if c.missing_skills:
        print(f"   Skills ❌:  {', '.join(c.missing_skills)}")

    # Verdict
    verdict_icons = {
        Verdict.APPLY: "✅ APPLY",
        Verdict.APPLY_WITH_CAUTION: "⚠️  APPLY WITH CAUTION",
        Verdict.SKIP: "❌ SKIP",
    }
    print(f"\n💡 VERDICT: {verdict_icons[r.verdict]}")
    print(f"   Suggested rate: ${r.suggested_rate:.0f}/hr")

    if r.questions_to_ask:
        print(f"\n❓ QUESTIONS TO ASK:")
        for q in r.questions_to_ask:
            print(f"   • {q}")

    if r.negotiation_points:
        print(f"\n🤝 NEGOTIATION POINTS:")
        for n in r.negotiation_points:
            print(f"   • {n}")

    print("\n" + "=" * 60)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Job Analyzer — AI-powered red flag detection & scoring for freelancers",
    )
    parser.add_argument("--description", "-d", type=str,
                        help="Job description text (or use --file)")
    parser.add_argument("--file", "-f", type=str,
                        help="Path to a file containing the job description")
    parser.add_argument("--title", "-t", type=str, default="",
                        help="Job title (optional, auto-detected from description)")
    parser.add_argument("--budget", type=float, default=None,
                        help="Stated budget ($)")
    parser.add_argument("--budget-type", choices=["hourly", "fixed", "monthly", "unknown"],
                        default="unknown", help="Budget type")
    parser.add_argument("--timeline-days", type=int, default=None,
                        help="Project timeline in days")
    parser.add_argument("--skills", nargs="*", default=[],
                        help="Required skills listed in the posting")
    parser.add_argument("--my-skills", nargs="*", default=[],
                        help="Your skills (for skill-match analysis)")
    parser.add_argument("--platform", default="unknown",
                        help="Platform (upwork, freelancer, fiverr, etc.)")
    parser.add_argument("--client-spend", type=float, default=None,
                        help="Client total historical spend ($)")
    parser.add_argument("--client-review", type=float, default=None,
                        help="Client average review (0-5)")
    parser.add_argument("--client-hire-rate", type=float, default=None,
                        help="Client hire rate (%%)")
    parser.add_argument("--client-verified", action="store_true", default=False,
                        help="Client payment verified")
    parser.add_argument("--json", action="store_true",
                        help="Output as JSON")

    args = parser.parse_args()

    # Get description
    if args.file:
        with open(args.file, 'r') as f:
            text = f.read()
    elif args.description:
        text = args.description
    else:
        print("Reading job description from stdin (paste text, then Ctrl-D):")
        text = sys.stdin.read()

    if not text.strip():
        print("Error: No job description provided.", file=sys.stderr)
        sys.exit(1)

    # Build client history
    client_history = None
    if any([args.client_spend is not None, args.client_review is not None,
            args.client_hire_rate is not None, args.client_verified]):
        client_history = {}
        if args.client_spend is not None:
            client_history["total_spent"] = args.client_spend
        if args.client_review is not None:
            client_history["avg_review"] = args.client_review
        if args.client_hire_rate is not None:
            client_history["hire_rate"] = args.client_hire_rate
        client_history["payment_verified"] = args.client_verified

    # Parse and analyze
    analyzer = JobAnalyzer()
    job = JobAnalyzer.parse_description(
        text,
        title=args.title,
        budget=args.budget,
        budget_type=args.budget_type,
        timeline_days=args.timeline_days,
        skills_required=args.skills,
        client_history=client_history,
        platform=args.platform,
    )

    result = analyzer.analyze(job, freelancer_skills=args.my_skills or None)

    if args.json:
        print(result.to_json())
    else:
        print_analysis(result)


if __name__ == "__main__":
    main()
