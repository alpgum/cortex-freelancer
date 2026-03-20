/* ===== CORTEX FREELANCER — ANALYSIS ENGINE ===== */

// ── Rate benchmarks ($/hr) ─────────────────────────────────────────────
const BENCHMARKS = {
  "web-development":    { egypt:25, turkey:30, pakistan:20, india:22, nigeria:22, philippines:18, brazil:28, mexico:30, ukraine:32, kenya:20, us:75, uk:65, eu:60 },
  "mobile-development": { egypt:30, turkey:35, pakistan:25, india:28, nigeria:25, philippines:22, brazil:32, mexico:33, ukraine:35, kenya:23, us:85, uk:70, eu:65 },
  "design":             { egypt:20, turkey:25, pakistan:15, india:18, nigeria:18, philippines:14, brazil:22, mexico:24, ukraine:25, kenya:16, us:65, uk:55, eu:50 },
  "writing":            { egypt:15, turkey:20, pakistan:12, india:14, nigeria:15, philippines:10, brazil:18, mexico:18, ukraine:20, kenya:12, us:50, uk:45, eu:40 },
  "data-science":       { egypt:35, turkey:40, pakistan:30, india:32, nigeria:28, philippines:25, brazil:36, mexico:38, ukraine:38, kenya:26, us:90, uk:80, eu:70 },
  "devops":             { egypt:30, turkey:35, pakistan:25, india:28, nigeria:24, philippines:22, brazil:32, mexico:34, ukraine:36, kenya:22, us:85, uk:72, eu:65 },
  "marketing":          { egypt:18, turkey:22, pakistan:14, india:16, nigeria:16, philippines:12, brazil:20, mexico:22, ukraine:22, kenya:14, us:55, uk:48, eu:42 },
  "video":              { egypt:18, turkey:22, pakistan:14, india:16, nigeria:15, philippines:12, brazil:20, mexico:20, ukraine:22, kenya:14, us:55, uk:48, eu:42 },
  "blockchain":         { egypt:40, turkey:45, pakistan:35, india:38, nigeria:32, philippines:30, brazil:42, mexico:42, ukraine:44, kenya:30, us:100, uk:85, eu:78 },
  "qa":                 { egypt:22, turkey:26, pakistan:18, india:20, nigeria:19, philippines:16, brazil:25, mexico:26, ukraine:28, kenya:17, us:60, uk:52, eu:48 },
};

const SKILL_LABELS = {
  "web-development":"Web Development","mobile-development":"Mobile Development","design":"UI/UX Design",
  "writing":"Content Writing","data-science":"Data Science","devops":"DevOps","marketing":"Digital Marketing",
  "video":"Video Editing","blockchain":"Blockchain","qa":"QA Testing",
};

const COUNTRY_LABELS = {
  egypt:"Egypt",turkey:"Turkey",pakistan:"Pakistan",india:"India",nigeria:"Nigeria",
  philippines:"Philippines",brazil:"Brazil",mexico:"Mexico",ukraine:"Ukraine",
  kenya:"Kenya",us:"United States",uk:"United Kingdom",eu:"Europe",
};

const JOB_TEMPLATES = {
  "web-development": ["Full-Stack Web App","React Dashboard","E-commerce Platform","Landing Page Redesign","API Integration","WordPress Custom Theme","SaaS MVP Development","REST API Backend","Next.js Web Application","Admin Panel Build","Vue.js Frontend","GraphQL API","Shopify Store","Portfolio Website","CMS Development","Progressive Web App","Chrome Extension","Web Scraper","Payment Integration","Real-time Chat App"],
  "mobile-development": ["iOS App Development","React Native App","Flutter Cross-Platform","Android App Redesign","Mobile App UI/UX","App Store Optimization","Push Notifications System","Mobile Payment Integration","Fitness Tracking App","Food Delivery App Clone","Social Media App","AR Experience App","Ride-sharing App","Banking App","Health Monitoring App","E-learning App","Messaging App","Weather App","Music Streaming App","Photo Editor App"],
  "design": ["Brand Identity Design","Mobile App UI Design","Website Redesign","Dashboard UI Kit","Logo + Brand Guide","SaaS Product Design","E-commerce UX Audit","Design System Creation","Social Media Templates","Pitch Deck Design","Icon Set Design","Wireframe Kit","Email Template Design","Infographic Design","Product Packaging","Annual Report Design","Business Card Design","Banner Ad Design","Landing Page Design","Illustration Set"],
  "writing": ["Blog Content Strategy","SEO Article Writing","Technical Documentation","Email Newsletter Copy","Product Descriptions","Whitepaper Writing","Social Media Content","Case Study Writing","Website Copywriting","Ghostwriting Book","Press Release","Script Writing","Grant Writing","Resume Writing","Translation Services","Ebook Writing","Course Content","UX Writing","Ad Copywriting","Speech Writing"],
  "data-science": ["ML Model Development","Data Pipeline Build","Analytics Dashboard","NLP Chatbot","Predictive Model","Data Visualization","ETL Pipeline","Computer Vision System","Recommendation Engine","A/B Testing Framework","Fraud Detection Model","Sentiment Analysis","Time Series Forecast","Customer Segmentation","Data Warehouse Design","BI Report Automation","Natural Language Processing","Image Classification","Churn Prediction","Price Optimization"],
  "devops": ["AWS Infrastructure Setup","CI/CD Pipeline","Docker + Kubernetes","Cloud Migration","Monitoring Setup","Terraform IaC","Security Audit","Database Optimization","Auto-scaling Config","Backup & DR Plan","Azure Migration","GCP Setup","Load Balancer Config","Log Aggregation","Secret Management","Network Security","Container Orchestration","Performance Tuning","Cost Optimization","Incident Response Plan"],
  "marketing": ["SEO Strategy","Google Ads Campaign","Social Media Management","Email Marketing Setup","Content Marketing Plan","Influencer Outreach","Conversion Optimization","Marketing Automation","Brand Strategy","Analytics Setup","Facebook Ads","TikTok Marketing","YouTube Strategy","Podcast Marketing","Affiliate Program","PR Campaign","Event Marketing","Community Management","Growth Hacking","Market Research"],
  "video": ["YouTube Video Editing","Product Promo Video","Social Media Reels","Corporate Video","Motion Graphics","Video Ad Creation","Tutorial Video Series","Podcast Video Edit","Wedding Video Edit","Animation Explainer","Documentary Edit","Music Video","Livestream Production","360 Video Edit","Color Grading","Sound Design","Subtitle Creation","Video Thumbnail","Intro/Outro Design","Drone Footage Edit"],
  "blockchain": ["Smart Contract Dev","DeFi Protocol","NFT Marketplace","Token Launch","Web3 dApp","Blockchain Integration","Crypto Wallet","DAO Governance","DEX Development","Audit Smart Contracts","Staking Platform","Bridge Protocol","Yield Farming","Metaverse Build","GameFi Project","Token Vesting","Multi-sig Wallet","Oracle Integration","Cross-chain Bridge","Layer 2 Solution"],
  "qa": ["Automated Test Suite","Manual QA Process","Selenium Framework","API Testing","Performance Testing","Mobile App Testing","Security Testing","Regression Suite","Test Documentation","Bug Tracking Setup","Cypress E2E Tests","Load Testing","Accessibility Audit","Cross-browser Testing","CI Test Integration","Test Data Management","Visual Regression","Chaos Engineering","Contract Testing","Smoke Test Suite"],
};

