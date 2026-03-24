/**
 * [U-015 / CF-026] Job Matcher — Matching engine + client-side renderer
 *
 * calculateJobMatch: compare job requirements vs user profile → match %.
 * Renderer: takes profile data + jobs array → renders "🎯 Best Jobs For You" card grid.
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Score color helpers ───────────────────────────────────────────
  function matchColor(score) {
    if (score >= 80) return '#00ff88';
    if (score >= 60) return '#ffaa00';
    if (score >= 40) return '#ff8844';
    return '#ff4444';
  }

  function matchLabel(score) {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Fair Match';
    return 'Low Match';
  }

  // ─── Time ago helper ───────────────────────────────────────────────
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      var posted = new Date(dateStr);
      if (isNaN(posted.getTime())) return dateStr; // fallback to raw string
      var now = new Date();
      var diff = (now - posted) / 1000;
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
      return posted.toLocaleDateString();
    } catch (e) {
      return dateStr || '';
    }
  }

  // ─── Render match score circle (small, inline SVG) ─────────────────
  function renderMatchCircle(score) {
    var color = matchColor(score);
    var r = 22;
    var circ = 2 * Math.PI * r;
    var offset = circ * (1 - score / 100);

    return '<svg viewBox="0 0 56 56" width="52" height="52" class="jm-score-svg">' +
      '<circle cx="28" cy="28" r="' + r + '" fill="none" stroke="#222" stroke-width="4"/>' +
      '<circle cx="28" cy="28" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="4" ' +
      'stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" ' +
      'transform="rotate(-90 28 28)" style="transition:stroke-dashoffset 0.8s ease-out"/>' +
      '<text x="28" y="32" text-anchor="middle" fill="' + color + '" font-size="14" font-weight="800">' + score + '</text>' +
      '</svg>';
  }

  // ─── Render a single job card ──────────────────────────────────────
  function renderJobCard(job, userSkills, idx) {
    var h = '<div class="jm-card">';

    // Header: score circle + title
    h += '<div class="jm-card-header">';
    h += '<div class="jm-score-circle">' + renderMatchCircle(job.matchScore) + '</div>';
    h += '<div class="jm-card-title-wrap">';
    h += '<a href="' + (job.url || '#') + '" target="_blank" rel="noopener" class="jm-card-title">' + escapeHtml(job.title || 'Untitled Job') + '</a>';
    h += '<div class="jm-card-meta">';
    if (job.budget) h += '<span class="jm-budget-badge">' + escapeHtml(job.budget) + '</span>';
    if (job.postedAt) h += '<span class="jm-posted">' + timeAgo(job.postedAt) + '</span>';
    h += '</div>';
    h += '</div></div>';

    // Description preview
    if (job.description) {
      var desc = job.description.length > 150 ? job.description.substring(0, 150) + '…' : job.description;
      h += '<div class="jm-card-desc">' + escapeHtml(desc) + '</div>';
    }

    // Skills overlap badges
    if (job.skills && job.skills.length > 0) {
      var normalizedUser = (userSkills || []).map(function (s) { return s.toLowerCase(); });
      h += '<div class="jm-card-skills">';
      job.skills.slice(0, 8).forEach(function (skill) {
        var isMatch = normalizedUser.some(function (us) {
          return us === skill.toLowerCase() || us.includes(skill.toLowerCase()) || skill.toLowerCase().includes(us);
        });
        h += '<span class="jm-skill-tag ' + (isMatch ? 'jm-skill-match' : '') + '">' + escapeHtml(skill) + '</span>';
      });
      h += '</div>';
    }

    // Bookmark button
    if (window.CortexJobBookmarks && typeof window.CortexJobBookmarks.renderSaveButton === 'function') {
      h += '<div class="jm-bookmark-slot">' + window.CortexJobBookmarks.renderSaveButton(job) + '</div>';
    }

    // Footer: match label + why tooltip + apply link
    h += '<div class="jm-card-footer">';

    // Proposal button slot
    h += '<div class="jm-proposal-slot" data-idx="' + (idx != null ? idx : 0) + '"></div>';
    h += '<span class="jm-match-label" style="color:' + matchColor(job.matchScore) + '">' + matchLabel(job.matchScore) + '</span>';

    // "Why this matches" tooltip
    h += '<span class="jm-why-wrap">';
    h += '<span class="jm-why-trigger" tabindex="0">Why this matches</span>';
    h += '<span class="jm-why-tooltip">';
    h += 'Skill overlap: ' + (job.skillOverlap || 0) + '%<br>';
    h += 'Rate fit: ' + (job.rateFit || 0) + '%<br>';
    h += 'Recency: ' + (job.recency || 0) + '%';
    h += '</span></span>';

    h += '<a href="' + (job.url || '#') + '" target="_blank" rel="noopener" class="jm-apply-link">View Job →</a>';
    h += '</div>';

    h += '</div>';
    return h;
  }

  // ─── Render loading state ─────────────────────────────────────────
  function renderLoading(container) {
    container.innerHTML =
      '<div class="jm-loading">' +
      '<div class="jm-loading-spinner"></div>' +
      '<div class="jm-loading-text">Finding jobs that match your profile...</div>' +
      '</div>';
    container.style.display = 'block';
  }

  // ─── Render error state ───────────────────────────────────────────
  function renderError(container, message) {
    container.innerHTML =
      '<div class="jm-error">' +
      '<span>⚠️ ' + escapeHtml(message || 'Could not load job matches.') + '</span>' +
      '</div>';
  }

  // ─── Render empty state ───────────────────────────────────────────
  function renderEmpty(container) {
    container.innerHTML =
      '<div class="jm-empty">' +
      '<span>🔍 No matching jobs found right now. Try again later!</span>' +
      '</div>';
  }

  // ─── Main render function ─────────────────────────────────────────
  function renderJobMatches(jobs, userSkills, container, profileData) {
    if (!container) return;

    if (!jobs || jobs.length === 0) {
      renderEmpty(container);
      return;
    }

    var h = '';
    h += '<div class="jm-header">';
    h += '<h3 class="jm-title">🎯 Best Jobs For You</h3>';
    h += '<span class="jm-count">' + jobs.length + ' matches found</span>';
    h += '</div>';

    h += '<div class="jm-grid">';
    jobs.forEach(function (job, idx) {
      h += renderJobCard(job, userSkills, idx);
    });
    h += '</div>';

    container.innerHTML = h;
    container.style.display = 'block';

    // Attach proposal generator buttons if available
    try {
      if (window.CortexProposalGenerator && typeof window.CortexProposalGenerator.renderProposalButton === 'function') {
        var slots = container.querySelectorAll('.jm-proposal-slot');
        slots.forEach(function(slot) {
          var idx = parseInt(slot.getAttribute('data-idx') || '0', 10);
          var job = jobs[idx];
          if (job && profileData) {
            window.CortexProposalGenerator.renderProposalButton(slot, job, profileData);
          }
        });
      }
    } catch (e) {
      console.warn('[U-017] Proposal button attach failed:', e);
    }
  }

  // ─── Fetch and render ─────────────────────────────────────────────
  function fetchAndRenderJobs(profileData, container) {
    if (!container) {
      container = document.getElementById('job-matches-section');
    }
    if (!container) return;

    var skills = profileData.skills || [];
    var title = profileData.title || '';
    var hourlyRate = 0;

    if (profileData.hourlyRate) {
      hourlyRate = parseFloat(String(profileData.hourlyRate).replace(/[^0-9.]/g, '')) || 0;
    }

    if (skills.length === 0) {
      // Nothing to search for
      container.style.display = 'none';
      return;
    }

    renderLoading(container);

    fetch('/api/upwork-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skills: skills,
        title: title,
        hourlyRate: hourlyRate,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.jobs) {
          renderJobMatches(data.jobs, skills, container, profileData);
        } else {
          renderEmpty(container);
        }
      })
      .catch(function (err) {
        console.warn('[U-015] Job matching error:', err);
        renderError(container, 'Could not load job matches. Please try again.');
      });
  }

  // ─── HTML escape ──────────────────────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ─── [CF-026] Job Match Percentage Calculator ────────────────────

  /** Experience level hierarchy for comparison */
  var EXP_LEVELS = { entry: 1, junior: 2, intermediate: 3, mid: 3, senior: 4, expert: 5, lead: 5 };

  function normalizeSkill(s) {
    return (s || '').toLowerCase().trim()
      .replace(/\.js$/i, '')
      .replace(/[-_]/g, ' ');
  }

  function skillsMatch(a, b) {
    var na = normalizeSkill(a);
    var nb = normalizeSkill(b);
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    // Common equivalences
    var equiv = {
      'react': ['reactjs', 'react js'],
      'node': ['nodejs', 'node js'],
      'vue': ['vuejs', 'vue js'],
      'angular': ['angularjs', 'angular js'],
      'typescript': ['ts'],
      'javascript': ['js'],
      'python': ['python3'],
      'postgres': ['postgresql'],
      'mongo': ['mongodb'],
    };
    for (var key in equiv) {
      var group = [key].concat(equiv[key]);
      var aIn = group.some(function (g) { return g === na; });
      var bIn = group.some(function (g) { return g === nb; });
      if (aIn && bIn) return true;
    }
    return false;
  }

  /**
   * Calculate how well a job matches a user's profile.
   * @param {object} jobData
   * @param {string[]} [jobData.skills] - Required skills
   * @param {string} [jobData.experienceLevel] - Required level (entry/junior/mid/senior/expert)
   * @param {number} [jobData.budget] - Offered rate (hourly) or fixed price
   * @param {string} [jobData.budgetType] - "hourly" or "fixed"
   * @param {number} [jobData.budgetMin] - Min budget range
   * @param {number} [jobData.budgetMax] - Max budget range
   * @param {object} profileData
   * @param {string[]} [profileData.skills] - User's skills
   * @param {number} [profileData.hourlyRate] - User's hourly rate
   * @param {string} [profileData.experienceLevel] - User's level
   * @returns {{matchPercent: number, matchedSkills: string[], missingSkills: string[], rateMatch: boolean, experienceMatch: boolean}}
   */
  function calculateJobMatch(jobData, profileData) {
    if (!jobData || !profileData) {
      return { matchPercent: 0, matchedSkills: [], missingSkills: [], rateMatch: false, experienceMatch: false };
    }

    var jobSkills = (jobData.skills || []);
    var userSkills = (profileData.skills || []);
    var matchedSkills = [];
    var missingSkills = [];

    // Skill matching
    jobSkills.forEach(function (js) {
      var found = userSkills.some(function (us) { return skillsMatch(js, us); });
      if (found) {
        matchedSkills.push(js);
      } else {
        missingSkills.push(js);
      }
    });

    var skillScore = jobSkills.length > 0
      ? (matchedSkills.length / jobSkills.length) * 100
      : 50; // No skills listed = neutral

    // Rate matching
    var rateMatch = true;
    var rateScore = 50; // neutral default
    var userRate = parseFloat(String(profileData.hourlyRate || '').replace(/[^0-9.]/g, '')) || 0;

    if (userRate > 0 && jobData.budgetType === 'hourly') {
      var jobBudget = parseFloat(jobData.budget) || 0;
      var budgetMin = parseFloat(jobData.budgetMin) || jobBudget * 0.8;
      var budgetMax = parseFloat(jobData.budgetMax) || jobBudget * 1.2;

      if (jobBudget > 0 || budgetMin > 0) {
        if (userRate >= budgetMin && userRate <= budgetMax) {
          rateMatch = true;
          rateScore = 100;
        } else if (userRate < budgetMin) {
          // User is cheaper — still a match (client saves)
          rateMatch = true;
          rateScore = 80;
        } else {
          // User rate exceeds budget
          var overBy = ((userRate - budgetMax) / budgetMax) * 100;
          if (overBy <= 20) {
            rateMatch = true;
            rateScore = 60;
          } else {
            rateMatch = false;
            rateScore = Math.max(10, 60 - overBy);
          }
        }
      }
    }

    // Experience level matching
    var experienceMatch = true;
    var expScore = 50;
    var jobLevel = EXP_LEVELS[(jobData.experienceLevel || '').toLowerCase()] || 0;
    var userLevel = EXP_LEVELS[(profileData.experienceLevel || '').toLowerCase()] || 0;

    if (jobLevel > 0 && userLevel > 0) {
      if (userLevel >= jobLevel) {
        experienceMatch = true;
        expScore = 100;
      } else if (userLevel === jobLevel - 1) {
        experienceMatch = true;
        expScore = 60;
      } else {
        experienceMatch = false;
        expScore = 20;
      }
    }

    // Weighted total: skills 60%, rate 25%, experience 15%
    var matchPercent = Math.round(
      (skillScore * 0.60) +
      (rateScore * 0.25) +
      (expScore * 0.15)
    );
    matchPercent = Math.max(0, Math.min(100, matchPercent));

    return {
      matchPercent: matchPercent,
      matchedSkills: matchedSkills,
      missingSkills: missingSkills,
      rateMatch: rateMatch,
      experienceMatch: experienceMatch,
    };
  }

  // ─── [CF-026] Batch matching ──────────────────────────────────────

  /**
   * Calculate match percentage for multiple jobs at once.
   * @param {object[]} jobs - Array of job data objects
   * @param {object} profileData - User profile
   * @param {object} [options]
   * @param {number} [options.minMatch] - Minimum match % to include (default 0)
   * @param {string} [options.sortBy] - 'matchPercent' (default) or 'missingSkills'
   * @param {number} [options.limit] - Max results to return (default all)
   * @returns {Object[]} Array of { job, match } sorted by match desc
   */
  function batchMatch(jobs, profileData, options) {
    if (!Array.isArray(jobs) || !profileData) return [];
    options = options || {};
    var minMatch = options.minMatch || 0;
    var sortBy = options.sortBy || 'matchPercent';
    var limit = options.limit || 0;

    var results = [];
    for (var i = 0; i < jobs.length; i++) {
      var match = calculateJobMatch(jobs[i], profileData);
      if (match.matchPercent >= minMatch) {
        results.push({ job: jobs[i], match: match });
      }
    }

    results.sort(function (a, b) {
      if (sortBy === 'missingSkills') {
        return a.match.missingSkills.length - b.match.missingSkills.length;
      }
      return b.match.matchPercent - a.match.matchPercent;
    });

    if (limit > 0) results = results.slice(0, limit);
    return results;
  }

  /**
   * Get a skill gap analysis across multiple jobs.
   * @param {object[]} jobs - Array of job data objects
   * @param {object} profileData - User profile
   * @returns {Object[]} Array of { skill, demandCount, isOwned } sorted by demand desc
   */
  function getSkillGapAnalysis(jobs, profileData) {
    if (!Array.isArray(jobs) || !profileData) return [];

    var userSkills = (profileData.skills || []);
    var skillDemand = {};

    for (var i = 0; i < jobs.length; i++) {
      var jobSkills = jobs[i].skills || [];
      for (var j = 0; j < jobSkills.length; j++) {
        var norm = normalizeSkill(jobSkills[j]);
        if (!skillDemand[norm]) {
          skillDemand[norm] = { skill: jobSkills[j], count: 0, isOwned: false };
        }
        skillDemand[norm].count++;
      }
    }

    // Mark owned skills
    for (var k = 0; k < userSkills.length; k++) {
      var normUser = normalizeSkill(userSkills[k]);
      var keys = Object.keys(skillDemand);
      for (var m = 0; m < keys.length; m++) {
        if (skillsMatch(userSkills[k], skillDemand[keys[m]].skill)) {
          skillDemand[keys[m]].isOwned = true;
        }
      }
    }

    var results = [];
    var dKeys = Object.keys(skillDemand);
    for (var n = 0; n < dKeys.length; n++) {
      results.push({
        skill: skillDemand[dKeys[n]].skill,
        demandCount: skillDemand[dKeys[n]].count,
        isOwned: skillDemand[dKeys[n]].isOwned
      });
    }

    results.sort(function (a, b) { return b.demandCount - a.demandCount; });
    return results;
  }

  // ─── [CF-026] Match detail renderer ─────────────────────────────

  /**
   * Render a detailed match breakdown for a single job.
   * Shows match %, matched/missing skills, rate fit, experience fit.
   * @param {object} jobData
   * @param {object} profileData
   * @param {string|HTMLElement} container
   */
  function renderMatchDetail(jobData, profileData, container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container || !jobData || !profileData) return;

    var match = calculateJobMatch(jobData, profileData);
    var mc = matchColor(match.matchPercent);

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e0e0e0;border-radius:16px;overflow:hidden;border:1px solid #222;max-width:560px;">';

    // Header
    html += '<div style="padding:20px 24px;background:linear-gradient(135deg,#0a1a0a,#0a0a2e);border-bottom:1px solid #222;display:flex;align-items:center;gap:16px;">';
    html += renderMatchCircle(match.matchPercent);
    html += '<div>';
    html += '<h3 style="margin:0;font-size:16px;font-weight:700;color:#fff;">' + escapeHtml(jobData.title || 'Job Match') + '</h3>';
    html += '<div style="font-size:13px;color:' + mc + ';font-weight:600;margin-top:2px;">' + matchLabel(match.matchPercent) + '</div>';
    html += '</div></div>';

    // Factors
    html += '<div style="display:flex;border-bottom:1px solid #222;">';
    html += '<div style="flex:1;padding:12px 16px;text-align:center;border-right:1px solid #1a1a1a;">' +
      '<div style="font-size:18px;font-weight:800;color:' + (match.matchedSkills.length > 0 ? '#00ff88' : '#ff4444') + ';">' + match.matchedSkills.length + '/' + ((jobData.skills || []).length || '?') + '</div>' +
      '<div style="font-size:11px;color:#666;text-transform:uppercase;">Skills</div></div>';
    html += '<div style="flex:1;padding:12px 16px;text-align:center;border-right:1px solid #1a1a1a;">' +
      '<div style="font-size:18px;font-weight:800;color:' + (match.rateMatch ? '#00ff88' : '#ff4444') + ';">' + (match.rateMatch ? 'Yes' : 'No') + '</div>' +
      '<div style="font-size:11px;color:#666;text-transform:uppercase;">Rate Fit</div></div>';
    html += '<div style="flex:1;padding:12px 16px;text-align:center;">' +
      '<div style="font-size:18px;font-weight:800;color:' + (match.experienceMatch ? '#00ff88' : '#ff4444') + ';">' + (match.experienceMatch ? 'Yes' : 'No') + '</div>' +
      '<div style="font-size:11px;color:#666;text-transform:uppercase;">Exp. Fit</div></div>';
    html += '</div>';

    // Matched skills
    if (match.matchedSkills.length > 0) {
      html += '<div style="padding:14px 24px;border-bottom:1px solid #111;">';
      html += '<div style="font-size:12px;color:#00ff88;font-weight:600;margin-bottom:8px;text-transform:uppercase;">Matched Skills</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      for (var i = 0; i < match.matchedSkills.length; i++) {
        html += '<span style="font-size:12px;padding:4px 12px;border-radius:12px;background:#00ff8815;color:#00ff88;border:1px solid #00ff8830;">' + escapeHtml(match.matchedSkills[i]) + '</span>';
      }
      html += '</div></div>';
    }

    // Missing skills
    if (match.missingSkills.length > 0) {
      html += '<div style="padding:14px 24px;border-bottom:1px solid #111;">';
      html += '<div style="font-size:12px;color:#ff4444;font-weight:600;margin-bottom:8px;text-transform:uppercase;">Missing Skills — Learn These</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      for (var j = 0; j < match.missingSkills.length; j++) {
        html += '<span style="font-size:12px;padding:4px 12px;border-radius:12px;background:#ff444415;color:#ff4444;border:1px solid #ff444430;">' + escapeHtml(match.missingSkills[j]) + '</span>';
      }
      html += '</div></div>';
    }

    // Recommendation
    html += '<div style="padding:14px 24px;font-size:13px;color:#888;">';
    if (match.matchPercent >= 80) {
      html += 'Strong match — this job aligns well with your profile. Apply with confidence.';
    } else if (match.matchPercent >= 60) {
      html += 'Good fit overall. Highlight your relevant experience' + (match.missingSkills.length > 0 ? ' and mention willingness to learn ' + escapeHtml(match.missingSkills[0]) : '') + '.';
    } else if (match.matchPercent >= 40) {
      html += 'Partial match. Consider if the missing skills are learnable quickly or if you have equivalent experience.';
    } else {
      html += 'Low match. This job requires skills significantly different from your profile.';
    }
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Public API ───────────────────────────────────────────────────
  window.CortexJobMatcher = {
    fetchAndRenderJobs: fetchAndRenderJobs,
    renderJobMatches: renderJobMatches,
    renderLoading: renderLoading,
    calculateJobMatch: calculateJobMatch,
    batchMatch: batchMatch,
    getSkillGapAnalysis: getSkillGapAnalysis,
    renderMatchDetail: renderMatchDetail,
  };

  window.CortexFreelancer.JobMatcher = {
    calculateJobMatch: calculateJobMatch,
    batchMatch: batchMatch,
    getSkillGapAnalysis: getSkillGapAnalysis,
    renderMatchDetail: renderMatchDetail,
    version: '1.1.0',
  };

})();
