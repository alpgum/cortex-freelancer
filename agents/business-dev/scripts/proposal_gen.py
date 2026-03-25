#!/usr/bin/env python3
"""
Cortex Freelancer — Proposal Generator
Generates personalized freelance proposals based on job descriptions.
Selects the best template and fills in details from your profile.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


# Template selection keywords
TEMPLATE_MAP = {
    "web-dev-proposal.md": [
        "website", "web app", "web application", "frontend", "backend",
        "full-stack", "fullstack", "html", "css", "javascript", "react",
        "angular", "vue", "node", "django", "flask", "rails", "php",
        "wordpress", "shopify", "woocommerce", "laravel", "api", "rest",
        "graphql", "database", "sql", "postgresql", "mongodb",
    ],
    "mobile-dev-proposal.md": [
        "mobile app", "ios", "android", "react native", "flutter",
        "swift", "kotlin", "app store", "play store", "mobile",
        "cross-platform", "native app",
    ],
    "design-proposal.md": [
        "design", "logo", "branding", "ui", "ux", "figma", "photoshop",
        "illustrator", "graphic", "illustration", "icon", "banner",
        "flyer", "poster", "mockup", "wireframe", "prototype",
    ],
    "writing-proposal.md": [
        "writing", "content", "blog", "article", "copywriting", "copy",
        "ghostwriting", "ebook", "whitepaper", "press release",
        "newsletter", "email", "script", "creative writing",
    ],
    "seo-proposal.md": [
        "seo", "search engine", "digital marketing", "google ads",
        "facebook ads", "ppc", "social media", "marketing", "sem",
        "keyword", "backlink", "organic traffic", "analytics",
    ],
    "video-editing-proposal.md": [
        "video", "editing", "premiere", "after effects", "davinci",
        "youtube", "animation", "motion graphics", "color grading",
        "video production", "vfx",
    ],
    "translation-proposal.md": [
        "translation", "translate", "localization", "interpreter",
        "multilingual", "bilingual", "language", "arabic", "spanish",
        "french", "german", "turkish", "urdu",
    ],
    "data-entry-proposal.md": [
        "data entry", "virtual assistant", "administrative", "excel",
        "spreadsheet", "typing", "transcription", "data processing",
        "data collection", "lead generation", "research",
    ],
    "consulting-proposal.md": [
        "consulting", "consultant", "strategy", "advisor", "business",
        "management", "process", "optimization", "audit", "analysis",
    ],
}

# CF3-003: Industry detection for client research
INDUSTRY_SIGNALS = {
    "fintech": ["payment", "banking", "fintech", "crypto", "blockchain", "wallet", "trading", "forex", "lending"],
    "saas": ["saas", "subscription", "dashboard", "multi-tenant", "onboarding", "churn", "mrr", "b2b"],
    "ecommerce": ["ecommerce", "e-commerce", "store", "shopify", "woocommerce", "cart", "checkout", "inventory"],
    "healthcare": ["health", "medical", "hipaa", "patient", "telemedicine", "ehr", "clinical"],
    "education": ["edtech", "learning", "course", "lms", "student", "education", "training"],
    "marketplace": ["marketplace", "two-sided", "buyer", "seller", "listing", "matching", "booking"],
    "ai": ["ai", "machine learning", "ml", "nlp", "gpt", "chatbot", "automation", "llm"],
}

COMPANY_STAGE_SIGNALS = {
    "early_stage": ["mvp", "prototype", "idea", "validate", "seed", "bootstrapped", "first version", "co-founder"],
    "growth": ["scaling", "series a", "series b", "growing team", "expanding", "traction", "revenue"],
    "established": ["enterprise", "fortune 500", "established", "compliance", "legacy", "migration", "mature"],
    "agency": ["agency", "our client", "white label", "retainer", "deliverables"],
}

PAIN_POINT_PATTERNS = [
    r"(?:struggling|problem|issue|challenge)\w*\s+(?:with\s+)?([^.!?\n]{10,80})",
    r"(?:need|want|looking for)\s+(?:someone|help)\s+(?:to|who can)\s+([^.!?\n]{10,80})",
    r"(?:current|existing)\s+(?:solution|system)\s+(?:is|doesn't|can't)\s+([^.!?\n]{10,60})",
]


def detect_industry(job_description: str) -> dict:
    """Detect client industry from job description."""
    text = job_description.lower()
    best_industry = None
    best_score = 0
    best_signals = []

    for industry, signals in INDUSTRY_SIGNALS.items():
        matched = [s for s in signals if s in text]
        if len(matched) > best_score:
            best_score = len(matched)
            best_industry = industry
            best_signals = matched

    return {
        "industry": best_industry,
        "confidence": min(best_score * 25, 100) if best_score else 0,
        "signals": best_signals,
    }


def detect_company_stage(job_description: str) -> dict:
    """Detect company stage from job description."""
    text = job_description.lower()
    best_stage = None
    best_score = 0
    best_signals = []

    for stage, signals in COMPANY_STAGE_SIGNALS.items():
        matched = [s for s in signals if s in text]
        if len(matched) > best_score:
            best_score = len(matched)
            best_stage = stage
            best_signals = matched

    return {
        "stage": best_stage,
        "confidence": min(best_score * 30, 100) if best_score else 0,
        "signals": best_signals,
    }


def extract_pain_points(job_description: str) -> list:
    """Extract client pain points from job description."""
    pain_points = []
    for pattern in PAIN_POINT_PATTERNS:
        for match in re.finditer(pattern, job_description, re.IGNORECASE):
            text = match.group(1).strip()
            if len(text) > 5 and text not in pain_points:
                pain_points.append(text)
    return pain_points[:5]


def build_client_intelligence(job_description: str) -> dict:
    """Build full client intelligence report."""
    return {
        "industry": detect_industry(job_description),
        "company_stage": detect_company_stage(job_description),
        "pain_points": extract_pain_points(job_description),
        "details": extract_key_details(job_description),
    }


DEFAULT_PROFILE = {
    "name": "Alex",
    "title": "Full-Stack Developer",
    "years_experience": 5,
    "skills": ["Python", "Django", "React", "Node.js", "PostgreSQL"],
    "hourly_rate": 35,
    "timezone": "UTC+2",
    "platform_rating": 4.9,
    "jobs_completed": 47,
    "jss": 96,
    "portfolio": [
        {
            "name": "E-commerce Platform",
            "url": "https://portfolio.example.com/ecommerce",
            "description": "Built a full-stack e-commerce platform handling 5K daily orders",
        },
        {
            "name": "SaaS Dashboard",
            "url": "https://portfolio.example.com/saas",
            "description": "React + Django REST API dashboard for analytics startup",
        },
    ],
}


def load_profile(profile_path: str) -> dict:
    """Load freelancer profile from JSON file."""
    if profile_path and os.path.exists(profile_path):
        with open(profile_path, "r") as f:
            return json.load(f)
    return DEFAULT_PROFILE


def detect_category(job_description: str) -> str:
    """Detect job category from description and return best template name."""
    text = job_description.lower()
    scores = {}

    for template, keywords in TEMPLATE_MAP.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[template] = score

    if scores:
        return max(scores, key=scores.get)
    return "web-dev-proposal.md"  # Default fallback


def load_template(template_name: str) -> str:
    """Load a template file from the templates directory."""
    # Try relative to this script
    script_dir = Path(__file__).parent.parent / "templates"
    template_path = script_dir / template_name

    if template_path.exists():
        return template_path.read_text()

    # Try current directory
    local_path = Path("templates") / template_name
    if local_path.exists():
        return local_path.read_text()

    return None


def extract_key_details(job_description: str) -> dict:
    """Extract key details from job description for personalization."""
    details = {
        "technologies": [],
        "budget_mentioned": None,
        "timeline_mentioned": None,
        "key_requirements": [],
    }

    # Detect technologies
    tech_keywords = [
        "python", "django", "flask", "react", "angular", "vue", "node",
        "javascript", "typescript", "php", "laravel", "wordpress", "shopify",
        "swift", "kotlin", "flutter", "react native", "aws", "docker",
        "postgresql", "mongodb", "mysql", "redis", "graphql", "rest api",
        "figma", "photoshop", "illustrator", "premiere", "after effects",
    ]
    text_lower = job_description.lower()
    for tech in tech_keywords:
        if tech in text_lower:
            details["technologies"].append(tech.title())

    # Detect budget
    budget_match = re.search(r'\$([0-9,]+(?:\.[0-9]+)?)', job_description)
    if budget_match:
        details["budget_mentioned"] = budget_match.group(0)

    # Detect timeline
    timeline_patterns = [
        r'(\d+\s*(?:week|month|day)s?)',
        r'(asap|urgent|immediately|rush)',
        r'(deadline[:\s]+[^\n.]+)',
    ]
    for pattern in timeline_patterns:
        match = re.search(pattern, job_description, re.IGNORECASE)
        if match:
            details["timeline_mentioned"] = match.group(1)
            break

    return details


def generate_short_proposal(job_description: str, profile: dict, template_name: str, intelligence: dict = None) -> str:
    """Generate a short proposal variant with optional client intelligence."""
    details = extract_key_details(job_description)
    intel = intelligence or {}
    name = profile.get("name", "Alex")
    skills = profile.get("skills", [])
    portfolio = profile.get("portfolio", [])
    experience = profile.get("years_experience", 3)

    # Pick first relevant portfolio item
    portfolio_item = portfolio[0] if portfolio else {"name": "a similar project", "url": "[portfolio link]"}

    tech_mention = ", ".join(details["technologies"][:3]) if details["technologies"] else ", ".join(skills[:3])

    # Extract a specific detail from the job description (first sentence or key phrase)
    first_line = job_description.strip().split("\n")[0][:100]

    # CF3-003: Add personalized hook based on client intelligence
    personalized_hook = ""
    if intel.get("pain_points"):
        top_pain = intel["pain_points"][0]
        personalized_hook = f"\n\nI noticed you're dealing with {top_pain} — I've solved exactly this kind of problem before and can walk you through my approach."
    elif intel.get("industry", {}).get("industry"):
        ind = intel["industry"]["industry"].replace("_", " ")
        personalized_hook = f"\n\nI have direct experience in the {ind} space, so I understand the specific requirements and constraints you're working with."

    proposal = f"""Hi,

