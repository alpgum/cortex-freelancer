#!/usr/bin/env python3
"""
Cortex Freelancer — Platform Optimizer
Score and optimize freelancer profiles on various platforms.

Usage:
    python3 platform_optimizer.py --platform upwork
    python3 platform_optimizer.py --platform upwork --profile ../../data/profile.json
"""

import argparse
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "..", "..", "data")
DEFAULT_PROFILE = os.path.join(DATA_DIR, "profile.json")

PLATFORM_GUIDELINES = {
    "upwork": {
        "name": "Upwork",
        "headline_max": 70,
        "overview_min_words": 100,
        "overview_max_words": 1000,
        "skills_min": 5,
        "skills_max": 15,
        "portfolio_min": 3,
        "sections": {
            "headline": {
                "weight": 0.25,
                "tips": [
                    "Lead with specialty: 'Python/Django API Specialist' > 'Full-Stack Developer'",
                    "Include 1-2 key technologies clients search for",
                    "Add a result: 'Python Developer | 50+ APIs Built | 99% Job Success'",
                ],
            },
            "overview": {
                "weight": 0.30,
                "tips": [
                    "First 2 lines visible in search — make them count",
                    "Structure: Problem > Solution > Proof > CTA",
                    "Add 2-3 measurable results",
                ],
            },
            "skills": {
                "weight": 0.20,
                "tips": [
                    "10-15 skills optimal for search matching",
                    "Put top 3 revenue-generating skills first",
                    "Mix specific (Django) and broad (API Development)",
                ],
            },
            "portfolio": {
                "weight": 0.25,
                "tips": [
                    "Minimum 3 items with screenshots and descriptions",
                    "Lead with highest-value project",
                    "Include tech used and measurable outcomes",
                ],
            },
        },
    },
    "toptal": {
        "name": "Toptal",
        "headline_max": 100,
        "overview_min_words": 60,
        "overview_max_words": 600,
        "skills_min": 5,
        "skills_max": 20,
        "portfolio_min": 3,
        "sections": {
            "headline": {
                "weight": 0.20,
                "tips": [
                    "Position as specialist with years + domain focus",
                    "Example: 'Senior Python Engineer | 8 Years | FinTech & SaaS'",
                ],
            },
            "overview": {
                "weight": 0.35,
                "tips": [
                    "Emphasize depth over breadth — Toptal clients expect senior talent",
                    "Mention specific companies or industries",
                    "Quantify scale: users, transactions, team size",
                ],
            },
            "skills": {
                "weight": 0.20,
                "tips": [
                    "Be specific: 'PostgreSQL' not just 'SQL'",
                    "Include methodologies: Agile, TDD, CI/CD",
                ],
            },
            "portfolio": {
                "weight": 0.25,
                "tips": [
                    "Focus on complex, large-scale projects",
                    "Describe specific role and contributions",
                ],
            },
        },
    },
    "fiverr": {
        "name": "Fiverr",
        "headline_max": 60,
        "overview_min_words": 30,
        "overview_max_words": 250,
        "skills_min": 3,
        "skills_max": 10,
        "portfolio_min": 3,
        "sections": {
            "headline": {
                "weight": 0.25,
                "tips": [
                    "Frame as deliverable: 'I will build your REST API in Python/Django'",
                    "Use action verbs: build, create, design, develop, fix",
                ],
            },
            "overview": {
                "weight": 0.30,
                "tips": [
                    "Keep concise — Fiverr buyers scan quickly",
                    "Focus on what they GET, not your background",
                    "Use bullet points for deliverables",
                ],
            },
            "skills": {
                "weight": 0.20,
                "tips": [
                    "Match Fiverr's tag system exactly",
                    "Use popular search tags in your niche",
                ],
            },
            "portfolio": {
                "weight": 0.25,
                "tips": [
                    "Thumbnails matter more on Fiverr than anywhere else",
                    "Include video introductions — they boost conversion",
                ],
            },
        },
    },
}


def load_profile(profile_path):
    """Load profile data from JSON file."""
    if not os.path.exists(profile_path):
        return None
    with open(profile_path, "r") as f:
        return json.load(f)


