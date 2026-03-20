#!/usr/bin/env python3
"""
Proposal Tracker — Track sent proposals and analyze win rates.

Usage:
    python3 proposal_tracker.py add --title "E-commerce Site" --platform upwork --bid 2000 --date 2026-03-20
    python3 proposal_tracker.py add --title "API Integration" --platform toptal --bid 3500 --category backend
    python3 proposal_tracker.py update --id 1 --status won
    python3 proposal_tracker.py update --id 2 --status lost --notes "Client went with cheaper option"
    python3 proposal_tracker.py list
    python3 proposal_tracker.py stats
    python3 proposal_tracker.py insights
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict

# Data file path relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "..", "..", "data")
DATA_FILE = os.path.join(DATA_DIR, "proposals.json")

VALID_STATUSES = ["pending", "won", "lost", "no-response", "interview"]
VALID_PLATFORMS = ["upwork", "toptal", "fiverr", "freelancer", "linkedin", "direct", "other"]


def ensure_data_file():
    """Create data directory and file if they don't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w") as f:
            json.dump([], f)


def load_proposals():
    """Load proposals from JSON file."""
    ensure_data_file()
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def save_proposals(proposals):
    """Save proposals to JSON file."""
    ensure_data_file()
    with open(DATA_FILE, "w") as f:
        json.dump(proposals, f, indent=2)


def get_next_id(proposals):
    """Get the next available ID."""
    if not proposals:
        return 1
    return max(p["id"] for p in proposals) + 1


def cmd_add(args):
    """Add a new proposal."""
    proposals = load_proposals()
    proposal = {
        "id": get_next_id(proposals),
        "title": args.title,
        "platform": args.platform.lower(),
        "bid": args.bid,
        "date": args.date or datetime.now().strftime("%Y-%m-%d"),
        "status": "pending",
        "category": args.category or "general",
        "notes": args.notes or "",
    }
    proposals.append(proposal)
    save_proposals(proposals)
    print(f"✓ Proposal #{proposal['id']} added: \"{proposal['title']}\" on {proposal['platform']} — ${proposal['bid']}")


def cmd_update(args):
    """Update a proposal's status."""
    proposals = load_proposals()
    found = False
    for p in proposals:
        if p["id"] == args.id:
            if args.status:
                p["status"] = args.status
            if args.notes:
                p["notes"] = args.notes
            if args.bid:
                p["bid"] = args.bid
            save_proposals(proposals)
            print(f"✓ Proposal #{p['id']} updated → status: {p['status']}")
            found = True
            break
    if not found:
        print(f"✗ Proposal #{args.id} not found.")
        sys.exit(1)


def cmd_list(args):
    """List all proposals."""
    proposals = load_proposals()
    if not proposals:
        print("No proposals yet. Use 'add' to track your first proposal.")
        return

    # Optional filters
    if args.status:
        proposals = [p for p in proposals if p["status"] == args.status]
    if args.platform:
        proposals = [p for p in proposals if p["platform"] == args.platform.lower()]

    status_icons = {
        "pending": "⏳",
        "won": "✅",
        "lost": "❌",
        "no-response": "😶",
        "interview": "🎤",
    }

    print(f"\n{'ID':<4} {'Date':<12} {'Platform':<12} {'Bid':>8} {'Status':<14} {'Title'}")
    print("-" * 75)
    for p in sorted(proposals, key=lambda x: x["date"], reverse=True):
        icon = status_icons.get(p["status"], "?")
        print(f"{p['id']:<4} {p['date']:<12} {p['platform']:<12} ${p['bid']:>7,.0f} {icon} {p['status']:<10} {p['title']}")
    print(f"\nTotal: {len(proposals)} proposals")


