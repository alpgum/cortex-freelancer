/**
 * Cortex Freelancer — Upwork Rising Talent / Top Rated Strategy Guide
 * [CF-078] Interactive guide showing requirements and progress toward badges.
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_badge_progress';

  /**
   * Upwork badge tiers and their requirements.
   * Source: Upwork Help Center (requirements may be updated by Upwork).
   */
  var BADGES = {
    rising_talent: {
      id: 'rising_talent',
      name: 'Rising Talent',
      icon: '⭐',
      color: '#4CAF50',
      description: 'Awarded to promising newcomers who show strong potential on Upwork.',
      requirements: [
        { id: 'profile_complete', label: 'Profile 100% complete', type: 'boolean', weight: 1 },
        { id: 'profile_photo', label: 'Professional profile photo', type: 'boolean', weight: 1 },
        { id: 'skills_listed', label: 'At least 5 skills listed', type: 'threshold', target: 5, unit: 'skills', weight: 1 },
        { id: 'portfolio_items', label: 'Portfolio with 2+ items', type: 'threshold', target: 2, unit: 'items', weight: 1 },
        { id: 'employment_history', label: 'Employment history added', type: 'boolean', weight: 1 },
        { id: 'education', label: 'Education section filled', type: 'boolean', weight: 1 },
        { id: 'title_compelling', label: 'Compelling professional title', type: 'boolean', weight: 0.5 },
        { id: 'overview_quality', label: 'Well-written overview (500+ chars)', type: 'threshold', target: 500, unit: 'chars', weight: 1 },
        { id: 'availability_set', label: 'Availability status set', type: 'boolean', weight: 0.5 },
        { id: 'rate_set', label: 'Hourly rate configured', type: 'boolean', weight: 0.5 },
        { id: 'recent_activity', label: 'Active in last 90 days', type: 'boolean', weight: 1 }
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
      description: 'For established freelancers with a proven track record of success.',
      requirements: [
        { id: 'jss_score', label: 'Job Success Score ≥ 90%', type: 'threshold', target: 90, unit: '%', weight: 2 },
        { id: 'earnings_12m', label: '$1,000+ earned in 12 months', type: 'threshold', target: 1000, unit: '$', weight: 2 },
        { id: 'active_months', label: 'Account active 16+ weeks in last year', type: 'threshold', target: 16, unit: 'weeks', weight: 1.5 },
        { id: 'first_project_date', label: 'First project 90+ days ago', type: 'threshold', target: 90, unit: 'days', weight: 1 },
        { id: 'no_account_holds', label: 'No account holds or restrictions', type: 'boolean', weight: 2 },
        { id: 'rising_talent_first', label: 'Was Rising Talent (or bypassed)', type: 'boolean', weight: 0.5 },
        { id: 'response_rate', label: 'Good response rate to invitations', type: 'boolean', weight: 1 },
        { id: 'up_to_date_profile', label: 'Profile up-to-date and active', type: 'boolean', weight: 1 }
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
      description: 'Elite freelancers who consistently deliver outstanding results.',
      requirements: [
        { id: 'top_rated_status', label: 'Currently Top Rated', type: 'boolean', weight: 2 },
        { id: 'jss_score_high', label: 'Job Success Score ≥ 90%', type: 'threshold', target: 90, unit: '%', weight: 2 },
        { id: 'earnings_12m_high', label: '$10,000+ earned in 12 months', type: 'threshold', target: 10000, unit: '$', weight: 2 },
        { id: 'large_contracts', label: '1+ large contract ($1,000+) in 12 months', type: 'threshold', target: 1, unit: 'contracts', weight: 1.5 },
        { id: 'long_relationships', label: 'Long-term client relationships', type: 'boolean', weight: 1.5 },
        { id: 'sustained_quality', label: 'Sustained high-quality ratings', type: 'boolean', weight: 2 },
        { id: 'no_recent_issues', label: 'No disputes or refunds in 6 months', type: 'boolean', weight: 2 },
        { id: 'specialization', label: 'Clear specialization/niche', type: 'boolean', weight: 1 }
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

  // ─── Progress Tracking ────────────────────────────────────────────

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveProgress(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full */ }
  }

  /**
   * Update progress for a specific badge requirement.
   * @param {string} badgeId - 'rising_talent', 'top_rated', or 'top_rated_plus'
   * @param {string} reqId - requirement ID
   * @param {boolean|number} value - true/false for boolean, number for threshold
   */
  function updateRequirement(badgeId, reqId, value) {
    var progress = loadProgress();
    if (!progress[badgeId]) progress[badgeId] = {};
    progress[badgeId][reqId] = {
      value: value,
      updatedAt: new Date().toISOString()
    };
    saveProgress(progress);
    return calculateBadgeProgress(badgeId);
  }

  /**
   * Bulk update multiple requirements from profile analysis.
   */
  function updateFromProfile(profileData) {
    if (!profileData) return;

    // Rising Talent auto-detection
    if (profileData.completeness >= 100) updateRequirement('rising_talent', 'profile_complete', true);
    if (profileData.photo) updateRequirement('rising_talent', 'profile_photo', true);
    if (profileData.skills && profileData.skills.length >= 5) {
      updateRequirement('rising_talent', 'skills_listed', profileData.skills.length);
    }
    if (profileData.portfolio && profileData.portfolio.length >= 2) {
      updateRequirement('rising_talent', 'portfolio_items', profileData.portfolio.length);
    }
    if (profileData.overview && profileData.overview.length >= 500) {
      updateRequirement('rising_talent', 'overview_quality', profileData.overview.length);
    }
    if (profileData.rate) updateRequirement('rising_talent', 'rate_set', true);
    if (profileData.title && profileData.title.length > 10) {
      updateRequirement('rising_talent', 'title_compelling', true);
    }

    // Top Rated auto-detection
    if (typeof profileData.jss === 'number') {
      updateRequirement('top_rated', 'jss_score', profileData.jss);
      updateRequirement('top_rated_plus', 'jss_score_high', profileData.jss);
    }
    if (typeof profileData.earnings12m === 'number') {
      updateRequirement('top_rated', 'earnings_12m', profileData.earnings12m);
      updateRequirement('top_rated_plus', 'earnings_12m_high', profileData.earnings12m);
    }

    return getAllProgress();
  }

  // ─── Progress Calculation ─────────────────────────────────────────

  function calculateBadgeProgress(badgeId) {
    var badge = BADGES[badgeId];
    if (!badge) return null;

    var progress = loadProgress();
    var badgeProgress = progress[badgeId] || {};

    var totalWeight = 0;
    var completedWeight = 0;
    var details = [];

    badge.requirements.forEach(function (req) {
      totalWeight += req.weight;
      var entry = badgeProgress[req.id];
      var completed = false;
      var currentValue = null;

      if (entry) {
        currentValue = entry.value;
        if (req.type === 'boolean') {
          completed = !!entry.value;
        } else if (req.type === 'threshold') {
          completed = (typeof entry.value === 'number') && entry.value >= req.target;
        }
      }

      if (completed) completedWeight += req.weight;

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

    return {
      badgeId: badgeId,
      name: badge.name,
      icon: badge.icon,
      color: badge.color,
      description: badge.description,
      overallProgress: overallPct,
      completedCount: details.filter(function (d) { return d.completed; }).length,
      totalCount: details.length,
      requirements: details,
      tips: badge.tips,
      eligible: overallPct >= 90,
      nextSteps: _getNextSteps(details)
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

  function getAllProgress() {
    return {
      rising_talent: calculateBadgeProgress('rising_talent'),
      top_rated: calculateBadgeProgress('top_rated'),
      top_rated_plus: calculateBadgeProgress('top_rated_plus')
    };
  }

  /**
   * Determine current badge tier and next target.
   */
  function getCurrentTier() {
    var all = getAllProgress();
    var current = null;
    var next = null;

    if (all.top_rated_plus.eligible) {
      current = 'top_rated_plus';
    } else if (all.top_rated.eligible) {
      current = 'top_rated';
      next = 'top_rated_plus';
    } else if (all.rising_talent.eligible) {
      current = 'rising_talent';
      next = 'top_rated';
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

  function renderStrategyGuide(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var tier = getCurrentTier();
    var all = tier.all;

    var html = '<div class="cf-badge-guide">';
    html += '<h3 class="cf-badge-title">🏅 Badge Strategy Guide</h3>';

    // Current status
    if (tier.current) {
      html += '<div class="cf-badge-current" style="border-left:4px solid ' + tier.currentBadge.color + '">';
      html += '<span class="cf-badge-icon">' + tier.currentBadge.icon + '</span> ';
      html += '<strong>Current: ' + tier.currentBadge.name + '</strong>';
      html += '</div>';
    }

    // Next target
    if (tier.next) {
      html += '<div class="cf-badge-next">';
      html += '<strong>Next Target: ' + tier.nextBadge.icon + ' ' + tier.nextBadge.name + '</strong>';
      html += '<div class="cf-badge-progress-bar">';
      html += '<div class="cf-badge-progress-fill" style="width:' + tier.nextProgress.overallProgress + '%;background:' + tier.nextBadge.color + '"></div>';
      html += '</div>';
      html += '<span>' + tier.nextProgress.overallProgress + '% complete (' + tier.nextProgress.completedCount + '/' + tier.nextProgress.totalCount + ')</span>';

      if (tier.nextProgress.nextSteps.length > 0) {
        html += '<div class="cf-badge-nextsteps"><strong>Priority actions:</strong><ul>';
        tier.nextProgress.nextSteps.forEach(function (step) {
          html += '<li>' + step + '</li>';
        });
        html += '</ul></div>';
      }
      html += '</div>';
    }

    // All badges detail
    ['rising_talent', 'top_rated', 'top_rated_plus'].forEach(function (badgeId) {
      var bp = all[badgeId];
      html += '<div class="cf-badge-section" data-badge="' + badgeId + '">';
      html += '<h4>' + bp.icon + ' ' + bp.name;
      if (bp.eligible) html += ' <span class="cf-badge-eligible">✓ Eligible</span>';
      html += '</h4>';
      html += '<p class="cf-badge-desc">' + bp.description + '</p>';

      // Requirements checklist
      html += '<div class="cf-badge-reqs">';
      bp.requirements.forEach(function (req) {
        var icon = req.completed ? '✅' : '⬜';
        html += '<div class="cf-badge-req ' + (req.completed ? 'cf-req-done' : '') + '">';
        html += '<span>' + icon + ' ' + req.label + '</span>';
        if (req.type === 'threshold' && req.currentValue !== null && !req.completed) {
          html += '<span class="cf-req-progress">' + req.currentValue + '/' + req.target + ' ' + (req.unit || '') + '</span>';
        }
        html += '</div>';
      });
      html += '</div>';

      // Tips
      html += '<details class="cf-badge-tips"><summary>💡 Tips (' + bp.tips.length + ')</summary><ul>';
      bp.tips.forEach(function (tip) {
        html += '<li>' + tip + '</li>';
      });
      html += '</ul></details>';
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.BadgeStrategy = {
    BADGES: BADGES,
    updateRequirement: updateRequirement,
    updateFromProfile: updateFromProfile,
    calculateBadgeProgress: calculateBadgeProgress,
    getAllProgress: getAllProgress,
    getCurrentTier: getCurrentTier,
    renderStrategyGuide: renderStrategyGuide,
    loadProgress: loadProgress,
    saveProgress: saveProgress
  };

})();
