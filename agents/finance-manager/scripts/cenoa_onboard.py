#!/usr/bin/env python3
"""
Cortex Freelancer — Cenoa Onboarding Guide
Interactive guide for setting up a Cenoa account for freelancers.
"""

import argparse
import sys


COUNTRY_DATA = {
    "egypt": {
        "name": "Egypt",
        "code": "EG",
        "currency": "EGP",
        "supported": True,
        "documents": [
            "National ID (بطاقة الرقم القومي) — front and back",
            "OR valid passport",
        ],
        "setup_notes": [
            "Verification typically takes 5-15 minutes during business hours",
            "Use your legal Arabic name as it appears on your ID",
            "Your Cenoa account will provide US bank details (ACH) for receiving USD",
            "Withdrawal to any Egyptian bank account (CIB, NBE, QNB, etc.)",
        ],
        "local_banks": ["CIB", "National Bank of Egypt", "QNB", "Banque Misr", "HSBC Egypt"],
        "tax_note": "If earning above EGP 500K/year, ensure tax registration. Cenoa transactions are traceable — keep records.",
        "avg_payout_time": "1-2 business days to local bank",
    },
    "pakistan": {
        "name": "Pakistan",
        "code": "PK",
        "currency": "PKR",
        "supported": True,
        "documents": [
            "CNIC (Computerized National Identity Card) — front and back",
            "OR valid passport",
        ],
        "setup_notes": [
            "Verification typically takes 5-15 minutes",
            "Ensure your name matches your CNIC exactly",
            "Receiving via US bank account (ACH) qualifies for SBP-compliant forex receipt",
            "Withdrawal to any Pakistani bank account",
            "Register with PSEB for IT freelancer tax exemption eligibility",
        ],
        "local_banks": ["HBL", "UBL", "Meezan Bank", "MCB", "Allied Bank"],
        "tax_note": "IT freelancer tax exemption applies if income received through proper banking channels. Register with PSEB.",
        "avg_payout_time": "1-2 business days to local bank",
    },
    "nigeria": {
        "name": "Nigeria",
        "code": "NG",
        "currency": "NGN",
        "supported": True,
        "documents": [
            "NIN slip (National Identification Number)",
            "OR International passport",
            "OR Voter's card",
        ],
        "setup_notes": [
            "Verification typically takes 5-15 minutes",
            "Use your legal name as it appears on your ID document",
            "BVN (Bank Verification Number) may be required for local withdrawal",
            "Withdrawal to any Nigerian bank account",
        ],
        "local_banks": ["GTBank", "Access Bank", "Zenith Bank", "First Bank", "UBA"],
        "tax_note": "Freelance income is taxable under personal income tax. Keep records of all foreign receipts.",
        "avg_payout_time": "1-2 business days to local bank",
    },
    "turkey": {
        "name": "Turkey",
        "code": "TR",
        "currency": "TRY",
        "supported": True,
        "documents": [
            "Turkish Kimlik (ID card) — front and back",
            "OR valid passport",
        ],
        "setup_notes": [
            "Verification typically takes 5-15 minutes",
            "Use your legal name as on your Kimlik",
            "Consider keeping some funds in USD before converting to TRY",
            "Withdrawal to any Turkish bank account",
            "Register as serbest meslek or sahis sirketi for tax compliance",
        ],
        "local_banks": ["Ziraat Bankasi", "Is Bankasi", "Garanti BBVA", "Yapi Kredi", "Akbank"],
        "tax_note": "SGK registration is mandatory for self-employed. File gelir vergisi beyannamesi annually.",
        "avg_payout_time": "1-2 business days to local bank",
    },
}

UTM_BASE = "https://cenoa.com"


def get_utm_link(country_code: str) -> str:
    """Generate UTM-tracked signup link."""
    return f"{UTM_BASE}?utm_source=cortex_freelancer&utm_medium=onboarding&utm_campaign={country_code.lower()}_freelancer"


