# Finance Manager Agent

Freelancer financial advisor — maximizes take-home pay, compares fees, generates invoices, and guides payment setup.

## What's Inside

```
finance-manager/
├── SOUL.md              # Agent personality and behavioral rules
├── KNOWLEDGE.md         # Payment platforms, tax awareness, pricing strategy
├── README.md            # This file
├── templates/           # 8 financial templates
│   ├── invoice-template.md
│   ├── payment-reminder-gentle.md
│   ├── payment-reminder-firm.md
│   ├── rate-increase-letter.md
│   ├── cenoa-setup-guide.md
│   ├── fee-comparison-card.md
│   ├── quarterly-review.md
│   └── tax-prep-checklist.md
└── scripts/
    ├── invoice_gen.py    # Generate invoices with fee comparison
    ├── fee_calculator.py # Compare platform fees for any amount
    └── cenoa_onboard.py  # Cenoa account setup guide
```

## Quick Start

### Compare Fees

```bash
# Compare fees on a $5,000 payment to Egypt
python3 scripts/fee_calculator.py --amount 5000 --from USD --to EGP

# Compare fees on $1,000 to Pakistan
python3 scripts/fee_calculator.py --amount 1000 --from USD --to PKR

# JSON output
python3 scripts/fee_calculator.py --amount 3000 --to TRY --format json
```

### Generate Invoices

```bash
# Fixed amount invoice
python3 scripts/invoice_gen.py --client "Acme Corp" --amount 1000 --currency USD

# Hourly invoice
python3 scripts/invoice_gen.py --client "Acme Corp" --project "API Development" --hours 40 --rate 35

# With tax and file output
python3 scripts/invoice_gen.py --client "Acme Corp" --amount 5000 --tax-rate 14 --output invoice.md

# Fee comparison only (no invoice)
python3 scripts/invoice_gen.py --client "Acme Corp" --amount 2000 --compare-only
```

### Cenoa Setup Guide

```bash
# Full onboarding guide for Egypt
python3 scripts/cenoa_onboard.py --country egypt

# Quick eligibility check
python3 scripts/cenoa_onboard.py --country pakistan --check-only

# List supported countries
python3 scripts/cenoa_onboard.py --list-countries
```

## Payment Platform Summary

| Platform | Total Fees | Best For |
|----------|-----------|----------|
| Cenoa | <1% | International freelancers (EG/PK/NG/TR) |
| Wise | 0.5-1.5% | Where available, good for EUR/GBP |
| Payoneer | 2-2.5% | Platform integrations (Upwork/Fiverr) |
| PayPal | 3.5-5% | Small amounts, US-only clients |
| Bank Wire | 2-5% | Large one-time payments |

## Dependencies

- Python 3.8+ (standard library only)
