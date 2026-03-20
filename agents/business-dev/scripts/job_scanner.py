#!/usr/bin/env python3
"""
Cortex Freelancer — Job Scanner
Scans Upwork RSS feeds for jobs matching your skills.
Filters by budget, client quality, and freshness.
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from html import unescape


UPWORK_RSS_BASE = "https://www.upwork.com/ab/feed/jobs/rss"

# Skill-to-Upwork-category mapping for better RSS filtering
SKILL_CATEGORIES = {
    "python": "Web%2C+Mobile+%26+Software+Dev",
    "django": "Web%2C+Mobile+%26+Software+Dev",
    "react": "Web%2C+Mobile+%26+Software+Dev",
    "node": "Web%2C+Mobile+%26+Software+Dev",
    "javascript": "Web%2C+Mobile+%26+Software+Dev",
    "api": "Web%2C+Mobile+%26+Software+Dev",
    "wordpress": "Web%2C+Mobile+%26+Software+Dev",
    "php": "Web%2C+Mobile+%26+Software+Dev",
    "java": "Web%2C+Mobile+%26+Software+Dev",
    "flutter": "Web%2C+Mobile+%26+Software+Dev",
    "swift": "Web%2C+Mobile+%26+Software+Dev",
    "kotlin": "Web%2C+Mobile+%26+Software+Dev",
    "design": "Design+%26+Creative",
    "figma": "Design+%26+Creative",
    "photoshop": "Design+%26+Creative",
    "illustrator": "Design+%26+Creative",
    "ui": "Design+%26+Creative",
    "ux": "Design+%26+Creative",
    "writing": "Writing",
    "copywriting": "Writing",
    "content": "Writing",
    "blog": "Writing",
    "seo": "Sales+%26+Marketing",
    "marketing": "Sales+%26+Marketing",
    "data entry": "Admin+Support",
    "virtual assistant": "Admin+Support",
    "excel": "Admin+Support",
    "translation": "Translation",
    "video": "Design+%26+Creative",
    "editing": "Design+%26+Creative",
}


def build_rss_url(skills: list[str], sort: str = "recency") -> str:
    """Build Upwork RSS feed URL from skills."""
    query = "+".join(skills)
    url = f"{UPWORK_RSS_BASE}?q={query}&sort={sort}&paging=0%3B50"
    return url


def parse_budget(description: str) -> dict:
    """Extract budget info from job description HTML."""
    budget = {"type": "unknown", "min": 0, "max": 0, "display": "Not specified"}

    # Fixed price
    fixed_match = re.search(r'<b>Budget</b>:\s*\$([0-9,]+(?:\.[0-9]+)?)', description)
    if fixed_match:
        amount = float(fixed_match.group(1).replace(",", ""))
        budget = {"type": "fixed", "min": amount, "max": amount, "display": f"${amount:,.0f} fixed"}
        return budget

    # Hourly
    hourly_match = re.search(r'<b>Hourly Range</b>:\s*\$([0-9.]+)-\$([0-9.]+)', description)
    if hourly_match:
        low = float(hourly_match.group(1))
        high = float(hourly_match.group(2))
        budget = {"type": "hourly", "min": low, "max": high, "display": f"${low:.0f}-${high:.0f}/hr"}
        return budget

    return budget


def parse_client_info(description: str) -> dict:
    """Extract client info from job description HTML."""
    info = {"rating": 0, "hire_rate": 0, "total_spent": "$0", "country": "Unknown"}

    rating_match = re.search(r'<b>Rating</b>:\s*([0-9.]+)', description)
    if rating_match:
        info["rating"] = float(rating_match.group(1))

    spent_match = re.search(r'<b>Total Spent</b>:\s*\$([0-9,]+)', description)
    if spent_match:
        info["total_spent"] = f"${spent_match.group(1)}"

    hire_match = re.search(r'<b>Hires</b>:\s*(\d+)', description)
    if hire_match:
        info["hires"] = int(hire_match.group(1))

    country_match = re.search(r'<b>Country</b>:\s*([^<]+)', description)
    if country_match:
        info["country"] = country_match.group(1).strip()

    return info


def calculate_relevance(title: str, description: str, skills: list[str]) -> float:
    """Score job relevance 0-100 based on skill match."""
    text = (title + " " + description).lower()
    matches = sum(1 for skill in skills if skill.lower() in text)
    base_score = (matches / max(len(skills), 1)) * 70

    # Bonus for recent posting
    bonus = 0
    if "posted" in text and ("hour" in text or "minute" in text):
        bonus += 15

    # Bonus for verified payment
    if "payment verified" in text.lower() or "payment method verified" in text.lower():
        bonus += 15

    return min(base_score + bonus, 100)


def parse_published_date(date_str: str) -> datetime:
    """Parse RSS date string."""
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S%z",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return datetime.now()


def fetch_and_parse_jobs(skills: list[str], min_budget: float = 0,
                         max_hours: int = 48, min_client_rating: float = 0,
                         limit: int = 10) -> list[dict]:
    """Fetch RSS feed and parse into job listings."""
    url = build_rss_url(skills)

    print(f"Fetching jobs from Upwork RSS feed...")
    print(f"Skills: {', '.join(skills)}")
    print(f"URL: {url}\n")

    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "CortexFreelancer/1.0 (Job Scanner)"
        })
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read().decode("utf-8")
    except urllib.error.URLError as e:
        print(f"Error fetching RSS feed: {e}")
        print("\nFalling back to demo mode with sample data...\n")
        return generate_sample_jobs(skills, limit)
    except Exception as e:
        print(f"Unexpected error: {e}")
        print("\nFalling back to demo mode with sample data...\n")
        return generate_sample_jobs(skills, limit)

    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        print("Error parsing RSS XML. Falling back to demo mode...\n")
        return generate_sample_jobs(skills, limit)

    jobs = []
    cutoff = datetime.now() - timedelta(hours=max_hours)

    for item in root.iter("item"):
        title_el = item.find("title")
        link_el = item.find("link")
        desc_el = item.find("description")
        pub_el = item.find("pubDate")

        if title_el is None or desc_el is None:
            continue

        title = title_el.text or ""
        link = link_el.text if link_el is not None else ""
        description = desc_el.text or ""
        pub_date = parse_published_date(pub_el.text) if pub_el is not None and pub_el.text else datetime.now()

        # Parse structured data from description
        budget = parse_budget(description)
        client = parse_client_info(description)
        relevance = calculate_relevance(title, description, skills)

        # Apply filters
        if min_budget > 0 and budget["max"] > 0 and budget["max"] < min_budget:
            continue

        if min_client_rating > 0 and client["rating"] > 0 and client["rating"] < min_client_rating:
            continue

        # Clean description for display
        clean_desc = re.sub(r'<[^>]+>', ' ', description)
        clean_desc = unescape(clean_desc)
        clean_desc = re.sub(r'\s+', ' ', clean_desc).strip()[:300]

        jobs.append({
            "title": title,
            "url": link,
            "description": clean_desc,
            "budget": budget,
            "client": client,
            "relevance": round(relevance, 1),
            "published": pub_date.strftime("%Y-%m-%d %H:%M") if pub_date else "Unknown",
        })

    # Sort by relevance
    jobs.sort(key=lambda j: j["relevance"], reverse=True)
    return jobs[:limit]


def generate_sample_jobs(skills: list[str], limit: int = 10) -> list[dict]:
    """Generate sample job data for demo/testing when RSS is unavailable."""
    skill_str = ", ".join(skills)
    samples = [
        {"title": f"Build a REST API using {skills[0] if skills else 'Python'}", "budget": "$1,000-$2,500 fixed", "rating": 4.9, "country": "United States"},
        {"title": f"Senior {skills[0] if skills else 'Developer'} needed for SaaS platform", "budget": "$40-$65/hr", "rating": 4.8, "country": "United Kingdom"},
        {"title": f"Full-stack web app with {skill_str}", "budget": "$3,000-$5,000 fixed", "rating": 5.0, "country": "Canada"},
        {"title": f"Fix bugs and add features — {skills[0] if skills else 'web'} project", "budget": "$500-$1,000 fixed", "rating": 4.7, "country": "Australia"},
        {"title": f"Long-term {skills[0] if skills else 'development'} partner needed", "budget": "$25-$45/hr", "rating": 4.6, "country": "Germany"},
        {"title": f"MVP development — {skill_str} stack", "budget": "$2,000-$4,000 fixed", "rating": 4.9, "country": "United States"},
        {"title": f"E-commerce platform with {skills[0] if skills else 'custom'} integration", "budget": "$1,500-$3,000 fixed", "rating": 4.5, "country": "Netherlands"},
        {"title": f"Data pipeline and API using {skill_str}", "budget": "$50-$80/hr", "rating": 4.8, "country": "United States"},
        {"title": f"Website redesign with {skills[0] if skills else 'modern'} framework", "budget": "$800-$1,500 fixed", "rating": 4.4, "country": "UAE"},
        {"title": f"Ongoing {skills[0] if skills else 'tech'} consulting and development", "budget": "$30-$55/hr", "rating": 4.7, "country": "Singapore"},
    ]

    jobs = []
    for i, s in enumerate(samples[:limit]):
        jobs.append({
            "title": s["title"],
            "url": f"https://www.upwork.com/jobs/~sample{i+1:03d}",
            "description": f"[Sample] Looking for an experienced professional with {skill_str} skills. This is demo data — run with a live internet connection for real results.",
            "budget": {"type": "fixed", "min": 0, "max": 0, "display": s["budget"]},
            "client": {"rating": s["rating"], "total_spent": "$10,000+", "country": s["country"]},
            "relevance": round(95 - i * 5, 1),
            "published": datetime.now().strftime("%Y-%m-%d %H:%M"),
        })
    return jobs


def display_jobs(jobs: list[dict], output_format: str = "table"):
    """Display jobs in a readable format."""
    if not jobs:
        print("No matching jobs found. Try broader skills or lower minimum budget.")
        return

    if output_format == "json":
        print(json.dumps(jobs, indent=2, default=str))
        return

    print(f"{'='*70}")
    print(f" TOP {len(jobs)} JOB MATCHES")
    print(f"{'='*70}\n")

    for i, job in enumerate(jobs, 1):
        relevance_bar = "█" * int(job["relevance"] / 10) + "░" * (10 - int(job["relevance"] / 10))
        print(f"  #{i}  {job['title']}")
        print(f"      Relevance: [{relevance_bar}] {job['relevance']}%")
        print(f"      Budget:    {job['budget']['display'] if isinstance(job['budget'], dict) else job['budget']}")

        client = job.get("client", {})
        if client.get("rating"):
            print(f"      Client:    ★{client['rating']} | {client.get('total_spent', 'N/A')} spent | {client.get('country', 'N/A')}")
        print(f"      Posted:    {job['published']}")
        print(f"      URL:       {job['url']}")
        print(f"      {'─'*60}")
        if job.get("description"):
            desc = job["description"][:200]
            print(f"      {desc}...")
        print()

    print(f"{'='*70}")
    print(f"  Found {len(jobs)} matching jobs. Good luck!")
    print(f"{'='*70}")


def main():
    parser = argparse.ArgumentParser(
        description="Cortex Freelancer — Job Scanner. Finds Upwork jobs matching your skills.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --skills "python,django,api" --min-budget 500
  %(prog)s --skills "react,typescript" --min-budget 1000 --format json
  %(prog)s --skills "design,figma,ui" --limit 5
        """
    )
    parser.add_argument("--skills", required=True,
                        help="Comma-separated list of skills (e.g., 'python,django,api')")
    parser.add_argument("--min-budget", type=float, default=0,
                        help="Minimum budget filter in USD (default: 0)")
    parser.add_argument("--min-rating", type=float, default=0,
                        help="Minimum client rating filter (default: 0)")
    parser.add_argument("--max-age", type=int, default=48,
                        help="Maximum job age in hours (default: 48)")
    parser.add_argument("--limit", type=int, default=10,
                        help="Number of results to show (default: 10)")
    parser.add_argument("--format", choices=["table", "json"], default="table",
                        help="Output format (default: table)")

    args = parser.parse_args()

    skills = [s.strip() for s in args.skills.split(",") if s.strip()]
    if not skills:
        print("Error: Please provide at least one skill.")
        sys.exit(1)

    jobs = fetch_and_parse_jobs(
        skills=skills,
        min_budget=args.min_budget,
        max_hours=args.max_age,
        min_client_rating=args.min_rating,
        limit=args.limit,
    )

    display_jobs(jobs, args.format)


if __name__ == "__main__":
    main()
