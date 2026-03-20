#!/usr/bin/env python3
"""
Cortex Freelancer — Competitor Analyzer
Estimate job competition and recommend bidding strategy.

Usage:
    python3 competitor_analyzer.py --proposals 15 --budget 3000 --posted-hours-ago 2 --skill-rarity medium
    python3 competitor_analyzer.py --proposals 40 --budget 500 --posted-hours-ago 24 --skill-rarity low
"""

import argparse
import sys


SKILL_RARITY_MULTIPLIERS = {
    "low": {"label": "Common (HTML/CSS, WordPress, Data Entry)", "competition_mult": 1.5, "rate_mult": 0.8},
    "medium": {"label": "Moderate (React, Python, Node.js)", "competition_mult": 1.0, "rate_mult": 1.0},
    "high": {"label": "Specialized (ML, Blockchain, DevOps)", "competition_mult": 0.6, "rate_mult": 1.3},
    "rare": {"label": "Rare (Rust, Solidity, FPGA, Niche Domain)", "competition_mult": 0.4, "rate_mult": 1.6},
}


def assess_competition_level(proposals, budget, posted_hours_ago, skill_rarity):
    """Assess competition level and return analysis."""
    rarity = SKILL_RARITY_MULTIPLIERS[skill_rarity]
    velocity = proposals / max(posted_hours_ago, 0.5)

    base_score = min(proposals * 2, 60)

    if velocity > 10:
        velocity_score = 30
    elif velocity > 5:
        velocity_score = 20
    elif velocity > 2:
        velocity_score = 10
    else:
        velocity_score = 5

    if budget < 500:
        budget_score = 15
    elif budget < 1000:
        budget_score = 10
    elif budget < 5000:
        budget_score = 5
    else:
        budget_score = 0

    raw_score = base_score + velocity_score + budget_score
    adjusted_score = raw_score * rarity["competition_mult"]
    competition_score = min(round(adjusted_score), 100)

    if competition_score >= 70:
        level = "HIGH"
    elif competition_score >= 40:
        level = "MODERATE"
    else:
        level = "LOW"

    return {
        "score": competition_score,
        "level": level,
        "velocity": round(velocity, 1),
        "rarity": rarity,
    }


def estimate_bid_range(budget, proposals, skill_rarity):
    """Estimate optimal bid range based on competition."""
    rarity = SKILL_RARITY_MULTIPLIERS[skill_rarity]

    if budget > 0:
        low_mult = 0.7 if proposals > 20 else 0.85
        high_mult = 1.0 if proposals > 20 else 1.2

        low_mult *= rarity["rate_mult"]
        high_mult *= rarity["rate_mult"]

        low_bid = round(budget * low_mult, -1)
        high_bid = round(budget * high_mult, -1)
        sweet_spot = round((low_bid + high_bid) / 2, -1)

        return {"low": max(low_bid, 50), "high": high_bid, "sweet_spot": sweet_spot}

    return {"low": 0, "high": 0, "sweet_spot": 0}


def generate_differentiation_tips(competition_level, budget, skill_rarity, proposals):
    """Generate tips for standing out based on competition analysis."""
    tips = []

    if competition_level == "HIGH":
        tips.append("Lead with a specific result you've achieved in a similar project (numbers > adjectives)")
        tips.append("Include a 2-3 sentence mini-plan showing you understand their problem")
        tips.append("Offer a small discovery/audit phase to lower their risk")
        if budget > 2000:
            tips.append("Consider milestone-based pricing to show confidence")
        tips.append("Respond within 1 hour of posting for best visibility")
    elif competition_level == "MODERATE":
        tips.append("Highlight relevant portfolio piece with measurable outcome")
        tips.append("Ask one smart question that shows domain expertise")
        tips.append("Propose a clear timeline with deliverables")
        if skill_rarity in ("high", "rare"):
            tips.append("Emphasize your specialized skills — fewer competitors can match them")
    else:
        tips.append("Low competition — you have leverage. Don't underbid.")
        tips.append("Focus on quality and thoroughness in your proposal")
        if skill_rarity in ("high", "rare"):
            tips.append("Your skill rarity is your moat — price accordingly")
        tips.append("Consider proposing an expanded scope if the project has growth potential")

    if proposals > 30:
        tips.append("With 30+ proposals, the client is overwhelmed. Keep yours scannable and concise.")
    if proposals < 5:
        tips.append("Few proposals = client may be new or job is niche. Personalize heavily.")

    return tips