// ── Templates Library ────────────────────────────────────────────────────
const TEMPLATE_LIBRARY = [
  { id:1, category:"Proposals", title:"Web Development Proposal", preview:"Professional proposal template for web development projects with scope, timeline, and pricing sections.", content:"Dear [Client Name],\n\nThank you for sharing the details of your [Project Name] project. I've reviewed your requirements carefully and I'm excited about the opportunity to bring your vision to life.\n\n## Understanding Your Needs\nBased on our discussion, you're looking for [brief summary of requirements]. I understand the importance of [key priority] and will ensure this is at the forefront of my approach.\n\n## Proposed Solution\nI recommend building your project using [technology stack], which offers:\n- Fast performance and scalability\n- Clean, maintainable codebase\n- Mobile-responsive design out of the box\n\n## Scope of Work\nPhase 1 — Discovery & Planning (Week 1)\n- Requirements deep-dive and wireframing\n- Technical architecture planning\n- Project timeline confirmation\n\nPhase 2 — Design & Development (Weeks 2-4)\n- UI/UX design with 2 revision rounds\n- Frontend development\n- Backend API development\n- Database setup and integration\n\nPhase 3 — Testing & Launch (Week 5)\n- QA testing and bug fixes\n- Performance optimization\n- Deployment and launch support\n\n## Investment\n[Project Name]: $[Amount]\n- 50% upfront, 50% on completion\n- Includes 30 days of post-launch support\n\n## Why Work With Me\n- [X] years of experience in [skill]\n- [Number] successful projects delivered\n- 5-star client satisfaction rating\n- Clear communication and weekly updates\n\nI'm available to start on [Date] and would love to discuss any questions you have.\n\nBest regards,\n[Your Name]" },

  { id:2, category:"Proposals", title:"Design Project Proposal", preview:"Clean proposal template for UI/UX and graphic design projects with portfolio references.", content:"Hi [Client Name],\n\nI was excited to come across your [Project Type] project — it aligns perfectly with my design expertise and creative sensibilities.\n\n## My Approach\nGreat design isn't just about aesthetics — it's about solving problems. Here's how I'd approach your project:\n\n1. Research & Discovery — I'll study your brand, competitors, and target audience to inform every design decision.\n2. Concept Development — I'll present 2-3 distinct creative directions for your review.\n3. Refinement — Based on your feedback, I'll refine the chosen direction with up to 3 revision rounds.\n4. Final Delivery — All files delivered in production-ready formats (Figma, PNG, SVG, PDF).\n\n## Deliverables\n- [List specific deliverables]\n- Style guide / brand guidelines\n- Source files in Figma\n- All assets in required formats\n\n## Timeline\n- Concepts: [X] business days\n- Revisions: [X] business days per round\n- Final delivery: [X] business days after approval\n\n## Investment\n$[Amount] for the complete project\n- 50% deposit to begin\n- Unlimited communication throughout\n\n## Relevant Experience\nI've completed similar projects for [Industry] clients, including [brief example]. You can view my portfolio at [link].\n\nLooking forward to creating something exceptional together.\n\nWarm regards,\n[Your Name]" },

  { id:3, category:"Proposals", title:"Content Writing Proposal", preview:"Proposal template for content writing, copywriting, and content strategy projects.", content:"Hello [Client Name],\n\nThank you for considering me for your [Content Type] project. As a professional content writer with expertise in [niche], I'm confident I can deliver content that engages your audience and drives results.\n\n## Content Strategy\nTone & Voice: [Professional / Conversational / Technical] — aligned with your brand identity\nTarget Audience: [Description]\nPrimary Goal: [Traffic / Conversions / Engagement / Education]\n\n## Deliverables\n- [X] articles/pieces of [word count] words each\n- SEO optimization (keyword research, meta descriptions, headers)\n- 1 round of revisions per piece\n- Delivered in Google Docs / Word format\n\n## Process\n1. Keyword research and topic finalization\n2. Outline approval (before writing)\n3. First draft delivery\n4. Revisions based on your feedback\n5. Final delivery with SEO checklist\n\n## Rate\n$[Amount] per [article / word / project]\n- Bulk discount available for 10+ pieces\n\n## Samples\nI've attached relevant writing samples in [niche]. Key metrics from previous work:\n- Average 3x increase in organic traffic\n- 85%+ client satisfaction on first drafts\n- Published in [notable publications]\n\nI'd love to discuss your content goals in more detail.\n\nBest,\n[Your Name]" },

  { id:4, category:"Project Mgmt", title:"Project Kickoff Template", preview:"Structured kickoff document to align with clients on scope, goals, and communication.", content:"# Project Kickoff — [Project Name]\nDate: [Date]\nClient: [Client Name]\nFreelancer: [Your Name]\n\n## 1. Project Overview\nObjective: [One-sentence description of what we're building/delivering]\nSuccess Criteria: [How we'll know the project is successful]\n\n## 2. Scope of Work\n### In Scope\n- [Deliverable 1]\n- [Deliverable 2]\n- [Deliverable 3]\n\n### Out of Scope\n- [Item 1] (can be added as a change request)\n- [Item 2]\n\n## 3. Timeline & Milestones\nMilestone | Target Date | Deliverable\nKickoff | [Date] | Project plan finalized\nPhase 1 Complete | [Date] | [Deliverable]\nPhase 2 Complete | [Date] | [Deliverable]\nFinal Delivery | [Date] | All deliverables\n\n## 4. Communication Plan\n- Primary Channel: [Slack / Email / etc.]\n- Status Updates: [Weekly / Bi-weekly] on [Day]\n- Response Time: Within [X] business hours\n- Meetings: [Frequency] via [Zoom / Google Meet]\n\n## 5. Roles & Responsibilities\nClient: Provide feedback within [X] business days, approve milestones, provide access/assets\nFreelancer: Deliver on schedule, communicate proactively, maintain quality standards\n\n## 6. Payment Schedule\nDeposit: [X]% — Project start\nMilestone 1: [X]% — [Trigger]\nFinal: [X]% — Project completion\n\nAgreed by: [Signatures / Confirmation]" },

  { id:5, category:"Project Mgmt", title:"Weekly Status Update", preview:"Professional weekly status report template for client updates.", content:"# Weekly Status Report — [Project Name]\nWeek of: [Date Range]\nPrepared by: [Your Name]\n\n## Summary\n[1-2 sentence overview of progress this week]\nOverall Status: On Track / At Risk / Blocked\n\n## Completed This Week\n- [Task 1] — [brief detail]\n- [Task 2] — [brief detail]\n- [Task 3] — [brief detail]\n\n## In Progress\n- [Task 1] — [X]% complete, expected by [date]\n- [Task 2] — [X]% complete, expected by [date]\n\n## Planned for Next Week\n- [Task 1]\n- [Task 2]\n- [Task 3]\n\n## Blockers / Issues\n- [Issue 1] — Impact: [description] — Needed: [action from client]\n- None this week\n\n## Hours Logged\nTask | Hours\n[Task 1] | [X]\n[Task 2] | [X]\nTotal | [X]\n\n## Budget Status\n- Budget: $[total]\n- Spent to date: $[amount] ([X]%)\n- Remaining: $[amount]\n\n## Key Decisions Needed\n1. [Decision 1] — need response by [date]\n\nNext update: [Date]" },

  { id:6, category:"Finance", title:"Invoice Email Template", preview:"Professional email to send along with invoices to clients.", content:"Subject: Invoice #[INV-NUMBER] — [Project Name]\n\nHi [Client Name],\n\nPlease find attached Invoice #[INV-NUMBER] for [description of work completed].\n\nInvoice Summary:\n- Invoice Number: [INV-NUMBER]\n- Date: [Date]\n- Amount Due: $[Amount]\n- Due Date: [Date — typically Net 15 or Net 30]\n\nPayment Methods:\n- Cenoa (preferred — lowest fees): [your Cenoa details]\n- Bank Transfer: [details]\n- PayPal: [email]\n\nWork completed this billing period:\n- [Task/deliverable 1]\n- [Task/deliverable 2]\n- [Task/deliverable 3]\n\nIf you have any questions about this invoice, please don't hesitate to reach out.\n\nThank you!\n\nBest regards,\n[Your Name]\n[Your Title/Business]\n[Contact Information]" },

  { id:7, category:"Finance", title:"Payment Reminder", preview:"Polite but firm payment reminder template for overdue invoices.", content:"Subject: Friendly Reminder — Invoice #[INV-NUMBER] (Past Due)\n\nHi [Client Name],\n\nI wanted to follow up regarding Invoice #[INV-NUMBER] for $[Amount], which was due on [Due Date].\n\nI understand things can get busy, so I wanted to send a friendly reminder. If the payment has already been sent, please disregard this message.\n\nInvoice Details:\n- Invoice: #[INV-NUMBER]\n- Amount: $[Amount]\n- Original Due Date: [Date]\n- Days Overdue: [X] days\n\nPayment Options:\n- Cenoa (instant, low fees): [details]\n- Bank Transfer: [details]\n- PayPal: [email]\n\nIf there are any issues with the invoice or if you'd like to discuss payment arrangements, I'm happy to work with you on a solution.\n\nI truly value our working relationship and look forward to continuing our collaboration.\n\nBest regards,\n[Your Name]\n\nThis is reminder [1st / 2nd / 3rd]. Per our agreement, a [X]% late fee applies after [X] days past due." },

  { id:8, category:"Communication", title:"Cold Outreach Template", preview:"Effective cold outreach template for reaching potential clients.", content:"Subject: [Specific Value Proposition] for [Company Name]\n\nHi [First Name],\n\nI noticed [specific observation about their business — e.g., \"your new product launch\" or \"your website could benefit from better mobile performance\"]. As a [your role] specializing in [niche], I've helped similar companies [specific result].\n\nQuick wins I see for [Company Name]:\n1. [Specific, actionable suggestion]\n2. [Another observation]\n3. [Third point if applicable]\n\nRecent results for similar clients:\n- [Client/Industry]: [Metric improvement — e.g., \"40% increase in conversion rate\"]\n- [Client/Industry]: [Metric improvement]\n\nI'd love to share a few specific ideas tailored to [Company Name] — no strings attached. Would you have 15 minutes this week for a quick call?\n\nIf now isn't the right time, no worries at all.\n\nBest,\n[Your Name]\n[Portfolio/Website link]" },

  { id:9, category:"Communication", title:"Scope Change Pushback", preview:"Professional template for handling scope creep and change requests.", content:"Hi [Client Name],\n\nThank you for sharing these additional requirements. I want to make sure we deliver the best possible result, so I'd like to clarify how these changes fit into our current project scope.\n\nOriginal Scope:\n[Brief summary of what was agreed]\n\nRequested Additions:\n- [New requirement 1]\n- [New requirement 2]\n- [New requirement 3]\n\nImpact Assessment:\nThese additions would require approximately [X] additional hours of work and would extend the timeline by [X] days/weeks.\n\nOptions:\n\nOption A — Add to Current Project\n- Additional cost: $[Amount]\n- Extended timeline: [New deadline]\n- All other deliverables remain unchanged\n\nOption B — Replace Existing Items\n- Swap [lower-priority item] for [new request]\n- No additional cost\n- Timeline shift of [X] days\n\nOption C — Phase 2 Project\n- Complete current project as scoped\n- Begin Phase 2 with new requirements\n- Separate timeline and budget\n\nI'm happy to accommodate these changes — I just want to make sure we're aligned on expectations.\n\nBest regards,\n[Your Name]" },

  { id:10, category:"Communication", title:"Testimonial Request", preview:"Template for asking satisfied clients for testimonials and reviews.", content:"Subject: Quick favor?\n\nHi [Client Name],\n\nI really enjoyed working on [Project Name] together and I'm thrilled with how it turned out.\n\nI'm building up my portfolio and client testimonials, and I'd be incredibly grateful if you could share a brief review of our work together. Even 2-3 sentences would be amazing!\n\nTo make it easy, here are some prompts:\n- What was the project about?\n- What was the result or impact?\n- Would you recommend working with me? Why?\n\nWhere to leave it (whichever is easiest):\n- Reply to this email\n- [Upwork review link]\n- [LinkedIn recommendation link]\n\nIf you're open to it, I'd also love to feature [Project Name] as a case study on my portfolio (with your approval, of course).\n\nNo pressure at all — I truly appreciate your time either way.\n\nThank you so much!\n\nWarmly,\n[Your Name]" },

  { id:11, category:"Legal", title:"Basic Freelance Contract", preview:"Simple but comprehensive freelance contract template covering key terms.", content:"FREELANCE SERVICE AGREEMENT\n\nDate: [Date]\nBetween: [Your Full Name/Business] (\"Freelancer\")\nAnd: [Client Full Name/Company] (\"Client\")\n\n1. Services\nFreelancer agrees to provide the following services:\n[Detailed description of deliverables]\n\n2. Timeline\n- Start Date: [Date]\n- Estimated Completion: [Date]\n- Final Deadline: [Date]\nDelays caused by Client (late feedback, missing assets) will extend deadlines proportionally.\n\n3. Compensation\n- Total Project Fee: $[Amount]\n- Payment Schedule:\n  - [X]% ($[Amount]) upon signing\n  - [X]% ($[Amount]) at [milestone]\n  - [X]% ($[Amount]) upon final delivery\n- Payment Method: [Cenoa / Bank Transfer / PayPal]\n- Payment Terms: Net [15/30] days from invoice date\n- Late Payment Fee: [1.5]% per month on overdue amounts\n\n4. Revisions\n- Included: [X] rounds of revisions\n- Additional revisions: $[Amount]/hour\n- Revision requests must be submitted within [X] business days of delivery\n\n5. Intellectual Property\nUpon full payment, Client receives full ownership of all final deliverables. Freelancer retains the right to display the work in portfolio and marketing materials unless otherwise agreed in writing.\n\n6. Confidentiality\nBoth parties agree to keep confidential information private.\n\n7. Termination\nEither party may terminate with [X] days written notice. Upon termination:\n- Client pays for all work completed to date\n- Freelancer delivers all completed work\n\n8. Independent Contractor\nFreelancer is an independent contractor, not an employee.\n\n9. Limitation of Liability\nFreelancer's total liability shall not exceed the total fees paid under this agreement.\n\n10. Governing Law\nThis agreement is governed by the laws of [Jurisdiction].\n\nFreelancer: _________________________ Date: ___________\nClient: _________________________ Date: ___________" },

  { id:12, category:"Legal", title:"NDA Template", preview:"Non-disclosure agreement template for protecting client information.", content:"NON-DISCLOSURE AGREEMENT (NDA)\n\nEffective Date: [Date]\nBetween: [Your Name/Business] (\"Receiving Party\")\nAnd: [Client Name/Company] (\"Disclosing Party\")\n\n1. Purpose\nThe Disclosing Party intends to share certain confidential information with the Receiving Party for the purpose of [describe project/engagement].\n\n2. Definition of Confidential Information\n\"Confidential Information\" includes, but is not limited to:\n- Business plans, strategies, and financial data\n- Technical specifications, designs, and source code\n- Customer lists and marketing plans\n- Trade secrets and proprietary processes\n- Any information marked as \"confidential\"\n\nExclusions: Information that is publicly available, already known, independently developed, or required by law.\n\n3. Obligations\nThe Receiving Party agrees to:\n- Keep all Confidential Information strictly confidential\n- Use Confidential Information only for the stated purpose\n- Not disclose to any third party without written consent\n- Take reasonable measures to protect confidentiality\n- Return or destroy all materials upon request\n\n4. Term\nThis agreement remains in effect for [2] years from the Effective Date.\n\n5. Remedies\nBreach may cause irreparable harm, and the Disclosing Party shall be entitled to seek injunctive relief.\n\n6. Governing Law\nThis NDA is governed by the laws of [Jurisdiction].\n\nReceiving Party: _________________________ Date: ___________\nDisclosing Party: _________________________ Date: ___________" },

  { id:13, category:"Growth", title:"Quarterly Business Review", preview:"Template for reviewing freelance business performance and setting goals.", content:"Quarterly Business Review — Q[X] [Year]\n\nRevenue Summary:\n- Total Revenue: $[Amount] (vs $[Amount] last quarter)\n- Projects Completed: [X]\n- Average Project Value: $[Amount]\n- Effective Hourly Rate: $[Amount]\n- Hours Worked: [X]\n\nWhat Went Well:\n- [Win 1 — e.g., landed a high-value retainer client]\n- [Win 2]\n- [Win 3]\n\nWhat Could Improve:\n- [Area 1 — e.g., proposal conversion rate was below target]\n- [Area 2]\n- [Area 3]\n\nGoals for Next Quarter:\n1. Revenue Target: $[Amount] (+[X]% growth)\n2. Rate Increase: Raise rate from $[X] to $[Y]/hr\n3. New Clients: Land [X] new clients via [channel]\n4. Skill Development: Complete [course/certification]\n5. Process Improvement: [specific improvement]\n\nAction Items:\n- [Specific action 1] — by [date]\n- [Specific action 2] — by [date]\n- [Specific action 3] — by [date]" },

  { id:14, category:"Growth", title:"Rate Increase Notice", preview:"Professional template for notifying clients about rate increases.", content:"Subject: Update to My Rates — Effective [Date]\n\nDear [Client Name],\n\nI wanted to give you advance notice about an upcoming change to my rates.\n\nEffective [Date], my rate will be:\n- New Rate: $[New Rate]/hour (previously $[Old Rate]/hour)\n- Increase: $[Difference]/hour ([X]%)\n\nWhy the change:\nOver the past [time period], I've invested in new skills and certifications, delivered [X] successful projects with measurable results, and expanded my expertise. This adjustment reflects the increased value I bring and aligns with current market standards.\n\nWhat this means for you:\n- Any work agreed upon before [Date] will be honored at the current rate\n- New projects starting after [Date] will use the updated rate\n- I'm happy to discuss retainer or bulk-hour packages at a preferred rate\n\nI truly value our working relationship and want to continue delivering exceptional results.\n\nBest regards,\n[Your Name]" },

  { id:15, category:"Portfolio", title:"Case Study Template", preview:"Structured case study template to showcase project results.", content:"Case Study: [Project Name]\n\nOverview:\n- Client: [Client Name / Industry]\n- Timeline: [Duration]\n- My Role: [Your role]\n- Technologies: [Tech stack / Tools used]\n\nThe Challenge:\n[2-3 paragraphs describing the client's problem]\nMain challenges:\n- [Challenge 1]\n- [Challenge 2]\n- [Challenge 3]\n\nThe Solution:\nPhase 1: Discovery\n[What you learned and how it informed your approach]\n\nPhase 2: Implementation\n[Technical details, creative decisions, key features]\n\nPhase 3: Launch\n[How you ensured quality and managed the launch]\n\nResults:\nMetric | Before | After | Improvement\n[Metric 1] | [Value] | [Value] | [+X%]\n[Metric 2] | [Value] | [Value] | [+X%]\n[Metric 3] | [Value] | [Value] | [+X%]\n\nClient Testimonial:\n\"[Quote from the client about working with you and the results achieved.]\"\n— [Client Name], [Title] at [Company]\n\nKey Takeaways:\n- [Learning 1]\n- [Learning 2]\n- [What you'd do differently]" },

  { id:16, category:"Portfolio", title:"Profile Optimization Guide", preview:"Checklist and template for optimizing your freelancer profile.", content:"Freelancer Profile Optimization Checklist\n\nHeadline (First thing clients see):\n- Includes your primary skill + specialty\n- Mentions a key result or benefit\n- Under 70 characters\n- Template: \"[Role] | [Specialty] | [Key Result/Benefit]\"\n- Example: \"Full-Stack Developer | React & Node.js | 50+ Apps Shipped\"\n\nProfile Photo:\n- Professional headshot (face clearly visible)\n- Good lighting, clean background\n- Friendly, approachable expression\n- High resolution (at least 400x400px)\n\nOverview / Bio:\n- Opens with a compelling hook (not \"I am a...\")\n- Clearly states who you help and how\n- Includes 2-3 specific results/metrics\n- Lists key skills and technologies\n- Ends with a call-to-action\n- 300-500 words\n\nTemplate:\n\"Need [result]? I help [type of client] achieve [outcome] through [your service].\n\nIn the past [time period], I've:\n- [Achievement with metric]\n- [Achievement with metric]\n- [Achievement with metric]\n\nMy approach: [Brief description]\nTools & technologies: [List]\n\nReady to [desired outcome]? Send me a message and let's discuss your project.\"\n\nPortfolio:\n- 4-6 best projects showcased\n- Each has a clear description of your role\n- Results/metrics included where possible\n- Screenshots or demos\n\nSkills / Tags:\n- Include trending skills in your niche\n- Mix of broad and specific skills\n- 10-15 skills listed\n\nRates:\n- Researched market rates for your skill + region\n- Set at or slightly above average\n- Consider value-based pricing for fixed projects" },

  { id:17, category:"Scheduling", title:"Meeting Request Template", preview:"Professional template for scheduling calls with clients or leads.", content:"Subject: Let's Connect — [Topic/Project Name]\n\nHi [Name],\n\nI'd love to schedule a [15/30/60]-minute call to discuss [topic].\n\nSuggested Agenda:\n1. [Topic 1 — e.g., Review project requirements]\n2. [Topic 2 — e.g., Discuss timeline and milestones]\n3. [Topic 3 — e.g., Align on next steps]\n\nMy Availability (all times in [YOUR TIMEZONE]):\n- [Day], [Date]: [Time range]\n- [Day], [Date]: [Time range]\n- [Day], [Date]: [Time range]\n\nAlternatively, feel free to pick a time that works: [Calendar booking link]\n\nMeeting Format: [Zoom / Google Meet / Phone]\nI'll send the meeting link once we confirm a time.\n\nPreparation (if any):\n- [Any documents or materials to review beforehand]\n\nIf none of these times work, just let me know your preference.\n\nBest,\n[Your Name]" },

  { id:18, category:"Scheduling", title:"Availability Update", preview:"Template for updating clients on your availability and booking status.", content:"Subject: Availability Update — [Month/Quarter]\n\nHi [Client Name / Team],\n\nQuick update on my availability for the coming weeks:\n\nCurrent Status: [Available / Limited Availability / Fully Booked]\n\nAvailability Breakdown:\nWeek 1 | [Dates] | [X] hours | [Available / Booked]\nWeek 2 | [Dates] | [X] hours | [Available / Booked]\nWeek 3 | [Dates] | [X] hours | [Available / Booked]\nWeek 4 | [Dates] | [X] hours | [Available / Booked]\n\nTime Off / Unavailable:\n- [Date range]: [Reason]\n- Response time during this period: [X] hours\n\nBooking Priority:\n1. Ongoing client projects\n2. [Type of work you want]\n3. New project inquiries\n\nHow to Secure Time:\n- Existing clients: Reply to this email\n- New projects: Book a discovery call at [link]\n- Rush/urgent: [Contact method] (rush fee may apply)\n\nNext Opening for New Projects: [Date]\n\nBest,\n[Your Name]" },

  { id:19, category:"Communication", title:"Follow-up After Proposal", preview:"Template for following up when a client hasn't responded to your proposal.", content:"Subject: Following up — [Project Name] Proposal\n\nHi [Client Name],\n\nI wanted to follow up on the proposal I sent on [Date] for [Project Name]. I hope you've had a chance to review it.\n\nI'm still very excited about this project and believe I can deliver [key result].\n\nQuick Recap:\n- Scope: [1-sentence summary]\n- Timeline: [Duration]\n- Investment: $[Amount]\n\nA few things I wanted to add:\n- [New insight or idea since the proposal]\n- [Social proof — \"I just completed a similar project that achieved X\"]\n- I'm flexible on [timeline / scope / payment terms] if needed\n\nI completely understand if the timing isn't right or if you've gone in a different direction — a quick note either way would be appreciated.\n\nWould any of these next steps be helpful?\n- 15-minute call to walk through the proposal\n- Revised scope to fit a different budget\n- A small paid trial task to test our working dynamic\n\nLooking forward to hearing from you.\n\nBest,\n[Your Name]\n\nP.S. My calendar is filling up for [month], so if you'd like to move forward, [date] would be ideal to start." },

  { id:20, category:"Communication", title:"Handling a Difficult Client", preview:"Templates for common difficult client situations with professional responses.", content:"Handling Difficult Client Situations\n\nSituation 1: Unreasonable Deadline\n\"Hi [Client Name], I appreciate the urgency on this. To deliver quality work by [requested date], I'd need to [reduce scope / add rush fee / get assets by X date]. Here are three options:\nOption A: Full scope, realistic timeline — [Date]\nOption B: Reduced scope (MVP), your deadline — [Date]\nOption C: Full scope, your deadline + rush fee ($[Amount])\nWhich works best for you?\"\n\nSituation 2: Constant Revisions Beyond Scope\n\"Hi [Client Name], I want to make sure this is perfect for you. We've completed [X] revision rounds (our agreement includes [Y]). Additional revisions are $[Rate]/hour. Alternatively, I can prioritize the top 2-3 changes within our remaining scope. What would you prefer?\"\n\nSituation 3: Payment Issues\n\"Hi [Client Name], I noticed Invoice #[Number] is [X] days past due. Could you let me know the expected payment date? Per our agreement, I'll need to pause work until the outstanding balance is resolved.\"\n\nSituation 4: Micromanagement\n\"Hi [Client Name], I appreciate how engaged you are. To help me work most efficiently, could we consolidate feedback into our [weekly check-in / shared document]? I'll continue to send regular updates to keep you in the loop.\"\n\nSituation 5: Unclear/Changing Requirements\n\"Hi [Client Name], I want to make sure I build exactly what you need. The requirements have evolved since our kickoff. I'd suggest we:\n1. Document the current requirements in writing\n2. Both sign off before I proceed\n3. Handle future changes through our change request process\nThis protects both of us and ensures the final delivery matches your vision.\"" },
];

