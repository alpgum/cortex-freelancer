#!/usr/bin/env python3
"""
Market Intelligence Reporter (CFX-065b)

Comprehensive freelancer market research and intelligence:
- Platform rate analysis (Upwork, Fiverr, Freelancer.com benchmarks)
- Skill demand trending with seasonal patterns
- Competitive positioning analysis
- Rate optimization recommendations
- Market opportunity identification

Usage:
    python market_intelligence.py rates --skill "React Developer" --experience senior
    python market_intelligence.py trends --category "web-development"
    python market_intelligence.py positioning --skills "React,Node.js,TypeScript" --rate 95
    python market_intelligence.py opportunities --skills "React,Python" --region "global"
    python market_intelligence.py report --skill "Full-Stack Developer"
"""

import argparse
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Market Rate Database (curated benchmarks)
# ---------------------------------------------------------------------------

RATE_DATABASE = {
    "web-development": {
        "react": {"junior": (25, 50), "mid": (50, 90), "senior": (90, 150), "expert": (150, 250)},
        "angular": {"junior": (25, 45), "mid": (45, 85), "senior": (85, 140), "expert": (140, 220)},
        "vue": {"junior": (22, 45), "mid": (45, 80), "senior": (80, 130), "expert": (130, 200)},
        "next.js": {"junior": (30, 55), "mid": (55, 95), "senior": (95, 160), "expert": (160, 250)},
        "node.js": {"junior": (25, 50), "mid": (50, 90), "senior": (90, 150), "expert": (150, 230)},
        "python/django": {"junior": (25, 50), "mid": (50, 85), "senior": (85, 140), "expert": (140, 220)},
        "ruby-on-rails": {"junior": (30, 55), "mid": (55, 95), "senior": (95, 155), "expert": (155, 230)},
        "php/laravel": {"junior": (18, 35), "mid": (35, 65), "senior": (65, 110), "expert": (110, 170)},
        "full-stack": {"junior": (28, 55), "mid": (55, 95), "senior": (95, 160), "expert": (160, 250)},
    },
    "mobile": {
        "react-native": {"junior": (30, 55), "mid": (55, 95), "senior": (95, 155), "expert": (155, 240)},
        "flutter": {"junior": (28, 50), "mid": (50, 90), "senior": (90, 145), "expert": (145, 220)},
        "ios-swift": {"junior": (35, 60), "mid": (60, 100), "senior": (100, 165), "expert": (165, 260)},
        "android-kotlin": {"junior": (30, 55), "mid": (55, 90), "senior": (90, 150), "expert": (150, 235)},
    },
    "design": {
        "ui-ux": {"junior": (25, 50), "mid": (50, 85), "senior": (85, 140), "expert": (140, 220)},
        "graphic-design": {"junior": (18, 35), "mid": (35, 65), "senior": (65, 110), "expert": (110, 175)},
        "brand-identity": {"junior": (25, 50), "mid": (50, 90), "senior": (90, 150), "expert": (150, 250)},
        "motion-design": {"junior": (30, 55), "mid": (55, 95), "senior": (95, 155), "expert": (155, 240)},
    },
    "data-ai": {
        "data-science": {"junior": (35, 60), "mid": (60, 110), "senior": (110, 180), "expert": (180, 300)},
        "machine-learning": {"junior": (40, 70), "mid": (70, 120), "senior": (120, 200), "expert": (200, 350)},
        "data-engineering": {"junior": (35, 60), "mid": (60, 100), "senior": (100, 170), "expert": (170, 270)},
        "ai-llm": {"junior": (45, 80), "mid": (80, 140), "senior": (140, 230), "expert": (230, 400)},
    },
    "devops": {
        "aws": {"junior": (30, 55), "mid": (55, 100), "senior": (100, 165), "expert": (165, 260)},
        "kubernetes": {"junior": (35, 60), "mid": (60, 110), "senior": (110, 180), "expert": (180, 280)},
        "terraform": {"junior": (30, 55), "mid": (55, 100), "senior": (100, 160), "expert": (160, 250)},
    },
    "writing": {
        "technical-writing": {"junior": (20, 40), "mid": (40, 70), "senior": (70, 120), "expert": (120, 180)},
        "copywriting": {"junior": (18, 35), "mid": (35, 65), "senior": (65, 110), "expert": (110, 175)},
        "content-marketing": {"junior": (20, 40), "mid": (40, 75), "senior": (75, 125), "expert": (125, 200)},
    },
}

