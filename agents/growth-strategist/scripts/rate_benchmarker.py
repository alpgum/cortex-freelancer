#!/usr/bin/env python3
"""
Freelancer Rate Benchmarker

Shows market hourly rate ranges (low / mid / high) for a given skill and country,
with positioning advice. Uses hardcoded realistic data for common freelance skills
across Egypt, Pakistan, Nigeria, Turkey, United States, United Kingdom, and Germany.

Usage:
    python3 rate_benchmarker.py --skill "web development" --country "egypt"
"""

import argparse
import sys

# ---------------------------------------------------------------------------
# Rate data: {skill_key: {country_key: (low, mid, high)}}
# All values in USD per hour.
# ---------------------------------------------------------------------------
RATE_DATA: dict[str, dict[str, tuple[float, float, float]]] = {
    "web development": {
        "eg": (5, 15, 30),
        "pk": (4, 12, 25),
        "ng": (5, 14, 28),
        "tr": (8, 20, 40),
        "us": (40, 75, 150),
        "uk": (35, 65, 130),
        "de": (35, 60, 120),
    },
    "mobile development": {
        "eg": (8, 18, 35),
        "pk": (5, 15, 30),
        "ng": (6, 16, 32),
        "tr": (10, 25, 50),
        "us": (50, 85, 175),
        "uk": (40, 75, 150),
        "de": (40, 70, 140),
    },
    "ui/ux design": {
        "eg": (5, 12, 25),
        "pk": (4, 10, 22),
        "ng": (4, 11, 24),
        "tr": (7, 18, 35),
        "us": (35, 65, 130),
        "uk": (30, 55, 110),
        "de": (30, 55, 110),
    },
    "graphic design": {
        "eg": (3, 10, 20),
        "pk": (3, 8, 18),
        "ng": (3, 9, 20),
        "tr": (5, 14, 28),
        "us": (25, 50, 100),
        "uk": (22, 45, 90),
        "de": (22, 45, 85),
    },
    "content writing": {
        "eg": (3, 8, 18),
        "pk": (2, 6, 15),
        "ng": (3, 8, 18),
        "tr": (5, 12, 25),
        "us": (20, 45, 100),
        "uk": (18, 40, 90),
        "de": (18, 38, 80),
    },
    "data entry": {
        "eg": (2, 5, 10),
        "pk": (2, 4, 8),
        "ng": (2, 4, 9),
        "tr": (3, 7, 14),
        "us": (12, 20, 35),
        "uk": (10, 18, 30),
        "de": (10, 17, 28),
    },
    "seo": {
        "eg": (4, 10, 22),
        "pk": (3, 8, 18),
        "ng": (3, 9, 20),
        "tr": (6, 15, 30),
        "us": (30, 60, 120),
        "uk": (25, 50, 100),
        "de": (25, 50, 95),
    },
    "video editing": {
        "eg": (4, 12, 25),
        "pk": (3, 10, 20),
        "ng": (4, 10, 22),
        "tr": (6, 16, 32),
        "us": (25, 55, 110),
        "uk": (22, 48, 95),
        "de": (22, 45, 90),
    },
    "translation": {
        "eg": (3, 8, 18),
        "pk": (2, 6, 14),
        "ng": (3, 7, 16),
        "tr": (5, 12, 25),
        "us": (20, 40, 80),
        "uk": (18, 35, 70),
        "de": (18, 35, 70),
    },
    "consulting": {
        "eg": (8, 20, 45),
        "pk": (5, 15, 35),
        "ng": (6, 16, 38),
        "tr": (10, 28, 55),
        "us": (50, 100, 250),
        "uk": (45, 90, 200),
        "de": (45, 85, 190),
    },
}

