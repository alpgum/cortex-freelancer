#!/usr/bin/env python3
"""Capacity planner for freelancers managing multiple projects.

Calculates total committed hours, remaining capacity, utilization percentage,
and warns about overcommitment.

Usage:
    python3 capacity_planner.py --hours 40 --projects '[{"name":"Site","hrs":15},{"name":"App","hrs":20}]'
    python3 capacity_planner.py --hours 35 --projects projects.json
"""

import argparse
import json
import os
import sys

ADMIN_BUFFER_PERCENT = 15  # recommended minimum free percentage


def load_projects(raw):
    """Parse a JSON array of projects from a string or file path.

    Each project must have 'name' (str) and 'hrs' (number).
    Returns a list of dicts.
    """
    # If it looks like a file path and the file exists, read from file.
    if not raw.lstrip().startswith("[") and os.path.isfile(raw):
        try:
            with open(raw, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            print("Error: Failed to parse JSON from file '{}': {}".format(raw, e), file=sys.stderr)
            sys.exit(1)
        except OSError as e:
            print("Error: Could not read file '{}': {}".format(raw, e), file=sys.stderr)
            sys.exit(1)
    else:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            print("Error: Invalid JSON string: {}".format(e), file=sys.stderr)
            print('Expected format: \'[{"name":"Project","hrs":10}]\'', file=sys.stderr)
            sys.exit(1)

    if not isinstance(data, list):
        print("Error: Projects must be a JSON array.", file=sys.stderr)
        sys.exit(1)

    projects = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            print("Error: Project at index {} is not an object.".format(i), file=sys.stderr)
            sys.exit(1)
        name = item.get("name")
        hrs = item.get("hrs")
        if name is None or hrs is None:
            print('Error: Project at index {} must have "name" and "hrs" fields.'.format(i), file=sys.stderr)
            sys.exit(1)
        try:
            hrs = float(hrs)
        except (TypeError, ValueError):
            print('Error: "hrs" for project "{}" must be a number.'.format(name), file=sys.stderr)
            sys.exit(1)
        if hrs < 0:
            print('Error: "hrs" for project "{}" cannot be negative.'.format(name), file=sys.stderr)
            sys.exit(1)
        projects.append({"name": str(name), "hrs": hrs})

    return projects


def main():
    parser = argparse.ArgumentParser(
        description="Freelancer capacity planner. Shows committed hours, remaining capacity, and overcommitment warnings.",
        epilog='Example: python3 capacity_planner.py --hours 40 --projects \'[{"name":"Site","hrs":15},{"name":"App","hrs":20}]\'',
    )
    parser.add_argument(
        "--hours",
        type=float,
        default=40,
        help="Weekly hour capacity (default: 40)",
    )
    parser.add_argument(
        "--projects",
        required=True,
        help='JSON array of projects or path to a JSON file. Each project: {"name":"X","hrs":N}',
    )
    args = parser.parse_args()

    if args.hours <= 0:
        print("Error: --hours must be a positive number.", file=sys.stderr)
        sys.exit(1)

    projects = load_projects(args.projects)

    if not projects:
        print("No projects provided. You have full capacity available!")
        sys.exit(0)

    total_committed = sum(p["hrs"] for p in projects)
    remaining = args.hours - total_committed
    utilization = (total_committed / args.hours) * 100
    admin_buffer_hrs = args.hours * (ADMIN_BUFFER_PERCENT / 100)
    effective_capacity = args.hours - admin_buffer_hrs
    effective_remaining = effective_capacity - total_committed

    print("=" * 60)
    print("  CAPACITY PLANNER")
    print("=" * 60)
    print()
    print("  Weekly capacity:      {:.1f}h".format(args.hours))
    print("  Total committed:      {:.1f}h".format(total_committed))
    print("  Remaining:            {:.1f}h".format(remaining))
    print("  Utilization:          {:.1f}%".format(utilization))
    print()

    # Per-project breakdown
    print("-" * 60)
    print("  PROJECT BREAKDOWN")
    print("-" * 60)
    print()
    print("  {:<25} {:>8} {:>15}".format("Project", "Hours", "% of Capacity"))
    print("  {} {} {}".format("-" * 25, "-" * 8, "-" * 15))
    for p in sorted(projects, key=lambda x: x["hrs"], reverse=True):
        pct = (p["hrs"] / args.hours) * 100
        bar_len = int(pct / 5)
        bar = "#" * bar_len
        print("  {:<25} {:>7.1f}h {:>13.1f}%  {}".format(p["name"], p["hrs"], pct, bar))
    print("  {:25} {:>8}".format("", "------"))
    print("  {:<25} {:>7.1f}h".format("TOTAL", total_committed))
    print()

    # Warnings and recommendations
    print("-" * 60)
    print("  STATUS & RECOMMENDATIONS")
    print("-" * 60)
    print()

    if utilization > 100:
        print("  !! OVERCOMMITTED by {:.1f}h !!".format(abs(remaining)))
        print("     You are at {:.1f}% utilization.".format(utilization))
        print("     Consider dropping or reducing a project.")
    elif utilization > 85:
        print("  ** WARNING: High utilization ({:.1f}%) **".format(utilization))
        print("     Only {:.1f}h remaining. Little room for unexpected work.".format(remaining))
    else:
        print("  OK: Utilization is at {:.1f}%.".format(utilization))

    print()
    print("  Admin/buffer recommendation: Keep {}-20% free".format(ADMIN_BUFFER_PERCENT))
    print("    Recommended buffer:  {:.1f}h (={}% of {:.1f}h)".format(
        admin_buffer_hrs, ADMIN_BUFFER_PERCENT, args.hours))

    if effective_remaining < 0:
        print("    Effective remaining: {:.1f}h (over effective capacity!)".format(effective_remaining))
        print("    You have NO buffer for admin tasks, meetings, or unexpected work.")
    elif effective_remaining < admin_buffer_hrs * 0.5:
        print("    Effective remaining: {:.1f}h (thin buffer)".format(effective_remaining))
        print("    Consider keeping more time free for admin and unexpected tasks.")
    else:
        print("    Effective remaining: {:.1f}h".format(effective_remaining))

    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
