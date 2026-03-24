/**
 * CortexProposalTemplates — Proposal Templates Library
 * IIFE exposing window.CortexProposalTemplates
 */
(function () {
  'use strict';

  const STYLE_ID = 'cortex-proposal-templates-style';
  let _templates = [];
  let _activeCategory = 'All';
  let _searchQuery = '';

  /* ── CSS (dark theme, inline) ─────────────────────────────── */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .cpt-library { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e4e4e7; }

      /* ── Tabs ── */
      .cpt-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
      .cpt-tab {
        padding: 6px 14px; border-radius: 8px; border: 1px solid #3f3f46;
        background: #27272a; color: #a1a1aa; font-size: 13px; cursor: pointer;
        transition: all .15s;
      }
      .cpt-tab:hover { background: #3f3f46; color: #e4e4e7; }
      .cpt-tab.active { background: #6d28d9; border-color: #7c3aed; color: #fff; }

      /* ── Search ── */
      .cpt-search {
        width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #3f3f46;
        background: #18181b; color: #e4e4e7; font-size: 14px; margin-bottom: 16px;
        outline: none; box-sizing: border-box;
      }
      .cpt-search::placeholder { color: #71717a; }
      .cpt-search:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,.25); }

      /* ── Grid ── */
      .cpt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

      /* ── Card ── */
      .cpt-card {
        background: #1e1e22; border: 1px solid #2e2e33; border-radius: 12px;
        padding: 18px; cursor: pointer; transition: all .15s;
      }
      .cpt-card:hover { border-color: #7c3aed; transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,.4); }
      .cpt-card-cat { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #7c3aed; margin-bottom: 6px; }
      .cpt-card-name { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #f4f4f5; }
      .cpt-card-hook { font-size: 13px; color: #a1a1aa; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

      /* ── Modal Overlay ── */
      .cpt-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        animation: cpt-fadeIn .15s;
      }
      @keyframes cpt-fadeIn { from { opacity: 0; } to { opacity: 1; } }

      .cpt-modal {
        background: #1e1e22; border: 1px solid #3f3f46; border-radius: 14px;
        width: 90%; max-width: 680px; max-height: 85vh; overflow-y: auto;
        padding: 28px; position: relative;
      }
      .cpt-modal-close {
        position: absolute; top: 14px; right: 14px; background: none; border: none;
        color: #a1a1aa; font-size: 22px; cursor: pointer; padding: 4px 8px;
        border-radius: 6px;
      }
      .cpt-modal-close:hover { color: #fff; background: #3f3f46; }
      .cpt-modal-cat { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: #7c3aed; margin-bottom: 4px; }
      .cpt-modal-name { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #f4f4f5; }

      .cpt-section { margin-bottom: 18px; }
      .cpt-section-label { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #71717a; margin-bottom: 6px; }
      .cpt-section-body {
        background: #27272a; border-radius: 8px; padding: 14px;
        font-size: 13.5px; line-height: 1.65; color: #d4d4d8; white-space: pre-wrap;
      }
      .cpt-section-body .cpt-var { color: #a78bfa; font-weight: 500; }

      .cpt-tips { list-style: none; padding: 0; margin: 0; }
      .cpt-tips li { padding: 6px 0 6px 20px; position: relative; font-size: 13px; color: #a1a1aa; }
      .cpt-tips li::before { content: '💡'; position: absolute; left: 0; }

      .cpt-full-template {
        background: #18181b; border: 1px solid #3f3f46; border-radius: 8px;
        padding: 16px; font-size: 13.5px; line-height: 1.7; color: #d4d4d8;
        white-space: pre-wrap; max-height: 300px; overflow-y: auto;
      }

      /* ── Buttons ── */
      .cpt-btn-row { display: flex; gap: 10px; margin-top: 18px; }
      .cpt-btn {
        padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer;
        font-size: 14px; font-weight: 500; transition: all .15s;
      }
      .cpt-btn-primary { background: #7c3aed; color: #fff; }
      .cpt-btn-primary:hover { background: #6d28d9; }
      .cpt-btn-secondary { background: #27272a; color: #e4e4e7; border: 1px solid #3f3f46; }
      .cpt-btn-secondary:hover { background: #3f3f46; }

      .cpt-copied { background: #16a34a !important; }

      .cpt-empty { text-align: center; padding: 40px 20px; color: #71717a; font-size: 14px; }
    `;
    document.head.appendChild(style);
  }

  /* ── Load Templates ────────────────────────────────────────── */
  async function loadTemplates() {
    try {
      const res = await fetch('/data/proposal-templates.json');
      if (!res.ok) throw new Error('Failed to fetch templates: ' + res.status);
      _templates = await res.json();
      return _templates;
    } catch (err) {
      console.error('[CortexProposalTemplates]', err);
      return [];
    }
  }

  /* ── Helpers ───────────────────────────────────────────────── */
  function getCategories() {
    const cats = new Set(_templates.map(t => t.category));
    return ['All', ...Array.from(cats).sort()];
  }

  function highlightVars(text) {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, '<span class="cpt-var">{{$1}}</span>');
  }

  function fillVariables(text, profileData) {
    if (!text || !profileData) return text || '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return profileData[key] !== undefined ? profileData[key] : match;
    });
  }

  function filterTemplates() {
    return _templates.filter(t => {
      const catMatch = _activeCategory === 'All' || t.category === _activeCategory;
      if (!_searchQuery) return catMatch;
      const q = _searchQuery.toLowerCase();
      const textMatch = t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.hook.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }

  /* ── Render: Template Library ──────────────────────────────── */
  function renderTemplateLibrary(profileData, container) {
    injectStyles();
    if (!container) { console.error('[CortexProposalTemplates] No container provided'); return; }

    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) { console.error('[CortexProposalTemplates] Container not found:', container); return; }

    function render() {
      const categories = getCategories();
      const filtered = filterTemplates();

      root.innerHTML = '';
      root.classList.add('cpt-library');

      // Search
      const search = document.createElement('input');
      search.className = 'cpt-search';
      search.type = 'text';
      search.placeholder = '🔍  Search templates by name, category, or keyword…';
      search.value = _searchQuery;
      search.addEventListener('input', function () {
        _searchQuery = this.value;
        render();
      });
      root.appendChild(search);

      // Tabs
      const tabs = document.createElement('div');
      tabs.className = 'cpt-tabs';
      categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cpt-tab' + (cat === _activeCategory ? ' active' : '');
        btn.textContent = cat;
        btn.addEventListener('click', () => { _activeCategory = cat; render(); });
        tabs.appendChild(btn);
      });
      root.appendChild(tabs);

      // Grid
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cpt-empty';
        empty.textContent = 'No templates match your search.';
        root.appendChild(empty);
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'cpt-grid';

      filtered.forEach(tmpl => {
        const card = document.createElement('div');
        card.className = 'cpt-card';
        card.innerHTML = `
          <div class="cpt-card-cat">${tmpl.category}</div>
          <div class="cpt-card-name">${tmpl.name}</div>
          <div class="cpt-card-hook">${tmpl.hook}</div>
        `;
        card.addEventListener('click', () => openPreview(tmpl, profileData));
        grid.appendChild(card);
      });
      root.appendChild(grid);
    }

    // If templates aren't loaded yet, fetch them and render when ready
    if (!_templates || _templates.length === 0) {
      root.innerHTML = '<div class="cpt-empty">Loading templates…</div>';
      loadTemplates().then(() => {
        if (_activeCategory !== 'All' && !_templates.some(t => t.category === _activeCategory)) {
          _activeCategory = 'All';
        }
        render();
      });
      return;
    }

    render();
  }

  /* ── Preview Modal ─────────────────────────────────────────── */
  function openPreview(tmpl, profileData) {
    const overlay = document.createElement('div');
    overlay.className = 'cpt-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    const filledFull = fillVariables(tmpl.fullTemplate, profileData);

    const modal = document.createElement('div');
    modal.className = 'cpt-modal';
    modal.innerHTML = `
      <button class="cpt-modal-close" title="Close">&times;</button>
      <div class="cpt-modal-cat">${tmpl.category}</div>
      <div class="cpt-modal-name">${tmpl.name}</div>

      <div class="cpt-section">
        <div class="cpt-section-label">Hook</div>
        <div class="cpt-section-body">${highlightVars(tmpl.hook)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Experience</div>
        <div class="cpt-section-body">${highlightVars(tmpl.experience)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Approach</div>
        <div class="cpt-section-body">${highlightVars(tmpl.approach)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Timeline</div>
        <div class="cpt-section-body">${highlightVars(tmpl.timeline)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Call to Action</div>
        <div class="cpt-section-body">${highlightVars(tmpl.cta)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Full Template Preview</div>
        <div class="cpt-full-template">${highlightVars(filledFull)}</div>
      </div>

      ${tmpl.tips && tmpl.tips.length ? `
      <div class="cpt-section">
        <div class="cpt-section-label">Tips</div>
        <ul class="cpt-tips">
          ${tmpl.tips.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>` : ''}

      <div class="cpt-btn-row">
        <button class="cpt-btn cpt-btn-primary" id="cpt-copy-btn">📋 Copy Template</button>
        <button class="cpt-btn cpt-btn-secondary" id="cpt-copy-filled-btn">📝 Copy with Variables Filled</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close button
    modal.querySelector('.cpt-modal-close').addEventListener('click', () => overlay.remove());

    // Copy raw template
    modal.querySelector('#cpt-copy-btn').addEventListener('click', function () {
      copyToClipboard(tmpl.fullTemplate, this);
    });

    // Copy filled template
    modal.querySelector('#cpt-copy-filled-btn').addEventListener('click', function () {
      copyToClipboard(filledFull, this);
    });

    // Escape key
    function onKey(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
  }

  /* ── Clipboard ─────────────────────────────────────────────── */
  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      btn.classList.add('cpt-copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('cpt-copied'); }, 1500);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      btn.classList.add('cpt-copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('cpt-copied'); }, 1500);
    });
  }

  /* ── Built-in Template Library (10 categories) ────────────── */
  const BUILTIN_TEMPLATES = {
    'web-dev': {
      category: 'Web Development',
      hook: 'Hi {clientName}, I just read your {projectType} brief and I can tell you need someone who ships clean, performant code — that\'s exactly what I do.',
      experience: 'Over the past {relevantExperience}, I\'ve built and deployed production web apps using modern stacks (React, Vue, Node, Django, Rails). My recent project — {recentProject} — reduced load times by 40% and increased conversions.',
      approach: 'Here\'s how I\'d tackle your project:\n1. Discovery call to nail down requirements and edge cases\n2. Set up CI/CD, staging environment, and shared repo on day one\n3. Weekly demos so you see progress, not just hear about it\n4. Launch with monitoring, error tracking, and a handoff doc',
      timeline: 'Based on the scope described, I estimate {estimatedWeeks} weeks with {hoursPerWeek} hours/week. I\'ll provide a detailed timeline after our discovery call.',
      cta: 'Can we jump on a quick 15-minute call this week? I\'d love to walk through my approach and answer any questions. Looking forward to it!',
      tips: ['Reference a specific detail from the job post', 'Mention a similar tech stack you\'ve used', 'Keep the proposal under 200 words']
    },
    'design': {
      category: 'Design',
      hook: 'Hey {clientName}, your {projectType} project caught my eye — I love working on designs that balance aesthetics with real usability.',
      experience: 'With {relevantExperience} in UI/UX and visual design, I\'ve delivered brand identities, web interfaces, and mobile apps for clients in {industries}. My portfolio showcases projects where user engagement improved by 30%+ after redesign.',
      approach: 'My design process:\n1. Moodboard + style exploration (2–3 directions)\n2. Wireframes for key screens/pages\n3. High-fidelity mockups with 2 revision rounds\n4. Developer-ready assets with a design system doc',
      timeline: 'I\'d scope this at {estimatedWeeks} weeks. First concepts delivered within {firstDeliveryDays} days so you can see the direction early.',
      cta: 'I\'d love to show you a couple of relevant pieces from my portfolio. When works for a quick chat?',
      tips: ['Attach 2–3 portfolio pieces relevant to their industry', 'Mention specific tools (Figma, Sketch, Adobe XD)']
    },
    'writing': {
      category: 'Writing & Content',
      hook: '{clientName}, I noticed your {projectType} needs content that converts — not just fills space. That\'s my specialty.',
      experience: 'I\'ve written {relevantExperience} of high-converting copy for SaaS, e-commerce, and B2B brands. My content has driven measurable results: email sequences with 45% open rates, landing pages with 8%+ conversion.',
      approach: 'My content workflow:\n1. Brand voice audit + competitor content scan\n2. Keyword research and content outline for your approval\n3. First draft within {firstDeliveryDays} days\n4. Two revision rounds included\n5. SEO-optimized final delivery with meta tags',
      timeline: '{estimatedWeeks} weeks for the full scope. I can deliver the first piece within {firstDeliveryDays} days as a trial.',
      cta: 'Want me to write a quick sample paragraph for your brand to show my voice match? No charge — just to prove the fit.',
      tips: ['Offer a free sample to stand out', 'Mention specific content types (blog, email, landing page)']
    },
    'data-entry': {
      category: 'Data Entry',
      hook: 'Hi {clientName}, I saw your {projectType} listing and I\'m confident I can deliver accurate, fast turnaround work.',
      experience: 'With {relevantExperience} of data entry and management, I maintain 99.5%+ accuracy across projects involving spreadsheets, CRM systems, and database migration. I type 80+ WPM and am proficient in Excel, Google Sheets, and Airtable.',
      approach: 'My approach to your project:\n1. Review sample data to understand format and requirements\n2. Set up validation rules to catch errors automatically\n3. Process in batches with quality checks at each stage\n4. Deliver in your preferred format with a summary report',
      timeline: 'I can process approximately {recordsPerDay} records per day. For your scope, estimated completion: {estimatedWeeks} weeks.',
      cta: 'I\'m available to start immediately. Shall I process a small test batch so you can verify my accuracy?',
      tips: ['Emphasize accuracy rate and speed', 'Mention specific tools they use']
    },
    'marketing': {
      category: 'Marketing',
      hook: '{clientName}, your {projectType} brief resonates with me — I\'ve driven growth for similar brands and I\'d love to do the same for yours.',
      experience: 'In {relevantExperience}, I\'ve managed six-figure ad budgets across Meta, Google, and TikTok. My campaigns have delivered {bestResult} — I focus on ROAS, not vanity metrics.',
      approach: 'Here\'s my growth framework for your project:\n1. Audit current channels and identify quick wins\n2. Build targeting personas from your customer data\n3. Launch test campaigns with 3–5 creative variations\n4. Optimize weekly based on conversion data, not impressions\n5. Monthly report with actionable insights',
      timeline: 'Initial audit and strategy: week 1. First campaigns live by week 2. Optimization cycles ongoing for {estimatedWeeks} weeks.',
      cta: 'I can prepare a free mini-audit of your current marketing presence. Interested?',
      tips: ['Include specific ROAS or CAC numbers', 'Mention platforms relevant to their market']
    },
    'consulting': {
      category: 'Consulting',
      hook: '{clientName}, your {projectType} challenge is exactly the kind of problem I help companies solve — and I have a framework for it.',
      experience: 'With {relevantExperience} consulting for {industries}, I\'ve helped companies streamline operations, reduce costs by up to 30%, and implement scalable processes. My approach is hands-on, not slide-deck theater.',
      approach: 'My engagement model:\n1. Stakeholder interviews to map the real problem (not just symptoms)\n2. Data analysis and benchmarking against industry standards\n3. Actionable recommendation deck with prioritized roadmap\n4. Implementation support for the first 30 days',
      timeline: 'Discovery phase: {firstDeliveryDays} days. Full recommendation delivery: {estimatedWeeks} weeks.',
      cta: 'Let\'s schedule a 20-minute discovery call — I\'ll come prepared with initial observations. No obligation.',
      tips: ['Frame yourself as a partner, not a vendor', 'Show you understand their industry']
    },
    'mobile': {
      category: 'Mobile Development',
      hook: 'Hi {clientName}, your {projectType} app concept is exciting — I build mobile experiences that users actually want to keep on their home screen.',
      experience: 'I\'ve shipped {relevantExperience} of iOS and Android apps, from MVPs to apps with 100K+ downloads. My recent work includes {recentProject}, built with {techStack}.',
      approach: 'My mobile dev process:\n1. Requirements workshop + user flow mapping\n2. UI prototype in Figma for early validation\n3. Agile sprints with TestFlight/internal builds every 2 weeks\n4. App Store optimization and submission\n5. 30-day post-launch bug support included',
      timeline: 'MVP: {estimatedWeeks} weeks. I\'ll provide a sprint-by-sprint breakdown after requirements review.',
      cta: 'I\'d love to show you a walkthrough of a similar app I built. When\'s a good time for a quick screen share?',
      tips: ['Specify platform experience (iOS/Android/cross-platform)', 'Mention app store experience']
    },
    'devops': {
      category: 'DevOps & Infrastructure',
      hook: '{clientName}, I see your {projectType} needs solid infrastructure — I specialize in making systems reliable, scalable, and cost-efficient.',
      experience: 'With {relevantExperience} in DevOps and cloud infrastructure (AWS, GCP, Azure), I\'ve built CI/CD pipelines, managed Kubernetes clusters, and cut cloud costs by 40%+ for multiple clients.',
      approach: 'My infrastructure approach:\n1. Audit current setup: architecture, costs, bottlenecks\n2. Design target architecture with IaC (Terraform/Pulumi)\n3. Implement incrementally — zero-downtime migration\n4. Set up monitoring, alerting, and runbooks\n5. Knowledge transfer and documentation',
      timeline: 'Audit: {firstDeliveryDays} days. Full implementation: {estimatedWeeks} weeks with rollback plan at each stage.',
      cta: 'I can start with a free infrastructure audit report. Want me to take a look?',
      tips: ['Mention specific cloud certifications', 'Emphasize security and cost optimization']
    },
    'qa': {
      category: 'QA & Testing',
      hook: 'Hi {clientName}, quality assurance isn\'t just about finding bugs — it\'s about building confidence in your release cycle. That\'s what I bring to {projectType}.',
      experience: 'I have {relevantExperience} of QA experience spanning manual testing, automation (Selenium, Cypress, Playwright), and performance testing. I\'ve caught critical bugs before launch for {industries} companies.',
      approach: 'My QA strategy:\n1. Review requirements and create comprehensive test plan\n2. Build test cases covering happy paths, edge cases, and regression\n3. Automate critical flows for CI/CD integration\n4. Performance and load testing for key endpoints\n5. Detailed bug reports with reproduction steps and severity ratings',
      timeline: 'Test plan: {firstDeliveryDays} days. Full test suite: {estimatedWeeks} weeks. Ongoing regression: as needed.',
      cta: 'I can review your current test coverage and identify the biggest risk areas — free of charge. Interested?',
      tips: ['Mention specific testing frameworks', 'Highlight experience with their tech stack']
    },
    'pm': {
      category: 'Project Management',
      hook: '{clientName}, I can see your {projectType} needs someone who keeps teams aligned and deliverables on track — that\'s my bread and butter.',
      experience: 'With {relevantExperience} managing software projects, I\'ve led cross-functional teams of 5–20 people, delivered projects on time and under budget, and use {pmTools} daily.',
      approach: 'My PM framework:\n1. Kickoff meeting to align on scope, milestones, and success criteria\n2. Set up project tracking (Jira/Asana/Linear) with clear ownership\n3. Daily standups, weekly status reports, biweekly stakeholder demos\n4. Risk register updated weekly with mitigation plans\n5. Retrospective at each milestone for continuous improvement',
      timeline: 'Project setup: {firstDeliveryDays} days. Ongoing management for {estimatedWeeks} weeks as scoped.',
      cta: 'Let\'s discuss your project goals — I\'ll come to the call with a draft project charter. When works for you?',
      tips: ['Show you understand their methodology (Agile/Waterfall)', 'Mention certifications (PMP, Scrum Master)']
    }
  };

  /**
   * Get a proposal template by category slug
   * @param {string} category - Category slug: web-dev, design, writing, data-entry, marketing, consulting, mobile, devops, qa, pm
   * @returns {Object|null} Template object with hook, experience, approach, timeline, cta, tips
   */
  function getProposalTemplate(category) {
    if (!category) return null;
    const key = category.toLowerCase().replace(/\s+/g, '-');
    return BUILTIN_TEMPLATES[key] || null;
  }

  /**
   * Fill a template string with variable values
   * @param {string} template - Template text containing {variableName} placeholders
   * @param {Object} variables - Key-value pairs to replace placeholders
   * @returns {string} Filled template text
   */
  function fillTemplate(template, variables) {
    if (!template || !variables) return template || '';
    return template.replace(/\{(\w+)\}/g, function (match, key) {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Get all available template category slugs
   * @returns {string[]} Array of category slugs
   */
  function getTemplateCategories() {
    return Object.keys(BUILTIN_TEMPLATES);
  }

  /**
   * Fill all sections of a template object with variables
   * @param {Object} tmpl - Template object from getProposalTemplate
   * @param {Object} variables - Key-value pairs to replace placeholders
   * @returns {Object} New template object with all sections filled
   */
  function fillFullTemplate(tmpl, variables) {
    if (!tmpl || !variables) return tmpl;
    return {
      category: tmpl.category,
      hook: fillTemplate(tmpl.hook, variables),
      experience: fillTemplate(tmpl.experience, variables),
      approach: fillTemplate(tmpl.approach, variables),
      timeline: fillTemplate(tmpl.timeline, variables),
      cta: fillTemplate(tmpl.cta, variables),
      tips: tmpl.tips ? tmpl.tips.slice() : []
    };
  }

  /* ── Public API ────────────────────────────────────────────── */
  window.CortexProposalTemplates = {
    loadTemplates: loadTemplates,
    renderTemplateLibrary: renderTemplateLibrary,
    getProposalTemplate: getProposalTemplate,
    fillTemplate: fillTemplate,
    fillFullTemplate: fillFullTemplate,
    getTemplateCategories: getTemplateCategories,
    BUILTIN_TEMPLATES: BUILTIN_TEMPLATES
  };

})();