# Country aliases for fuzzy matching
COUNTRY_ALIASES: dict[str, str] = {
    # Full names
    "egypt": "eg",
    "pakistan": "pk",
    "nigeria": "ng",
    "turkey": "tr",
    "turkiye": "tr",
    "united states": "us",
    "united states of america": "us",
    "usa": "us",
    "united kingdom": "uk",
    "great britain": "uk",
    "germany": "de",
    "deutschland": "de",
    # ISO codes
    "eg": "eg",
    "pk": "pk",
    "ng": "ng",
    "tr": "tr",
    "us": "us",
    "uk": "uk",
    "gb": "uk",
    "de": "de",
}

COUNTRY_NAMES: dict[str, str] = {
    "eg": "Egypt",
    "pk": "Pakistan",
    "ng": "Nigeria",
    "tr": "Turkey",
    "us": "United States",
    "uk": "United Kingdom",
    "de": "Germany",
}


def fuzzy_match_skill(query: str) -> str | None:
    """Match a skill name using lowercase partial matching."""
    query = query.lower().strip()
    # Exact match first
    if query in RATE_DATA:
        return query
    # Partial match: query is substring of skill name or vice versa
    matches = []
    for skill in RATE_DATA:
        if query in skill or skill in query:
            matches.append(skill)
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        # Prefer the shortest match (most specific)
        matches.sort(key=len)
        return matches[0]
    # Token-based: check if any word in the query appears in a skill name
    query_words = set(query.split())
    best = None
    best_score = 0
    for skill in RATE_DATA:
        skill_words = set(skill.split())
        overlap = len(query_words & skill_words)
        if overlap > best_score:
            best_score = overlap
            best = skill
    if best_score > 0:
        return best
    return None


def resolve_country(query: str) -> str | None:
    """Resolve a country query to a country code."""
    query = query.lower().strip()
    if query in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[query]
    # Partial match
    for alias, code in COUNTRY_ALIASES.items():
        if query in alias or alias in query:
            return code
    return None


def positioning_advice(low: float, mid: float, high: float, country_code: str) -> list[str]:
    """Generate positioning advice based on rate ranges."""
    advice = []
    is_emerging = country_code in ("eg", "pk", "ng", "tr")

    advice.append(
        f"Entry-level / competitive rate: ${low:.0f}-${mid:.0f}/hr. "
        f"Good for building a portfolio and landing first clients."
    )
    advice.append(
        f"Mid-range / experienced rate: ${mid:.0f}-${high:.0f}/hr. "
        f"Requires a solid portfolio, testimonials, and specialization."
    )
    advice.append(
        f"Premium rate: ${high:.0f}+/hr. "
        f"Reserved for recognized experts with strong personal brands."
    )

    if is_emerging:
        advice.append(
            "TIP: Freelancers from emerging markets can command higher rates by "
            "targeting clients in the US/UK/EU. Invest in English proficiency, "
            "a professional portfolio site, and niche specialization."
        )
        advice.append(
            "TIP: Consider value-based pricing instead of hourly rates. "
            "Clients care about outcomes, not hours."
        )
    else:
        advice.append(
            "TIP: Differentiate through specialization (e.g., 'React Native for fintech' "
            "instead of generic 'mobile developer'). Specialists earn 2-3x more."
        )

    return advice


