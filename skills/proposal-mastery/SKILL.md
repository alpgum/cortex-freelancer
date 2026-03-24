# Proposal Mastery — OpenClaw Skill

> Context-aware proposal generation with client-type adaptation, win-pattern learning, and intelligent auto-population.

---

## Client Type Detection

Proposals must adapt to the client. Detect client type from job description signals:

| Client Type | Signals | Tone | Emphasis |
|---|---|---|---|
| **Startup** | "MVP", "co-founder", "equity", "seed", "iterate fast", small budget, vague scope | Friendly, enthusiastic | Speed, flexibility, wearing multiple hats |
| **Enterprise** | "compliance", "SLA", "stakeholders", "enterprise", large budget, formal language | Professional, structured | Process, reliability, scalability, security |
| **Agency** | "client", "white-label", "deadline", "deliverables", "brief", multiple projects | Confident, efficient | Turnaround time, communication, portfolio depth |
| **SMB** | "small business", "our team", "budget-friendly", moderate budget | Warm, practical | Value for money, clear milestones, no jargon |
| **Individual** | "I need", "my website", "personal project", micro budget | Casual, helpful | Simplicity, guidance, education |
| **Repeat Client** | returning client indicators, past project references | Familiar, direct | Continuity, loyalty discount, past success |

## Project Category Mapping

Map job keywords to optimal template + approach:

| Category | Keywords | Best Template | Key Differentiators |
|---|---|---|---|
| Web Development | react, node, frontend, backend, fullstack, API | `tpl-web-dev` | Architecture decisions, tech stack match, performance |
| Mobile | ios, android, flutter, react native, app | `tpl-mobile` | App store experience, device testing, UX |
| Design | figma, UI, UX, branding, mockup, wireframe | `tpl-design` | Portfolio visuals, design process, iterations |
| Content/Copy | blog, SEO, copywriting, content, article | `tpl-writing` | Writing samples, SEO metrics, brand voice |
| Marketing | ads, growth, social media, analytics, PPC | `tpl-marketing` | ROAS numbers, campaign results, data-driven |
| DevOps/Cloud | AWS, docker, kubernetes, CI/CD, terraform | `tpl-devops` | Uptime SLAs, cost savings, automation |
| Data | data entry, spreadsheet, scraping, excel | `tpl-data-entry` | Accuracy rate, speed, volume handled |
| QA/Testing | testing, QA, automation, selenium, cypress | `tpl-qa` | Bug detection rate, frameworks, CI integration |
| PM/Consulting | project management, strategy, agile, scrum | `tpl-pm` | Team size managed, budget managed, methodology |

## Win Pattern Rules

Proposals that win share these patterns (from Upwork/freelance platform data):

### Structure
1. **Open with specificity** — reference something unique from the job post
2. **Show understanding** — restate the client's problem in your own words
3. **Prove capability** — 1-2 concrete, relevant examples with metrics
4. **Propose approach** — brief, actionable plan (3-5 steps max)
5. **Close with CTA** — specific next step ("15-min call this week?")

### Length Optimization
- **Sweet spot**: 150-250 words (higher response rate than long proposals)
- **First 2 sentences**: Most critical — clients scan, don't read
- **Avoid**: Generic openings, "Dear Sir/Madam", copy-paste feel
- **Include**: At least one number/metric, one question to the client

### Tone Calibration by Budget
| Budget Range | Tone Adjustment |
|---|---|
| < $500 | Efficient, no-nonsense, quick turnaround emphasis |
| $500-$2K | Balanced, milestone-based, clear deliverables |
| $2K-$10K | Detailed approach, process emphasis, references |
| $10K+ | Strategic, discovery-first, phased proposal |

## Auto-Population Variables

These variables are auto-filled from user profile + job context:

| Variable | Source | Fallback |
|---|---|---|
| `{{CLIENT_NAME}}` | Job post client name | "Hiring Manager" |
| `{{PROJECT_NAME}}` | Job title | "your project" |
| `{{YEARS_EXPERIENCE}}` | Profile tenure | "several" |
| `{{RELEVANT_SKILL}}` | Top matching skill | Primary skill |
| `{{HOURLY_RATE}}` | Profile rate | Market average |
| `{{PROJECT_RATE}}` | Estimated from scope | Rate x hours |
| `{{TIMELINE}}` | Scope-based estimate | "2-4 weeks" |
| `{{PORTFOLIO_LINK}}` | Profile portfolio URL | Cortex profile |
| `{{WIN_RATE}}` | Proposal tracker data | Hidden if N/A |
| `{{PAST_SIMILAR}}` | Best matching past project | Hidden if none |
| `{{JSS}}` | Job Success Score | Hidden if N/A |

## Smart Suggestions

When generating a proposal, the skill engine should suggest:

1. **Template match** — which built-in template best fits this job
2. **Tone recommendation** — based on client type + budget
3. **Key phrases to include** — extracted from job description
4. **Red flags** — budget too low, scope creep risk, vague requirements
5. **Similar winning proposals** — from user's history (if win rate tracked)

## Proposal Quality Gates

Before finalizing, check:

- [ ] Opens with something specific to THIS job (not generic)
- [ ] Mentions at least 2 relevant skills from the job post
- [ ] Includes at least one metric or concrete example
- [ ] Has a clear call-to-action
- [ ] Word count in 150-250 range
- [ ] No spelling/grammar red flags
- [ ] Tone matches client type
- [ ] Rate/pricing aligns with budget expectations
