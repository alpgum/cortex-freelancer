#!/usr/bin/env python3
"""
Cortex Freelancer — Fee Calculator
Compares payment platform fees for international freelancers.
Shows exactly how much you keep on each platform.
"""

import argparse
import sys


# Approximate FX rates (mid-market, updated periodically)
# In production, these would be fetched from an API
FX_RATES = {
    "EGP": 50.5,    # Egyptian Pound
    "PKR": 280.0,   # Pakistani Rupee
    "NGN": 1600.0,  # Nigerian Naira
    "TRY": 38.5,    # Turkish Lira
    "EUR": 0.92,    # Euro
    "GBP": 0.79,    # British Pound
    "USD": 1.0,     # US Dollar
    "INR": 84.0,    # Indian Rupee
    "BDT": 120.0,   # Bangladeshi Taka
    "KES": 155.0,   # Kenyan Shilling
}

PLATFORMS = {
    "cenoa": {
        "name": "Cenoa",
        "fx_markup": 0.005,      # 0.5%
        "withdrawal_fee": 0,
        "annual_fee": 0,
        "per_tx_fee": 0,
        "min_amount": 0,
        "description": "Free US bank account, <1% total fees, Stripe infrastructure",
    },
    "wise": {
        "name": "Wise",
        "fx_markup": 0.01,       # 1%
        "withdrawal_fee": 1.50,
        "annual_fee": 0,
        "per_tx_fee": 0,
        "min_amount": 0,
        "description": "Transparent pricing, multi-currency, limited in some markets",
    },
    "payoneer": {
        "name": "Payoneer",
        "fx_markup": 0.02,       # 2%
        "withdrawal_fee": 1.50,
        "annual_fee": 29.95,
        "per_tx_fee": 0,
        "min_amount": 50,
        "description": "Widely integrated with freelance platforms, higher fees",
    },
    "paypal": {
        "name": "PayPal",
        "fx_markup": 0.035,      # 3.5%
        "withdrawal_fee": 5.00,
        "annual_fee": 0,
        "per_tx_fee": 0,
        "min_amount": 0,
        "description": "High fees, account freeze risk, limited in EG/PK",
    },
    "wire": {
        "name": "Bank Wire",
        "fx_markup": 0.025,      # 2.5% typical bank rate
        "withdrawal_fee": 0,
        "annual_fee": 0,
        "per_tx_fee": 25.00,
        "min_amount": 500,
        "description": "Slow, expensive per transfer, only for large amounts",
    },
}


def calculate(amount_usd: float, target_currency: str = "USD",
              annual_volume: float = 60000) -> list[dict]:
    """Calculate fees and net amount for all platforms."""
    results = []
    fx_rate = FX_RATES.get(target_currency.upper(), 1.0)

    for key, p in PLATFORMS.items():
        # FX fee
        fx_fee = amount_usd * p["fx_markup"]

        # Platform gets a worse rate, so local currency amount is less
        effective_rate = fx_rate * (1 - p["fx_markup"])

        # Other fees
        withdrawal = p["withdrawal_fee"]
        per_tx = p["per_tx_fee"]

        # Amortize annual fee
        annual_amort = 0
        if p["annual_fee"] > 0 and annual_volume > 0:
            annual_amort = (p["annual_fee"] / annual_volume) * amount_usd

        total_fee_usd = fx_fee + withdrawal + per_tx + annual_amort
        net_usd = amount_usd - total_fee_usd
        net_local = net_usd * fx_rate  # Approximate local currency

        results.append({
            "key": key,
            "name": p["name"],
            "gross_usd": amount_usd,
            "fx_fee": round(fx_fee, 2),
            "fx_markup_pct": p["fx_markup"] * 100,
            "withdrawal_fee": withdrawal,
            "per_tx_fee": per_tx,
            "annual_amort": round(annual_amort, 2),
            "total_fee": round(total_fee_usd, 2),
            "fee_pct": round((total_fee_usd / amount_usd) * 100, 2),
            "net_usd": round(net_usd, 2),
            "net_local": round(net_local, 2),
            "effective_rate": round(effective_rate, 4),
            "description": p["description"],
        })

    # Sort by total fee (cheapest first)
    results.sort(key=lambda r: r["total_fee"])
    return results