def cmd_stats(args):
    """Show proposal statistics."""
    proposals = load_proposals()
    if not proposals:
        print("No proposals yet.")
        return

    total = len(proposals)
    won = [p for p in proposals if p["status"] == "won"]
    lost = [p for p in proposals if p["status"] == "lost"]
    pending = [p for p in proposals if p["status"] == "pending"]
    interviews = [p for p in proposals if p["status"] == "interview"]
    no_response = [p for p in proposals if p["status"] == "no-response"]

    # Only count decided proposals for win rate
    decided = len(won) + len(lost)
    win_rate = (len(won) / decided * 100) if decided > 0 else 0
    response_rate = ((decided + len(interviews)) / total * 100) if total > 0 else 0
    avg_bid = sum(p["bid"] for p in proposals) / total if total > 0 else 0
    avg_won_bid = sum(p["bid"] for p in won) / len(won) if won else 0
    total_won_value = sum(p["bid"] for p in won)

    print("\n📊 PROPOSAL STATISTICS")
    print("=" * 40)
    print(f"Total sent:       {total}")
    print(f"Won:              {len(won)}")
    print(f"Lost:             {len(lost)}")
    print(f"Pending:          {len(pending)}")
    print(f"Interview:        {len(interviews)}")
    print(f"No response:      {len(no_response)}")
    print(f"\nWin rate:         {win_rate:.1f}%")
    print(f"Response rate:    {response_rate:.1f}%")
    print(f"Avg bid:          ${avg_bid:,.0f}")
    print(f"Avg winning bid:  ${avg_won_bid:,.0f}")
    print(f"Total won value:  ${total_won_value:,.0f}")

    # By platform
    print("\n📈 BY PLATFORM")
    print("-" * 40)
    by_platform = defaultdict(list)
    for p in proposals:
        by_platform[p["platform"]].append(p)

    for platform, props in sorted(by_platform.items()):
        p_won = sum(1 for p in props if p["status"] == "won")
        p_decided = sum(1 for p in props if p["status"] in ("won", "lost"))
        p_rate = (p_won / p_decided * 100) if p_decided > 0 else 0
        p_avg = sum(p["bid"] for p in props) / len(props)
        print(f"  {platform:<12} {len(props):>3} sent | {p_won} won | {p_rate:>5.1f}% win rate | avg ${p_avg:,.0f}")

    # By category
    print("\n📂 BY CATEGORY")
    print("-" * 40)
    by_category = defaultdict(list)
    for p in proposals:
        by_category[p.get("category", "general")].append(p)

    for category, props in sorted(by_category.items()):
        c_won = sum(1 for p in props if p["status"] == "won")
        c_decided = sum(1 for p in props if p["status"] in ("won", "lost"))
        c_rate = (c_won / c_decided * 100) if c_decided > 0 else 0
        print(f"  {category:<15} {len(props):>3} sent | {c_won} won | {c_rate:>5.1f}% win rate")


