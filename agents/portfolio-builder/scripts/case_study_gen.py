#!/usr/bin/env python3
"""
Case Study Generator for Freelancer Portfolios

Generates a clean, professional markdown case study from project details
provided via command-line arguments.

Usage:
    python3 case_study_gen.py --project "Website Redesign" --client "Acme" --result "2x conversions"
    python3 case_study_gen.py --project "API Migration" --client "BigCo" \\
        --challenge "Legacy SOAP API with 500+ endpoints" \\
        --solution "Incremental migration to REST with backward compat layer" \\
        --result "99.9% uptime during migration, 60% faster response times"
"""

import argparse
import re
import sys
import textwrap
from datetime import date

# ---------------------------------------------------------------------------
# Templates and defaults
# ---------------------------------------------------------------------------

DEFAULT_CHALLENGES = {
    "redesign":   "The existing system had grown organically and no longer met modern user expectations, leading to declining engagement and conversion rates.",
    "migration":  "The legacy infrastructure was becoming costly to maintain and was blocking the team from shipping new features at a competitive pace.",
    "automation": "Manual, repetitive processes were consuming significant team hours and introducing human errors that impacted quality.",
    "build":      "The client needed a new solution built from scratch under tight deadlines with evolving requirements.",
    "default":    "The client faced a critical business challenge that required a targeted, expert-led technical approach to resolve.",
}

DEFAULT_SOLUTIONS = {
    "redesign":   "Conducted a thorough UX audit, defined a modern design system, and iteratively rebuilt the interface with a mobile-first approach, validating each milestone with user testing.",
    "migration":  "Designed a phased migration plan with automated testing at each stage, ensuring zero-downtime cutover and full backward compatibility throughout the transition.",
    "automation": "Mapped existing workflows, identified bottlenecks, and implemented an automated pipeline with monitoring and alerting to ensure reliability.",
    "build":      "Applied an agile methodology with two-week sprints, continuous stakeholder feedback, and automated CI/CD to deliver a production-ready solution on schedule.",
    "default":    "Delivered a tailored solution through close collaboration with the client, iterative development, and rigorous quality assurance.",
}


def _detect_project_type(project_name: str) -> str:
    """Guess project type from the name for smarter defaults."""
    name = project_name.lower()
    if any(w in name for w in ("redesign", "revamp", "overhaul", "ui", "ux")):
        return "redesign"
    if any(w in name for w in ("migrat", "upgrade", "port")):
        return "migration"
    if any(w in name for w in ("automat", "pipeline", "workflow", "bot")):
        return "automation"
    if any(w in name for w in ("build", "develop", "create", "launch", "mvp", "app")):
        return "build"
    return "default"


def _parse_results(result_text: str) -> list[str]:
    """Split a result string into individual bullet-point items."""
    # Split on commas, semicolons, or newlines
    items = re.split(r"[;\n]+|,\s*(?=[A-Z0-9])", result_text)
    items = [i.strip().rstrip(".") for i in items if i.strip()]
    return items if items else [result_text.strip()]


def _generate_takeaways(project: str, results: list[str], challenge: str, solution: str) -> list[str]:
    """Generate plausible key takeaways based on available information."""
    takeaways: list[str] = []

    # Result-based takeaway
    if results:
        takeaways.append(
            f"Measurable impact matters: the project delivered concrete outcomes "
            f"including {results[0].lower()}."
        )

    # Process-based takeaway
    process_keywords = {
        "agile": "Agile methodology enabled rapid iteration and stakeholder alignment.",
        "automat": "Automation reduced manual effort and improved consistency.",
        "test":  "Rigorous testing ensured quality and confidence throughout delivery.",
        "collaborat": "Close collaboration with the client was essential to understanding evolving needs.",
        "phase": "A phased approach minimized risk and allowed for course corrections.",
        "iterati": "Iterative delivery kept the project aligned with real user needs.",
    }
    combined = f"{challenge} {solution}".lower()
    for kw, msg in process_keywords.items():
        if kw in combined:
            takeaways.append(msg)
            break
    else:
        takeaways.append(
            "Clear communication and well-defined milestones kept the project on track."
        )

    # Domain takeaway
    takeaways.append(
        f"Domain expertise in {_detect_project_type(project).replace('default', 'the problem space')} "
        f"was critical to choosing the right approach."
    )

    return takeaways[:3]


# ---------------------------------------------------------------------------
# Markdown generation
# ---------------------------------------------------------------------------

