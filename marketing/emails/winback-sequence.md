# Winback Email Sequence (2 Emails)

**Trigger:** User cancels Pro subscription or churns (no activity for 60+ days)
**Goal:** Re-engage churned users with new value or incentive
**Cadence:** Day 7 after cancellation, Day 30 after cancellation

---

## Email 1: The Update (Day 7 after cancellation)

**Subject:** What's new at Cortex (and what you might miss)
**Preview Text:** We've been busy since you left. Here's what changed.

---

Hey {{first_name}},

No pressure — just wanted to let you know what we've shipped since you left:

{{dynamic_block: list 3-5 most significant updates since user's last active date}}

**A few things to remember:**

Your free tools are still active. You can use the Rate Calculator, Proposal Generator, Invoice Creator, Contract Builder, Email Writer, and Scope Analyzer anytime — no account needed.

**If you left because of a specific issue:**

We'd genuinely love to hear about it. Product feedback from churned users is the most valuable feedback we get. Reply to this email and tell us what didn't work. Even one sentence helps.

**If you want to come back:**

Use code **WELCOMEBACK** for 40% off your first month back. That's $17.40 instead of $29.

**→ [Reactivate with 40% Off]**

Either way, we hope Cortex helped while you were here. And the free tools are yours for life.

The Cortex Team

---

## Email 2: The Last Check-In (Day 30 after cancellation)

**Subject:** One freelancer's story (and an open door)
**Preview Text:** How a designer in Lagos went from $15/hr to $40/hr in 3 months.

---

Hey {{first_name}},

Quick story, then I'll leave you alone.

A graphic designer in Lagos signed up for Cortex 4 months ago. She was charging $15/hr on Upwork, losing about $180/month to PayPal fees, and spending 3 hours a day on proposals that rarely converted.

After 3 months with Cortex:

- **Rate:** $15/hr → $40/hr (Rate Calculator showed her the market gap, Proposal Generator helped her pitch at the higher rate)
- **Payment fees:** $180/month → $22/month (switched to optimized payment method via our fee comparison)
- **Proposal time:** 3 hours/day → 20 minutes/day (AI handles first drafts)
- **Net income increase:** ~$3,200/month

Her total cost for Cortex Pro? $87 (3 months × $29).

**This isn't a sales pitch.** If Cortex isn't right for you, that's completely fine. But if the reason you left was timing, budget, or not knowing where to start — the door is always open.

**Your standing offer:**
- Free tools: always available, no login needed
- Pro reactivation: **WELCOMEBACK** for 40% off first month
- Annual plan: $249/year (saves 28% vs monthly)
- Questions: reply to this email anytime

**→ [Explore What's New at Cortex]**

This is the last email in this sequence. We won't keep bugging you. But if you ever need us, we're here.

All the best with your freelancing journey,
The Cortex Team

---

**Sequence metadata:**
- Do not send if user reactivates at any point
- Track: reactivation rate per email, coupon redemption rate
- Tag users who open but don't reactivate as "warm churned" for future product announcements only
- After this sequence, move to quarterly product update list only (no more sales emails)
- Respect unsubscribes immediately — no "are you sure?" friction
- Personalize Email 1 dynamic block with actual features shipped since user's last active date