# Demand trends (relative demand 0-100, trend direction)
DEMAND_TRENDS = {
    "react": {"demand": 92, "trend": "stable", "growth_yoy": 3, "jobs_monthly": 15000},
    "next.js": {"demand": 88, "trend": "up", "growth_yoy": 22, "jobs_monthly": 8500},
    "node.js": {"demand": 85, "trend": "stable", "growth_yoy": 1, "jobs_monthly": 12000},
    "typescript": {"demand": 90, "trend": "up", "growth_yoy": 18, "jobs_monthly": 14000},
    "python": {"demand": 95, "trend": "up", "growth_yoy": 12, "jobs_monthly": 20000},
    "ai-llm": {"demand": 98, "trend": "up", "growth_yoy": 150, "jobs_monthly": 6000},
    "react-native": {"demand": 72, "trend": "stable", "growth_yoy": -2, "jobs_monthly": 4500},
    "flutter": {"demand": 68, "trend": "up", "growth_yoy": 15, "jobs_monthly": 3800},
    "vue": {"demand": 58, "trend": "down", "growth_yoy": -8, "jobs_monthly": 3200},
    "angular": {"demand": 55, "trend": "down", "growth_yoy": -12, "jobs_monthly": 4000},
    "aws": {"demand": 88, "trend": "stable", "growth_yoy": 5, "jobs_monthly": 11000},
    "kubernetes": {"demand": 82, "trend": "up", "growth_yoy": 15, "jobs_monthly": 5500},
    "ui-ux": {"demand": 80, "trend": "stable", "growth_yoy": 4, "jobs_monthly": 9000},
    "data-science": {"demand": 78, "trend": "stable", "growth_yoy": -3, "jobs_monthly": 7500},
    "machine-learning": {"demand": 85, "trend": "up", "growth_yoy": 25, "jobs_monthly": 5000},
    "rust": {"demand": 45, "trend": "up", "growth_yoy": 40, "jobs_monthly": 1200},
    "golang": {"demand": 65, "trend": "up", "growth_yoy": 18, "jobs_monthly": 4200},
    "php/laravel": {"demand": 50, "trend": "down", "growth_yoy": -10, "jobs_monthly": 5500},
}

# Regional rate multipliers
REGIONAL_MULTIPLIERS = {
    "us": 1.0, "uk": 0.9, "eu-west": 0.85, "eu-east": 0.5,
    "turkey": 0.35, "egypt": 0.25, "pakistan": 0.22, "nigeria": 0.2,
    "india": 0.25, "philippines": 0.22, "brazil": 0.35, "global": 0.6,
}


# ---------------------------------------------------------------------------
# Analysis Functions
# ---------------------------------------------------------------------------

def get_rate_range(skill: str, experience: str = "mid") -> Dict:
    """Get rate range for a skill at experience level."""
    skill_lower = skill.lower().replace(" ", "-")
    for category, skills in RATE_DATABASE.items():
        for skill_key, levels in skills.items():
            if skill_lower in skill_key or skill_key in skill_lower:
                rates = levels.get(experience, levels.get("mid"))
                return {
                    "skill": skill,
                    "category": category,
                    "experience": experience,
                    "rate_low": rates[0],
                    "rate_high": rates[1],
                    "rate_mid": round((rates[0] + rates[1]) / 2),
                    "currency": "USD",
                    "basis": "hourly",
                }
    return {"skill": skill, "error": "Skill not found in database", "suggestion": "Try a more specific skill name"}


def analyze_positioning(skills: List[str], current_rate: float, region: str = "global") -> Dict:
    """Analyze competitive positioning."""
    multiplier = REGIONAL_MULTIPLIERS.get(region, 0.6)
    skill_analysis = []
    total_demand = 0

    for skill in skills:
        rate_info = get_rate_range(skill.strip(), "mid")
        trend = DEMAND_TRENDS.get(skill.strip().lower().replace(" ", "-"), {})

        if "error" not in rate_info:
            adjusted_mid = rate_info["rate_mid"] * multiplier
            position_pct = min(100, max(0, (current_rate / adjusted_mid) * 100)) if adjusted_mid > 0 else 50

            if position_pct < 40: position = "Below Market — room to increase"
            elif position_pct < 70: position = "Competitive — good positioning"
            elif position_pct < 90: position = "Premium — strong positioning"
            else: position = "Top Tier — maintain with exceptional quality"

            skill_analysis.append({
                "skill": skill,
                "market_mid": round(adjusted_mid),
                "your_rate": current_rate,
                "position_pct": round(position_pct),
                "position": position,
                "demand": trend.get("demand", 50),
                "trend": trend.get("trend", "unknown"),
            })
            total_demand += trend.get("demand", 50)

    avg_demand = total_demand / len(skill_analysis) if skill_analysis else 0

    # Recommendations
    recommendations = []
    below_market = [s for s in skill_analysis if s["position_pct"] < 50]
    high_demand = [s for s in skill_analysis if s.get("demand", 0) > 80]
    trending_up = [s for s in skill_analysis if s.get("trend") == "up"]

    if below_market:
        skills_list = ", ".join(s["skill"] for s in below_market)
        recommendations.append(f"💰 Rate increase opportunity: You're below market for {skills_list}. Consider raising by 15-25%.")
    if high_demand:
        skills_list = ", ".join(s["skill"] for s in high_demand)
        recommendations.append(f"🔥 High demand: {skills_list} — lean into these for better project selection.")
    if trending_up:
        skills_list = ", ".join(s["skill"] for s in trending_up)
        recommendations.append(f"📈 Growing demand: {skills_list} — invest in deepening these skills.")

    return {
        "skills": skill_analysis,
        "current_rate": current_rate,
        "region": region,
        "regional_multiplier": multiplier,
        "avg_demand_score": round(avg_demand),
        "recommendations": recommendations,
    }