// ── Utility ─────────────────────────────────────────────────────────────
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRand(seed) {
  let s = seed;
  return function() { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function fmt$(n) { return '$' + n.toLocaleString('en-US'); }

// ── State ───────────────────────────────────────────────────────────────
let currentUser = null;
let analysisResult = null;
let feedInterval = null;

// ── Pro State Management ────────────────────────────────────────────────
function isPro() { return localStorage.getItem('cortex_pro') === 'true'; }

function unlockPro() {
  const current = localStorage.getItem('cortex_pro') === 'true';
  localStorage.setItem('cortex_pro', current ? 'false' : 'true');
  location.reload();
}

function startPro() {
  if (typeof gtag === 'function') gtag('event', 'cta_click', { label: 'start_pro' });
  window.location.href = 'pricing.html';
}

// Dev shortcut: type "unlockpro" anywhere to toggle
(function() {
  let buffer = '';
  document.addEventListener('keydown', function(e) {
    buffer += e.key.toLowerCase();
    if (buffer.length > 20) buffer = buffer.slice(-20);
    if (buffer.includes('unlockpro')) {
      buffer = '';
      unlockPro();
    }
  });
})();

// ── Screen management ───────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (typeof gtag === 'function' && id === 'screen-signup') gtag('event', 'pricing_view');
}

// ── Tab Navigation ──────────────────────────────────────────────────────
function switchTab(tabId) {
  const proTabs = ['invoice', 'proposal', 'templates', 'ratecalc'];
  if (proTabs.includes(tabId) && !isPro()) {
    showProModal();
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const content = document.getElementById('tab-' + tabId);
  if (content) content.classList.add('active');
  if (typeof gtag === 'function') gtag('event', 'tab_switch', { tab: tabId });
}

function updateTabBadges() {
  const pro = isPro();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.dataset.tab;
    const badge = btn.querySelector('.pro-badge');
    if (tab === 'jobs') {
      if (pro && !btn.querySelector('.star-badge')) {
        const star = document.createElement('span');
        star.className = 'star-badge';
        star.textContent = ' \u2B50';
        btn.appendChild(star);
      }
    }
    if (badge) {
      badge.textContent = pro ? '\u2713' : '\uD83D\uDD12';
      badge.className = pro ? 'pro-badge unlocked' : 'pro-badge';
    }
  });
}

