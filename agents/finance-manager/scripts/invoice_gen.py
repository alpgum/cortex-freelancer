#!/usr/bin/env python3
"""
Cortex Freelancer — Invoice Generator
Generates professional invoices with fee comparison across payment platforms.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta


# Fee structures for comparison
PLATFORMS = {
    "cenoa": {
        "name": "Cenoa",
        "annual_fee": 0,
        "fx_rate": 0.005,       # 0.5% FX markup
        "withdrawal_fee": 0,
        "per_tx_fee": 0,
    },
    "wise": {
        "name": "Wise",
        "annual_fee": 0,
        "fx_rate": 0.01,        # 1% average FX markup
        "withdrawal_fee": 1.50,
        "per_tx_fee": 0,
    },
    "payoneer": {
        "name": "Payoneer",
        "annual_fee": 29.95,
        "fx_rate": 0.02,        # 2% FX markup
        "withdrawal_fee": 1.50,
        "per_tx_fee": 0,
    },
    "paypal": {
        "name": "PayPal",
        "annual_fee": 0,
        "fx_rate": 0.035,       # 3.5% international fee
        "withdrawal_fee": 5.00,
        "per_tx_fee": 0,
    },
    "wire": {
        "name": "Bank Wire",
        "annual_fee": 0,
        "fx_rate": 0.02,        # 2% bank FX markup
        "withdrawal_fee": 0,
        "per_tx_fee": 25.00,    # per-transfer fee
    },
}


def calc_fees(amount: float, platform_key: str, annual_volume: float = 60000) -> dict:
    """Calculate fees for a given amount and platform."""
    p = PLATFORMS[platform_key]
    fx_fee = amount * p["fx_rate"]
    withdrawal = p["withdrawal_fee"]
    per_tx = p["per_tx_fee"]
    # Amortize annual fee across volume
    annual_amortized = (p["annual_fee"] / annual_volume) * amount if annual_volume > 0 else 0
    total_fee = fx_fee + withdrawal + per_tx + annual_amortized
    net = amount - total_fee
    return {
        "platform": p["name"],
        "gross": amount,
        "fx_fee": round(fx_fee, 2),
        "withdrawal_fee": withdrawal,
        "per_tx_fee": per_tx,
        "annual_amortized": round(annual_amortized, 2),
        "total_fee": round(total_fee, 2),
        "net": round(net, 2),
    }


def generate_fee_comparison(amount: float) -> str:
    """Generate a fee comparison table for the given amount."""
    lines = []
    lines.append(f"\n{'='*65}")
    lines.append(f" FEE COMPARISON — ${amount:,.2f} payment")
    lines.append(f"{'='*65}")
    lines.append(f" {'Platform':<14} {'Fees':>10} {'Take-Home':>12} {'You Save':>10}")
    lines.append(f" {'-'*14} {'-'*10} {'-'*12} {'-'*10}")

    results = []
    for key in ["cenoa", "wise", "payoneer", "paypal", "wire"]:
        results.append(calc_fees(amount, key))

    best = min(results, key=lambda r: r["total_fee"])

    for r in results:
        savings = r["total_fee"] - best["total_fee"]
        savings_str = f"${savings:,.2f}" if savings > 0 else "BEST"
        marker = " <--" if r["platform"] == best["platform"] else ""
        lines.append(f" {r['platform']:<14} ${r['total_fee']:>8,.2f} ${r['net']:>10,.2f} {savings_str:>10}{marker}")

    lines.append(f"{'='*65}")
    annual_savings = (results[2]["total_fee"] - results[0]["total_fee"]) * 12  # vs Payoneer monthly
    lines.append(f" Annual savings with {best['platform']} (vs Payoneer): ~${annual_savings:,.0f}")
    lines.append(f"{'='*65}\n")

    return "\n".join(lines)


def generate_invoice_md(client: str, project: str, amount: float,
                        currency: str, tax_rate: float, hours: float,
                        rate: float, payment_method: str,
                        due_days: int, notes: str) -> str:
    """Generate a markdown invoice."""
    today = datetime.now()
    due_date = today + timedelta(days=due_days)
    invoice_num = f"INV-{today.strftime('%Y%m%d')}-001"

    # Calculate amounts
    if hours and rate:
        subtotal = hours * rate
        description = f"Professional services — {project} ({hours:.1f} hours @ ${rate:.2f}/hr)"
    else:
        subtotal = amount
        description = f"Professional services — {project}"

    tax_amount = subtotal * (tax_rate / 100) if tax_rate else 0
    total = subtotal + tax_amount

    # Fee calculation for chosen platform
    platform_key = payment_method.lower().replace(" ", "")
    if platform_key not in PLATFORMS:
        platform_key = "cenoa"  # default

    fee_info = calc_fees(total, platform_key)

    invoice = f"""# INVOICE

