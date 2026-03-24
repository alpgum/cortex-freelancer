/**
 * [UW-020] Action Plan Wizard
 *
 * Turns CortexCompletenessChecker results into a step-by-step guided
 * action plan with gamification, progress tracking, and direct Upwork links.
 */

(function () {
  'use strict';

  // ── Storage key ──────────────────────────────────────────────────────
  const STORAGE_KEY = 'cortex_action_plan_completed';

  function loadCompleted() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  function saveCompleted(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (_) { /* quota etc. */ }
  }

  // ── Upwork edit URLs ─────────────────────────────────────────────────
  const UPWORK_URLS = {
    title: 'https://www.upwork.com/freelancers/settings/profile',
    description: 'https://www.upwork.com/freelancers/settings/profile',
    skills: 'https://www.upwork.com/freelancers/settings/profile',
    portfolio: 'https://www.upwork.com/freelancers/settings/profile/portfolio',
    rate: 'https://www.upwork.com/freelancers/settings/profile',
    location: 'https://www.upwork.com/freelancers/settings/contactInfo',
    categories: 'https://www.upwork.com/freelancers/settings/profile',
    jobs: 'https://www.upwork.com/nx/find-work/',
    jss: 'https://www.upwork.com/nx/find-work/',
    earnings: 'https://www.upwork.com/nx/find-work/',
    memberAge: null,
  };

  // ── High-demand skills by category ───────────────────────────────────
  const HIGH_DEMAND_SKILLS = {
    development: ['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Docker', 'GraphQL', 'Next.js', 'PostgreSQL', 'Tailwind CSS'],
    design: ['Figma', 'UI/UX Design', 'Design Systems', 'Prototyping', 'User Research', 'Interaction Design', 'Adobe XD', 'Responsive Design'],
    data: ['Python', 'SQL', 'Machine Learning', 'Data Visualization', 'Pandas', 'TensorFlow', 'Power BI', 'Tableau', 'ETL', 'BigQuery'],
    writing: ['SEO Writing', 'Copywriting', 'Technical Writing', 'Content Strategy', 'Blog Writing', 'UX Writing', 'Grant Writing'],
    marketing: ['Google Ads', 'Facebook Ads', 'SEO', 'Email Marketing', 'Google Analytics', 'HubSpot', 'Content Marketing', 'Social Media Marketing'],
    general: ['Communication', 'Project Management', 'Agile', 'Problem Solving', 'API Integration', 'Git', 'Jira', 'Slack'],
  };

  // ── Description template ─────────────────────────────────────────────
  const DESCRIPTION_TEMPLATE = `🔹 Hook (1-2 sentences)
"I help [target clients] achieve [specific outcome] through [your approach]."

🔹 Experience (2-3 sentences)
"With X years of experience in [field], I've [notable achievement]. I've worked with [types of clients/companies] on [types of projects]."

🔹 Skills & Tools (bullet list)
• [Skill 1] — [brief context]
• [Skill 2] — [brief context]
• [Skill 3] — [brief context]

🔹 Call-to-Action (1 sentence)
"Let's discuss your project — send me a message and I'll respond within 24 hours."`;

  // ── Category suggestions ─────────────────────────────────────────────
  const CATEGORY_MAP = {
    development: ['Web Development', 'Mobile Development', 'Software Development', 'DevOps & Solution Architecture'],
    design: ['UX/UI Design', 'Web Design', 'Brand Identity Design', 'Product Design'],
    data: ['Data Science & Analytics', 'Machine Learning', 'Data Engineering', 'Business Intelligence'],
    writing: ['Content Writing', 'Technical Writing', 'Copywriting', 'Editing & Proofreading'],
    marketing: ['Digital Marketing', 'SEO', 'Social Media Marketing', 'Email Marketing'],
  };

  // ── Action template builders ─────────────────────────────────────────

  function inferDomain(profileData) {
    const skills = (profileData.skills || []).map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase());
    const title = (profileData.title || '').toLowerCase();
    const all = skills.join(' ') + ' ' + title;

    if (/react|angular|vue|node|javascript|typescript|python|java|swift|flutter|php|ruby|go|rust|docker|aws|devops/.test(all)) return 'development';
    if (/figma|sketch|photoshop|illustrator|ui|ux|design|brand/.test(all)) return 'design';
    if (/data|machine learning|ml|ai|analytics|sql|tableau|pandas|tensorflow|bigquery/.test(all)) return 'data';
    if (/writ|copy|content|edit|blog|seo writ|technical writ/.test(all)) return 'writing';
    if (/marketing|ads|seo|social media|email|hubspot|google ads/.test(all)) return 'marketing';
    return 'general';
  }

  function generateTitleSuggestions(profileData) {
    const skills = (profileData.skills || []).slice(0, 5).map(s => typeof s === 'string' ? s : s.name || s);
    const topSkill = skills[0] || 'Specialist';
    const secondSkill = skills[1] || '';
    const earnings = profileData.totalEarnings || 0;
    const jobs = profileData.totalJobs || 0;

    const earningsTag = earnings >= 100000 ? ` | $${Math.round(earnings / 1000)}K+ Earned` : '';
    const jobsTag = jobs >= 50 ? ` | ${jobs}+ Projects` : '';
    const experienceTag = jobs >= 20 ? ' | Proven Track Record' : '';

    return [
      `Senior ${topSkill} Developer${secondSkill ? ' | ' + secondSkill : ''}${earningsTag || experienceTag}`,
      `${topSkill} Expert${secondSkill ? ' & ' + secondSkill + ' Specialist' : ''}${jobsTag}`,
      `Full-Stack ${topSkill} Engineer | End-to-End Solutions${earningsTag}`,
    ];
  }

  function suggestSkills(profileData) {
    const domain = inferDomain(profileData);
    const current = new Set((profileData.skills || []).map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase()));
    const pool = HIGH_DEMAND_SKILLS[domain] || HIGH_DEMAND_SKILLS.general;
    return pool.filter(s => !current.has(s.toLowerCase())).slice(0, 6);
  }

  function suggestPortfolioIdeas(profileData) {
    const domain = inferDomain(profileData);
    const ideas = {
      development: [
        'Build a responsive SaaS dashboard demo with charts & dark mode',
        'Create an open-source CLI tool or library and showcase it',
        'Design & deploy a full-stack app (e.g., task manager, API gateway)',
      ],
      design: [
        'Redesign a popular app\'s onboarding flow with before/after screens',
        'Create a design system with components, tokens, and documentation',
        'Design a mobile app concept from research through high-fidelity prototype',
      ],
      data: [
        'Build an interactive data dashboard with real public datasets',
        'Create a machine learning model with documented methodology',
        'Publish a data analysis case study with visualizations',
      ],
      writing: [
        'Write a long-form industry guide (2,000+ words, SEO-optimized)',
        'Create a case study showing measurable results from your writing',
        'Build a content calendar template with sample posts',
      ],
      marketing: [
        'Document a campaign with before/after metrics and ROI analysis',
        'Create a marketing strategy deck for a fictional startup',
        'Build an SEO audit report for a well-known website',
      ],
      general: [
        'Document a successful project with problem → approach → results',
        'Create a case study with measurable outcomes',
        'Build a demo/prototype showcasing your primary skill',
      ],
    };
    return ideas[domain] || ideas.general;
  }

  function suggestCategories(profileData) {
    const domain = inferDomain(profileData);
    return CATEGORY_MAP[domain] || CATEGORY_MAP.development;
  }

  // ── Map completeness items to action steps ───────────────────────────

  function buildActionPlan(completenessResult, profileData) {
    const steps = [];
    const items = completenessResult.items || [];
    const p = profileData || {};

    for (const item of items) {
      if (item.status === 'pass' || item.status === 'bonus') continue;

      const name = item.name;

      // Title
      if (name === 'Professional Title') {
        const suggestions = generateTitleSuggestions(p);
        steps.push({
          id: 'title',
          action: 'Write a professional title',
          currentState: `Your title is '${p.title || '(empty)'}' — too generic`,
          targetState: 'A specific title that highlights your expertise',
          impact: item.weight,
          effort: '5 minutes',
          howTo: 'Go to Upwork → Profile → Edit → Title field. Replace your current title with something specific.',
          upworkEditUrl: UPWORK_URLS.title,
          examples: suggestions,
          category: 'quick-win',
        });
      }

      // Description >200
      if (name === 'Description Length (>200 chars)') {
        const descLen = (p.description || '').length;
        steps.push({
          id: 'description',
          action: 'Write a compelling profile description',
          currentState: `Your description is ${descLen} characters — too short`,
          targetState: 'A 500+ character description with hook, experience, skills, and CTA',
          impact: item.weight,
          effort: '15 minutes',
          howTo: 'Follow this proven structure:\n\n' + DESCRIPTION_TEMPLATE,
          upworkEditUrl: UPWORK_URLS.description,
          examples: [
            'Start with a strong hook: "I help SaaS startups ship 2x faster with battle-tested React architecture."',
            'Include numbers: "5 years, 80+ projects, $500K+ earned"',
            'End with a CTA: "Message me with your project details — I respond within 2 hours."',
          ],
          category: 'high-impact',
        });
      }

      // Description >500 bonus
      if (name === 'Description Length (>500 chars)') {
        const descLen = (p.description || '').length;
        if (descLen >= 200) {
          steps.push({
            id: 'description_bonus',
            action: 'Expand your description to 500+ characters',
            currentState: `Your description is ${descLen} chars — good but can be better`,
            targetState: '500+ characters with detailed experience and social proof',
            impact: item.weight,
            effort: '10 minutes',
            howTo: 'Add client testimonials, specific technologies, project types, and industries you\'ve worked in.',
            upworkEditUrl: UPWORK_URLS.description,
            examples: [
              'Add a "What clients say" section with paraphrased testimonials',
              'List specific industries: fintech, healthcare, e-commerce, etc.',
              'Mention tools & stack: "I work with React, Node.js, PostgreSQL, AWS"',
            ],
            category: 'bonus',
          });
        }
      }

      // Skills >5
      if (name === 'Skills Count (>5)') {
        const suggested = suggestSkills(p);
        const count = (p.skills || []).length;
        steps.push({
          id: 'skills',
          action: `Add ${Math.max(6 - count, 1)}+ more skills to your profile`,
          currentState: `You have ${count} skill${count === 1 ? '' : 's'} listed — below the minimum`,
          targetState: '6+ skills including high-demand ones in your field',
          impact: item.weight,
          effort: '3 minutes',
          howTo: 'Go to Profile → Skills section → Add skills. Include both broad and niche skills.',
          upworkEditUrl: UPWORK_URLS.skills,
          examples: suggested.length > 0
            ? [`High-demand skills to consider: ${suggested.join(', ')}`]
            : ['Add skills that match the jobs you want to land'],
          category: 'quick-win',
        });
      }

      // Skills >10 bonus
      if (name === 'Skills Count (>10)') {
        const suggested = suggestSkills(p);
        const count = (p.skills || []).length;
        if (count >= 6) {
          steps.push({
            id: 'skills_bonus',
            action: 'Add more skills to reach 11+',
            currentState: `You have ${count} skills — add more for a bonus`,
            targetState: '11+ skills for maximum visibility in search',
            impact: item.weight,
            effort: '3 minutes',
            howTo: 'Include complementary skills, tools, and methodologies that are relevant to your work.',
            upworkEditUrl: UPWORK_URLS.skills,
            examples: suggested.length > 0
              ? [`Consider adding: ${suggested.join(', ')}`]
              : ['Think about tools, frameworks, soft skills, and methodologies'],
            category: 'bonus',
          });
        }
      }

      // Portfolio
      if (name === 'Portfolio Items') {
        const ideas = suggestPortfolioIdeas(p);
        steps.push({
          id: 'portfolio',
          action: 'Add your first portfolio item',
          currentState: 'No portfolio items — clients can\'t see your work',
          targetState: 'At least 1 project showcasing your best work',
          impact: item.weight,
          effort: '20 minutes',
          howTo: 'Go to Profile → Portfolio → Add Project. Include: title, description, images/links, skills used.',
          upworkEditUrl: UPWORK_URLS.portfolio,
          examples: ideas,
          category: 'high-impact',
        });
      }

      // Portfolio >3 bonus
      if (name === 'Portfolio Items (>3)') {
        const count = (p.portfolio || []).length;
        if (count > 0) {
          const ideas = suggestPortfolioIdeas(p);
          steps.push({
            id: 'portfolio_bonus',
            action: `Add ${4 - count} more portfolio item${4 - count === 1 ? '' : 's'}`,
            currentState: `${count} portfolio item${count === 1 ? '' : 's'} — add more to stand out`,
            targetState: '4+ portfolio items covering different project types',
            impact: item.weight,
            effort: '15 minutes per item',
            howTo: 'Diversify your portfolio: show different project types, industries, or skill sets.',
            upworkEditUrl: UPWORK_URLS.portfolio,
            examples: ideas,
            category: 'bonus',
          });
        }
      }

      // Hourly rate
      if (name === 'Hourly Rate') {
        steps.push({
          id: 'rate',
          action: 'Set a competitive hourly rate',
          currentState: 'No hourly rate set — you\'re invisible in filtered searches',
          targetState: 'A market-aligned rate that signals quality',
          impact: item.weight,
          effort: '5 minutes',
          howTo: 'Go to Profile → Hourly Rate. Research market rates for your skills using the Rate Optimizer tool.',
          upworkEditUrl: UPWORK_URLS.rate,
          examples: [
            'New freelancer: $25-45/hr (build reviews first, raise later)',
            'Experienced: $50-100/hr (match your earnings history)',
            'Expert/Niche: $100-200+/hr (if you have strong JSS + portfolio)',
          ],
          category: 'quick-win',
        });
      }

      // Location
      if (name === 'Location') {
        steps.push({
          id: 'location',
          action: 'Add your location',
          currentState: 'No location set',
          targetState: 'City and country visible on your profile',
          impact: item.weight,
          effort: '2 minutes',
          howTo: 'Go to Settings → Contact Info → Location. Some clients filter by timezone/region.',
          upworkEditUrl: UPWORK_URLS.location,
          examples: [
            'Use your real city — clients often want to know your timezone',
            'Some clients specifically search for freelancers in certain regions',
          ],
          category: 'quick-win',
        });
      }

      // Categories
      if (name === 'Categories / Specialization') {
        const cats = suggestCategories(p);
        steps.push({
          id: 'categories',
          action: 'Select your categories & specializations',
          currentState: 'No categories selected — you\'re not showing up in category searches',
          targetState: 'Relevant categories selected to match your expertise',
          impact: item.weight,
          effort: '3 minutes',
          howTo: 'Go to Profile → Categories. Select 1-3 categories that best match your services.',
          upworkEditUrl: UPWORK_URLS.categories,
          examples: cats.length > 0
            ? [`Recommended for your profile: ${cats.join(', ')}`]
            : ['Select categories that match the jobs you want to find'],
          category: 'quick-win',
        });
      }

      // JSS
      if (name === 'Job Success Score') {
        steps.push({
          id: 'jss',
          action: 'Build your Job Success Score',
          currentState: 'No JSS yet — this takes time and completed contracts',
          targetState: 'A visible JSS (aim for 90%+)',
          impact: item.weight,
          effort: 'Ongoing (weeks/months)',
          howTo: 'Complete contracts professionally: deliver on time, communicate well, ask for feedback. Avoid disputes.',
          upworkEditUrl: UPWORK_URLS.jss,
          examples: [
            'Always close contracts properly — don\'t let them sit open',
            'Ask satisfied clients to leave detailed reviews',
            'Start with smaller contracts to build your score safely',
          ],
          category: 'long-term',
        });
      }

      // Completed jobs
      if (name === 'Completed Jobs') {
        steps.push({
          id: 'jobs',
          action: 'Land and complete your first job',
          currentState: 'No completed jobs — your profile looks unproven',
          targetState: 'At least 1 completed job with positive feedback',
          impact: item.weight,
          effort: 'Ongoing (days/weeks)',
          howTo: 'Apply to jobs matching your skills. Start with smaller projects to build credibility.',
          upworkEditUrl: UPWORK_URLS.jobs,
          examples: [
            'Send personalized proposals — reference the client\'s specific needs',
            'Start with $50-200 fixed-price projects to get your first reviews',
            'Use the Proposal Generator tool to craft winning proposals',
          ],
          category: 'long-term',
        });
      }

      // Earnings
      if (name === 'Total Earnings') {
        steps.push({
          id: 'earnings',
          action: 'Earn revenue from completed contracts',
          currentState: 'No earnings yet',
          targetState: 'Visible earnings that build client confidence',
          impact: item.weight,
          effort: 'Ongoing',
          howTo: 'Complete paid contracts. Even small ones count and make your profile look established.',
          upworkEditUrl: UPWORK_URLS.earnings,
          examples: [
            'Milestone your fixed-price projects so earnings show up as you go',
            'Hourly contracts show real-time earnings on your profile',
          ],
          category: 'long-term',
        });
      }

      // Member age — can't be actioned
      if (name === 'Account Age (>6 months)') {
        steps.push({
          id: 'member_age',
          action: 'Wait for account maturity',
          currentState: 'Your account is less than 6 months old',
          targetState: '6+ months on the platform',
          impact: item.weight,
          effort: 'Automatic (just wait)',
          howTo: 'This improves automatically. Focus on other action items in the meantime.',
          upworkEditUrl: null,
          examples: ['Keep your account active — complete jobs and maintain your profile'],
          category: 'passive',
        });
      }
    }

    // Sort: highest impact first, then quick-wins before long-term
    const categoryOrder = { 'quick-win': 0, 'high-impact': 1, 'bonus': 2, 'long-term': 3, 'passive': 4 };
    steps.sort((a, b) => {
      const impactDiff = b.impact - a.impact;
      if (impactDiff !== 0) return impactDiff;
      return (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
    });

    // Number them
    steps.forEach((s, i) => { s.step = i + 1; });

    return steps;
  }

  // ── Calculate projected score ────────────────────────────────────────

  function projectScore(currentScore, steps) {
    const totalGain = steps.reduce((sum, s) => sum + (s.impact || 0), 0);
    return Math.min(currentScore + totalGain, 100);
  }

  function estimateTotalTime(steps) {
    let minutes = 0;
    for (const s of steps) {
      const m = parseInt(s.effort, 10);
      if (!isNaN(m)) minutes += m;
    }
    if (minutes === 0) return '~30 minutes';
    if (minutes < 60) return `~${minutes} minutes`;
    const hrs = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `~${hrs}h ${rem}m` : `~${hrs}h`;
  }

  // ── CSS ──────────────────────────────────────────────────────────────

  const CSS = `
.cortex-apw {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f1117;
  color: #e2e8f0;
  border-radius: 16px;
  padding: 28px;
  max-width: 820px;
  margin: 0 auto;
}

.cortex-apw * { box-sizing: border-box; }

.cortex-apw-header {
  text-align: center;
  margin-bottom: 24px;
}

.cortex-apw-header h2 {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #fff;
}

.cortex-apw-header .subtitle {
  font-size: 14px;
  color: #94a3b8;
}

/* Score projection banner */
.cortex-apw-projection {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.cortex-apw-projection .score-flow {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 22px;
  font-weight: 700;
}

.cortex-apw-projection .score-current {
  color: #f59e0b;
}

.cortex-apw-projection .score-arrow {
  color: #475569;
  font-size: 18px;
}

.cortex-apw-projection .score-projected {
  color: #22c55e;
}

.cortex-apw-projection .meta {
  font-size: 13px;
  color: #94a3b8;
  text-align: right;
}

.cortex-apw-projection .meta span {
  display: block;
}

/* Progress bar */
.cortex-apw-progress {
  margin-bottom: 22px;
}

.cortex-apw-progress .bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.cortex-apw-progress .bar-track {
  height: 10px;
  background: #1e293b;
  border-radius: 5px;
  overflow: hidden;
}

.cortex-apw-progress .bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #22c55e);
  border-radius: 5px;
  transition: width 0.5s ease;
}

/* Gamification banner */
.cortex-apw-gamification {
  background: #1a1a2e;
  border: 1px solid #334155;
  border-left: 4px solid #6366f1;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 20px;
  font-size: 14px;
  color: #c4b5fd;
}

.cortex-apw-gamification .emoji { font-size: 18px; margin-right: 6px; }

/* Step card */
.cortex-apw-step {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 14px;
  transition: border-color 0.2s, opacity 0.3s;
  position: relative;
}

.cortex-apw-step:hover {
  border-color: #6366f1;
}

.cortex-apw-step.completed {
  opacity: 0.55;
  border-color: #22c55e40;
}

.cortex-apw-step.completed .step-header::after {
  content: '✅ Done';
  font-size: 12px;
  color: #22c55e;
  position: absolute;
  top: 20px;
  right: 20px;
}

.cortex-apw-step .step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.cortex-apw-step .step-number {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}

.cortex-apw-step.completed .step-number {
  background: #22c55e;
}

.cortex-apw-step .step-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  flex: 1;
}

.cortex-apw-step .step-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding-left: 44px;
}

.cortex-apw-step .badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cortex-apw-step .badge-impact {
  background: #22c55e20;
  color: #22c55e;
}

.cortex-apw-step .badge-effort {
  background: #f59e0b20;
  color: #f59e0b;
}

.cortex-apw-step .badge-category {
  background: #6366f120;
  color: #a5b4fc;
}

.cortex-apw-step .step-body {
  padding-left: 44px;
}

.cortex-apw-step .before-after {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.cortex-apw-step .ba-box {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.cortex-apw-step .ba-before {
  background: #dc262620;
  border: 1px solid #dc262640;
  color: #fca5a5;
}

.cortex-apw-step .ba-after {
  background: #22c55e15;
  border: 1px solid #22c55e40;
  color: #86efac;
}

.cortex-apw-step .ba-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.7;
  margin-bottom: 4px;
  display: block;
}

.cortex-apw-step .how-to {
  background: #0f172a;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.6;
  margin-bottom: 12px;
  white-space: pre-line;
}

.cortex-apw-step .examples {
  margin-bottom: 14px;
}

.cortex-apw-step .examples-title {
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.cortex-apw-step .example-item {
  font-size: 13px;
  color: #a5b4fc;
  padding: 4px 0 4px 16px;
  position: relative;
  line-height: 1.5;
}

.cortex-apw-step .example-item::before {
  content: '→';
  position: absolute;
  left: 0;
  color: #6366f1;
}

.cortex-apw-step .step-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.cortex-apw-step .btn-do-it {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s;
}

.cortex-apw-step .btn-do-it:hover {
  background: #4f46e5;
}

.cortex-apw-step .btn-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  color: #94a3b8;
  border: 1px solid #475569;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.cortex-apw-step .btn-check:hover {
  border-color: #22c55e;
  color: #22c55e;
}

.cortex-apw-step .btn-check.checked {
  background: #22c55e20;
  border-color: #22c55e;
  color: #22c55e;
}

/* Responsive */
@media (max-width: 600px) {
  .cortex-apw { padding: 16px; }
  .cortex-apw-step .before-after { grid-template-columns: 1fr; }
  .cortex-apw-projection { flex-direction: column; text-align: center; }
  .cortex-apw-projection .meta { text-align: center; }
}
`;

  // ── Render ───────────────────────────────────────────────────────────

  function esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function renderActionPlanWizard(completenessResult, profileData, container) {
    if (!completenessResult || !container) {
      console.error('CortexActionPlanWizard: completenessResult and container are required');
      return;
    }

    const pData = profileData || {};
    const steps = buildActionPlan(completenessResult, pData);
    const currentScore = completenessResult.score || 0;
    const projected = projectScore(currentScore, steps);
    const totalTime = estimateTotalTime(steps);
    const completed = loadCompleted();

    const completedCount = steps.filter(s => completed[s.id]).length;
    const totalSteps = steps.length;
    const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 100;

    if (totalSteps === 0) {
      container.innerHTML = `
        <style>${CSS}</style>
        <div class="cortex-apw">
          <div class="cortex-apw-header">
            <h2>🎯 Your Action Plan</h2>
            <p class="subtitle">Your profile is already looking great! Score: ${currentScore}/100</p>
          </div>
          <div class="cortex-apw-gamification">
            <span class="emoji">🏆</span> All items complete — your profile is fully optimized!
          </div>
        </div>`;
      return;
    }

    // Category labels
    const catLabels = {
      'quick-win': '⚡ Quick Win',
      'high-impact': '🚀 High Impact',
      'bonus': '✨ Bonus',
      'long-term': '📈 Long Term',
      'passive': '⏳ Passive',
    };

    // Gamification text
    let gamificationText;
    if (completedCount === 0) {
      gamificationText = `<span class="emoji">🔥</span> Complete 3 steps to unlock your potential! You have ${totalSteps} actions to boost your score.`;
    } else if (completedCount < 3) {
      gamificationText = `<span class="emoji">💪</span> ${completedCount} down, ${3 - completedCount} more to hit your first milestone!`;
    } else if (completedCount < totalSteps) {
      gamificationText = `<span class="emoji">🚀</span> ${completedCount} of ${totalSteps} complete — you're on fire! Keep going!`;
    } else {
      gamificationText = `<span class="emoji">🏆</span> All ${totalSteps} steps complete! Re-run the completeness checker to verify your new score.`;
    }

    let stepsHtml = '';
    for (const s of steps) {
      const isDone = !!completed[s.id];
      const doneClass = isDone ? ' completed' : '';
      const checkedClass = isDone ? ' checked' : '';
      const checkLabel = isDone ? '☑ Completed' : '☐ Mark Done';

      let examplesHtml = '';
      if (s.examples && s.examples.length > 0) {
        examplesHtml = `
          <div class="examples">
            <div class="examples-title">Examples & Tips</div>
            ${s.examples.map(e => `<div class="example-item">${esc(e)}</div>`).join('')}
          </div>`;
      }

      const doItBtn = s.upworkEditUrl
        ? `<a class="btn-do-it" href="${esc(s.upworkEditUrl)}" target="_blank" rel="noopener">Do It →</a>`
        : '';

      stepsHtml += `
        <div class="cortex-apw-step${doneClass}" data-step-id="${esc(s.id)}">
          <div class="step-header">
            <div class="step-number">${s.step}</div>
            <div class="step-title">${esc(s.action)}</div>
          </div>
          <div class="step-badges">
            <span class="badge badge-impact">+${s.impact} pts</span>
            <span class="badge badge-effort">⏱ ${esc(s.effort)}</span>
            <span class="badge badge-category">${catLabels[s.category] || s.category}</span>
          </div>
          <div class="step-body">
            <div class="before-after">
              <div class="ba-box ba-before">
                <span class="ba-label">Current</span>
                ${esc(s.currentState)}
              </div>
              <div class="ba-box ba-after">
                <span class="ba-label">Target</span>
                ${esc(s.targetState)}
              </div>
            </div>
            <div class="how-to">${esc(s.howTo)}</div>
            ${examplesHtml}
            <div class="step-actions">
              ${doItBtn}
              <button class="btn-check${checkedClass}" data-step-id="${esc(s.id)}">${checkLabel}</button>
            </div>
          </div>
        </div>`;
    }

    container.innerHTML = `
      <style>${CSS}</style>
      <div class="cortex-apw">
        <div class="cortex-apw-header">
          <h2>🎯 Your Action Plan</h2>
          <p class="subtitle">${totalSteps} steps to a stronger profile</p>
        </div>

        <div class="cortex-apw-projection">
          <div class="score-flow">
            <span class="score-current">${currentScore}</span>
            <span class="score-arrow">→</span>
            <span class="score-projected">~${projected}</span>
          </div>
          <div class="meta">
            <span>Estimated time: ${esc(totalTime)}</span>
            <span>Score after all steps complete</span>
          </div>
        </div>

        <div class="cortex-apw-progress">
          <div class="bar-label">
            <span>${completedCount} of ${totalSteps} steps completed</span>
            <span>${progressPct}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${progressPct}%"></div>
          </div>
        </div>

        <div class="cortex-apw-gamification">${gamificationText}</div>

        ${stepsHtml}
      </div>`;

    // Event delegation for check buttons
    container.querySelectorAll('.btn-check').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-step-id');
        const map = loadCompleted();
        if (map[id]) {
          delete map[id];
        } else {
          map[id] = Date.now();
        }
        saveCompleted(map);
        // Re-render
        renderActionPlanWizard(completenessResult, profileData, container);
      });
    });
  }

  // ── [CF-072] 4-Week Action Plan with Weekly Goals ──────────────────

  var WEEKLY_PLAN_STORAGE = 'cortex_weekly_plan';

  function loadWeeklyProgress() {
    try { return JSON.parse(localStorage.getItem(WEEKLY_PLAN_STORAGE)) || {}; } catch (_) { return {}; }
  }

  function saveWeeklyProgress(data) {
    try { localStorage.setItem(WEEKLY_PLAN_STORAGE, JSON.stringify(data)); } catch (_) {}
  }

  /**
   * Generate a 4-week action plan with daily tasks and milestones.
   * @param {Object} completenessResult - From CortexCompletenessChecker
   * @param {Object} profileData - User profile data
   * @param {Object} options - { focusAreas, weeklyHours, startDate }
   * @returns {Object} Structured 4-week plan
   */
  function generateWeeklyActionPlan(completenessResult, profileData, options) {
    options = options || {};
    var weeklyHours = options.weeklyHours || 15;
    var startDate = options.startDate ? new Date(options.startDate) : new Date();
    var focusAreas = options.focusAreas || [];

    var plan = completenessResult ? buildActionPlan(completenessResult, profileData) : [];
    var domain = inferDomain(profileData);

    // Categorize tasks by priority
    var urgent = [];
    var important = [];
    var growth = [];
    var maintenance = [];

    plan.forEach(function (step) {
      if (step.impact >= 8) urgent.push(step);
      else if (step.impact >= 5) important.push(step);
      else if (step.impact >= 3) growth.push(step);
      else maintenance.push(step);
    });

    // Add skill-based goals if focus areas specified
    if (focusAreas.length > 0) {
      focusAreas.forEach(function (area) {
        growth.push({
          id: 'focus-' + area.toLowerCase().replace(/\s+/g, '-'),
          title: 'Learn ' + area,
          description: 'Dedicate time to building ' + area + ' skills',
          impact: 6,
          time: '3-5 hrs/week',
          category: 'skills',
        });
      });
    }

    // Build 4 weeks
    var weeks = [];
    var weekTasks = [urgent, important, growth, maintenance];
    var weekThemes = [
      { name: 'Foundation Sprint', emoji: '🚀', goal: 'Fix critical profile issues and set up for success' },
      { name: 'Optimization Week', emoji: '⚡', goal: 'Improve key areas and start building momentum' },
      { name: 'Growth Push', emoji: '📈', goal: 'Expand skills and start applying strategically' },
      { name: 'Launch & Iterate', emoji: '🎯', goal: 'Go live with improvements and measure results' },
    ];

    for (var w = 0; w < 4; w++) {
      var weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (w * 7));
      var weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      var theme = weekThemes[w];
      var primaryTasks = weekTasks[w] || [];
      // Distribute overflow tasks
      if (w > 0 && weekTasks[w - 1] && weekTasks[w - 1].length > 5) {
        primaryTasks = primaryTasks.concat(weekTasks[w - 1].slice(5));
      }

      var dailyTasks = distributeToDays(primaryTasks, weeklyHours, domain);

      var milestone = {
        name: getMilestone(w, completenessResult, profileData),
        metric: getMilestoneMetric(w, completenessResult),
        target: getMilestoneTarget(w, completenessResult),
      };

      weeks.push({
        week: w + 1,
        theme: theme.name,
        emoji: theme.emoji,
        goal: theme.goal,
        startDate: formatDate(weekStart),
        endDate: formatDate(weekEnd),
        dailyTasks: dailyTasks,
        milestone: milestone,
        estimatedHours: Math.min(weeklyHours, primaryTasks.length * 1.5),
        tasks: primaryTasks.slice(0, 7),
      });
    }

    // Calculate overall metrics
    var totalTasks = weeks.reduce(function (s, w) {
      return s + w.tasks.length;
    }, 0);

    return {
      weeks: weeks,
      totalWeeks: 4,
      totalTasks: totalTasks,
      weeklyHours: weeklyHours,
      startDate: formatDate(startDate),
      endDate: formatDate(new Date(startDate.getTime() + 27 * 86400000)),
      focusAreas: focusAreas,
      projectedScoreIncrease: completenessResult ? Math.min(40, Math.round(totalTasks * 2.5)) : 0,
    };
  }

  function distributeToDays(tasks, weeklyHours, domain) {
    var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var dailyHours = weeklyHours / 5; // Focus on weekdays
    var result = {};

    // Fixed daily habits
    var dailyHabits = [
      'Check for new relevant job postings (15 min)',
      'Review and respond to client messages (10 min)',
    ];

    days.forEach(function (day, i) {
      var dayTasks = dailyHabits.slice();
      if (i < 5) {
        // Weekdays: add 1-2 main tasks
        var taskIndex = Math.floor(i * tasks.length / 5);
        if (tasks[taskIndex]) dayTasks.push('📌 ' + (tasks[taskIndex].title || tasks[taskIndex].description || 'Work on profile improvements'));
        if (tasks[taskIndex + 1] && dailyHours > 2) dayTasks.push('📌 ' + (tasks[taskIndex + 1].title || tasks[taskIndex + 1].description || 'Continue improvements'));
      } else if (i === 5) {
        // Saturday: review + learning
        dayTasks.push('📚 Skill development time (1-2 hrs)');
        dayTasks.push('📊 Review weekly progress and metrics');
      } else {
        // Sunday: planning
        dayTasks.push('📋 Plan next week\'s priorities');
        dayTasks.push('🧠 Reflect on wins and learnings');
      }
      result[day] = dayTasks;
    });

    return result;
  }

  function getMilestone(weekNum, completenessResult, profileData) {
    var milestones = [
      'Complete all critical profile fixes',
      'Submit 5 high-quality proposals',
      'Add 2 new skills to profile',
      'Land a new client or get first response',
    ];
    return milestones[weekNum] || 'Continue improving';
  }

  function getMilestoneMetric(weekNum, completenessResult) {
    var metrics = ['Profile completeness score', 'Proposals sent', 'Skills added', 'Response rate'];
    return metrics[weekNum] || 'Overall progress';
  }

  function getMilestoneTarget(weekNum, completenessResult) {
    if (!completenessResult) return 'Improvement';
    var currentScore = completenessResult.score || 0;
    var targets = [
      (currentScore + 15) + '%+ profile score',
      '5+ proposals submitted',
      '2+ new in-demand skills',
      '1+ client response or interview',
    ];
    return targets[weekNum] || 'Continue';
  }

  function formatDate(d) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
  }

  /**
   * Render the 4-week action plan with interactive checkboxes
   */
  function renderWeeklyActionPlan(completenessResult, profileData, container, options) {
    if (!container) return;

    var plan = generateWeeklyActionPlan(completenessResult, profileData, options);
    var progress = loadWeeklyProgress();

    var html = '<div class="cortex-wap" style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:720px;">';

    // Header
    html += '<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 8px;color:#7c83ff;font-size:18px;">📋 4-Week Action Plan</h3>';
    html += '<p style="margin:0;font-size:13px;color:#9ca3af;">' + plan.startDate + ' → ' + plan.endDate + ' · ' + plan.weeklyHours + ' hrs/week · ' + plan.totalTasks + ' tasks</p>';

    // Overall progress bar
    var totalCheckable = 0;
    var totalChecked = 0;
    plan.weeks.forEach(function (w) {
      w.tasks.forEach(function (t) {
        totalCheckable++;
        if (progress[t.id || t.title]) totalChecked++;
      });
    });
    var overallPct = totalCheckable > 0 ? Math.round((totalChecked / totalCheckable) * 100) : 0;
    html += '<div style="margin-top:12px;">';
    html += '<div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:4px;"><span>' + totalChecked + '/' + totalCheckable + ' tasks</span><span>' + overallPct + '%</span></div>';
    html += '<div style="height:8px;background:#1f2937;border-radius:4px;overflow:hidden;"><div style="width:' + overallPct + '%;height:100%;background:linear-gradient(90deg,#6366f1,#00d4aa);border-radius:4px;transition:width 0.3s;"></div></div>';
    html += '</div></div>';

    // Weeks
    plan.weeks.forEach(function (week) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:12px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
      html += '<h4 style="margin:0;color:#e0e0e0;font-size:15px;">' + week.emoji + ' Week ' + week.week + ': ' + escH(week.theme) + '</h4>';
      html += '<span style="font-size:11px;color:#888;">' + week.startDate + ' – ' + week.endDate + '</span>';
      html += '</div>';
      html += '<p style="margin:0 0 12px;font-size:13px;color:#9ca3af;">🎯 ' + escH(week.goal) + '</p>';

      // Milestone
      html += '<div style="background:#1a1a2e;border-left:3px solid #7c83ff;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:12px;">';
      html += '<div style="font-size:11px;color:#7c83ff;text-transform:uppercase;letter-spacing:1px;">Milestone</div>';
      html += '<div style="font-size:13px;color:#d1d5db;margin-top:2px;">' + escH(week.milestone.name) + ' → <strong style="color:#00d4aa;">' + escH(week.milestone.target) + '</strong></div>';
      html += '</div>';

      // Tasks with checkboxes
      html += '<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Key Tasks</div>';
      week.tasks.forEach(function (task) {
        var taskId = task.id || task.title || '';
        var checked = !!progress[taskId];
        html += '<div class="wap-task" data-task-id="' + escAttr(taskId) + '" style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;cursor:pointer;">';
        html += '<span class="wap-check" style="font-size:14px;flex-shrink:0;margin-top:1px;">' + (checked ? '✅' : '⬜') + '</span>';
        html += '<span style="font-size:13px;color:' + (checked ? '#6b7280;text-decoration:line-through' : '#d1d5db') + ';">' + escH(task.title || task.description || '') + '</span>';
        html += '</div>';
      });

      // Daily breakdown toggle
      html += '<details style="margin-top:10px;"><summary style="font-size:11px;color:#888;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">📅 Daily Breakdown</summary>';
      html += '<div style="margin-top:6px;">';
      Object.keys(week.dailyTasks).forEach(function (day) {
        html += '<div style="padding:4px 8px;border-left:2px solid #2d2d44;margin:4px 0;">';
        html += '<strong style="font-size:12px;color:#fbbf24;">' + day + '</strong>';
        html += '<ul style="margin:2px 0 0;padding-left:14px;font-size:11px;color:#9ca3af;">';
        week.dailyTasks[day].forEach(function (t) { html += '<li style="margin:2px 0;">' + escH(t) + '</li>'; });
        html += '</ul></div>';
      });
      html += '</div></details>';

      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Attach click handlers for checkboxes
    container.querySelectorAll('.wap-task').forEach(function (el) {
      el.addEventListener('click', function () {
        var taskId = this.getAttribute('data-task-id');
        var p = loadWeeklyProgress();
        if (p[taskId]) { delete p[taskId]; } else { p[taskId] = Date.now(); }
        saveWeeklyProgress(p);
        renderWeeklyActionPlan(completenessResult, profileData, container, options);
      });
    });

    return plan;
  }

  function escH(str) { if (!str) return ''; var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function escAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  // ── Public API ───────────────────────────────────────────────────────

  var api = {
    buildActionPlan: buildActionPlan,
    renderActionPlanWizard: renderActionPlanWizard,
    generateWeeklyActionPlan: generateWeeklyActionPlan,
    renderWeeklyActionPlan: renderWeeklyActionPlan,
    projectScore: projectScore,
    estimateTotalTime: estimateTotalTime,
    suggestSkills: suggestSkills,
    suggestPortfolioIdeas: suggestPortfolioIdeas,
    suggestCategories: suggestCategories,
    generateTitleSuggestions: generateTitleSuggestions,
    inferDomain: inferDomain,
  };

  // Browser global
  if (typeof window !== 'undefined') {
    window.CortexActionPlanWizard = api;
  }

  // CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
