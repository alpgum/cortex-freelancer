/**
 * [CF-075] Case Study Generator from Completed Projects
 * Create professional portfolio case studies from project data.
 * Works fully offline with intelligent content generation
 * based on project metadata, skills, and outcomes.
 * Exposed as window.CortexFreelancer.CaseStudyGenerator
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ══════════════════════════════════════════════
   * STORAGE
   * ══════════════════════════════════════════════ */
  var STORAGE_KEY = 'cortex_case_studies';

  function loadStudies() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }
  function saveStudies(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * CASE STUDY TEMPLATES BY CATEGORY
   * ══════════════════════════════════════════════ */
  var TEMPLATES = {
    development: {
      challengePrefixes: [
        'The client needed a', 'The company was struggling with', 'The existing system had',
        'The team required', 'The project demanded',
      ],
      challengeSuffixes: [
        'that could handle growing user traffic and scale reliably.',
        'causing performance bottlenecks and user frustration.',
        'outdated technology that needed modernization.',
        'a custom solution to replace their off-the-shelf tools.',
        'tight integration with multiple third-party services.',
      ],
      approachPhrases: [
        'Conducted a thorough technical assessment and created a phased implementation plan.',
        'Started with requirements gathering and architecture design before writing any code.',
        'Used an agile methodology with weekly sprints and client demos.',
        'Implemented a test-driven development approach for reliability.',
        'Built a proof-of-concept first to validate the technical approach.',
      ],
      solutionPhrases: [
        'Built a scalable, maintainable solution using modern best practices.',
        'Developed a clean, well-documented codebase with comprehensive test coverage.',
        'Created a modular architecture that allows easy feature additions.',
        'Implemented performance optimizations that significantly improved load times.',
        'Delivered a production-ready application with CI/CD pipeline.',
      ],
      resultsPhrases: [
        'Reduced page load times by 60%, improving user engagement.',
        'System now handles 10x the previous traffic with zero downtime.',
        'Client reported 40% increase in user satisfaction scores.',
        'Codebase maintenance time reduced by 50% through improved architecture.',
        'Successfully launched on schedule with zero critical bugs.',
      ],
    },
    design: {
      challengePrefixes: [
        'The brand needed', 'Users were struggling with', 'The current design had',
        'The product required', 'User research revealed',
      ],
      challengeSuffixes: [
        'a complete visual identity overhaul to match their market positioning.',
        'confusing navigation and poor user experience.',
        'inconsistent design patterns across platforms.',
        'an intuitive interface for a complex workflow.',
        'significant usability issues impacting conversion rates.',
      ],
      approachPhrases: [
        'Started with user research — interviews, surveys, and competitive analysis.',
        'Created user personas and journey maps to identify pain points.',
        'Developed wireframes and interactive prototypes for user testing.',
        'Followed a human-centered design process with iterative feedback loops.',
        'Conducted A/B testing to validate design decisions with real users.',
      ],
      solutionPhrases: [
        'Delivered a cohesive design system with reusable components.',
        'Created an intuitive user flow that reduced task completion time.',
        'Designed a responsive interface that works beautifully across devices.',
        'Built a comprehensive style guide for consistent brand application.',
        'Produced high-fidelity prototypes that mapped to exact implementation specs.',
      ],
      resultsPhrases: [
        'Conversion rate improved by 35% after the redesign.',
        'User task completion time reduced by 45%.',
        'Client received overwhelmingly positive user feedback.',
        'Design system saved the team 20+ hours per week.',
        'Mobile engagement increased by 50% with the new responsive design.',
      ],
    },
    data: {
      challengePrefixes: [
        'The organization needed', 'Decision makers lacked', 'The data infrastructure had',
      ],
      challengeSuffixes: [
        'actionable insights from their growing data warehouse.',
        'visibility into key metrics driving business decisions.',
        'siloed data preventing cross-functional analysis.',
      ],
      approachPhrases: [
        'Began with data audit and quality assessment across all sources.',
        'Designed a data pipeline architecture with clear transformation layers.',
        'Built dashboards iteratively, starting with executive-level KPIs.',
      ],
      solutionPhrases: [
        'Created an automated data pipeline with real-time reporting dashboards.',
        'Built predictive models with 90%+ accuracy on key business metrics.',
        'Delivered a self-service analytics platform empowering non-technical users.',
      ],
      resultsPhrases: [
        'Decision-making time reduced from weeks to hours.',
        'Identified $200K+ in cost savings through data analysis.',
        'Report generation time reduced from 8 hours to 15 minutes.',
      ],
    },
    writing: {
      challengePrefixes: [
        'The company needed', 'Content was', 'The brand struggled with',
      ],
      challengeSuffixes: [
        'compelling content to drive organic traffic and conversions.',
        'outdated and failing to engage the target audience.',
        'unclear messaging that didn\'t resonate with customers.',
      ],
      approachPhrases: [
        'Conducted audience research and competitive content analysis.',
        'Developed a content strategy aligned with business goals and SEO.',
        'Created an editorial calendar with clear content pillars.',
      ],
      solutionPhrases: [
        'Produced high-quality, SEO-optimized content across all channels.',
        'Developed a consistent brand voice guide and content templates.',
        'Created a content ecosystem connecting blog, email, and social.',
      ],
      resultsPhrases: [
        'Organic traffic increased by 150% within 3 months.',
        'Email open rates improved from 15% to 35%.',
        'Content-driven leads increased by 200%.',
      ],
    },
    marketing: {
      challengePrefixes: [
        'The company was', 'Marketing efforts were', 'The brand needed',
      ],
      challengeSuffixes: [
        'struggling to acquire customers at a sustainable cost.',
        'scattered across channels with no unified strategy.',
        'to scale marketing while maintaining ROI.',
      ],
      approachPhrases: [
        'Audited existing campaigns and identified top-performing channels.',
        'Built a full-funnel marketing strategy with clear KPIs.',
        'Implemented tracking and attribution across all touchpoints.',
      ],
      solutionPhrases: [
        'Launched targeted campaigns across paid, organic, and email channels.',
        'Created an automated marketing funnel with personalized touchpoints.',
        'Optimized ad spend allocation based on channel performance data.',
      ],
      resultsPhrases: [
        'Customer acquisition cost reduced by 40%.',
        'Return on ad spend improved from 2x to 5x.',
        'Lead pipeline grew by 300% quarter-over-quarter.',
      ],
    },
  };

  /* ══════════════════════════════════════════════
   * CATEGORY INFERENCE
   * ══════════════════════════════════════════════ */

  function inferCategory(project) {
    var text = ((project.title || '') + ' ' + (project.description || '') + ' ' + (project.skills || []).join(' ')).toLowerCase();

    if (/design|figma|ui|ux|sketch|prototype|wireframe|brand/.test(text)) return 'design';
    if (/data|analytics|ml|machine learning|sql|tableau|dashboard|bi\b/.test(text)) return 'data';
    if (/writ|copy|content|blog|seo writ|article|editing/.test(text)) return 'writing';
    if (/marketing|ads|seo|social media|campaign|ppc|email market/.test(text)) return 'marketing';
    return 'development';
  }

  /* ══════════════════════════════════════════════
   * CASE STUDY GENERATOR (OFFLINE)
   * ══════════════════════════════════════════════ */

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateCaseStudy(project, profileData) {
    project = project || {};
    profileData = profileData || {};

    var category = inferCategory(project);
    var template = TEMPLATES[category] || TEMPLATES.development;

    var title = project.title || 'Project';
    var skills = project.skills || [];
    var rating = project.rating || null;
    var earned = project.earnedAmount || 0;
    var feedback = project.feedbackText || '';
    var duration = project.duration || '';

    // Generate challenge
    var challenge = pickRandom(template.challengePrefixes) + ' ' + title.toLowerCase();
    if (skills.length > 0) {
      challenge += ' involving ' + skills.slice(0, 3).join(', ');
    }
    challenge += '. ' + pickRandom(template.challengeSuffixes);

    // Generate approach
    var approach = pickRandom(template.approachPhrases);
    if (skills.length > 2) {
      approach += ' Leveraged expertise in ' + skills.slice(0, 3).join(', ') + ' to deliver an optimal solution.';
    }
    if (duration) {
      approach += ' The project spanned ' + duration + ' with clear milestones throughout.';
    }

    // Generate solution
    var solution = pickRandom(template.solutionPhrases);
    if (skills.length > 0) {
      solution += ' Key technologies used: ' + skills.join(', ') + '.';
    }

    // Generate results
    var results = pickRandom(template.resultsPhrases);
    if (rating && rating >= 4.5) {
      results += ' The client rated the work ' + rating + '/5 stars.';
    }
    if (feedback && feedback.length > 20) {
      var shortFeedback = feedback.length > 100 ? feedback.slice(0, 97) + '...' : feedback;
      results += ' Client feedback: "' + shortFeedback + '"';
    }

    // Summary
    var summary = 'Successfully delivered ' + title;
    if (earned > 0) summary += ' ($' + Number(earned).toLocaleString() + ' project)';
    if (rating) summary += ' with a ' + rating + '/5 rating';
    summary += '. ' + (profileData.name || 'The freelancer') + ' demonstrated expertise in ' + (skills.slice(0, 2).join(' and ') || category) + '.';

    var caseStudy = {
      id: 'cs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      title: title,
      category: category,
      challenge: challenge,
      approach: approach,
      solution: solution,
      results: results,
      summary: summary,
      skills: skills,
      rating: rating,
      earnedAmount: earned,
      createdAt: new Date().toISOString(),
    };

    // Save
    var studies = loadStudies();
    studies.unshift(caseStudy);
    if (studies.length > 50) studies = studies.slice(0, 50);
    saveStudies(studies);

    return caseStudy;
  }

  /* ══════════════════════════════════════════════
   * EXPORT FORMATS
   * ══════════════════════════════════════════════ */

  function toMarkdown(cs) {
    var lines = [
      '## ' + (cs.title || 'Case Study'),
      '',
    ];
    if (cs.skills && cs.skills.length > 0) {
      lines.push('**Skills:** ' + cs.skills.join(', '));
      lines.push('');
    }
    lines.push('### Challenge');
    lines.push(cs.challenge);
    lines.push('');
    lines.push('### Approach');
    lines.push(cs.approach);
    lines.push('');
    lines.push('### Solution');
    lines.push(cs.solution);
    lines.push('');
    lines.push('### Results');
    lines.push(cs.results);
    lines.push('');
    if (cs.summary) {
      lines.push('> ' + cs.summary);
      lines.push('');
    }
    return lines.join('\n');
  }

  function toHTML(cs) {
    function e(str) {
      if (!str) return '';
      var d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }
    return '<div style="font-family:-apple-system,sans-serif;max-width:600px;background:#1a1a2e;color:#e0e0e0;border-radius:12px;padding:24px;">' +
      '<h2 style="color:#7c83ff;margin:0 0 16px;">' + e(cs.title) + '</h2>' +
      '<h3 style="color:#888;font-size:12px;text-transform:uppercase;">Challenge</h3><p>' + e(cs.challenge) + '</p>' +
      '<h3 style="color:#888;font-size:12px;text-transform:uppercase;">Approach</h3><p>' + e(cs.approach) + '</p>' +
      '<h3 style="color:#888;font-size:12px;text-transform:uppercase;">Solution</h3><p>' + e(cs.solution) + '</p>' +
      '<h3 style="color:#888;font-size:12px;text-transform:uppercase;">Results</h3><p>' + e(cs.results) + '</p>' +
      (cs.summary ? '<p style="color:#00d4aa;font-style:italic;border-top:1px solid #2d2d44;padding-top:12px;">' + e(cs.summary) + '</p>' : '') +
      '</div>';
  }

  function toJSON(cs) {
    return JSON.stringify(cs, null, 2);
  }

  /* ══════════════════════════════════════════════
   * RENDER
   * ══════════════════════════════════════════════ */

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function highlightMetrics(text) {
    return esc(text)
      .replace(/(\$[\d,]+(?:\.\d{2})?)/g, '<span style="color:#00d4aa;font-weight:600;">$1</span>')
      .replace(/(\d+(?:\.\d+)?%)/g, '<span style="color:#00d4aa;font-weight:600;">$1</span>')
      .replace(/(\d+(?:\.\d+)?\s*(?:hours|days|weeks|months|x|users|clients|stars))/gi, '<span style="color:#00d4aa;font-weight:600;">$1</span>');
  }

  function render(containerId) {
    var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;

    var studies = loadStudies();

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:760px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:24px;">';
    html += '<h2 style="margin:0 0 6px;font-size:22px;color:#fff;">📄 Case Study Generator</h2>';
    html += '<p style="margin:0;font-size:14px;color:#94a3b8;">Create professional portfolio case studies from your projects</p>';
    html += '</div>';

    if (studies.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:#6b7280;font-size:14px;">';
      html += 'No case studies yet.<br>';
      html += '<span style="font-size:12px;">Use <code>CortexFreelancer.CaseStudyGenerator.generateCaseStudy(projectData)</code> to create one.</span>';
      html += '</div>';
    }

    // Case study cards
    studies.forEach(function (cs, idx) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:24px;margin-bottom:16px;">';

      // Header
      html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
      html += '<h3 style="margin:0;color:#f4f4f5;font-size:16px;">' + esc(cs.title) + '</h3>';
      html += '<div style="display:flex;gap:8px;align-items:center;">';
      if (cs.rating) html += '<span style="font-size:13px;">⭐ ' + cs.rating + '</span>';
      if (cs.earnedAmount) html += '<span style="font-size:13px;color:#00d4aa;">$' + Number(cs.earnedAmount).toLocaleString() + '</span>';
      html += '</div></div>';

      // Skills
      if (cs.skills && cs.skills.length > 0) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">';
        cs.skills.forEach(function (s) {
          html += '<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:#6366f120;color:#a5b4fc;border:1px solid #6366f140;">' + esc(s) + '</span>';
        });
        html += '</div>';
      }

      // Sections
      var sections = [
        { label: 'Challenge', icon: '🎯', text: cs.challenge },
        { label: 'Approach', icon: '🧠', text: cs.approach },
        { label: 'Solution', icon: '🛠️', text: cs.solution },
        { label: 'Results', icon: '📈', text: cs.results },
      ];

      sections.forEach(function (sec) {
        html += '<div style="margin-bottom:14px;">';
        html += '<h4 style="color:#7c83ff;margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">' + sec.icon + ' ' + esc(sec.label) + '</h4>';
        html += '<p style="margin:0;font-size:14px;line-height:1.6;color:#ccc;">' + highlightMetrics(sec.text) + '</p>';
        html += '</div>';
      });

      // Summary
      if (cs.summary) {
        html += '<div style="border-top:1px solid #2d2d44;padding-top:12px;margin-top:4px;">';
        html += '<p style="margin:0;font-size:13px;color:#00d4aa;font-style:italic;">' + esc(cs.summary) + '</p>';
        html += '</div>';
      }

      // Action buttons
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">';
      html += '<button class="cs-copy-md" data-idx="' + idx + '" style="background:#2d2d44;color:#e0e0e0;border:none;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;">📋 Copy Markdown</button>';
      html += '<button class="cs-copy-html" data-idx="' + idx + '" style="background:#2d2d44;color:#e0e0e0;border:none;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;">🔗 Copy HTML</button>';
      html += '<button class="cs-copy-json" data-idx="' + idx + '" style="background:#2d2d44;color:#e0e0e0;border:none;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;">📦 Copy JSON</button>';
      html += '<button class="cs-delete" data-idx="' + idx + '" style="background:transparent;color:#ef4444;border:1px solid #ef444440;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;margin-left:auto;">🗑️ Delete</button>';
      html += '</div>';

      html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;

    // Event listeners
    function flashButton(btn, text) {
      var orig = btn.textContent;
      btn.textContent = text;
      setTimeout(function () { btn.textContent = orig; }, 1500);
    }

    el.querySelectorAll('.cs-copy-md').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'));
        var md = toMarkdown(studies[idx]);
        navigator.clipboard.writeText(md).then(function () { flashButton(btn, '✅ Copied!'); });
      });
    });

    el.querySelectorAll('.cs-copy-html').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'));
        var h = toHTML(studies[idx]);
        navigator.clipboard.writeText(h).then(function () { flashButton(btn, '✅ Copied!'); });
      });
    });

    el.querySelectorAll('.cs-copy-json').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'));
        var j = toJSON(studies[idx]);
        navigator.clipboard.writeText(j).then(function () { flashButton(btn, '✅ Copied!'); });
      });
    });

    el.querySelectorAll('.cs-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'));
        studies.splice(idx, 1);
        saveStudies(studies);
        render(el);
      });
    });
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */

  function init(options) {
    options = options || {};
    return {
      studies: loadStudies().length,
      ready: true,
    };
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.CaseStudyGenerator = {
    init: init,
    render: render,
    generateCaseStudy: generateCaseStudy,
    loadStudies: loadStudies,
    toMarkdown: toMarkdown,
    toHTML: toHTML,
    toJSON: toJSON,
    inferCategory: inferCategory,
    version: '2.0.0',
  };

  // Legacy compat
  window.CortexCaseStudyGenerator = window.CortexFreelancer.CaseStudyGenerator;

})();
