#!/usr/bin/env python3
"""
Tax Estimator — Quarterly tax estimation for freelancers by country.

Supports: Egypt, Pakistan, Nigeria, Turkey

Usage:
    python3 tax_estimator.py --country egypt --quarterly-income 50000
    python3 tax_estimator.py --country turkey --quarterly-income 75000
    python3 tax_estimator.py --country pakistan --quarterly-income 30000 --it-exempt
    python3 tax_estimator.py --country nigeria --quarterly-income 20000
"""

import argparse
import sys
from datetime import datetime


# ── Tax brackets and rules by country ──────────────────────────────

# Egypt: Income Tax (EGP) — 2024/2025 brackets
EGYPT_BRACKETS = [
    (0,       15000,   0.0),     # 0%
    (15000,   30000,   0.025),   # 2.5%
    (30000,   45000,   0.10),    # 10%
    (45000,   60000,   0.15),    # 15%
    (60000,   200000,  0.20),    # 20%
    (200000,  400000,  0.225),   # 22.5%
    (400000,  float('inf'), 0.25),  # 25%
]

# Pakistan: Income Tax (PKR) — FY 2024-25
# IT/ITeS freelancer export exemption available
PAKISTAN_BRACKETS = [
    (0,       600000,    0.0),
    (600000,  1200000,   0.05),
    (1200000, 2400000,   0.10),
    (2400000, 3600000,   0.15),
    (3600000, 6000000,   0.20),
    (6000000, 12000000,  0.25),
    (12000000, float('inf'), 0.30),
]

# Nigeria: Personal Income Tax (NGN) — PIT Act
# Minimum tax: 1% of gross income
NIGERIA_BRACKETS = [
    (0,       300000,    0.07),
    (300000,  600000,    0.11),
    (600000,  1100000,   0.15),
    (1100000, 1600000,   0.19),
    (1600000, 3200000,   0.21),
    (3200000, float('inf'), 0.24),
]

# Turkey: Gelir Vergisi (TRY) — 2025 brackets
TURKEY_BRACKETS = [
    (0,       110000,    0.15),
    (110000,  230000,    0.20),
    (230000,  870000,    0.27),
    (870000,  3000000,   0.35),
    (3000000, float('inf'), 0.40),
]

COUNTRY_CONFIG = {
    "egypt": {
        "name": "Egypt",
        "currency": "EGP",
        "brackets": EGYPT_BRACKETS,
        "annual_exemption": 15000,  # First 15K EGP is exempt
        "social_insurance": False,
        "notes": [
            "Freelancers register at local tax office (ma'muriyya dariba)",
            "File annual return by March 31",
            "Keep receipts for all deductible business expenses",
            "Consider registering for VAT if turnover > 500K EGP",
            "Digital services may have additional VAT obligations",
        ],
        "filing_dates": {
            "Q1": "April 30",
            "Q2": "July 31",
            "Q3": "October 31",
            "Q4": "March 31 (next year, annual return)",
        },
    },
    "pakistan": {
        "name": "Pakistan",
        "currency": "PKR",
        "brackets": PAKISTAN_BRACKETS,
        "annual_exemption": 600000,
        "social_insurance": False,
        "it_exempt_available": True,
        "notes": [
            "IT/ITeS freelancers exporting services may qualify for tax exemption",
            "Register with PSEB (Pakistan Software Export Board) for exemption",
            "Bring remittances through official banking channels",
            "File via IRIS (FBR's online portal)",
            "Keep foreign remittance certificates from bank",
            "Exemption applies to: software development, IT services, call centers",
        ],
        "filing_dates": {
            "Q1": "September 30",
            "Q2": "December 31",
            "Q3": "March 31",
            "Q4": "September 30 (next year, annual return)",
        },
    },
    "nigeria": {
        "name": "Nigeria",
        "currency": "NGN",
        "brackets": NIGERIA_BRACKETS,
        "annual_exemption": 0,
        "social_insurance": False,
        "minimum_tax_rate": 0.01,  # 1% minimum tax
        "notes": [
            "Self-employed must register for TIN with FIRS",
            "Minimum tax: 1% of gross income (if higher than bracket calc)",
            "File annual return by March 31",
            "NHF (National Housing Fund): 2.5% contribution required",
            "Consider PAYE if you have a regular client arrangement",
            "Keep records of all foreign income remittances",
        ],
        "filing_dates": {
            "Q1": "April 30",
            "Q2": "July 31",
            "Q3": "October 31",
            "Q4": "March 31 (next year, annual return)",
        },
    },
    "turkey": {
        "name": "Turkey",
        "currency": "TRY",
        "brackets": TURKEY_BRACKETS,
        "annual_exemption": 0,
        "social_insurance": True,
        "sgk_rate": 0.345,  # Approx SGK rate for self-employed (basamak-based)
        "stopaj_rate": 0.20,  # Withholding tax if client is Turkish company
        "notes": [
            "Register as 'serbest meslek erbabi' (self-employed professional)",
            "Open a serbest meslek makbuzu (SMM) book at tax office",
            "SGK (social security) is mandatory — minimum basamak contribution",
            "Stopaj (20%) withheld by Turkish clients counts toward tax",
            "Foreign income: report in TRY at TCMB exchange rate on receipt date",
            "KDV (VAT) exemption for services exported outside Turkey",
            "Quarterly gecici vergi (provisional tax) payments required",
        ],
        "filing_dates": {
            "Q1": "May 17",
            "Q2": "August 17",
            "Q3": "November 17",
            "Q4": "February 17 (next year)",
            "Annual": "March 25 (next year, gelir vergisi beyannamesi)",
        },
    },
}


