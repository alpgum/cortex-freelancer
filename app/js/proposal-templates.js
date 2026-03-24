/**
 * [CF-032] Proposal Template Library — 10 Pre-built Templates
 * Templates for: web dev, design, writing, data entry, marketing,
 * consulting, mobile, DevOps, QA, PM. Each with placeholders and tone.
 *
 * window.CortexFreelancer.ProposalTemplates
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_proposal_templates_custom';
  var CSS_INJECTED = false;

  var _customTemplates = [];
  var _initialized = false;

  // ─── 10 Built-in Templates ────────────────────────────────────────

  var BUILT_IN = [
    {
      id: 'tpl-web-dev', name: 'Web Development Pro', category: 'web-development',
      description: 'Technical, results-driven template for full-stack and frontend projects.',
      tone: 'professional', tags: ['react', 'node', 'full-stack', 'frontend', 'backend'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: 'Hi {{CLIENT_NAME}},',
        introduction: 'I read through your {{PROJECT_NAME}} requirements carefully and I\'m confident this is a strong fit for my skill set. Over the past {{YEARS_EXPERIENCE}} years, I\'ve architected and shipped production web applications using {{RELEVANT_SKILL}} — from MVPs to platforms serving 100K+ users.',
        experience: 'My recent projects include building a real-time SaaS dashboard (React + Node.js + WebSockets), migrating a legacy PHP monolith to a microservices architecture, and developing an e-commerce platform that processes $2M+ annually. I prioritize clean, maintainable code with comprehensive test coverage.',
        approach: 'Here\'s my approach for {{PROJECT_NAME}}:\n1. Requirements deep-dive and technical architecture review\n2. Set up CI/CD, staging environment, and shared repository on day one\n3. Two-week sprint cycles with working demos at each milestone\n4. Performance optimization, security audit, and deployment\n5. Post-launch monitoring and 30-day bug support',
        timeline: 'Based on the scope described, I estimate {{TIMELINE}} with regular progress updates. I\'ll provide a detailed sprint plan after our kickoff call.',
        pricing: 'My rate is ${{HOURLY_RATE}}/hr for this type of work. For a fixed-price arrangement, I\'d scope this at ${{PROJECT_RATE}} based on the deliverables outlined. Both include two rounds of revisions.',
        closing: 'I\'m genuinely excited about this project and confident I can deliver results that exceed your expectations. You can see similar work in my portfolio: {{PORTFOLIO_LINK}}'
      }
    },
    {
      id: 'tpl-design', name: 'Creative Design Vision', category: 'design',
      description: 'Creative, visual-thinking template for UI/UX and graphic design work.',
      tone: 'friendly', tags: ['ui', 'ux', 'figma', 'branding', 'visual'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: 'Hey {{CLIENT_NAME}}!',
        introduction: 'Your {{PROJECT_NAME}} project immediately caught my eye — I love working on designs that balance visual impact with intuitive usability. With {{YEARS_EXPERIENCE}} years in UI/UX and visual design, I\'ve helped brands transform their digital presence into something users genuinely enjoy.',
        experience: 'My design portfolio spans brand identities, responsive web interfaces, and mobile apps across industries from fintech to healthcare. Highlights include a redesign that boosted user engagement by 47% and a design system adopted by a 50-person engineering team. I work primarily in Figma with deep knowledge of design tokens and component architecture.',
        approach: 'My creative process for {{PROJECT_NAME}}:\n1. Discovery — understand your brand, audience, and goals\n2. Moodboard + 2-3 style directions for your feedback\n3. Wireframes and user flows for key screens\n4. High-fidelity mockups with interactive prototype\n5. Developer-ready assets with a comprehensive design system',
        timeline: 'I\'d scope this at {{TIMELINE}}. You\'ll see first concepts within 5 days so we can align on direction early — no surprises.',
        pricing: 'My design rate is ${{HOURLY_RATE}}/hr. For this project scope, a fixed rate of ${{PROJECT_RATE}} would include everything through final handoff with two revision rounds.',
        closing: 'I\'d love to show you a few relevant pieces from my portfolio that align with your vision. Check them out here: {{PORTFOLIO_LINK}} — and let\'s set up a quick call to discuss!'
      }
    },
    {
      id: 'tpl-writing', name: 'Eloquent Content Writer', category: 'writing',
      description: 'Polished, persuasive template for copywriting and content creation.',
      tone: 'professional', tags: ['content', 'copywriting', 'seo', 'blog', 'marketing'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: 'Dear {{CLIENT_NAME}},',
        introduction: 'Great content doesn\'t just fill space — it drives action. That\'s the philosophy behind every piece I write for {{PROJECT_NAME}}. With {{YEARS_EXPERIENCE}} years crafting high-converting copy for SaaS, e-commerce, and B2B brands, I bring both creative flair and data-driven strategy to the table.',
        experience: 'My words have driven measurable results: email sequences with 45% open rates, landing pages converting at 8%+, and blog content that consistently ranks on page one. I\'ve written for brands ranging from early-stage startups to Fortune 500 companies, adapting voice and tone to match each brand\'s unique identity.',
        approach: 'My content workflow for your project:\n1. Brand voice audit and competitor content analysis\n2. Keyword research and SEO strategy alignment\n3. Detailed content outline for your approval before writing\n4. First draft delivery within 3-5 business days\n5. Two revision rounds and final SEO-optimized delivery with meta tags',
        timeline: '{{TIMELINE}} for the full scope. I can deliver the first piece as a trial within 3 days so you can evaluate the quality and voice match.',
        pricing: 'My rate for {{RELEVANT_SKILL}} is ${{HOURLY_RATE}}/hr, or ${{PROJECT_RATE}} for the complete project scope. This includes research, writing, SEO optimization, and two revision rounds.',
        closing: 'Words are my craft, and I\'d be honored to put them to work for your brand. I\'m happy to write a complimentary sample paragraph to demonstrate my voice match — no strings attached. View my writing samples: {{PORTFOLIO_LINK}}'
      }
    },
    {
      id: 'tpl-data-entry', name: 'Precision Data Specialist', category: 'data-entry',
      description: 'Efficient, accuracy-focused template for data entry and management.',
      tone: 'professional', tags: ['data', 'spreadsheet', 'excel', 'admin', 'accuracy'],
      estimatedReadTime: '1 min',
      sections: {
        greeting: 'Hi {{CLIENT_NAME}},',
        introduction: 'I saw your {{PROJECT_NAME}} listing and I\'m confident I can deliver accurate, fast-turnaround work. With {{YEARS_EXPERIENCE}} years of data entry and management experience, I maintain a 99.5%+ accuracy rate across all my projects.',
        experience: 'I\'ve processed over 500,000 records across diverse projects including CRM data migration, web scraping and structuring, product catalog management, and financial data entry. I\'m highly proficient in Excel, Google Sheets, Airtable, and various CRM platforms. I type 85+ WPM with meticulous attention to detail.',
        approach: 'My approach for {{PROJECT_NAME}}:\n1. Review sample data to understand format and validation rules\n2. Set up automated validation checks to catch errors in real-time\n3. Process in manageable batches with quality verification at each stage\n4. Deliver in your preferred format with a summary report',
        timeline: 'I can process approximately 500+ records per day with quality checks. For your scope, estimated completion: {{TIMELINE}}.',
        pricing: 'My rate is ${{HOURLY_RATE}}/hr for data entry work. For a fixed-price arrangement, ${{PROJECT_RATE}} for the complete scope as described.',
        closing: 'I\'m available to start immediately and happy to process a small test batch so you can verify my accuracy and speed before committing. Let me know how you\'d like to proceed.'
      }
    },
    {
      id: 'tpl-marketing', name: 'Growth Marketing Strategist', category: 'marketing',
      description: 'Results-driven template for digital marketing and growth roles.',
      tone: 'confident', tags: ['ads', 'growth', 'seo', 'social', 'analytics'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: '{{CLIENT_NAME}},',
        introduction: 'Your {{PROJECT_NAME}} brief resonates with me — I\'ve driven similar growth for brands in your space and I know what moves the needle. With {{YEARS_EXPERIENCE}} years in performance marketing, I focus on one thing: measurable ROI.',
        experience: 'I\'ve managed six-figure ad budgets across Meta, Google, TikTok, and LinkedIn. My track record: 4.2x average ROAS across 50+ campaigns, $2M+ in attributable revenue generated, and CAC reductions of 35% through systematic testing. I don\'t chase vanity metrics — I chase revenue.',
        approach: 'My growth framework for {{PROJECT_NAME}}:\n1. Audit current channels, creatives, and analytics setup\n2. Build targeting personas from your customer data\n3. Launch test campaigns with 3-5 creative variations\n4. Optimize weekly based on conversion data, not impressions\n5. Scale winners and kill losers fast — with monthly strategy reports',
        timeline: 'Initial audit and strategy: week 1. First campaigns live by week 2. Optimization cycles ongoing for {{TIMELINE}} as scoped.',
        pricing: 'My rate is ${{HOURLY_RATE}}/hr for {{RELEVANT_SKILL}}. For a retainer arrangement, ${{PROJECT_RATE}}/month covers strategy, execution, and reporting.',
        closing: 'I can prepare a free mini-audit of your current marketing presence to show you where the quick wins are. No obligation — just results-first thinking. Portfolio: {{PORTFOLIO_LINK}}'
      }
    },
    {
      id: 'tpl-consulting', name: 'Strategic Business Consultant', category: 'consulting',
      description: 'Authoritative, framework-driven template for consulting engagements.',
      tone: 'professional', tags: ['strategy', 'process', 'advisory', 'management'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: 'Dear {{CLIENT_NAME}},',
        introduction: 'Your {{PROJECT_NAME}} challenge is exactly the kind of problem I help organizations solve — and I have a proven framework for it. With {{YEARS_EXPERIENCE}} years of consulting experience across {{RELEVANT_SKILL}}, I deliver actionable insights, not slide-deck theater.',
        experience: 'I\'ve advised companies ranging from Series A startups to enterprise organizations on operational efficiency, digital transformation, and strategic planning. Measurable outcomes include: 30% cost reduction through process optimization, 2x faster go-to-market timelines, and successful organizational restructures affecting 200+ employees.',
        approach: 'My engagement model for {{PROJECT_NAME}}:\n1. Stakeholder interviews to map the real problem, not just symptoms\n2. Data analysis and benchmarking against industry standards\n3. Actionable recommendation deck with prioritized roadmap\n4. Implementation support for the first 30 days\n5. Knowledge transfer to ensure lasting change',
        timeline: 'Discovery phase: 5-7 business days. Full recommendation delivery: {{TIMELINE}}. I remain available for implementation support thereafter.',
        pricing: 'My consulting rate is ${{HOURLY_RATE}}/hr. For a defined engagement, ${{PROJECT_RATE}} covers discovery through recommendations with implementation guidance.',
        closing: 'I suggest we start with a 20-minute discovery call — I\'ll come prepared with initial observations based on publicly available information about your organization. No obligation. My case studies: {{PORTFOLIO_LINK}}'
      }
    },
    {
      id: 'tpl-mobile', name: 'Mobile App Builder', category: 'mobile-development',
      description: 'App-focused template for iOS, Android, and cross-platform development.',
      tone: 'friendly', tags: ['ios', 'android', 'react-native', 'flutter', 'mobile'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: 'Hi {{CLIENT_NAME}}!',
        introduction: 'Your {{PROJECT_NAME}} app concept is exciting — I build mobile experiences that users actually want to keep on their home screen. With {{YEARS_EXPERIENCE}} years shipping iOS and Android apps, I know how to turn ideas into polished, performant products.',
        experience: 'I\'ve launched 15+ apps, including several with 100K+ downloads on both app stores. My recent work includes a fintech app built with {{RELEVANT_SKILL}}, a social fitness platform, and a real-time marketplace with push notifications and in-app payments. I handle everything from architecture to App Store submission.',
        approach: 'My mobile dev process for {{PROJECT_NAME}}:\n1. Requirements workshop and user flow mapping\n2. UI prototype in Figma for early validation and feedback\n3. Agile sprints with TestFlight/internal builds every 2 weeks\n4. Integration testing across device sizes and OS versions\n5. App Store optimization, submission, and 30-day post-launch support',
        timeline: 'MVP delivery: {{TIMELINE}}. I\'ll provide a sprint-by-sprint breakdown after our requirements review so you can track progress.',
        pricing: 'My mobile development rate is ${{HOURLY_RATE}}/hr. For a fixed-price MVP, ${{PROJECT_RATE}} based on the scope described, including design implementation and app store submission.',
        closing: 'I\'d love to show you a walkthrough of a similar app I built — nothing beats seeing real work in action. Check my portfolio: {{PORTFOLIO_LINK}} and let\'s set up a quick screen share!'
      }
    },
    {
      id: 'tpl-devops', name: 'Cloud Infrastructure Expert', category: 'devops',
      description: 'Infrastructure-focused template for DevOps, cloud, and SRE work.',
      tone: 'confident', tags: ['aws', 'docker', 'kubernetes', 'ci-cd', 'terraform'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: '{{CLIENT_NAME}},',
        introduction: 'I see your {{PROJECT_NAME}} needs solid infrastructure — I specialize in making systems reliable, scalable, and cost-efficient. With {{YEARS_EXPERIENCE}} years in DevOps and cloud engineering, I\'ve saved companies hundreds of thousands in cloud costs while improving uptime.',
        experience: 'My infrastructure track record: 99.99% uptime SLAs maintained, 40%+ cloud cost reductions through right-sizing and reserved instances, CI/CD pipelines reducing deployment time from hours to minutes, and Kubernetes clusters handling 10K+ requests per second. I hold AWS Solutions Architect and {{RELEVANT_SKILL}} certifications.',
        approach: 'My infrastructure approach for {{PROJECT_NAME}}:\n1. Comprehensive audit — architecture, costs, security, bottlenecks\n2. Design target architecture with Infrastructure as Code (Terraform/Pulumi)\n3. Implement incrementally with zero-downtime migration strategy\n4. Set up monitoring, alerting, and incident runbooks\n5. Knowledge transfer, documentation, and team training',
        timeline: 'Infrastructure audit: 3-5 days. Full implementation: {{TIMELINE}} with rollback plan at each stage. Zero-downtime guaranteed.',
        pricing: 'My DevOps rate is ${{HOURLY_RATE}}/hr. For this engagement, ${{PROJECT_RATE}} covers audit through implementation with documentation.',
        closing: 'I can start with a free infrastructure audit report — no obligation. In my experience, most teams have 20-40% in low-hanging cloud cost savings. Let me find yours. Portfolio: {{PORTFOLIO_LINK}}'
      }
    },
    {
      id: 'tpl-qa', name: 'Quality Assurance Engineer', category: 'qa-testing',
      description: 'Testing-focused template for QA, automation, and quality engineering.',
      tone: 'professional', tags: ['testing', 'automation', 'selenium', 'cypress', 'qa'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: 'Hi {{CLIENT_NAME}},',
        introduction: 'Quality assurance isn\'t just about finding bugs — it\'s about building confidence in your release cycle. That\'s what I bring to {{PROJECT_NAME}}. With {{YEARS_EXPERIENCE}} years of QA experience, I\'ve prevented critical production incidents and established testing cultures at multiple organizations.',
        experience: 'I specialize in both manual and automated testing using {{RELEVANT_SKILL}}, Cypress, Playwright, and Selenium. I\'ve built test automation frameworks from scratch, integrated them into CI/CD pipelines, and reduced regression testing time by 80%. My work spans web, mobile, and API testing across healthcare, fintech, and e-commerce.',
        approach: 'My QA strategy for {{PROJECT_NAME}}:\n1. Review requirements and create comprehensive test plan\n2. Build test cases covering happy paths, edge cases, and regression\n3. Automate critical user flows for CI/CD integration\n4. Performance and load testing for key endpoints\n5. Detailed bug reports with reproduction steps, screenshots, and severity',
        timeline: 'Test plan and initial manual testing: 3-5 days. Full automation suite: {{TIMELINE}}. Ongoing regression available as needed.',
        pricing: 'My QA rate is ${{HOURLY_RATE}}/hr. For a comprehensive testing engagement, ${{PROJECT_RATE}} covers strategy, manual testing, and automation setup.',
        closing: 'I can review your current test coverage and identify the biggest risk areas — complimentary, no strings attached. This usually reveals 3-5 critical gaps. Portfolio: {{PORTFOLIO_LINK}}'
      }
    },
    {
      id: 'tpl-pm', name: 'Project Management Lead', category: 'project-management',
      description: 'Leadership-focused template for project and program management.',
      tone: 'professional', tags: ['agile', 'scrum', 'jira', 'leadership', 'planning'],
      estimatedReadTime: '2 min',
      sections: {
        greeting: '{{CLIENT_NAME}},',
        introduction: 'I can see your {{PROJECT_NAME}} needs someone who keeps teams aligned and deliverables on track — that\'s exactly what I do. With {{YEARS_EXPERIENCE}} years managing software projects and cross-functional teams, I bring structure, clarity, and accountability to every engagement.',
        experience: 'I\'ve led cross-functional teams of 5-20 people, managed budgets up to $500K, and delivered projects consistently on time and within scope. My methodology toolkit includes Agile/Scrum, Kanban, and hybrid approaches — I match the framework to the team, not the other way around. I use {{RELEVANT_SKILL}} and I hold PMP and Certified Scrum Master credentials.',
        approach: 'My PM framework for {{PROJECT_NAME}}:\n1. Kickoff — align on scope, milestones, success criteria, and RACI\n2. Set up project tracking with clear ownership and dependencies\n3. Daily standups, weekly status reports, biweekly stakeholder demos\n4. Risk register updated weekly with mitigation plans\n5. Retrospective at each milestone for continuous improvement',
        timeline: 'Project setup and charter: 3-5 days. Ongoing management for {{TIMELINE}} as scoped. I adapt cadence to your team\'s rhythm.',
        pricing: 'My project management rate is ${{HOURLY_RATE}}/hr. For ongoing engagement, ${{PROJECT_RATE}}/month for part-time PM support.',
        closing: 'Let\'s discuss your project goals — I\'ll come to our first call with a draft project charter and initial risk assessment. When works for you? Portfolio: {{PORTFOLIO_LINK}}'
      }
    }
  ];

  // ─── Init ─────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) _customTemplates = JSON.parse(raw) || [];
    } catch (e) { _customTemplates = []; }
  }

  function _persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_customTemplates)); } catch (e) { /* ignore */ }
  }

  function _genId() {
    return 'ctpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function _deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Template Access ──────────────────────────────────────────────

  function getBuiltInTemplates() { return _deepClone(BUILT_IN); }

  function getTemplate(id) {
    if (!_initialized) init();
    for (var i = 0; i < BUILT_IN.length; i++) { if (BUILT_IN[i].id === id) return _deepClone(BUILT_IN[i]); }
    for (var j = 0; j < _customTemplates.length; j++) { if (_customTemplates[j].id === id) return _deepClone(_customTemplates[j]); }
    return null;
  }

  function getAllTemplates() {
    if (!_initialized) init();
    return _deepClone(BUILT_IN.concat(_customTemplates));
  }

  function getTemplatesByCategory(category) {
    return getAllTemplates().filter(function (t) {
      return t.category.toLowerCase() === category.toLowerCase();
    });
  }

  // ─── Custom Template CRUD ─────────────────────────────────────────

  function createCustomTemplate(template) {
    if (!_initialized) init();
    if (!template || !template.name) return null;

    var tpl = {
      id: _genId(), name: template.name, category: template.category || 'custom',
      description: template.description || '', tone: template.tone || 'professional',
      tags: template.tags || [], estimatedReadTime: template.estimatedReadTime || '2 min',
      sections: template.sections || {}, isCustom: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };

    _customTemplates.push(tpl);
    _persist();
    return _deepClone(tpl);
  }

  function updateCustomTemplate(id, updates) {
    if (!_initialized) init();
    for (var i = 0; i < _customTemplates.length; i++) {
      if (_customTemplates[i].id === id) {
        var tpl = _customTemplates[i];
        if (updates.name !== undefined) tpl.name = updates.name;
        if (updates.category !== undefined) tpl.category = updates.category;
        if (updates.description !== undefined) tpl.description = updates.description;
        if (updates.tone !== undefined) tpl.tone = updates.tone;
        if (updates.tags !== undefined) tpl.tags = updates.tags;
        if (updates.sections !== undefined) tpl.sections = updates.sections;
        tpl.updatedAt = new Date().toISOString();
        _persist();
        return _deepClone(tpl);
      }
    }
    return null;
  }

  function deleteCustomTemplate(id) {
    if (!_initialized) init();
    for (var i = 0; i < _customTemplates.length; i++) {
      if (_customTemplates[i].id === id) { _customTemplates.splice(i, 1); _persist(); return true; }
    }
    return false;
  }

  // ─── Fill & Preview ───────────────────────────────────────────────

  function fillTemplate(templateId, variables) {
    var tpl = getTemplate(templateId);
    if (!tpl) return null;
    var vars = variables || {};
    var filled = _deepClone(tpl);

    for (var key in filled.sections) {
      if (filled.sections.hasOwnProperty(key)) {
        filled.sections[key] = filled.sections[key].replace(/\{\{(\w+)\}\}/g, function (match, varName) {
          return vars[varName] !== undefined ? vars[varName] : match;
        });
      }
    }

    return filled;
  }

  function previewTemplate(templateId, variables) {
    var filled = fillTemplate(templateId, variables);
    if (!filled) return '';
    var text = '';
    var sectionOrder = ['greeting', 'introduction', 'experience', 'approach', 'timeline', 'pricing', 'closing'];
    for (var i = 0; i < sectionOrder.length; i++) {
      var content = filled.sections[sectionOrder[i]];
      if (content) { if (text) text += '\n\n'; text += content; }
    }
    return text;
  }

  // ─── Clone ────────────────────────────────────────────────────────

  function cloneTemplate(id) {
    var original = getTemplate(id);
    if (!original) return null;
    original.name = original.name + ' (Custom)';
    return createCustomTemplate(original);
  }

  // ─── Export / Import ──────────────────────────────────────────────

  function exportTemplate(id) {
    var tpl = getTemplate(id);
    return tpl ? JSON.stringify(tpl, null, 2) : null;
  }

  function importTemplate(json) {
    try {
      var data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data || !data.name) return null;
      return createCustomTemplate(data);
    } catch (e) { return null; }
  }

  // ─── Render: Template Library ─────────────────────────────────────

  function renderTemplateLibrary(containerId) {
    _injectCSS();
    if (!_initialized) init();
    var container = document.getElementById(containerId);
    if (!container) return;

    var all = getAllTemplates();
    var categories = ['All'];
    var catSet = {};
    for (var c = 0; c < all.length; c++) {
      if (!catSet[all[c].category]) { categories.push(all[c].category); catSet[all[c].category] = true; }
    }

    var h = '<div class="pt-panel">';
    h += '<div class="pt-header"><span style="font-size:16px;font-weight:700;color:#e0e0e0;">Proposal Templates</span>';
    h += '<span class="pt-badge">' + all.length + ' templates</span></div>';

    h += '<div class="pt-tabs" id="pt-tabs">';
    for (var t = 0; t < categories.length; t++) {
      var active = categories[t] === 'All' ? ' pt-tab-active' : '';
      h += '<button class="pt-tab' + active + '" data-cat="' + _escapeHtml(categories[t]) + '">' + _escapeHtml(categories[t].replace(/-/g, ' ')) + '</button>';
    }
    h += '</div>';

    h += '<div class="pt-grid" id="pt-grid">';
    for (var i = 0; i < all.length; i++) h += _renderTemplateCard(all[i]);
    h += '</div></div>';

    container.innerHTML = h;

    // Tab filtering
    container.querySelector('#pt-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.pt-tab');
      if (!btn) return;
      var cat = btn.getAttribute('data-cat');
      var tabs = container.querySelectorAll('.pt-tab');
      for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('pt-tab-active');
      btn.classList.add('pt-tab-active');

      var filtered = cat === 'All' ? all : all.filter(function (t) { return t.category === cat; });
      var grid = container.querySelector('#pt-grid');
      grid.innerHTML = '';
      for (var k = 0; k < filtered.length; k++) grid.innerHTML += _renderTemplateCard(filtered[k]);
    });

    // Card click to preview
    container.querySelector('#pt-grid').addEventListener('click', function (e) {
      var card = e.target.closest('.pt-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      window.dispatchEvent(new CustomEvent('cf:proposal-template-select', { detail: { templateId: id } }));
    });
  }

  function _renderTemplateCard(tpl) {
    var toneColors = { professional: '#3b82f6', friendly: '#22c55e', confident: '#f59e0b', casual: '#8b5cf6' };
    var color = toneColors[tpl.tone] || '#888';

    var h = '<div class="pt-card" data-id="' + tpl.id + '">';
    h += '<div class="pt-card-cat">' + _escapeHtml(tpl.category.replace(/-/g, ' ')) + '</div>';
    h += '<div class="pt-card-name">' + _escapeHtml(tpl.name) + '</div>';
    h += '<div class="pt-card-desc">' + _escapeHtml(tpl.description) + '</div>';
    h += '<div class="pt-card-meta">';
    h += '<span class="pt-tone" style="color:' + color + ';">' + _escapeHtml(tpl.tone) + '</span>';
    if (tpl.estimatedReadTime) h += '<span>' + _escapeHtml(tpl.estimatedReadTime) + '</span>';
    if (tpl.isCustom) h += '<span class="pt-custom-badge">Custom</span>';
    h += '</div>';

    if (tpl.tags && tpl.tags.length) {
      h += '<div class="pt-card-tags">';
      for (var i = 0; i < Math.min(tpl.tags.length, 4); i++) h += '<span class="pt-tag">' + _escapeHtml(tpl.tags[i]) + '</span>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  // ─── Render: Template Editor ──────────────────────────────────────

  function renderTemplateEditor(containerId, templateId) {
    _injectCSS();
    if (!_initialized) init();
    var container = document.getElementById(containerId);
    if (!container) return;

    var tpl = templateId ? getTemplate(templateId) : null;
    var isEdit = !!tpl;
    var sections = (tpl && tpl.sections) || {};

    var h = '<div class="pt-editor">';
    h += '<div class="pt-editor-header">' + (isEdit ? 'Edit Template' : 'Create Template') + '</div>';
    h += '<div class="pt-editor-body">';

    h += '<div class="pt-field"><label class="pt-label">Template Name</label>';
    h += '<input type="text" class="pt-input" id="pt-ed-name" value="' + _escapeHtml(tpl ? tpl.name : '') + '"></div>';

    h += '<div class="pt-field"><label class="pt-label">Category</label>';
    h += '<input type="text" class="pt-input" id="pt-ed-cat" value="' + _escapeHtml(tpl ? tpl.category : '') + '"></div>';

    h += '<div class="pt-field"><label class="pt-label">Description</label>';
    h += '<input type="text" class="pt-input" id="pt-ed-desc" value="' + _escapeHtml(tpl ? tpl.description : '') + '"></div>';

    var sectionKeys = ['greeting', 'introduction', 'experience', 'approach', 'timeline', 'pricing', 'closing'];
    for (var s = 0; s < sectionKeys.length; s++) {
      var key = sectionKeys[s];
      h += '<div class="pt-field"><label class="pt-label">' + key.charAt(0).toUpperCase() + key.slice(1) + '</label>';
      h += '<textarea class="pt-input pt-textarea" id="pt-ed-' + key + '">' + _escapeHtml(sections[key] || '') + '</textarea></div>';
    }

    h += '<div style="display:flex;gap:10px;margin-top:16px;">';
    if (isEdit) h += '<button class="pt-btn pt-btn-primary" data-pt-ed="save" data-id="' + templateId + '">Save</button>';
    else h += '<button class="pt-btn pt-btn-primary" data-pt-ed="create">Create</button>';
    h += '<button class="pt-btn pt-btn-secondary" data-pt-ed="cancel">Cancel</button>';
    h += '</div></div></div>';

    container.innerHTML = h;

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pt-ed]');
      if (!btn) return;
      var action = btn.getAttribute('data-pt-ed');

      if (action === 'create' || action === 'save') {
        var formSections = {};
        for (var i = 0; i < sectionKeys.length; i++) {
          var el = document.getElementById('pt-ed-' + sectionKeys[i]);
          if (el) formSections[sectionKeys[i]] = el.value;
        }

        var data = {
          name: document.getElementById('pt-ed-name').value.trim(),
          category: document.getElementById('pt-ed-cat').value.trim(),
          description: document.getElementById('pt-ed-desc').value.trim(),
          sections: formSections
        };

        if (action === 'create') createCustomTemplate(data);
        else updateCustomTemplate(btn.getAttribute('data-id'), data);
        container.innerHTML = '';
      } else if (action === 'cancel') {
        container.innerHTML = '';
      }
    });
  }

  // ─── Render: Template Preview ─────────────────────────────────────

  function renderTemplatePreview(containerId, templateId, variables) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;

    var filled = fillTemplate(templateId, variables);
    if (!filled) { container.innerHTML = '<p style="color:#888;">Template not found.</p>'; return; }

    var h = '<div class="pt-preview">';
    h += '<div class="pt-preview-header">' + _escapeHtml(filled.name) + '</div>';

    var sectionKeys = ['greeting', 'introduction', 'experience', 'approach', 'timeline', 'pricing', 'closing'];
    for (var i = 0; i < sectionKeys.length; i++) {
      var content = filled.sections[sectionKeys[i]];
      if (!content) continue;
      h += '<div class="pt-preview-section">';
      h += '<div class="pt-preview-label">' + sectionKeys[i].charAt(0).toUpperCase() + sectionKeys[i].slice(1) + '</div>';
      h += '<div class="pt-preview-text">' + _escapeHtml(content).replace(/\n/g, '<br>').replace(/\{\{(\w+)\}\}/g, '<span style="color:#a78bfa;font-weight:500;">{{$1}}</span>') + '</div>';
      h += '</div>';
    }

    h += '<div style="padding:16px;border-top:1px solid #222;">';
    h += '<button class="pt-btn pt-btn-primary" id="pt-copy-preview">Copy Full Proposal</button>';
    h += '</div></div>';

    container.innerHTML = h;

    container.querySelector('#pt-copy-preview').addEventListener('click', function () {
      var text = previewTemplate(templateId, variables);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          var btn = container.querySelector('#pt-copy-preview');
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy Full Proposal'; }, 2000);
        });
      }
    });
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.pt-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.pt-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #222;background:#151515}',
      '.pt-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px}',
      '.pt-tabs{display:flex;gap:6px;padding:12px 20px;flex-wrap:wrap;border-bottom:1px solid #222}',
      '.pt-tab{background:#222;color:#aaa;border:1px solid #333;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}',
      '.pt-tab:hover{background:#2a2a2a;color:#fff}',
      '.pt-tab-active{background:#7c3aed33;color:#a78bfa;border-color:#7c3aed}',
      '.pt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:16px 20px}',
      '.pt-card{background:#0d0d0d;border:1px solid #222;border-radius:10px;padding:16px;cursor:pointer;transition:all .15s}',
      '.pt-card:hover{border-color:#7c3aed;transform:translateY(-2px)}',
      '.pt-card-cat{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#7c3aed;margin-bottom:4px}',
      '.pt-card-name{font-size:15px;font-weight:600;color:#e0e0e0;margin-bottom:6px}',
      '.pt-card-desc{font-size:12px;color:#888;margin-bottom:8px;line-height:1.4}',
      '.pt-card-meta{display:flex;gap:10px;font-size:11px;color:#666;margin-bottom:6px}',
      '.pt-tone{font-weight:600;text-transform:capitalize}',
      '.pt-custom-badge{background:#1e1e2e;color:#a78bfa;padding:1px 6px;border-radius:4px}',
      '.pt-card-tags{display:flex;gap:4px;flex-wrap:wrap}',
      '.pt-tag{background:#1e1e2e;color:#a78bfa;font-size:10px;padding:2px 7px;border-radius:10px}',
      '.pt-editor{background:#111;border:1px solid #222;border-radius:12px;overflow:hidden}',
      '.pt-editor-header{padding:14px 20px;background:#151515;border-bottom:1px solid #222;color:#e0e0e0;font-size:15px;font-weight:700}',
      '.pt-editor-body{padding:16px 20px}',
      '.pt-field{margin-bottom:14px}',
      '.pt-label{display:block;color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}',
      '.pt-input{width:100%;padding:8px 12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box}',
      '.pt-input:focus{border-color:#7c3aed}',
      '.pt-textarea{min-height:80px;resize:vertical;font-family:inherit;line-height:1.5}',
      '.pt-btn{border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.pt-btn-primary{background:#7c3aed;color:#fff}',
      '.pt-btn-primary:hover{background:#6d28d9}',
      '.pt-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.pt-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.pt-preview{background:#111;border:1px solid #222;border-radius:12px;overflow:hidden}',
      '.pt-preview-header{padding:14px 20px;background:#151515;border-bottom:1px solid #222;color:#e0e0e0;font-size:16px;font-weight:700}',
      '.pt-preview-section{padding:12px 20px;border-bottom:1px solid #1a1a1a}',
      '.pt-preview-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666;margin-bottom:6px}',
      '.pt-preview-text{color:#ccc;font-size:14px;line-height:1.6;white-space:pre-wrap}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.ProposalTemplates = {
    init: init,
    getBuiltInTemplates: getBuiltInTemplates,
    getTemplate: getTemplate,
    getAllTemplates: getAllTemplates,
    getTemplatesByCategory: getTemplatesByCategory,
    createCustomTemplate: createCustomTemplate,
    updateCustomTemplate: updateCustomTemplate,
    deleteCustomTemplate: deleteCustomTemplate,
    fillTemplate: fillTemplate,
    previewTemplate: previewTemplate,
    renderTemplateLibrary: renderTemplateLibrary,
    renderTemplateEditor: renderTemplateEditor,
    renderTemplatePreview: renderTemplatePreview,
    exportTemplate: exportTemplate,
    importTemplate: importTemplate,
    cloneTemplate: cloneTemplate,
    BUILT_IN: BUILT_IN,
    version: '1.0.0'
  };

})();