def cmd_insights(args):
    """Analyze patterns and provide actionable insights."""
    proposals = load_proposals()
    if len(proposals) < 3:
        print("Need at least 3 proposals to generate insights. Keep tracking!")
        return

    won = [p for p in proposals if p["status"] == "won"]
    lost = [p for p in proposals if p["status"] == "lost"]

    print("\n💡 PROPOSAL INSIGHTS")
    print("=" * 50)

    # Winning bid range
    if won:
        won_bids = [p["bid"] for p in won]
        print(f"\n🎯 Winning Bid Range: ${min(won_bids):,.0f} – ${max(won_bids):,.0f}")
        print(f"   Sweet spot (avg): ${sum(won_bids)/len(won_bids):,.0f}")

    # Lost bid analysis
    if lost and won:
        avg_won = sum(p["bid"] for p in won) / len(won)
        avg_lost = sum(p["bid"] for p in lost) / len(lost)
        if avg_lost > avg_won:
            print(f"\n⚠️  Lost proposals averaged ${avg_lost:,.0f} vs won at ${avg_won:,.0f}")
            print("   → Consider lowering bids or adding more value justification")
        else:
            print(f"\n✅ Lost proposals (${avg_lost:,.0f}) bid lower than won (${avg_won:,.0f})")
            print("   → Price isn't the issue — focus on proposal quality")

    # Best performing categories
    by_category = defaultdict(list)
    for p in proposals:
        by_category[p.get("category", "general")].append(p)

    best_cat = None
    best_rate = 0
    for cat, props in by_category.items():
        decided = [p for p in props if p["status"] in ("won", "lost")]
        if len(decided) >= 2:
            rate = sum(1 for p in decided if p["status"] == "won") / len(decided)
            if rate > best_rate:
                best_rate = rate
                best_cat = cat

    if best_cat:
        print(f"\n🏆 Best category: '{best_cat}' ({best_rate*100:.0f}% win rate)")
        print(f"   → Double down on {best_cat} projects")

    # Best platform
    by_platform = defaultdict(list)
    for p in proposals:
        by_platform[p["platform"]].append(p)

    best_plat = None
    best_plat_rate = 0
    for plat, props in by_platform.items():
        decided = [p for p in props if p["status"] in ("won", "lost")]
        if len(decided) >= 2:
            rate = sum(1 for p in decided if p["status"] == "won") / len(decided)
            if rate > best_plat_rate:
                best_plat_rate = rate
                best_plat = plat

    if best_plat:
        print(f"\n🌐 Best platform: '{best_plat}' ({best_plat_rate*100:.0f}% win rate)")
        print(f"   → Prioritize {best_plat} for higher ROI on time spent")

    # Response time pattern
    no_response = [p for p in proposals if p["status"] == "no-response"]
    if no_response:
        nr_pct = len(no_response) / len(proposals) * 100
        print(f"\n📬 No-response rate: {nr_pct:.0f}% ({len(no_response)}/{len(proposals)})")
        if nr_pct > 50:
            print("   → High ghosting rate. Try: better subject lines, shorter proposals, faster response")
        elif nr_pct > 30:
            print("   → Moderate ghosting. Consider following up after 3 days")

    # Volume trend
    dates = sorted(set(p["date"][:7] for p in proposals))
    if len(dates) >= 2:
        print(f"\n📅 Activity span: {dates[0]} to {dates[-1]} ({len(dates)} months active)")
        monthly_counts = defaultdict(int)
        for p in proposals:
            monthly_counts[p["date"][:7]] += 1
        recent = list(monthly_counts.values())[-1] if monthly_counts else 0
        avg_monthly = len(proposals) / len(dates)
        print(f"   Avg proposals/month: {avg_monthly:.1f} | This month: {recent}")

    print()


def main():
    parser = argparse.ArgumentParser(
        description="Track freelance proposals and analyze win rates.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  proposal_tracker.py add --title 'E-commerce Site' --platform upwork --bid 2000\n"
               "  proposal_tracker.py update --id 1 --status won\n"
               "  proposal_tracker.py stats\n"
               "  proposal_tracker.py insights",
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Add command
    add_parser = subparsers.add_parser("add", help="Add a new proposal")
    add_parser.add_argument("--title", required=True, help="Job/project title")
    add_parser.add_argument("--platform", required=True, choices=VALID_PLATFORMS, help="Platform name")
    add_parser.add_argument("--bid", required=True, type=float, help="Bid amount in USD")
    add_parser.add_argument("--date", help="Date submitted (YYYY-MM-DD, default: today)")
    add_parser.add_argument("--category", help="Project category (e.g., backend, frontend, fullstack)")
    add_parser.add_argument("--notes", help="Additional notes")

    # Update command
    update_parser = subparsers.add_parser("update", help="Update a proposal")
    update_parser.add_argument("--id", required=True, type=int, help="Proposal ID")
    update_parser.add_argument("--status", choices=VALID_STATUSES, help="New status")
    update_parser.add_argument("--notes", help="Update notes")
    update_parser.add_argument("--bid", type=float, help="Update bid amount")

    # List command
    list_parser = subparsers.add_parser("list", help="List proposals")
    list_parser.add_argument("--status", choices=VALID_STATUSES, help="Filter by status")
    list_parser.add_argument("--platform", choices=VALID_PLATFORMS, help="Filter by platform")

    # Stats command
    subparsers.add_parser("stats", help="Show proposal statistics")

    # Insights command
    subparsers.add_parser("insights", help="Analyze patterns and get actionable insights")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "add": cmd_add,
        "update": cmd_update,
        "list": cmd_list,
        "stats": cmd_stats,
        "insights": cmd_insights,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
