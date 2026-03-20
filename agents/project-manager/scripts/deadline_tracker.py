#!/usr/bin/env python3
"""
Cortex Freelancer — Deadline Tracker
Manages freelance projects, milestones, and deadlines.
Stores everything in a local JSON file.
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path


DATA_FILE = os.environ.get("CORTEX_PROJECTS_FILE", "projects.json")


def load_projects() -> dict:
    """Load projects from JSON file."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {"projects": []}


def save_projects(data: dict):
    """Save projects to JSON file."""
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def gen_id() -> str:
    return uuid.uuid4().hex[:8]


def parse_date(date_str: str) -> str:
    """Parse various date formats into ISO format."""
    formats = ["%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%B %d, %Y", "%b %d, %Y"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Relative dates
    today = datetime.now()
    lower = date_str.lower().strip()
    if lower == "today":
        return today.strftime("%Y-%m-%d")
    if lower == "tomorrow":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    if lower.endswith("days") or lower.endswith("d"):
        days = int("".join(filter(str.isdigit, lower)))
        return (today + timedelta(days=days)).strftime("%Y-%m-%d")
    if lower.endswith("weeks") or lower.endswith("w"):
        weeks = int("".join(filter(str.isdigit, lower)))
        return (today + timedelta(weeks=weeks)).strftime("%Y-%m-%d")

    return date_str  # Return as-is if unparseable


def cmd_add(args):
    """Add a new project."""
    data = load_projects()

    project = {
        "id": gen_id(),
        "name": args.project,
        "client": args.client or "Unspecified",
        "deadline": parse_date(args.deadline),
        "status": "active",
        "budget": args.budget or "Not set",
        "milestones": [],
        "created": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "notes": args.notes or "",
    }

    data["projects"].append(project)
    save_projects(data)
    print(f"  Added project: {project['name']}")
    print(f"  Deadline: {project['deadline']}  |  Client: {project['client']}")
    print(f"  ID: {project['id']}")


def cmd_add_milestone(args):
    """Add a milestone to a project."""
    data = load_projects()

    project = find_project(data, args.project)
    if not project:
        print(f"  Error: Project '{args.project}' not found.")
        sys.exit(1)

    milestone = {
        "id": gen_id(),
        "name": args.milestone,
        "deadline": parse_date(args.deadline),
        "status": "pending",
        "amount": args.amount or "Not set",
    }

    project["milestones"].append(milestone)
    save_projects(data)
    print(f"  Added milestone: {milestone['name']}")
    print(f"  Project: {project['name']}  |  Due: {milestone['deadline']}")


def cmd_complete(args):
    """Mark a project or milestone as completed."""
    data = load_projects()
    project = find_project(data, args.project)
    if not project:
        print(f"  Error: Project '{args.project}' not found.")
        sys.exit(1)

    if args.milestone:
        for ms in project["milestones"]:
            if args.milestone.lower() in ms["name"].lower() or args.milestone == ms["id"]:
                ms["status"] = "completed"
                ms["completed_date"] = datetime.now().strftime("%Y-%m-%d")
                save_projects(data)
                print(f"  Completed milestone: {ms['name']}")
                return
        print(f"  Error: Milestone '{args.milestone}' not found in {project['name']}.")
    else:
        project["status"] = "completed"
        project["completed_date"] = datetime.now().strftime("%Y-%m-%d")
        save_projects(data)
        print(f"  Completed project: {project['name']}")


def cmd_status(args):
    """Show project status and upcoming deadlines."""
    data = load_projects()

    if not data["projects"]:
        print("  No projects tracked yet. Use 'add' to create one.")
        return

    today = datetime.now().date()
    week_out = today + timedelta(days=7)

    active = [p for p in data["projects"] if p["status"] == "active"]
    completed = [p for p in data["projects"] if p["status"] == "completed"]

    print(f"\n{'='*60}")
    print(f" PROJECT STATUS DASHBOARD")
    print(f" {today.strftime('%A, %B %d, %Y')}")
    print(f"{'='*60}\n")

    # Overdue items
    overdue = []
    for p in active:
        try:
            dl = datetime.strptime(p["deadline"], "%Y-%m-%d").date()
            if dl < today:
                overdue.append(("PROJECT", p["name"], p["deadline"], p["client"]))
        except (ValueError, KeyError):
            pass
        for ms in p.get("milestones", []):
            if ms["status"] == "pending":
                try:
                    msdl = datetime.strptime(ms["deadline"], "%Y-%m-%d").date()
                    if msdl < today:
                        overdue.append(("MILESTONE", f"{p['name']} → {ms['name']}", ms["deadline"], p["client"]))
                except (ValueError, KeyError):
                    pass

    if overdue:
        print(" ⚠ OVERDUE:")
        for item_type, name, deadline, client in overdue:
            days_late = (today - datetime.strptime(deadline, "%Y-%m-%d").date()).days
            print(f"   [{item_type}] {name} — {days_late} days late (due {deadline})")
        print()

    # Upcoming (next 7 days)
    upcoming = []
    for p in active:
        try:
            dl = datetime.strptime(p["deadline"], "%Y-%m-%d").date()
            if today <= dl <= week_out:
                upcoming.append(("PROJECT", p["name"], p["deadline"], p["client"]))
        except (ValueError, KeyError):
            pass
        for ms in p.get("milestones", []):
            if ms["status"] == "pending":
                try:
                    msdl = datetime.strptime(ms["deadline"], "%Y-%m-%d").date()
                    if today <= msdl <= week_out:
                        upcoming.append(("MILESTONE", f"{p['name']} → {ms['name']}", ms["deadline"], p["client"]))
                except (ValueError, KeyError):
                    pass

    if upcoming:
        print(" UPCOMING (Next 7 Days):")
        upcoming.sort(key=lambda x: x[2])
        for item_type, name, deadline, client in upcoming:
            days_left = (datetime.strptime(deadline, "%Y-%m-%d").date() - today).days
            label = "TODAY" if days_left == 0 else f"in {days_left}d"
            print(f"   [{item_type}] {name} — {deadline} ({label})")
        print()

    # Active projects
    print(f" ACTIVE PROJECTS ({len(active)}):")
    for p in active:
        milestone_count = len(p.get("milestones", []))
        done_count = sum(1 for m in p.get("milestones", []) if m["status"] == "completed")
        progress = f"{done_count}/{milestone_count} milestones" if milestone_count else "No milestones"
        print(f"   {p['name']}")
        print(f"     Client: {p['client']}  |  Deadline: {p['deadline']}  |  {progress}")
        if p.get("budget") and p["budget"] != "Not set":
            print(f"     Budget: {p['budget']}")
        for ms in p.get("milestones", []):
            status_icon = "x" if ms["status"] == "completed" else " "
            print(f"       [{status_icon}] {ms['name']} — {ms['deadline']} ({ms['status']})")
        print()

    if completed:
        print(f" COMPLETED ({len(completed)}):")
        for p in completed:
            print(f"   {p['name']} — completed {p.get('completed_date', 'N/A')}")
        print()

    print(f"{'='*60}")


def cmd_daily(args):
    """Generate a daily task list."""
    data = load_projects()
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    this_week = today + timedelta(days=7)

    active = [p for p in data["projects"] if p["status"] == "active"]

    print(f"\n{'='*50}")
    print(f" DAILY TASK LIST — {today.strftime('%A, %B %d')}")
    print(f"{'='*50}\n")

    tasks_today = []
    tasks_this_week = []

    for p in active:
        for ms in p.get("milestones", []):
            if ms["status"] != "pending":
                continue
            try:
                dl = datetime.strptime(ms["deadline"], "%Y-%m-%d").date()
            except ValueError:
                continue

            task = f"{p['name']} → {ms['name']} (due {ms['deadline']})"
            if dl <= tomorrow:
                tasks_today.append(task)
            elif dl <= this_week:
                tasks_this_week.append(task)

        try:
            pdl = datetime.strptime(p["deadline"], "%Y-%m-%d").date()
            if pdl <= tomorrow:
                tasks_today.append(f"{p['name']} — FINAL DEADLINE")
        except ValueError:
            pass

    if tasks_today:
        print(" DO TODAY:")
        for t in tasks_today:
            print(f"   [ ] {t}")
        print()

    if tasks_this_week:
        print(" THIS WEEK:")
        for t in tasks_this_week:
            print(f"   [ ] {t}")
        print()

    if not tasks_today and not tasks_this_week:
        print(" No pressing deadlines. Use this time to:")
        print("   [ ] Follow up on pending reviews")
        print("   [ ] Send status updates to active clients")
        print("   [ ] Work ahead on upcoming milestones")
        print()

    print(f"{'='*50}")


def cmd_remove(args):
    """Remove a project."""
    data = load_projects()
    project = find_project(data, args.project)
    if not project:
        print(f"  Error: Project '{args.project}' not found.")
        sys.exit(1)

    data["projects"].remove(project)
    save_projects(data)
    print(f"  Removed project: {project['name']}")


def find_project(data: dict, query: str) -> dict:
    """Find a project by name or ID (fuzzy match)."""
    query_lower = query.lower()
    for p in data["projects"]:
        if p["id"] == query or p["name"].lower() == query_lower:
            return p
    # Partial match
    for p in data["projects"]:
        if query_lower in p["name"].lower():
            return p
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Cortex Freelancer — Deadline Tracker. Manage projects, milestones, and deadlines.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s add --project "Website Redesign" --client "Acme Corp" --deadline 2026-04-15
  %(prog)s add-milestone --project "Website Redesign" --milestone "Wireframes" --deadline 2026-03-25
  %(prog)s complete --project "Website Redesign" --milestone "Wireframes"
  %(prog)s status
  %(prog)s daily
        """
    )

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # Add project
    p_add = sub.add_parser("add", help="Add a new project")
    p_add.add_argument("--project", required=True, help="Project name")
    p_add.add_argument("--client", help="Client name")
    p_add.add_argument("--deadline", required=True, help="Deadline (YYYY-MM-DD or relative like '2weeks')")
    p_add.add_argument("--budget", help="Project budget")
    p_add.add_argument("--notes", help="Additional notes")

    # Add milestone
    p_ms = sub.add_parser("add-milestone", help="Add milestone to a project")
    p_ms.add_argument("--project", required=True, help="Project name or ID")
    p_ms.add_argument("--milestone", required=True, help="Milestone name")
    p_ms.add_argument("--deadline", required=True, help="Milestone deadline")
    p_ms.add_argument("--amount", help="Milestone payment amount")

    # Complete
    p_done = sub.add_parser("complete", help="Mark project or milestone as completed")
    p_done.add_argument("--project", required=True, help="Project name or ID")
    p_done.add_argument("--milestone", help="Milestone name or ID (omit to complete entire project)")

    # Status
    sub.add_parser("status", help="Show all projects and upcoming deadlines")

    # Daily
    sub.add_parser("daily", help="Generate today's task list")

    # Remove
    p_rm = sub.add_parser("remove", help="Remove a project")
    p_rm.add_argument("--project", required=True, help="Project name or ID")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    commands = {
        "add": cmd_add,
        "add-milestone": cmd_add_milestone,
        "complete": cmd_complete,
        "status": cmd_status,
        "daily": cmd_daily,
        "remove": cmd_remove,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
