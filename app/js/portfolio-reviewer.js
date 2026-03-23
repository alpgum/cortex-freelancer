/**
 * CortexPortfolioReviewer - [UW-013]
 * Analyzes freelancer portfolio and provides actionable improvement suggestions.
 */
(function () {
  'use strict';

  /* ── Constants ── */
  const PORTFOLIO_TYPES = [
    'Case Study',
    'Before/After',
    'Screenshot',
    'Testimonial Visual',
    'Process Walkthrough',
  ];

  const SKILL_SUGGESTIONS = {
    // Common Upwork skills → specific showcase ideas
    'JavaScript':       'an interactive dashboard or calculator with polished UI',
    'React':            'a responsive SPA with state management and API integration',
    'Node.js':          'a REST API demo with auth, docs page, and live endpoint',
    'Python':           'a data pipeline or automation script with clear before/after metrics',
    'Web Design':       'a landing page redesign showing wireframe → mockup → live site',
    'WordPress':        'a custom theme or plugin with admin panel screenshots',
    'Mobile App':       'app store screenshots with feature walkthrough',
    'Data Analysis':    'a dashboard turning raw data into actionable insights',
    'UI/UX Design':     'a case study showing user research → wireframes → final design',
    'Graphic Design':   'a brand identity package with logo, colors, and collateral',
    'SEO':              'a traffic growth case study with before/after analytics',
    'Copywriting':      'a sales page with conversion metrics or A/B test results',
    'Video Editing':    'a showreel or before/after edit comparison',
    'Machine Learning': 'a model demo with clear problem statement, approach, and results',
    'PHP':              'a custom web app or plugin with clean architecture',
    'AWS':              'an architecture diagram with cost optimization results',
    'TypeScript':       'a type-safe library or API client with documentation',
  };

  const DEFAULT_SUGGESTION = 'a polished demo project with clear problem/solution narrative';

  /* ── CSS ── */
  const STYLES = `
    .cpr-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e0e0e0;
      max-width: 720px;
    }

    .cpr-header {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
      color: #fff;
    }

    /* Score Card */
    .cpr-score-card {
      background: #1e1e2e;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      border: 1px solid #2a2a3e;
    }
    .cpr-score-ring {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      font-weight: 800;
      flex-shrink: 0;
    }
    .cpr-score-ring.critical { background: rgba(239,68,68,.15); color: #ef4444; border: 3px solid #ef4444; }
    .cpr-score-ring.needs-work { background: rgba(245,158,11,.15); color: #f59e0b; border: 3px solid #f59e0b; }
    .cpr-score-ring.good { background: rgba(34,197,94,.15); color: #22c55e; border: 3px solid #22c55e; }
    .cpr-score-ring.strong { background: rgba(59,130,246,.15); color: #3b82f6; border: 3px solid #3b82f6; }

    .cpr-score-detail h3 { margin: 0 0 .35rem; font-size: 1.1rem; color: #fff; }
    .cpr-score-detail p  { margin: 0; font-size: .875rem; color: #a0a0b8; line-height: 1.45; }

    /* Checklist */
    .cpr-checklist {
      background: #1e1e2e;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.25rem;
      border: 1px solid #2a2a3e;
    }
    .cpr-checklist h4 { margin: 0 0 .75rem; font-size: .95rem; color: #fff; }
    .cpr-check-item {
      display: flex;
      align-items: center;
      gap: .5rem;
      padding: .35rem 0;
      font-size: .875rem;
    }
    .cpr-check-item .pass { color: #22c55e; }
    .cpr-check-item .fail { color: #ef4444; }
    .cpr-check-item span:last-child { color: #c0c0d4; }

    /* Action Plan */
    .cpr-action-plan {
      background: #1e1e2e;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
      border: 1px solid #2a2a3e;
    }
    .cpr-action-plan h4 { margin: 0 0 1rem; font-size: 1.05rem; color: #fff; }

    .cpr-plan-item {
      background: #161624;
      border-radius: 8px;
      padding: 1rem 1.15rem;
      margin-bottom: .75rem;
      border-left: 3px solid #6366f1;
    }
    .cpr-plan-item:last-child { margin-bottom: 0; }
    .cpr-plan-item .cpr-plan-skill {
      font-size: .75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #818cf8;
      margin-bottom: .3rem;
    }
    .cpr-plan-item .cpr-plan-idea {
      font-size: .95rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: .3rem;
    }
    .cpr-plan-item .cpr-plan-desc {
      font-size: .825rem;
      color: #a0a0b8;
      line-height: 1.45;
      margin-bottom: .35rem;
    }
    .cpr-plan-item .cpr-plan-meta {
      font-size: .75rem;
      color: #6b6b80;
    }

    /* Existing Item Cards */
    .cpr-item-cards { margin-top: 1.25rem; }
    .cpr-item-cards h4 { margin: 0 0 .75rem; font-size: 1.05rem; color: #fff; }

    .cpr-item-card {
      background: #1e1e2e;
      border-radius: 10px;
      padding: 1rem 1.15rem;
      margin-bottom: .65rem;
      border: 1px solid #2a2a3e;
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }
    .cpr-item-thumb {
      width: 56px;
      height: 56px;
      border-radius: 8px;
      background: #2a2a3e;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      overflow: hidden;
    }
    .cpr-item-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }
    .cpr-item-info h5 { margin: 0 0 .25rem; font-size: .9rem; color: #fff; }
    .cpr-item-info p  { margin: 0; font-size: .8rem; color: #a0a0b8; line-height: 1.4; }
    .cpr-item-tag {
      display: inline-block;
      font-size: .7rem;
      padding: .15rem .45rem;
      border-radius: 4px;
      margin-top: .35rem;
    }
    .cpr-item-tag.ok   { background: rgba(34,197,94,.12); color: #22c55e; }
    .cpr-item-tag.warn { background: rgba(245,158,11,.12); color: #f59e0b; }

    /* Stat callout */
    .cpr-stat-callout {
      background: linear-gradient(135deg, rgba(99,102,241,.12), rgba(168,85,247,.12));
      border: 1px solid rgba(99,102,241,.25);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.25rem;
      font-size: .875rem;
      color: #c4b5fd;
      line-height: 1.5;
    }
    .cpr-stat-callout strong { color: #a78bfa; }
  `;

  /* ── Analysis Engine ── */

  function analyzePortfolio(profileData) {
    const portfolio = profileData.portfolio || [];
    const skills = profileData.skills || [];
    const title = profileData.title || '';
    const totalEarnings = profileData.totalEarnings || 0;

    const count = portfolio.length;

    // Count attributes
    const withImages = portfolio.filter(p => p.image).length;
    const withDescriptions = portfolio.filter(p => p.description).length;
    const withLinks = portfolio.filter(p => p.link).length;

    // Skill coverage: how many of the user's skills are represented in portfolio titles/descriptions
    const portfolioText = portfolio.map(p => `${p.title || ''} ${p.description || ''}`).join(' ').toLowerCase();
    const coveredSkills = skills.filter(s => portfolioText.includes(s.toLowerCase()));
    const skillCoverage = skills.length > 0 ? coveredSkills.length / Math.min(skills.length, 5) : 0;

    // Variety: unique "types" detected by keywords
    const typeKeywords = {
      'case study': /case.?study|analysis|research/i,
      'screenshot': /screenshot|screen|capture|preview/i,
      'before/after': /before|after|redesign|revamp/i,
      'demo': /demo|prototype|interactive|live/i,
      'documentation': /doc|guide|tutorial|readme/i,
    };
    const detectedTypes = new Set();
    portfolio.forEach(p => {
      const text = `${p.title || ''} ${p.description || ''}`;
      Object.entries(typeKeywords).forEach(([type, rx]) => {
        if (rx.test(text)) detectedTypes.add(type);
      });
      detectedTypes.add('project'); // every item is at least a project
    });
    const variety = count > 0 ? Math.min(detectedTypes.size / 3, 1) : 0;

    // Score calculation (0-10)
    let score = 0;
    // Count (0-3 pts)
    if (count === 0) score += 0;
    else if (count <= 2) score += 1;
    else if (count <= 5) score += 2;
    else score += 3;

    // Images (0-2 pts)
    score += count > 0 ? (withImages / count) * 2 : 0;

    // Descriptions (0-2 pts)
    score += count > 0 ? (withDescriptions / count) * 2 : 0;

    // Skill coverage (0-2 pts)
    score += skillCoverage * 2;

    // Variety (0-1 pt)
    score += variety;

    score = Math.round(Math.min(score, 10) * 10) / 10;

    // Tier
    let tier, tierLabel, recommendation;
    if (score <= 2) {
      tier = 'critical';
      tierLabel = 'Critical';
      recommendation = 'Your portfolio needs immediate attention. Even one item dramatically improves your visibility.';
    } else if (score <= 4.5) {
      tier = 'needs-work';
      tierLabel = 'Needs Work';
      recommendation = 'You have a foundation, but adding more items with descriptions and images will significantly boost your profile.';
    } else if (score <= 7) {
      tier = 'good';
      tierLabel = 'Good';
      recommendation = 'Solid portfolio. Focus on filling skill gaps and adding case-study depth to stand out.';
    } else {
      tier = 'strong';
      tierLabel = 'Strong';
      recommendation = 'Great portfolio! Fine-tune with testimonials, metrics, and keep it fresh with recent work.';
    }

    return {
      count,
      withImages,
      withDescriptions,
      withLinks,
      skills,
      coveredSkills,
      uncoveredSkills: skills.filter(s => !coveredSkills.includes(s)),
      variety: detectedTypes.size,
      score,
      tier,
      tierLabel,
      recommendation,
      portfolio,
      title,
      totalEarnings,
    };
  }

  function generateActionPlan(analysis) {
    const items = [];
    const topSkills = analysis.skills.slice(0, 5);
    const uncovered = analysis.uncoveredSkills.slice(0, 3);
    const covered = analysis.coveredSkills.slice(0, 2);

    // Prioritize uncovered skills
    const planSkills = [...uncovered, ...covered].slice(0, 5);

    // If no skills at all, use generic suggestions
    const fallbackSkills = planSkills.length > 0 ? planSkills : ['Primary Skill', 'Secondary Skill', 'Technical Writing'];

    const typeRotation = [...PORTFOLIO_TYPES];
    const timeEstimates = ['2-3 hours', '1-2 hours', '3-4 hours', '1 hour', '2-3 hours'];

    fallbackSkills.forEach((skill, i) => {
      const type = typeRotation[i % typeRotation.length];
      const suggestion = SKILL_SUGGESTIONS[skill] || DEFAULT_SUGGESTION;
      const isUncovered = analysis.uncoveredSkills.includes(skill);

      items.push({
        skill,
        type,
        idea: `${type}: ${skill} showcase`,
        description: `Create ${suggestion}. Format as a ${type.toLowerCase()} to demonstrate real-world impact.`,
        descriptionTemplate: `"I built [project name] to solve [problem]. Using ${skill}, I [approach]. The result: [metric/outcome]. Technologies: [stack]."`,
        time: timeEstimates[i % timeEstimates.length],
        priority: isUncovered ? 'high' : 'normal',
      });
    });

    return items;
  }

  /* ── Renderer ── */

  function renderPortfolioReview(profileData, container) {
    if (!container) return;

    // Inject styles once
    if (!document.getElementById('cpr-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'cpr-styles';
      styleEl.textContent = STYLES;
      document.head.appendChild(styleEl);
    }

    const analysis = analyzePortfolio(profileData);
    const plan = generateActionPlan(analysis);

    let html = '<div class="cpr-container">';

    // Header
    html += '<div class="cpr-header">🎨 Portfolio Review</div>';

    // Zero-portfolio callout
    if (analysis.count === 0) {
      html += `<div class="cpr-stat-callout">
        <strong>📊 Did you know?</strong> Adding just 1 portfolio item increases your hire rate by <strong>9×</strong> (Upwork data).
        Even a simple screenshot with a description makes a massive difference.
      </div>`;
    }

    // Score Card
    html += `<div class="cpr-score-card">
      <div class="cpr-score-ring ${analysis.tier}">${analysis.score}</div>
      <div class="cpr-score-detail">
        <h3>Portfolio Score: ${analysis.tierLabel}</h3>
        <p>${analysis.recommendation}</p>
      </div>
    </div>`;

    // Checklist
    const checks = [
      { pass: analysis.count > 0, label: `Has portfolio items (${analysis.count})` },
      { pass: analysis.withImages > 0, label: `Has images (${analysis.withImages}/${analysis.count || 0})` },
      { pass: analysis.withDescriptions > 0, label: `Has descriptions (${analysis.withDescriptions}/${analysis.count || 0})` },
      { pass: analysis.withLinks > 0, label: `Has links (${analysis.withLinks}/${analysis.count || 0})` },
      { pass: analysis.coveredSkills.length > 0, label: `Covers listed skills (${analysis.coveredSkills.length}/${analysis.skills.length})` },
      { pass: analysis.variety >= 2, label: `Shows variety (${analysis.variety} type${analysis.variety !== 1 ? 's' : ''})` },
    ];

    html += '<div class="cpr-checklist"><h4>📋 Portfolio Checklist</h4>';
    checks.forEach(c => {
      const icon = c.pass ? '✅' : '❌';
      const cls = c.pass ? 'pass' : 'fail';
      html += `<div class="cpr-check-item"><span class="${cls}">${icon}</span><span>${c.label}</span></div>`;
    });
    html += '</div>';

    // Action Plan
    html += '<div class="cpr-action-plan"><h4>🚀 Build Your Portfolio — Action Plan</h4>';
    plan.forEach((item, i) => {
      const priorityBadge = item.priority === 'high'
        ? ' <span style="color:#f59e0b;font-size:.7rem;font-weight:600;">● HIGH PRIORITY</span>'
        : '';
      html += `<div class="cpr-plan-item">
        <div class="cpr-plan-skill">${item.skill}${priorityBadge}</div>
        <div class="cpr-plan-idea">${i + 1}. ${item.idea}</div>
        <div class="cpr-plan-desc">${item.description}</div>
        <div class="cpr-plan-desc" style="font-style:italic;color:#8080a0;">Template: ${item.descriptionTemplate}</div>
        <div class="cpr-plan-meta">⏱ Est. ${item.time} · ${item.type}</div>
      </div>`;
    });
    html += '</div>';

    // Existing portfolio item review cards
    if (analysis.portfolio.length > 0) {
      html += '<div class="cpr-item-cards"><h4>📂 Your Current Portfolio Items</h4>';
      analysis.portfolio.forEach(item => {
        const hasImage = !!item.image;
        const hasDesc = !!item.description;
        const thumbContent = hasImage
          ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || '')}">`
          : '📄';

        const tags = [];
        if (hasImage) tags.push('<span class="cpr-item-tag ok">Has Image</span>');
        else tags.push('<span class="cpr-item-tag warn">Needs Image</span>');
        if (hasDesc) tags.push('<span class="cpr-item-tag ok">Has Description</span>');
        else tags.push('<span class="cpr-item-tag warn">Add Description</span>');
        if (item.link) tags.push('<span class="cpr-item-tag ok">Has Link</span>');

        html += `<div class="cpr-item-card">
          <div class="cpr-item-thumb">${thumbContent}</div>
          <div class="cpr-item-info">
            <h5>${escapeHtml(item.title || 'Untitled')}</h5>
            <p>${hasDesc ? escapeHtml(truncate(item.description, 120)) : '<em style="color:#6b6b80;">No description — add context about the project, your role, and outcomes.</em>'}</p>
            ${tags.join(' ')}
          </div>
        </div>`;
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    return analysis;
  }

  /* ── Helpers ── */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  /* ── Public API ── */

  window.CortexPortfolioReviewer = {
    analyzePortfolio,
    generateActionPlan,
    renderPortfolioReview,
  };
})();
