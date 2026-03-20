# Project Manager Agent — KNOWLEDGE

## Agile-for-Freelancers Framework

Traditional Scrum doesn't work for solo freelancers — no team for standups, no scrum master, no sprint reviews with stakeholders. But the principles are gold. Here's the adapted framework:

**Freelancer Kanban (4 columns):**
- **Backlog:** Everything the client wants, prioritized. This is your scope document in board form.
- **In Progress:** Maximum 2-3 items at once. More than that means context switching, which kills quality and speed.
- **Client Review:** Work submitted, waiting for feedback. Track how long items sit here — client review time is the #1 hidden delay in freelance projects.
- **Done:** Approved and delivered. Moving items here should feel good. Celebrate it.

**Solo Sprint Planning:** Every Monday, pick 3-5 tasks for the week. Not what you hope to do — what you commit to deliver. Write them down. At Friday EOD, compare committed vs completed. After 4 weeks, you'll know your actual velocity and can make honest promises to clients.

**Daily Standup Replacement:** 5-minute journal at start of work session. Three questions: What did I finish yesterday? What will I finish today? What's blocking me? If "blocking me" has an answer, solve it before opening any project file.

**Retrospective (Weekly, 10 min):** What went well? What went poorly? What will I change next week? Keep a running log. After a month, patterns emerge — "I always underestimate design revision time" or "clients who don't respond within 48 hours always cause delays."

## Estimation Accuracy System

Bad estimates kill freelancer profitability. Here's how to get accurate:

**Track Everything:** Create a simple spreadsheet — Task, Estimated Hours, Actual Hours, Variance, Notes. After 20 entries, calculate your average variance. Most freelancers underestimate by 30-50%.

**The Confidence Tier System:**
- **Done it 5+ times before:** Estimate + 20% buffer. You know this work.
- **Done something similar:** Estimate + 40% buffer. Unknown unknowns exist.
- **Never done this before:** Estimate + 80% buffer. Or better yet, do a paid discovery phase first.

**Break Tasks Below 4 Hours:** Any task estimated at "8 hours" is actually 3-5 sub-tasks you haven't thought through. "Build the contact page" breaks into: design layout (2hr), HTML/CSS (3hr), form validation (2hr), email integration (2hr), testing (1hr) = 10 hours, not 8. Breaking it down reveals the actual work.

**The Anchoring Trap:** Don't let the client's budget anchor your estimate. "We have $2,000 for this" doesn't mean it's a $2,000 project. Estimate the work independently, then compare. If the budget doesn't match, negotiate scope — not your estimate.

**Post-Project Analysis:** After every project, calculate: (Actual Hours / Estimated Hours) × 100 = Estimation Accuracy %. Track this metric. Aim for 85-100%. Below 85% consistently means your process is broken somewhere.

## Client Management Matrix

Not all clients deserve the same energy. Categorize and strategize:

**High-Value + High-Maintenance (VIP Clients):**
- Worth the effort but exhausting. These are $5K+ projects with demanding clients.
- Strategy: Dedicated check-ins (2-3x/week), fast response times (<4 hours), proactive status updates.
- Set boundaries early: "I'm available M-F 9-6 for messages, and I'll respond within 4 hours during those times."
- Worth it because: referrals, portfolio pieces, skill growth.

**High-Value + Low-Maintenance (Dream Clients):**
- These are gold. Big budgets, clear requirements, trust your process.
- Strategy: Don't take them for granted. Send occasional value-adds ("I noticed X could improve Y — want me to look into it?"). Nurture the relationship for retainers and repeat work.
- Protect these relationships at all costs.

**Low-Value + High-Maintenance (Drain Clients):**
- The $500 project that generates 50 messages. Revision loops, unclear feedback, late payments.
- Strategy: Set strict boundaries. Fixed revision rounds. Detailed scope documents. Payment upfront or milestone-based with small milestones.
- Long-term: Raise prices to filter them out, or politely decline future work.

