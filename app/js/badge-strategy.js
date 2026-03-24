/**
 * Cortex Freelancer — Upwork Rising Talent / Top Rated Strategy Guide
 * [CF-078] Interactive guide showing requirements and progress toward badges.
 *
 * Features:
 *   - Three badge tiers: Rising Talent, Top Rated, Top Rated Plus
 *   - Per-requirement progress tracking with weighted scoring
 *   - Auto-detection from profile data
 *   - Actionable tips per tier with priority ranking
 *   - Interactive checklist UI with progress bars
 *   - Time-to-goal estimation based on current trajectory
 *   - Milestone notifications
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_badge_progress';
  var MILESTONES_KEY = 'cf_badge_milestones';

  var BADGES = {
    rising_talent: {
      id: 'rising_talent',
      name: 'Rising Talent',
      icon: '⭐',
      color: '#4CAF50',
      tier: 1,
      description: 'Awarded to promising newcomers who show strong potential on Upwork.',
      requirements: [
        { id: 'profile_complete',   label: 'Profile 100% complete',              type: 'boolean',   weight: 1 },
        { id: 'profile_photo',      label: 'Professional profile photo',         type: 'boolean',   weight: 1 },
        { id: 'skills_listed',      label: 'At least 5 skills listed',           type: 'threshold', target: 5,   unit: 'skills', weight: 1 },
        { id: 'portfolio_items',    label: 'Portfolio with 2+ items',            type: 'threshold', target: 2,   unit: 'items',  weight: 1 },
        { id: 'employment_history', label: 'Employment history added',           type: 'boolean',   weight: 1 },
        { id: 'education',          label: 'Education section filled',           type: 'boolean',   weight: 1 },
        { id: 'title_compelling',   label: 'Compelling professional title',      type: 'boolean',   weight: 0.5 },
        { id: 'overview_quality',   label: 'Well-written overview (500+ chars)', type: 'threshold', target: 500, unit: 'chars',  weight: 1 },
        { id: 'availability_set',   label: 'Availability status set',            type: 'boolean',   weight: 0.5 },
        { id: 'rate_set',           label: 'Hourly rate configured',             type: 'boolean',   weight: 0.5 },
        { id: 'recent_activity',    label: 'Active in last 90 days',             type: 'boolean',   weight: 1 }
      ],
      tips: [
        'Complete every single profile section — Upwork\'s algorithm favors 100% profiles',
        'Use a professional headshot with good lighting and neutral background',
        'Write a detailed overview showcasing specific skills and results',
        'Add portfolio items even if from personal projects',
        'Set your availability to "More than 30 hrs/week" to signal commitment',
        'Apply to at least 5 well-matched jobs per week',
        'Keep response time under 12 hours'
      ]
    },

    top_rated: {
      id: 'top_rated',
      name: 'Top Rated',
      icon: '🏆',
      color: '#FF9800',
      tier: 2,
      description: 'For established freelancers with a proven track record of success.',
      requirements: [
        { id: 'jss_score',          label: 'Job Success Score ≥ 90%',            type: 'threshold', target: 90,   unit: '%',      weight: 2 },
        { id: 'earnings_12m',       label: '$1,000+ earned in 12 months',        type: 'threshold', target: 1000, unit: '$',      weight: 2 },
        { id: 'active_months',      label: 'Account active 16+ weeks in last year', type: 'threshold', target: 16, unit: 'weeks', weight: 1.5 },
        { id: 'first_project_date', label: 'First project 90+ days ago',         type: 'threshold', target: 90,   unit: 'days',   weight: 1 },
        { id: 'no_account_holds',   label: 'No account holds or restrictions',   type: 'boolean',   weight: 2 },
        { id: 'rising_talent_first',label: 'Was Rising Talent (or bypassed)',     type: 'boolean',   weight: 0.5 },
        { id: 'response_rate',      label: 'Good response rate to invitations',  type: 'boolean',   weight: 1 },
        { id: 'up_to_date_profile', label: 'Profile up-to-date and active',      type: 'boolean',   weight: 1 }
      ],
      tips: [
        'Job Success Score is KING — avoid negative outcomes at all costs',
        'Never abandon a contract; always close with mutual agreement',
        'Communicate proactively — under-promise and over-deliver',
        'Request 5-star feedback after every successful project',
        'Maintain steady work flow — gaps hurt your activity metrics',
        'Respond to invitations within 24 hours even if declining',
        'Keep your profile updated with recent skills and portfolio items',
        'Avoid fixed-price disputes — they heavily impact JSS'
      ]
    },

    top_rated_plus: {
      id: 'top_rated_plus',
      name: 'Top Rated Plus',
      icon: '💎',
      color: '#9C27B0',
      tier: 3,
      description: 'Elite freelancers who consistently deliver outstanding results.',
      requirements: [
        { id: 'top_rated_status',  label: 'Currently Top Rated',                  type: 'boolean',   weight: 2 },
        { id: 'jss_score_high',    label: 'Job Success Score ≥ 90%',              type: 'threshold', target: 90,    unit: '%',         weight: 2 },
        { id: 'earnings_12m_high', label: '$10,000+ earned in 12 months',         type: 'threshold', target: 10000, unit: '$',         weight: 2 },
        { id: 'large_contracts',   label: '1+ large contract ($1,000+) in 12mo',  type: 'threshold', target: 1,     unit: 'contracts', weight: 1.5 },
        { id: 'long_relationships',label: 'Long-term client relationships',       type: 'boolean',   weight: 1.5 },
        { id: 'sustained_quality', label: 'Sustained high-quality ratings',       type: 'boolean',   weight: 2 },
        { id: 'no_recent_issues',  label: 'No disputes or refunds in 6 months',  type: 'boolean',   weight: 2 },
        { id: 'specialization',    label: 'Clear specialization/niche',           type: 'boolean',   weight: 1 }
      ],
      tips: [
        'Focus on high-value clients and longer engagements',
        'Build repeat business — Top Rated Plus loves client retention',
        'Raise your rates gradually to hit the $10K threshold naturally',
        'Specialize deeply rather than being a generalist',
        'Document your process — it impresses enterprise clients',
        'Aim for contracts above $1,000 to meet the large contract requirement',
        'Consider retainer arrangements for steady income',
        'Network within Upwork Community for visibility'
      ]
    }
  };

  var _initialized = false;

  // ─── Data Layer ───────────────────────────────────────────────────

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveProgress(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* full */ }
  }

  function loadMilestones() {
    try { return JSON.parse(localStorage.getItem(MILESTONES_KEY) || '[]'); } catch (e) { return []; }
  }

  function saveMilestone(milestone) {
    var ms = loadMilestones();
    ms.push(Object.assign({ timestamp: new Date().toISOString() }, milestone));
    if (ms.length > 50) ms = ms.slice(-50);
    try { localStorage.setItem(MILESTONES_KEY, JSON.stringify(ms)); } catch (e) { /* full */ }
  }

  // ─── Requirement Updates ──────────────────────────────────────────

  function updateRequirement(badgeId, reqId, value) {
    var progress = loadProgress();
    if (!progress[badgeId]) progress[badgeId] = {};

    var prev = progress[badgeId][reqId];
    progress[badgeId][reqId] = { value: value, updatedAt: new Date().toISOString() };
    saveProgress(progress);

    // Check for newly completed requirement
    var badge = BADGES[badgeId];
    if (badge) {
      var req = badge.requirements.find(function (r) { return r.id === reqId; });
      if (req) {
        var wasComplete = _isComplete(req, prev);
        var nowComplete = _isComplete(req, progress[badgeId][reqId]);
        if (!wasComplete && nowComplete) {
          saveMilestone({ badgeId: badgeId, reqId: reqId, label: req.label, type: 'requirement_complete' });
          try {
            window.dispatchEvent(new CustomEvent('cf:badge:milestone', {
              detail: { badgeId: badgeId, reqId: reqId, label: req.label }
            }));
          } catch (e) { /* old browser */ }
        }
      }
    }

    return calculateBadgeProgress(badgeId);
  }

  function _isComplete(req, entry) {
    if (!entry) return false;
    if (req.type === 'boolean') return !!entry.value;
    if (req.type === 'threshold') return typeof entry.value === 'number' && entry.value >= req.target;
    return false;
  }

  function updateFromProfile(profileData) {
    if (!profileData) return;

    // Rising Talent auto-detection
    if (profileData.completeness >= 100) updateRequirement('rising_talent', 'profile_complete', true);
    if (profileData.photo) updateRequirement('rising_talent', 'profile_photo', true);
    if (profileData.skills && profileData.skills.length >= 0)
      updateRequirement('rising_talent', 'skills_listed', profileData.skills.length);
    if (profileData.portfolio && profileData.portfolio.length >= 0)
      updateRequirement('rising_talent', 'portfolio_items', profileData.portfolio.length);
    if (profileData.overview)
      updateRequirement('rising_talent', 'overview_quality', (profileData.overview || '').length);
    if (profileData.rate) updateRequirement('rising_talent', 'rate_set', true);
    if (profileData.title && profileData.title.length > 10) updateRequirement('rising_talent', 'title_compelling', true);
    if (profileData.employmentHistory) updateRequirement('rising_talent', 'employment_history', true);
    if (profileData.education) updateRequirement('rising_talent', 'education', true);

    // Top Rated
    if (typeof profileData.jss === 'number') {
      updateRequirement('top_rated', 'jss_score', profileData.jss);
      updateRequirement('top_rated_plus', 'jss_score_high', profileData.jss);
    }
    if (typeof profileData.earnings12m === 'number') {
      updateRequirement('top_rated', 'earnings_12m', profileData.earnings12m);
      updateRequirement('top_rated_plus', 'earnings_12m_high', profileData.earnings12m);
    }
    if (typeof profileData.activeWeeks === 'number') updateRequirement('top_rated', 'active_months', profileData.activeWeeks);
    if (typeof profileData.daysSinceFirst === 'number') updateRequirement('top_rated', 'first_project_date', profileData.daysSinceFirst);
    if (profileData.badge === 'Top Rated') updateRequirement('top_rated_plus', 'top_rated_status', true);

    return getAllProgress();
  }

  // ─── Progress Calculation ─────────────────────────────────────────

  function calculateBadgeProgress(badgeId) {
    var badge = BADGES[badgeId];
    if (!badge) return null;

    var progress = loadProgress();
    var bp = progress[badgeId] || {};
    var totalWeight = 0, completedWeight = 0;
    var details = [];

    badge.requirements.forEach(function (req) {
      totalWeight += req.weight;
      var entry = bp[req.id];
      var completed = _isComplete(req, entry);
      if (completed) completedWeight += req.weight;
      var currentValue = entry ? entry.value : null;

      details.push({
        id: req.id,
        label: req.label,
        type: req.type,
        target: req.target,
        unit: req.unit,
        weight: req.weight,
        currentValue: currentValue,
        completed: completed,
        progress: req.type === 'threshold' && currentValue !== null
          ? Math.min(100, Math.round((currentValue / req.target) * 100))
          : (completed ? 100 : 0)
      });
    });

    var overallPct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    var completedCount = details.filter(function (d) { return d.completed; }).length;

    return {
      badgeId: badgeId,
      name: badge.name,
      icon: badge.icon,
      color: badge.color,
      tier: badge.tier,
      description: badge.description,
      overallProgress: overallPct,
      completedCount: completedCount,
      totalCount: details.length,
      requirements: details,
      tips: badge.tips,
      eligible: overallPct >= 90,
      nextSteps: _getNextSteps(details),
      estimatedWeeks: _estimateTimeToGoal(badgeId, details)
    };
  }

  function _getNextSteps(details) {
    return details
      .filter(function (d) { return !d.completed; })
      .sort(function (a, b) { return b.weight - a.weight; })
      .slice(0, 3)
      .map(function (d) {
        if (d.type === 'threshold' && d.currentValue !== null) {
          var remaining = d.target - d.currentValue;
          return d.label + ' (need ' + remaining + ' more ' + (d.unit || '') + ')';
        }
        return d.label;
      });
  }

  function _estimateTimeToGoal(badgeId, details) {
    var incomplete = details.filter(function (d) { return !d.completed; });
    if (incomplete.length === 0) return 0;

    // Simple heuristic: based on type and how far from target
    var totalWeeks = 0;
    incomplete.forEach(function (d) {
      if (d.type === 'boolean') {
        totalWeeks += 1; // assume 1 week per boolean
      } else if (d.type === 'threshold') {
        var remaining = d.target - (d.currentValue || 0);
        if (d.unit === '$') totalWeeks += Math.ceil(remaining / 250); // ~$250/week
        else if (d.unit === 'weeks') totalWeeks += remaining;
        else if (d.unit === 'days') totalWeeks += Math.ceil(remaining / 7);
        else totalWeeks += Math.ceil(remaining / 2);
      }
    });
    return Math.max(1, totalWeeks);
  }

  function getAllProgress() {
    return {
      rising_talent: calculateBadgeProgress('rising_talent'),
      top_rated: calculateBadgeProgress('top_rated'),
      top_rated_plus: calculateBadgeProgress('top_rated_plus')
    };
  }

  function getCurrentTier() {
    var all = getAllProgress();
    var current = null, next = null;

    if (all.top_rated_plus.eligible) {
      current = 'top_rated_plus';
    } else if (all.top_rated.eligible) {
      current = 'top_rated'; next = 'top_rated_plus';
    } else if (all.rising_talent.eligible) {
      current = 'rising_talent'; next = 'top_rated';
    } else {
      next = 'rising_talent';
    }

    return {
      current: current,
      currentBadge: current ? BADGES[current] : null,
      next: next,
      nextBadge: next ? BADGES[next] : null,
      nextProgress: next ? all[next] : null,
      all: all
    };
  }

  // ─── UI Renderer ─────────────────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var tier = getCurrentTier();
    var all = tier.all;

    var html = '<div class="cf-badge-guide">';
    html += '<h3 style="margin:0 0 16px">🏅 Badge Strategy Guide</h3>';

    // ── Current tier
    if (tier.current) {
      var cb = tier.currentBadge;
      html += '<div style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:16px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:4px solid ' + cb.color + '">';
      html += '<span style="font-size:2em">' + cb.icon + '</span>';
      html += '<div><strong style="font-size:1.1em">Current Tier: ' + cb.name + '</strong>';
      html += '<div style="color:#888;font-size:0.85em">You\'ve achieved this badge! Keep maintaining your standing.</div></div>';
      html += '</div>';
    }

    // ── Next target with time estimate
    if (tier.next) {
      var np = tier.nextProgress;
      var nb = tier.nextBadge;
      html += '<div style="padding:16px;margin-bottom:20px;background:linear-gradient(135deg,rgba(255,136,68,0.08),rgba(0,255,136,0.05));border-radius:8px;border:1px solid #333">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
      html += '<strong style="font-size:1.05em">Next Target: ' + nb.icon + ' ' + nb.name + '</strong>';
      if (np.estimatedWeeks > 0) {
        html += '<span style="color:#888;font-size:0.85em">~' + np.estimatedWeeks + ' weeks to goal</span>';
      }
      html += '</div>';
      html += '<div style="background:#1a1a1a;border-radius:6px;height:10px;overflow:hidden;margin-bottom:8px">';
      html += '<div style="height:100%;width:' + np.overallProgress + '%;background:linear-gradient(90deg,' + nb.color + ',#00ff88);border-radius:6px;transition:width 0.5s"></div>';
      html += '</div>';
      html += '<span style="font-size:0.85em;color:#aaa">' + np.overallProgress + '% complete (' + np.completedCount + '/' + np.totalCount + ' requirements)</span>';

      if (np.nextSteps.length > 0) {
        html += '<div style="margin-top:12px"><strong style="font-size:0.9em;color:#ff8844">🎯 Priority Actions:</strong><ul style="margin:6px 0 0;padding-left:20px;color:#ccc;font-size:0.85em">';
        np.nextSteps.forEach(function (step) { html += '<li style="margin-bottom:4px">' + step + '</li>'; });
        html += '</ul></div>';
      }
      html += '</div>';
    }

    // ── Tier progression visual
    html += '<div style="display:flex;gap:4px;margin-bottom:20px;align-items:center">';
    ['rising_talent', 'top_rated', 'top_rated_plus'].forEach(function (id, i) {
      var bp = all[id];
      var isActive = tier.current === id;
      var isDone = bp.eligible;
      html += '<div style="flex:1;text-align:center;padding:8px;border-radius:6px;background:' + (isDone ? bp.color + '22' : '#111') + ';border:1px solid ' + (isActive ? bp.color : '#333') + '">';
      html += '<div style="font-size:1.2em">' + bp.icon + '</div>';
      html += '<div style="font-size:0.75em;color:' + (isDone ? bp.color : '#888') + '">' + bp.name + '</div>';
      html += '<div style="font-size:0.7em;color:#666">' + bp.overallProgress + '%</div>';
      html += '</div>';
      if (i < 2) html += '<span style="color:#444">→</span>';
    });
    html += '</div>';

    // ── Detail sections for each badge
    ['rising_talent', 'top_rated', 'top_rated_plus'].forEach(function (badgeId) {
      var bp = all[badgeId];
      html += '<details ' + (tier.next === badgeId ? 'open' : '') + ' style="margin-bottom:12px;border:1px solid #222;border-radius:8px;overflow:hidden">';
      html += '<summary style="padding:12px 16px;cursor:pointer;background:#111;display:flex;align-items:center;gap:8px">';
      html += '<span>' + bp.icon + '</span>';
      html += '<strong>' + bp.name + '</strong>';
      if (bp.eligible) html += '<span style="color:#00ff88;font-size:0.8em;margin-left:auto">✓ Eligible</span>';
      else html += '<span style="color:#888;font-size:0.8em;margin-left:auto">' + bp.overallProgress + '%</span>';
      html += '</summary>';

      html += '<div style="padding:16px">';
      html += '<p style="color:#999;font-size:0.85em;margin:0 0 12px">' + bp.description + '</p>';

      // Requirements checklist
      bp.requirements.forEach(function (req) {
        var icon = req.completed ? '✅' : '⬜';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1a1a1a;font-size:0.85em">';
        html += '<span>' + icon + '</span>';
        html += '<span style="flex:1;color:' + (req.completed ? '#00ff88' : '#ccc') + '">' + req.label + '</span>';

        if (req.type === 'threshold' && !req.completed) {
          var pct = req.currentValue !== null ? Math.min(100, Math.round((req.currentValue / req.target) * 100)) : 0;
          html += '<div style="width:80px;height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden">';
          html += '<div style="height:100%;width:' + pct + '%;background:#ff8844;border-radius:3px"></div>';
          html += '</div>';
          html += '<span style="color:#888;font-size:0.8em;min-width:60px;text-align:right">';
          html += (req.currentValue !== null ? req.currentValue : 0) + '/' + req.target + ' ' + (req.unit || '');
          html += '</span>';
        }

        // Toggle for boolean requirements
        if (req.type === 'boolean') {
          html += '<button class="cf-badge-toggle" data-badge="' + badgeId + '" data-req="' + req.id + '" data-val="' + (req.completed ? '0' : '1') + '" style="padding:2px 8px;border:1px solid #333;border-radius:4px;background:none;color:#888;cursor:pointer;font-size:0.8em">';
          html += req.completed ? '↩' : '✓';
          html += '</button>';
        }

        html += '</div>';
      });

      // Tips
      html += '<details style="margin-top:12px"><summary style="cursor:pointer;color:#ff8844;font-size:0.85em">💡 ' + bp.tips.length + ' Tips</summary>';
      html += '<ul style="padding-left:20px;color:#bbb;font-size:0.85em;margin-top:8px">';
      bp.tips.forEach(function (tip) { html += '<li style="margin-bottom:6px">' + tip + '</li>'; });
      html += '</ul></details>';

      html += '</div></details>';
    });

    // ── Milestones
    var milestones = loadMilestones();
    if (milestones.length > 0) {
      html += '<details style="margin-top:16px"><summary style="cursor:pointer;color:#888;font-size:0.85em">🎉 Milestones (' + milestones.length + ')</summary>';
      html += '<div style="margin-top:8px">';
      milestones.slice(-10).reverse().forEach(function (ms) {
        html += '<div style="padding:4px 0;font-size:0.8em;color:#bbb;border-bottom:1px solid #1a1a1a">';
        html += '✅ ' + ms.label + ' <span style="color:#666">(' + new Date(ms.timestamp).toLocaleDateString() + ')</span>';
        html += '</div>';
      });
      html += '</div></details>';
    }

    html += '</div>';
    container.innerHTML = html;

    // ── Bind toggle buttons
    container.querySelectorAll('.cf-badge-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var badge = btn.getAttribute('data-badge');
        var req = btn.getAttribute('data-req');
        var val = btn.getAttribute('data-val') === '1';
        updateRequirement(badge, req, val);
        render(containerId);
      });
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Listen for profile analysis events to auto-update
    try {
      window.addEventListener('cf:profile:analyzed', function (e) {
        if (e.detail) updateFromProfile(e.detail);
      });
    } catch (e) { /* old browser */ }
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.BadgeStrategy = {
    BADGES: BADGES,

    // Lifecycle
    init: init,
    render: render,

    // Data
    updateRequirement: updateRequirement,
    updateFromProfile: updateFromProfile,
    calculateBadgeProgress: calculateBadgeProgress,
    getAllProgress: getAllProgress,
    getCurrentTier: getCurrentTier,

    // History
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    loadMilestones: loadMilestones
  };

})();
