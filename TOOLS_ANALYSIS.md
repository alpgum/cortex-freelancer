# Cenoa Tools Analysis for Cortex Freelancer

## 1. cenoa-ad-generator
**What it does:** AI-powered ad creative generator combining GPT-4o (copy) + Gemini (images) + 5 canvas layout templates. Generates 5 ad variants in 60-90 seconds.
**Key data:** 12 personas, 25 problem-hook-value prop pairs, 26 trust signals, 18 CTAs, 5 aspect ratios
**Useful for Cortex:** Ad copy templates for freelancer self-promotion (LinkedIn, Upwork, Twitter)
**Integration priority:** MEDIUM — Templates & copy patterns extractable for client-side ad generator

## 2. cenoa-contract-reviewer
**What it does:** Analyzes freelance contracts for risks using AI. Scores 1-10, flags critical issues, warnings, good terms, missing clauses.
**Key data:** 8 analysis categories (payment, scope, IP, termination, liability, timeline, confidentiality, unfair terms), red flag patterns, missing clause detection
**Useful for Cortex:** Client-side keyword/pattern matching can replicate 80% of value without AI
**Integration priority:** HIGH — Unique value, no free alternative exists for freelancers

## 3. cenoa-freelance-fee-calculator
**What data:** Platform fees (Upwork 20%→5% sliding, Fiverr 20%, Freelancer.com 10%, etc.) + Gateway fees (Payoneer 2%, Wise 1%, PayPal 3%+$0.30, Crypto 0.5%) + Currency conversion fees (PKR 2%, NGN 2.5%, EGP 2%, TRY 1.5%)
**Useful for Cortex:** Complete fee comparison data for all major platforms and gateways
**Integration priority:** HIGH — Core value prop, shows exact money savings

## 4. cenoa-payment-gateway-checker
**What data:** Detailed gateway comparison across PK, NG, EG, TR: Cenoa (0.99-1.5%), Payoneer (8.5%), Wise (blocked/2%), PayPal (blocked/9.4%), WorldFirst (7%). Features: account opening time, crypto support, freezing risk, document requirements.
**Useful for Cortex:** Country-specific gateway availability and total fee breakdowns
**Integration priority:** HIGH — Complements fee calculator with gateway-level detail

## 5. cenoa-rate-calculator
**What data:** 18 job categories with base rates, 25+ countries with market multipliers (0.25x-1.1x), 4 experience levels (0.6x-2.0x), client market premiums. Plus hero calculator with simplified rates.
**Useful for Cortex:** Market rate benchmarks and location adjustment factors
**Integration priority:** HIGH — Rate positioning is critical for freelancers

## 6. cenoa-freelance-rate-calculator
**What data:** Country-specific tax rates (PK 25%, NG 24%, EG 22.5%, TR 20%, etc.), income-to-rate formula accounting for taxes, expenses, vacation days, non-billable hours. Outputs: min hourly, recommended (1.2x buffer), daily/weekly/monthly rates.
**Useful for Cortex:** Comprehensive rate calculation with tax and expense modeling
**Integration priority:** HIGH — More detailed than basic rate calc, covers the "what should I charge" question

## 7. project-scope-analyzer
**What data:** 6 red flag categories with keyword patterns (scope creep, budget issues, vague requirements, timeline issues, revision traps, communication flags). Severity scoring (critical=3, high=2, medium=1). Clarity score formula. Risk rating matrix (Green/Yellow/Red).
**Useful for Cortex:** Complete client-side scope analysis with pattern matching
**Integration priority:** HIGH — Helps freelancers evaluate projects before bidding

## Summary: Integration Plan

| Tool | Priority | Approach |
|------|----------|----------|
| Fee Calculator | HIGH | Merge fee-calc + gateway-checker data into unified comparator |
| Rate Calculator | HIGH | Merge both rate calculators into comprehensive rate advisor |
| Contract Reviewer | HIGH | Client-side keyword/pattern matching (no AI needed) |
| Scope Analyzer | HIGH | Direct port of pattern matching + scoring logic |
| Ad Generator | MEDIUM | Template-based copy generator (no AI, use pre-built templates) |

All 5 tools integrated as FREE tabs — no paywall. This differentiates Cortex from competitors.
