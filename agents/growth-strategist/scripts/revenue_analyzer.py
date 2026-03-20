#!/usr/bin/env python3
"""
Revenue Analyzer for Freelancers

Reads a JSON file of client data and produces profitability analysis,
effective hourly rates, 80/20 revenue breakdown, and actionable recommendations.

Usage:
    python3 revenue_analyzer.py --data clients.json
"""

import argparse
import json
import sys


def load_clients(path: str) -> list[dict]:
    """Load and validate client data from a JSON file."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {path}: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(data, list):
        print("Error: JSON root must be an array of client objects.", file=sys.stderr)
        sys.exit(1)

    clients = []
    for i, entry in enumerate(data):
        if not isinstance(entry, dict):
            print(f"Warning: Skipping entry {i} (not an object).", file=sys.stderr)
            continue

        name = entry.get("name")
        earnings = entry.get("earnings")
        hours = entry.get("hours")

        if name is None:
            print(f"Warning: Skipping entry {i} (missing 'name').", file=sys.stderr)
            continue
        if earnings is None:
            print(f"Warning: Skipping client '{name}' (missing 'earnings').", file=sys.stderr)
            continue
        if hours is None:
            print(f"Warning: Skipping client '{name}' (missing 'hours').", file=sys.stderr)
            continue

        try:
            earnings = float(earnings)
            hours = float(hours)
        except (ValueError, TypeError):
            print(f"Warning: Skipping client '{name}' (non-numeric earnings/hours).", file=sys.stderr)
            continue

        if earnings < 0:
            print(f"Warning: Client '{name}' has negative earnings (${earnings:.2f}).", file=sys.stderr)
        if hours < 0:
            print(f"Warning: Skipping client '{name}' (negative hours).", file=sys.stderr)
            continue

        clients.append({"name": str(name), "earnings": earnings, "hours": hours})

    if not clients:
        print("Error: No valid client records found.", file=sys.stderr)
        sys.exit(1)

    return clients


def calculate_rates(clients: list[dict]) -> list[dict]:
    """Calculate effective hourly rate for each client."""
    results = []
    for c in clients:
        if c["hours"] == 0:
            rate = float("inf")
        else:
            rate = c["earnings"] / c["hours"]
        results.append({**c, "rate": rate})
    return results


def pareto_analysis(clients: list[dict]) -> dict:
    """Identify which ~20% of clients produce ~80% of revenue."""
    total_earnings = sum(c["earnings"] for c in clients)
    if total_earnings == 0:
        return {"top_clients": [], "top_earnings": 0, "top_pct": 0, "total_earnings": 0}

    sorted_by_earnings = sorted(clients, key=lambda c: c["earnings"], reverse=True)
    top_count = max(1, round(len(sorted_by_earnings) * 0.2))
    top_clients = sorted_by_earnings[:top_count]
    top_earnings = sum(c["earnings"] for c in top_clients)
    top_pct = (top_earnings / total_earnings) * 100

    return {
        "top_clients": top_clients,
        "top_earnings": top_earnings,
        "top_pct": top_pct,
        "total_earnings": total_earnings,
        "top_count": top_count,
        "total_count": len(sorted_by_earnings),
    }


def generate_recommendations(clients: list[dict], pareto: dict) -> list[str]:
    """Generate actionable recommendations based on the analysis."""
    recs = []
    rates = [c["rate"] for c in clients if c["rate"] != float("inf")]

    if not rates:
        return ["Insufficient data to generate rate-based recommendations."]

    avg_rate = sum(rates) / len(rates)
    median_rate = sorted(rates)[len(rates) // 2]

    # Identify low-value clients (below 50% of median rate)
    low_value = [c for c in clients if c["rate"] != float("inf") and c["rate"] < median_rate * 0.5]
    if low_value:
        names = ", ".join(c["name"] for c in low_value)
        recs.append(
            f"RAISE RATES OR DROP: {names} -- these clients pay below 50% of your "
            f"median rate (${median_rate:.2f}/hr). Renegotiate or phase them out."
        )

    # Identify high-volume, low-rate clients
    high_hours = sorted(clients, key=lambda c: c["hours"], reverse=True)
    for c in high_hours[:3]:
        if c["rate"] != float("inf") and c["rate"] < avg_rate:
            recs.append(
                f"RENEGOTIATE: '{c['name']}' takes {c['hours']:.0f} hours but pays "
                f"only ${c['rate']:.2f}/hr (avg is ${avg_rate:.2f}/hr). "
                f"A rate increase here would have outsized impact."
            )

    # Pareto insight
    if pareto["top_pct"] > 60:
        top_names = ", ".join(c["name"] for c in pareto["top_clients"])
        recs.append(
            f"DOUBLE DOWN: Top {pareto['top_count']} client(s) ({top_names}) generate "
            f"{pareto['top_pct']:.0f}% of revenue. Prioritize retention and upselling."
        )

    # Zero-hours clients (fixed-fee or retainer)
    zero_hour = [c for c in clients if c["hours"] == 0]
    if zero_hour:
        names = ", ".join(c["name"] for c in zero_hour)
        recs.append(
            f"TRACK HOURS: {names} -- recorded 0 hours. "
            f"Start tracking time to understand true profitability."
        )

    # General advice
    if avg_rate < 15:
        recs.append(
            f"OVERALL RATE LOW: Your average effective rate is ${avg_rate:.2f}/hr. "
            f"Consider specializing or repositioning to command higher rates."
        )

    if not recs:
        recs.append("Your client portfolio looks healthy. Keep optimizing!")

    return recs


def print_report(clients: list[dict], pareto: dict, recommendations: list[str]) -> None:
    """Print the full analysis report to stdout."""
    sep = "=" * 72

    print(sep)
    print("  FREELANCER REVENUE ANALYSIS REPORT")
    print(sep)

    # Summary
    total_earnings = sum(c["earnings"] for c in clients)
    total_hours = sum(c["hours"] for c in clients)
    blended_rate = total_earnings / total_hours if total_hours > 0 else 0
    print(f"\n  Clients analyzed:    {len(clients)}")
    print(f"  Total earnings:      ${total_earnings:,.2f}")
    print(f"  Total hours:         {total_hours:,.1f}")
    print(f"  Blended hourly rate: ${blended_rate:,.2f}/hr")

    # Per-client breakdown sorted by rate
    print(f"\n{sep}")
    print("  CLIENT PROFITABILITY (sorted by effective hourly rate)")
    print(sep)
    print(f"  {'Client':<25} {'Earnings':>12} {'Hours':>8} {'$/hr':>10}")
    print(f"  {'-'*25} {'-'*12} {'-'*8} {'-'*10}")

    sorted_clients = sorted(
        clients,
        key=lambda c: c["rate"] if c["rate"] != float("inf") else float("inf"),
        reverse=True,
    )
    for c in sorted_clients:
        rate_str = "N/A (0 hrs)" if c["rate"] == float("inf") else f"${c['rate']:,.2f}"
        print(f"  {c['name']:<25} ${c['earnings']:>10,.2f} {c['hours']:>8.1f} {rate_str:>10}")

    # 80/20 analysis
    print(f"\n{sep}")
    print("  80/20 (PARETO) ANALYSIS")
    print(sep)
    print(f"\n  Top {pareto['top_count']} of {pareto['total_count']} clients "
          f"({pareto['top_count']/pareto['total_count']*100:.0f}%) produce "
          f"${pareto['top_earnings']:,.2f} of ${pareto['total_earnings']:,.2f} "
          f"({pareto['top_pct']:.1f}%) of total revenue.\n")
    print(f"  {'Client':<25} {'Earnings':>12} {'% of Total':>12}")
    print(f"  {'-'*25} {'-'*12} {'-'*12}")
    for c in pareto["top_clients"]:
        pct = (c["earnings"] / pareto["total_earnings"]) * 100 if pareto["total_earnings"] else 0
        print(f"  {c['name']:<25} ${c['earnings']:>10,.2f} {pct:>10.1f}%")

    # Recommendations
    print(f"\n{sep}")
    print("  RECOMMENDATIONS")
    print(sep)
    for i, rec in enumerate(recommendations, 1):
        print(f"\n  {i}. {rec}")

    print(f"\n{sep}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Analyze freelancer revenue data: profitability, hourly rates, 80/20 analysis, and recommendations.",
        epilog="Example: python3 revenue_analyzer.py --data clients.json",
    )
    parser.add_argument(
        "--data",
        required=True,
        metavar="FILE",
        help="Path to a JSON file containing an array of client objects with 'name', 'earnings', and 'hours' fields.",
    )
    args = parser.parse_args()

    clients = load_clients(args.data)
    clients = calculate_rates(clients)
    pareto = pareto_analysis(clients)
    recommendations = generate_recommendations(clients, pareto)
    print_report(clients, pareto, recommendations)


if __name__ == "__main__":
    main()