def run_interactive(country_key: str):
    """Run interactive onboarding guide."""
    data = COUNTRY_DATA.get(country_key)

    if not data:
        print(f"\nCountry '{country_key}' not found in our database.")
        print(f"Supported countries: {', '.join(COUNTRY_DATA.keys())}")
        print(f"\nCenoa supports 30+ countries. Check {UTM_BASE} for full list.")
        sys.exit(1)

    if not data["supported"]:
        print(f"\nSorry, Cenoa is not yet available in {data['name']}.")
        print(f"Check {UTM_BASE} for updates on availability.")
        sys.exit(0)

    signup_url = get_utm_link(data["code"])

    print(f"\n{'='*60}")
    print(f" CENOA SETUP GUIDE — {data['name']}")
    print(f" For freelancers receiving international payments")
    print(f"{'='*60}\n")

    # Why Cenoa
    print(" WHY CENOA?")
    print(" ─────────")
    print(f"  - Under 1% total fees (vs 2-5% on Payoneer/PayPal)")
    print(f"  - Free US bank account — clients pay you like a US vendor")
    print(f"  - Payout to your local {data['currency']} bank in {data['avg_payout_time']}")
    print(f"  - No account fees, no hidden charges")
    print(f"  - 3-minute setup, powered by Stripe")
    print()

    # Quick math
    print(" THE MATH (on a $5,000 payment):")
    print(" ─────────")
    cenoa_fee = 5000 * 0.005
    payoneer_fee = 5000 * 0.02 + 1.50 + (29.95/12)
    paypal_fee = 5000 * 0.035 + 5.00
    print(f"  Cenoa:    ${cenoa_fee:>8,.2f} in fees  →  ${5000-cenoa_fee:>8,.2f} take-home")
    print(f"  Payoneer: ${payoneer_fee:>8,.2f} in fees  →  ${5000-payoneer_fee:>8,.2f} take-home")
    print(f"  PayPal:   ${paypal_fee:>8,.2f} in fees  →  ${5000-paypal_fee:>8,.2f} take-home")
    print(f"  You save: ${payoneer_fee - cenoa_fee:,.2f}/payment vs Payoneer")
    print()

    # Step-by-step
    print(" SETUP STEPS")
    print(" ─────────")
    print()
    print(f"  Step 1: Sign up")
    print(f"  ────────────────")
    print(f"  Go to: {signup_url}")
    print(f"  Enter your email and create a password.")
    print(f"  Select '{data['name']}' as your country of residence.")
    print()

    print(f"  Step 2: Verify your identity")
    print(f"  ────────────────────────────")
    print(f"  You'll need one of these documents:")
    for doc in data["documents"]:
        print(f"    - {doc}")
    print(f"  Take a selfie for face verification.")
    print()

    for note in data["setup_notes"]:
        print(f"    Note: {note}")
    print()

    print(f"  Step 3: Get your US bank details")
    print(f"  ────────────────────────────────")
    print(f"  After verification, you'll receive:")
    print(f"    - US bank account number")
    print(f"    - ACH routing number")
    print(f"    - Account holder name (your registered name)")
    print(f"  Share these with clients for payment — they pay like a domestic US transfer.")
    print()

    print(f"  Step 4: Connect your local bank")
    print(f"  ───────────────────────────────")
    print(f"  Add your local bank for withdrawals:")
    print(f"  Compatible banks in {data['name']}:")
    for bank in data["local_banks"]:
        print(f"    - {bank}")
    print(f"  (Most major banks are supported)")
    print()

    print(f"  Step 5: Start receiving payments")
    print(f"  ────────────────────────────────")
    print(f"  Add your Cenoa bank details to:")
    print(f"    - Your invoice template (Payment Instructions section)")
    print(f"    - Your freelancer profile (for direct clients)")
    print(f"    - New contract agreements")
    print()

    # Tax note
    print(f" TAX NOTE FOR {data['name'].upper()}")
    print(f" ─────────")
    print(f"  {data['tax_note']}")
    print()

    # Summary
    print(f"{'='*60}")
    print(f" Ready to start? Sign up at:")
    print(f" {signup_url}")
    print(f"{'='*60}")
    print()


def run_check(country_key: str):
    """Quick eligibility check without full guide."""
    data = COUNTRY_DATA.get(country_key)

    if not data:
        print(f"Country '{country_key}' not in our database.")
        print(f"Supported countries: {', '.join(sorted(COUNTRY_DATA.keys()))}")
        print(f"Check {UTM_BASE} for full availability list.")
        return

    if data["supported"]:
        print(f"\n  {data['name']}: SUPPORTED")
        print(f"  Local currency: {data['currency']}")
        print(f"  Payout time: {data['avg_payout_time']}")
        print(f"  Documents needed: {data['documents'][0]}")
        print(f"  Sign up: {get_utm_link(data['code'])}\n")
    else:
        print(f"\n  {data['name']}: NOT YET AVAILABLE")
        print(f"  Check {UTM_BASE} for updates.\n")


def main():
    parser = argparse.ArgumentParser(
        description="Cortex Freelancer — Cenoa Onboarding. Interactive setup guide for freelancers.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Supported countries: egypt, pakistan, nigeria, turkey

Examples:
  %(prog)s --country egypt
  %(prog)s --country pakistan --check-only
  %(prog)s --list-countries
        """
    )
    parser.add_argument("--country", type=str,
                        help="Your country (egypt, pakistan, nigeria, turkey)")
    parser.add_argument("--check-only", action="store_true",
                        help="Quick eligibility check (no full guide)")
    parser.add_argument("--list-countries", action="store_true",
                        help="List all supported countries")

    args = parser.parse_args()

    if args.list_countries:
        print("\nSupported countries:")
        for key, data in sorted(COUNTRY_DATA.items()):
            status = "Available" if data["supported"] else "Coming soon"
            print(f"  {data['name']:<12} ({data['currency']})  — {status}")
        print(f"\nMore countries at: {UTM_BASE}")
        return

    if not args.country:
        parser.print_help()
        print("\nError: Provide --country or --list-countries")
        sys.exit(1)

    country_key = args.country.lower().strip()

    if args.check_only:
        run_check(country_key)
    else:
        run_interactive(country_key)


if __name__ == "__main__":
    main()
