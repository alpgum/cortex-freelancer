#!/usr/bin/env python3
"""
Cortex Freelancer — Status Report Generator
Generates client-ready weekly status reports from projects.json.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta


DATA_FILE = os.environ.get("CORTEX_PROJECTS_FILE", "projects.json")


def load_projects() -> dict:
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {"projects": []}


def find_project(data: dict, query: str) -> dict:
    query_lower = query.lower()
    for p in data["projects"]:
        if p["id"] == query or p["name"].lower() == query_lower:
            return p
    for p in data["projects"]:
        if query_lower in p["name"].lower():
            return p
    return None


def generate_report(project: dict, week_start: datetime = None) -> str:
    """Generate a markdown status report for a project."""
    today = datetime.now()
    if week_start is None:
        # Default to current week (Monday)
        week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    milestones = project.get("milestones", [])
    completed = [m for m in milestones if m["status"] == "completed"]
    pending = [m for m in milestones if m["status"] == "pending"]
    in_progress = [m for m in milestones if m.get("status") == "in_progress"]

    # Calculate progress
    total = len(milestones)
    done = len(completed)
    progress_pct = int((done / total * 100)) if total > 0 else 0

    # Determine timeline status
    try:
        deadline = datetime.strptime(project["deadline"], "%Y-%m-%d")
        days_remaining = (deadline.date() - today.date()).days
        if days_remaining < 0:
            timeline_status = f"**Overdue** by {abs(days_remaining)} days"
        elif days_remaining <= 7:
            timeline_status = f"**Due soon** — {days_remaining} days remaining"
        else:
            timeline_status = f"**On track** — {days_remaining} days remaining"
    except (ValueError, KeyError):
        timeline_status = "Timeline not set"
        days_remaining = None

    # Build report
    report = []
    report.append(f"# Weekly Status Report — {project['name']}")
    report.append(f"")
    report.append(f"**Client:** {project.get('client', 'N/A')}")
    report.append(f"**Report Date:** {today.strftime('%B %d, %Y')}")
    report.append(f"**Week:** {week_start.strftime('%b %d')} — {week_end.strftime('%b %d, %Y')}")
    report.append(f"**Overall Progress:** {progress_pct}% ({done}/{total} milestones complete)")
    report.append(f"**Timeline:** {timeline_status}")
    report.append(f"")

    # Completed
    report.append("## Completed")
    if completed:
        for m in completed:
            date = m.get("completed_date", "")
            report.append(f"- {m['name']} (completed {date})")
    else:
        report.append("- No milestones completed yet")
    report.append("")

    # In Progress
    report.append("## In Progress")
    if in_progress or pending:
        items = in_progress if in_progress else pending[:2]
        for m in items:
            report.append(f"- {m['name']} — due {m.get('deadline', 'TBD')}")
    else:
        report.append("- No active work items")
    report.append("")

    # Coming Up
    report.append("## Coming Up Next")
    future = [m for m in pending if m not in (in_progress or pending[:2])]
    if future:
        for m in future[:3]:
            report.append(f"- {m['name']} — due {m.get('deadline', 'TBD')}")
    else:
        report.append("- All milestones are in progress or completed")
    report.append("")

    # Blockers
    report.append("## Blockers")
    report.append("- None at this time")
    report.append("")
    report.append("*If any blockers arise, I'll flag them immediately rather than waiting for the next report.*")
    report.append("")

    # Next Steps
    report.append("## Next Steps")
    if pending:
        next_ms = pending[0]
        report.append(f"1. Complete **{next_ms['name']}** by {next_ms.get('deadline', 'TBD')}")
        report.append(f"2. Send updated deliverable for review")
        if len(pending) > 1:
            report.append(f"3. Begin work on **{pending[1]['name']}**")
    else:
        report.append("1. Final review and project closeout")
        report.append("2. Handoff documentation")
    report.append("")

    report.append("---")
    report.append(f"*Questions or priority changes? Let me know and I'll adjust the plan.*")

    return "\n".join(report)


def generate_all_reports(data: dict) -> str:
    """Generate reports for all active projects."""
    active = [p for p in data["projects"] if p["status"] == "active"]
    if not active:
        return "No active projects found."

    reports = []
    for p in active:
        reports.append(generate_report(p))
        reports.append("\n\n---\n\n")
    return "\n".join(reports)


def main():
    global DATA_FILE

    parser = argparse.ArgumentParser(
        description="Cortex Freelancer — Status Report Generator. Creates client-ready weekly reports.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --project "Website Redesign"
  %(prog)s --all
  %(prog)s --project "Website Redesign" --output report.md
        """
    )
    parser.add_argument("--project", type=str, help="Project name or ID")
    parser.add_argument("--all", action="store_true", help="Generate reports for all active projects")
    parser.add_argument("--output", type=str, help="Save report to file (default: stdout)")
    parser.add_argument("--data-file", type=str, help="Projects JSON file (default: projects.json)")

    args = parser.parse_args()

    if args.data_file:
        DATA_FILE = args.data_file

    if not args.project and not args.all:
        parser.print_help()
        print("\nError: Provide --project or --all")
        sys.exit(1)

    data = load_projects()

    if not data["projects"]:
        print("No projects found. Use deadline_tracker.py to add projects first.")
        sys.exit(1)

    if args.all:
        report = generate_all_reports(data)
    else:
        project = find_project(data, args.project)
        if not project:
            print(f"Error: Project '{args.project}' not found.")
            print("Available projects:")
            for p in data["projects"]:
                print(f"  - {p['name']} ({p['id']})")
            sys.exit(1)
        report = generate_report(project)

    if args.output:
        with open(args.output, "w") as f:
            f.write(report)
        print(f"Report saved to: {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
