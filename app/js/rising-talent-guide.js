/**
 * Cortex Freelancer — Rising Talent / Top Rated Strategy Guide
 * [CF-078] Interactive guide with progress tracker for achieving
 * Upwork badges: Rising Talent → Top Rated → Top Rated Plus → Expert-Vetted.
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_rising_talent_progress';

  var BADGES = {
    rising_talent: {
      id: 'rising_talent',
      label: 'Rising Talent',
      icon: '🌟',
      color: '#fbbf24',
      description: 'New freelancers showing high potential',
      order: 0,
    },
    top_rated: {
      id: 'top_rated',
      label: 'Top Rated',
      icon: '🏆',
      color: '#00d4aa',
      description: 'Proven track record of success on Upwork',
      order: 1,
    },
    top_rated_plus: {
      id: 'top_rated_plus',
      label: 'Top Rated Plus',
      icon: '💎',
      color: '#7c83ff',
      description: 'Top 3% of talent on the platform',
      order: 2,
    },
    expert_vetted: {
      id: 'expert_vetted',
      label: 'Expert-Vetted',
      icon: '👑',
      color: '#ff8844',
      description: 'Screened by Upwork talent specialists',
      order: 3,
    },
  };

  var REQUIREMENTS = {
    rising_talent: {
      title: 'Rising Talent Requirements',
      criteria: [
        { id: 'rt_profile_complete', label: '100% complete profile', tip: 'Fill in every section: title, overview, skills (15+), portfolio items, employment history, education, and certifications.' },
        { id: 'rt_photo', label: 'Professional profile photo', tip: 'Use a clear, well-lit headshot with a neutral background. No sunglasses, logos, or group photos.' },
        { id: 'rt_tests', label: 'Pass at least 1 Upwork skill test', tip: 'Take tests relevant to your niche. Score in the top 10-30% range for visibility.' },
        { id: 'rt_connects', label: 'Active proposal submissions', tip: 'Submit thoughtful, customized proposals. Aim for 10-15 quality proposals in your first 2 weeks.' },
        { id: 'rt_responsive', label: 'Fast response time (< 24h)', tip: 'Reply to all messages and invitations within a few hours. Enable mobile notifications.' },
        { id: 'rt_verified', label: 'Verified payment method & ID', tip: 'Complete ID verification and add a payment method to build platform trust.' },
      ],
      timeline: '2-4 weeks after joining',
    },
    top_rated: {
      title: 'Top Rated Requirements',
      criteria: [
        { id: 'tr_jss', label: 'Job Success Score (JSS) of 90%+', tip: 'Maintain excellent client relationships. No refunds, disputes, or poor private feedback. JSS recalculates every 2 weeks.' },
        { id: 'tr_earnings', label: '$1,000+ total earnings', tip: 'Focus on completing contracts fully and earning through the platform. Milestones help build this faster.' },
        { id: 'tr_activity', label: 'Active on platform for 16+ weeks', tip: 'Consistent activity matters — regular logins, proposals, and completed contracts.' },
        { id: 'tr_contracts', label: 'First contract within 90 days', tip: 'Start with smaller projects if needed to build your reputation quickly.' },
        { id: 'tr_no_violations', label: 'No Terms of Service violations', tip: 'Never share contact info before a contract. Avoid asking clients to leave the platform.' },
        { id: 'tr_long_contracts', label: 'At least 1 large contract ($500+)', tip: 'Seek longer engagements — they carry more weight in JSS calculations and show commitment.' },
      ],
      timeline: '3-6 months with consistent work',
    },
    top_rated_plus: {
      title: 'Top Rated Plus Requirements',
      criteria: [
        { id: 'trp_jss', label: 'JSS of 90%+ sustained over 1 year', tip: 'Long-term consistency matters. Every contract counts. Consider declining projects outside your expertise.' },
        { id: 'trp_earnings', label: '$10,000+ total earnings', tip: 'Increase your rates gradually as reviews accumulate. High-value contracts accelerate this.' },
        { id: 'trp_contracts', label: 'Significant contract history (10+)', tip: 'A mix of short and long contracts showing versatility and reliability.' },
        { id: 'trp_feedback', label: 'Consistently exceptional feedback (4.8+)', tip: 'Over-deliver on every project. Ask clients if there is anything else you can help with before closing.' },
        { id: 'trp_retention', label: 'High client return rate', tip: 'Build relationships that lead to repeat work. This is a strong signal to the algorithm.' },
        { id: 'trp_specialization', label: 'Clear niche specialization', tip: 'Position yourself as an expert in a specific area rather than a generalist.' },
      ],
      timeline: '1-2 years of consistent Top Rated status',
    },
    expert_vetted: {
      title: 'Expert-Vetted Requirements',
      criteria: [
        { id: 'ev_top_rated', label: 'Must be Top Rated or Top Rated Plus', tip: 'This is a prerequisite — maintain your badge status before applying.' },
        { id: 'ev_interview', label: 'Pass Upwork talent specialist interview', tip: 'Demonstrate domain expertise, communication skills, and professionalism in a live interview.' },
        { id: 'ev_portfolio', label: 'Strong portfolio with verifiable work', tip: 'Include case studies, live projects, and measurable results. Quality over quantity.' },
        { id: 'ev_rate', label: 'Competitive market-rate pricing', tip: 'Your rate should reflect senior-level expertise. Expert-Vetted freelancers typically charge premium rates.' },
        { id: 'ev_availability', label: 'Reliable availability (20+ hrs/week)', tip: 'Enterprise clients need dependable partners. Show consistent availability.' },
        { id: 'ev_enterprise', label: 'Experience with enterprise clients', tip: 'Prior work with large companies or complex projects demonstrates readiness for enterprise engagements.' },
      ],
      timeline: 'By invitation or application after 2+ years',
    },
  };

  var STRATEGIES = [
    { id: 'profile_optimization', badge: 'rising_talent', title: 'Profile Optimization Sprint', description: 'Spend 2-3 hours perfecting every section of your profile. Use keywords from top job postings in your niche.', effort: 'low', impact: 'high' },
    { id: 'first_5_contracts', badge: 'rising_talent', title: 'First 5 Contracts Strategy', description: 'Accept lower-rate projects initially to build reviews. Prioritize clients who seem communicative and clear.', effort: 'medium', impact: 'high' },
    { id: 'response_time', badge: 'rising_talent', title: 'Response Time Mastery', description: 'Enable all notifications. Respond to invitations within 1 hour. This alone can trigger Rising Talent.', effort: 'low', impact: 'high' },
    { id: 'jss_protection', badge: 'top_rated', title: 'JSS Protection Protocol', description: 'Never accept projects outside your expertise. Set clear scope upfront. Document everything in the Upwork messaging system.', effort: 'medium', impact: 'critical' },
    { id: 'rate_ladder', badge: 'top_rated', title: 'Rate Ladder Strategy', description: 'Increase rates by 10-15% after every 3 successful contracts. Track your rate growth over time.', effort: 'low', impact: 'medium' },
    { id: 'client_retention', badge: 'top_rated_plus', title: 'Client Retention System', description: 'Before closing each contract, ask about upcoming needs. Offer a small bonus deliverable. Follow up 30 days later.', effort: 'medium', impact: 'high' },
    { id: 'specialization', badge: 'top_rated_plus', title: 'Niche Down Aggressively', description: 'Choose the 2-3 service types you excel at. Remove everything else. Specialists earn 2-3x more than generalists.', effort: 'medium', impact: 'high' },
    { id: 'case_studies', badge: 'expert_vetted', title: 'Build Case Study Portfolio', description: 'Document 5+ detailed case studies with measurable results. Use the Cortex Case Study Generator to create them.', effort: 'high', impact: 'high' },
  ];

  // ─── Storage ──────────────────────────────────────────────────

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { currentBadge: null, targetBadge: 'rising_talent', checklist: {}, notes: {}, startedAt: null }; }
    catch (_) { return { currentBadge: null, targetBadge: 'rising_talent', checklist: {}, notes: {}, startedAt: null }; }
  }

  function saveProgress(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  // ─── Progress Tracking ────────────────────────────────────────

  function setCurrentBadge(badgeId) {
    var data = loadProgress();
    data.currentBadge = badgeId;
    // Auto-advance target
    var order = BADGES[badgeId] ? BADGES[badgeId].order : -1;
    var nextBadges = Object.values(BADGES).filter(function (b) { return b.order > order; });
    if (nextBadges.length) data.targetBadge = nextBadges[0].id;
    saveProgress(data);
    return data;
  }

  function setTargetBadge(badgeId) {
    var data = loadProgress();
    data.targetBadge = badgeId;
    if (!data.startedAt) data.startedAt = new Date().toISOString();
    saveProgress(data);
    return data;
  }

  function toggleCriterion(criterionId) {
    var data = loadProgress();
    data.checklist[criterionId] = !data.checklist[criterionId];
    saveProgress(data);
    return data;
  }

  function setCriterionNote(criterionId, note) {
    var data = loadProgress();
    data.notes[criterionId] = note;
    saveProgress(data);
  }

  function getProgressForBadge(badgeId) {
    var data = loadProgress();
    var reqs = REQUIREMENTS[badgeId];
    if (!reqs) return { total: 0, completed: 0, percentage: 0 };

    var total = reqs.criteria.length;
    var completed = reqs.criteria.filter(function (c) { return data.checklist[c.id]; }).length;
    return {
      total: total,
      completed: completed,
      percentage: Math.round((completed / total) * 100),
      remaining: total - completed,
    };
  }

  function getOverallProgress() {
    var data = loadProgress();
    var results = {};
    Object.keys(REQUIREMENTS).forEach(function (key) {
      results[key] = getProgressForBadge(key);
    });
    return {
      currentBadge: data.currentBadge,
      targetBadge: data.targetBadge,
      startedAt: data.startedAt,
      badges: results,
    };
  }

  function getRecommendedStrategies(badgeId) {
    return STRATEGIES.filter(function (s) { return s.badge === badgeId; });
  }

  function resetProgress() {
    saveProgress({ currentBadge: null, targetBadge: 'rising_talent', checklist: {}, notes: {}, startedAt: null });
  }

  // ─── UI Renderer ──────────────────────────────────────────────

  function render(containerId) {
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    try { if (window.dataLayer) dataLayer.push({ event: 'tool_used', tool_name: 'rising-talent-guide', action: 'render' }); } catch (e) {}

    var data = loadProgress();
    var target = data.targetBadge || 'rising_talent';
    var reqs = REQUIREMENTS[target];
    var badge = BADGES[target];
    var progress = getProgressForBadge(target);
    var strategies = getRecommendedStrategies(target);

    var html = '<div class="cf-rising-talent" style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:720px;">';

    // ── Badge Path
    html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 16px;color:#7c83ff;font-size:16px;">🎯 Badge Progression Path</h3>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">';
    Object.values(BADGES).sort(function (a, b) { return a.order - b.order; }).forEach(function (b) {
      var isCurrent = data.currentBadge === b.id;
      var isTarget = target === b.id;
      var prog = getProgressForBadge(b.id);
      var borderStyle = isTarget ? '2px solid ' + b.color : isCurrent ? '2px solid ' + b.color : '1px solid #2d2d44';
      var bgStyle = isCurrent ? b.color + '22' : '#1a1a2e';

      html += '<button class="cf-badge-select" data-badge="' + b.id + '" style="flex:1;min-width:130px;padding:12px;border:' + borderStyle + ';border-radius:10px;background:' + bgStyle + ';cursor:pointer;text-align:center;color:#e0e0e0;position:relative;">';
      html += '<div style="font-size:24px;">' + b.icon + '</div>';
      html += '<div style="font-size:13px;font-weight:600;margin-top:4px;color:' + b.color + ';">' + b.label + '</div>';
      if (isCurrent) html += '<div style="font-size:10px;color:#00d4aa;margin-top:2px;">Current</div>';
      if (isTarget && !isCurrent) html += '<div style="font-size:10px;color:#fbbf24;margin-top:2px;">Target</div>';
      if (prog.completed > 0) html += '<div style="font-size:10px;color:#888;margin-top:2px;">' + prog.completed + '/' + prog.total + '</div>';
      html += '</button>';
    });
    html += '</div>';

    // Current badge selector
    html += '<div style="font-size:12px;color:#888;margin-bottom:8px;">Your current badge:</div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    html += '<button class="cf-current-badge" data-badge="" style="padding:4px 12px;border:1px solid #333;border-radius:6px;background:' + (!data.currentBadge ? '#2d2d44' : '#111') + ';color:#ccc;cursor:pointer;font-size:12px;">None yet</button>';
    Object.values(BADGES).sort(function (a, b) { return a.order - b.order; }).forEach(function (b) {
      html += '<button class="cf-current-badge" data-badge="' + b.id + '" style="padding:4px 12px;border:1px solid #333;border-radius:6px;background:' + (data.currentBadge === b.id ? '#2d2d44' : '#111') + ';color:#ccc;cursor:pointer;font-size:12px;">' + b.icon + ' ' + b.label + '</button>';
    });
    html += '</div>';
    html += '</div>';

    // ── Progress & Checklist
    html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="margin:0;color:' + badge.color + ';font-size:16px;">' + badge.icon + ' ' + reqs.title + '</h3>';
    html += '<span style="font-size:13px;color:#888;">' + progress.completed + '/' + progress.total + ' (' + progress.percentage + '%)</span>';
    html += '</div>';

    // Progress bar
    html += '<div style="height:8px;background:#1f2937;border-radius:4px;overflow:hidden;margin-bottom:16px;">';
    html += '<div style="width:' + progress.percentage + '%;height:100%;background:linear-gradient(90deg,' + badge.color + ',#00d4aa);border-radius:4px;transition:width .3s ease;"></div>';
    html += '</div>';

    html += '<div style="font-size:12px;color:#888;margin-bottom:12px;">Timeline: ' + reqs.timeline + '</div>';

    // Checklist
    reqs.criteria.forEach(function (c) {
      var checked = data.checklist[c.id];
      html += '<div class="cf-criterion" data-id="' + c.id + '" style="padding:10px 12px;margin-bottom:6px;background:' + (checked ? 'rgba(0,212,170,0.08)' : '#1a1a2e') + ';border:1px solid ' + (checked ? '#00d4aa33' : '#2d2d44') + ';border-radius:8px;cursor:pointer;">';
      html += '<div style="display:flex;align-items:center;gap:10px;">';
      html += '<span style="font-size:18px;">' + (checked ? '✅' : '⬜') + '</span>';
      html += '<div style="flex:1;">';
      html += '<div style="font-size:14px;color:' + (checked ? '#00d4aa' : '#e0e0e0') + ';' + (checked ? 'text-decoration:line-through;' : '') + '">' + esc(c.label) + '</div>';
      html += '<div style="font-size:12px;color:#888;margin-top:2px;line-height:1.4;">' + esc(c.tip) + '</div>';
      html += '</div></div></div>';
    });
    html += '</div>';

    // ── Strategies
    if (strategies.length) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 16px;color:#7c83ff;font-size:16px;">💡 Recommended Strategies</h3>';
      strategies.forEach(function (s) {
        var impactColor = s.impact === 'critical' ? '#ef4444' : s.impact === 'high' ? '#00d4aa' : '#fbbf24';
        html += '<div style="padding:12px;background:#1a1a2e;border-radius:8px;margin-bottom:8px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<strong style="font-size:14px;color:#e0e0e0;">' + esc(s.title) + '</strong>';
        html += '<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:' + impactColor + '22;color:' + impactColor + ';">' + s.impact + ' impact</span>';
        html += '</div>';
        html += '<p style="margin:6px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">' + esc(s.description) + '</p>';
        html += '</div>';
      });
      html += '</div>';
    }

    // ── Quick Tips
    html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;">';
    html += '<h3 style="margin:0 0 12px;color:#7c83ff;font-size:16px;">⚡ Pro Tips</h3>';
    html += '<ul style="margin:0;padding-left:18px;">';
    var tips = [
      'JSS is calculated from private feedback — always ask if the client is satisfied before closing.',
      'Declining job invitations does NOT hurt your JSS. Only accepted and then failed contracts do.',
      'Long-running contracts carry more weight in JSS calculations than quick $50 jobs.',
      'Specializing in 1-2 niches gets you 3x more invitations than being a generalist.',
      'Top Rated freelancers can use the "Top Rated perk" to remove bad feedback once per quarter.',
    ];
    tips.forEach(function (t) {
      html += '<li style="font-size:13px;color:#d1d5db;margin-bottom:8px;line-height:1.5;">' + esc(t) + '</li>';
    });
    html += '</ul></div>';

    html += '</div>';
    container.innerHTML = html;

    // ── Bind Events
    container.querySelectorAll('.cf-badge-select').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTargetBadge(btn.getAttribute('data-badge'));
        render(containerId);
      });
    });

    container.querySelectorAll('.cf-current-badge').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-badge');
        setCurrentBadge(val || null);
        render(containerId);
      });
    });

    container.querySelectorAll('.cf-criterion').forEach(function (el) {
      el.addEventListener('click', function () {
        toggleCriterion(el.getAttribute('data-id'));
        render(containerId);
      });
    });

    return { progress: getOverallProgress() };
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Export ────────────────────────────────────────────────────

  window.CortexFreelancer.RisingTalentGuide = {
    BADGES: BADGES,
    REQUIREMENTS: REQUIREMENTS,
    STRATEGIES: STRATEGIES,

    // Progress tracking
    setCurrentBadge: setCurrentBadge,
    setTargetBadge: setTargetBadge,
    toggleCriterion: toggleCriterion,
    setCriterionNote: setCriterionNote,
    getProgressForBadge: getProgressForBadge,
    getOverallProgress: getOverallProgress,
    getRecommendedStrategies: getRecommendedStrategies,
    resetProgress: resetProgress,

    // UI
    render: render,

    version: '1.0.0',
  };

})();
