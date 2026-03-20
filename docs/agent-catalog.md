# Agent Catalog

Cortex Freelancer ships with 8 specialized agents. Each agent has its own templates, scripts, and domain expertise to handle a specific area of freelance business operations.

---

## 🔍 Business Development Agent

**One-liner:** Finds jobs, writes winning proposals.

The Business Development Agent is your frontline scout for freelance opportunities. It continuously scans platforms like Upwork for jobs matching your skills, budget preferences, and availability. Once a match is found, it generates personalized proposals using proven templates tailored to the project category — from web development to translation work. It tracks proposal win rates over time so you can refine your approach and focus on the highest-converting job types.

**Templates:**
- `web-dev-proposal.md` — Web development project proposals
- `design-proposal.md` — Graphic and UI/UX design proposals
- `writing-proposal.md` — Content writing and copywriting proposals
- `data-entry-proposal.md` — Data entry and administrative proposals
- `mobile-dev-proposal.md` — Mobile app development proposals
- `seo-proposal.md` — SEO and digital marketing proposals
- `video-editing-proposal.md` — Video editing and production proposals
- `translation-proposal.md` — Translation and localization proposals
- `consulting-proposal.md` — Consulting and strategy proposals
- `follow-up.md` — Follow-up messages after proposal submission

**Scripts:**
- `job_scanner.py` — Scans Upwork for jobs matching your criteria (skills, budget, client history)
- `proposal_gen.py` — Generates personalized proposals using your profile data and the job description

**Use case example:**
> "I need to find Python/Django jobs on Upwork with budgets over $1000"
>
> The agent runs `job_scanner.py` with your filters, returns a ranked list of matching jobs, and drafts a tailored proposal for the top matches using `proposal_gen.py` and the `web-dev-proposal.md` template.

---

## 📋 Project Manager Agent

**One-liner:** Tracks deadlines, sends updates, prevents scope creep.

The Project Manager Agent keeps every active project on track from kickoff to final delivery. It monitors milestones and deadlines, generates weekly status reports for clients, and provides early warnings when timelines are at risk. When clients request changes outside the original scope, it helps you draft professional scope-change notices that protect your time and budget without damaging the relationship.

**Templates:**
- `project-kickoff.md` — Initial project setup and expectations document
- `milestone-update.md` — Progress update at each milestone
- `weekly-status.md` — Weekly status report for clients
- `delivery-message.md` — Final deliverable handoff message
- `feedback-request.md` — Request for client feedback after delivery
- `revision-request.md` — Structured revision request with clear scope
- `scope-change.md` — Scope change notice with impact assessment
- `deadline-extension.md` — Professional deadline extension request
- `difficult-client.md` — Diplomatic messaging for challenging situations
- `payment-reminder.md` — Payment reminder tied to project milestones

**Scripts:**
- `deadline_tracker.py` — Tracks all project deadlines and sends alerts as they approach
- `status_report.py` — Generates weekly status reports from project data

**Use case example:**
> "Track my website redesign project with a deadline of April 15"
>
> The agent creates a project entry in `deadline_tracker.py`, sets up milestone checkpoints, and schedules automatic status reports using `weekly-status.md`. You get alerts at 7 days, 3 days, and 1 day before each milestone.

---

## 💰 Finance Manager Agent

**One-liner:** Invoicing, payment tracking, fee optimization.

The Finance Manager Agent handles the money side of freelancing so you can focus on the work. It generates professional invoices, tracks payment status, and sends graduated reminders (gentle to firm) when payments are overdue. A standout feature is its platform fee comparison engine — it calculates the real cost of receiving payments through Upwork, Fiverr, PayPal, Wise, and Cenoa so you can guide clients toward the cheapest option. It also includes Cenoa onboarding for stablecoin-based payments that bypass traditional platform fees entirely.

**Templates:**
- `invoice-template.md` — Professional invoice with line items and payment terms
- `payment-reminder-gentle.md` — Friendly first payment reminder
- `payment-reminder-firm.md` — Firmer follow-up for overdue payments
- `rate-increase-letter.md` — Professional rate increase notification
- `quarterly-review.md` — Quarterly financial review summary
- `tax-prep-checklist.md` — Tax preparation checklist for freelancers
- `fee-comparison-card.md` — Side-by-side platform fee comparison
- `cenoa-setup-guide.md` — Step-by-step Cenoa account setup guide

**Scripts:**
- `invoice_gen.py` — Generates formatted invoices with automatic calculations
- `fee_calculator.py` — Compares fees across payment platforms for a given amount
- `cenoa_onboard.py` — Walks clients through Cenoa setup for stablecoin payments

**Use case example:**
> "Generate an invoice for Acme Corp, $3,000 USD, and compare payment platform fees"
>
> The agent runs `invoice_gen.py` to create a professional invoice using `invoice-template.md`, then runs `fee_calculator.py` to show that Upwork takes $600 (20%), PayPal takes $88, Wise takes $45, and Cenoa takes $6 — saving you up to $594 per payment.

---

## 💬 Client Communications Agent

**One-liner:** Professional emails, follow-ups, negotiations.

The Client Communications Agent is your writing partner for every client interaction. Whether you are reaching out to a cold lead on LinkedIn, negotiating a rate increase, pushing back on scope creep, or handling negative feedback gracefully, this agent drafts context-aware messages that sound professional and human. It covers the full client lifecycle from first contact through project completion, referrals, and contract renewals.

