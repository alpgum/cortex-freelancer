/**
 * [CF-063] Niche Opportunity Finder
 * Identify underserved niches with high demand and low competition.
 * Surfaces the best freelance niches ranked by opportunity score,
 * with skill-gap analysis and quick-win recommendations.
 *
 * Exposed on window.CortexFreelancer.nicheOpportunityFinder
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Mock Niche Data (30+ niches) ──────────────────────────────────
  // demandScore      : 1-100 (higher = more demand)
  // competitionLevel : 1-100 (higher = more saturated)
  // avgBudget        : average project budget in USD
  // growthRate       : decimal multiplier (0.25 = 25% YoY growth)
  // jobsPerMonth     : estimated monthly postings
  // avgProposals     : average proposals per job posting
  // skillsRequired   : array of skills needed
  // entryBarrier     : 'low' | 'medium' | 'high'
  // timeToFirstClient: estimated days to land first client
  var NICHE_DATA = [
    {
      id: 'ai-chatbot-dev',
      name: 'AI Chatbot Development',
      category: 'AI & Machine Learning',
      demandScore: 88,
      competitionLevel: 42,
      avgBudget: 4500,
      growthRate: 0.62,
      jobsPerMonth: 820,
      avgProposals: 18,
      skillsRequired: ['Python', 'LLM APIs', 'NLP', 'Dialogflow', 'Rasa'],
      entryBarrier: 'medium',
      timeToFirstClient: 14
    },
    {
      id: 'prompt-engineering',
      name: 'Prompt Engineering',
      category: 'AI & Machine Learning',
      demandScore: 92,
      competitionLevel: 35,
      avgBudget: 3000,
      growthRate: 0.85,
      jobsPerMonth: 1100,
      avgProposals: 22,
      skillsRequired: ['GPT-4', 'Claude', 'Prompt Design', 'Few-shot Learning', 'Chain-of-Thought'],
      entryBarrier: 'low',
      timeToFirstClient: 7
    },
    {
      id: 'llm-fine-tuning',
      name: 'LLM Fine-Tuning',
      category: 'AI & Machine Learning',
      demandScore: 78,
      competitionLevel: 22,
      avgBudget: 8500,
      growthRate: 0.74,
      jobsPerMonth: 340,
      avgProposals: 8,
      skillsRequired: ['Python', 'PyTorch', 'Hugging Face', 'LoRA/QLoRA', 'Data Curation'],
      entryBarrier: 'high',
      timeToFirstClient: 28
    },
    {
      id: 'webflow-dev',
      name: 'Webflow Development',
      category: 'No-Code / Low-Code',
      demandScore: 74,
      competitionLevel: 45,
      avgBudget: 2800,
      growthRate: 0.30,
      jobsPerMonth: 680,
      avgProposals: 25,
      skillsRequired: ['Webflow', 'CSS', 'JavaScript', 'CMS Setup', 'Responsive Design'],
      entryBarrier: 'low',
      timeToFirstClient: 10
    },
    {
      id: 'framer-sites',
      name: 'Framer Sites',
      category: 'No-Code / Low-Code',
      demandScore: 68,
      competitionLevel: 28,
      avgBudget: 2200,
      growthRate: 0.55,
      jobsPerMonth: 420,
      avgProposals: 12,
      skillsRequired: ['Framer', 'React Basics', 'Animations', 'CMS', 'Design Systems'],
      entryBarrier: 'low',
      timeToFirstClient: 10
    },
    {
      id: 'notion-consulting',
      name: 'Notion Consulting',
      category: 'No-Code / Low-Code',
      demandScore: 62,
      competitionLevel: 30,
      avgBudget: 1800,
      growthRate: 0.28,
      jobsPerMonth: 510,
      avgProposals: 15,
      skillsRequired: ['Notion', 'Notion API', 'Databases', 'Templates', 'Workflow Design'],
      entryBarrier: 'low',
      timeToFirstClient: 7
    },
    {
      id: 'airtable-automation',
      name: 'Airtable Automation',
      category: 'No-Code / Low-Code',
      demandScore: 58,
      competitionLevel: 25,
      avgBudget: 2000,
      growthRate: 0.22,
      jobsPerMonth: 380,
      avgProposals: 11,
      skillsRequired: ['Airtable', 'Scripting', 'Automations', 'API Integrations', 'Data Modeling'],
      entryBarrier: 'low',
      timeToFirstClient: 9
    },
    {
      id: 'zapier-make-integration',
      name: 'Zapier / Make Integration',
      category: 'Automation',
      demandScore: 72,
      competitionLevel: 38,
      avgBudget: 1500,
      growthRate: 0.20,
      jobsPerMonth: 920,
      avgProposals: 20,
      skillsRequired: ['Zapier', 'Make (Integromat)', 'API Basics', 'Webhooks', 'Logic Flows'],
      entryBarrier: 'low',
      timeToFirstClient: 5
    },
    {
      id: 'supabase-dev',
      name: 'Supabase Development',
      category: 'Backend & Cloud',
      demandScore: 70,
      competitionLevel: 20,
      avgBudget: 3800,
      growthRate: 0.68,
      jobsPerMonth: 290,
      avgProposals: 9,
      skillsRequired: ['Supabase', 'PostgreSQL', 'Auth', 'Edge Functions', 'Row-Level Security'],
      entryBarrier: 'medium',
      timeToFirstClient: 14
    },
    {
      id: 'terraform-consulting',
      name: 'Terraform Consulting',
      category: 'DevOps & Cloud',
      demandScore: 65,
      competitionLevel: 30,
      avgBudget: 6500,
      growthRate: 0.18,
      jobsPerMonth: 310,
      avgProposals: 10,
      skillsRequired: ['Terraform', 'AWS/GCP/Azure', 'IaC', 'State Management', 'Modules'],
      entryBarrier: 'high',
      timeToFirstClient: 21
    },
    {
      id: 'kubernetes',
      name: 'Kubernetes Consulting',
      category: 'DevOps & Cloud',
      demandScore: 68,
      competitionLevel: 35,
      avgBudget: 7200,
      growthRate: 0.15,
      jobsPerMonth: 350,
      avgProposals: 12,
      skillsRequired: ['Kubernetes', 'Helm', 'Docker', 'Networking', 'Monitoring'],
      entryBarrier: 'high',
      timeToFirstClient: 25
    },
    {
      id: 'soc2-compliance',
      name: 'SOC2 Compliance',
      category: 'Security & Compliance',
      demandScore: 60,
      competitionLevel: 15,
      avgBudget: 12000,
      growthRate: 0.32,
      jobsPerMonth: 180,
      avgProposals: 6,
      skillsRequired: ['SOC2 Framework', 'Security Policies', 'Audit Prep', 'Risk Assessment', 'Vanta/Drata'],
      entryBarrier: 'high',
      timeToFirstClient: 30
    },
    {
      id: 'hipaa-compliance',
      name: 'HIPAA Compliance',
      category: 'Security & Compliance',
      demandScore: 55,
      competitionLevel: 12,
      avgBudget: 10000,
      growthRate: 0.18,
      jobsPerMonth: 140,
      avgProposals: 5,
      skillsRequired: ['HIPAA Regulations', 'PHI Handling', 'Risk Analysis', 'BAA Drafting', 'Security Controls'],
      entryBarrier: 'high',
      timeToFirstClient: 35
    },
    {
      id: 'accessibility-auditing',
      name: 'Accessibility Auditing (WCAG)',
      category: 'Quality & Compliance',
      demandScore: 58,
      competitionLevel: 18,
      avgBudget: 3500,
      growthRate: 0.40,
      jobsPerMonth: 260,
      avgProposals: 8,
      skillsRequired: ['WCAG 2.1/2.2', 'Screen Readers', 'ARIA', 'axe-core', 'Reporting'],
      entryBarrier: 'medium',
      timeToFirstClient: 18
    },
    {
      id: 'cro',
      name: 'Conversion Rate Optimization',
      category: 'Marketing & Growth',
      demandScore: 70,
      competitionLevel: 40,
      avgBudget: 4000,
      growthRate: 0.15,
      jobsPerMonth: 520,
      avgProposals: 22,
      skillsRequired: ['A/B Testing', 'Google Optimize', 'Heatmaps', 'Copywriting', 'Analytics'],
      entryBarrier: 'medium',
      timeToFirstClient: 14
    },
    {
      id: 'shopify-headless',
      name: 'Shopify Headless (Hydrogen)',
      category: 'E-Commerce',
      demandScore: 64,
      competitionLevel: 18,
      avgBudget: 8000,
      growthRate: 0.52,
      jobsPerMonth: 190,
      avgProposals: 7,
      skillsRequired: ['Hydrogen', 'Remix', 'Storefront API', 'React', 'GraphQL'],
      entryBarrier: 'high',
      timeToFirstClient: 21
    },
    {
      id: 'rag-pipelines',
      name: 'RAG Pipeline Development',
      category: 'AI & Machine Learning',
      demandScore: 85,
      competitionLevel: 25,
      avgBudget: 6000,
      growthRate: 0.90,
      jobsPerMonth: 480,
      avgProposals: 10,
      skillsRequired: ['LangChain', 'Vector DBs', 'Embeddings', 'Python', 'Chunking Strategies'],
      entryBarrier: 'medium',
      timeToFirstClient: 14
    },
    {
      id: 'ai-voice-agents',
      name: 'AI Voice Agents',
      category: 'AI & Machine Learning',
      demandScore: 76,
      competitionLevel: 16,
      avgBudget: 5500,
      growthRate: 0.78,
      jobsPerMonth: 220,
      avgProposals: 6,
      skillsRequired: ['Twilio', 'ElevenLabs', 'STT/TTS', 'LLM APIs', 'Telephony'],
      entryBarrier: 'medium',
      timeToFirstClient: 18
    },
    {
      id: 'n8n-automation',
      name: 'n8n Workflow Automation',
      category: 'Automation',
      demandScore: 55,
      competitionLevel: 14,
      avgBudget: 2200,
      growthRate: 0.60,
      jobsPerMonth: 210,
      avgProposals: 7,
      skillsRequired: ['n8n', 'JavaScript', 'API Integrations', 'Self-hosting', 'Docker'],
      entryBarrier: 'low',
      timeToFirstClient: 10
    },
    {
      id: 'retool-internal-tools',
      name: 'Retool / Internal Tools',
      category: 'No-Code / Low-Code',
      demandScore: 52,
      competitionLevel: 18,
      avgBudget: 3200,
      growthRate: 0.35,
      jobsPerMonth: 240,
      avgProposals: 9,
      skillsRequired: ['Retool', 'SQL', 'REST APIs', 'JavaScript', 'UI Components'],
      entryBarrier: 'medium',
      timeToFirstClient: 14
    },
    {
      id: 'dbt-analytics',
      name: 'dbt Analytics Engineering',
      category: 'Data & Analytics',
      demandScore: 60,
      competitionLevel: 20,
      avgBudget: 5500,
      growthRate: 0.38,
      jobsPerMonth: 200,
      avgProposals: 8,
      skillsRequired: ['dbt', 'SQL', 'Snowflake/BigQuery', 'Data Modeling', 'Jinja'],
      entryBarrier: 'medium',
      timeToFirstClient: 18
    },
    {
      id: 'stripe-integration',
      name: 'Stripe Payment Integration',
      category: 'E-Commerce',
      demandScore: 66,
      competitionLevel: 42,
      avgBudget: 2500,
      growthRate: 0.12,
      jobsPerMonth: 580,
      avgProposals: 24,
      skillsRequired: ['Stripe API', 'Webhooks', 'Subscriptions', 'Node.js/Python', 'PCI Basics'],
      entryBarrier: 'medium',
      timeToFirstClient: 12
    },
    {
      id: 'playwright-testing',
      name: 'Playwright / E2E Testing',
      category: 'Quality & Compliance',
      demandScore: 54,
      competitionLevel: 22,
      avgBudget: 3000,
      growthRate: 0.42,
      jobsPerMonth: 270,
      avgProposals: 10,
      skillsRequired: ['Playwright', 'TypeScript', 'CI/CD', 'Test Architecture', 'Page Objects'],
      entryBarrier: 'medium',
      timeToFirstClient: 14
    },
    {
      id: 'sanity-cms',
      name: 'Sanity CMS Development',
      category: 'Content & CMS',
      demandScore: 48,
      competitionLevel: 16,
      avgBudget: 3500,
      growthRate: 0.35,
      jobsPerMonth: 180,
      avgProposals: 8,
      skillsRequired: ['Sanity', 'GROQ', 'React', 'Next.js', 'Schema Design'],
      entryBarrier: 'medium',
      timeToFirstClient: 16
    },
    {
      id: 'power-bi-dashboards',
      name: 'Power BI Dashboards',
      category: 'Data & Analytics',
      demandScore: 72,
      competitionLevel: 50,
      avgBudget: 2800,
      growthRate: 0.10,
      jobsPerMonth: 680,
      avgProposals: 28,
      skillsRequired: ['Power BI', 'DAX', 'Data Modeling', 'SQL', 'ETL Basics'],
      entryBarrier: 'medium',
      timeToFirstClient: 10
    },
    {
      id: 'cloudflare-workers',
      name: 'Cloudflare Workers / Edge',
      category: 'Backend & Cloud',
      demandScore: 50,
      competitionLevel: 14,
      avgBudget: 3800,
      growthRate: 0.48,
      jobsPerMonth: 150,
      avgProposals: 6,
      skillsRequired: ['Cloudflare Workers', 'JavaScript', 'KV/D1', 'Wrangler', 'Edge Computing'],
      entryBarrier: 'medium',
      timeToFirstClient: 18
    },
    {
      id: 'ghost-cms',
      name: 'Ghost CMS Setup & Theming',
      category: 'Content & CMS',
      demandScore: 38,
      competitionLevel: 20,
      avgBudget: 1500,
      growthRate: 0.10,
      jobsPerMonth: 160,
      avgProposals: 12,
      skillsRequired: ['Ghost', 'Handlebars', 'CSS', 'Membership Setup', 'API'],
      entryBarrier: 'low',
      timeToFirstClient: 8
    },
    {
      id: 'gdpr-consulting',
      name: 'GDPR / Privacy Consulting',
      category: 'Security & Compliance',
      demandScore: 50,
      competitionLevel: 22,
      avgBudget: 5000,
      growthRate: 0.15,
      jobsPerMonth: 190,
      avgProposals: 9,
      skillsRequired: ['GDPR', 'Privacy Policies', 'Cookie Consent', 'DPA Drafting', 'DPIA'],
      entryBarrier: 'medium',
      timeToFirstClient: 20
    },
    {
      id: 'flutter-dev',
      name: 'Flutter App Development',
      category: 'Mobile',
      demandScore: 70,
      competitionLevel: 48,
      avgBudget: 5000,
      growthRate: 0.18,
      jobsPerMonth: 620,
      avgProposals: 30,
      skillsRequired: ['Flutter', 'Dart', 'Firebase', 'State Management', 'App Store Deploy'],
      entryBarrier: 'medium',
      timeToFirstClient: 16
    },
    {
      id: 'ai-image-generation',
      name: 'AI Image Generation Pipelines',
      category: 'AI & Machine Learning',
      demandScore: 62,
      competitionLevel: 32,
      avgBudget: 3000,
      growthRate: 0.45,
      jobsPerMonth: 350,
      avgProposals: 16,
      skillsRequired: ['Stable Diffusion', 'DALL-E API', 'ComfyUI', 'Python', 'Image Processing'],
      entryBarrier: 'medium',
      timeToFirstClient: 12
    },
    {
      id: 'email-deliverability',
      name: 'Email Deliverability Consulting',
      category: 'Marketing & Growth',
      demandScore: 45,
      competitionLevel: 12,
      avgBudget: 2000,
      growthRate: 0.20,
      jobsPerMonth: 170,
      avgProposals: 6,
      skillsRequired: ['SPF/DKIM/DMARC', 'Warmup Strategies', 'ESP Management', 'DNS', 'Inbox Placement'],
      entryBarrier: 'medium',
      timeToFirstClient: 14
    },
    {
      id: 'technical-seo',
      name: 'Technical SEO Auditing',
      category: 'Marketing & Growth',
      demandScore: 65,
      competitionLevel: 38,
      avgBudget: 2500,
      growthRate: 0.12,
      jobsPerMonth: 480,
      avgProposals: 20,
      skillsRequired: ['Screaming Frog', 'Core Web Vitals', 'Schema Markup', 'Crawl Analysis', 'Log Analysis'],
      entryBarrier: 'medium',
      timeToFirstClient: 12
    },
    {
      id: 'go-microservices',
      name: 'Go Microservices',
      category: 'Backend & Cloud',
      demandScore: 56,
      competitionLevel: 20,
      avgBudget: 6000,
      growthRate: 0.28,
      jobsPerMonth: 220,
      avgProposals: 8,
      skillsRequired: ['Go', 'gRPC', 'Docker', 'PostgreSQL', 'Microservice Patterns'],
      entryBarrier: 'high',
      timeToFirstClient: 22
    },
    {
      id: 'figma-to-code',
      name: 'Figma-to-Code Conversion',
      category: 'Design & Frontend',
      demandScore: 60,
      competitionLevel: 36,
      avgBudget: 1800,
      growthRate: 0.22,
      jobsPerMonth: 540,
      avgProposals: 22,
      skillsRequired: ['Figma', 'HTML/CSS', 'React/Vue', 'Pixel-Perfect', 'Responsive'],
      entryBarrier: 'low',
      timeToFirstClient: 7
    }
  ];

  // ─── Default user skills (simulate a profile) ─────────────────────
  var DEFAULT_USER_SKILLS = [
    'JavaScript', 'Python', 'React', 'Node.js', 'CSS', 'HTML/CSS',
    'API Integrations', 'REST APIs', 'SQL', 'Docker', 'Git'
  ];

  // ─── State ─────────────────────────────────────────────────────────
  var _state = {
    userSkills: DEFAULT_USER_SKILLS.slice(),
    filters: {
      entryBarrier: 'all',    // 'all', 'low', 'medium', 'high'
      minBudget: 0,
      minGrowthRate: 0
    },
    computed: null
  };

  // ─── Core Scoring ──────────────────────────────────────────────────

  /**
   * Calculate raw opportunity score for a niche.
   * Formula: (demandScore * growthRate) / (competitionLevel * avgProposals)
   */
  function _rawOpportunityScore(niche) {
    var denominator = niche.competitionLevel * niche.avgProposals;
    if (denominator === 0) return 0;
    return (niche.demandScore * (1 + niche.growthRate)) / denominator;
  }

  /**
   * Normalize scores to 0-100 range across all niches.
   */
  function _computeAllScores() {
    var raw = [];
    var i;
    for (i = 0; i < NICHE_DATA.length; i++) {
      raw.push({
        niche: NICHE_DATA[i],
        rawScore: _rawOpportunityScore(NICHE_DATA[i])
      });
    }

    var min = Infinity;
    var max = -Infinity;
    for (i = 0; i < raw.length; i++) {
      if (raw[i].rawScore < min) min = raw[i].rawScore;
      if (raw[i].rawScore > max) max = raw[i].rawScore;
    }

    var range = max - min || 1;
    var results = [];
    for (i = 0; i < raw.length; i++) {
      var normalized = Math.round(((raw[i].rawScore - min) / range) * 100);
      results.push({
        niche: raw[i].niche,
        opportunityScore: normalized
      });
    }

    results.sort(function (a, b) { return b.opportunityScore - a.opportunityScore; });
    return results;
  }

  /**
   * Determine scatter-plot quadrant.
   * High demand + Low competition = Star
   * High demand + High competition = Cash Cow
   * Low demand + Low competition = Question Mark
   * Low demand + High competition = Dog
   */
  function _getQuadrant(niche) {
    var highDemand = niche.demandScore >= 55;
    var highComp = niche.competitionLevel >= 30;
    if (highDemand && !highComp) return 'Stars';
    if (highDemand && highComp) return 'Cash Cows';
    if (!highDemand && !highComp) return 'Question Marks';
    return 'Dogs';
  }

  /**
   * Calculate skill overlap between user and niche.
   */
  function _skillOverlap(nicheSkills, userSkills) {
    var matched = [];
    var missing = [];
    for (var i = 0; i < nicheSkills.length; i++) {
      var found = false;
      for (var j = 0; j < userSkills.length; j++) {
        if (nicheSkills[i].toLowerCase() === userSkills[j].toLowerCase()) {
          found = true;
          break;
        }
      }
      if (found) {
        matched.push(nicheSkills[i]);
      } else {
        missing.push(nicheSkills[i]);
      }
    }
    return { matched: matched, missing: missing, ratio: nicheSkills.length > 0 ? matched.length / nicheSkills.length : 0 };
  }

  // ─── Filter Logic ──────────────────────────────────────────────────

  function _applyFilters(scoredNiches) {
    var filtered = [];
    for (var i = 0; i < scoredNiches.length; i++) {
      var entry = scoredNiches[i];
      var n = entry.niche;
      if (_state.filters.entryBarrier !== 'all' && n.entryBarrier !== _state.filters.entryBarrier) continue;
      if (n.avgBudget < _state.filters.minBudget) continue;
      if (n.growthRate < _state.filters.minGrowthRate) continue;
      filtered.push(entry);
    }
    return filtered;
  }

  // ─── Rendering Helpers ─────────────────────────────────────────────

  function _scoreColor(score) {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    if (score >= 25) return '#f97316';
    return '#ef4444';
  }

  function _barrierBadge(barrier) {
    var colors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
    var labels = { low: 'Low Barrier', medium: 'Medium Barrier', high: 'High Barrier' };
    return '<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;' +
      'background:' + (colors[barrier] || '#6b7280') + '22;color:' + (colors[barrier] || '#6b7280') + ';">' +
      (labels[barrier] || barrier) + '</span>';
  }

  function _growthArrow(rate) {
    if (rate >= 0.5) return '<span style="color:#10b981;font-weight:700;">&#9650;&#9650; ' + Math.round(rate * 100) + '%</span>';
    if (rate >= 0.2) return '<span style="color:#10b981;font-weight:600;">&#9650; ' + Math.round(rate * 100) + '%</span>';
    if (rate >= 0.05) return '<span style="color:#f59e0b;">&#9650; ' + Math.round(rate * 100) + '%</span>';
    return '<span style="color:#6b7280;">&#9644; ' + Math.round(rate * 100) + '%</span>';
  }

  function _formatBudget(amount) {
    if (amount >= 1000) return '$' + (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + 'k';
    return '$' + amount;
  }

  function _quadrantColor(q) {
    var map = { 'Stars': '#10b981', 'Cash Cows': '#3b82f6', 'Question Marks': '#f59e0b', 'Dogs': '#ef4444' };
    return map[q] || '#6b7280';
  }

  // ─── Render: Top Opportunities Table ───────────────────────────────

  function _renderTopOpportunities(scored, count) {
    var items = scored.slice(0, count || 10);
    var html = '<div style="margin-bottom:28px;">' +
      '<h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1e293b;">Top ' + items.length + ' Opportunities</h3>';

    for (var i = 0; i < items.length; i++) {
      var entry = items[i];
      var n = entry.niche;
      var score = entry.opportunityScore;
      var quadrant = _getQuadrant(n);
      html += '<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;margin-bottom:8px;' +
        'background:#fff;border:1px solid #e2e8f0;border-radius:10px;transition:box-shadow 0.15s;">' +
        '<div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:' + _scoreColor(score) + '18;' +
        'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:' + _scoreColor(score) + ';">' +
        (i + 1) + '</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;font-size:14px;color:#1e293b;margin-bottom:2px;">' + n.name + '</div>' +
        '<div style="font-size:12px;color:#64748b;">' + n.category + ' &middot; ' + _barrierBadge(n.entryBarrier) +
        ' &middot; <span style="color:' + _quadrantColor(quadrant) + ';font-weight:600;">' + quadrant + '</span></div>' +
        '</div>' +
        '<div style="flex-shrink:0;text-align:right;min-width:120px;">' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:4px;">Opportunity Score</div>' +
        '<div style="position:relative;height:8px;width:100px;background:#e2e8f0;border-radius:4px;overflow:hidden;">' +
        '<div style="position:absolute;left:0;top:0;height:100%;width:' + score + '%;background:' + _scoreColor(score) + ';border-radius:4px;"></div>' +
        '</div>' +
        '<div style="font-size:13px;font-weight:700;color:' + _scoreColor(score) + ';margin-top:2px;">' + score + '/100</div>' +
        '</div>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  // ─── Render: Scatter Plot (Demand vs Competition) ──────────────────

  function _renderScatterPlot(scored) {
    var plotW = 540;
    var plotH = 340;
    var pad = 50;

    var html = '<div style="margin-bottom:28px;">' +
      '<h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1e293b;">Demand vs Competition Matrix</h3>' +
      '<div style="position:relative;width:' + plotW + 'px;height:' + plotH + 'px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:0 auto;">';

    // Quadrant backgrounds
    var halfW = plotW / 2;
    var halfH = plotH / 2;
    html += '<div style="position:absolute;left:0;top:0;width:' + halfW + 'px;height:' + halfH + 'px;background:#fef3c720;"></div>';
    html += '<div style="position:absolute;right:0;top:0;width:' + halfW + 'px;height:' + halfH + 'px;background:#dcfce720;"></div>';
    html += '<div style="position:absolute;left:0;bottom:0;width:' + halfW + 'px;height:' + halfH + 'px;background:#fee2e220;"></div>';
    html += '<div style="position:absolute;right:0;bottom:0;width:' + halfW + 'px;height:' + halfH + 'px;background:#dbeafe20;"></div>';

    // Quadrant labels
    html += '<div style="position:absolute;left:12px;top:8px;font-size:11px;font-weight:700;color:#f59e0b;opacity:0.7;">Question Marks</div>';
    html += '<div style="position:absolute;right:12px;top:8px;font-size:11px;font-weight:700;color:#10b981;opacity:0.7;">&#9733; Stars</div>';
    html += '<div style="position:absolute;left:12px;bottom:8px;font-size:11px;font-weight:700;color:#ef4444;opacity:0.7;">Dogs</div>';
    html += '<div style="position:absolute;right:12px;bottom:8px;font-size:11px;font-weight:700;color:#3b82f6;opacity:0.7;">Cash Cows</div>';

    // Axes labels
    html += '<div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:10px;color:#94a3b8;font-weight:600;">COMPETITION &rarr;</div>';
    html += '<div style="position:absolute;left:4px;top:50%;transform:translateY(-50%) rotate(-90deg);font-size:10px;color:#94a3b8;font-weight:600;">DEMAND &rarr;</div>';

    // Center lines
    html += '<div style="position:absolute;left:' + halfW + 'px;top:0;width:1px;height:100%;background:#cbd5e1;"></div>';
    html += '<div style="position:absolute;top:' + halfH + 'px;left:0;width:100%;height:1px;background:#cbd5e1;"></div>';

    // Plot dots
    for (var i = 0; i < scored.length; i++) {
      var n = scored[i].niche;
      var x = Math.round((n.competitionLevel / 100) * (plotW - pad) + pad / 2);
      var y = Math.round((1 - n.demandScore / 100) * (plotH - pad) + pad / 2);
      var dotColor = _scoreColor(scored[i].opportunityScore);
      var dotSize = Math.max(8, Math.min(18, scored[i].opportunityScore / 6));

      html += '<div title="' + n.name + ' (Score: ' + scored[i].opportunityScore + ')" style="position:absolute;' +
        'left:' + (x - dotSize / 2) + 'px;top:' + (y - dotSize / 2) + 'px;width:' + dotSize + 'px;height:' + dotSize + 'px;' +
        'border-radius:50%;background:' + dotColor + ';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.15);cursor:pointer;' +
        'z-index:2;"></div>';
    }

    html += '</div></div>';
    return html;
  }

  // ─── Render: Niche Detail Cards ────────────────────────────────────

  function _renderNicheCards(scored, count) {
    var items = scored.slice(0, count || 6);
    var html = '<div style="margin-bottom:28px;">' +
      '<h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1e293b;">Niche Details</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">';

    for (var i = 0; i < items.length; i++) {
      var n = items[i].niche;
      var score = items[i].opportunityScore;
      var overlap = _skillOverlap(n.skillsRequired, _state.userSkills);

      html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">' +
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">' +
        '<div><div style="font-weight:700;font-size:15px;color:#1e293b;">' + n.name + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:2px;">' + n.category + '</div></div>' +
        '<div style="background:' + _scoreColor(score) + '15;color:' + _scoreColor(score) + ';font-weight:800;font-size:16px;' +
        'padding:4px 10px;border-radius:8px;">' + score + '</div></div>';

      // Metrics grid
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
        '<div style="padding:8px;background:#f8fafc;border-radius:8px;">' +
        '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Avg Budget</div>' +
        '<div style="font-size:15px;font-weight:700;color:#1e293b;">' + _formatBudget(n.avgBudget) + '</div></div>' +
        '<div style="padding:8px;background:#f8fafc;border-radius:8px;">' +
        '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Growth</div>' +
        '<div style="font-size:14px;">' + _growthArrow(n.growthRate) + '</div></div>' +
        '<div style="padding:8px;background:#f8fafc;border-radius:8px;">' +
        '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Jobs/Month</div>' +
        '<div style="font-size:15px;font-weight:700;color:#1e293b;">' + n.jobsPerMonth + '</div></div>' +
        '<div style="padding:8px;background:#f8fafc;border-radius:8px;">' +
        '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Avg Proposals</div>' +
        '<div style="font-size:15px;font-weight:700;color:#1e293b;">' + n.avgProposals + '</div></div>' +
        '</div>';

      // Entry barrier & time to first client
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        _barrierBadge(n.entryBarrier) +
        '<span style="font-size:12px;color:#64748b;">~' + n.timeToFirstClient + ' days to first client</span></div>';

      // Skills
      html += '<div style="margin-bottom:4px;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Required Skills</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
      for (var s = 0; s < n.skillsRequired.length; s++) {
        var isMatched = overlap.matched.indexOf(n.skillsRequired[s]) !== -1;
        html += '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;' +
          'background:' + (isMatched ? '#dcfce7' : '#fef3c7') + ';color:' + (isMatched ? '#166534' : '#92400e') + ';">' +
          n.skillsRequired[s] + (isMatched ? ' &#10003;' : '') + '</span>';
      }
      html += '</div>';

      // Skill match ratio
      html += '<div style="margin-top:10px;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden;">' +
        '<div style="height:100%;width:' + Math.round(overlap.ratio * 100) + '%;background:#10b981;border-radius:2px;"></div></div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:3px;">Skill match: ' + Math.round(overlap.ratio * 100) + '%</div>';

      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  // ─── Render: Skill Gap Analysis ────────────────────────────────────

  function _renderSkillGapAnalysis(scored) {
    var top10 = scored.slice(0, 10);
    var gapFreq = {};
    var i, j;

    for (i = 0; i < top10.length; i++) {
      var overlap = _skillOverlap(top10[i].niche.skillsRequired, _state.userSkills);
      for (j = 0; j < overlap.missing.length; j++) {
        var skill = overlap.missing[j];
        if (!gapFreq[skill]) {
          gapFreq[skill] = { count: 0, niches: [] };
        }
        gapFreq[skill].count++;
        gapFreq[skill].niches.push(top10[i].niche.name);
      }
    }

    var gapList = [];
    for (var key in gapFreq) {
      if (gapFreq.hasOwnProperty(key)) {
        gapList.push({ skill: key, count: gapFreq[key].count, niches: gapFreq[key].niches });
      }
    }
    gapList.sort(function (a, b) { return b.count - a.count; });

    var html = '<div style="margin-bottom:28px;">' +
      '<h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Skill Gap Analysis</h3>' +
      '<p style="margin:0 0 14px;font-size:13px;color:#64748b;">Skills you need to unlock the top opportunities</p>';

    var maxCount = gapList.length > 0 ? gapList[0].count : 1;
    var displayCount = Math.min(gapList.length, 12);

    for (i = 0; i < displayCount; i++) {
      var g = gapList[i];
      var pct = Math.round((g.count / maxCount) * 100);
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<div style="width:150px;font-size:13px;font-weight:600;color:#1e293b;flex-shrink:0;text-align:right;">' + g.skill + '</div>' +
        '<div style="flex:1;position:relative;height:22px;background:#f1f5f9;border-radius:6px;overflow:hidden;">' +
        '<div style="position:absolute;left:0;top:0;height:100%;width:' + pct + '%;background:linear-gradient(90deg,#818cf8,#6366f1);border-radius:6px;transition:width 0.3s;"></div>' +
        '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:11px;color:#fff;font-weight:600;z-index:1;">' +
        'Unlocks ' + g.count + ' niche' + (g.count !== 1 ? 's' : '') + '</span></div></div>';
    }

    if (gapList.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:#10b981;font-weight:600;">You have all the skills for the top niches!</div>';
    }

    html += '</div>';
    return html;
  }

  // ─── Render: Quick Wins ────────────────────────────────────────────

  function _renderQuickWins(scored) {
    var quickWins = [];
    for (var i = 0; i < scored.length; i++) {
      var overlap = _skillOverlap(scored[i].niche.skillsRequired, _state.userSkills);
      if (overlap.ratio >= 0.4) {
        quickWins.push({ entry: scored[i], overlap: overlap });
      }
    }
    quickWins.sort(function (a, b) {
      var sa = a.entry.opportunityScore * a.overlap.ratio;
      var sb = b.entry.opportunityScore * b.overlap.ratio;
      return sb - sa;
    });

    var display = quickWins.slice(0, 6);
    var html = '<div style="margin-bottom:28px;">' +
      '<h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Quick Wins</h3>' +
      '<p style="margin:0 0 14px;font-size:13px;color:#64748b;">Niches that match your existing skills</p>';

    if (display.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:#64748b;">No strong skill matches found. Consider adding skills from the gap analysis above.</div>';
      html += '</div>';
      return html;
    }

    for (var j = 0; j < display.length; j++) {
      var d = display[j];
      var n = d.entry.niche;
      var score = d.entry.opportunityScore;
      var matchPct = Math.round(d.overlap.ratio * 100);

      html += '<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;margin-bottom:8px;' +
        'background:linear-gradient(135deg,#f0fdf4,#fff);border:1px solid #bbf7d0;border-radius:10px;">' +
        '<div style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:#dcfce7;' +
        'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#166534;">' +
        matchPct + '%</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;font-size:14px;color:#1e293b;">' + n.name + '</div>' +
        '<div style="font-size:12px;color:#64748b;">' +
        _formatBudget(n.avgBudget) + ' avg &middot; ' + _growthArrow(n.growthRate) + ' &middot; ~' + n.timeToFirstClient + 'd to first client</div>' +
        '<div style="font-size:11px;color:#16a34a;margin-top:2px;">You have: ' + d.overlap.matched.join(', ') + '</div>';

      if (d.overlap.missing.length > 0) {
        html += '<div style="font-size:11px;color:#d97706;margin-top:1px;">Need: ' + d.overlap.missing.join(', ') + '</div>';
      }

      html += '</div>' +
        '<div style="flex-shrink:0;text-align:center;">' +
        '<div style="font-size:20px;font-weight:800;color:' + _scoreColor(score) + ';">' + score + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;">Score</div></div></div>';
    }

    html += '</div>';
    return html;
  }

  // ─── Render: Filters ──────────────────────────────────────────────

  function _renderFilters() {
    var f = _state.filters;

    var barrierOpts = [
      { value: 'all', label: 'All Barriers' },
      { value: 'low', label: 'Low Only' },
      { value: 'medium', label: 'Medium Only' },
      { value: 'high', label: 'High Only' }
    ];

    var budgetOpts = [
      { value: 0, label: 'Any Budget' },
      { value: 1000, label: '$1,000+' },
      { value: 2500, label: '$2,500+' },
      { value: 5000, label: '$5,000+' },
      { value: 8000, label: '$8,000+' }
    ];

    var growthOpts = [
      { value: 0, label: 'Any Growth' },
      { value: 0.15, label: '15%+ Growth' },
      { value: 0.30, label: '30%+ Growth' },
      { value: 0.50, label: '50%+ Growth' }
    ];

    var html = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">';

    // Entry barrier filter
    html += '<div><label style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin-bottom:4px;">Entry Barrier</label>' +
      '<select data-filter="entryBarrier" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;color:#334155;background:#fff;cursor:pointer;">';
    for (var i = 0; i < barrierOpts.length; i++) {
      html += '<option value="' + barrierOpts[i].value + '"' + (f.entryBarrier === barrierOpts[i].value ? ' selected' : '') + '>' + barrierOpts[i].label + '</option>';
    }
    html += '</select></div>';

    // Min budget filter
    html += '<div><label style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin-bottom:4px;">Min Budget</label>' +
      '<select data-filter="minBudget" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;color:#334155;background:#fff;cursor:pointer;">';
    for (var j = 0; j < budgetOpts.length; j++) {
      html += '<option value="' + budgetOpts[j].value + '"' + (f.minBudget === budgetOpts[j].value ? ' selected' : '') + '>' + budgetOpts[j].label + '</option>';
    }
    html += '</select></div>';

    // Growth rate filter
    html += '<div><label style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin-bottom:4px;">Growth Rate</label>' +
      '<select data-filter="minGrowthRate" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;color:#334155;background:#fff;cursor:pointer;">';
    for (var k = 0; k < growthOpts.length; k++) {
      html += '<option value="' + growthOpts[k].value + '"' + (f.minGrowthRate === growthOpts[k].value ? ' selected' : '') + '>' + growthOpts[k].label + '</option>';
    }
    html += '</select></div>';

    html += '</div>';
    return html;
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Initialize the module. Optionally pass user skills array.
   * @param {Object} [opts]
   * @param {string[]} [opts.userSkills]
   */
  function init(opts) {
    opts = opts || {};
    if (opts.userSkills && opts.userSkills.length > 0) {
      _state.userSkills = opts.userSkills.slice();
    }
    _state.computed = _computeAllScores();
    return { status: 'initialized', nichesLoaded: NICHE_DATA.length };
  }

  /**
   * Find opportunities with optional filters.
   * @param {Object} [filters]
   * @param {string} [filters.entryBarrier]
   * @param {number} [filters.minBudget]
   * @param {number} [filters.minGrowthRate]
   * @returns {Array} scored and filtered niches
   */
  function findOpportunities(filters) {
    if (!_state.computed) _state.computed = _computeAllScores();

    if (filters) {
      if (filters.entryBarrier !== undefined) _state.filters.entryBarrier = filters.entryBarrier;
      if (filters.minBudget !== undefined) _state.filters.minBudget = filters.minBudget;
      if (filters.minGrowthRate !== undefined) _state.filters.minGrowthRate = filters.minGrowthRate;
    }

    var filtered = _applyFilters(_state.computed);
    return filtered.map(function (entry) {
      return {
        id: entry.niche.id,
        name: entry.niche.name,
        category: entry.niche.category,
        opportunityScore: entry.opportunityScore,
        quadrant: _getQuadrant(entry.niche),
        demandScore: entry.niche.demandScore,
        competitionLevel: entry.niche.competitionLevel,
        avgBudget: entry.niche.avgBudget,
        growthRate: entry.niche.growthRate,
        entryBarrier: entry.niche.entryBarrier
      };
    });
  }

  /**
   * Get full details for a specific niche by ID.
   * @param {string} nicheId
   * @returns {Object|null}
   */
  function getNicheDetails(nicheId) {
    if (!_state.computed) _state.computed = _computeAllScores();

    var found = null;
    for (var i = 0; i < _state.computed.length; i++) {
      if (_state.computed[i].niche.id === nicheId) {
        found = _state.computed[i];
        break;
      }
    }
    if (!found) return null;

    var n = found.niche;
    var overlap = _skillOverlap(n.skillsRequired, _state.userSkills);

    return {
      id: n.id,
      name: n.name,
      category: n.category,
      opportunityScore: found.opportunityScore,
      quadrant: _getQuadrant(n),
      demandScore: n.demandScore,
      competitionLevel: n.competitionLevel,
      avgBudget: n.avgBudget,
      growthRate: n.growthRate,
      jobsPerMonth: n.jobsPerMonth,
      avgProposals: n.avgProposals,
      skillsRequired: n.skillsRequired,
      entryBarrier: n.entryBarrier,
      timeToFirstClient: n.timeToFirstClient,
      skillMatch: {
        matched: overlap.matched,
        missing: overlap.missing,
        ratio: Math.round(overlap.ratio * 100)
      }
    };
  }

  /**
   * Get skill gap analysis for entering top niches.
   * @param {number} [topN] number of top niches to consider (default 10)
   * @returns {Array} sorted skill gaps
   */
  function getSkillGapAnalysis(topN) {
    if (!_state.computed) _state.computed = _computeAllScores();

    topN = topN || 10;
    var topNiches = _state.computed.slice(0, topN);
    var gapFreq = {};

    for (var i = 0; i < topNiches.length; i++) {
      var overlap = _skillOverlap(topNiches[i].niche.skillsRequired, _state.userSkills);
      for (var j = 0; j < overlap.missing.length; j++) {
        var skill = overlap.missing[j];
        if (!gapFreq[skill]) {
          gapFreq[skill] = { skill: skill, count: 0, niches: [] };
        }
        gapFreq[skill].count++;
        gapFreq[skill].niches.push(topNiches[i].niche.name);
      }
    }

    var result = [];
    for (var key in gapFreq) {
      if (gapFreq.hasOwnProperty(key)) {
        result.push(gapFreq[key]);
      }
    }
    result.sort(function (a, b) { return b.count - a.count; });
    return result;
  }

  /**
   * Get top N niches by opportunity score.
   * @param {number} [n] defaults to 5
   * @returns {Array}
   */
  function getTopNiches(n) {
    if (!_state.computed) _state.computed = _computeAllScores();
    n = n || 5;
    return _state.computed.slice(0, n).map(function (entry) {
      return {
        id: entry.niche.id,
        name: entry.niche.name,
        opportunityScore: entry.opportunityScore,
        quadrant: _getQuadrant(entry.niche),
        avgBudget: entry.niche.avgBudget,
        growthRate: entry.niche.growthRate,
        entryBarrier: entry.niche.entryBarrier
      };
    });
  }

  /**
   * Render the full Niche Opportunity Finder HTML.
   * @param {Object} [opts]
   * @param {string} [opts.entryBarrier] filter
   * @param {number} [opts.minBudget] filter
   * @param {number} [opts.minGrowthRate] filter
   * @returns {string} HTML string
   */
  function render(opts) {
    if (!_state.computed) _state.computed = _computeAllScores();

    if (opts) {
      if (opts.entryBarrier !== undefined) _state.filters.entryBarrier = opts.entryBarrier;
      if (opts.minBudget !== undefined) _state.filters.minBudget = opts.minBudget;
      if (opts.minGrowthRate !== undefined) _state.filters.minGrowthRate = opts.minGrowthRate;
    }

    var filtered = _applyFilters(_state.computed);

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1e293b;">';

    // Header
    html += '<div style="margin-bottom:24px;">' +
      '<h2 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;">Niche Opportunity Finder</h2>' +
      '<p style="margin:0;font-size:14px;color:#64748b;">Discover underserved niches with high demand and low competition. ' +
      'Scores are calculated from demand, growth, competition, and proposal density.</p></div>';

    // Summary stats
    var totalNiches = filtered.length;
    var stars = 0;
    var avgScore = 0;
    for (var i = 0; i < filtered.length; i++) {
      avgScore += filtered[i].opportunityScore;
      if (_getQuadrant(filtered[i].niche) === 'Stars') stars++;
    }
    avgScore = totalNiches > 0 ? Math.round(avgScore / totalNiches) : 0;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;">' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:28px;font-weight:800;color:#6366f1;">' + totalNiches + '</div>' +
      '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Niches Analyzed</div></div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:28px;font-weight:800;color:#10b981;">' + stars + '</div>' +
      '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Star Niches</div></div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:28px;font-weight:800;color:#f59e0b;">' + avgScore + '</div>' +
      '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Avg Score</div></div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">' +
      '<div style="font-size:28px;font-weight:800;color:#3b82f6;">' + _state.userSkills.length + '</div>' +
      '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Your Skills</div></div></div>';

    // Filters
    html += _renderFilters();

    // Top opportunities
    html += _renderTopOpportunities(filtered, 10);

    // Scatter plot
    html += _renderScatterPlot(filtered);

    // Niche cards
    html += _renderNicheCards(filtered, 6);

    // Skill gap analysis
    html += _renderSkillGapAnalysis(filtered);

    // Quick wins
    html += _renderQuickWins(filtered);

    html += '</div>';
    return html;
  }

  // ─── Expose Module ─────────────────────────────────────────────────
  window.CortexFreelancer.nicheOpportunityFinder = {
    init: init,
    render: render,
    findOpportunities: findOpportunities,
    getNicheDetails: getNicheDetails,
    getSkillGapAnalysis: getSkillGapAnalysis,
    getTopNiches: getTopNiches
  };

})();