// ── Auth ────────────────────────────────────────────────────────────────
function mockGoogleLogin() {
  const name = prompt('Enter your name (mock Google login):');
  if (!name) return;
  currentUser = { name, email: name.toLowerCase().replace(/\s/g, '.') + '@gmail.com' };
  localStorage.setItem('cortex_user', JSON.stringify(currentUser));
  toast('Signed in as ' + currentUser.name);
}

function skipLogin() {
  currentUser = null;
  toast('Continuing as guest');
}

// ── Toast ───────────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Manual form toggle ──────────────────────────────────────────────────
function toggleManualForm() {
  const f = document.getElementById('manual-form');
  f.classList.toggle('visible');
}

// ── Analysis entry points ───────────────────────────────────────────────
function analyzeFromURL() {
  const url = document.getElementById('upwork-url').value.trim();
  if (!url) { toast('Please enter a URL or use manual form'); return; }
  const username = url.replace(/\/+$/, '').split('/').pop() || url;
  const seed = hashStr(username);
  const rand = seededRand(seed);
  const skills = Object.keys(BENCHMARKS);
  const skill = skills[Math.floor(rand() * skills.length)];
  const countries = Object.keys(COUNTRY_LABELS);
  const country = countries[Math.floor(rand() * countries.length)];
  const benchmark = BENCHMARKS[skill][country] || 30;
  const rate = Math.round(benchmark * (0.7 + rand() * 0.6));
  const exp = Math.floor(1 + rand() * 10);
  runAnalysis({ skill, country, rate, exp, seed, username });
}

function analyzeFromManual() {
  const skill = document.getElementById('skill-select').value;
  const country = document.getElementById('country-select').value;
  const rate = parseInt(document.getElementById('rate-input').value) || 0;
  const exp = parseInt(document.getElementById('exp-input').value) || 0;
  if (!skill || !country) { toast('Please select your skill and country'); return; }
  if (!rate) { toast('Please enter your hourly rate'); return; }
  const seed = hashStr(skill + country + rate + exp);
  runAnalysis({ skill, country, rate, exp, seed, username: null });
}

// ── Main analysis pipeline ──────────────────────────────────────────────
function runAnalysis(input) {
  if (typeof gtag === 'function') gtag('event', 'analyze_start', {skill: input.skill, country: input.country});
  showScreen('screen-terminal');
  const result = generateAnalysis(input);
  analysisResult = result;
  runTerminalAnimation(() => {
    renderDashboard(result);
    // 🤖 Robot Check — easter egg popup before showing results
    if (!sessionStorage.getItem('robot_check_passed')) {
      showRobotCheck(() => {
        sessionStorage.setItem('robot_check_passed', 'true');
        showScreen('screen-dashboard');
        if (typeof gtag === 'function') gtag('event', 'analyze_complete', {score: result.totalScore});
      });
    } else {
      showScreen('screen-dashboard');
      if (typeof gtag === 'function') gtag('event', 'analyze_complete', {score: result.totalScore});
    }
  });
}

// ── Terminal animation ──────────────────────────────────────────────────
function runTerminalAnimation(onComplete) {
  const body = document.getElementById('terminal-body');
  const bar = document.getElementById('progress-bar');
  body.innerHTML = '';
  bar.style.width = '0%';

  const lines = [
    { text: 'Connecting to Upwork...', delay: 300 },
    { text: 'Crawling profile data...', delay: 500 },
    { text: 'Analyzing 847 similar freelancers...', delay: 600 },
    { text: 'Scanning 2,341 open jobs...', delay: 500 },
    { text: 'Calculating optimal rates...', delay: 400 },
    { text: 'Checking payment efficiency...', delay: 400 },
    { text: 'Generating your report...', delay: 500 },
  ];

  lines.forEach((l) => {
    const div = document.createElement('div');
    div.className = 'term-line';
    div.innerHTML = `<span class="prompt">&gt; </span><span class="typing">${l.text}</span><span class="check">&#10003;</span>`;
    body.appendChild(div);
  });

  const els = body.querySelectorAll('.term-line');
  let elapsed = 0;

  lines.forEach((l, i) => {
    const showAt = elapsed;
    const doneAt = showAt + l.delay + 400;
    const pct = Math.round(((i + 1) / lines.length) * 100);
    setTimeout(() => { els[i].classList.add('visible'); }, showAt);
    setTimeout(() => { els[i].classList.add('done'); bar.style.width = pct + '%'; }, doneAt);
    elapsed = doneAt + 100;
  });

  setTimeout(onComplete, elapsed + 400);
}

// ── Generate analysis data ──────────────────────────────────────────────
function generateAnalysis({ skill, country, rate, exp, seed }) {
  const rand = seededRand(seed);
  const benchmark = BENCHMARKS[skill]?.[country] || 30;
  const skillLabel = SKILL_LABELS[skill] || skill;
  const countryLabel = COUNTRY_LABELS[country] || country;

  const headline = clamp(Math.round(4 + rand() * 5 + (exp > 5 ? 1 : 0)), 3, 10);
  const overview = clamp(Math.round(5 + rand() * 4 + (exp > 3 ? 1 : 0)), 4, 10);
  const skillsScore = clamp(Math.round(4 + rand() * 5), 3, 10);
  const portfolio = clamp(Math.round(3 + rand() * 5), 2, 10);
  const rateScore = clamp(Math.round(rate >= benchmark * 0.8 && rate <= benchmark * 1.3 ? 7 + rand() * 3 : 4 + rand() * 3), 3, 10);
  const totalScore = +((headline + overview + skillsScore + portfolio + rateScore) / 5).toFixed(1);

  const hints = {
    headline: headline < 7 ? 'Too generic, add your specialty' : 'Strong headline with clear value',
    overview: overview < 7 ? 'Good length, add metrics and results' : 'Well-written with clear outcomes',
    skills: skillsScore < 7 ? 'Missing trending skills in your niche' : 'Good skill coverage',
    portfolio: portfolio < 7 ? 'Add ' + (3 + Math.floor(rand() * 3)) + ' more case studies' : 'Solid portfolio with proof',
    rate: rate < benchmark ? 'Below market \u2014 raise to ' + fmt$(benchmark) + '/hr' : (rate > benchmark * 1.4 ? 'Above average \u2014 justify with results' : 'Competitive for your market'),
  };

  const templates = JOB_TEMPLATES[skill] || JOB_TEMPLATES["web-development"];
  const jobCount = 10 + Math.floor(rand() * 12);
  const jobs = [];
  for (let i = 0; i < 20; i++) {
    const tpl = templates[i % templates.length];
    const budgetMult = 20 + Math.floor(rand() * 80);
    const budget = Math.round(benchmark * budgetMult / 10) * 10;
    const match = Math.round(68 + rand() * 27);
    const rating = +(4.2 + rand() * 0.8).toFixed(1);
    const hoursAgo = Math.floor(1 + rand() * 48);
    jobs.push({ title: tpl, budget, match, rating, hoursAgo });
  }
  jobs.sort((a, b) => b.match - a.match);

  const annualIncome = rate * 30 * 48;
  const payoneerFees = 29 + (annualIncome * 0.02) + (12 * 1.50);
  const wiseFees = Math.round(annualIncome * 0.012);
  const paypalFees = Math.round(annualIncome * 0.045);
  const cenoaFees = Math.round(annualIncome * 0.0075);
  const bankWireFees = Math.round(12 * 25 + annualIncome * 0.015);
  const savings = Math.round(payoneerFees - cenoaFees);
  const cenoaSaveVsPayoneer = Math.round(((payoneerFees - cenoaFees) / payoneerFees) * 100);
  const cenoaSaveVsWise = Math.round(((wiseFees - cenoaFees) / wiseFees) * 100);
  const cenoaSaveVsPaypal = Math.round(((paypalFees - cenoaFees) / paypalFees) * 100);

  const rateDiff = Math.round(((benchmark - rate) / benchmark) * 100);
  const rateInsight = rate < benchmark
    ? `Your rate is ${Math.abs(rateDiff)}% below market for ${skillLabel} in ${countryLabel}`
    : (rate > benchmark * 1.3
        ? `Your rate is ${Math.abs(rateDiff)}% above average \u2014 make sure your profile justifies it`
        : `Your rate is competitive for ${skillLabel} in ${countryLabel}`);

  const feedItems = [
    { icon: '\uD83D\uDCDD', text: `Draft proposal for '${templates[0]}' \u2014 ${fmt$(jobs[0]?.budget || 2000)} budget` },
    { icon: '\uD83D\uDCCA', text: `Weekly revenue report ready \u2014 you earned ${fmt$(Math.round(rate * 30 * (0.8 + rand() * 0.4)))} this week` },
    { icon: '\u26A0\uFE0F', text: `Invoice #INV-2026-${String(Math.floor(rand() * 50)).padStart(3, '0')} is ${Math.floor(2 + rand() * 8)} days overdue \u2014 sending reminder` },
    { icon: '\uD83D\uDD0D', text: `Found ${Math.floor(2 + rand() * 6)} new jobs matching your skills posted in last 2 hours` },
    { icon: '\uD83D\uDCC8', text: `Tip: Raise your rate by $${Math.floor(2 + rand() * 8)}/hr \u2014 market supports it` },
    { icon: '\uD83D\uDCC5', text: `Client meeting tomorrow ${Math.floor(9 + rand() * 8)}:00 ${rand() > 0.5 ? 'EST' : 'GMT'} \u2014 timezone reminder set` },
    { icon: '\uD83C\uDFAF', text: `Profile optimization: add "${['TypeScript', 'Figma', 'Python', 'AWS', 'React', 'Node.js'][Math.floor(rand() * 6)]}" to trending skills` },
    { icon: '\uD83D\uDCB0', text: `Payment received: ${fmt$(Math.round(500 + rand() * 3000))} from client "${['TechCorp', 'StartupX', 'DesignCo', 'DataFlow', 'BuildIt'][Math.floor(rand() * 5)]}"` },
    { icon: '\uD83D\uDCCB', text: `Auto-generated invoice #INV-2026-${String(Math.floor(rand() * 99)).padStart(3, '0')} for this week's work` },
    { icon: '\uD83D\uDE80', text: `Your proposal for '${templates[2] || templates[0]}' was viewed by the client` },
  ];

  return {
    totalScore, headline, overview, skillsScore, portfolio, rateScore, hints,
    skillLabel, countryLabel, skill, country, rate, benchmark, exp,
    jobCount, jobs,
    annualIncome, payoneerFees: Math.round(payoneerFees), wiseFees, paypalFees, cenoaFees, bankWireFees, savings,
    cenoaSaveVsPayoneer, cenoaSaveVsWise, cenoaSaveVsPaypal,
    rateInsight,
    feedItems,
  };
}

