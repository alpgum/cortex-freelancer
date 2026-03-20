#!/usr/bin/env python3
"""Generate a weekly business summary report for Cortex Freelancer."""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict


def find_project_root():
    """Find the cortex-freelancer project root."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
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


def section_revenue_by_client(earnings_data):
    """Render revenue by client breakdown."""
    lines = ["## Revenue by Client", ""]
    if earnings_data is None:
        lines.append("No data yet -- run the finance-manager agent to populate `data/earnings.json`.")
        lines.append("")
        return "\n".join(lines)

    by_client = defaultdict(float)

    if isinstance(earnings_data, list):
        for entry in earnings_data:
            client = entry.get("client", "Unassigned")
            amount = float(entry.get("amount", 0))
            by_client[client] += amount
    elif isinstance(earnings_data, dict):
        clients = earnings_data.get("by_client", {})
        if isinstance(clients, dict):
            by_client.update(clients)
        else:
            by_client["Total"] = float(earnings_data.get("total", 0))

    if not by_client:
        lines.append("No revenue data recorded this week.")
    else:
        lines.append("| Client | Revenue |")
        lines.append("|--------|---------|")
        total = 0.0
        for client, amount in sorted(by_client.items(), key=lambda x: -x[1]):
            lines.append(f"| {client} | ${amount:.2f} |")
            total += amount
        lines.append(f"| **Total** | **${total:.2f}** |")

    lines.append("")
    return "\n".join(lines)


def section_hours_and_rate(earnings_data):
    """Render hours worked and effective rate."""
    lines = ["## Hours & Effective Rate", ""]
    if earnings_data is None:
        lines.append("No data yet -- run the finance-manager agent to populate `data/earnings.json`.")
        lines.append("")
        return "\n".join(lines)

    total_hours = 0.0
    total_revenue = 0.0

    if isinstance(earnings_data, list):
        for entry in earnings_data:
            total_hours += float(entry.get("hours", 0))
            total_revenue += float(entry.get("amount", 0))
    elif isinstance(earnings_data, dict):
        total_hours = float(earnings_data.get("hours", 0))
        total_revenue = float(earnings_data.get("total", 0))

    effective_rate = total_revenue / total_hours if total_hours > 0 else 0

    lines.append(f"- **Hours worked:** {total_hours:.1f}h")
    lines.append(f"- **Total revenue:** ${total_revenue:.2f}")
    lines.append(f"- **Effective hourly rate:** ${effective_rate:.2f}/hr")
    lines.append("")
    return "\n".join(lines)


def section_proposals(data):
    """Render proposals sent/won section."""
    lines = ["## Proposals", ""]
    if data is None:
        lines.append("No data yet -- run the business-dev agent to populate `data/matches.json`.")
        lines.append("")
        return "\n".join(lines)

    if isinstance(data, list):
        total = len(data)
        won = len([m for m in data if m.get("status") == "won"])
        pending = len([m for m in data if m.get("status") in ("sent", "pending", "applied")])
        rejected = len([m for m in data if m.get("status") in ("rejected", "declined")])
        win_rate = (won / total * 100) if total > 0 else 0

        lines.append(f"- **Proposals sent:** {total}")
        lines.append(f"- **Won:** {won}")
        lines.append(f"- **Pending:** {pending}")
        lines.append(f"- **Rejected:** {rejected}")
        lines.append(f"- **Win rate:** {win_rate:.0f}%")
    elif isinstance(data, dict):
        sent = data.get("sent", 0)
        won = data.get("won", 0)
        win_rate = (won / sent * 100) if sent > 0 else 0
        lines.append(f"- **Proposals sent:** {sent}")
        lines.append(f"- **Won:** {won}")
        lines.append(f"- **Win rate:** {win_rate:.0f}%")
    else:
        lines.append("No proposal data available.")

    lines.append("")
    return "\n".join(lines)


def section_invoices_outstanding(data):
    """Render outstanding invoices summary."""
    lines = ["## Invoices Outstanding", ""]
    if data is None:
        lines.append("No data yet -- run the finance-manager agent to populate `data/invoices.json`.")
        lines.append("")
        return "\n".join(lines)

    if isinstance(data, list):
        outstanding = [inv for inv in data if inv.get("status", "") in ("pending", "sent", "overdue")]
        if not outstanding:
            lines.append("No outstanding invoices. All caught up!")
        else:
            total = 0.0
            overdue_total = 0.0
            lines.append("| Client | Amount | Status | Due Date |")
            lines.append("|--------|--------|--------|----------|")
            for inv in outstanding:
                client = inv.get("client", "Unknown")
                amount = float(inv.get("amount", 0))
                status = inv.get("status", "pending")
                due = inv.get("due_date", "N/A")
                total += amount
                if status == "overdue":
                    overdue_total += amount
                lines.append(f"| {client} | ${amount:.2f} | {status} | {due} |")
            lines.append("")
            lines.append(f"**Total outstanding:** ${total:.2f}")
            if overdue_total > 0:
                lines.append(f"**Overdue:** ${overdue_total:.2f}")
    else:
        lines.append("Unexpected invoice data format.")

    lines.append("")
    return "\n".join(lines)


def generate_report(data_dir, week_label):
    """Generate the full weekly report."""
    sections = [
        f"# Weekly Business Report",
        f"_{week_label}_",
        "",
        section_revenue_by_client(load_json(os.path.join(data_dir, "earnings.json"))),
        section_hours_and_rate(load_json(os.path.join(data_dir, "earnings.json"))),
        section_proposals(load_json(os.path.join(data_dir, "matches.json"))),
        section_invoices_outstanding(load_json(os.path.join(data_dir, "invoices.json"))),
        "---",
        "_Generated by Cortex Freelancer weekly_report.py_",
    ]
    return "\n".join(sections)


def main():
    parser = argparse.ArgumentParser(
        description="Generate a weekly business summary report.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python3 weekly_report.py\n  python3 weekly_report.py --data-dir ./data --output report.md",
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
    parser.add_argument(
        "--week",
        default=None,
        help="Week label, e.g. '2026-W12' (default: current week)",
    )
    args = parser.parse_args()

    data_dir = args.data_dir if args.data_dir else find_data_dir()

    if not os.path.isdir(data_dir):
        print(f"Note: Data directory '{data_dir}' not found. Showing placeholders.", file=sys.stderr)

    if args.week:
        week_label = f"Week {args.week}"
    else:
        now = datetime.now()
        week_start = now - timedelta(days=now.weekday())
        week_end = week_start + timedelta(days=6)
        week_label = f"Week of {week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}"

    report = generate_report(data_dir, week_label)

    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(report + "\n")
            print(f"Report written to {args.output}")
        except OSError as e:
            print(f"Error writing to {args.output}: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(report)


if __name__ == "__main__":
    main()