I read your post about {first_line.lower().rstrip('.')} — this is right in my wheelhouse. I've been working with {tech_mention} for {experience} years and built something very similar recently: {portfolio_item['name']}.{personalized_hook}

Here's that project: {portfolio_item.get('url', '[portfolio link]')}

I can start this week. Want me to share my approach?

{name}"""

    return proposal


def generate_detailed_proposal(job_description: str, profile: dict, template_name: str, intelligence: dict = None) -> str:
    """Generate a detailed proposal variant with optional client intelligence."""
    details = extract_key_details(job_description)
    intel = intelligence or {}
    name = profile.get("name", "Alex")
    skills = profile.get("skills", [])
    portfolio = profile.get("portfolio", [])
    experience = profile.get("years_experience", 3)
    rating = profile.get("platform_rating", 4.8)
    jobs_done = profile.get("jobs_completed", 20)
    jss = profile.get("jss", 90)

    tech_mention = ", ".join(details["technologies"][:4]) if details["technologies"] else ", ".join(skills[:4])
    portfolio_item = portfolio[0] if portfolio else {"name": "a similar project", "url": "[link]", "description": "similar scope and requirements"}

    first_line = job_description.strip().split("\n")[0][:100]

    # CF3-003: Build personalized sections from client intelligence
    personalized_opener = ""
    if intel.get("pain_points"):
        top_pain = intel["pain_points"][0]
        personalized_opener = f"\n\nI specifically noticed your challenge with {top_pain} — I've tackled this exact problem before and have a proven approach."

    industry_hook = ""
    ind_info = intel.get("industry", {})
    if ind_info.get("industry"):
        ind_name = ind_info["industry"].replace("_", " ")
        industry_hook = f"\n\nWith dedicated experience in the {ind_name} space, I understand the domain-specific requirements, compliance needs, and user expectations that come with this territory."

    stage_hook = ""
    stage_info = intel.get("company_stage", {})
    stage_hooks = {
        "early_stage": "\nI thrive with early-stage teams — fast iteration, flexible scope, and shipping MVPs that actually validate hypotheses.",
        "growth": "\nI understand the growth-stage challenge: building for scale without slowing down. I've helped similar companies navigate this transition.",
        "established": "\nI bring enterprise-grade discipline — proper documentation, testing, change management, and compliance awareness built into every deliverable.",
        "agency": "\nI've partnered with agencies before — I know the workflow: clear deliverables, fast turnaround, reliable communication.",
    }
    if stage_info.get("stage") in stage_hooks:
        stage_hook = stage_hooks[stage_info["stage"]]

    proposal = f"""Hi,