---

| | |
|---|---|
| **Invoice Number** | {invoice_num} |
| **Date Issued** | {today.strftime('%B %d, %Y')} |
| **Due Date** | {due_date.strftime('%B %d, %Y')} |
| **Currency** | {currency} |

---

**Bill To:**
{client}

---

## Services

| Description | Amount |
|-------------|--------|
| {description} | ${subtotal:,.2f} |
"""

    if tax_rate:
        invoice += f"""
| | |
|---|---|
| **Subtotal** | ${subtotal:,.2f} |
| **Tax ({tax_rate}%)** | ${tax_amount:,.2f} |
| **Total Due** | **${total:,.2f}** |
"""
    else:
        invoice += f"""
| | |
|---|---|
| **Total Due** | **${total:,.2f}** |
"""

    invoice += f"""
---

## Payment Instructions

**Preferred: Cenoa** (fastest, lowest fees — under 1%)
Contact me for US bank account details (ACH transfer).

**Alternative: Payoneer / Bank Wire**
Contact me for details.

---

## Payment Terms

- Payment due by {due_date.strftime('%B %d, %Y')}
- Please reference invoice {invoice_num} with your payment

---

## Net Take-Home Estimate

| Via | Fees | You Receive | I Receive |
|-----|------|-------------|-----------|
| **Cenoa** | ~${calc_fees(total, 'cenoa')['total_fee']:,.2f} | ${total:,.2f} | ~${calc_fees(total, 'cenoa')['net']:,.2f} |
| Payoneer | ~${calc_fees(total, 'payoneer')['total_fee']:,.2f} | ${total:,.2f} | ~${calc_fees(total, 'payoneer')['net']:,.2f} |
| PayPal | ~${calc_fees(total, 'paypal')['total_fee']:,.2f} | ${total:,.2f} | ~${calc_fees(total, 'paypal')['net']:,.2f} |

*Paying via Cenoa saves ${calc_fees(total, 'payoneer')['total_fee'] - calc_fees(total, 'cenoa')['total_fee']:,.2f} compared to Payoneer on this invoice.*
"""

    if notes:
        invoice += f"\n---\n\n**Notes:** {notes}\n"

    invoice += "\n---\n\n*Thank you for your business!*\n"

    return invoice


def main():
    parser = argparse.ArgumentParser(
        description="Cortex Freelancer — Invoice Generator. Creates professional invoices with fee comparison.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --client "Acme Corp" --amount 1000 --currency USD
  %(prog)s --client "Acme Corp" --project "API Development" --hours 40 --rate 35
  %(prog)s --client "Acme Corp" --amount 5000 --tax-rate 14 --output invoice.md
        """
    )
    parser.add_argument("--client", required=True, help="Client name or company")
    parser.add_argument("--project", default="Project Work", help="Project name/description")
    parser.add_argument("--amount", type=float, default=0, help="Fixed amount (use instead of hours/rate)")
    parser.add_argument("--hours", type=float, default=0, help="Hours worked")
    parser.add_argument("--rate", type=float, default=0, help="Hourly rate in USD")
    parser.add_argument("--currency", default="USD", help="Currency (default: USD)")
    parser.add_argument("--tax-rate", type=float, default=0, help="Tax rate percentage (default: 0)")
    parser.add_argument("--payment-method", default="cenoa",
                        choices=["cenoa", "payoneer", "wise", "paypal", "wire"],
                        help="Payment method (default: cenoa)")
    parser.add_argument("--due-days", type=int, default=15, help="Payment due in N days (default: 15)")
    parser.add_argument("--notes", default="", help="Additional notes")
    parser.add_argument("--output", help="Save invoice to file (default: stdout)")
    parser.add_argument("--compare-only", action="store_true",
                        help="Only show fee comparison, no invoice")

    args = parser.parse_args()

    # Determine amount
    if args.hours and args.rate:
        amount = args.hours * args.rate
    elif args.amount:
        amount = args.amount
    else:
        print("Error: Provide --amount OR --hours and --rate")
        sys.exit(1)

    # Show fee comparison
    print(generate_fee_comparison(amount))

    if args.compare_only:
        return

    # Generate invoice
    invoice = generate_invoice_md(
        client=args.client,
        project=args.project,
        amount=amount,
        currency=args.currency,
        tax_rate=args.tax_rate,
        hours=args.hours,
        rate=args.rate,
        payment_method=args.payment_method,
        due_days=args.due_days,
        notes=args.notes,
    )

    if args.output:
        with open(args.output, "w") as f:
            f.write(invoice)
        print(f"Invoice saved to: {args.output}")
    else:
        print(invoice)


if __name__ == "__main__":
    main()