def calculate_progressive_tax(annual_income, brackets, exemption=0):
    """Calculate tax using progressive brackets."""
    taxable = max(0, annual_income - exemption)
    total_tax = 0
    breakdown = []

    remaining = taxable
    for lower, upper, rate in brackets:
        if remaining <= 0:
            break
        bracket_amount = min(remaining, upper - lower)
        tax = bracket_amount * rate
        if tax > 0:
            breakdown.append({
                "range": f"{lower:,.0f} – {upper:,.0f}" if upper != float('inf') else f"{lower:,.0f}+",
                "rate": rate,
                "taxable": bracket_amount,
                "tax": tax,
            })
        total_tax += tax
        remaining -= bracket_amount

    return total_tax, breakdown


def estimate_egypt(quarterly_income, args):
    """Egypt tax estimation."""
    config = COUNTRY_CONFIG["egypt"]
    annual = quarterly_income * 4
    tax, breakdown = calculate_progressive_tax(annual, config["brackets"], config["annual_exemption"])
    quarterly_tax = tax / 4
    return annual, tax, quarterly_tax, breakdown, config


def estimate_pakistan(quarterly_income, args):
    """Pakistan tax estimation with IT exemption check."""
    config = COUNTRY_CONFIG["pakistan"]
    annual = quarterly_income * 4

    if args.it_exempt:
        return annual, 0, 0, [], config

    tax, breakdown = calculate_progressive_tax(annual, config["brackets"], config["annual_exemption"])
    quarterly_tax = tax / 4
    return annual, tax, quarterly_tax, breakdown, config


def estimate_nigeria(quarterly_income, args):
    """Nigeria tax estimation with minimum tax rule."""
    config = COUNTRY_CONFIG["nigeria"]
    annual = quarterly_income * 4
    tax, breakdown = calculate_progressive_tax(annual, config["brackets"])

    # Minimum tax rule: 1% of gross
    min_tax = annual * config["minimum_tax_rate"]
    if min_tax > tax:
        tax = min_tax
        breakdown = [{"range": "Minimum tax (1%)", "rate": 0.01, "taxable": annual, "tax": min_tax}]

    quarterly_tax = tax / 4
    return annual, tax, quarterly_tax, breakdown, config


def estimate_turkey(quarterly_income, args):
    """Turkey tax estimation with SGK and stopaj."""
    config = COUNTRY_CONFIG["turkey"]
    annual = quarterly_income * 4
    tax, breakdown = calculate_progressive_tax(annual, config["brackets"])
    quarterly_tax = tax / 4
    return annual, tax, quarterly_tax, breakdown, config


def get_next_filing_date(config):
    """Determine the next filing date."""
    now = datetime.now()
    current_month = now.month

    if current_month <= 3:
        quarter = "Q4" if "Q4" in config["filing_dates"] else "Annual"
    elif current_month <= 6:
        quarter = "Q1"
    elif current_month <= 9:
        quarter = "Q2"
    else:
        quarter = "Q3"

    return quarter, config["filing_dates"].get(quarter, "Check local tax authority")


