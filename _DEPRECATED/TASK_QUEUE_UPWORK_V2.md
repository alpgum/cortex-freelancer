# Cortex Freelancer — Upwork Power Features Sprint
# Goal: Freelancer'ın Upwork'ünü tam analiz eden, iş bulan, başvuran, tavsiye veren platform
# Generated: 2026-03-24 00:23

## PENDING

### [UW-001] Deep profile parser — work history extraction
Proxy'den work history çek: her iş için client name, rate, duration, feedback, earned amount. innerText'ten regex ile parse et. Output: jobs[] array with details. Bu data scoring'e ve AI analize giriyor.
Repo: projects/cortex-freelancer
Files: scripts/upwork-local-proxy.js

### [UW-002] Client feedback sentiment analysis
Work history'den çekilen client feedback'lerini analiz et. Her feedback için sentiment score (positive/neutral/negative), common themes (communication, quality, deadline). Özet: "Clients love your communication but mention slow delivery." 
Repo: projects/cortex-freelancer
Files: app/js/feedback-analyzer.js (create)

### [UW-003] Earnings analytics dashboard
Profil verisinden earnings breakdown: monthly trend (estimated), hourly vs fixed ratio, avg project size, top-earning skill categories. Chart.js ile görsel. Section: "💰 Your Earnings Insights"
Repo: projects/cortex-freelancer
Files: app/js/earnings-analytics.js (create), app/index.html

### [UW-004] Smart rate optimizer
Market benchmarks (data/market-benchmarks.json) + user's current rate + earnings + JSS → optimal rate recommendation. "You're charging $15/hr but top 25% in your category charge $35-55/hr. Raising to $25/hr could increase annual earnings by $12K without losing competitiveness." Interactive slider showing projected earnings at different rates.
Repo: projects/cortex-freelancer
Files: app/js/rate-optimizer.js (create)

### [UW-005] Title & description rewriter with AI
Mevcut title ve description'ı analiz et → AI ile 3 alternatif title + optimized description öner. SEO-friendly, keyword-rich, Upwork algorithm'a uygun. Before/after comparison UI.
Repo: projects/cortex-freelancer
Files: api/rewrite-profile.js (create), app/js/profile-rewriter.js (create)

### [UW-006] Skill gap analyzer with learning paths
User's skills vs market demand (data/high-demand-skills.json). "You're missing these high-demand skills: React Native, TypeScript, AWS." Her eksik skill için: estimated salary boost, free learning resource links (Coursera, YouTube, docs), time to learn.
Repo: projects/cortex-freelancer
Files: app/js/skill-gap-analyzer.js (create)

### [UW-007] Competition radar — similar freelancers comparison
User's skills + rate + location → find 5-10 similar freelancers on Upwork via search. Compare: rate, JSS, earnings, response time. "You vs Competition" table. Highlight where user wins/loses. Uses local proxy /search endpoint.
Repo: projects/cortex-freelancer
Files: api/upwork-competition.js (create), app/js/competition-radar.js (create), scripts/upwork-local-proxy.js (add /search)

### [UW-008] Job alert system — save search + notify
User saves skill-based job searches. Cron checks every 30min for new jobs matching saved searches. Shows "🔔 New Jobs" badge on dashboard. Store saved searches in localStorage (free tier) or Firestore (Pro).
Repo: projects/cortex-freelancer
Files: app/js/job-alerts.js (create), api/cron/check-jobs.js (create)

### [UW-009] Auto-apply flow — one-click proposal submit
"Apply Now" button on matched jobs: pre-fills proposal (from generate-proposal API), shows cover letter + rate + estimated timeline in modal. "Copy & Apply" opens Upwork job page + copies proposal to clipboard. One-click flow.
Repo: projects/cortex-freelancer
Files: app/js/auto-apply.js (create)

### [UW-010] Interview prep — client question predictor
Based on job description + required skills, generate 5-10 likely interview questions with suggested answers. "This client will probably ask about your Unity experience. Here's how to answer..."
Repo: projects/cortex-freelancer
Files: api/interview-prep.js (create), app/js/interview-prep.js (create)

### [UW-011] Profile strength timeline — track improvements
Save profile snapshots over time (localStorage). Show progress: "Your score went from 62 → 78 in 2 weeks. Title change added +8, portfolio +12." Line chart of score over time.
Repo: projects/cortex-freelancer
Files: app/js/profile-timeline.js (create)

### [UW-012] Niche finder — discover underserved markets
Analyze user's skills → find Upwork categories with high demand but few freelancers. "Your Unity + AR skills are rare in the Architecture category. Only 12 freelancers offer this — average rate $85/hr." Uses job search data.
Repo: projects/cortex-freelancer
Files: app/js/niche-finder.js (create), api/upwork-niche.js (create)

### [UW-013] Portfolio review & suggestions
Analyze portfolio items (if any). Check: has images, has descriptions, variety of work, relevance to top skills. Suggest improvements: "Add 3 case studies showing AR projects to match your top skill." If no portfolio: generate a portfolio plan.
Repo: projects/cortex-freelancer
Files: app/js/portfolio-reviewer.js (create)

### [UW-014] Weekly performance digest email/notification
Generate weekly report: "This week: 15 new matching jobs, your top match was [job] at 92% compatibility, your profile score is 78 (+3). 2 action items." Can be shown in-app or emailed.
Repo: projects/cortex-freelancer
Files: app/js/weekly-digest.js (create), api/generate-digest.js (create)

### [UW-015] Client red flag detector for job listings
Analyze job descriptions for red flags: unrealistic budget, scope creep signals, payment issues, vague requirements. Rate each job: 🟢 Safe / 🟡 Caution / 🔴 Risky. Show warning on job cards.
Repo: projects/cortex-freelancer
Files: app/js/job-red-flags.js (create)

### [UW-016] Proposal A/B testing
Generate 2-3 proposal variants for each job (different tones: professional/casual/technical). Track which style gets more responses over time. "Your professional tone proposals have 3x higher response rate."
Repo: projects/cortex-freelancer
Files: app/js/proposal-ab.js (create), api/generate-proposal-variants.js (create)

### [UW-017] Response time optimizer
Analyze when jobs are posted (timezone patterns) → recommend best times to apply. "Jobs in your niche are posted most between 9-11 AM EST. Apply within 2 hours for 3x higher response rate." Show heatmap.
Repo: projects/cortex-freelancer
Files: app/js/response-timer.js (create)

### [UW-018] Earnings calculator & tax estimator
Input: hourly rate + hours/week → annual projection with Upwork fees, taxes by country (TR, EG, NG, PK, US, UK), and net take-home. Interactive calculator. "At $25/hr × 30hr/wk, you'd earn $36,400/yr after Upwork fees and TR taxes."
Repo: projects/cortex-freelancer
Files: app/js/earnings-calculator.js (create)

### [UW-019] Smart job filter — beyond keyword matching
Multi-criteria job filter: budget range, client history (repeat clients, good ratings), project length, skill match %, timezone compatibility. Saved filter presets. Goes beyond basic keyword search.
Repo: projects/cortex-freelancer
Files: app/js/smart-job-filter.js (create)

### [UW-020] Profile completeness action plan — guided wizard
Step-by-step wizard: "Complete these 5 actions to reach a score of 85+." Each step is actionable with direct links to Upwork edit pages. Progress bar. Estimated time to complete. Gamification: badges for milestones.
Repo: projects/cortex-freelancer
Files: app/js/action-plan-wizard.js (create)