def main():
    parser = argparse.ArgumentParser(
        description="Estimate job competition and get bidding strategy advice.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  competitor_analyzer.py --proposals 15 --budget 3000 --posted-hours-ago 2 --skill-rarity medium\n"
               "  competitor_analyzer.py --proposals 40 --budget 500 --posted-hours-ago 24 --skill-rarity low",
    )
    parser.add_argument("--proposals", type=int, required=True, help="Number of proposals already submitted")
    parser.add_argument("--budget", type=float, required=True, help="Job budget in USD")
    parser.add_argument("--posted-hours-ago", type=float, required=True, help="Hours since job was posted")
    parser.add_argument("--skill-rarity", required=True, choices=["low", "medium", "high", "rare"],
                        help="Rarity of required skills (low/medium/high/rare)")

    args = parser.parse_args()

    if args.proposals < 0:
        print("Error: --proposals must be >= 0.")
        sys.exit(1)
    if args.budget < 0:
        print("Error: --budget must be >= 0.")
        sys.exit(1)
    if args.posted_hours_ago < 0:
        print("Error: --posted-hours-ago must be >= 0.")
        sys.exit(1)

    analysis = assess_competition_level(args.proposals, args.budget, args.posted_hours_ago, args.skill_rarity)
    bid_range = estimate_bid_range(args.budget, args.proposals, args.skill_rarity)
    tips = generate_differentiation_tips(analysis["level"], args.budget, args.skill_rarity, args.proposals)

    print("\n" + "=" * 55)
    print(" COMPETITION ANALYSIS")
    print("=" * 55)

    print(f"\n  Job Budget:       ${args.budget:,.0f}")
    print(f"  Proposals:        {args.proposals}")
    print(f"  Posted:           {args.posted_hours_ago:.1f} hours ago")
    print(f"  Skill Rarity:     {analysis['rarity']['label']}")
    print(f"  Proposal Velocity: {analysis['velocity']} proposals/hour")

    score = analysis["score"]
    bar_len = 20
    filled = int(score / 100 * bar_len)
    bar = "#" * filled + "." * (bar_len - filled)
    print(f"\n  Competition: [{bar}] {score}/100 — {analysis['level']}")

    if analysis["level"] == "HIGH":
        print("  This job is highly competitive. You need a standout proposal.")
    elif analysis["level"] == "MODERATE":
        print("  Manageable competition. A strong, focused proposal will do well.")
    else:
        print("  Low competition. Great opportunity — don't undervalue yourself.")

    if bid_range["sweet_spot"] > 0:
        print(f"\n  ESTIMATED BID RANGE")
        print(f"  ---")
        print(f"  Low:        ${bid_range['low']:,.0f}")
        print(f"  Sweet Spot: ${bid_range['sweet_spot']:,.0f}")
        print(f"  High:       ${bid_range['high']:,.0f}")

    print(f"\n  DIFFERENTIATION TIPS")
    print(f"  ---")
    for i, tip in enumerate(tips, 1):
        print(f"  {i}. {tip}")

    print(f"\n  TIMING")
    print(f"  ---")
    if args.posted_hours_ago < 1:
        print("  Just posted! Apply immediately for maximum visibility.")
    elif args.posted_hours_ago < 6:
        print("  Still fresh. Apply within the next hour.")
    elif args.posted_hours_ago < 24:
        print("  Getting older. If your proposal is strong, still worth applying.")
    else:
        print("  Stale posting. Only apply if it's a perfect match for your skills.")

    print(f"\n{'='*55}\n")


if __name__ == "__main__":
    main()