def main():
    parser = argparse.ArgumentParser(
        description="Estimate quarterly taxes for freelancers by country.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Supported countries: egypt, pakistan, nigeria, turkey\n\n"
               "Examples:\n"
               "  tax_estimator.py --country egypt --quarterly-income 50000\n"
               "  tax_estimator.py --country pakistan --quarterly-income 30000 --it-exempt\n"
               "  tax_estimator.py --country turkey --quarterly-income 75000",
    )
    parser.add_argument("--country", required=True, choices=list(COUNTRY_CONFIG.keys()),
                        help="Country for tax calculation")
    parser.add_argument("--quarterly-income", required=True, type=float,
                        help="Gross quarterly income in local currency")
    parser.add_argument("--it-exempt", action="store_true",
                        help="Apply IT/ITeS freelancer export exemption (Pakistan only)")
    parser.add_argument("--expenses", type=float, default=0,
                        help="Quarterly deductible business expenses")

    args = parser.parse_args()

    config = COUNTRY_CONFIG[args.country]
    quarterly_income = args.quarterly_income

    # Deduct expenses if provided
    if args.expenses > 0:
        quarterly_income = max(0, quarterly_income - args.expenses)

    # Calculate
    estimators = {
        "egypt": estimate_egypt,
        "pakistan": estimate_pakistan,
        "nigeria": estimate_nigeria,
        "turkey": estimate_turkey,
    }
    annual, tax, quarterly_tax, breakdown, cfg = estimators[args.country](quarterly_income, args)

    # Filing dates
    next_q, next_date = get_next_filing_date(config)

    # Display
    print(f"\n{'=' * 55}")
    print(f"🏛️  TAX ESTIMATE — {config['name']}")
    print(f"{'=' * 55}")

    print(f"\n📊 INCOME")
    print(f"  Quarterly gross:     {config['currency']} {args.quarterly_income:>12,.0f}")
    if args.expenses > 0:
        print(f"  Deductible expenses: {config['currency']} {args.expenses:>12,.0f}")
        print(f"  Taxable quarterly:   {config['currency']} {quarterly_income:>12,.0f}")
    print(f"  Annual (projected):  {config['currency']} {annual:>12,.0f}")

    # IT exemption notice
    if args.country == "pakistan" and args.it_exempt:
        print(f"\n  ✅ IT/ITeS EXPORT EXEMPTION APPLIED")
        print(f"  No income tax on qualifying IT service exports")
        print(f"  Requirements: PSEB registration + remittance through banks")

    # Tax breakdown
    if breakdown:
        print(f"\n📋 TAX BREAKDOWN (Annual)")
        print(f"  {'Bracket':<25} {'Rate':>6} {'Taxable':>15} {'Tax':>12}")
        print(f"  {'─' * 60}")
        for b in breakdown:
            print(f"  {b['range']:<25} {b['rate']*100:>5.1f}% {config['currency']} {b['taxable']:>10,.0f} {config['currency']} {b['tax']:>8,.0f}")
        print(f"  {'─' * 60}")
        print(f"  {'ANNUAL TAX':<25} {'':>6} {'':>15} {config['currency']} {tax:>8,.0f}")

    # Quarterly summary
    print(f"\n💰 SET ASIDE THIS QUARTER")
    print(f"  {'─' * 40}")
    print(f"  Income tax:     {config['currency']} {quarterly_tax:>12,.0f}")

    total_set_aside = quarterly_tax

    # Turkey-specific: SGK
    if args.country == "turkey" and config.get("social_insurance"):
        sgk_monthly = 5500
        sgk_quarterly = sgk_monthly * 3
        total_set_aside += sgk_quarterly
        print(f"  SGK (social security): {config['currency']} {sgk_quarterly:>8,.0f}  (est. min basamak)")
        print(f"  {'─' * 40}")
        print(f"  TOTAL to set aside:  {config['currency']} {total_set_aside:>10,.0f}")

    effective_rate = (tax / annual * 100) if annual > 0 else 0
    print(f"\n  Effective annual rate: {effective_rate:.1f}%")
    print(f"  Set aside {effective_rate + 2:.0f}% of income as a safety buffer")

    # Filing dates
    print(f"\n📅 FILING DATES")
    print(f"  {'─' * 40}")
    for period, date in config["filing_dates"].items():
        marker = " ← NEXT" if period == next_q else ""
        print(f"  {period:<12} {date}{marker}")

    # Country-specific notes
    print(f"\n📝 IMPORTANT NOTES")
    print(f"  {'─' * 40}")
    for note in config["notes"]:
        print(f"  • {note}")

    # Minimum tax warning (Nigeria)
    if args.country == "nigeria":
        min_tax = annual * config["minimum_tax_rate"]
        if min_tax > 0:
            print(f"\n  ℹ️  Minimum tax (1% of gross): {config['currency']} {min_tax:,.0f}/year")
            print(f"      Applied if higher than bracket calculation")

    # Disclaimer
    print(f"\n⚠️  DISCLAIMER: This is an estimate for planning purposes only.")
    print(f"   Consult a local tax professional for accurate filing.")
    print(f"   Tax laws change — verify current brackets with your tax authority.\n")


if __name__ == "__main__":
    main()