**Templates:**
- `cold-outreach-email.md` — Cold email to prospective clients
- `cold-outreach-linkedin.md` — LinkedIn connection request and message
- `intro-after-hire.md` — Introduction message after being hired
- `project-complete-thank-you.md` — Thank you message after project completion
- `rate-negotiation.md` — Rate negotiation talking points and scripts
- `scope-creep-pushback.md` — Professional pushback on out-of-scope requests
- `upsell-existing-client.md` — Upsell additional services to current clients
- `ask-for-referral.md` — Request for referrals from satisfied clients
- `check-in-quiet-client.md` — Check-in with a client who has gone quiet
- `handle-negative-feedback.md` — Respond to negative feedback constructively
- `contract-renewal.md` — Contract renewal proposal
- `holiday-greeting.md` — Holiday and seasonal greetings

**Scripts:**
- `email_drafter.py` — Drafts context-aware emails based on client history and situation

**Use case example:**
> "Draft a follow-up email to a client who hasn't responded in a week"
>
> The agent uses `email_drafter.py` with the `check-in-quiet-client.md` template to generate a warm, non-pushy follow-up that references the last conversation point and offers a clear next step.

---

## 📅 Schedule Manager Agent

**One-liner:** Timezone juggling, capacity planning, deep work protection.

The Schedule Manager Agent solves the universal freelancer problem of working across timezones with multiple clients. It finds overlapping business hours between any two cities, blocks deep work time, and tracks your capacity so you never overcommit. When you need to decline a meeting or request a reschedule, it provides polished templates that maintain professionalism while protecting your productivity.

**Templates:**
- `meeting-request.md` — Meeting request with timezone-aware time options
- `meeting-decline.md` — Polite meeting decline with alternative suggestions
- Plus 6 additional scheduling templates covering reschedules, availability sharing, vacation notices, deep work blocks, recurring meeting setup, and timezone reference cards

**Scripts:**
- `timezone_helper.py` — Finds overlapping business hours between any two timezones
- `capacity_planner.py` — Tracks workload across projects and flags overcommitment

**Use case example:**
> "Find overlapping business hours between Cairo and New York"
>
> The agent runs `timezone_helper.py` and shows that Cairo (EET, UTC+2) and New York (EST, UTC-5) overlap from 10:00 AM–5:00 PM Cairo time / 3:00 AM–10:00 AM New York time, recommending 3:00–5:00 PM Cairo (8:00–10:00 AM New York) as the ideal meeting window.

---

## 🎨 Portfolio Builder Agent

**One-liner:** Profile optimization, case studies, personal branding.

The Portfolio Builder Agent helps you present your best work to the world. It scores your existing platform profiles against best practices and gives specific improvement recommendations. It turns completed projects into compelling case studies with the problem-solution-result framework. Whether you are optimizing your Upwork headline, building a personal website portfolio, or planning content to establish thought leadership, this agent provides the structure and copy you need.

**Templates:**
- 8 portfolio templates covering profile optimization checklists, case study frameworks, portfolio page layouts, testimonial request scripts, content calendar plans, personal brand guidelines, social proof compilation, and content ideas for thought leadership

**Scripts:**
- `profile_optimizer.py` — Scores your platform profile and suggests improvements
- `case_study_gen.py` — Generates structured case studies from project data

**Use case example:**
> "Score my Upwork profile and generate a case study for my latest project"
>
> The agent runs `profile_optimizer.py` to analyze your title, overview, skills, and portfolio items, returning a score out of 100 with actionable fixes. Then `case_study_gen.py` creates a case study from your project details using the problem-solution-result framework.

---

## 📈 Growth Strategist Agent

**One-liner:** Pricing optimization, client profitability, scaling path.

The Growth Strategist Agent takes a data-driven approach to growing your freelance business. It analyzes which clients and project types generate the most profit per hour, benchmarks your rates against market data for your region and skill set, and builds quarterly business plans with revenue targets. Whether you are deciding to raise your rates, specialize in a niche, or transition from platforms to direct clients, this agent provides the numbers to back your decisions.

**Templates:**
- 8 growth templates covering quarterly business reviews, rate calculators, client profitability scorecards, specialization analysis, revenue forecasting worksheets, market positioning maps, scaling roadmaps, and annual planning guides

**Scripts:**
- `revenue_analyzer.py` — Analyzes revenue by client, project type, and time period
- `rate_benchmarker.py` — Researches market rates for your skills in your region

**Use case example:**
> "Analyze my client profitability and benchmark my web dev rates for Egypt"
>
> The agent runs `revenue_analyzer.py` to calculate your effective hourly rate per client (factoring in communication overhead, revisions, and platform fees), then `rate_benchmarker.py` pulls market data showing that mid-level web developers in Egypt charge $25–$45/hr on Upwork, helping you position competitively.

---

## 📝 Contract & Legal Agent

**One-liner:** Contracts, NDAs, scope agreements, payment protection.

The Contract & Legal Agent protects your business with proper documentation. It generates freelance contracts with customizable payment terms (hourly, fixed, milestone-based), NDAs for sensitive projects, and scope agreements that clearly define what is and is not included. When payments go wrong, it provides escalation templates from gentle reminders through formal demand letters. While it does not replace a lawyer, it gives you professional-grade templates that cover the most common freelance legal needs.

**Templates:**
- 10 legal templates covering freelance service agreements, NDAs, scope of work documents, milestone payment schedules, intellectual property assignments, non-compete clauses, subcontractor agreements, dispute resolution frameworks, termination notices, and demand letters for non-payment

**Scripts:**
- No scripts yet — contract generation is template-driven with variable substitution handled by the agent framework

**Use case example:**
> "Generate a freelance contract with milestone payments and an NDA"
>
> The agent pulls the service agreement and NDA templates, populates them with your business details and the project specifics, sets up a milestone payment schedule (e.g., 30% upfront, 40% at mid-point, 30% on delivery), and outputs ready-to-send documents.
