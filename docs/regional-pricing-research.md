# Regional Pricing Research — PPP-Adjusted Pricing

## Methodology

Purchasing Power Parity (PPP) adjustments ensure our pricing is affordable in each target market relative to local purchasing power. We use World Bank PPP conversion factors and local median freelancer income data.

**Formula**: `localPrice = basePrice × pppMultiplier × affordabilityAdjustment`

Where:
- `basePrice` = US price ($29/mo, $249/yr)
- `pppMultiplier` = World Bank PPP ratio relative to USD
- `affordabilityAdjustment` = additional factor based on local freelancer income data (0.8-1.2)

---

## PPP-Adjusted Pricing Table

| Country | PPP Multiplier | Monthly (USD) | Annual (USD) | Local Currency Equivalent |
|---------|---------------|---------------|--------------|--------------------------|
| US      | 1.00          | $29           | $249         | $29 USD                  |
| GB      | 0.85          | $24           | $199         | £19 GBP                  |
| DE      | 0.80          | $23           | $189         | €21 EUR                  |
| TR      | 0.30          | $8            | $65          | ₺260 TRY                |
| BR      | 0.35          | $10           | $79          | R$50 BRL                 |
| PH      | 0.28          | $8            | $59          | ₱450 PHP                |
| EG      | 0.18          | $5            | $42          | E£245 EGP                |
| IN      | 0.23          | $6            | $49          | ₹500 INR                |
| PK      | 0.22          | $6            | $49          | ₨1,670 PKR              |
| NG      | 0.25          | $7            | $55          | ₦10,500 NGN             |

---

## Market Analysis

### Tier 1 — Full Price Markets
**US, GB, DE** — High purchasing power, established freelance infrastructure. Full or near-full pricing appropriate. These markets have mature payment systems and expect premium SaaS pricing.

### Tier 2 — Moderate Discount Markets
**TR, BR, PH** — Moderate purchasing power with growing freelance ecosystems. 65-72% discount creates accessible price points without undervaluing the product. These markets are price-sensitive but willing to pay for quality tools.

### Tier 3 — Deep Discount Markets
**EG, IN, PK, NG** — Lower purchasing power but rapidly growing freelance populations. 75-82% discount needed for mass adoption. Volume strategy: lower ARPU but significantly larger addressable market.

---

## Competitive Analysis

| Competitor    | US Price | Emerging Market Discount | Approach |
|---------------|----------|-------------------------|----------|
| Bonsai        | $24/mo   | None                    | Single global price |
| HoneyBook     | $19/mo   | None                    | USD-only pricing |
| AND.CO        | $18/mo   | None                    | No localization |
| **Cortex**    | $29/mo   | Up to 82%               | PPP-adjusted per market |

Our PPP-adjusted pricing is a significant competitive advantage in emerging markets where competitors offer no localization.

---

## Implementation Notes

1. **Currency Display**: Show prices in local currency on landing pages and checkout
2. **Geo-detection**: Use IP geolocation to suggest appropriate pricing tier
3. **Manual Override**: Allow users to select their country if geo-detection is incorrect
4. **Stripe Integration**: Use Stripe's multi-currency support for local billing
5. **Coupon Strategy**: Region-specific coupon codes as a bridge before full Stripe localization
6. **Anti-abuse**: Require local payment method or phone verification for discounted tiers

---

## Revenue Projections

Assuming 5% conversion rate on landing pages:

| Market | Monthly Visitors (est.) | Conversions | ARPU | Monthly Revenue |
|--------|------------------------|-------------|------|----------------|
| EG     | 15,000                 | 750         | $5   | $3,750         |
| PK     | 12,000                 | 600         | $6   | $3,600         |
| NG     | 10,000                 | 500         | $7   | $3,500         |
| TR     | 8,000                  | 400         | $8   | $3,200         |
| IN     | 20,000                 | 1,000       | $6   | $6,000         |

**Total emerging market potential**: ~$20,050/month additional revenue

---

## Next Steps

- [ ] Implement geo-based pricing in Stripe checkout
- [ ] Create localized landing pages for PK, NG, TR, IN, BR, PH
- [ ] Set up regional coupon codes as interim solution
- [ ] A/B test pricing tiers in each market
- [ ] Monitor conversion rates and adjust multipliers quarterly
