# Launch Metrics Dashboard

Key metrics to track during and after launch. Review daily for the first week, then weekly.

## North Star Metrics

| Metric | Target (Week 1) | Source |
|--------|-----------------|--------|
| Total signups | 500+ | Firebase Auth |
| Free → Pro conversion | 3–5% | Stripe |
| DAU (Daily Active Users) | 100+ | Analytics |
| Tool uses per user | 2+ | localStorage / API |
| Revenue | $1,000+ | Stripe Dashboard |

## Traffic Metrics

| Metric | Source |
|--------|--------|
| Unique visitors | Google Analytics / Vercel Analytics |
| Page views | Google Analytics |
| Bounce rate | Google Analytics |
| Top referrers | Google Analytics |
| UTM breakdown (source/medium/campaign) | CortexUTM / GA |
| Landing page performance | GA Landing Pages report |

## Acquisition Channels

| Channel | Metric | Target |
|---------|--------|--------|
| Product Hunt | Upvotes, rank, referral signups | Top 5, 200+ upvotes |
| Hacker News | Points, comments, referral traffic | Front page |
| Twitter/X | Impressions, link clicks, follows | 10K+ impressions |
| Reddit | Upvotes, comments, referral signups | 50+ upvotes |
| LinkedIn | Impressions, engagement, clicks | 5K+ impressions |
| Email (waitlist) | Open rate, click rate, conversions | 40% open, 15% click |
| Direct / organic | Signups from direct traffic | Track baseline |

## Revenue Metrics

| Metric | Source |
|--------|--------|
| MRR (Monthly Recurring Revenue) | Stripe |
| Lifetime deal purchases | Stripe (pro_lifetime) |
| Average Revenue Per User (ARPU) | Stripe / signups |
| Churn rate (after Day 7) | Stripe |
| Refund requests | Support inbox |
| Failed payments | Stripe Dashboard |

## Engagement Metrics

| Metric | Source |
|--------|--------|
| Tools used per session | cortex_tool_history |
| Most popular tool | cortex_tool_history |
| Return rate (Day 1, Day 3, Day 7) | Firebase / Analytics |
| Scope analyses saved | cortex_saved_scopes |
| Invoices created | cortex_saved_invoices |
| Proposals generated | cortex_saved_proposals |
| PDF exports (Pro) | API logs |

## Support Metrics

| Metric | Target |
|--------|--------|
| Support tickets | < 20/day |
| Avg response time | < 4 hours |
| Bug reports (critical) | 0 |
| Feature requests logged | Track all |

## Monitoring & Alerts

| System | Dashboard |
|--------|-----------|
| Uptime | Vercel Status / custom status page |
| Error rate | Sentry |
| API latency (p95) | Vercel Functions logs |
| Stripe webhook failures | Stripe Dashboard > Webhooks |
| Firebase Auth errors | Firebase Console |

## Daily Review Template

```
Date: YYYY-MM-DD
Signups today: ___
Pro conversions: ___
Revenue today: $___
Top traffic source: ___
Support tickets: ___
Critical bugs: ___
Action items:
-
```

## Weekly Summary Template

```
Week of: YYYY-MM-DD
Total signups: ___
Total revenue: $___
MRR: $___
Conversion rate: ___%
Top channel: ___
NPS / feedback themes:
-
Next week priorities:
-
```
