#!/usr/bin/env python3
"""
Profile Optimizer for Freelancer Profiles (Upwork, Fiverr, etc.)

Reads a freelancer profile text, scores it across multiple dimensions,
and outputs specific improvement suggestions along with an optimized version.

Usage:
    python3 profile_optimizer.py --file profile.txt
    cat profile.txt | python3 profile_optimizer.py
    echo "I am a developer" | python3 profile_optimizer.py
"""

import argparse
import re
import sys
import textwrap

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ACTION_VERBS = {
    "achieved", "architected", "automated", "boosted", "built", "created",
    "delivered", "deployed", "designed", "developed", "drove", "eliminated",
    "enabled", "engineered", "established", "executed", "expanded", "grew",
    "implemented", "improved", "increased", "integrated", "launched", "led",
    "managed", "migrated", "optimized", "orchestrated", "overhauled",
    "pioneered", "reduced", "refactored", "revamped", "scaled", "shipped",
    "simplified", "solved", "spearheaded", "streamlined", "transformed",
    "upgraded",
}

POWER_KEYWORDS = {
    "roi", "revenue", "conversion", "growth", "performance", "scalable",
    "full-stack", "end-to-end", "agile", "cross-functional", "stakeholder",
    "deadline", "budget", "kpi", "metric", "strategy", "results-driven",
    "data-driven", "certified", "award", "published", "patent",
}

QUANTIFIER_PATTERN = re.compile(
    r"\b\d+[\+%xX]?\b"       # numbers, percentages, multipliers
    r"|(?:\$|USD|EUR)\s?\d+"  # currency amounts
)

SECTION_LABELS = {
    "headline": re.compile(r"^(headline|title|tagline)\s*[:|\-]", re.I),
    "overview": re.compile(r"^(overview|summary|about|about me|bio|description)\s*[:|\-]", re.I),
    "skills":   re.compile(r"^(skills|expertise|technologies|tech stack|tools)\s*[:|\-]", re.I),
    "portfolio": re.compile(r"^(portfolio|projects|work samples|case studies|experience)\s*[:|\-]", re.I),
}

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_sections(text: str) -> dict[str, str]:
    """Extract labelled sections from profile text.

    If no labelled sections are found the entire text is stored under
    'full_text' and heuristic splitting is attempted.
    """
    sections: dict[str, str] = {}
    current_key: str | None = None
    buffer: list[str] = []

    for line in text.splitlines():
        matched = False
        for key, pattern in SECTION_LABELS.items():
            if pattern.match(line.strip()):
                # flush previous
                if current_key is not None:
                    sections[current_key] = "\n".join(buffer).strip()
                current_key = key
                # keep text after the label on the same line
                after = pattern.sub("", line.strip()).strip()
                buffer = [after] if after else []
                matched = True
                break
        if not matched:
            buffer.append(line)

    # flush last section
    if current_key is not None:
        sections[current_key] = "\n".join(buffer).strip()

    # If we found no labelled sections, try heuristic splitting
    if not sections:
        sections["full_text"] = text.strip()
        _heuristic_split(text.strip(), sections)

    return sections