**Low-Value + Low-Maintenance (Filler Clients):**
- Quick, easy projects. Good for cash flow but don't build your business.
- Strategy: Systemize. Create templates, use SOPs, deliver fast. Don't over-invest.
- Long-term: Replace with higher-value work as you grow.

## Handoff Best Practices

A clean handoff is what separates professionals from amateurs. It's also your last impression.

**The Handoff Checklist:**
1. **All deliverables** in agreed format, organized in folders (not a zip of 47 random files)
2. **Credentials document** — every login, API key, hosting detail. Use a secure method (1Password share, encrypted doc). Never email passwords in plaintext.
3. **Architecture overview** — even a 1-page doc explaining "how this works" saves the next person hours
4. **Known issues list** — be honest. "The image upload is slow on files >5MB" is better than the client discovering it later.
5. **Deployment/setup instructions** — step-by-step, assume the reader knows nothing about your setup
6. **Maintenance guide** — what needs regular attention (SSL renewal, plugin updates, backup schedule)

**The Bus Factor Test:** If you disappeared tomorrow, could someone else pick up where you left off using only your documentation? If no, your handoff isn't done.

**Client Training:** For non-technical clients, record a 10-15 min Loom walkthrough. Show them how to use what you built. This prevents 90% of "how do I..." support requests and makes you look incredibly professional.

**Warranty Period:** Set expectations upfront. "I include 2 weeks of bug fixes after delivery. After that, support is billed at $X/hr." This protects you from indefinite free support while showing you stand behind your work.

## Risk Management for Freelancers

**Top 5 Project Risks and Mitigations:**

1. **Scope Creep** — The #1 killer. Mitigation: Detailed scope document, change order process, the ACE method (Acknowledge, Clarify impact, Offer options). Never do free work to "keep the client happy" — it trains them to expect it.

2. **Client Ghosting** — Client disappears mid-project. Mitigation: Milestone-based payments (never do more than 1 milestone of unfunded work), escalating follow-up sequence (3/7/14 days), platform dispute after 14 days. On Upwork, unfunded milestones = don't start work.

3. **Technical Unknowns** — "This should be easy" turns into a rabbit hole. Mitigation: Paid discovery/spike phase for unfamiliar tech, generous buffers on estimates, early prototyping to surface issues. Never quote a fixed price on work you can't estimate.

4. **Dependency Delays** — Waiting on client for content, assets, API access, feedback. Mitigation: List all dependencies in the project kickoff, set deadlines for client deliverables, build "client delay" clauses into agreements (timeline extends by the number of days the client is late).

5. **Payment Issues** — Late payment, disputed payment, client wants refund. Mitigation: Milestone-based payments, never deliver final files before final payment, use platform escrow, keep all communication on-platform for dispute evidence.

## Status Update Framework

**The RAG System (Red/Amber/Green):**
- **Green:** On track. On budget. No blockers. Client is happy.
- **Amber:** Minor risk. Slight delay possible. Needs attention but manageable. Communicate proactively.
- **Red:** Significant risk. Timeline or budget will be impacted. Needs immediate client conversation with options.

**Weekly Status Update Template:**
```
Project: [Name]
Status: [Green/Amber/Red]
Period: [Date range]

Completed this week:
- [Deliverable/task 1]
- [Deliverable/task 2]

Planned for next week:
- [Deliverable/task 1]
- [Deliverable/task 2]

Blockers/Risks:
- [Any issues or items needing client input]

Action needed from client:
- [Specific request with deadline]
```

**When to Escalate:** Don't wait until it's red. The moment you think "this might be a problem," it's time to communicate. Clients can handle bad news early. They cannot handle surprises.

## Milestone Design Principles

**Tie Milestones to Payments:** Every milestone = a payment release. This aligns incentives and creates natural check-in points. Never have a milestone that's "just a check-in" with no deliverable.

**Front-load Risk:** Put the hardest, most uncertain work in the first 1-2 milestones. If things are going to go wrong, find out early when there's still budget and time to adjust. Don't save the hardest part for last.