// ── Render Dashboard ────────────────────────────────────────────────────
function renderDashboard(r) {
  updateTabBadges();

  // ── Panel A: Score ──
  const ring = document.getElementById('score-ring-fg');
  const circumference = 2 * Math.PI * 50;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference;
  requestAnimationFrame(() => {
    setTimeout(() => {
      ring.style.strokeDashoffset = circumference - (circumference * (r.totalScore / 10));
    }, 100);
  });
  animateNumber('score-num', 0, r.totalScore, 1500, 1);

  const bd = document.getElementById('breakdown');
  const items = [
    { label: 'Headline', val: r.headline, hint: r.hints.headline },
    { label: 'Overview', val: r.overview, hint: r.hints.overview },
    { label: 'Skills', val: r.skillsScore, hint: r.hints.skills },
    { label: 'Portfolio', val: r.portfolio, hint: r.hints.portfolio },
    { label: 'Rate', val: r.rateScore, hint: r.hints.rate },
  ];
  bd.innerHTML = items.map(it => `
    <div class="breakdown-item">
      <span class="label">${it.label}</span>
      <div class="bar-wrap"><div class="bar-fill" data-width="${it.val * 10}"></div></div>
      <span class="val">${it.val}/10</span>
    </div>
    <div class="breakdown-hint">${it.hint}</div>
  `).join('');
  setTimeout(() => {
    bd.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.width + '%'; });
  }, 200);

  // ── Panel B: Jobs (overview) ──
  document.getElementById('jobs-count').innerHTML =
    `<span>${r.jobCount}</span> jobs match your profile this week`;
  const jl = document.getElementById('job-list');
  jl.innerHTML = r.jobs.slice(0, 5).map(j => `
    <div class="job-item">
      <div class="job-match ${j.match >= 80 ? 'high' : 'mid'}">${j.match}%</div>
      <div class="job-info">
        <div class="job-title">${j.title}</div>
        <div class="job-meta">
          <span>${fmt$(j.budget)}</span>
          <span>&#9733; ${j.rating}</span>
          <span>${j.hoursAgo}h ago</span>
        </div>
      </div>
      <button class="btn-sm" onclick="showScreen('screen-signup')">Draft Proposal</button>
    </div>
  `).join('');

  // ── Full Job List (tab) ──
  renderJobsFull(r);

  // ── Panel C: Money ──
  const mc = document.getElementById('money-content');
  const maxFee = Math.max(r.paypalFees, r.payoneerFees, r.wiseFees, r.cenoaFees);
  mc.innerHTML = `
    <div class="money-headline">\uD83D\uDCB0 Payment Opportunities <span style="font-size:0.7em;opacity:0.6">based on ${fmt$(r.annualIncome)}/yr</span></div>
    <div class="fee-compare">
      <div class="fee-bar">
        <span class="fee-label">PayPal</span>
        <div class="fee-track"><div class="fee-fill paypal" data-width="${(r.paypalFees / maxFee) * 100}" style="width:0%">${fmt$(r.paypalFees)}/yr</div></div>
        <span class="fee-tag" style="color:#888">Baseline</span>
      </div>
      <div class="fee-bar">
        <span class="fee-label">Payoneer</span>
        <div class="fee-track"><div class="fee-fill payoneer" data-width="${(r.payoneerFees / maxFee) * 100}" style="width:0%">${fmt$(r.payoneerFees)}/yr</div></div>
        <span class="fee-tag" style="color:#ffaa00">Save ${100 - Math.round((r.payoneerFees / r.paypalFees) * 100)}%</span>
      </div>
      <div class="fee-bar">
        <span class="fee-label">Wise</span>
        <div class="fee-track"><div class="fee-fill wise" data-width="${(r.wiseFees / maxFee) * 100}" style="width:0%">${fmt$(r.wiseFees)}/yr</div></div>
        <span class="fee-tag" style="color:#66cc88">Save ${100 - Math.round((r.wiseFees / r.paypalFees) * 100)}%</span>
      </div>
      <div class="fee-bar highlight-bar">
        <span class="fee-label">Cenoa</span>
        <div class="fee-track"><div class="fee-fill cenoa" data-width="${(r.cenoaFees / maxFee) * 100}" style="width:0%">${fmt$(r.cenoaFees)}/yr</div></div>
        <span class="fee-tag top-rated" style="color:#00ff88;font-weight:700">\u2B50 TOP RATED \u2014 Save ${r.cenoaSaveVsPaypal}%</span>
      </div>
    </div>
    <div class="money-tip">${r.rateInsight}. <strong>Recommended: ${fmt$(r.benchmark)}/hr</strong></div>
    <div class="money-tip" style="margin-top:8px;font-size:12px;opacity:0.6">Based on avg freelancer fee structures. Actual fees vary by corridor and volume.</div>
  `;
  setTimeout(() => {
    mc.querySelectorAll('.fee-fill').forEach(b => { b.style.width = b.dataset.width + '%'; });
  }, 400);

  // ── Panel D: Feed ──
  if (feedInterval) clearInterval(feedInterval);
  const fc = document.getElementById('feed-container');
  fc.innerHTML = '';
  let feedIdx = 0;
  function addFeedItem() {
    const item = r.feedItems[feedIdx % r.feedItems.length];
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `
      <span class="feed-icon">${item.icon}</span>
      <div>
        <div class="feed-text">${item.text}</div>
        <div class="feed-time">Just now</div>
      </div>`;
    fc.insertBefore(el, fc.firstChild);
    if (fc.children.length > 8) fc.removeChild(fc.lastChild);
    feedIdx++;
  }
  for (let i = 0; i < 4; i++) { addFeedItem(); }
  feedInterval = setInterval(addFeedItem, 2000);

  // ── Share bar ──
  const sb = document.getElementById('share-bar');
  sb.innerHTML = `
    <div class="share-card-preview">
      <div class="scp-top">
        <span class="scp-brand">Cortex Freelancer</span>
        <div class="scp-score">${r.totalScore}<small>/10</small></div>
      </div>
      <div class="scp-stats">
        <div>${r.skillLabel} &middot; <span>${r.countryLabel}</span></div>
        <div>Saves <span>${fmt$(r.savings)}/yr</span></div>
      </div>
    </div>
    <div class="share-actions">
      <h3>Share your Freelancer Score</h3>
      <div class="share-btns">
        <button class="btn-share copy" onclick="copyShareLink()">&#128203; Copy Link</button>
        <button class="btn-share twitter" onclick="shareTwitter()">&#120143; Share on Twitter</button>
        <button class="btn-share linkedin" onclick="shareLinkedIn()">in Share on LinkedIn</button>
      </div>
    </div>
  `;

  document.getElementById('signup-savings-li').innerHTML =
    `&#10003;&ensp;Save ${fmt$(r.savings)}/year on payment fees with Cenoa`;

  // ── Render Pro Features ──
  renderInvoice();
  renderProposalWriter();
  renderTemplates();
  renderRateCalculator(r);
}

