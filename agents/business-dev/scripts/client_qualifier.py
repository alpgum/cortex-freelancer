#!/usr/bin/env python3
"""
Cortex Freelancer — Client Qualifier
Score potential clients before bidding to avoid time-wasters.

Usage:
    python3 client_qualifier.py --hire-rate 85 --jobs-posted 23 --total-spent 15000 --member-since 2020 --payment-verified yes
    python3 client_qualifier.py --hire-rate 30 --jobs-posted 2 --total-spent 500 --member-since 2025
"""

import argparse
import sys
from datetime import datetime


def score_payment_reliability(hire_rate, total_spent, payment_verified, jobs_posted):
    """Score payment reliability 0-10."""
    score = 0
    reasons = []

    if payment_verified:
        score += 3
        reasons.append("Payment method verified")
    else:
        reasons.append("WARNING: Payment NOT verified")

    if total_spent >= 50000:
        score += 3
        reasons.append(f"High spender (${total_spent:,.0f})")
    elif total_spent >= 10000:
        score += 2.5
        reasons.append(f"Moderate spender (${total_spent:,.0f})")
    elif total_spent >= 1000:
        score += 1.5
        reasons.append(f"Low spender (${total_spent:,.0f})")
    else:
        score += 0.5
        reasons.append(f"Very low spend (${total_spent:,.0f})")

    if hire_rate >= 80:
        score += 2.5
        reasons.append(f"Excellent hire rate ({hire_rate}%)")
    elif hire_rate >= 50:
        score += 1.5
        reasons.append(f"Decent hire rate ({hire_rate}%)")
    elif hire_rate >= 20:
        score += 0.5
        reasons.append(f"Low hire rate ({hire_rate}%)")
    else:
        reasons.append(f"Very low hire rate ({hire_rate}%) — likely tire-kicker")

    if jobs_posted >= 20:
        score += 1.5
        reasons.append(f"Experienced buyer ({jobs_posted} jobs)")
    elif jobs_posted >= 5:
        score += 1
        reasons.append(f"Some experience ({jobs_posted} jobs)")
    else:
        score += 0.5
        reasons.append(f"New buyer ({jobs_posted} jobs)")

    return min(round(score, 1), 10), reasons


def score_clarity(description_length, has_budget, has_deadline):
    """Score project clarity 0-10."""
    score = 0
    reasons = []

    if has_budget:
        score += 4
        reasons.append("Budget specified")
    else:
        score += 1
        reasons.append("No budget — may be fishing for quotes")

    if has_deadline:
        score += 3
        reasons.append("Clear deadline")
    else:
        score += 1
        reasons.append("No deadline specified")

    if description_length >= 200:
        score += 3
        reasons.append("Detailed description")
    elif description_length >= 50:
        score += 2
        reasons.append("Moderate description")
    else:
        score += 0.5
        reasons.append("Vague/short description")

    return min(round(score, 1), 10), reasons


def score_growth_potential(total_spent, jobs_posted, member_since):
    """Score long-term potential 0-10."""
    score = 0
    reasons = []

    current_year = datetime.now().year
    years_active = max(current_year - member_since, 0)

    if years_active >= 3:
        score += 3
        reasons.append(f"Established account ({years_active} years)")
    elif years_active >= 1:
        score += 2
        reasons.append(f"Moderate tenure ({years_active} years)")
    else:
        score += 0.5
        reasons.append("Very new account")

    if years_active > 0:
        annual_spend = total_spent / years_active
        if annual_spend >= 20000:
            score += 4
            reasons.append(f"High annual spend (~${annual_spend:,.0f}/yr)")
        elif annual_spend >= 5000:
            score += 2.5
            reasons.append(f"Moderate annual spend (~${annual_spend:,.0f}/yr)")
        elif annual_spend >= 1000:
            score += 1.5
            reasons.append(f"Low annual spend (~${annual_spend:,.0f}/yr)")
        else:
            score += 0.5
            reasons.append(f"Minimal annual spend (~${annual_spend:,.0f}/yr)")
    else:
        score += 1
        reasons.append("New — no spending history")

    if jobs_posted >= 10 and years_active >= 2:
        score += 3
        reasons.append("Consistent hiring pattern — repeat client potential")
    elif jobs_posted >= 5:
        score += 2
        reasons.append("Growing hiring needs")
    else:
        score += 1
        reasons.append("Likely one-off project")

    return min(round(score, 1), 10), reasons