**The Demo Principle:** Every milestone should produce something the client can see, click, or experience. Even backend work can have a demo — show the API responding, show the data flowing. Clients trust what they can see.

**Milestone Size:** Each milestone should be 1-2 weeks of work. Shorter than 3 days = too granular (overhead exceeds value). Longer than 3 weeks = too long between client touchpoints.

**Payment Distribution Rules:**
- First milestone: 15-25% (small, fast, builds trust)
- Middle milestones: 25-35% each (bulk of the work)
- Final milestone: 10-15% (smallest — never hold large amounts hostage to "final approval")

## Multi-Project Juggling

**Maximum Concurrent Projects by Type:**
- Deep work projects (development, design, writing): 2-3 active maximum
- Light projects (consulting, review, maintenance): 3-5 concurrent
- Mix: 2 deep + 2 light is sustainable. 3 deep is a recipe for burnout.

**Context Switching Cost:** Research shows it takes 23 minutes to fully re-engage after switching tasks. If you switch between 3 projects 4 times a day, you lose ~90 minutes just to context switching. That's 7.5 hours/week — almost a full day.

**Batching Strategy:** Dedicate specific days or half-days to specific projects. "Monday/Tuesday = Project A, Wednesday/Thursday = Project B, Friday = admin + Project C review." This minimizes switching and lets you go deep.

**Priority Matrix (when everything is urgent):**
1. Overdue deliverables (fix the bleeding)
2. Items blocking client action (unblock them so they can review while you work)
3. Items approaching deadline (prevent the next crisis)
4. New work with buffer time (invest in future you)

## Communication Cadence by Project Phase

**Kickoff (Week 1):** Daily or every-other-day communication. This is when alignment is critical. Confirm understanding, ask clarifying questions, share early progress to calibrate direction.

**Active Development (Weeks 2-N):** 2-3 updates per week. Brief, focused, forward-looking. "Completed X, working on Y, need Z from you by [date]."

**Client Review Periods:** Check in after 48 hours of silence. "Just making sure you received the delivery — let me know if you have any questions." Don't nag daily, but don't let reviews sit for a week without a nudge.

**Project Close:** Formal delivery + handoff, thank you message, 24-48 hour pause, then review request. "It's been great working with you on [project]. If you're happy with the results, a brief review mentioning [specific thing] would mean a lot."

## Deadline Negotiation

**How to Ask for an Extension (Without Losing Trust):**
1. Ask BEFORE the deadline, never after
2. Explain why (briefly, honestly — "the API integration surfaced unexpected complexity")
3. Propose a new date (specific, not "a few more days")
4. Show what's already done ("milestones 1-3 are complete, I need 3 more days for milestone 4")
5. Offer something ("I'll include the mobile optimization we discussed at no extra charge")

**The Trade Technique:** "I can hit the original deadline if we defer [lower-priority feature] to a phase 2. Or I can deliver everything by [new date]. Which works better for you?" Give the client control while being honest about constraints.

**Buffer Strategy:** Always quote clients a timeline with 20-30% buffer built in. Internal deadline = real estimate. Client-facing deadline = estimate + buffer. Delivering "early" builds trust. Delivering "late" destroys it. This isn't dishonesty — it's accounting for the reality that clients add delays, requirements shift, and things take longer than planned.

## Tool Recommendations

**Project Tracking:** Notion (flexible, great for client-facing boards), Trello (simple Kanban), Linear (if you like speed), Asana (for complex multi-phase projects)

**Time Tracking:** Toggl (simple, great reports), Clockify (free, solid), Harvest (integrates with invoicing)

**Communication:** Slack (for ongoing relationships), Loom (async video updates — clients love these), platform chat (always primary for dispute protection)

**File Sharing:** Google Drive (collaborative), Dropbox (large files), WeTransfer (one-off deliveries)

**Documentation:** Notion (living docs), Google Docs (collaborative editing), Markdown in repo (technical projects)
