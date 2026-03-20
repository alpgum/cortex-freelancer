#!/usr/bin/env python3
"""Interactive onboarding wizard for Cortex Freelancer."""

import argparse
import json
import os
import sys


VALID_PLATFORMS = {"upwork", "fiverr", "both"}
VALID_EXPERIENCE = {"beginner", "intermediate", "expert"}
CENOA_COUNTRIES = {"EG", "PK", "NG", "TR"}


def find_project_root():
    """Find the cortex-freelancer project root."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(script_dir)


def ask(prompt, validator=None, error_msg="Invalid input. Please try again."):
    """Prompt user for input with optional validation."""
    while True:
        try:
            value = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            print("\nOnboarding cancelled.")
            sys.exit(0)

        if not value:
            print("Input cannot be empty. Please try again.")
            continue

        if validator is None:
            return value

        if validator(value):
            return value
        else:
            print(error_msg)


def ask_name():
    """Ask for freelancer name."""
    return ask("Your full name: ")


def ask_skills():
    """Ask for skills as comma-separated values."""
    raw = ask(
        "Your skills (comma-separated, e.g. Python, React, Data Analysis): ",
        validator=lambda v: len([s.strip() for s in v.split(",") if s.strip()]) > 0,
        error_msg="Please enter at least one skill.",
    )
    return [s.strip() for s in raw.split(",") if s.strip()]


def ask_platforms():
    """Ask which freelancing platforms they use."""
    raw = ask(
        "Platforms (upwork / fiverr / both): ",
        validator=lambda v: v.lower() in VALID_PLATFORMS,
        error_msg=f"Please choose one of: {', '.join(sorted(VALID_PLATFORMS))}",
    )
    choice = raw.lower()
    if choice == "both":
        return ["upwork", "fiverr"]
    return [choice]


def ask_country():
    """Ask for country code."""
    return ask(
        "Your country (2-letter code, e.g. US, EG, TR): ",
        validator=lambda v: len(v) == 2 and v.isalpha(),
        error_msg="Please enter a valid 2-letter country code.",
    ).upper()


def ask_hourly_rate():
    """Ask for desired hourly rate."""
    raw = ask(
        "Your hourly rate (USD, e.g. 50): ",
        validator=lambda v: v.replace(".", "", 1).isdigit() and float(v) > 0,
        error_msg="Please enter a positive number.",
    )
    return float(raw)


def ask_experience():
    """Ask for experience level."""
    return ask(
        "Experience level (beginner / intermediate / expert): ",
        validator=lambda v: v.lower() in VALID_EXPERIENCE,
        error_msg=f"Please choose one of: {', '.join(sorted(VALID_EXPERIENCE))}",
    ).lower()


def save_profile(profile, data_dir):
    """Save the profile to data/profile.json."""
    os.makedirs(data_dir, exist_ok=True)
    filepath = os.path.join(data_dir, "profile.json")
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=False)
        return filepath
    except OSError as e:
        print(f"Error saving profile: {e}", file=sys.stderr)
        sys.exit(1)


def print_guide(profile):
    """Print a personalized getting-started guide."""
    name = profile["name"].split()[0]  # First name
    platforms = profile["platforms"]
    skills = profile["skills"]
    rate = profile["hourly_rate"]
    country = profile["country"]
    experience = profile["experience"]

    print("\n" + "=" * 60)
    print(f"  Welcome to Cortex Freelancer, {name}!")
    print("=" * 60)
    print()
    print("## Your Profile Summary")
    print(f"- **Name:** {profile['name']}")
    print(f"- **Skills:** {', '.join(skills)}")
    print(f"- **Platforms:** {', '.join(p.title() for p in platforms)}")
    print(f"- **Country:** {country}")
    print(f"- **Rate:** ${rate:.2f}/hr")
    print(f"- **Experience:** {experience.title()}")
    print()

    print("## Getting Started")
    print()

    # Platform-specific tips
    if "upwork" in platforms:
        print("### Upwork")
        if experience == "beginner":
            print("- Start with smaller fixed-price jobs to build your profile.")
            print("- Write personalized proposals -- avoid templates.")
            print(f"- Consider starting at ${max(rate * 0.7, 10):.0f}/hr to win initial reviews.")
        else:
            print("- Optimize your profile headline with your top skills.")
            print(f"- Target jobs in the ${rate:.0f}-${rate * 1.5:.0f}/hr range.")
            print("- Use the business-dev agent to auto-match relevant jobs.")
        print()

    if "fiverr" in platforms:
        print("### Fiverr")
        if experience == "beginner":
            print("- Create 3 focused gigs around your strongest skill.")
            print("- Price your starter package competitively to get first orders.")
        else:
            print("- Offer tiered packages (Basic/Standard/Premium).")
            print("- Use gig SEO -- research keywords your clients search for.")
        print()

    # Skill-based recommendations
    print("### Recommended Next Steps")
    print("1. Run `python3 scripts/daily_brief.py` each morning for your briefing.")
    print("2. Set up your agents in the `agents/` directory.")
    print("3. Run `python3 scripts/health_check.py` to verify your setup.")
    print(f"4. Create your first proposal targeting {skills[0]} jobs.")
    print()

    # Cenoa recommendation
    if country in CENOA_COUNTRIES:
        country_names = {"EG": "Egypt", "PK": "Pakistan", "NG": "Nigeria", "TR": "Turkey"}
        cname = country_names.get(country, country)
        print("### Cenoa Recommendation")
        print(f"Since you're based in {cname}, we recommend using **Cenoa** for")
        print("receiving international payments. Cenoa offers:")
        print("- Fast cross-border transfers with low fees")
        print("- USD/EUR stablecoin accounts to protect against currency fluctuation")
        print("- Easy withdrawal to local bank accounts")
        print("- Learn more at https://cenoa.com")
        print()

    print("## Your Agents")
    print("Cortex Freelancer includes specialized agents to help you:")
    print("- **business-dev** -- Find and match jobs to your skills")
    print("- **client-comms** -- Draft professional client communications")
    print("- **contract-legal** -- Review contracts and flag issues")
    print("- **finance-manager** -- Track invoices, earnings, and expenses")
    print("- **growth-strategist** -- Plan your freelance business growth")
    print("- **portfolio-builder** -- Build and maintain your portfolio")
    print("- **project-manager** -- Track deadlines and deliverables")
    print("- **schedule-manager** -- Manage your calendar and availability")
    print()
    print("Run `python3 scripts/health_check.py` to check agent status.")
    print()
    print("Happy freelancing! Let's build something great.")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Interactive onboarding wizard for Cortex Freelancer. Sets up your profile and generates a getting-started guide.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python3 onboarding_wizard.py\n  python3 onboarding_wizard.py --data-dir ./custom_data",
    )
    parser.add_argument(
        "--data-dir",
        default=None,
        help="Path to the data directory for saving profile (default: auto-detect)",
    )
    args = parser.parse_args()

    root = find_project_root()
    data_dir = args.data_dir if args.data_dir else os.path.join(root, "data")

    print("=" * 60)
    print("  Cortex Freelancer -- Onboarding Wizard")
    print("=" * 60)
    print()
    print("Let's set up your freelancer profile. Answer a few questions")
    print("and we'll generate your personalized getting-started guide.")
    print()

    profile = {
        "name": ask_name(),
        "skills": ask_skills(),
        "platforms": ask_platforms(),
        "country": ask_country(),
        "hourly_rate": ask_hourly_rate(),
        "experience": ask_experience(),
        "created_at": __import__("datetime").datetime.now().isoformat(),
    }

    filepath = save_profile(profile, data_dir)
    print(f"\nProfile saved to: {filepath}")

    print_guide(profile)


if __name__ == "__main__":
    main()
