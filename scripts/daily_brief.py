#!/usr/bin/env python3
"""Generate a morning briefing for the Cortex Freelancer platform."""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta


def find_project_root():
    """Find the cortex-freelancer project root."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # scripts/ is one level below project root
    return os.path.dirname(script_dir)


def find_data_dir():
    """Locate the data directory relative to project root."""
    root = find_project_root()
    candidates = [
        os.path.join(root, "data"),
        os.path.join(root, "..", "data"),
    ]
    for candidate in candidates:
        if os.path.isdir(candidate):
            return os.path.abspath(candidate)
    # Default to root/data even if it doesn't exist yet
    return os.path.join(root, "data")


def load_json(filepath):
    """Load a JSON file, returning None if it doesn't exist or is invalid."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        print(f"Warning: {filepath} contains invalid JSON, skipping.", file=sys.stderr)
        return None
    except OSError as e:
        print(f"Warning: Could not read {filepath}: {e}", file=sys.stderr)
        return None


def section_deadlines(data):
    """Render today's deadlines section."""
    lines = ["## Today's Deadlines", ""]
    if data is None:
        lines.append("No data yet -- run the project-manager agent to populate `data/deadlines.json`.")
        lines.append("")
        return "\n".join(lines)

    today = datetime.now().strftime("%Y-%m-%d")
    if isinstance(data, list):
        today_items = [d for d in data if d.get("due_date", "") == today]
    else:
        today_items = []

    if not today_items:
        lines.append("No deadlines for today. You're clear!")
    else:
        for item in today_items:
            client = item.get("client", "Unknown")
            task = item.get("task", "Untitled")
            priority = item.get("priority", "normal")
            marker = "!!!" if priority == "high" else ""
            lines.append(f"- **{task}** ({client}) {marker}")

    lines.append("")
    return "\n".join(lines)


def section_invoices(data):
    """Render pending invoices section."""
    lines = ["## Pending Invoices", ""]
    if data is None:
        lines.append("No data yet -- run the finance-manager agent to populate `data/invoices.json`.")
        lines.append("")
        return "\n".join(lines)

    if isinstance(data, list):
        pending = [inv for inv in data if inv.get("status", "") in ("pending", "sent", "overdue")]
    else:
        pending = []

    if not pending:
        lines.append("All invoices are paid. Nice work!")
    else:
        total = 0.0
        for inv in pending:
            client = inv.get("client", "Unknown")
            amount = inv.get("amount", 0)
            status = inv.get("status", "pending")
            total += float(amount)
            lines.append(f"- {client}: ${amount:.2f} ({status})")
        lines.append(f"\n**Total outstanding: ${total:.2f}**")

    lines.append("")
    return "\n".join(lines)


def section_matches(data):
    """Render new job matches section."""
    lines = ["## New Job Matches", ""]
    if data is None:
        lines.append("No data yet -- run the business-dev agent to populate `data/matches.json`.")
        lines.append("")
        return "\n".join(lines)

    if isinstance(data, list) and data:
        for match in data[:5]:
            title = match.get("title", "Untitled")
            budget = match.get("budget", "N/A")
            platform = match.get("platform", "")
            score = match.get("match_score", "")
            score_str = f" ({score}% match)" if score else ""
            lines.append(f"- **{title}** -- ${budget} on {platform}{score_str}")
        if len(data) > 5:
            lines.append(f"\n_...and {len(data) - 5} more matches._")
    else:
        lines.append("No new job matches today.")

    lines.append("")
    return "\n".join(lines)


def section_earnings(data):
    """Render weekly earnings section."""
    lines = ["## Earnings This Week", ""]
    if data is None:
        lines.append("No data yet -- run the finance-manager agent to populate `data/earnings.json`.")
        lines.append("")
        return "\n".join(lines)

    if isinstance(data, dict):
        total = data.get("total", 0)
        hours = data.get("hours", 0)
        rate = total / hours if hours > 0 else 0
        lines.append(f"- **Total earned:** ${total:.2f}")
        lines.append(f"- **Hours logged:** {hours:.1f}h")
        lines.append(f"- **Effective rate:** ${rate:.2f}/hr")
    elif isinstance(data, list):
        total = sum(float(e.get("amount", 0)) for e in data)
        hours = sum(float(e.get("hours", 0)) for e in data)
        rate = total / hours if hours > 0 else 0
        lines.append(f"- **Total earned:** ${total:.2f}")
        lines.append(f"- **Hours logged:** {hours:.1f}h")
        lines.append(f"- **Effective rate:** ${rate:.2f}/hr")
    else:
        lines.append("No earnings data available.")

    lines.append("")
    return "\n".join(lines)


def generate_brief(data_dir):
    """Generate the full morning briefing."""
    now = datetime.now()
    greeting = "Good morning" if now.hour < 12 else ("Good afternoon" if now.hour < 17 else "Good evening")

    sections = [
        f"# {greeting}! Daily Briefing",
        f"_{now.strftime('%A, %B %d, %Y')}_",
        "",
        section_deadlines(load_json(os.path.join(data_dir, "deadlines.json"))),
        section_invoices(load_json(os.path.join(data_dir, "invoices.json"))),
        section_matches(load_json(os.path.join(data_dir, "matches.json"))),
        section_earnings(load_json(os.path.join(data_dir, "earnings.json"))),
        "---",
        "_Generated by Cortex Freelancer daily_brief.py_",
    ]
    return "\n".join(sections)


def main():
    parser = argparse.ArgumentParser(
        description="Generate a morning briefing for your freelance business.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python3 daily_brief.py\n  python3 daily_brief.py --data-dir ./my_data --output brief.md",
    )
    parser.add_argument(
        "--data-dir",
        default=None,
        help="Path to the data directory (default: auto-detect from project root)",
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Write output to a file instead of stdout",
    )
    args = parser.parse_args()

    data_dir = args.data_dir if args.data_dir else find_data_dir()

    if not os.path.isdir(data_dir):
        print(f"Note: Data directory '{data_dir}' not found. Showing placeholders.", file=sys.stderr)

    brief = generate_brief(data_dir)

    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(brief + "\n")
            print(f"Briefing written to {args.output}")
        except OSError as e:
            print(f"Error writing to {args.output}: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(brief)


if __name__ == "__main__":
    main()