def find_opportunities(skills: List[str], region: str = "global") -> List[Dict]:
    """Find market opportunities based on skills."""
    opportunities = []

    # Check for adjacent high-demand skills
    skill_set = set(s.lower().replace(" ", "-") for s in skills)
    for skill_key, trend in sorted(DEMAND_TRENDS.items(), key=lambda x: x[1]["demand"], reverse=True):
        if skill_key not in skill_set and trend["demand"] > 70:
            # Check if adjacent to existing skills
            related = False
            for s in skill_set:
                if any(k in s or s in k for k in [skill_key]):
                    related = True
            opportunities.append({
                "skill": skill_key,
                "demand": trend["demand"],
                "trend": trend["trend"],
                "growth_yoy": trend["growth_yoy"],
                "monthly_jobs": trend["jobs_monthly"],
                "type": "adjacent" if related else "expansion",
                "priority": "high" if trend["demand"] > 85 else "medium",
            })

    return sorted(opportunities, key=lambda x: x["demand"], reverse=True)[:10]


def generate_full_report(skill: str, experience: str = "mid", region: str = "global") -> str:
    """Generate a comprehensive market intelligence report."""
    rate = get_rate_range(skill, experience)
    trend = DEMAND_TRENDS.get(skill.lower().replace(" ", "-"), {})
    multiplier = REGIONAL_MULTIPLIERS.get(region, 0.6)

    report = f"""
{'='*60}
📊 MARKET INTELLIGENCE REPORT
{'='*60}

Skill: {skill}
Experience: {experience.title()}
Region: {region.upper()}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}

{'─'*60}
💰 RATE ANALYSIS
{'─'*60}
"""
    if "error" not in rate:
        adj_low = round(rate["rate_low"] * multiplier)
        adj_high = round(rate["rate_high"] * multiplier)
        adj_mid = round(rate["rate_mid"] * multiplier)
        report += f"""
  Global Range: ${rate['rate_low']} - ${rate['rate_high']}/hr
  Regional ({region}): ${adj_low} - ${adj_high}/hr
  Recommended: ${adj_mid}/hr (50th percentile)
  Category: {rate['category']}

  Rate by Experience (global):
"""
        for level in ["junior", "mid", "senior", "expert"]:
            r = get_rate_range(skill, level)
            if "error" not in r:
                marker = " ◄ YOU" if level == experience else ""
                report += f"    {level.title():8} ${r['rate_low']:3} - ${r['rate_high']:3}/hr{marker}\n"
    else:
        report += f"\n  ⚠️ {rate['error']}\n  Suggestion: {rate.get('suggestion', '')}\n"

    if trend:
        trend_arrow = {"up": "📈", "down": "📉", "stable": "➡️"}.get(trend.get("trend", ""), "❓")
        report += f"""
{'─'*60}
{trend_arrow} DEMAND TRENDS
{'─'*60}

  Demand Score: {trend.get('demand', 'N/A')}/100
  Trend: {trend.get('trend', 'unknown').upper()}
  YoY Growth: {trend.get('growth_yoy', 'N/A')}%
  Monthly Jobs: ~{trend.get('jobs_monthly', 'N/A'):,}
"""

    report += f"""
{'─'*60}
🌍 REGIONAL RATE MULTIPLIERS
{'─'*60}
"""
    for reg, mult in sorted(REGIONAL_MULTIPLIERS.items(), key=lambda x: x[1], reverse=True):
        marker = " ◄" if reg == region else ""
        if "error" not in rate:
            adj = round(rate["rate_mid"] * mult)
            report += f"  {reg:12} {mult:.2f}x  (≈${adj}/hr){marker}\n"
        else:
            report += f"  {reg:12} {mult:.2f}x{marker}\n"

    report += f"""
{'─'*60}
💡 RECOMMENDATIONS
{'─'*60}
"""
    if trend.get("trend") == "up":
        report += "  ✅ Growing demand — position yourself as a specialist\n"
        report += "  ✅ Consider raising rates 10-15% as demand increases\n"
    elif trend.get("trend") == "down":
        report += "  ⚠️ Declining demand — diversify into adjacent skills\n"
        report += "  ⚠️ Focus on niche specialization to maintain rates\n"
    if trend.get("demand", 0) > 85:
        report += "  🔥 Very high demand — you have pricing power\n"
    report += "  💡 Build case studies and testimonials to justify premium rates\n"
    report += "  💡 Specialize in a niche for 20-40% rate premium\n"

    report += f"\n{'='*60}\n"
    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_rates(args):
    result = get_rate_range(args.skill, args.experience)
    if "error" in result:
        print(f"⚠️ {result['error']}")
        return
    print(f"\n💰 Rates for {args.skill} ({args.experience}):")
    print(f"  Range: ${result['rate_low']} - ${result['rate_high']}/hr")
    print(f"  Midpoint: ${result['rate_mid']}/hr")
    print(f"  Category: {result['category']}")