def print_report(skill: str, country_code: str, low: float, mid: float, high: float) -> None:
    """Print the benchmark report."""
    country_name = COUNTRY_NAMES.get(country_code, country_code.upper())
    sep = "=" * 64

    print(sep)
    print("  FREELANCER RATE BENCHMARK")
    print(sep)
    print(f"\n  Skill:    {skill.title()}")
    print(f"  Country:  {country_name}")
    print()

    # Rate bar visualization
    bar_width = 40
    print(f"  {'Rate Tier':<14} {'USD/hr':>10}   Visual")
    print(f"  {'-'*14} {'-'*10}   {'-'*bar_width}")

    max_val = high * 1.2  # scale bar
    for label, val in [("Low", low), ("Mid", mid), ("High", high)]:
        filled = int((val / max_val) * bar_width) if max_val > 0 else 0
        bar = "#" * filled + "." * (bar_width - filled)
        print(f"  {label:<14} ${val:>8.0f}   [{bar}]")

    print(f"\n  Median market rate: ${mid:.0f}/hr")
    print(f"  Rate spread:       ${high - low:.0f}/hr (low to high)")

    # Advice
    advice = positioning_advice(low, mid, high, country_code)
    print(f"\n{sep}")
    print("  POSITIONING ADVICE")
    print(sep)
    for i, line in enumerate(advice, 1):
        print(f"\n  {i}. {line}")

    # Cross-market comparison
    print(f"\n{sep}")
    print(f"  CROSS-MARKET COMPARISON: {skill.title()}")
    print(sep)
    print(f"\n  {'Country':<20} {'Low':>8} {'Mid':>8} {'High':>8}")
    print(f"  {'-'*20} {'-'*8} {'-'*8} {'-'*8}")

    skill_data = RATE_DATA[skill]
    for cc in ("eg", "pk", "ng", "tr", "us", "uk", "de"):
        if cc in skill_data:
            lo, mi, hi = skill_data[cc]
            marker = "  <--" if cc == country_code else ""
            cn = COUNTRY_NAMES.get(cc, cc.upper())
            print(f"  {cn:<20} ${lo:>6.0f} ${mi:>6.0f} ${hi:>6.0f}{marker}")

    print(f"\n{sep}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark freelancer hourly rates by skill and country. "
                    "Shows low/mid/high market rates in USD with positioning advice.",
        epilog='Example: python3 rate_benchmarker.py --skill "web development" --country "egypt"',
    )
    parser.add_argument(
        "--skill",
        required=True,
        metavar="SKILL",
        help="Freelance skill to look up (e.g., 'web development', 'seo', 'video editing'). "
             "Partial and case-insensitive matching supported.",
    )
    parser.add_argument(
        "--country",
        required=True,
        metavar="COUNTRY",
        help="Country name or ISO code (e.g., 'egypt', 'EG', 'us', 'Germany'). "
             "Supported: EG, PK, NG, TR, US, UK, DE.",
    )
    parser.add_argument(
        "--list-skills",
        action="store_true",
        help="List all supported skills and exit.",
    )
    parser.add_argument(
        "--list-countries",
        action="store_true",
        help="List all supported countries and exit.",
    )
    args = parser.parse_args()

    if args.list_skills:
        print("Supported skills:")
        for skill in sorted(RATE_DATA.keys()):
            print(f"  - {skill}")
        sys.exit(0)

    if args.list_countries:
        print("Supported countries:")
        for code, name in sorted(COUNTRY_NAMES.items(), key=lambda x: x[1]):
            print(f"  {code.upper()} - {name}")
        sys.exit(0)

    # Resolve skill
    matched_skill = fuzzy_match_skill(args.skill)
    if matched_skill is None:
        print(f"Error: Unknown skill '{args.skill}'.", file=sys.stderr)
        print("Supported skills:", file=sys.stderr)
        for skill in sorted(RATE_DATA.keys()):
            print(f"  - {skill}", file=sys.stderr)
        sys.exit(1)

    if matched_skill != args.skill.lower().strip():
        print(f"Note: Matched '{args.skill}' to '{matched_skill}'.\n", file=sys.stderr)

    # Resolve country
    country_code = resolve_country(args.country)
    if country_code is None:
        print(f"Error: Unknown country '{args.country}'.", file=sys.stderr)
        print("Supported countries:", file=sys.stderr)
        for code, name in sorted(COUNTRY_NAMES.items(), key=lambda x: x[1]):
            print(f"  {code.upper()} - {name}", file=sys.stderr)
        sys.exit(1)

    # Look up rates
    skill_rates = RATE_DATA[matched_skill]
    if country_code not in skill_rates:
        print(f"Error: No rate data for '{matched_skill}' in {COUNTRY_NAMES.get(country_code, country_code)}.",
              file=sys.stderr)
        sys.exit(1)

    low, mid, high = skill_rates[country_code]
    print_report(matched_skill, country_code, low, mid, high)


if __name__ == "__main__":
    main()
