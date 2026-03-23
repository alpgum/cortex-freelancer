/**
 * Cortex Freelancer — Niche Finder
 * [UW-012] Discover underserved Upwork markets
 *
 * Analyzes user skills to find profitable niches with less competition.
 * Input: { skills, hourlyRate, totalEarnings }
 * Expose as window.CortexNicheFinder
 */

(function () {
  'use strict';

  // ─── Market Benchmarks by Category ──────────────────────────────────
  const MARKET_BENCHMARKS = {
    'Web Development':      { junior: 25, mid: 50, senior: 85,  demand: 9, competition: 9 },
    'Mobile Development':   { junior: 30, mid: 55, senior: 95,  demand: 8, competition: 7 },
    'React':                { junior: 30, mid: 55, senior: 90,  demand: 9, competition: 8 },
    'Angular':              { junior: 28, mid: 50, senior: 85,  demand: 6, competition: 6 },
    'Vue.js':               { junior: 25, mid: 48, senior: 80,  demand: 6, competition: 5 },
    'Node.js':              { junior: 28, mid: 52, senior: 88,  demand: 8, competition: 7 },
    'Python':               { junior: 30, mid: 55, senior: 95,  demand: 9, competition: 8 },
    'Data Science':         { junior: 35, mid: 65, senior: 110, demand: 9, competition: 6 },
    'Machine Learning':     { junior: 40, mid: 70, senior: 120, demand: 9, competition: 5 },
    'AI/LLM':               { junior: 45, mid: 80, senior: 140, demand: 10, competition: 4 },
    'UI/UX Design':         { junior: 25, mid: 50, senior: 90,  demand: 8, competition: 8 },
    'Graphic Design':       { junior: 20, mid: 40, senior: 70,  demand: 7, competition: 9 },
    'WordPress':            { junior: 15, mid: 35, senior: 60,  demand: 7, competition: 9 },
    'iOS Development':      { junior: 35, mid: 60, senior: 100, demand: 7, competition: 6 },
    'Android Development':  { junior: 30, mid: 55, senior: 90,  demand: 7, competition: 7 },
    'DevOps':               { junior: 35, mid: 65, senior: 110, demand: 8, competition: 5 },
    'Cloud Architecture':   { junior: 40, mid: 70, senior: 120, demand: 8, competition: 4 },
    'Blockchain':           { junior: 40, mid: 75, senior: 130, demand: 6, competition: 4 },
    'Cybersecurity':        { junior: 35, mid: 65, senior: 115, demand: 8, competition: 4 },
    'QA Testing':           { junior: 18, mid: 35, senior: 60,  demand: 6, competition: 7 },
    'Technical Writing':    { junior: 20, mid: 40, senior: 70,  demand: 6, competition: 5 },
    'SEO':                  { junior: 18, mid: 38, senior: 65,  demand: 7, competition: 8 },
    'Digital Marketing':    { junior: 20, mid: 42, senior: 75,  demand: 8, competition: 8 },
    'Video Editing':        { junior: 18, mid: 38, senior: 65,  demand: 7, competition: 7 },
    'Copywriting':          { junior: 20, mid: 42, senior: 75,  demand: 7, competition: 7 },
    'Project Management':   { junior: 25, mid: 50, senior: 85,  demand: 7, competition: 6 },
    'Flutter':              { junior: 28, mid: 52, senior: 88,  demand: 7, competition: 5 },
    'Unity/Game Dev':       { junior: 25, mid: 50, senior: 90,  demand: 6, competition: 4 },
    'AR/VR':                { junior: 35, mid: 65, senior: 110, demand: 7, competition: 3 },
    'Shopify':              { junior: 20, mid: 40, senior: 70,  demand: 7, competition: 6 },
    '3D Modeling':          { junior: 22, mid: 45, senior: 80,  demand: 6, competition: 5 },
    'Data Engineering':     { junior: 38, mid: 68, senior: 115, demand: 8, competition: 4 },
    'NLP':                  { junior: 42, mid: 75, senior: 125, demand: 8, competition: 3 },
    'Automation/RPA':       { junior: 28, mid: 50, senior: 85,  demand: 7, competition: 4 },
    'Rust/Go':              { junior: 35, mid: 65, senior: 110, demand: 7, competition: 3 },
  };

  // High-demand skills with demand tier (1-10)
  const HIGH_DEMAND_SKILLS = {
    'React': 9, 'Next.js': 8, 'TypeScript': 8, 'Node.js': 8, 'Python': 9,
    'AWS': 8, 'Docker': 7, 'Kubernetes': 7, 'Terraform': 7,
    'Machine Learning': 9, 'AI': 10, 'LLM': 10, 'GPT': 9, 'NLP': 8,
    'Data Science': 9, 'Data Engineering': 8, 'Data Analysis': 7,
    'Flutter': 7, 'React Native': 7, 'Swift': 6, 'Kotlin': 6,
    'Figma': 7, 'UI/UX': 8, 'Product Design': 7,
    'Blockchain': 6, 'Solidity': 6, 'Web3': 6,
    'Cybersecurity': 8, 'DevOps': 8, 'CI/CD': 7,
    'GraphQL': 6, 'REST API': 7, 'Microservices': 7,
    'PostgreSQL': 6, 'MongoDB': 6, 'Redis': 5,
    'Go': 7, 'Rust': 7, 'Unity': 6, 'AR': 7, 'VR': 7,
    'Shopify': 7, 'WordPress': 6, 'Video Editing': 6,
    'Copywriting': 6, 'SEO': 7, 'Digital Marketing': 7,
    '3D Modeling': 6, 'Automation': 7, 'RPA': 6,
    'Vue.js': 6, 'Angular': 6, 'Svelte': 5,
    'Java': 6, 'C#': 6, '.NET': 6, 'PHP': 5, 'Ruby': 5,
    'Power BI': 6, 'Tableau': 6, 'Excel': 5,
    'Prompt Engineering': 8, 'Fine-tuning': 8,
  };

  // ─── Predefined Niche Combinations (25+) ───────────────────────────
  const NICHE_DEFINITIONS = [
    {
      niche: 'AI/ML for Healthcare',
      requiredSkills: ['Machine Learning', 'AI', 'Python', 'Data Science', 'NLP', 'TensorFlow', 'PyTorch'],
      minMatch: 2,
      avgRate: '$120/hr',
      avgRateNum: 120,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 94,
      advice: 'Healthcare AI is exploding — HIPAA-savvy ML engineers are rare on Upwork. Highlight any medical data experience.',
    },
    {
      niche: 'React Native for Fintech',
      requiredSkills: ['React Native', 'React', 'TypeScript', 'Node.js', 'Mobile Development', 'Fintech', 'Payment Integration'],
      minMatch: 2,
      avgRate: '$95/hr',
      avgRateNum: 95,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 91,
      advice: 'Fintech startups need mobile-first. Combine RN with payment/KYC experience for premium positioning.',
    },
    {
      niche: 'Unity for Education',
      requiredSkills: ['Unity', 'C#', 'Game Dev', '3D Modeling', 'AR', 'VR', 'Education', 'Gamification'],
      minMatch: 2,
      avgRate: '$85/hr',
      avgRateNum: 85,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 88,
      advice: 'EdTech is booming — only ~50 freelancers combine Unity + Education on Upwork. Big opportunity.',
    },
    {
      niche: 'Data Science for Marketing',
      requiredSkills: ['Data Science', 'Python', 'Data Analysis', 'SQL', 'Machine Learning', 'Digital Marketing', 'SEO', 'Analytics', 'Power BI', 'Tableau'],
      minMatch: 2,
      avgRate: '$90/hr',
      avgRateNum: 90,
      competitionLevel: 'medium',
      demandTrend: 'rising',
      baseScore: 86,
      advice: 'CMOs are desperate for data-driven marketers. Bridge the gap between analytics and marketing strategy.',
    },
    {
      niche: 'WordPress for Legal',
      requiredSkills: ['WordPress', 'PHP', 'SEO', 'Web Development', 'Copywriting', 'UI/UX'],
      minMatch: 2,
      avgRate: '$65/hr',
      avgRateNum: 65,
      competitionLevel: 'low',
      demandTrend: 'stable',
      baseScore: 78,
      advice: 'Law firms pay premium for niche expertise. Build a portfolio of legal sites and charge 2× general WP rates.',
    },
    {
      niche: 'Shopify for Fashion',
      requiredSkills: ['Shopify', 'Liquid', 'JavaScript', 'UI/UX', 'Graphic Design', 'E-commerce', 'CSS'],
      minMatch: 2,
      avgRate: '$70/hr',
      avgRateNum: 70,
      competitionLevel: 'medium',
      demandTrend: 'stable',
      baseScore: 76,
      advice: 'Fashion brands want beautiful stores. Combine Shopify dev with an eye for aesthetics to stand out.',
    },
    {
      niche: 'Flutter for Startups',
      requiredSkills: ['Flutter', 'Dart', 'Firebase', 'Mobile Development', 'UI/UX', 'React Native', 'MVP'],
      minMatch: 2,
      avgRate: '$80/hr',
      avgRateNum: 80,
      competitionLevel: 'medium',
      demandTrend: 'rising',
      baseScore: 83,
      advice: 'Startups love Flutter for quick cross-platform MVPs. Position as a "0-to-1" mobile specialist.',
    },
    {
      niche: 'DevOps for SaaS',
      requiredSkills: ['DevOps', 'AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Linux', 'Monitoring'],
      minMatch: 2,
      avgRate: '$110/hr',
      avgRateNum: 110,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 92,
      advice: 'SaaS companies struggle to find DevOps talent on Upwork. Infrastructure expertise commands top dollar.',
    },
    {
      niche: 'Video Editing for E-commerce',
      requiredSkills: ['Video Editing', 'Motion Graphics', 'After Effects', 'Premiere Pro', 'E-commerce', 'Product Photography', 'Social Media'],
      minMatch: 2,
      avgRate: '$55/hr',
      avgRateNum: 55,
      competitionLevel: 'medium',
      demandTrend: 'rising',
      baseScore: 74,
      advice: 'Product videos drive conversions. Specialize in product demos and TikTok-style commerce content.',
    },
    {
      niche: 'AR/VR for Architecture',
      requiredSkills: ['AR', 'VR', 'Unity', '3D Modeling', 'Unreal Engine', 'AutoCAD', 'SketchUp'],
      minMatch: 2,
      avgRate: '$95/hr',
      avgRateNum: 95,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 90,
      advice: 'Only ~50 freelancers combine AR + Architecture on Upwork. Position yourself in this blue ocean.',
    },
    {
      niche: 'LLM/AI Automation for Business',
      requiredSkills: ['AI', 'LLM', 'GPT', 'Python', 'Automation', 'API', 'Prompt Engineering', 'NLP', 'Fine-tuning'],
      minMatch: 2,
      avgRate: '$130/hr',
      avgRateNum: 130,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 96,
      advice: 'Every company wants AI automation. You\'re early — build case studies now before this niche gets crowded.',
    },
    {
      niche: 'Cybersecurity for Startups',
      requiredSkills: ['Cybersecurity', 'Penetration Testing', 'AWS', 'DevOps', 'Python', 'Linux', 'Compliance'],
      minMatch: 2,
      avgRate: '$115/hr',
      avgRateNum: 115,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 93,
      advice: 'Startups raising Series A need SOC2. Position as the "startup security guy" who makes compliance painless.',
    },
    {
      niche: 'Blockchain for Supply Chain',
      requiredSkills: ['Blockchain', 'Solidity', 'Web3', 'Node.js', 'Python', 'Smart Contracts', 'Supply Chain'],
      minMatch: 2,
      avgRate: '$110/hr',
      avgRateNum: 110,
      competitionLevel: 'low',
      demandTrend: 'stable',
      baseScore: 82,
      advice: 'Enterprise blockchain for supply chain is real (unlike most crypto). Target logistics and manufacturing.',
    },
    {
      niche: 'Full-Stack for PropTech',
      requiredSkills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'Python', 'Real Estate'],
      minMatch: 2,
      avgRate: '$90/hr',
      avgRateNum: 90,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 85,
      advice: 'PropTech is underserved on Upwork. Real estate platforms need full-stack devs who understand the domain.',
    },
    {
      niche: 'Data Engineering for Analytics',
      requiredSkills: ['Data Engineering', 'Python', 'SQL', 'AWS', 'Spark', 'Airflow', 'dbt', 'ETL', 'BigQuery'],
      minMatch: 2,
      avgRate: '$115/hr',
      avgRateNum: 115,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 91,
      advice: 'Companies are drowning in data but can\'t pipeline it. Data engineers are chronically undersupplied.',
    },
    {
      niche: 'Figma-to-Code Specialist',
      requiredSkills: ['Figma', 'React', 'CSS', 'Tailwind', 'UI/UX', 'TypeScript', 'Next.js', 'Frontend'],
      minMatch: 2,
      avgRate: '$75/hr',
      avgRateNum: 75,
      competitionLevel: 'medium',
      demandTrend: 'rising',
      baseScore: 80,
      advice: 'Pixel-perfect implementation is rare. Designers love devs who nail their vision. Show before/after comparisons.',
    },
    {
      niche: 'Automation/RPA for Small Business',
      requiredSkills: ['Automation', 'RPA', 'Python', 'Zapier', 'Make', 'API', 'Excel', 'Google Sheets'],
      minMatch: 2,
      avgRate: '$70/hr',
      avgRateNum: 70,
      competitionLevel: 'medium',
      demandTrend: 'rising',
      baseScore: 79,
      advice: 'Small businesses will pay $5K to save 20hr/week. Sell outcomes, not hours. "I\'ll save you $50K/year."',
    },
    {
      niche: 'Go/Rust for High-Performance Systems',
      requiredSkills: ['Go', 'Rust', 'Systems Programming', 'Linux', 'Docker', 'Microservices', 'gRPC'],
      minMatch: 2,
      avgRate: '$120/hr',
      avgRateNum: 120,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 89,
      advice: 'Go/Rust devs are scarce on Upwork. Fintech and infrastructure companies will pay top dollar.',
    },
    {
      niche: 'SEO + Content for SaaS',
      requiredSkills: ['SEO', 'Copywriting', 'Content Strategy', 'Digital Marketing', 'Analytics', 'WordPress', 'Technical Writing'],
      minMatch: 2,
      avgRate: '$75/hr',
      avgRateNum: 75,
      competitionLevel: 'medium',
      demandTrend: 'stable',
      baseScore: 77,
      advice: 'SaaS companies need SEO-driven content that converts. Combine technical knowledge with writing chops.',
    },
    {
      niche: 'iOS for Health & Fitness',
      requiredSkills: ['Swift', 'iOS Development', 'HealthKit', 'UI/UX', 'Firebase', 'Core Data'],
      minMatch: 2,
      avgRate: '$100/hr',
      avgRateNum: 100,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 87,
      advice: 'Health apps are exploding. HealthKit + Apple Watch expertise is rare and valuable.',
    },
    {
      niche: 'NLP for Customer Support',
      requiredSkills: ['NLP', 'Python', 'AI', 'LLM', 'Chatbot', 'Machine Learning', 'API'],
      minMatch: 2,
      avgRate: '$110/hr',
      avgRateNum: 110,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 93,
      advice: 'Every company wants AI support bots. Build demos with real metrics (50% ticket reduction) to win clients.',
    },
    {
      niche: 'Power BI/Tableau for Finance',
      requiredSkills: ['Power BI', 'Tableau', 'SQL', 'Excel', 'Data Analysis', 'Python', 'Financial Modeling'],
      minMatch: 2,
      avgRate: '$80/hr',
      avgRateNum: 80,
      competitionLevel: 'medium',
      demandTrend: 'stable',
      baseScore: 75,
      advice: 'CFOs need dashboards yesterday. Combine BI tools with finance domain knowledge for instant credibility.',
    },
    {
      niche: 'Prompt Engineering & AI Strategy',
      requiredSkills: ['Prompt Engineering', 'AI', 'LLM', 'GPT', 'Fine-tuning', 'Python', 'NLP'],
      minMatch: 2,
      avgRate: '$100/hr',
      avgRateNum: 100,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 90,
      advice: 'New category, huge demand. Position as a strategic advisor, not just a prompt writer. Show ROI.',
    },
    {
      niche: 'Vue.js for Internal Tools',
      requiredSkills: ['Vue.js', 'JavaScript', 'Node.js', 'PostgreSQL', 'Tailwind', 'TypeScript'],
      minMatch: 2,
      avgRate: '$75/hr',
      avgRateNum: 75,
      competitionLevel: 'medium',
      demandTrend: 'stable',
      baseScore: 73,
      advice: 'Internal tools are unglamorous but steady. Companies need dashboards and admin panels — Vue excels here.',
    },
    {
      niche: 'Unreal Engine for Automotive',
      requiredSkills: ['Unreal Engine', 'C++', '3D Modeling', 'VR', 'AR', 'Rendering'],
      minMatch: 2,
      avgRate: '$105/hr',
      avgRateNum: 105,
      competitionLevel: 'low',
      demandTrend: 'rising',
      baseScore: 88,
      advice: 'Car manufacturers use Unreal for configurators and virtual showrooms. Tiny talent pool, huge budgets.',
    },
  ];

  // ─── Skill Normalization ────────────────────────────────────────────
  function normalizeSkill(skill) {
    return skill.toLowerCase().replace(/[^a-z0-9+#.]/g, '');
  }

  function skillsMatch(userSkill, requiredSkill) {
    const u = normalizeSkill(userSkill);
    const r = normalizeSkill(requiredSkill);
    if (u === r) return true;
    // Fuzzy aliases
    const aliases = {
      'reactjs': 'react', 'react.js': 'react',
      'nodejs': 'node.js', 'node': 'node.js',
      'vuejs': 'vue.js', 'vue': 'vue.js',
      'angularjs': 'angular',
      'tensorflow': 'machinelearning', 'pytorch': 'machinelearning',
      'artificialintelligence': 'ai',
      'ml': 'machinelearning',
      'ux': 'ui/ux', 'uiux': 'ui/ux', 'uxdesign': 'ui/ux', 'uidesign': 'ui/ux',
      'amazonwebservices': 'aws',
      'gcp': 'cloudarchitecture', 'azure': 'cloudarchitecture',
      'solidity': 'blockchain',
      'chatgpt': 'gpt', 'openai': 'gpt',
      'mobiledev': 'mobiledevelopment', 'mobileapp': 'mobiledevelopment',
      'webdev': 'webdevelopment', 'frontend': 'webdevelopment',
      'gamedev': 'gamedev', 'gamedevelopment': 'gamedev',
      'videoediting': 'videoediting', 'premierepro': 'videoediting',
      'aftereffects': 'motiongraphics',
    };
    const nu = aliases[u] || u;
    const nr = aliases[r] || r;
    return nu === nr || nu.includes(nr) || nr.includes(nu);
  }

  // ─── Core Analysis ──────────────────────────────────────────────────
  function findNiches(profileData) {
    const { skills = [], hourlyRate = 0, totalEarnings = 0 } = profileData;
    const userSkillsLower = skills.map(s => s.toLowerCase());

    const results = [];

    for (const def of NICHE_DEFINITIONS) {
      // Find matching skills
      const matched = [];
      for (const req of def.requiredSkills) {
        for (const userSkill of skills) {
          if (skillsMatch(userSkill, req)) {
            matched.push(userSkill);
            break;
          }
        }
      }

      if (matched.length < def.minMatch) continue;

      // Calculate opportunity score
      const matchRatio = matched.length / def.requiredSkills.length;
      const demandMultiplier = def.demandTrend === 'rising' ? 1.2 : def.demandTrend === 'stable' ? 1.0 : 0.8;
      const competitionMultiplier = def.competitionLevel === 'low' ? 1.3 : def.competitionLevel === 'medium' ? 1.0 : 0.7;
      const rateBonus = def.avgRateNum > hourlyRate ? 1.1 : 0.95;

      // Get demand tier from high-demand skills
      let avgDemand = 5;
      let demandCount = 0;
      for (const m of matched) {
        for (const [hds, tier] of Object.entries(HIGH_DEMAND_SKILLS)) {
          if (skillsMatch(m, hds)) {
            avgDemand += tier;
            demandCount++;
            break;
          }
        }
      }
      if (demandCount > 0) avgDemand = avgDemand / (demandCount + 1);

      // Opportunity score: (demand × rate potential) / competition
      const rawScore = (avgDemand * demandMultiplier * def.avgRateNum * rateBonus * competitionMultiplier * matchRatio) / 10;
      const opportunityScore = Math.min(99, Math.max(1, Math.round(
        def.baseScore * 0.4 + Math.min(rawScore, 100) * 0.4 + matchRatio * 100 * 0.2
      )));

      results.push({
        niche: def.niche,
        matchingSkills: [...new Set(matched)],
        avgRate: def.avgRate,
        competitionLevel: def.competitionLevel,
        demandTrend: def.demandTrend,
        opportunityScore,
        advice: def.advice,
      });
    }

    // Sort by opportunity score descending
    results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return results;
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function renderNicheFinder(profileData, container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    const niches = findNiches(profileData);
    const top5 = niches.slice(0, 5);

    const trendArrow = (trend) => {
      if (trend === 'rising') return '<span class="nf-trend nf-trend--rising">↑ Rising</span>';
      if (trend === 'stable') return '<span class="nf-trend nf-trend--stable">→ Stable</span>';
      return '<span class="nf-trend nf-trend--declining">↓ Declining</span>';
    };

    const competitionMeter = (level) => {
      const levels = { low: 1, medium: 2, high: 3 };
      const val = levels[level] || 2;
      const bars = [1, 2, 3].map(i =>
        `<span class="nf-comp-bar ${i <= val ? 'nf-comp-bar--active nf-comp-bar--' + level : ''}"></span>`
      ).join('');
      return `<div class="nf-comp-meter">
        <span class="nf-comp-label">${level.charAt(0).toUpperCase() + level.slice(1)}</span>
        <div class="nf-comp-bars">${bars}</div>
      </div>`;
    };

    const skillBadges = (skills) =>
      skills.map(s => `<span class="nf-skill-badge">${escapeHtml(s)}</span>`).join('');

    let html = `
      <div class="nf-container">
        <div class="nf-header">
          <h2 class="nf-title">🔍 Your Hidden Niches</h2>
          <p class="nf-subtitle">Underserved markets where your skills command premium rates</p>
        </div>
    `;

    if (top5.length === 0) {
      html += `
        <div class="nf-empty">
          <p>🤔 We couldn't find strong niche matches yet.</p>
          <p>Add more skills to your profile to unlock niche recommendations.</p>
        </div>
      `;
    } else {
      html += '<div class="nf-cards">';
      top5.forEach((n, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '💎';
        html += `
          <div class="nf-card">
            <div class="nf-card-header">
              <div class="nf-card-rank">${medal}</div>
              <div class="nf-card-info">
                <h3 class="nf-card-title">${escapeHtml(n.niche)}</h3>
                <div class="nf-card-meta">
                  <span class="nf-avg-rate">${escapeHtml(n.avgRate)}</span>
                  ${trendArrow(n.demandTrend)}
                </div>
              </div>
              <div class="nf-score-ring">
                <svg viewBox="0 0 40 40" class="nf-score-svg">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
                  <circle cx="20" cy="20" r="17" fill="none" stroke="${scoreColor(n.opportunityScore)}" stroke-width="3"
                    stroke-dasharray="${(n.opportunityScore / 100) * 106.8} 106.8"
                    stroke-linecap="round" transform="rotate(-90 20 20)"/>
                </svg>
                <span class="nf-score-value">${n.opportunityScore}</span>
              </div>
            </div>
            <div class="nf-card-skills">${skillBadges(n.matchingSkills)}</div>
            <div class="nf-card-footer">
              ${competitionMeter(n.competitionLevel)}
            </div>
            <div class="nf-positioning">
              <span class="nf-positioning-label">💡 How to Position:</span>
              <p class="nf-positioning-text">${escapeHtml(n.advice)}</p>
            </div>
          </div>
        `;
      });
      html += '</div>';

      // Pro tip box
      html += `
        <div class="nf-pro-tip">
          <div class="nf-pro-tip-icon">💡</div>
          <div class="nf-pro-tip-content">
            <strong>Pro Tip:</strong> Don't spread thin across all niches. Pick your top-scoring niche,
            rewrite your Upwork title and overview to target it specifically, and build 2-3 portfolio pieces.
            Specialists earn 2-3× more than generalists on Upwork.
          </div>
        </div>
      `;
    }

    if (niches.length > 5) {
      html += `
        <div class="nf-more">
          <p class="nf-more-text">+ ${niches.length - 5} more niches found. Focus on your top matches first.</p>
        </div>
      `;
    }

    html += '</div>';

    // Inject styles + HTML
    if (!document.getElementById('nf-styles')) {
      const style = document.createElement('style');
      style.id = 'nf-styles';
      style.textContent = getNicheFinderCSS();
      document.head.appendChild(style);
    }

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function scoreColor(score) {
    if (score >= 85) return '#22c55e';
    if (score >= 70) return '#eab308';
    return '#f97316';
  }

  // ─── Styles ─────────────────────────────────────────────────────────
  function getNicheFinderCSS() {
    return `
      .nf-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e2e8f0;
        max-width: 720px;
        margin: 0 auto;
      }
      .nf-header {
        margin-bottom: 24px;
      }
      .nf-title {
        font-size: 22px;
        font-weight: 700;
        margin: 0 0 6px 0;
        color: #f8fafc;
      }
      .nf-subtitle {
        font-size: 13px;
        color: #94a3b8;
        margin: 0;
      }
      .nf-cards {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .nf-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 18px;
        transition: border-color 0.2s;
      }
      .nf-card:hover {
        border-color: rgba(255,255,255,0.16);
      }
      .nf-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .nf-card-rank {
        font-size: 24px;
        flex-shrink: 0;
      }
      .nf-card-info {
        flex: 1;
        min-width: 0;
      }
      .nf-card-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: #f1f5f9;
      }
      .nf-card-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
      }
      .nf-avg-rate {
        color: #22c55e;
        font-weight: 600;
      }
      .nf-trend {
        font-size: 12px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 99px;
      }
      .nf-trend--rising {
        background: rgba(34,197,94,0.12);
        color: #4ade80;
      }
      .nf-trend--stable {
        background: rgba(234,179,8,0.12);
        color: #facc15;
      }
      .nf-trend--declining {
        background: rgba(239,68,68,0.12);
        color: #f87171;
      }
      .nf-score-ring {
        position: relative;
        width: 44px;
        height: 44px;
        flex-shrink: 0;
      }
      .nf-score-svg {
        width: 100%;
        height: 100%;
      }
      .nf-score-value {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        color: #f8fafc;
      }
      .nf-card-skills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }
      .nf-skill-badge {
        font-size: 11px;
        padding: 3px 10px;
        border-radius: 99px;
        background: rgba(99,102,241,0.15);
        color: #a5b4fc;
        font-weight: 500;
      }
      .nf-card-footer {
        margin-bottom: 10px;
      }
      .nf-comp-meter {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .nf-comp-label {
        font-size: 11px;
        color: #94a3b8;
        min-width: 55px;
      }
      .nf-comp-bars {
        display: flex;
        gap: 3px;
      }
      .nf-comp-bar {
        width: 24px;
        height: 6px;
        border-radius: 3px;
        background: rgba(255,255,255,0.08);
      }
      .nf-comp-bar--active.nf-comp-bar--low {
        background: #22c55e;
      }
      .nf-comp-bar--active.nf-comp-bar--medium {
        background: #eab308;
      }
      .nf-comp-bar--active.nf-comp-bar--high {
        background: #ef4444;
      }
      .nf-positioning {
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        padding: 10px 12px;
      }
      .nf-positioning-label {
        font-size: 11px;
        font-weight: 600;
        color: #cbd5e1;
      }
      .nf-positioning-text {
        font-size: 12px;
        color: #94a3b8;
        margin: 4px 0 0 0;
        line-height: 1.5;
      }
      .nf-pro-tip {
        display: flex;
        gap: 12px;
        margin-top: 20px;
        padding: 16px;
        background: rgba(99,102,241,0.08);
        border: 1px solid rgba(99,102,241,0.2);
        border-radius: 12px;
      }
      .nf-pro-tip-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      .nf-pro-tip-content {
        font-size: 13px;
        color: #cbd5e1;
        line-height: 1.6;
      }
      .nf-pro-tip-content strong {
        color: #a5b4fc;
      }
      .nf-empty {
        text-align: center;
        padding: 40px 20px;
        color: #64748b;
        font-size: 14px;
      }
      .nf-empty p { margin: 8px 0; }
      .nf-more {
        text-align: center;
        margin-top: 14px;
      }
      .nf-more-text {
        font-size: 12px;
        color: #64748b;
        margin: 0;
      }
    `;
  }

  // ─── Public API ─────────────────────────────────────────────────────
  window.CortexNicheFinder = {
    findNiches,
    renderNicheFinder,
  };
})();
