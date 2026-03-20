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


def generate_short_proposal(job_description: str, profile: dict, template_name: str) -> str:
    """Generate a short proposal variant."""
    details = extract_key_details(job_description)
    name = profile.get("name", "Alex")
    skills = profile.get("skills", [])
    portfolio = profile.get("portfolio", [])
    experience = profile.get("years_experience", 3)

    # Pick first relevant portfolio item
    portfolio_item = portfolio[0] if portfolio else {"name": "a similar project", "url": "[portfolio link]"}

    tech_mention = ", ".join(details["technologies"][:3]) if details["technologies"] else ", ".join(skills[:3])

    # Extract a specific detail from the job description (first sentence or key phrase)
    first_line = job_description.strip().split("\n")[0][:100]

    proposal = f"""Hi,

I read your post about {first_line.lower().rstrip('.')} — this is right in my wheelhouse. I've been working with {tech_mention} for {experience} years and built something very similar recently: {portfolio_item['name']}.

Here's that project: {portfolio_item.get('url', '[portfolio link]')}

I can start this week. Want me to share my approach?

{name}"""

    return proposal


def generate_detailed_proposal(job_description: str, profile: dict, template_name: str) -> str:
    """Generate a detailed proposal variant."""
    details = extract_key_details(job_description)
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

    proposal = f"""Hi,

Your project caught my attention — specifically the requirement around {first_line.lower().rstrip('.')}. I've built {jobs_done}+ projects using {tech_mention} over the past {experience} years, and I know the common challenges that come with this kind of work.

**Why I'm the right fit:**

I recently completed {portfolio_item['name']}, which had very similar requirements:
- {portfolio_item.get('description', 'Similar scope and technical requirements')}
- Delivered on time with zero post-launch critical bugs
- Client rated the project 5 stars

You can see it here: {portfolio_item.get('url', '[portfolio link]')}

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

    print(f"{'='*60}")
    print(f" PROPOSAL GENERATOR")
    print(f"{'='*60}")
    print(f" Category detected: {category}")
    print(f" Template: {template_name}")
    print(f" Profile: {profile.get('name', 'Unknown')} — {profile.get('title', 'Freelancer')}")
    print(f"{'='*60}\n")

    output_parts = []

    if args.variant in ("both", "short"):
        short = generate_short_proposal(job_desc, profile, template_name)
        output_parts.append("## SHORT VARIANT (Quick Bid)\n")
        output_parts.append(short)
        output_parts.append("\n")

    if args.variant in ("both", "detailed"):
        detailed = generate_detailed_proposal(job_desc, profile, template_name)
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