def create_sample_profile(profile_path):
    """Create a sample profile.json for the user to fill in."""
    os.makedirs(os.path.dirname(profile_path), exist_ok=True)
    sample = {
        "headline": "Full-Stack Developer | Python, React, Node.js",
        "overview": "I am a full-stack developer with 5 years of experience...",
        "skills": ["Python", "Django", "React", "Node.js", "PostgreSQL"],
        "portfolio": [
            {"title": "E-commerce Platform", "description": "Built a full e-commerce solution", "tech": ["Python", "Django", "React"]},
        ],
        "hourly_rate": 45,
        "job_success_score": 0,
        "total_earned": 0,
        "completed_jobs": 0,
    }
    with open(profile_path, "w") as f:
        json.dump(sample, f, indent=2)
    return sample


def score_headline(headline, guidelines):
    """Score the headline section 0-10."""
    score = 0
    suggestions = []

    if not headline:
        return 0, ["Missing headline — this is your most visible element"]

    length = len(headline)
    if length <= guidelines["headline_max"]:
        score += 3
    else:
        score += 1
        suggestions.append(f"Headline is {length} chars — trim to {guidelines['headline_max']}")

    tech_keywords = ["python", "react", "django", "node", "java", "api", "fullstack",
                     "full-stack", "frontend", "backend", "mobile", "devops", "cloud",
                     "aws", "data", "ml", "ai", "blockchain", "wordpress"]
    found_tech = [kw for kw in tech_keywords if kw in headline.lower()]
    if found_tech:
        score += 3
    else:
        score += 1
        suggestions.append("Add specific technologies clients search for")

    if any(c.isdigit() for c in headline):
        score += 2
    else:
        suggestions.append("Add a number: years experience, projects completed, or success rate")

    generic = ["developer", "programmer", "coder", "expert", "guru", "ninja"]
    if any(g in headline.lower() for g in generic) and not found_tech:
        score += 1
        suggestions.append("Too generic — replace with your specific niche")
    else:
        score += 2

    return min(round(score), 10), suggestions


def score_overview(overview, guidelines):
    """Score the overview/bio section 0-10."""
    score = 0
    suggestions = []

    if not overview:
        return 0, ["Missing overview — this is your main sales pitch"]

    word_count = len(overview.split())

    if word_count >= guidelines["overview_min_words"]:
        score += 2
    else:
        suggestions.append(f"Too short ({word_count} words). Aim for {guidelines['overview_min_words']}+")

    if any(c in overview for c in ["-", "•", "*"]):
        score += 2
    else:
        suggestions.append("Add bullet points — clients scan, not read")

    if overview.count("\n") >= 2:
        score += 1
    else:
        suggestions.append("Break into paragraphs: Hook > Experience > Services > CTA")

    if re.search(r'\d+[%xX]|\$\d+|\d+\+?\s*(years?|projects?|clients?|apps?)', overview):
        score += 3
    else:
        suggestions.append("Add measurable results: '50+ projects', 'reduced costs by 40%'")

    cta_words = ["contact", "message", "reach out", "let's talk", "discuss", "get in touch"]
    if any(cta in overview.lower() for cta in cta_words):
        score += 2
    else:
        suggestions.append("End with a call-to-action: 'Message me to discuss your project'")

    return min(round(score), 10), suggestions


def score_skills(skills_list, guidelines):
    """Score the skills section 0-10."""
    score = 0
    suggestions = []

    if not skills_list:
        return 0, ["No skills listed — critical for search visibility"]

    count = len(skills_list)

    if count >= guidelines["skills_min"]:
        score += 4
    else:
        suggestions.append(f"Only {count} skills — aim for {guidelines['skills_min']}-{guidelines['skills_max']}")

    if count > guidelines["skills_max"]:
        score += 2
        suggestions.append(f"Too many ({count}). Keep top {guidelines['skills_max']}")
    else:
        score += 3

    broad = ["web development", "software development", "programming", "api development"]
    specific = ["python", "django", "react", "node.js", "postgresql", "aws", "docker", "typescript"]
    has_broad = any(s.lower() in broad for s in skills_list)
    has_specific = any(s.lower() in specific for s in skills_list)

    if has_broad and has_specific:
        score += 3
    elif has_specific:
        score += 2
        suggestions.append("Add 1-2 broader category skills (e.g., 'API Development')")
    else:
        score += 1
        suggestions.append("Add specific technologies alongside broad categories")

    return min(round(score), 10), suggestions


