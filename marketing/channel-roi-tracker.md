# Channel ROI Tracker — Cortex Freelancer

## Active Channels

| Channel | Monthly Spend | Signups | CPA | Pro Conversions | Revenue | ROI |
|---------|--------------|---------|-----|-----------------|---------|-----|
| Twitter/X organic | $0 | — | $0 | — | — | — |
| LinkedIn organic | $0 | — | $0 | — | — | — |
| Reddit organic | $0 | — | $0 | — | — | — |
| Product Hunt | $0 | — | $0 | — | — | — |
| Blog/SEO | $0 | — | $0 | — | — | — |
| Referral program | $0 | — | $0 | — | — | — |
| Email newsletter | $0 | — | $0 | — | — | — |
| TikTok organic | $0 | — | $0 | — | — | — |

## UTM Tracking Convention

All links should follow this pattern:
```
?utm_source={channel}&utm_medium={type}&utm_campaign={campaign_name}
```

Examples:
- Twitter bio: `?utm_source=twitter&utm_medium=social&utm_campaign=bio_link`
- Reddit post: `?utm_source=reddit&utm_medium=social&utm_campaign=launch_post`
- Email signature: `?utm_source=email&utm_medium=signature&utm_campaign=founder`
- Product Hunt: `?utm_source=producthunt&utm_medium=listing&utm_campaign=launch`

## Weekly Review Checklist

- [ ] Pull UTM data from GA4 (Acquisition > Traffic acquisition)
- [ ] Check Firestore `first_touch_source` distribution
- [ ] Calculate CPA per channel (spend / signups)
- [ ] Calculate ROI per channel ((revenue - spend) / spend)
- [ ] Double down on channels with best ROI
- [ ] Cut or reduce channels with CPA > $15

## Key Metrics to Track

- **CPA (Cost per Acquisition)**: Total channel spend / total signups from that channel
- **CAC (Customer Acquisition Cost)**: Total channel spend / paying customers from that channel
- **LTV:CAC Ratio**: Target > 3:1
- **Payback Period**: CAC / monthly revenue per customer (target < 2 months)

## Notes

- First touch source is captured in Firestore at signup (see auth.js [254])
- Last touch source is updated on every visit
- GA4 UTM parameters tracked automatically via analytics.js [234]