Your project caught my attention — specifically the requirement around {first_line.lower().rstrip('.')}. I've built {jobs_done}+ projects using {tech_mention} over the past {experience} years, and I know the common challenges that come with this kind of work.{personalized_opener}

**Why I'm the right fit:**

I recently completed {portfolio_item['name']}, which had very similar requirements:
- {portfolio_item.get('description', 'Similar scope and technical requirements')}
- Delivered on time with zero post-launch critical bugs
- Client rated the project 5 stars

You can see it here: {portfolio_item.get('url', '[portfolio link]')}{industry_hook}{stage_hook}

**My approach for your project:**

1. **Day 1-2:** Review your requirements in detail, ask clarifying questions, and provide a technical scope document
2. **Week 1-2:** Core development with progress updates every 2-3 days
3. **Final week:** Testing, refinements, and clean handoff with documentation

**What I include:**
- Clean, well-documented code
- Post-delivery bug support (30 days)
- Regular progress updates — you'll never have to chase me

I maintain a {jss}% Job Success Score across {jobs_done} projects on this platform, with a {rating}-star rating. My clients come back because I communicate proactively and deliver quality work on time.

Want me to share a more detailed technical breakdown specific to your project? I can have it ready within 24 hours.

{name}"""

    return proposal


def main():
    parser = argparse.ArgumentParser(
        description="Cortex Freelancer — Proposal Generator. Creates personalized proposals for freelance jobs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --job "Build a REST API with Django and PostgreSQL"
  %(prog)s --job "Need a logo designer for startup" --profile my_profile.json
  %(prog)s --job-file job_description.txt --profile profile.json --output proposal.md

Profile JSON format:
  {
    "name": "Your Name",
    "title": "Your Title",
    "years_experience": 5,
    "skills": ["Python", "Django", "React"],
    "hourly_rate": 35,
    "platform_rating": 4.9,
    "jobs_completed": 47,
    "jss": 96,
    "portfolio": [
      {"name": "Project Name", "url": "https://...", "description": "What you did"}
    ]
  }
        """
    )
    parser.add_argument("--job", type=str,
                        help="Job description text (in quotes)")
    parser.add_argument("--job-file", type=str,
                        help="Path to file containing job description")
    parser.add_argument("--profile", type=str, default=None,
                        help="Path to freelancer profile JSON (default: built-in sample)")
    parser.add_argument("--output", type=str, default=None,
                        help="Output file path (default: print to stdout)")
    parser.add_argument("--variant", choices=["both", "short", "detailed"], default="both",
                        help="Which variant to generate (default: both)")

    args = parser.parse_args()

    # Get job description
    if args.job:
        job_desc = args.job
    elif args.job_file:
        if not os.path.exists(args.job_file):
            print(f"Error: File not found: {args.job_file}")
            sys.exit(1)
        with open(args.job_file, "r") as f:
            job_desc = f.read()
    else:
        print("Error: Provide --job or --job-file")
        parser.print_help()
        sys.exit(1)

    # Load profile
    profile = load_profile(args.profile)
    if args.profile and not os.path.exists(args.profile):
        print(f"Warning: Profile file '{args.profile}' not found. Using default profile.\n")

    # Detect category
    template_name = detect_category(job_desc)
    category = template_name.replace("-proposal.md", "").replace("-", " ").title()

    # CF3-003: Build client intelligence
    intelligence = build_client_intelligence(job_desc)
    ind_info = intelligence["industry"]
    stage_info = intelligence["company_stage"]

    print(f"{'='*60}")
    print(f" PROPOSAL GENERATOR (CF3-003 Enhanced)")
    print(f"{'='*60}")
    print(f" Category detected: {category}")
    print(f" Template: {template_name}")
    print(f" Profile: {profile.get('name', 'Unknown')} — {profile.get('title', 'Freelancer')}")
    if ind_info.get("industry"):
        print(f" Industry: {ind_info['industry']} ({ind_info['confidence']}% confidence)")
    if stage_info.get("stage"):
        print(f" Company Stage: {stage_info['stage']} ({stage_info['confidence']}% confidence)")
    if intelligence["pain_points"]:
        print(f" Pain Points: {len(intelligence['pain_points'])} detected")
    print(f"{'='*60}\n")

    output_parts = []

    if args.variant in ("both", "short"):
        short = generate_short_proposal(job_desc, profile, template_name, intelligence)
        output_parts.append("## SHORT VARIANT (Quick Bid)\n")
        output_parts.append(short)
        output_parts.append("\n")

    if args.variant in ("both", "detailed"):
        detailed = generate_detailed_proposal(job_desc, profile, template_name, intelligence)
        output_parts.append("## DETAILED VARIANT (Big Project)\n")
        output_parts.append(detailed)

    full_output = "\n".join(output_parts)

    if args.output:
        with open(args.output, "w") as f:
            f.write(full_output)
        print(f"Proposal saved to: {args.output}")
    else:
        print(full_output)

    print(f"\n{'='*60}")
    print(f" Tip: Customize the [bracketed sections] before sending!")
    print(f" Tip: Always reference something specific from the job post.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