def detect_red_flags(hire_rate, total_spent, jobs_posted, payment_verified, member_since):
    """Detect potential red flags."""
    flags = []
    current_year = datetime.now().year
    years_active = max(current_year - member_since, 0)

    if not payment_verified:
        flags.append("No verified payment method — high risk of non-payment")

    if hire_rate < 20 and jobs_posted >= 5:
        flags.append(f"Only {hire_rate}% hire rate across {jobs_posted} jobs — serial tire-kicker")

    if jobs_posted >= 10 and total_spent < 500:
        flags.append("Many jobs posted but almost nothing spent — may collect free ideas")

    if years_active == 0 and total_spent == 0:
        flags.append("Brand new account with no history — proceed with caution")

    if jobs_posted == 0:
        flags.append("Zero jobs posted — first-time buyer, expect hand-holding")

    return flags


def get_verdict(overall_score, red_flags):
    """Return final verdict."""
    if red_flags and any("high risk" in f.lower() or "serial" in f.lower() for f in red_flags):
        return "SKIP", "Too many red flags. Not worth the risk."

    if overall_score >= 7:
        return "APPLY NOW", "Strong client. Prioritize this opportunity."
    elif overall_score >= 5:
        return "CAUTION", "Decent client but watch for issues. Set clear milestones."
    else:
        return "SKIP", "High risk of wasted time. Look for better opportunities."


def main():
    parser = argparse.ArgumentParser(
        description="Score potential clients before bidding. Helps avoid time-wasters.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  client_qualifier.py --hire-rate 85 --jobs-posted 23 --total-spent 15000 --member-since 2020 --payment-verified yes\n"
               "  client_qualifier.py --hire-rate 30 --jobs-posted 2 --total-spent 500 --member-since 2025",
    )
    parser.add_argument("--hire-rate", type=float, required=True, help="Client hire rate percentage (0-100)")
    parser.add_argument("--jobs-posted", type=int, required=True, help="Total jobs the client has posted")
    parser.add_argument("--total-spent", type=float, required=True, help="Total amount client has spent on platform (USD)")
    parser.add_argument("--member-since", type=int, required=True, help="Year client joined the platform (e.g., 2020)")
    parser.add_argument("--payment-verified", choices=["yes", "no"], default="no", help="Is payment method verified? (default: no)")
    parser.add_argument("--has-budget", choices=["yes", "no"], default="yes", help="Does the job post specify a budget? (default: yes)")
    parser.add_argument("--has-deadline", choices=["yes", "no"], default="no", help="Does the job post specify a deadline? (default: no)")
    parser.add_argument("--desc-length", type=int, default=100, help="Approximate job description length in words (default: 100)")

    args = parser.parse_args()

    payment_verified = args.payment_verified == "yes"
    has_budget = args.has_budget == "yes"
    has_deadline = args.has_deadline == "yes"

    if not 0 <= args.hire_rate <= 100:
        print("Error: --hire-rate must be between 0 and 100.")
        sys.exit(1)
    if args.member_since < 2000 or args.member_since > datetime.now().year:
        print(f"Error: --member-since must be between 2000 and {datetime.now().year}.")
        sys.exit(1)

    pay_score, pay_reasons = score_payment_reliability(
        args.hire_rate, args.total_spent, payment_verified, args.jobs_posted
    )
    clarity_score, clarity_reasons = score_clarity(
        args.desc_length, has_budget, has_deadline
    )
    growth_score, growth_reasons = score_growth_potential(
        args.total_spent, args.jobs_posted, args.member_since
    )
    red_flags = detect_red_flags(
        args.hire_rate, args.total_spent, args.jobs_posted,
        payment_verified, args.member_since
    )

    overall = round((pay_score * 0.45) + (clarity_score * 0.25) + (growth_score * 0.30), 1)
    verdict, verdict_reason = get_verdict(overall, red_flags)

    def score_bar(score):
        filled = int(score)
        return "[" + "#" * filled + "." * (10 - filled) + "]"

    print("\n" + "=" * 55)
    print(" CLIENT QUALIFICATION REPORT")
    print("=" * 55)

    print(f"\n  Hire Rate:       {args.hire_rate}%")
    print(f"  Jobs Posted:     {args.jobs_posted}")
    print(f"  Total Spent:     ${args.total_spent:,.0f}")
    print(f"  Member Since:    {args.member_since}")
    print(f"  Payment Verified: {'Yes' if payment_verified else 'No'}")

    print(f"\n  Payment Reliability:  {score_bar(pay_score)} {pay_score}/10")
    for r in pay_reasons:
        print(f"    - {r}")

    print(f"\n  Project Clarity:      {score_bar(clarity_score)} {clarity_score}/10")
    for r in clarity_reasons:
        print(f"    - {r}")

    print(f"\n  Growth Potential:     {score_bar(growth_score)} {growth_score}/10")
    for r in growth_reasons:
        print(f"    - {r}")

    if red_flags:
        print(f"\n  RED FLAGS:")
        for flag in red_flags:
            print(f"    !! {flag}")

    print(f"\n{'='*55}")
    print(f"  OVERALL SCORE: {overall}/10")
    print(f"  VERDICT: {verdict}")
    print(f"  {verdict_reason}")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
