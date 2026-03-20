# Reddit Post — r/SideProject

**Title:** I built an AI business manager for freelancers — 3 autonomous agents that find jobs, manage projects, and handle invoices

---

**What I built:**

Cortex Freelancer — an AI-powered back-office for freelancers. Instead of one chatbot that does everything poorly, it's three specialized agents:

1. **Business Dev Agent** — Scans job platforms, matches opportunities to your skill profile, drafts personalized proposals
2. **Project Manager Agent** — Tracks deadlines across clients, generates status updates, flags scope creep
3. **Finance Manager Agent** — Creates invoices, optimizes payment methods by corridor, follows up on late payments

**Why I built it:**

I freelance. I was spending ~40% of my time on non-billable admin work. Finding clients, writing proposals, chasing payments, updating project status. Built this to automate the parts I hate so I could focus on the parts I'm good at.

**How it works:**

The system is built on OpenClaw — an open agent orchestration layer. Each agent has:

- Its own context and memory (Business Dev knows your portfolio and win rates; PM knows your project timelines; Finance knows your payment history)
- Defined action boundaries (agents can draft but not send without approval for critical actions)
- Cross-agent communication (PM can tell Finance when a milestone is complete to trigger an invoice; Business Dev can tell PM when a new project is won)

The agents use LLMs for reasoning and generation, but the actual integrations (Upwork API, payment platforms, calendar, email) are handled through structured tool calls — not free-form "browse the web" style automation.

**Current state:**

- Business Dev: Job matching works well. Proposal quality is maybe 7/10 — good enough to start from, needs human polish.
- PM: Deadline tracking is solid. Auto-generated client updates are decent but occasionally robotic.
- Finance: Invoice generation and payment method optimization are the most polished parts. Fee savings are real and measurable.

**What's next:**

- Better proposal personalization (incorporating win/loss patterns)
- Multi-platform support beyond Upwork (Fiverr, Toptal, direct clients)
- Smarter scope detection in PM agent
- Mobile notifications for time-sensitive actions

**Looking for feedback + beta users:**

I'm recruiting 10 freelancers to beta test for 2 weeks. Free Pro access ($29/mo value) during beta, founding member pricing after.

Ideal testers: active freelancers with 3+ clients, willing to give daily feedback.

If you want to try it or just have questions about the architecture, I'm happy to go deep in comments. DM me for beta access.

**Tech stack highlights:**
- Agent orchestration: OpenClaw
- LLM: Claude for reasoning/generation
- Integrations: Structured tool calls to platform APIs
- State management: Per-agent memory with cross-agent event bus

Would love feedback from other builders — especially on the multi-agent architecture. Is three agents the right split, or should some of these be combined?
