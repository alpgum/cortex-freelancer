/**
 * [CF-151] Portfolio Competitive Positioning Analysis
 * Adds a "Competitive Positioning" section after portfolio review results.
 * Lets user select a niche, then shows how their portfolio compares to
 * typical portfolios in that niche, identifies missing elements,
 * detects USPs, and suggests differentiators.
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════
   * NICHE DEFINITIONS
   * ══════════════════════════════════════════════ */
  var NICHES = {
    webdev: {
      label: 'Web Development',
      topElements: [
        { name: 'Live project links', weight: 15, keywords: ['live', 'deployed', 'url', 'link', 'website', 'site', 'http', 'www', '.com', '.io'] },
        { name: 'GitHub/code samples', weight: 12, keywords: ['github', 'gitlab', 'bitbucket', 'repo', 'repository', 'code', 'open source', 'source code'] },
        { name: 'Tech stack details', weight: 14, keywords: ['react', 'vue', 'angular', 'node', 'python', 'typescript', 'javascript', 'php', 'laravel', 'django', 'next.js', 'nuxt', 'stack', 'framework', 'built with'] },
        { name: 'Performance metrics', weight: 10, keywords: ['performance', 'speed', 'load time', 'lighthouse', 'core web vitals', 'page speed', 'optimized', 'fast', 'milliseconds', 'seconds'] },
        { name: 'Responsive/mobile demos', weight: 10, keywords: ['responsive', 'mobile', 'mobile-friendly', 'adaptive', 'breakpoint', 'tablet', 'phone'] },
        { name: 'Client testimonials', weight: 12, keywords: ['testimonial', 'review', 'feedback', 'client said', 'recommendation', 'endorsement', 'rating', 'stars'] },
        { name: 'Case studies with outcomes', weight: 14, keywords: ['case study', 'increased', 'improved', 'reduced', 'conversion', 'result', 'outcome', 'roi', 'revenue', 'traffic', '%'] },
        { name: 'Process documentation', weight: 8, keywords: ['process', 'agile', 'sprint', 'workflow', 'methodology', 'approach', 'phase', 'milestone'] },
        { name: 'API/integration work', weight: 5, keywords: ['api', 'integration', 'third-party', 'webhook', 'rest', 'graphql', 'microservice'] },
      ],
      differentiators: [
        'Specialize in a specific framework (React, Vue, etc.) rather than listing everything',
        'Show before/after performance scores (Lighthouse, PageSpeed)',
        'Include animated GIFs or short videos of interactive features',
        'Display code quality badges (test coverage, CI/CD pipeline status)',
        'Highlight migration projects (legacy to modern stack)',
        'Show accessibility compliance (WCAG 2.1 AA) in your projects',
        'Include architecture diagrams for complex projects',
      ],
      benchmarks: { avgItems: 6, avgMetrics: 3, avgTestimonials: 4 },
    },
    design: {
      label: 'UI/UX Design',
      topElements: [
        { name: 'High-fidelity mockups', weight: 15, keywords: ['mockup', 'high-fidelity', 'hi-fi', 'prototype', 'figma', 'sketch', 'adobe xd', 'design', 'visual'] },
        { name: 'User research evidence', weight: 12, keywords: ['user research', 'persona', 'interview', 'survey', 'usability test', 'user testing', 'journey map', 'empathy map'] },
        { name: 'Before/after comparisons', weight: 12, keywords: ['before', 'after', 'redesign', 'improvement', 'transformation', 'old vs new', 'compare'] },
        { name: 'Design system/components', weight: 10, keywords: ['design system', 'component', 'style guide', 'pattern library', 'tokens', 'atomic design'] },
        { name: 'Interactive prototypes', weight: 14, keywords: ['prototype', 'interactive', 'clickable', 'figma link', 'invision', 'principle', 'demo', 'walkthrough'] },
        { name: 'UX metrics & outcomes', weight: 14, keywords: ['conversion', 'task completion', 'user satisfaction', 'nps', 'engagement', 'bounce rate', 'retention', 'usability score', '%', 'increased', 'reduced'] },
        { name: 'Client testimonials', weight: 10, keywords: ['testimonial', 'review', 'feedback', 'client', 'recommendation', 'endorsed'] },
        { name: 'Process walkthrough', weight: 8, keywords: ['process', 'design thinking', 'ideation', 'wireframe', 'iteration', 'workshop', 'discovery', 'define'] },
        { name: 'Responsive design demos', weight: 5, keywords: ['responsive', 'mobile', 'desktop', 'tablet', 'adaptive', 'breakpoint'] },
      ],
      differentiators: [
        'Show your design process from research to final delivery',
        'Include user testing videos or session recordings summaries',
        'Present accessibility-focused design decisions (color contrast, screen reader support)',
        'Showcase micro-interactions and animation details',
        'Display design systems you have built or contributed to',
        'Highlight data-informed design iterations with A/B test results',
        'Show cross-platform design consistency (web, iOS, Android)',
      ],
      benchmarks: { avgItems: 5, avgMetrics: 2, avgTestimonials: 3 },
    },
    writing: {
      label: 'Content Writing',
      topElements: [
        { name: 'Published content samples', weight: 15, keywords: ['published', 'article', 'blog', 'post', 'content', 'copy', 'writing sample', 'link', 'featured'] },
        { name: 'SEO results & rankings', weight: 14, keywords: ['seo', 'ranking', 'search', 'organic', 'traffic', 'keyword', 'serp', 'google', 'page one', 'first page'] },
        { name: 'Content metrics', weight: 14, keywords: ['traffic', 'engagement', 'views', 'shares', 'conversion', 'click', 'open rate', 'read time', 'subscribers', '%', 'increased', 'grew'] },
        { name: 'Client/publication logos', weight: 10, keywords: ['client', 'brand', 'publication', 'magazine', 'outlet', 'featured in', 'published in', 'wrote for'] },
        { name: 'Diverse content types', weight: 10, keywords: ['blog', 'whitepaper', 'email', 'newsletter', 'social media', 'landing page', 'case study', 'ebook', 'guide', 'technical', 'copy'] },
        { name: 'Industry specialization', weight: 12, keywords: ['specialize', 'niche', 'expert', 'industry', 'vertical', 'focus', 'saas', 'fintech', 'health', 'tech', 'b2b', 'b2c'] },
        { name: 'Testimonials', weight: 10, keywords: ['testimonial', 'review', 'feedback', 'recommend', 'client said'] },
        { name: 'Content strategy evidence', weight: 8, keywords: ['strategy', 'editorial calendar', 'content plan', 'funnel', 'pillar', 'topic cluster', 'content audit'] },
        { name: 'Turnaround time mention', weight: 7, keywords: ['turnaround', 'deadline', 'fast', 'quick', 'delivery time', 'on time', 'within'] },
      ],
      differentiators: [
        'Show traffic growth charts for content you have written',
        'Include before/after SEO ranking improvements',
        'Display a variety of content formats (long-form, email, social, ad copy)',
        'Highlight a specific industry niche with deep expertise',
        'Show your editorial process (research, outline, draft, edit)',
        'Include client retention stats (repeat clients, ongoing retainers)',
        'Feature any content that went viral or significantly outperformed',
      ],
      benchmarks: { avgItems: 8, avgMetrics: 3, avgTestimonials: 4 },
    },
    marketing: {
      label: 'Digital Marketing',
      topElements: [
        { name: 'Campaign results & ROI', weight: 16, keywords: ['campaign', 'roi', 'return', 'roas', 'conversion', 'revenue', 'sales', 'cost per', 'cpa', 'cpc', 'ctr', '%', 'increased', 'grew'] },
        { name: 'Platform expertise', weight: 12, keywords: ['google ads', 'facebook', 'meta', 'instagram', 'linkedin', 'tiktok', 'twitter', 'youtube', 'ppc', 'paid social', 'sem'] },
        { name: 'Analytics dashboards', weight: 10, keywords: ['analytics', 'dashboard', 'report', 'google analytics', 'data', 'metrics', 'kpi', 'tracking'] },
        { name: 'Growth metrics', weight: 14, keywords: ['growth', 'scale', 'lead', 'pipeline', 'acquisition', 'subscriber', 'follower', 'reach', 'impression', '%', 'x'] },
        { name: 'Strategy documentation', weight: 10, keywords: ['strategy', 'plan', 'funnel', 'audience', 'persona', 'targeting', 'segmentation', 'positioning'] },
        { name: 'A/B test results', weight: 10, keywords: ['a/b test', 'ab test', 'split test', 'experiment', 'variant', 'control', 'winner', 'optimization'] },
        { name: 'Client testimonials', weight: 10, keywords: ['testimonial', 'review', 'feedback', 'recommendation', 'client'] },
        { name: 'Industry certifications', weight: 8, keywords: ['certified', 'certification', 'google certified', 'hubspot', 'meta blueprint', 'facebook blueprint'] },
        { name: 'Budget management', weight: 10, keywords: ['budget', 'spend', 'ad spend', 'managed', 'monthly', 'quarterly', 'annual', '$'] },
      ],
      differentiators: [
        'Show specific ROAS and CPA numbers from campaigns you managed',
        'Include screenshots of analytics dashboards (anonymized if needed)',
        'Highlight budget sizes you have managed ($10K/mo, $100K/mo, etc.)',
        'Show funnel optimization with stage-by-stage conversion improvements',
        'Display platform certifications and badges',
        'Present case studies with clear before/after metrics',
        'Demonstrate multi-channel attribution and cross-platform strategy',
      ],
      benchmarks: { avgItems: 5, avgMetrics: 5, avgTestimonials: 3 },
    },
    data: {
      label: 'Data Science & Analytics',
      topElements: [
        { name: 'Technical methodology', weight: 14, keywords: ['model', 'algorithm', 'regression', 'classification', 'clustering', 'neural network', 'deep learning', 'ml', 'machine learning', 'nlp'] },
        { name: 'Tools & technologies', weight: 12, keywords: ['python', 'r', 'sql', 'tableau', 'power bi', 'tensorflow', 'pytorch', 'pandas', 'spark', 'aws', 'gcp', 'azure', 'jupyter'] },
        { name: 'Business impact metrics', weight: 16, keywords: ['saved', 'increased', 'reduced', 'improved', 'revenue', 'cost', 'efficiency', 'accuracy', '%', '$', 'roi', 'prediction'] },
        { name: 'Data visualization samples', weight: 12, keywords: ['dashboard', 'visualization', 'chart', 'graph', 'plot', 'tableau', 'power bi', 'report', 'interactive'] },
        { name: 'Dataset scale', weight: 10, keywords: ['records', 'rows', 'terabyte', 'gigabyte', 'million', 'billion', 'big data', 'large scale', 'petabyte'] },
        { name: 'Accuracy/performance metrics', weight: 12, keywords: ['accuracy', 'precision', 'recall', 'f1', 'auc', 'rmse', 'mae', 'r-squared', 'performance', 'benchmark'] },
        { name: 'Code repositories', weight: 8, keywords: ['github', 'gitlab', 'notebook', 'jupyter', 'kaggle', 'repo', 'code', 'open source'] },
        { name: 'Client testimonials', weight: 8, keywords: ['testimonial', 'review', 'feedback', 'recommendation', 'client'] },
        { name: 'Domain expertise', weight: 8, keywords: ['finance', 'healthcare', 'retail', 'ecommerce', 'logistics', 'manufacturing', 'insurance', 'energy', 'industry'] },
      ],
      differentiators: [
        'Show interactive data visualizations or dashboard screenshots',
        'Include model performance comparisons (your model vs baseline)',
        'Display Kaggle rankings or competition results',
        'Highlight the business decision impact of your analysis',
        'Show data pipeline architecture diagrams',
        'Present accuracy improvement over previous solutions',
        'Include code samples or Jupyter notebook previews',
      ],
      benchmarks: { avgItems: 4, avgMetrics: 4, avgTestimonials: 2 },
    },
    mobile: {
      label: 'Mobile Development',
      topElements: [
        { name: 'App Store/Play Store links', weight: 15, keywords: ['app store', 'play store', 'google play', 'apple', 'download', 'install', 'available on', 'published'] },
        { name: 'Screenshots & demos', weight: 14, keywords: ['screenshot', 'demo', 'video', 'walkthrough', 'preview', 'recording', 'gif', 'animation'] },
        { name: 'Technology stack', weight: 12, keywords: ['swift', 'kotlin', 'react native', 'flutter', 'ionic', 'xamarin', 'ios', 'android', 'cross-platform', 'native'] },
        { name: 'Download/user metrics', weight: 14, keywords: ['download', 'user', 'install', 'active', 'retention', 'rating', 'review', 'star', 'dau', 'mau'] },
        { name: 'Performance & UX focus', weight: 10, keywords: ['performance', 'smooth', 'fast', 'animation', 'gesture', 'offline', 'push notification', 'accessibility'] },
        { name: 'API integration work', weight: 8, keywords: ['api', 'backend', 'rest', 'graphql', 'firebase', 'integration', 'real-time', 'websocket'] },
        { name: 'Client testimonials', weight: 10, keywords: ['testimonial', 'review', 'feedback', 'recommendation', 'client'] },
        { name: 'Design collaboration', weight: 7, keywords: ['design', 'figma', 'ui', 'ux', 'prototype', 'designer', 'collaborated'] },
        { name: 'Testing & CI/CD', weight: 10, keywords: ['test', 'testing', 'ci/cd', 'pipeline', 'unit test', 'integration test', 'automated', 'testflight', 'beta'] },
      ],
      differentiators: [
        'Include App Store ratings and review highlights',
        'Show real device screenshots across multiple device sizes',
        'Highlight complex features (offline sync, push notifications, in-app purchases)',
        'Display app performance metrics (startup time, memory usage)',
        'Show the app evolution through multiple versions',
        'Include download numbers or active user counts',
        'Demonstrate both iOS and Android delivery capabilities',
      ],
      benchmarks: { avgItems: 4, avgMetrics: 3, avgTestimonials: 3 },
    },
    devops: {
      label: 'DevOps & Cloud',
      topElements: [
        { name: 'Infrastructure scale', weight: 14, keywords: ['server', 'instance', 'container', 'cluster', 'node', 'scale', 'uptime', 'availability', '99.9', 'sla'] },
        { name: 'Cloud platforms', weight: 14, keywords: ['aws', 'azure', 'gcp', 'google cloud', 'digitalocean', 'heroku', 'cloud', 'serverless', 'lambda'] },
        { name: 'CI/CD pipeline work', weight: 14, keywords: ['ci/cd', 'pipeline', 'jenkins', 'github actions', 'gitlab ci', 'circleci', 'automated', 'deployment', 'continuous'] },
        { name: 'Cost optimization results', weight: 12, keywords: ['cost', 'saved', 'reduced', 'optimization', 'budget', 'efficiency', '%', '$', 'billing'] },
        { name: 'Containerization', weight: 10, keywords: ['docker', 'kubernetes', 'k8s', 'container', 'orchestration', 'helm', 'ecs', 'fargate'] },
        { name: 'Monitoring & observability', weight: 10, keywords: ['monitoring', 'alert', 'logging', 'datadog', 'prometheus', 'grafana', 'cloudwatch', 'observability', 'apm'] },
        { name: 'Security practices', weight: 10, keywords: ['security', 'compliance', 'encryption', 'iam', 'ssl', 'firewall', 'vulnerability', 'audit', 'soc2', 'hipaa'] },
        { name: 'Certifications', weight: 8, keywords: ['certified', 'certification', 'aws certified', 'azure certified', 'cka', 'ckad', 'solutions architect'] },
        { name: 'Automation impact', weight: 8, keywords: ['automation', 'terraform', 'ansible', 'puppet', 'chef', 'infrastructure as code', 'iac', 'cloudformation'] },
      ],
      differentiators: [
        'Show architecture diagrams of infrastructure you have built',
        'Include uptime and reliability SLA numbers you have achieved',
        'Display cost savings from cloud optimization projects',
        'Highlight zero-downtime deployment strategies implemented',
        'Show incident response time improvements',
        'Present infrastructure-as-code examples (Terraform, CloudFormation)',
        'Include cloud certification badges prominently',
      ],
      benchmarks: { avgItems: 4, avgMetrics: 4, avgTestimonials: 2 },
    },
  };

  /* ══════════════════════════════════════════════
   * USP DETECTION PATTERNS
   * ══════════════════════════════════════════════ */
  var USP_PATTERNS = [
    { pattern: /(\d+)\+?\s*years?\s*(of\s+)?experience/i, label: 'Experienced Professional', template: function (m) { return m[1] + '+ years of hands-on experience'; } },
    { pattern: /(\d+)\+?\s*(projects?|clients?|companies)/i, label: 'Proven Track Record', template: function (m) { return 'Worked on ' + m[1] + '+ ' + m[2].toLowerCase(); } },
    { pattern: /top\s*(rated|seller|freelancer|\d+%)/i, label: 'Top-Rated Freelancer', template: function () { return 'Recognized as a top performer on the platform'; } },
    { pattern: /(fortune\s*\d+|enterprise|startup|funded)/i, label: 'Notable Client Portfolio', template: function (m) { return 'Experience with ' + m[1] + ' companies'; } },
    { pattern: /(certified|certification|accredited)/i, label: 'Certified Professional', template: function () { return 'Holds relevant industry certifications'; } },
    { pattern: /(unique|proprietary|custom|framework|methodology)/i, label: 'Custom Methodology', template: function () { return 'Uses a refined personal methodology or framework'; } },
    { pattern: /(fast|quick|turnaround|24.?hour|same.?day|rapid)/i, label: 'Fast Delivery', template: function () { return 'Known for quick turnaround times'; } },
    { pattern: /(speciali[sz]e|expert|focus|niche|dedicated)/i, label: 'Specialist Focus', template: function () { return 'Deep specialization rather than generalist approach'; } },
    { pattern: /(team|agency|staff|designers|developers)/i, label: 'Team Capability', template: function () { return 'Can scale with team support for larger projects'; } },
    { pattern: /(award|winner|recognition|featured|published)/i, label: 'Industry Recognition', template: function () { return 'Has received industry awards or recognition'; } },
    { pattern: /(open.?source|contributor|maintainer|community)/i, label: 'Open Source Contributor', template: function () { return 'Active in the open source community'; } },
    { pattern: /(money.?back|guarantee|satisfaction|warranty)/i, label: 'Risk-Free Guarantee', template: function () { return 'Offers satisfaction guarantees to reduce client risk'; } },
  ];

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */
  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ══════════════════════════════════════════════
   * ANALYSIS ENGINE
   * ══════════════════════════════════════════════ */
  function analyzeCompetitivePosition(nicheKey, desc) {
    var niche = NICHES[nicheKey];
    if (!niche || !desc) return null;

    var text = desc.toLowerCase();
    var result = {
      niche: niche.label,
      nicheKey: nicheKey,
      elementsPresent: [],
      elementsMissing: [],
      uspDetected: [],
      suggestedDifferentiators: [],
      recommendedAdditions: [],
      competitiveScore: 0,
    };

    // Check which top elements are present/missing
    var totalWeight = 0;
    var earnedWeight = 0;

    niche.topElements.forEach(function (elem) {
      totalWeight += elem.weight;
      var found = elem.keywords.some(function (kw) { return text.indexOf(kw) !== -1; });
      var matchedKeywords = elem.keywords.filter(function (kw) { return text.indexOf(kw) !== -1; });

      if (found) {
        earnedWeight += elem.weight;
        result.elementsPresent.push({
          name: elem.name,
          weight: elem.weight,
          matchedKeywords: matchedKeywords,
        });
      } else {
        result.elementsMissing.push({
          name: elem.name,
          weight: elem.weight,
          importance: elem.weight >= 12 ? 'critical' : elem.weight >= 8 ? 'important' : 'nice_to_have',
        });
      }
    });

    result.competitiveScore = Math.round((earnedWeight / totalWeight) * 100);

    // Detect USPs
    USP_PATTERNS.forEach(function (usp) {
      var match = desc.match(usp.pattern);
      if (match) {
        result.uspDetected.push({
          label: usp.label,
          detail: usp.template(match),
        });
      }
    });

    // Pick differentiators (ones not already reflected in portfolio)
    niche.differentiators.forEach(function (diff) {
      var diffLower = diff.toLowerCase();
      // Check if the differentiator topic is NOT already covered
      var alreadyCovered = result.elementsPresent.some(function (ep) {
        return ep.matchedKeywords.some(function (kw) { return diffLower.indexOf(kw) !== -1; });
      });
      if (!alreadyCovered) {
        result.suggestedDifferentiators.push(diff);
      }
    });

    // Limit to top 4 differentiators
    result.suggestedDifferentiators = result.suggestedDifferentiators.slice(0, 4);

    // Generate recommended additions based on missing critical elements
    result.elementsMissing.forEach(function (missing) {
      if (missing.importance === 'critical') {
        result.recommendedAdditions.push({
          element: missing.name,
          priority: 'high',
          reason: 'Top freelancers in ' + niche.label + ' almost always include ' + missing.name.toLowerCase() + '. This is a significant gap.',
        });
      } else if (missing.importance === 'important') {
        result.recommendedAdditions.push({
          element: missing.name,
          priority: 'medium',
          reason: 'Many successful ' + niche.label + ' freelancers highlight ' + missing.name.toLowerCase() + ' to build credibility.',
        });
      }
    });

    // Sort by priority
    var prioOrder = { high: 0, medium: 1, low: 2 };
    result.recommendedAdditions.sort(function (a, b) {
      return (prioOrder[a.priority] || 2) - (prioOrder[b.priority] || 2);
    });

    return result;
  }

  /* ══════════════════════════════════════════════
   * RENDER SECTION
   * ══════════════════════════════════════════════ */
  function renderSection(nicheKey) {
    var existing = document.getElementById('portfolio-competitive-analysis');
    if (existing) existing.remove();

    var desc = '';
    var descEl = document.getElementById('portfolio-desc');
    if (descEl) desc = descEl.value.trim();

    var urlEl = document.getElementById('portfolio-url');
    if (urlEl && urlEl.value.trim()) {
      desc = urlEl.value.trim() + ' ' + desc;
    }

    // Build container
    var section = document.createElement('div');
    section.id = 'portfolio-competitive-analysis';
    section.style.cssText = 'max-width:700px;margin:0 auto 2rem;padding:0 1.5rem;';

    var html = '';

    // Card wrapper
    html += '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius);overflow:hidden;">';

    // Header
    html += '<div style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:1.25rem 1.5rem;color:#fff;">';
    html += '<h3 style="font-size:1rem;font-weight:800;margin:0;">Competitive Positioning</h3>';
    html += '<p style="font-size:.8rem;opacity:.85;margin:.25rem 0 0;">See how your portfolio stacks up against top freelancers</p>';
    html += '</div>';

    // Niche selector
    html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';
    html += '<label style="display:block;font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.4rem;">Select Your Niche</label>';
    html += '<select id="competitive-niche-select" style="width:100%;padding:.65rem .9rem;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-sm);font-size:.88rem;color:var(--text);background:var(--bg3);font-family:inherit;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url(\'data:image/svg+xml;charset=utf-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%23888%22 fill=%22none%22 stroke-width=%221.5%22/></svg>\');background-repeat:no-repeat;background-position:right 12px center;padding-right:2rem;">';
    html += '<option value="">-- Choose your niche --</option>';
    Object.keys(NICHES).forEach(function (key) {
      var selected = key === nicheKey ? ' selected' : '';
      html += '<option value="' + key + '"' + selected + '>' + esc(NICHES[key].label) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    // Analysis results (only if niche is selected and desc exists)
    if (nicheKey && desc) {
      var analysis = analyzeCompetitivePosition(nicheKey, desc);

      if (analysis) {
        // Competitive Score
        var scoreColor = analysis.competitiveScore >= 70 ? 'var(--green)' : analysis.competitiveScore >= 40 ? 'var(--yellow, #ffcc00)' : 'var(--red)';
        var scoreBg = analysis.competitiveScore >= 70 ? 'rgba(0,255,136,.1)' : analysis.competitiveScore >= 40 ? 'rgba(255,204,0,.1)' : 'rgba(255,68,102,.1)';
        var scoreLabel = analysis.competitiveScore >= 70 ? 'Strong Position' : analysis.competitiveScore >= 40 ? 'Room to Improve' : 'Needs Attention';

        html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;">';
        html += '<div style="display:inline-flex;align-items:center;justify-content:center;flex-direction:column;width:110px;height:110px;border-radius:50%;border:3px solid ' + scoreColor + ';margin-bottom:.75rem;">';
        html += '<span style="font-size:2rem;font-weight:900;color:' + scoreColor + ';line-height:1;">' + analysis.competitiveScore + '</span>';
        html += '<span style="font-size:.6rem;font-weight:700;color:' + scoreColor + ';text-transform:uppercase;letter-spacing:.5px;opacity:.8;">/ 100</span>';
        html += '</div>';
        html += '<div style="font-size:.95rem;font-weight:700;color:' + scoreColor + ';">' + scoreLabel + '</div>';
        html += '<div style="font-size:.8rem;color:var(--text2);margin-top:.25rem;">vs typical ' + esc(analysis.niche) + ' freelancer portfolio</div>';
        html += '</div>';

        // Elements Present (what you have)
        if (analysis.elementsPresent.length > 0) {
          html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';
          html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;">';
          html += '<span style="font-size:.85rem;font-weight:700;color:var(--text);">What You Have</span>';
          html += '<span style="font-size:.65rem;padding:2px 8px;border-radius:100px;background:rgba(0,255,136,.1);color:var(--green);font-weight:700;">' + analysis.elementsPresent.length + ' elements</span>';
          html += '</div>';

          analysis.elementsPresent.forEach(function (ep) {
            html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;">';
            html += '<div style="width:22px;height:22px;border-radius:50%;background:rgba(0,255,136,.12);color:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.75rem;font-weight:800;">&#10003;</div>';
            html += '<span style="font-size:.82rem;color:var(--text);flex:1;">' + esc(ep.name) + '</span>';
            html += '<span style="font-size:.65rem;padding:2px 6px;border-radius:100px;background:var(--bg3);color:var(--text3);">+' + ep.weight + ' pts</span>';
            html += '</div>';
          });
          html += '</div>';
        }

        // Elements Missing (what top freelancers have)
        if (analysis.elementsMissing.length > 0) {
          html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';
          html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;">';
          html += '<span style="font-size:.85rem;font-weight:700;color:var(--text);">Missing Elements</span>';
          html += '<span style="font-size:.65rem;padding:2px 8px;border-radius:100px;background:rgba(255,68,102,.1);color:var(--red);font-weight:700;">' + analysis.elementsMissing.length + ' gaps</span>';
          html += '</div>';

          analysis.elementsMissing.forEach(function (em) {
            var impColor = em.importance === 'critical' ? 'var(--red)' : em.importance === 'important' ? 'var(--orange)' : 'var(--text3)';
            var impBg = em.importance === 'critical' ? 'rgba(255,68,102,.08)' : em.importance === 'important' ? 'rgba(255,136,68,.08)' : 'var(--bg3)';
            var impLabel = em.importance === 'critical' ? 'Critical' : em.importance === 'important' ? 'Important' : 'Nice to Have';

            html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;">';
            html += '<div style="width:22px;height:22px;border-radius:50%;background:rgba(255,68,102,.12);color:var(--red);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.75rem;font-weight:800;">&#10007;</div>';
            html += '<span style="font-size:.82rem;color:var(--text2);flex:1;">' + esc(em.name) + '</span>';
            html += '<span style="font-size:.6rem;padding:2px 8px;border-radius:100px;background:' + impBg + ';color:' + impColor + ';font-weight:700;text-transform:uppercase;letter-spacing:.3px;">' + impLabel + '</span>';
            html += '</div>';
          });
          html += '</div>';
        }

        // USPs Detected
        if (analysis.uspDetected.length > 0) {
          html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';
          html += '<div style="font-size:.85rem;font-weight:700;color:var(--text);margin-bottom:.75rem;">Your Unique Selling Points</div>';

          analysis.uspDetected.forEach(function (usp) {
            html += '<div style="background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:var(--radius-sm);padding:.65rem 1rem;margin-bottom:.5rem;display:flex;align-items:flex-start;gap:.6rem;">';
            html += '<span style="font-size:.65rem;font-weight:800;padding:3px 8px;border-radius:100px;background:rgba(99,102,241,.15);color:#a5b4fc;white-space:nowrap;flex-shrink:0;text-transform:uppercase;letter-spacing:.3px;">USP</span>';
            html += '<div>';
            html += '<div style="font-size:.82rem;font-weight:600;color:var(--text);">' + esc(usp.label) + '</div>';
            html += '<div style="font-size:.76rem;color:var(--text2);margin-top:.15rem;">' + esc(usp.detail) + '</div>';
            html += '</div></div>';
          });
          html += '</div>';
        } else {
          html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';
          html += '<div style="font-size:.85rem;font-weight:700;color:var(--text);margin-bottom:.5rem;">Your Unique Selling Points</div>';
          html += '<div style="background:rgba(255,204,0,.05);border:1px solid rgba(255,204,0,.12);border-radius:var(--radius-sm);padding:.75rem 1rem;">';
          html += '<div style="font-size:.8rem;color:var(--text2);line-height:1.5;">No clear USPs detected. Consider adding differentiators like years of experience, number of projects completed, notable clients, certifications, or a unique methodology.</div>';
          html += '</div></div>';
        }

        // Suggested Differentiators
        if (analysis.suggestedDifferentiators.length > 0) {
          html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';
          html += '<div style="font-size:.85rem;font-weight:700;color:var(--text);margin-bottom:.75rem;">Suggested Differentiators</div>';
          html += '<div style="font-size:.76rem;color:var(--text3);margin-bottom:.6rem;">Ways to stand out from other ' + esc(analysis.niche) + ' freelancers:</div>';

          analysis.suggestedDifferentiators.forEach(function (diff, idx) {
            html += '<div style="display:flex;align-items:flex-start;gap:.6rem;padding:.5rem .75rem;margin-bottom:.4rem;background:var(--bg3);border-radius:var(--radius-sm);">';
            html += '<span style="font-size:.7rem;font-weight:800;color:var(--orange);min-width:18px;">' + (idx + 1) + '.</span>';
            html += '<span style="font-size:.8rem;color:var(--text2);line-height:1.5;">' + esc(diff) + '</span>';
            html += '</div>';
          });
          html += '</div>';
        }

        // Recommended Portfolio Additions
        if (analysis.recommendedAdditions.length > 0) {
          html += '<div style="padding:1.25rem 1.5rem;">';
          html += '<div style="font-size:.85rem;font-weight:700;color:var(--text);margin-bottom:.75rem;">Recommended Portfolio Additions</div>';

          analysis.recommendedAdditions.forEach(function (rec) {
            var prioBorderColor = rec.priority === 'high' ? 'var(--red)' : 'var(--orange)';
            var prioBadgeColor = rec.priority === 'high' ? 'var(--red)' : 'var(--orange)';
            var prioBadgeBg = rec.priority === 'high' ? 'rgba(255,68,102,.1)' : 'rgba(255,136,68,.1)';

            html += '<div style="border-left:2px solid ' + prioBorderColor + ';border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:.65rem 1rem;margin-bottom:.5rem;background:rgba(255,255,255,.02);">';
            html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;">';
            html += '<span style="font-size:.82rem;font-weight:700;color:var(--text);">' + esc(rec.element) + '</span>';
            html += '<span style="font-size:.55rem;font-weight:800;padding:2px 6px;border-radius:100px;background:' + prioBadgeBg + ';color:' + prioBadgeColor + ';text-transform:uppercase;letter-spacing:.5px;">' + rec.priority + '</span>';
            html += '</div>';
            html += '<div style="font-size:.78rem;color:var(--text2);line-height:1.5;">' + esc(rec.reason) + '</div>';
            html += '</div>';
          });
          html += '</div>';
        }

        // GTM event
        if (window.dataLayer) {
          dataLayer.push({
            event: 'tool_used',
            tool_name: 'portfolio-review',
            action: 'competitive_analysis',
            niche: nicheKey,
            competitive_score: analysis.competitiveScore,
            elements_present: analysis.elementsPresent.length,
            elements_missing: analysis.elementsMissing.length,
            usps_detected: analysis.uspDetected.length,
          });
        }
      }
    } else if (nicheKey && !desc) {
      html += '<div style="padding:1.5rem;text-align:center;color:var(--text3);font-size:.85rem;">';
      html += 'Run the portfolio analysis above first, then select a niche to see your competitive positioning.';
      html += '</div>';
    } else {
      html += '<div style="padding:1.5rem;text-align:center;color:var(--text3);font-size:.85rem;">';
      html += 'Select your niche above to see how your portfolio compares to top freelancers in that category.';
      html += '</div>';
    }

    html += '</div>'; // end card

    section.innerHTML = html;

    // Insert after portfolio-ai-feedback if present, otherwise after #results
    var aiFeedback = document.getElementById('portfolio-ai-feedback');
    var results = document.getElementById('results');
    var insertAfter = aiFeedback || results;
    if (insertAfter) {
      insertAfter.parentNode.insertBefore(section, insertAfter.nextSibling);
    }

    // Bind niche selector change event
    var select = document.getElementById('competitive-niche-select');
    if (select) {
      select.addEventListener('change', function () {
        renderSection(this.value);
      });
    }
  }

  /* ══════════════════════════════════════════════
   * HOOK INTO PORTFOLIO ANALYSIS
   * ══════════════════════════════════════════════ */
  function hookIntoAnalysis() {
    // Wrap renderResults to trigger our section
    var origRenderResults = window.renderResults;
    if (typeof origRenderResults === 'function') {
      window.renderResults = function (score, passed, failed) {
        origRenderResults(score, passed, failed);
        // Render with no niche selected (shows prompt to choose)
        setTimeout(function () { renderSection(''); }, 150);
      };
    }

    // Observe the results section
    var results = document.getElementById('results');
    if (results) {
      var observer = new MutationObserver(function () {
        if (results.classList.contains('show') && !document.getElementById('portfolio-competitive-analysis')) {
          setTimeout(function () { renderSection(''); }, 250);
        }
      });
      observer.observe(results, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookIntoAnalysis);
  } else {
    hookIntoAnalysis();
  }

})();