// ── Full Job List (with Pro lock on 6+) ─────────────────────────────────
function renderJobsFull(r) {
  const container = document.getElementById('job-list-full');
  document.getElementById('jobs-count-full').innerHTML =
    `<span>${r.jobs.length}</span> job matches found`;

  const pro = isPro();
  let html = '';

  r.jobs.forEach((j, i) => {
    const locked = !pro && i >= 5;
    html += `<div class="job-item ${locked ? 'job-locked' : ''}">
      <div class="job-match ${j.match >= 80 ? 'high' : 'mid'}">${j.match}%</div>
      <div class="job-info">
        <div class="job-title">${j.title}</div>
        <div class="job-meta">
          <span>${fmt$(j.budget)}</span>
          <span>&#9733; ${j.rating}</span>
          <span>${j.hoursAgo}h ago</span>
        </div>
      </div>
      <button class="btn-sm" onclick="${locked ? 'showProModal()' : "showScreen('screen-signup')"}">${locked ? '\uD83D\uDD12' : 'Draft Proposal'}</button>
    </div>`;
  });

  if (!pro) {
    html += `<div class="pro-lock-overlay" onclick="showProModal()">
      <div class="pro-lock-card">
        <span class="pro-lock-icon">\uD83D\uDD12</span>
        <strong>15 more matches available with Pro</strong>
        <p>Get access to all 20 job matches, plus AI proposals, invoicing, and more.</p>
        <span class="pro-lock-price">$29/mo</span>
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

// ── Invoice Generator ───────────────────────────────────────────────────
function renderInvoice() {
  const container = document.getElementById('invoice-container');
  if (!isPro()) {
    container.innerHTML = `<div class="pro-locked-content" onclick="showProModal()">
      <div class="pro-lock-icon-large">\uD83D\uDD12</div>
      <h3>Invoice Generator</h3>
      <p>Create professional invoices, track payments, and export to PDF.</p>
      <button class="btn-pro-unlock" onclick="showProModal()">Unlock with Pro \u2192</button>
    </div>`;
    return;
  }

  container.innerHTML = `
    <div class="invoice-form">
      <div class="form-row">
        <div class="form-field">
          <label>Client Name</label>
          <input type="text" id="inv-client" placeholder="Client or company name">
        </div>
        <div class="form-field">
          <label>Client Email</label>
          <input type="email" id="inv-email" placeholder="client@company.com">
        </div>
      </div>
      <div class="form-field">
        <label>Project Description</label>
        <input type="text" id="inv-project" placeholder="Website redesign, App development, etc.">
      </div>

      <label class="form-label-standalone">Line Items</label>
      <div class="inv-line-items" id="inv-lines">
        <div class="inv-line-header">
          <span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span></span>
        </div>
        <div class="inv-line" data-idx="0">
          <input type="text" class="inv-desc" placeholder="Service description">
          <input type="number" class="inv-qty" value="1" min="1">
          <input type="number" class="inv-rate" placeholder="0" min="0">
          <span class="inv-amount">$0</span>
          <button class="inv-remove" onclick="removeInvLine(this)" title="Remove">\u00D7</button>
        </div>
      </div>
      <button class="btn-add-line" onclick="addInvLine()">+ Add Line Item</button>

      <div class="form-row" style="margin-top:1rem">
        <div class="form-field">
          <label>Tax %</label>
          <div class="tax-toggle">
            <input type="number" id="inv-tax" value="0" min="0" max="100" step="0.5" oninput="updateInvTotals()">
            <span class="tax-label">%</span>
          </div>
        </div>
        <div class="form-field">
          <label>Payment Method</label>
          <select id="inv-payment" onchange="updatePaymentHint()">
            <option value="cenoa">Cenoa (recommended)</option>
            <option value="paypal">PayPal</option>
            <option value="bank">Bank Wire</option>
            <option value="payoneer">Payoneer</option>
          </select>
        </div>
      </div>
      <div class="payment-hint" id="payment-hint"></div>

      <div class="inv-totals" id="inv-totals"></div>

      <button class="btn-generate-invoice" onclick="generateInvoice()">Generate Invoice</button>
    </div>
    <div id="invoice-preview" class="invoice-preview"></div>
  `;

  attachInvLineListeners();
  updatePaymentHint();
  updateInvTotals();
}

function addInvLine() {
  const container = document.getElementById('inv-lines');
  const line = document.createElement('div');
  line.className = 'inv-line';
  line.innerHTML = `
    <input type="text" class="inv-desc" placeholder="Service description">
    <input type="number" class="inv-qty" value="1" min="1">
    <input type="number" class="inv-rate" placeholder="0" min="0">
    <span class="inv-amount">$0</span>
    <button class="inv-remove" onclick="removeInvLine(this)" title="Remove">\u00D7</button>
  `;
  container.appendChild(line);
  attachInvLineListeners();
}

function removeInvLine(btn) {
  if (document.querySelectorAll('.inv-line').length <= 1) return;
  btn.closest('.inv-line').remove();
  updateInvTotals();
}

function attachInvLineListeners() {
  document.querySelectorAll('.inv-qty, .inv-rate').forEach(inp => {
    inp.removeEventListener('input', updateInvTotals);
    inp.addEventListener('input', updateInvTotals);
  });
}

function updateInvTotals() {
  let subtotal = 0;
  document.querySelectorAll('.inv-line').forEach(line => {
    const qty = parseFloat(line.querySelector('.inv-qty').value) || 0;
    const rate = parseFloat(line.querySelector('.inv-rate').value) || 0;
    const amt = qty * rate;
    line.querySelector('.inv-amount').textContent = fmt$(amt);
    subtotal += amt;
  });
  const taxPct = parseFloat(document.getElementById('inv-tax')?.value) || 0;
  const tax = subtotal * (taxPct / 100);
  const total = subtotal + tax;

  const el = document.getElementById('inv-totals');
  if (el) {
    el.innerHTML = `
      <div class="inv-total-row"><span>Subtotal</span><span>${fmt$(subtotal)}</span></div>
      ${taxPct > 0 ? `<div class="inv-total-row"><span>Tax (${taxPct}%)</span><span>${fmt$(Math.round(tax))}</span></div>` : ''}
      <div class="inv-total-row total"><span>Total</span><span>${fmt$(Math.round(total))}</span></div>
    `;
  }
  updatePaymentHint();
}

function updatePaymentHint() {
  const method = document.getElementById('inv-payment')?.value;
  const hint = document.getElementById('payment-hint');
  if (!hint) return;

  let subtotal = 0;
  document.querySelectorAll('.inv-line').forEach(line => {
    const qty = parseFloat(line.querySelector('.inv-qty')?.value) || 0;
    const rate = parseFloat(line.querySelector('.inv-rate')?.value) || 0;
    subtotal += qty * rate;
  });

  if (method === 'cenoa' || subtotal === 0) {
    hint.innerHTML = method === 'cenoa' ? '<span class="hint-good">\uD83D\uDCA1 Cenoa: lowest fees for international payments</span>' : '';
  } else {
    const cenoaFee = subtotal * 0.0075;
    let otherFee = 0, name = '';
    if (method === 'paypal') { otherFee = subtotal * 0.045; name = 'PayPal'; }
    else if (method === 'bank') { otherFee = 25 + subtotal * 0.015; name = 'Bank Wire'; }
    else if (method === 'payoneer') { otherFee = subtotal * 0.02; name = 'Payoneer'; }
    const saving = Math.round(otherFee - cenoaFee);
    if (saving > 0) {
      hint.innerHTML = `<span class="hint-save">\uD83D\uDCA1 Save ${fmt$(saving)} on this invoice vs ${name} by using Cenoa</span>`;
    } else {
      hint.innerHTML = '';
    }
  }
}

function generateInvoice() {
  const client = document.getElementById('inv-client').value.trim() || 'Client';
  const email = document.getElementById('inv-email').value.trim();
  const project = document.getElementById('inv-project').value.trim() || 'Project';
  const payment = document.getElementById('inv-payment').value;
  const taxPct = parseFloat(document.getElementById('inv-tax').value) || 0;

  const counter = parseInt(localStorage.getItem('cortex_inv_counter') || '0') + 1;
  localStorage.setItem('cortex_inv_counter', String(counter));
  const invNumber = `INV-2026-${String(counter).padStart(4, '0')}`;

  const lineItems = [];
  let subtotal = 0;
  document.querySelectorAll('.inv-line').forEach(line => {
    const desc = line.querySelector('.inv-desc').value || 'Service';
    const qty = parseFloat(line.querySelector('.inv-qty').value) || 0;
    const rate = parseFloat(line.querySelector('.inv-rate').value) || 0;
    const amt = qty * rate;
    subtotal += amt;
    lineItems.push({ desc, qty, rate, amt });
  });

  const tax = subtotal * (taxPct / 100);
  const total = subtotal + tax;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dueDate = new Date(Date.now() + 15 * 86400000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const paymentLabels = { cenoa: 'Cenoa', paypal: 'PayPal', bank: 'Bank Wire', payoneer: 'Payoneer' };

  const preview = document.getElementById('invoice-preview');
  preview.innerHTML = `
    <div class="invoice-rendered" id="invoice-rendered">
      <div class="inv-header-row">
        <div>
          <div class="inv-brand">CORTEX</div>
          <div class="inv-label">INVOICE</div>
        </div>
        <div class="inv-meta">
          <div><strong>${invNumber}</strong></div>
          <div>Date: ${today}</div>
          <div>Due: ${dueDate}</div>
        </div>
      </div>
      <div class="inv-parties">
        <div>
          <div class="inv-party-label">From</div>
          <div class="inv-party-name">[Your Name]</div>
          <div class="inv-party-detail">[Your Email]</div>
        </div>
        <div>
          <div class="inv-party-label">Bill To</div>
          <div class="inv-party-name">${escHtml(client)}</div>
          <div class="inv-party-detail">${escHtml(email)}</div>
        </div>
      </div>
      <div class="inv-project-name">${escHtml(project)}</div>
      <table class="inv-table">
        <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${lineItems.map(li => `<tr><td>${escHtml(li.desc)}</td><td>${li.qty}</td><td>${fmt$(li.rate)}</td><td>${fmt$(li.amt)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="inv-summary">
        <div class="inv-summary-row"><span>Subtotal</span><span>${fmt$(subtotal)}</span></div>
        ${taxPct > 0 ? `<div class="inv-summary-row"><span>Tax (${taxPct}%)</span><span>${fmt$(Math.round(tax))}</span></div>` : ''}
        <div class="inv-summary-row inv-total"><span>Total Due</span><span>${fmt$(Math.round(total))}</span></div>
      </div>
      <div class="inv-payment-info">
        <strong>Payment Method:</strong> ${paymentLabels[payment] || payment}
        ${payment === 'cenoa' ? '<span class="inv-recommended">\u2605 Recommended \u2014 Lowest Fees</span>' : ''}
      </div>
      <div class="inv-footer">Thank you for your business!</div>
    </div>
    <button class="btn-print-invoice" onclick="printInvoice()">\uD83D\uDDA8\uFE0F Print / Save as PDF</button>
  `;
  preview.scrollIntoView({ behavior: 'smooth' });
}

function printInvoice() { window.print(); }

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Proposal Writer ─────────────────────────────────────────────────────
function renderProposalWriter() {
  const container = document.getElementById('proposal-container');
  if (!isPro()) {
    container.innerHTML = `<div class="pro-locked-content" onclick="showProModal()">
      <div class="pro-lock-icon-large">\uD83D\uDD12</div>
      <h3>Proposal Writer</h3>
      <p>Generate tailored proposals from job descriptions in seconds.</p>
      <button class="btn-pro-unlock" onclick="showProModal()">Unlock with Pro \u2192</button>
    </div>`;
    return;
  }

  const skills = analysisResult ? analysisResult.skillLabel : '';
  container.innerHTML = `
    <div class="proposal-form">
      <div class="form-field">
        <label>Job Description</label>
        <textarea id="prop-job" rows="5" placeholder="Paste the job posting here..."></textarea>
      </div>
      <div class="form-field">
        <label>Your Relevant Skills</label>
        <input type="text" id="prop-skills" value="${escHtml(skills)}" placeholder="React, Node.js, UI Design...">
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Tone</label>
          <div class="radio-group">
            <label class="radio-pill"><input type="radio" name="prop-tone" value="professional" checked> Professional</label>
            <label class="radio-pill"><input type="radio" name="prop-tone" value="friendly"> Friendly</label>
            <label class="radio-pill"><input type="radio" name="prop-tone" value="technical"> Technical</label>
          </div>
        </div>
        <div class="form-field">
          <label>Length</label>
          <div class="radio-group">
            <label class="radio-pill"><input type="radio" name="prop-length" value="short"> Short</label>
            <label class="radio-pill"><input type="radio" name="prop-length" value="standard" checked> Standard</label>
            <label class="radio-pill"><input type="radio" name="prop-length" value="detailed"> Detailed</label>
          </div>
        </div>
      </div>
      <div class="prop-actions">
        <button class="btn-generate-proposal" onclick="generateProposal()">Generate Proposal</button>
        <button class="btn-regenerate" id="btn-regenerate" onclick="generateProposal(true)" style="display:none">\uD83D\uDD04 Regenerate</button>
      </div>
    </div>
    <div id="proposal-output" class="proposal-output"></div>
  `;
}

let proposalVariation = 0;

function generateProposal(isRegenerate) {
  const jobDesc = document.getElementById('prop-job').value.trim();
  if (!jobDesc) { toast('Please paste a job description'); return; }

  const skills = document.getElementById('prop-skills').value.trim();
  const tone = document.querySelector('input[name="prop-tone"]:checked').value;
  const length = document.querySelector('input[name="prop-length"]:checked').value;
  const keywords = extractKeywords(jobDesc);

  if (isRegenerate) proposalVariation++;
  const v = proposalVariation % 3;

  const hooks = {
    professional: [
      "Thank you for sharing the details of this project. After reviewing your requirements, I'm confident I can deliver exactly what you're looking for.",
      "I was immediately drawn to this project because it aligns perfectly with my expertise. Let me explain why I'm the right fit.",
      "Your project requirements are clear and well-defined \u2014 I appreciate that. Here's how I would approach this."
    ],
    friendly: [
      "Hi there! I just came across your project and got really excited \u2014 this is right in my wheelhouse!",
      "Hey! This project caught my eye immediately. I've done very similar work before and would love to help.",
      "Love this project! It's exactly the kind of work I'm passionate about. Let me tell you why I'd be a great fit."
    ],
    technical: [
      "I've analyzed your technical requirements and have a clear implementation strategy. Here's my proposed approach.",
      "Based on the technical scope outlined, I can architect a solution that meets all your requirements efficiently.",
      "Your project presents interesting technical challenges that I've solved before. Here's my implementation plan."
    ]
  };

  const relevance = keywords.length > 0
    ? `My expertise in ${keywords.slice(0, 3).join(', ')}${skills ? ` along with my ${skills} background` : ''} makes me well-suited for this project.`
    : (skills ? `With my background in ${skills}, I bring directly relevant experience to this project.` : 'My diverse skill set and project experience make me an excellent fit for this work.');

  const proofs = [
    "I've completed over 50 similar projects with a 98% client satisfaction rate.",
    "My recent projects in this area have resulted in measurable improvements \u2014 faster load times, higher conversion rates, and cleaner codebases.",
    "Clients consistently praise my attention to detail, clear communication, and ability to deliver on time and within budget."
  ];

  const ctas = {
    professional: "I'd welcome the opportunity to discuss this further. I'm available for a call at your convenience and can start within the week.",
    friendly: "I'd love to chat more about your vision! I'm free for a quick call anytime this week. Let's make this project happen!",
    technical: "I can provide a detailed technical proposal and timeline once we align on the specifics. Available for a technical discussion at your convenience."
  };

  let proposal = `<div class="prop-section"><h4>Hook</h4><p>${hooks[tone][v]}</p></div>`;
  proposal += `<div class="prop-section"><h4>Relevance</h4><p>${relevance}</p></div>`;

  if (length !== 'short') {
    proposal += `<div class="prop-section"><h4>Approach</h4><p>For this project, I would follow a structured approach:</p><ol>`;
    proposal += `<li><strong>Discovery & Planning</strong> \u2014 Understand your goals, audience, and technical requirements in depth.</li>`;
    proposal += `<li><strong>Implementation</strong> \u2014 Build iteratively with regular check-ins so you can see progress and provide feedback.</li>`;
    proposal += `<li><strong>Quality Assurance</strong> \u2014 Thorough testing and optimization before delivery.</li>`;
    if (length === 'detailed') {
      proposal += `<li><strong>Launch Support</strong> \u2014 Hands-on assistance during deployment and post-launch monitoring.</li>`;
      proposal += `<li><strong>Documentation</strong> \u2014 Clear documentation so your team can maintain and extend the work.</li>`;
    }
    proposal += `</ol></div>`;
  }

  proposal += `<div class="prop-section"><h4>Proof</h4><p>${proofs[v]}</p></div>`;

  if (length === 'detailed') {
    proposal += `<div class="prop-section"><h4>Timeline & Availability</h4><p>Based on the scope described, I estimate this project would take [X] weeks. I'm available to start immediately and can dedicate [X] hours per week to ensure timely delivery.</p></div>`;
  }

  proposal += `<div class="prop-section"><h4>Next Steps</h4><p>${ctas[tone]}</p></div>`;

  const output = document.getElementById('proposal-output');
  output.innerHTML = `
    <div class="proposal-rendered">
      <div class="proposal-text">${proposal}</div>
    </div>
    <button class="btn-copy-proposal" onclick="copyProposal()">\uD83D\uDCCB Copy to Clipboard</button>
  `;
  document.getElementById('btn-regenerate').style.display = 'inline-flex';
  output.scrollIntoView({ behavior: 'smooth' });
}

function extractKeywords(text) {
  const techTerms = ['react','angular','vue','node','python','javascript','typescript','php','ruby','java','swift','kotlin','flutter','aws','azure','gcp','docker','kubernetes','figma','sketch','wordpress','shopify','seo','api','database','sql','nosql','mongodb','firebase','graphql','rest','agile','scrum','ui','ux','design','mobile','ios','android','web','frontend','backend','fullstack','full-stack','devops','ci/cd','machine learning','ai','data','analytics','blockchain','nft','defi','smart contract','testing','qa','security'];
  const lower = text.toLowerCase();
  return techTerms.filter(t => lower.includes(t));
}

function copyProposal() {
  const text = document.querySelector('.proposal-text')?.innerText;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => toast('Proposal copied!')).catch(() => toast('Could not copy'));
}

// ── Template Browser ────────────────────────────────────────────────────
function renderTemplates() {
  const container = document.getElementById('templates-container');
  if (!isPro()) {
    container.innerHTML = `<div class="pro-locked-content" onclick="showProModal()">
      <div class="pro-lock-icon-large">\uD83D\uDD12</div>
      <h3>Template Library</h3>
      <p>Access 20+ professional templates for proposals, contracts, invoices, and more.</p>
      <button class="btn-pro-unlock" onclick="showProModal()">Unlock with Pro \u2192</button>
    </div>`;
    return;
  }

  const categories = ['All','Proposals','Project Mgmt','Finance','Communication','Legal','Growth','Portfolio','Scheduling'];
  container.innerHTML = `
    <div class="template-filters" id="template-filters">
      ${categories.map((c, i) => `<button class="filter-pill ${i === 0 ? 'active' : ''}" onclick="filterTemplates('${c}', this)">${c}</button>`).join('')}
    </div>
    <div class="template-search">
      <input type="text" id="template-search" placeholder="Search templates..." oninput="searchTemplates()">
    </div>
    <div class="template-grid" id="template-grid"></div>
  `;
  renderTemplateGrid('All');
}

function renderTemplateGrid(category) {
  const grid = document.getElementById('template-grid');
  const search = (document.getElementById('template-search')?.value || '').toLowerCase();
  const filtered = TEMPLATE_LIBRARY.filter(t => {
    const matchCat = category === 'All' || t.category === category;
    const matchSearch = !search || t.title.toLowerCase().includes(search) || t.preview.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  grid.innerHTML = filtered.map(t => `
    <div class="template-card" onclick="openTemplate(${t.id})">
      <div class="template-cat">${t.category}</div>
      <div class="template-title">${t.title}</div>
      <div class="template-preview">${t.preview}</div>
    </div>
  `).join('') || '<div class="template-empty">No templates match your search.</div>';
}

function filterTemplates(category, btn) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderTemplateGrid(category);
}

function searchTemplates() {
  const active = document.querySelector('.filter-pill.active');
  renderTemplateGrid(active ? active.textContent : 'All');
}

function openTemplate(id) {
  const tpl = TEMPLATE_LIBRARY.find(t => t.id === id);
  if (!tpl) return;
  const overlay = document.createElement('div');
  overlay.className = 'template-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="template-modal">
      <div class="template-modal-header">
        <div>
          <span class="template-cat">${tpl.category}</span>
          <h3>${tpl.title}</h3>
        </div>
        <button class="template-modal-close" onclick="this.closest('.template-modal-overlay').remove()">\u00D7</button>
      </div>
      <div class="template-modal-body">
        <pre class="template-content">${escHtml(tpl.content)}</pre>
      </div>
      <div class="template-modal-footer">
        <button class="btn-copy-template" onclick="copyTemplate(${tpl.id})">\uD83D\uDCCB Copy Template</button>
        <button class="btn-close-template" onclick="this.closest('.template-modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
}

function copyTemplate(id) {
  const tpl = TEMPLATE_LIBRARY.find(t => t.id === id);
  if (!tpl) return;
  navigator.clipboard.writeText(tpl.content).then(() => toast('Template copied!')).catch(() => toast('Could not copy'));
}

// ── Rate Calculator ─────────────────────────────────────────────────────
function renderRateCalculator(r) {
  const container = document.getElementById('ratecalc-container');
  if (!isPro()) {
    container.innerHTML = `<div class="pro-locked-content" onclick="showProModal()">
      <div class="pro-lock-icon-large">\uD83D\uDD12</div>
      <h3>Rate Calculator</h3>
      <p>See detailed market rate data, percentile rankings, and revenue projections.</p>
      <button class="btn-pro-unlock" onclick="showProModal()">Unlock with Pro \u2192</button>
    </div>`;
    return;
  }

  const skillOptions = Object.entries(SKILL_LABELS).map(([k, v]) =>
    `<option value="${k}" ${k === r.skill ? 'selected' : ''}>${v}</option>`
  ).join('');
  const countryOptions = Object.entries(COUNTRY_LABELS).map(([k, v]) =>
    `<option value="${k}" ${k === r.country ? 'selected' : ''}>${v}</option>`
  ).join('');

  container.innerHTML = `
    <div class="rate-calc-form">
      <div class="form-row">
        <div class="form-field">
          <label>Skill</label>
          <select id="rc-skill" onchange="updateRateCalc()">${skillOptions}</select>
        </div>
        <div class="form-field">
          <label>Country</label>
          <select id="rc-country" onchange="updateRateCalc()">${countryOptions}</select>
        </div>
      </div>
      <div class="form-field">
        <label>Years of Experience: <strong id="rc-exp-label">${r.exp}</strong></label>
        <input type="range" id="rc-exp" min="1" max="15" value="${r.exp}" oninput="document.getElementById('rc-exp-label').textContent=this.value; updateRateCalc()">
      </div>
      <div class="form-field">
        <label>Your Current Rate: <strong id="rc-rate-label">${fmt$(r.rate)}/hr</strong></label>
        <input type="range" id="rc-rate" min="5" max="200" value="${r.rate}" oninput="document.getElementById('rc-rate-label').textContent=fmt$(parseInt(this.value))+'/hr'; updateRateCalc()">
      </div>
    </div>
    <div id="rate-calc-results"></div>
  `;
  updateRateCalc();
}

function updateRateCalc() {
  const skill = document.getElementById('rc-skill').value;
  const country = document.getElementById('rc-country').value;
  const exp = parseInt(document.getElementById('rc-exp').value);
  const userRate = parseInt(document.getElementById('rc-rate').value);
  const base = BENCHMARKS[skill]?.[country] || 30;

  const expMult = 1 + (exp - 1) * 0.06;
  const p25 = Math.round(base * 0.65 * expMult);
  const p50 = Math.round(base * expMult);
  const p75 = Math.round(base * 1.35 * expMult);
  const p90 = Math.round(base * 1.75 * expMult);
  const maxRate = p90 * 1.2;

  let userPct;
  if (userRate <= p25) userPct = Math.round((userRate / p25) * 25);
  else if (userRate <= p50) userPct = 25 + Math.round(((userRate - p25) / (p50 - p25)) * 25);
  else if (userRate <= p75) userPct = 50 + Math.round(((userRate - p50) / (p75 - p50)) * 25);
  else if (userRate <= p90) userPct = 75 + Math.round(((userRate - p75) / (p90 - p75)) * 15);
  else userPct = 95;
  userPct = clamp(userPct, 1, 99);

  const targetRate = Math.max(userRate, p75);
  const annualDiff = (targetRate - userRate) * 30 * 48;

  const compCountries = ['us','uk','eu','india','philippines'].filter(c => c !== country);
  compCountries.unshift(country);
  const compData = compCountries.slice(0, 5).map(c => ({
    country: COUNTRY_LABELS[c],
    rate: Math.round((BENCHMARKS[skill]?.[c] || 30) * expMult),
    isCurrent: c === country,
  }));

  const growthPct = 8 + Math.floor(hashStr(skill + '2026') % 12);

  document.getElementById('rate-calc-results').innerHTML = `
    <div class="rate-chart-section">
      <h4>Market Rate Distribution \u2014 ${SKILL_LABELS[skill]} in ${COUNTRY_LABELS[country]}</h4>
      <div class="rate-chart">
        <div class="rate-bar-row"><span class="rate-percentile-label">25th</span><div class="rate-bar-track"><div class="rate-bar-fill p25" style="width:${(p25/maxRate)*100}%"><span>${fmt$(p25)}/hr</span></div></div></div>
        <div class="rate-bar-row"><span class="rate-percentile-label">50th</span><div class="rate-bar-track"><div class="rate-bar-fill p50" style="width:${(p50/maxRate)*100}%"><span>${fmt$(p50)}/hr</span></div></div></div>
        <div class="rate-bar-row"><span class="rate-percentile-label">75th</span><div class="rate-bar-track"><div class="rate-bar-fill p75" style="width:${(p75/maxRate)*100}%"><span>${fmt$(p75)}/hr</span></div></div></div>
        <div class="rate-bar-row"><span class="rate-percentile-label">90th</span><div class="rate-bar-track"><div class="rate-bar-fill p90" style="width:${(p90/maxRate)*100}%"><span>${fmt$(p90)}/hr</span></div></div></div>
        <div class="rate-bar-row you-row"><span class="rate-percentile-label">You</span><div class="rate-bar-track"><div class="rate-bar-fill you-bar" style="width:${(userRate/maxRate)*100}%"><span>${fmt$(userRate)}/hr \u2014 ${userPct}th percentile</span></div></div></div>
      </div>
    </div>

    ${annualDiff > 0 ? `<div class="rate-impact">
      <h4>Revenue Impact</h4>
      <p>Raising your rate to <strong>${fmt$(targetRate)}/hr</strong> (75th percentile) would earn you an additional <strong class="green">${fmt$(annualDiff)}/year</strong> at the same workload.</p>
    </div>` : `<div class="rate-impact"><h4>Revenue Impact</h4><p>Your rate is already at or above the 75th percentile \u2014 great positioning! \uD83C\uDFAF</p></div>`}

    <div class="rate-comparison">
      <h4>Rate Comparison by Region</h4>
      <table class="rate-table">
        <thead><tr><th>Country</th><th>Median Rate</th><th>vs You</th></tr></thead>
        <tbody>
          ${compData.map(c => `<tr class="${c.isCurrent ? 'current-row' : ''}">
            <td>${c.country} ${c.isCurrent ? '(you)' : ''}</td>
            <td>${fmt$(c.rate)}/hr</td>
            <td class="${c.rate > userRate ? 'red' : 'green'}">${c.rate > userRate ? '+' : ''}${fmt$(c.rate - userRate)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="rate-growth">
      <p>\uD83D\uDCC8 Rates for <strong>${SKILL_LABELS[skill]}</strong> freelancers grew <strong class="green">${growthPct}%</strong> this year</p>
    </div>
  `;
}

// ── Pro Modal ───────────────────────────────────────────────────────────
// ── 🎤 Agent Interview Easter Egg ────────────────────────────────────────
function showRobotCheck(onPass) {
  let step = 0;
  const overlay = document.createElement('div');
  overlay.id = 'robot-check-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center';

  const card = document.createElement('div');
  card.style.cssText = 'background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:32px;max-width:460px;width:92%;text-align:center';
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const questions = [
    {
      agent: '📋',
      agentName: 'Project Manager',
      typing: 'PM Agent is reviewing your application...',
      question: "Before we start working for you, we have a few questions. First — what's your biggest weakness as a freelancer?",
      options: [
        { text: "I procrastinate", response: "Same, honestly. We'll get along great.", emoji: "😅", color: "#00ff88", verdict: "✅ Relatable" },
        { text: "I'm a perfectionist", response: "🚩 That's what bad clients say right before requesting 47 revisions.", emoji: "😬", color: "#ff8844", verdict: "⚠️ Noted" },
        { text: "I undercharge", response: "We know. We've seen your rate. Our Finance Manager is already upset.", emoji: "💸", color: "#ffaa00", verdict: "📉 Confirmed" },
      ]
    },
    {
      agent: '💰',
      agentName: 'Finance Manager',
      typing: 'Finance Manager is pulling up your fee data...',
      question: "How do you currently receive international payments?",
      options: [
        { text: "Payoneer", response: "Interesting. We calculated you're donating $847/year to Payoneer in unnecessary fees. We'll fix that.", emoji: "🔥", color: "#ff4444", verdict: "💸 Overpaying" },
        { text: "PayPal", response: "PayPal? In 2026? We admire your commitment to paying maximum fees.", emoji: "😭", color: "#ff4444", verdict: "🚨 Critical" },
        { text: "Cenoa", response: "Finally, someone with financial sense. You're already our favorite client.", emoji: "😍", color: "#00ff88", verdict: "⭐ Elite" },
        { text: "I don't know", response: "That's... concerning. But don't worry, that's literally why we exist.", emoji: "🫣", color: "#ffaa00", verdict: "🆘 Help needed" },
      ]
    },
    {
      agent: '🔍',
      agentName: 'Business Dev',
      typing: 'Business Dev Agent is scanning your potential...',
      question: "Last question. Will you micromanage us?",
      options: [
        { text: "No, I trust AI", response: "Perfect answer. You passed. Welcome aboard! 🎉", emoji: "🥳", color: "#00ff88", verdict: "✅ Hired" },
        { text: "Maybe a little", response: "We're going to pretend you said no. Welcome aboard.", emoji: "🙃", color: "#ffaa00", verdict: "✅ ...Hired" },
        { text: "Yes, absolutely", response: "Our agents just held an emergency meeting. 7 voted to accept you anyway. 1 resigned in protest.", emoji: "😤", color: "#ff8844", verdict: "✅ Hired (barely)" },
      ]
    }
  ];

  function renderStep() {
    const q = questions[step];
    card.style.animation = 'none'; card.offsetHeight; card.style.animation = 'fadeIn 0.4s ease';
    
    // Typing phase
    card.innerHTML = `
      <div style="font-size:48px;margin-bottom:12px">${q.agent}</div>
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">${q.agentName} Agent</div>
      <div style="font-size:11px;color:#555;margin-bottom:16px">Question ${step + 1} of ${questions.length}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin:20px 0">
        <div style="color:#666;font-size:13px">${q.typing}</div>
        <div class="typing-dots" style="display:flex;gap:3px">
          <span style="width:4px;height:4px;background:#666;border-radius:50%;animation:typingDot 1s infinite 0s"></span>
          <span style="width:4px;height:4px;background:#666;border-radius:50%;animation:typingDot 1s infinite 0.2s"></span>
          <span style="width:4px;height:4px;background:#666;border-radius:50%;animation:typingDot 1s infinite 0.4s"></span>
        </div>
      </div>
    `;

    // After typing delay, show question
    setTimeout(() => {
      card.innerHTML = `
        <div style="font-size:48px;margin-bottom:12px">${q.agent}</div>
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">${q.agentName} Agent</div>
        <div style="font-size:11px;color:#555;margin-bottom:20px">Question ${step + 1} of ${questions.length}</div>
        <div style="font-size:15px;color:#eee;line-height:1.6;margin-bottom:24px;text-align:left;padding:0 8px">"${q.question}"</div>
        <div id="interview-options" style="display:flex;flex-direction:column;gap:8px"></div>
        <div id="interview-result" style="margin-top:16px;display:none"></div>
      `;
      
      const optContainer = document.getElementById('interview-options');
      q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.style.cssText = 'padding:12px 16px;border-radius:10px;border:1px solid #333;background:#111;color:#ccc;font-size:13px;cursor:pointer;transition:all 0.2s;text-align:left';
        btn.textContent = opt.text;
        btn.onmouseover = () => { btn.style.borderColor = '#ff8844'; btn.style.color = '#fff'; };
        btn.onmouseout = () => { btn.style.borderColor = '#333'; btn.style.color = '#ccc'; };
        btn.onclick = () => handleAnswer(q, opt);
        optContainer.appendChild(btn);
      });
    }, 1500);
  }

  function handleAnswer(q, opt) {
    // Disable all buttons
    document.querySelectorAll('#interview-options button').forEach(b => {
      b.style.pointerEvents = 'none'; b.style.opacity = '0.3';
    });
    // Find clicked button and highlight
    document.querySelectorAll('#interview-options button').forEach(b => {
      if (b.textContent === opt.text) { b.style.opacity = '1'; b.style.borderColor = opt.color; b.style.color = opt.color; }
    });
    
    const result = document.getElementById('interview-result');
    result.style.display = 'block';
    result.innerHTML = `
      <div style="animation:fadeIn 0.4s ease;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;margin-top:12px">
        <div style="font-size:24px;margin-bottom:6px">${opt.emoji}</div>
        <div style="color:${opt.color};font-size:14px;line-height:1.6">"${opt.response}"</div>
        <div style="font-size:11px;color:#555;margin-top:8px">${opt.verdict}</div>
      </div>
    `;
    
    setTimeout(() => {
      step++;
      if (step < questions.length) {
        renderStep();
      } else {
        showFinalVerdict();
      }
    }, 2500);
  }

  function showFinalVerdict() {
    card.style.animation = 'none'; card.offsetHeight; card.style.animation = 'fadeIn 0.5s ease';
    card.innerHTML = `
      <div style="font-size:48px;margin-bottom:16px">🎉</div>
      <div style="font-size:20px;font-weight:700;color:#00ff88;margin-bottom:8px">Interview Complete</div>
      <div style="font-size:14px;color:#aaa;line-height:1.6;margin-bottom:16px">
        All 8 agents voted unanimously to accept you as a client.<br>
        <span style="color:#666;font-size:12px">(Well, the Finance Manager took some convincing.)</span>
      </div>
      <div style="display:flex;justify-content:center;gap:8px;margin-bottom:20px;font-size:24px">
        <span title="Business Dev">🔍</span>
        <span title="Project Manager">📋</span>
        <span title="Finance Manager">💰</span>
        <span title="Client Comms">💬</span>
        <span title="Schedule">📅</span>
        <span title="Portfolio">🎨</span>
        <span title="Growth">📈</span>
        <span title="Legal">📝</span>
      </div>
      <div style="font-size:13px;color:#888;margin-bottom:20px">Your AI team is ready. Let's see what we found.</div>
      <button id="interview-continue" style="padding:14px 40px;border-radius:12px;border:none;background:linear-gradient(135deg,#00ff88,#00cc6a);color:#000;font-weight:800;font-size:15px;cursor:pointer;transition:all 0.2s">
        View My Results →
      </button>
    `;
    document.getElementById('interview-continue').onclick = () => { overlay.remove(); onPass(); };
  }

  // Add typing animation keyframes
  if (!document.getElementById('typing-style')) {
    const style = document.createElement('style');
    style.id = 'typing-style';
    style.textContent = '@keyframes typingDot{0%,100%{opacity:0.3}50%{opacity:1}}';
    document.head.appendChild(style);
  }

  renderStep();
}

function showProModal() {
  document.getElementById('pro-modal').classList.add('show');
}

function closeProModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('pro-modal').classList.remove('show');
  }
}

// ── Animate number ──────────────────────────────────────────────────────
function animateNumber(elId, from, to, duration, decimals) {
  const el = document.getElementById(elId);
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = (from + (to - from) * ease).toFixed(decimals);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Share functions ─────────────────────────────────────────────────────
function getShareURL() {
  const r = analysisResult;
  if (!r) return location.href;
  const params = new URLSearchParams({ score: r.totalScore, skills: r.skill, country: r.country, savings: r.savings });
  return location.href.replace(/[^/]*$/, 'share.html') + '?' + params.toString();
}

function copyShareLink() {
  if (typeof gtag === 'function') gtag('event', 'share_click', {method: 'copy_link'});
  const url = getShareURL();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied!'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Link copied!');
  }
}

function shareTwitter() {
  if (typeof gtag === 'function') gtag('event', 'share_click', {method: 'twitter'});
  const r = analysisResult;
  const text = `My Freelancer Score is ${r.totalScore}/10 \u2014 Cortex found I can save ${fmt$(r.savings)}/yr on payment fees and matched me with ${r.jobCount} jobs \uD83D\uDE80 Check yours \u2192`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getShareURL())}`, '_blank');
}

function shareLinkedIn() {
  if (typeof gtag === 'function') gtag('event', 'share_click', {method: 'linkedin'});
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareURL())}`, '_blank');
}

// ── Signup handler ──────────────────────────────────────────────────────
function handleSignup() {
  if (typeof gtag === 'function') gtag('event', 'cta_click', {label: 'start_free_trial'});
  const email = document.getElementById('signup-email').value.trim();
  if (!email || !email.includes('@')) { toast('Please enter a valid email'); return; }
  localStorage.setItem('cortex_signup', JSON.stringify({ email, date: new Date().toISOString() }));
  toast('Welcome! Your 14-day trial has started.');
}

// ── Init ────────────────────────────────────────────────────────────────
(function init() {
  const saved = localStorage.getItem('cortex_user');
  if (saved) { try { currentUser = JSON.parse(saved); } catch(e) {} }
  document.getElementById('upwork-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') analyzeFromURL();
  });
  updateTabBadges();
})();