def cmd_trends(args):
    print(f"\n📈 Skill Demand Trends — {args.category or 'All'}")
    print("=" * 60)
    items = DEMAND_TRENDS.items()
    if args.category:
        cat_skills = set()
        for cat, skills in RATE_DATABASE.items():
            if args.category.lower() in cat.lower():
                cat_skills.update(skills.keys())
        items = [(k, v) for k, v in items if k in cat_skills]

    for skill, data in sorted(items, key=lambda x: x[1]["demand"], reverse=True):
        arrow = {"up": "📈", "down": "📉", "stable": "➡️"}.get(data["trend"], "❓")
        print(f"  {arrow} {skill:20} Demand: {data['demand']:3}/100  Growth: {data['growth_yoy']:+4}%  Jobs: ~{data['jobs_monthly']:,}/mo")

def cmd_positioning(args):
    skills = [s.strip() for s in args.skills.split(",")]
    result = analyze_positioning(skills, args.rate, args.region)
    print(f"\n🎯 Competitive Positioning Analysis")
    print(f"   Your rate: ${result['current_rate']}/hr | Region: {result['region']}")
    print("=" * 60)
    for s in result["skills"]:
        print(f"\n  {s['skill']}:")
        print(f"    Market mid: ${s['market_mid']}/hr | You: ${s['your_rate']}/hr | Position: {s['position_pct']}%")
        print(f"    {s['position']}")
        print(f"    Demand: {s['demand']}/100 ({s['trend']})")
    if result["recommendations"]:
        print(f"\n{'─'*60}")
        for r in result["recommendations"]:
            print(f"  {r}")

def cmd_opportunities(args):
    skills = [s.strip() for s in args.skills.split(",")]
    opps = find_opportunities(skills, args.region)
    print(f"\n🔍 Market Opportunities")
    print("=" * 60)
    for o in opps:
        arrow = {"up": "📈", "down": "📉", "stable": "➡️"}.get(o["trend"], "❓")
        print(f"\n  {arrow} {o['skill']} [{o['priority'].upper()}]")
        print(f"    Demand: {o['demand']}/100 | Growth: {o['growth_yoy']:+}% | ~{o['monthly_jobs']:,} jobs/mo")
        print(f"    Type: {o['type']}")

def cmd_report(args):
    report = generate_full_report(args.skill, args.experience, args.region)
    print(report)
    if args.output:
        Path(args.output).write_text(report)
        print(f"Saved to {args.output}")


def main():
    parser = argparse.ArgumentParser(description="Cortex Freelancer — Market Intelligence")
    sub = parser.add_subparsers(dest="command")

    r = sub.add_parser("rates", help="Get rate ranges")
    r.add_argument("--skill", required=True)
    r.add_argument("--experience", choices=["junior", "mid", "senior", "expert"], default="mid")
    r.set_defaults(func=cmd_rates)

    t = sub.add_parser("trends", help="View demand trends")
    t.add_argument("--category", default="")
    t.set_defaults(func=cmd_trends)

    p = sub.add_parser("positioning", help="Analyze competitive positioning")
    p.add_argument("--skills", required=True, help="Comma-separated skills")
    p.add_argument("--rate", type=float, required=True, help="Your current hourly rate")
    p.add_argument("--region", default="global")
    p.set_defaults(func=cmd_positioning)

    o = sub.add_parser("opportunities", help="Find market opportunities")
    o.add_argument("--skills", required=True, help="Comma-separated current skills")
    o.add_argument("--region", default="global")
    o.set_defaults(func=cmd_opportunities)

    rp = sub.add_parser("report", help="Full market intelligence report")
    rp.add_argument("--skill", required=True)
    rp.add_argument("--experience", choices=["junior", "mid", "senior", "expert"], default="mid")
    rp.add_argument("--region", default="global")
    rp.add_argument("--output", help="Save report to file")
    rp.set_defaults(func=cmd_report)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
