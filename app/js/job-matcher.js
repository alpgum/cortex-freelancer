/**
 * [U-015] Job Matcher — Client-side renderer
 *
 * Takes profile data + jobs array → renders "🎯 Best Jobs For You" card grid.
 * Each card: title, budget badge, match score %, skill overlap badges, Apply link.
 */

(function () {
  'use strict';

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
  function renderJobCard(job, userSkills) {
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

    // Footer: match label + why tooltip + apply link
    h += '<div class="jm-card-footer">';
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
  function renderJobMatches(jobs, userSkills, container) {
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
    jobs.forEach(function (job) {
      h += renderJobCard(job, userSkills);
    });
    h += '</div>';

    container.innerHTML = h;
    container.style.display = 'block';
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
          renderJobMatches(data.jobs, skills, container);
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

  // ─── Public API ───────────────────────────────────────────────────
  window.CortexJobMatcher = {
    fetchAndRenderJobs: fetchAndRenderJobs,
    renderJobMatches: renderJobMatches,
    renderLoading: renderLoading,
  };

})();