def _heuristic_split(text: str, sections: dict[str, str]) -> None:
    """Best-effort split when the profile has no labelled sections."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return

    # First line is often the headline
    if len(lines[0]) < 120:
        sections.setdefault("headline", lines[0])

    # Look for a comma/pipe-separated skills line
    for line in lines:
        if line.count(",") >= 3 or line.count("|") >= 3:
            sections.setdefault("skills", line)
            break

    # Everything else becomes the overview
    overview_lines = []
    for line in lines:
        if line == sections.get("headline") or line == sections.get("skills"):
            continue
        overview_lines.append(line)
    if overview_lines:
        sections.setdefault("overview", "\n".join(overview_lines))

# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _word_count(text: str) -> int:
    return len(text.split())


def _count_matches(text: str, word_set: set[str]) -> int:
    words = re.findall(r"[a-z\-]+", text.lower())
    return sum(1 for w in words if w in word_set)


def _count_quantifiers(text: str) -> int:
    return len(QUANTIFIER_PATTERN.findall(text))


def _clamp(score: float) -> int:
    return max(1, min(10, round(score)))

# ---------------------------------------------------------------------------
# Dimension scorers
# ---------------------------------------------------------------------------

def score_headline(text: str | None) -> tuple[int, list[str]]:
    suggestions: list[str] = []
    if not text:
        return 1, ["Add a headline/title to your profile."]

    score = 5.0
    wc = _word_count(text)

    # Length checks
    if wc < 4:
        score -= 2
        suggestions.append("Headline is too short. Aim for 6-12 words that convey your speciality and value.")
    elif wc > 15:
        score -= 1
        suggestions.append("Headline is too long. Keep it punchy (6-12 words).")
    else:
        score += 1

    # Specificity: contains a role keyword
    role_words = {"developer", "designer", "engineer", "consultant", "specialist",
                  "strategist", "architect", "analyst", "writer", "manager", "expert"}
    if any(w in text.lower() for w in role_words):
        score += 1
    else:
        suggestions.append("Include your professional role (e.g., 'Full-Stack Developer', 'UX Designer').")

    # Contains a differentiator / niche
    if _count_matches(text, POWER_KEYWORDS) >= 1:
        score += 1
    else:
        suggestions.append("Add a differentiator keyword (e.g., 'results-driven', 'scalable', 'data-driven').")

    # Pipe or vertical-bar separator (common best practice)
    if "|" in text:
        score += 0.5

    # Quantifier in headline (e.g., "10+ years")
    if _count_quantifiers(text) >= 1:
        score += 1
    else:
        suggestions.append("Consider adding a quantifier (e.g., '10+ years', '200+ projects').")

    return _clamp(score), suggestions


def score_overview(text: str | None) -> tuple[int, list[str]]:
    suggestions: list[str] = []
    if not text:
        return 1, ["Add an overview/summary section describing who you are and what you deliver."]

    score = 5.0
    wc = _word_count(text)

    # Length
    if wc < 50:
        score -= 2
        suggestions.append(f"Overview is only {wc} words. Aim for 150-300 words to tell your story.")
    elif wc < 100:
        score -= 1
        suggestions.append(f"Overview is {wc} words. Consider expanding to 150-300 words.")
    elif 150 <= wc <= 350:
        score += 1
    elif wc > 500:
        score -= 1
        suggestions.append("Overview is very long. Tighten it to ~300 words so clients actually read it.")

    # Action verbs
    av = _count_matches(text, ACTION_VERBS)
    if av == 0:
        score -= 1
        suggestions.append("Use action verbs (built, delivered, scaled, optimized) to show impact.")
    elif av >= 3:
        score += 1

    # Quantifiers
    q = _count_quantifiers(text)
    if q == 0:
        score -= 1
        suggestions.append("Add measurable results (e.g., 'reduced load time by 40%', 'managed $50K budget').")
    elif q >= 2:
        score += 1

    # Power keywords
    pk = _count_matches(text, POWER_KEYWORDS)
    if pk >= 2:
        score += 1
    else:
        suggestions.append("Sprinkle in power keywords like ROI, performance, scalable, strategy.")

    # First person check (should feel personal)
    if re.search(r"\bI\b", text):
        score += 0.5
    else:
        suggestions.append("Write in first person ('I build...') to sound approachable and confident.")

    return _clamp(score), suggestions


def score_skills(text: str | None) -> tuple[int, list[str]]:
    suggestions: list[str] = []
    if not text:
        return 1, ["Add a skills/technologies section listing your key competencies."]

    score = 5.0
    # Count comma or pipe separated items
    items = re.split(r"[,|;\n]+", text)
    items = [i.strip() for i in items if i.strip()]
    count = len(items)

    if count < 3:
        score -= 2
        suggestions.append(f"Only {count} skills listed. Aim for 8-15 relevant skills.")
    elif count < 6:
        score -= 1
        suggestions.append("Add more skills. 8-15 is the sweet spot for discoverability.")
    elif 8 <= count <= 20:
        score += 2
    elif count > 25:
        score -= 1
        suggestions.append("Too many skills listed. Focus on your top 15 to avoid looking unfocused.")

    # Check for mix of hard and soft skills
    soft_markers = {"communication", "leadership", "teamwork", "problem-solving",
                    "time management", "collaboration", "mentoring"}
    has_soft = any(s in text.lower() for s in soft_markers)
    if not has_soft:
        suggestions.append("Consider adding 1-2 soft skills (communication, leadership) to round out your profile.")
    else:
        score += 0.5

    # Specificity: version numbers or qualifiers (e.g., "React 18", "AWS Certified")
    if re.search(r"\d", text):
        score += 0.5
    else:
        suggestions.append("Be specific where possible (e.g., 'Python 3', 'React 18', 'AWS Certified').")

    return _clamp(score), suggestions


def score_portfolio(text: str | None) -> tuple[int, list[str]]:
    suggestions: list[str] = []
    if not text:
        return 2, [
            "Add a portfolio/projects section showcasing 3-5 of your best projects.",
            "Each project should mention: client context, your role, technologies used, and measurable outcome.",
        ]

    score = 5.0
    wc = _word_count(text)

    if wc < 30:
        score -= 2
        suggestions.append("Portfolio section is very thin. Describe at least 3 projects in detail.")
    elif wc < 80:
        score -= 1
        suggestions.append("Expand your project descriptions with outcomes and technologies used.")
    else:
        score += 1

    q = _count_quantifiers(text)
    if q == 0:
        suggestions.append("Add quantified results to each project (e.g., 'increased traffic 3x').")
    else:
        score += 1

    av = _count_matches(text, ACTION_VERBS)
    if av >= 2:
        score += 1

    # Check for multiple projects (look for bullet points, numbers, dashes)
    project_markers = len(re.findall(r"(?:^|\n)\s*[-*\d]+[.)]\s", text))
    if project_markers >= 3:
        score += 1
    elif project_markers == 0:
        suggestions.append("Use bullet points or numbered lists to separate individual projects.")

    return _clamp(score), suggestions


def score_completeness(sections: dict[str, str]) -> tuple[int, list[str]]:
    suggestions: list[str] = []
    present = set()
    all_text = sections.get("full_text", "")

    for key in ("headline", "overview", "skills", "portfolio"):
        if key in sections and sections[key].strip():
            present.add(key)

    score = 2.0 + len(present) * 2  # 2 base + 2 per section (max 10)

    missing = {"headline", "overview", "skills", "portfolio"} - present
    if missing:
        suggestions.append(
            f"Missing sections: {', '.join(sorted(missing))}. "
            "A complete profile should have headline, overview, skills, and portfolio."
        )

    # Check total word count
    total_wc = _word_count(all_text or " ".join(sections.values()))
    if total_wc < 100:
        score -= 1
        suggestions.append(f"Total profile is only {total_wc} words. Aim for 300+ words overall.")
    elif total_wc >= 300:
        score += 1

    # Contact / CTA check
    cta_patterns = re.compile(r"(reach out|contact|let.?s (talk|chat|connect)|message me|hire me|get in touch)", re.I)
    combined = all_text or " ".join(sections.values())
    if cta_patterns.search(combined):
        score += 0.5
    else:
        suggestions.append("End with a call to action (e.g., 'Let's chat about your next project!').")

    return _clamp(score), suggestions

# ---------------------------------------------------------------------------
# Optimized profile generator
# ---------------------------------------------------------------------------

def generate_optimized_profile(sections: dict[str, str], scores: dict) -> str:
    """Produce a rewritten/enhanced version of the profile."""
    parts: list[str] = []

    # Headline
    original_headline = sections.get("headline", "")
    if original_headline:
        enhanced_hl = original_headline.rstrip(".")
        # Add a pipe separator structure if missing
        if "|" not in enhanced_hl and len(enhanced_hl.split()) < 10:
            enhanced_hl += " | Delivering Results That Matter"
        parts.append(f"Headline: {enhanced_hl}")
    else:
        parts.append("Headline: [Your Role] | [Key Specialty] | [Years] Years of [Domain] Experience")

    parts.append("")

    # Overview
    original_overview = sections.get("overview", "")
    if original_overview:
        overview = original_overview
        # Ensure first person
        if not re.search(r"\bI\b", overview):
            overview = "I " + overview[0].lower() + overview[1:]
        # Append CTA if missing
        cta_pat = re.compile(r"(reach out|contact|let.?s|message me|hire me|get in touch)", re.I)
        if not cta_pat.search(overview):
            overview = overview.rstrip(". ") + ".\n\nLet's connect and discuss how I can help your project succeed."
        parts.append(f"Overview:\n{overview}")
    else:
        parts.append(textwrap.dedent("""\
            Overview:
            I am a [Your Role] with [X]+ years of experience specializing in [domain].
            I have helped [type of clients] achieve [specific outcomes] by [your approach].

            What sets me apart:
            - [Unique selling point 1 with a number]
            - [Unique selling point 2 with a number]
            - [Unique selling point 3 with a number]

            Let's connect and discuss how I can help your project succeed."""))

    parts.append("")

    # Skills
    original_skills = sections.get("skills", "")
    if original_skills:
        items = [i.strip() for i in re.split(r"[,|;\n]+", original_skills) if i.strip()]
        if len(items) < 8:
            items.append("[Add more relevant skills to reach 8-15]")
        parts.append("Skills: " + " | ".join(items))
    else:
        parts.append("Skills: [Skill 1] | [Skill 2] | [Skill 3] | ... (aim for 8-15)")

    parts.append("")

    # Portfolio
    original_portfolio = sections.get("portfolio", "")
    if original_portfolio:
        parts.append(f"Portfolio:\n{original_portfolio}")
    else:
        parts.append(textwrap.dedent("""\
            Portfolio:
            - Project 1: [Client context] - [What you did] - [Measurable result]
            - Project 2: [Client context] - [What you did] - [Measurable result]
            - Project 3: [Client context] - [What you did] - [Measurable result]"""))

    return "\n".join(parts)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(text: str) -> None:
    if not text.strip():
        print("Error: Profile text is empty.", file=sys.stderr)
        sys.exit(1)

    sections = parse_sections(text)

    # Score each dimension
    dimensions = {}
    all_suggestions: dict[str, list[str]] = {}

    for name, scorer in [
        ("Headline",     lambda: score_headline(sections.get("headline"))),
        ("Overview",     lambda: score_overview(sections.get("overview"))),
        ("Skills",       lambda: score_skills(sections.get("skills"))),
        ("Portfolio",    lambda: score_portfolio(sections.get("portfolio"))),
        ("Completeness", lambda: score_completeness(sections)),
    ]:
        s, sugs = scorer()
        dimensions[name] = s
        all_suggestions[name] = sugs

    overall = round(sum(dimensions.values()) / len(dimensions), 1)

    # --- Output ---
    divider = "=" * 60
    print(divider)
    print("  FREELANCER PROFILE OPTIMIZER  ")
    print(divider)
    print()

    # Scores table
    print("SCORES")
    print("-" * 40)
    for dim, s in dimensions.items():
        bar = "#" * s + "." * (10 - s)
        print(f"  {dim:<15} [{bar}]  {s}/10")
    print(f"\n  {'Overall':<15}                  {overall}/10")
    print()

    # Suggestions
    print("IMPROVEMENT SUGGESTIONS")
    print("-" * 40)
    for dim, sugs in all_suggestions.items():
        if sugs:
            print(f"\n  {dim}:")
            for sug in sugs:
                wrapped = textwrap.fill(sug, width=70, initial_indent="    -> ", subsequent_indent="       ")
                print(wrapped)
    print()

    # Optimized profile
    print(divider)
    print("  OPTIMIZED PROFILE (edit the bracketed placeholders)")
    print(divider)
    print()
    optimized = generate_optimized_profile(sections, dimensions)
    print(optimized)
    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Score and optimize a freelancer profile (Upwork, Fiverr, etc.).",
        epilog="Examples:\n"
               "  python3 profile_optimizer.py --file profile.txt\n"
               "  cat profile.txt | python3 profile_optimizer.py\n",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--file", "-f",
        type=str,
        default=None,
        help="Path to a text file containing the profile. If omitted, reads from stdin.",
    )

    args = parser.parse_args()

    if args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as fh:
                text = fh.read()
        except FileNotFoundError:
            print(f"Error: File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        except PermissionError:
            print(f"Error: Permission denied: {args.file}", file=sys.stderr)
            sys.exit(1)
    else:
        if sys.stdin.isatty():
            print("Reading profile from stdin (paste text then press Ctrl-D):", file=sys.stderr)
        text = sys.stdin.read()

    run(text)


if __name__ == "__main__":
    main()
