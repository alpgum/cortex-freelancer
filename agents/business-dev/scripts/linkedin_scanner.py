#!/usr/bin/env python3
"""
Cortex Freelancer — LinkedIn Scanner
Generate LinkedIn job search URLs and outreach sequences.

Usage:
    python3 linkedin_scanner.py --skills "python,django" --keywords "freelance,contract"
    python3 linkedin_scanner.py --skills "react,typescript" --keywords "remote,startup" --location "United States"
"""

import argparse
import sys
import urllib.parse


def build_search_urls(skills, keywords, location=None):
    """Build LinkedIn search URLs for jobs and people."""
    urls = []
    all_terms = skills + keywords
    job_query = " ".join(all_terms)

    # Job search — remote
    job_params = {"keywords": job_query, "f_WT": "2"}
    if location:
        job_params["location"] = location
    urls.append({"type": "Jobs (Remote)", "url": "https://www.linkedin.com/jobs/search/?" + urllib.parse.urlencode(job_params)})

    # Job search — contract/freelance
    contract_params = {"keywords": job_query + " contract freelance"}
    if location:
        contract_params["location"] = location
    urls.append({"type": "Jobs (Contract/Freelance)", "url": "https://www.linkedin.com/jobs/search/?" + urllib.parse.urlencode(contract_params)})

    # People search — potential clients
    for title in ["CTO", "VP Engineering", "Founder", "Engineering Manager"]:
        people_query = f"{title} {skills[0] if skills else ''}"
        people_params = {"keywords": people_query}
        if location:
            people_params["geoId"] = location
        urls.append({"type": f"People ({title})", "url": "https://www.linkedin.com/search/results/people/?" + urllib.parse.urlencode(people_params)})

    # Content search — hiring posts
    content_query = f"hiring {' '.join(skills[:2])} freelance"
    urls.append({"type": "Posts (Hiring)", "url": "https://www.linkedin.com/search/results/content/?" + urllib.parse.urlencode({"keywords": content_query})})

    return urls


def generate_outreach_sequence(skills):
    """Generate a 3-step outreach sequence."""
    primary_skill = skills[0] if skills else "development"

    sequence = [
        {
            "step": 1,
            "name": "Connection Request",
            "timing": "Day 0",
            "channel": "LinkedIn connection note (300 chars max)",
            "template": (
                f"Hi {{{{name}}}}, I noticed your work in {{{{their_industry}}}}. "
                f"I specialize in {primary_skill} and help teams "
                f"ship faster with focused freelance support. "
                f"Would love to connect and learn about what you're building."
            ),
            "tips": [
                "Keep it under 300 characters",
                "Reference something specific about their profile or company",
                "Don't pitch — just connect",
            ],
        },
        {
            "step": 2,
            "name": "Value Message",
            "timing": "Day 2-3 (after they accept)",
            "channel": "LinkedIn DM",
            "template": (
                f"Thanks for connecting, {{{{name}}}}! "
                f"I was curious — at {{{{their_company}}}}, are you handling {primary_skill} "
                f"in-house or working with external specialists?\n\n"
                f"I ask because I recently helped a similar company "
                f"{{{{specific_result — e.g., 'reduce API response time by 60%'}}}}. "
                f"Happy to share how if that's relevant to what you're building."
            ),
            "tips": [
                "Ask a genuine question — don't pitch yet",
                "Share ONE specific result with numbers",
                "Make it easy to respond (yes/no question)",
            ],
        },
        {
            "step": 3,
            "name": "Soft Pitch",
            "timing": "Day 5-7 (if they engaged)",
            "channel": "LinkedIn DM",
            "template": (
                f"{{{{name}}}}, based on our chat — I think I could help with "
                f"{{{{specific_pain_point_they_mentioned}}}}.\n\n"
                f"Here's what I typically do for teams like yours:\n"
                f"- {{{{Service 1: e.g., 'Build and ship {primary_skill} features in 1-2 week sprints'}}}}\n"
                f"- {{{{Service 2: e.g., 'Code review and architecture consulting'}}}}\n"
                f"- {{{{Service 3: e.g., 'Technical debt cleanup and performance optimization'}}}}\n\n"
                f"I have availability starting {{{{date}}}}. "
                f"Would a 15-min call make sense to explore this?"
            ),
            "tips": [
                "Only send if they engaged with Step 2",
                "Reference their specific pain point",
                "Offer a low-commitment next step (15-min call)",
                "Include your availability to show you're serious",
            ],
        },
    ]
    return sequence


def generate_profile_tips(skills):
    """Generate LinkedIn profile optimization tips."""
    primary = skills[0] if skills else "Development"
    return [
        f"Headline: '{primary} Freelancer | I help [target clients] achieve [result] | Open to contracts'",
        "Featured section: Pin 2-3 case studies or testimonials",
        "About: Lead with the problem you solve, not your bio. 'I help companies...'",
        "Experience: Frame freelance work as results, not tasks. Use metrics.",
        f"Skills: Ensure {', '.join(skills)} are in your top skills and endorsed",
        "Activity: Post 1-2x/week about your domain to stay visible in feeds",
        "Open to Work: Enable 'Providing Services' (visible to all, not just recruiters)",
    ]


def main():
    parser = argparse.ArgumentParser(
        description="Generate LinkedIn job search URLs and outreach sequences for freelancers.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  linkedin_scanner.py --skills 'python,django' --keywords 'freelance,contract'\n"
               "  linkedin_scanner.py --skills 'react,typescript' --keywords 'remote' --location 'United States'",
    )
    parser.add_argument("--skills", required=True, help="Comma-separated skills (e.g., 'python,django,api')")
    parser.add_argument("--keywords", default="freelance,contract,remote",
                        help="Comma-separated search keywords (default: 'freelance,contract,remote')")
    parser.add_argument("--location", help="Target location (e.g., 'United States', 'Remote')")

    args = parser.parse_args()

    skills = [s.strip() for s in args.skills.split(",") if s.strip()]
    keywords = [k.strip() for k in args.keywords.split(",") if k.strip()]

    if not skills:
        print("Error: Provide at least one skill.")
        sys.exit(1)

    urls = build_search_urls(skills, keywords, args.location)

    print("\n" + "=" * 65)
    print(" LINKEDIN SEARCH URLS")
    print("=" * 65)
    for u in urls:
        print(f"\n  [{u['type']}]")
        print(f"  {u['url']}")

    sequence = generate_outreach_sequence(skills)

    print("\n" + "=" * 65)
    print(" 3-STEP OUTREACH SEQUENCE")
    print("=" * 65)
    for step in sequence:
        print(f"\n  STEP {step['step']}: {step['name']}")
        print(f"  Timing: {step['timing']}")
        print(f"  Channel: {step['channel']}")
        print(f"  ---")
        for line in step["template"].split("\n"):
            print(f"  {line}")
        print(f"\n  Tips:")
        for tip in step["tips"]:
            print(f"    - {tip}")

    tips = generate_profile_tips(skills)

    print("\n" + "=" * 65)
    print(" LINKEDIN PROFILE OPTIMIZATION")
    print("=" * 65)
    for i, tip in enumerate(tips, 1):
        print(f"\n  {i}. {tip}")

    print(f"\n{'='*65}\n")


if __name__ == "__main__":
    main()