def generate_case_study(
    project: str,
    client: str,
    challenge: str | None,
    solution: str | None,
    result: str,
) -> str:
    """Return a complete markdown case study string."""

    ptype = _detect_project_type(project)
    challenge = challenge or DEFAULT_CHALLENGES[ptype]
    solution = solution or DEFAULT_SOLUTIONS[ptype]
    results = _parse_results(result)
    takeaways = _generate_takeaways(project, results, challenge, solution)
    today = date.today().strftime("%B %Y")

    lines: list[str] = []

    # Title
    lines.append(f"# Case Study: {project}")
    lines.append("")
    lines.append(f"**Client:** {client}  ")
    lines.append(f"**Date:** {today}  ")
    lines.append("")

    # Overview
    lines.append("---")
    lines.append("")
    lines.append("## Overview")
    lines.append("")
    lines.append(
        f"{client} engaged our services to tackle a critical initiative: "
        f"**{project}**. This case study outlines the challenge, the approach "
        f"taken, and the measurable results delivered."
    )
    lines.append("")

    # Client
    lines.append("## Client")
    lines.append("")
    lines.append(
        f"{client} needed a trusted partner who could understand their business "
        f"context, move quickly, and deliver quality work that drives real outcomes."
    )
    lines.append("")

    # Challenge
    lines.append("## Challenge")
    lines.append("")
    lines.append(challenge)
    lines.append("")

    # Solution
    lines.append("## Solution")
    lines.append("")
    lines.append(solution)
    lines.append("")

    # Results
    lines.append("## Results")
    lines.append("")
    for r in results:
        # Capitalize first letter
        r_fmt = r[0].upper() + r[1:] if r else r
        lines.append(f"- **{r_fmt}**")
    lines.append("")

    # Key Takeaways
    lines.append("## Key Takeaways")
    lines.append("")
    for i, t in enumerate(takeaways, 1):
        lines.append(f"{i}. {t}")
    lines.append("")

    # Footer
    lines.append("---")
    lines.append("")
    lines.append(
        f"*This case study was prepared to highlight the work done on "
        f"{project} for {client}.*"
    )
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_output(markdown: str, output_path: str | None) -> None:
    """Write markdown to file or stdout."""
    if output_path:
        try:
            with open(output_path, "w", encoding="utf-8") as fh:
                fh.write(markdown)
            print(f"Case study written to: {output_path}", file=sys.stderr)
        except PermissionError:
            print(f"Error: Permission denied writing to {output_path}", file=sys.stderr)
            sys.exit(1)
        except OSError as exc:
            print(f"Error writing file: {exc}", file=sys.stderr)
            sys.exit(1)
    else:
        print(markdown)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a professional markdown case study from project details.",
        epilog=textwrap.dedent("""\
            Examples:
              python3 case_study_gen.py --project "Website Redesign" --client "Acme" --result "2x conversions"

              python3 case_study_gen.py \\
                --project "API Migration" \\
                --client "BigCo" \\
                --challenge "Legacy SOAP API with 500+ endpoints" \\
                --solution "Phased REST migration with backward compat" \\
                --result "99.9% uptime; 60% faster responses" \\
                --output case_study.md
        """),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--project", "-p",
        required=True,
        help="Name of the project (e.g., 'Website Redesign').",
    )
    parser.add_argument(
        "--client", "-c",
        required=True,
        help="Client or company name.",
    )
    parser.add_argument(
        "--challenge",
        default=None,
        help="Description of the problem/challenge. If omitted, a smart default is generated based on the project name.",
    )
    parser.add_argument(
        "--solution",
        default=None,
        help="Description of the solution delivered. If omitted, a smart default is generated.",
    )
    parser.add_argument(
        "--result", "-r",
        required=True,
        help="Key results achieved (comma or semicolon separated for multiple).",
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output file path. If omitted, prints to stdout.",
    )

    args = parser.parse_args()

    # Validate inputs
    if not args.project.strip():
        print("Error: --project cannot be empty.", file=sys.stderr)
        sys.exit(1)
    if not args.client.strip():
        print("Error: --client cannot be empty.", file=sys.stderr)
        sys.exit(1)
    if not args.result.strip():
        print("Error: --result cannot be empty.", file=sys.stderr)
        sys.exit(1)

    markdown = generate_case_study(
        project=args.project.strip(),
        client=args.client.strip(),
        challenge=args.challenge.strip() if args.challenge else None,
        solution=args.solution.strip() if args.solution else None,
        result=args.result.strip(),
    )

    write_output(markdown, args.output)


if __name__ == "__main__":
    main()
