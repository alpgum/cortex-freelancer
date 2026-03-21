# Hacker News Posting SOP

## Post Format

### Show HN Post
```
Title: Show HN: Cortex Freelancer — AI tools to help freelancers optimize rates, proposals, and fees

URL: https://cortexfreelancer.com
```

- Title must start with "Show HN:"
- Keep title under 80 characters
- No ALL CAPS, no exclamation marks, no emoji
- Focus on what it does, not marketing claims
- URL goes in the URL field (not as a text post)

### First Comment (Post Immediately After Submission)
Write a top-level comment explaining:
1. What the product does (2–3 sentences)
2. Why you built it (personal motivation)
3. Technical details HN cares about (stack, architecture decisions)
4. What feedback you're looking for
5. What's next on the roadmap

**Example:**
```
Hey HN — I'm [name], and I built this because I freelanced for 3 years
and kept running into the same problems: underpricing my work, losing
time on proposals, and getting hit with unexpected platform fees.

Cortex analyzes your freelancer profile against market data and gives
you actionable suggestions. The fee calculator compares costs across
Upwork, Fiverr, Toptal, and direct invoicing.

Stack: Vanilla JS frontend, Vercel serverless functions, Firebase,
Stripe for billing, Claude API for AI features.

Would love feedback on the profile analysis accuracy and whether the
fee comparisons match your experience. What tools do you wish existed
for freelancing?
```

## Timing

| Window | Time (UTC) | Notes |
|--------|-----------|-------|
| Best | 14:00–16:00 (Tue–Thu) | US morning, peak HN traffic |
| Good | 13:00–17:00 (Mon–Fri) | Broader weekday window |
| Avoid | Weekends, US holidays | Lower traffic, faster churn |

## HN Culture Rules

### Do
- Be technical and specific
- Share real numbers (users, revenue, metrics)
- Acknowledge competitors honestly
- Respond thoughtfully to every comment
- Accept criticism gracefully
- Share what you learned building it

### Don't
- Use marketing language ("revolutionary", "game-changing")
- Post during another big HN story (check front page first)
- Ask people to upvote (vote manipulation = ban)
- Get defensive in comments
- Ignore tough questions
- Delete and repost if it doesn't gain traction (wait 2+ days)

## Comment Reply Strategy

### Technical Questions
- Answer with specifics: architecture, libraries, trade-offs
- Be honest about limitations
- Share code snippets or links to relevant implementation details

### Skepticism / "Why Not Just X?"
- Acknowledge the alternative genuinely
- Explain your differentiation without being dismissive
- Example: "You're right that a spreadsheet covers the basics. We add value with [specific feature] that's hard to replicate manually."

### Feature Requests
- Thank them and be specific about roadmap
- "That's on our list for Q3" or "Hadn't considered that — great idea"

### Negative Feedback
- Never argue — agree with what's valid, explain your reasoning
- "Fair criticism. We prioritized [X] first but [Y] is next."

## Monitoring

- Watch the post for the first 4 hours minimum
- Reply to comments within 30 minutes during this window
- Use https://news.ycombinator.com/item?id=XXXXX to track
- Set up HN alerts for "Cortex Freelancer" mentions

## Repost Rules

- If a post gets zero traction, you can resubmit after a few days
- Slightly rephrase the title
- Do not resubmit more than 2–3 times total
- If it doesn't work after that, the audience isn't interested — pivot your angle