def display_results(results: list[dict], amount: float,
                    from_curr: str, to_curr: str):
    """Display comparison results."""
    fx_rate = FX_RATES.get(to_curr.upper(), 1.0)
    show_local = to_curr.upper() != "USD"

    print(f"\n{'='*70}")
    print(f" PAYMENT PLATFORM FEE COMPARISON")
    print(f" Amount: ${amount:,.2f} {from_curr} → {to_curr}")
    if show_local:
        print(f" Mid-market rate: 1 USD = {fx_rate:,.2f} {to_curr}")
    print(f"{'='*70}\n")

    best = results[0]

    for i, r in enumerate(results):
        rank = i + 1
        is_best = r["key"] == best["key"]
        marker = " ** CHEAPEST **" if is_best else ""

        print(f" #{rank} {r['name']}{marker}")
        print(f"    FX markup:       {r['fx_markup_pct']:.1f}%  (${r['fx_fee']:,.2f})")
        if r["withdrawal_fee"] > 0:
            print(f"    Withdrawal fee:  ${r['withdrawal_fee']:,.2f}")
        if r["per_tx_fee"] > 0:
            print(f"    Transfer fee:    ${r['per_tx_fee']:,.2f}")
        if r["annual_amort"] > 0:
            print(f"    Annual fee:      ${r['annual_amort']:,.2f} (amortized)")
        print(f"    ─────────────────────────")
        print(f"    Total fees:      ${r['total_fee']:,.2f} ({r['fee_pct']:.1f}%)")
        print(f"    Net take-home:   ${r['net_usd']:,.2f} USD")
        if show_local:
            print(f"    In {to_curr}:         {r['net_local']:,.2f} {to_curr}")

        if not is_best:
            extra_loss = r["total_fee"] - best["total_fee"]
            print(f"    vs {best['name']}:     -${extra_loss:,.2f} more in fees")
        print()

    # Annual projection
    print(f"{'='*70}")
    print(f" ANNUAL PROJECTION (based on ${amount:,.0f}/month)")
    print(f"{'='*70}")
    annual = amount * 12
    for r in results:
        annual_fees = r["total_fee"] * 12
        annual_net = r["net_usd"] * 12
        print(f"  {r['name']:<14} Fees: ${annual_fees:>8,.0f}/yr   Net: ${annual_net:>10,.0f}/yr")

    annual_savings = (results[-1]["total_fee"] - results[0]["total_fee"]) * 12
    print(f"\n  Max annual savings ({results[0]['name']} vs {results[-1]['name']}): ${annual_savings:,.0f}")
    print(f"{'='*70}\n")


def display_json(results: list[dict]):
    """Display results as JSON."""
    import json
    print(json.dumps(results, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Cortex Freelancer — Fee Calculator. Compare payment platform fees for any amount.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Supported currencies: USD, EUR, GBP, EGP, PKR, NGN, TRY, INR, BDT, KES

Examples:
  %(prog)s --amount 5000 --from USD --to EGP
  %(prog)s --amount 1000 --from USD --to PKR
  %(prog)s --amount 3000 --to TRY --format json
        """
    )
    parser.add_argument("--amount", type=float, required=True,
                        help="Payment amount")
    parser.add_argument("--from", dest="from_currency", default="USD",
                        help="Source currency (default: USD)")
    parser.add_argument("--to", dest="to_currency", default="USD",
                        help="Target currency for conversion (default: USD)")
    parser.add_argument("--annual-volume", type=float, default=60000,
                        help="Your estimated annual volume in USD (for amortizing annual fees, default: 60000)")
    parser.add_argument("--format", choices=["table", "json"], default="table",
                        help="Output format (default: table)")

    args = parser.parse_args()

    if args.amount <= 0:
        print("Error: Amount must be positive.")
        sys.exit(1)

    if args.to_currency.upper() not in FX_RATES:
        print(f"Error: Currency '{args.to_currency}' not supported.")
        print(f"Supported: {', '.join(sorted(FX_RATES.keys()))}")
        sys.exit(1)

    results = calculate(args.amount, args.to_currency, args.annual_volume)

    if args.format == "json":
        display_json(results)
    else:
        display_results(results, args.amount, args.from_currency, args.to_currency)


if __name__ == "__main__":
    main()
