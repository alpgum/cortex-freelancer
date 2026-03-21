# Retention Email Sequence (3 Emails)

**Trigger:** Pro subscriber shows declining usage (no login for 14+ days)
**Goal:** Re-engage → remind of value → prevent churn
**Cadence:** Day 14, Day 21, Day 28 (after last activity)

---

## Email 1: The Check-In (Day 14 of inactivity)

**Subject:** Everything okay, {{first_name}}?
**Preview Text:** We noticed you haven't logged in — here's what you might be missing.

---

Hey {{first_name}},

It's been a couple of weeks since you last used Cortex. Just checking in.

A few things that happened while you were away:

{{dynamic_block: latest feature updates or improvements}}

**Meanwhile, your AI agents are ready to work:**

- **Business Development Agent** — Have new project leads waiting? It can scan and generate proposals while you sleep.
- **Finance Manager** — Any outstanding invoices? It'll chase them for you.
- **Schedule Manager** — Calendar getting messy? It handles timezone math and booking.

**Quick win to get back on track:**

Open Cortex and run a quick Rate Check. Markets shift — your rate from 3 months ago might already be outdated. Takes 30 seconds.

**→ [Log In to Cortex]**

If something's not working for you or you have feedback, just reply to this email. I read every one.

The Cortex Team

---

## Email 2: The Value Reminder (Day 21 of inactivity)

**Subject:** You're paying $29/mo — here's how to get 10x the value
**Preview Text:** Most Pro users save 10+ hours/week. Here's how.

---

Hey {{first_name}},

Honest question: are you getting your money's worth from Cortex Pro?

Here's what top users do with their subscription every week:

**Monday:** Business Development Agent scans new project listings and drafts 5-10 personalized proposals. (Saves ~3 hours)

**Tuesday-Thursday:** Project Manager tracks deadlines and sends progress updates to clients automatically. Client Comms Agent handles routine emails. (Saves ~2-3 hours)

**Friday:** Finance Manager generates invoices for completed work and follows up on unpaid ones. Schedule Manager blocks out deep work time for next week. (Saves ~2 hours)

**Ongoing:** Growth Strategist analyzes your revenue trends and suggests rate adjustments. Contract Agent manages all legal documents. (Saves ~1-2 hours)

That's 8-10 hours saved per week. At your rate, that's hundreds or thousands of dollars in recovered billable time — every month.

**→ [Set Up Your Weekly Workflow]**

If you're not sure where to start, try this: open the Business Development Agent and let it draft proposals for 3 job listings that match your skills. See the quality for yourself.

The Cortex Team

---

## Email 3: The Honest Ask (Day 28 of inactivity)

**Subject:** Should we part ways?
**Preview Text:** No hard feelings — but let's make sure you're making the right call.

---

Hey {{first_name}},

It's been almost a month since you last used Cortex. I want to be straight with you:

**If Cortex isn't helping you, you shouldn't be paying for it.**

But before you go, I want to make sure you're not leaving value on the table. Here's what your Pro subscription includes that you might not have explored:

- **8 AI agents** working in parallel on your business
- **78+ templates** for proposals, contracts, invoices, and emails
- **Payment optimization** — are you still losing 3-5% to transfer fees?
- **Rate benchmarking** — your market rate may have changed since you last checked
- **Every future agent and feature** — included at no extra cost

**Three options:**

1. **Give it one more week.** → [Log in and try the Business Development Agent]
2. **Talk to us.** Reply to this email and tell us what's not working. We'll fix it or help you get set up properly.
3. **Cancel.** No hard feelings, no guilt trip. You can cancel anytime from your account settings, and you'll still have access to all free tools.

Whatever you decide, we're grateful you gave Cortex a shot. And the free tools are yours forever.

The Cortex Team

P.S. — If it's a pricing issue, reply and let's talk. We'd rather find a solution than lose you.

---

**Sequence metadata:**
- Cancel sequence immediately on any login/activity
- Track: re-engagement rate per email, eventual churn rate
- Email 3 non-responders: tag as "at-risk" for winback sequence after churn
- Personalize with actual usage data where available (proposals generated, invoices created, etc.)
- Never send more than 1 retention email per week