def score_portfolio(portfolio, guidelines):
    """Score the portfolio section 0-10."""
    score = 0
    suggestions = []

    if not portfolio:
        return 0, ["No portfolio items — biggest trust signal you can add"]

    count = len(portfolio)
    if count >= guidelines["portfolio_min"]:
        score += 4
    else:
        suggestions.append(f"Only {count} items. Add at least {guidelines['portfolio_min']}")

    good = sum(1 for item in portfolio if item.get("description") and item.get("tech"))
    if good == count:
        score += 4
    elif good > 0:
        score += 2
        suggestions.append("Complete descriptions and tech stacks for all items")
    else:
        suggestions.append("Add descriptions and tech stacks to every item")

    if count >= 3:
        score += 2
    else:
        suggestions.append("Add more diverse projects to show range")

    return min(round(score), 10), suggestions


def main():
    parser = argparse.ArgumentParser(
        description="Score and optimize your freelancer profile for maximum visibility.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  platform_optimizer.py --platform upwork\n"
               "  platform_optimizer.py --platform toptal --profile path/to/profile.json",
    )
    parser.add_argument("--platform", required=True, choices=list(PLATFORM_GUIDELINES.keys()),
                        help="Platform to optimize for")
    parser.add_argument("--profile", default=DEFAULT_PROFILE,
                        help=f"Path to profile JSON (default: {DEFAULT_PROFILE})")

    args = parser.parse_args()
    guidelines = PLATFORM_GUIDELINES[args.platform]

    profile = load_profile(args.profile)
    if not profile:
        print(f"No profile found at {args.profile}. Creating sample...")
        profile = create_sample_profile(args.profile)
        print(f"Sample created at: {args.profile}")
        print("Edit with your actual data, then run again.\n")

    h_score, h_sugg = score_headline(profile.get("headline", ""), guidelines)
    o_score, o_sugg = score_overview(profile.get("overview", ""), guidelines)
    s_score, s_sugg = score_skills(profile.get("skills", []), guidelines)
    p_score, p_sugg = score_portfolio(profile.get("portfolio", []), guidelines)

    sections = guidelines["sections"]
    overall = round(
        h_score * sections["headline"]["weight"]
        + o_score * sections["overview"]["weight"]
        + s_score * sections["skills"]["weight"]
        + p_score * sections["portfolio"]["weight"],
        1,
    )

    def bar(s):
        filled = int(s)
        return "[" + "#" * filled + "." * (10 - filled) + "]"

    print("\n" + "=" * 60)
    print(f" {guidelines['name'].upper()} PROFILE OPTIMIZATION REPORT")
    print("=" * 60)

    print(f"\n  Headline:  \"{profile.get('headline', 'N/A')}\"")
    print(f"  Skills:    {len(profile.get('skills', []))} listed")
    print(f"  Portfolio: {len(profile.get('portfolio', []))} items")

    for name, sc, sugg in [("Headline", h_score, h_sugg), ("Overview", o_score, o_sugg),
                            ("Skills", s_score, s_sugg), ("Portfolio", p_score, p_sugg)]:
        w = sections[name.lower()]["weight"]
        print(f"\n  {name} ({w*100:.0f}%):  {bar(sc)} {sc}/10")
        for s in sugg:
            print(f"    - {s}")
        for tip in sections[name.lower()]["tips"][:2]:
            print(f"    > {tip}")

    print(f"\n{'='*60}")
    print(f"  OVERALL SCORE:  {bar(overall)} {overall}/10")

    if overall >= 8:
        print("  STATUS: Excellent — your profile is competitive")
    elif overall >= 6:
        print("  STATUS: Good — a few improvements will boost visibility")
    elif overall >= 4:
        print("  STATUS: Needs work — address the suggestions above")
    else:
        print("  STATUS: Weak — significant improvements needed")

    weakest = sorted([("Headline", h_score), ("Overview", o_score),
                       ("Skills", s_score), ("Portfolio", p_score)], key=lambda x: x[1])
    print(f"\n  PRIORITY ACTIONS:")
    for i, (n, s) in enumerate(weakest[:2], 1):
        if s < 8:
            print(f"    {i}. Fix your {n} (currently {s}/10)")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
