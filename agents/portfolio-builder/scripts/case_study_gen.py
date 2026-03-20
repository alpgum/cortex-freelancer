#!/usr/bin/env python3
"""
Case Study Generator — Portfolio Builder Agent
Generates formatted case studies from project details.

Usage:
    python3 case_study_gen.py --client "Acme Corp" --industry "SaaS" \
        --problem "Low conversion rate" --solution "Redesigned landing pages" \
        --result "47% increase in signups"
    python3 case_study_gen.py --from-json project.json
"""

import argparse
import json
import sys
from datetime import datetime


def generate_case_study(client, industry, problem, solution, result, timeline=None,
                        tech=None, testimonial=None, testimonial_author=None, your_name=None, **kwargs):
    lines = []
    result_first = result.split(',')[0].strip()
    lines.append(f"# How We Achieved {result_first} for {client}")
    lines.append("")
    lines.append(f"*Case study by {your_name or '[YOUR_NAME]'} | {datetime.now().strftime('%B %Y')}*")
    lines.append("")

    lines.append("## The Client")
    lines.append(f"**{client}** — A company in the **{industry}** space.")
    lines.append("")

    lines.append("## The Challenge")
    lines.append(f"{client} was facing a critical issue:")
    lines.append("")
    for p in [x.strip() for x in problem.replace(';', ',').split(',') if x.strip()]:
        lines.append(f"- {p[0].upper() + p[1:]}")
    lines.append("")

    lines.append("## The Solution")
    lines.append("**My approach:**")
    lines.append("")
    for i, s in enumerate([x.strip() for x in solution.replace(';', ',').split(',') if x.strip()], 1):
        lines.append(f"{i}. {s[0].upper() + s[1:]}")
    lines.append("")

    if tech:
        lines.append(f"**Tools & technologies:** {tech}")
        lines.append("")

    lines.append("## The Results")
    lines.append("")
    lines.append("| Metric | Result |")
    lines.append("|--------|--------|")
    for r in [x.strip() for x in result.replace(';', ',').split(',') if x.strip()]:
        if ':' in r:
            k, v = r.split(':', 1)
            lines.append(f"| {k.strip()} | **{v.strip()}** |")
        else:
            lines.append(f"| Key Result | **{r}** |")
    lines.append("")

    if timeline:
        lines.append(f"**Timeline:** {timeline}")
        lines.append("")

    if testimonial:
        lines.append("## Client Testimonial")
        lines.append(f'> "{testimonial}"')
        if testimonial_author:
            lines.append(f"> — **{testimonial_author}**, {client}")
        lines.append("")

    lines.append("---")
    lines.append(f"**Have a similar challenge?** I help {industry} companies achieve results like these. [Get in touch →]")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate a formatted case study.")
    parser.add_argument("--client", help="Client name")
    parser.add_argument("--industry", help="Client industry")
    parser.add_argument("--problem", help="Challenge faced")
    parser.add_argument("--solution", help="What you did (comma-separated)")
    parser.add_argument("--result", help="Results achieved (comma-separated)")
    parser.add_argument("--timeline", help="Project timeline")
    parser.add_argument("--tech", help="Tools used")
    parser.add_argument("--testimonial", help="Client quote")
    parser.add_argument("--testimonial-author", help="Quote author")
    parser.add_argument("--your-name", help="Your name")
    parser.add_argument("--from-json", help="Load from JSON file")
    parser.add_argument("--output", help="Output file (default: stdout)")
    args = parser.parse_args()

    if args.from_json:
        with open(args.from_json) as f:
            data = json.load(f)
        cs = generate_case_study(**data)
    elif args.client and args.industry and args.problem and args.solution and args.result:
        cs = generate_case_study(
            client=args.client, industry=args.industry, problem=args.problem,
            solution=args.solution, result=args.result, timeline=args.timeline,
            tech=args.tech, testimonial=args.testimonial,
            testimonial_author=args.testimonial_author, your_name=args.your_name)
    else:
        parser.error("Provide all required args or use --from-json")

    if args.output:
        with open(args.output, 'w') as f:
            f.write(cs)
        print(f"✓ Saved to {args.output}")
    else:
        print(cs)


if __name__ == "__main__":
    main()
