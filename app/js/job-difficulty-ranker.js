/**
 * [CF-154] Job Difficulty Ranker
 * Adds personalized difficulty scoring and badges to job digest listings.
 * Scores based on skill requirements, budget/scope ratio, deadline pressure,
 * and technical complexity. Includes difficulty filter bar.
 */
(function () {
  'use strict';

  var SKILL_LEVEL_KEY = 'cortex_user_skill_level';
  var DIFFICULTY_FILTER_KEY = 'cortex_difficulty_filter';

  /* ── Complexity Keywords ── */

  var COMPLEXITY_TIERS = {
    expert: ['machine learning', 'ai', 'deep learning', 'blockchain', 'smart contract', 'computer vision', 'nlp', 'natural language', 'distributed system', 'real-time', 'webgl', 'threejs', '3d', 'ar/vr', 'augmented reality', 'virtual reality', 'compiler', 'kernel', 'embedded', 'fpga', 'cuda', 'high-frequency', 'cryptography'],
    hard: ['microservices', 'kubernetes', 'devops', 'ci/cd', 'scalable', 'architecture', 'system design', 'security', 'compliance', 'hipaa', 'pci', 'gdpr', 'payment integration', 'stripe', 'oauth', 'saml', 'elasticsearch', 'redis', 'graphql', 'websocket', 'video streaming', 'react native', 'flutter', 'ios', 'android'],
    medium: ['api', 'rest', 'database', 'sql', 'mongodb', 'firebase', 'aws', 'docker', 'typescript', 'react', 'vue', 'angular', 'node', 'python', 'django', 'flask', 'authentication', 'responsive', 'testing', 'unit test', 'e-commerce'],
    easy: ['html', 'css', 'wordpress', 'wix', 'squarespace', 'shopify', 'landing page', 'blog', 'data entry', 'copy', 'content', 'email template', 'basic website', 'logo', 'banner', 'social media', 'photoshop', 'canva']
  };

  var DEADLINE_PRESSURE_SIGNALS = ['asap', 'urgent', 'immediately', 'rush', 'tight deadline', 'this week', 'tomorrow', 'today', '24 hours', '48 hours', 'fast turnaround'];

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function getUserSkillLevel() {
    try { return localStorage.getItem(SKILL_LEVEL_KEY) || 'intermediate'; }
    catch (e) { return 'intermediate'; }
  }

  function setUserSkillLevel(level) {
    try { localStorage.setItem(SKILL_LEVEL_KEY, level); } catch (e) {}
  }

  function getActiveFilters() {
    try { return JSON.parse(localStorage.getItem(DIFFICULTY_FILTER_KEY)) || { easy: true, medium: true, hard: true, expert: true }; }
    catch (e) { return { easy: true, medium: true, hard: true, expert: true }; }
  }

  function saveActiveFilters(filters) {
    try { localStorage.setItem(DIFFICULTY_FILTER_KEY, JSON.stringify(filters)); } catch (e) {}
  }

  function countMatches(text, keywords) {
    var lower = text.toLowerCase();
    var count = 0;
    keywords.forEach(function (kw) {
      if (lower.indexOf(kw) >= 0) count++;
    });
    return count;
  }

  /* ── Difficulty Scoring ── */

  function scoreDifficulty(jobText) {
    var lower = jobText.toLowerCase();
    var userLevel = getUserSkillLevel();

    // Factor 1: Technical complexity keywords (0-40 points)
    var expertHits = countMatches(lower, COMPLEXITY_TIERS.expert);
    var hardHits = countMatches(lower, COMPLEXITY_TIERS.hard);
    var mediumHits = countMatches(lower, COMPLEXITY_TIERS.medium);
    var easyHits = countMatches(lower, COMPLEXITY_TIERS.easy);

    var complexityScore = Math.min(expertHits * 12 + hardHits * 7 + mediumHits * 3 + easyHits * 0.5, 40);

    // Factor 2: Skill requirements count (0-20 points)
    var skillKeywords = ['react', 'node', 'javascript', 'typescript', 'python', 'php', 'laravel', 'vue', 'angular', 'next.js', 'figma', 'photoshop', 'wordpress', 'shopify', 'api', 'aws', 'docker', 'sql', 'mongodb', 'firebase', 'tailwind', 'css', 'html', 'seo', 'flutter', 'swift', 'kotlin', 'java', 'go', 'rust', 'django', 'flask', 'ruby', 'rails', '.net', 'c#', 'graphql', 'redis', 'elasticsearch', 'kubernetes', 'terraform'];
    var skillCount = countMatches(lower, skillKeywords);
    var skillScore = Math.min(skillCount * 3.5, 20);

    // Factor 3: Budget/scope ratio (0-20 points) — low budget + high scope = harder
    var budgetMatch = jobText.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    var budget = budgetMatch ? parseFloat(budgetMatch[1].replace(/,/g, '')) : 0;
    var wordCount = jobText.split(/\s+/).length;

    var budgetScopeScore = 0;
    if (budget > 0 && wordCount > 0) {
      var budgetPerWord = budget / wordCount;
      // Lower budget per word of description = harder project
      if (budgetPerWord < 5) budgetScopeScore = 18;
      else if (budgetPerWord < 10) budgetScopeScore = 14;
      else if (budgetPerWord < 20) budgetScopeScore = 8;
      else if (budgetPerWord < 40) budgetScopeScore = 4;
      else budgetScopeScore = 1;
    } else if (budget === 0 && skillCount > 3) {
      // No budget listed but many skills — likely undervalued
      budgetScopeScore = 12;
    }

    // Factor 4: Deadline pressure (0-20 points)
    var deadlineHits = countMatches(lower, DEADLINE_PRESSURE_SIGNALS);
    var deadlineScore = Math.min(deadlineHits * 8, 20);

    // Total raw score (0-100)
    var rawScore = complexityScore + skillScore + budgetScopeScore + deadlineScore;

    // Adjust for user skill level
    var levelMultiplier = {
      beginner: 1.3,
      intermediate: 1.0,
      advanced: 0.75,
      expert: 0.55
    };

    var adjustedScore = Math.round(rawScore * (levelMultiplier[userLevel] || 1.0));
    adjustedScore = Math.max(0, Math.min(100, adjustedScore));

    // Classify
    var level, color, label;
    if (adjustedScore <= 25) { level = 'easy'; color = 'var(--green)'; label = 'Easy'; }
    else if (adjustedScore <= 50) { level = 'medium'; color = '#ffc800'; label = 'Medium'; }
    else if (adjustedScore <= 75) { level = 'hard'; color = 'var(--orange)'; label = 'Hard'; }
    else { level = 'expert'; color = 'var(--red)'; label = 'Expert'; }

    return {
      score: adjustedScore,
      level: level,
      color: color,
      label: label,
      breakdown: {
        complexity: Math.round(complexityScore),
        skills: Math.round(skillScore),
        budgetScope: Math.round(budgetScopeScore),
        deadline: Math.round(deadlineScore)
      }
    };
  }

  /* ── UI: Filter Bar ── */

  function buildFilterBar() {
    var filters = getActiveFilters();
    var userLevel = getUserSkillLevel();

    var bar = document.createElement('div');
    bar.id = 'difficulty-filter-bar';
    bar.style.cssText = 'background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius);padding:1.25rem 1.5rem;margin-bottom:1.5rem;';

    var levels = [
      { key: 'easy', label: 'Easy', color: 'var(--green)', bg: 'rgba(0,255,136,.1)' },
      { key: 'medium', label: 'Medium', color: '#ffc800', bg: 'rgba(255,200,0,.1)' },
      { key: 'hard', label: 'Hard', color: 'var(--orange)', bg: 'rgba(255,136,68,.1)' },
      { key: 'expert', label: 'Expert', color: 'var(--red)', bg: 'rgba(255,68,68,.1)' }
    ];

    var skillLevels = [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
      { value: 'expert', label: 'Expert' }
    ];

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">' +
      '<div>' +
        '<h3 style="font-size:.75rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:.5rem">Difficulty Filter</h3>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">';

    levels.forEach(function (lvl) {
      var isActive = filters[lvl.key];
      html += '<button class="diff-filter-btn" data-difficulty="' + lvl.key + '" style="padding:.4rem .9rem;border-radius:100px;font-size:.78rem;font-weight:700;border:1px solid ' +
        (isActive ? lvl.color : 'rgba(255,255,255,.1)') + ';background:' +
        (isActive ? lvl.bg : 'var(--bg3)') + ';color:' +
        (isActive ? lvl.color : 'var(--text3)') + ';cursor:pointer;font-family:inherit;transition:all .2s;letter-spacing:.3px">' +
        lvl.label + ' <span class="diff-count" data-count-for="' + lvl.key + '">0</span></button>';
    });

    html += '</div></div>' +
      '<div>' +
        '<label style="display:block;font-size:.68rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Your Skill Level</label>' +
        '<select id="user-skill-level" style="background:var(--bg3);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:.4rem .7rem;color:var(--text);font-size:.82rem;font-family:inherit;outline:none;appearance:auto;cursor:pointer" aria-label="Your skill level">';

    skillLevels.forEach(function (sl) {
      html += '<option value="' + sl.value + '"' + (userLevel === sl.value ? ' selected' : '') + '>' + sl.label + '</option>';
    });

    html += '</select></div></div>';

    bar.innerHTML = html;
    return bar;
  }

  /* ── UI: Badge Injection ── */

  function createBadge(difficulty) {
    var bgMap = { easy: 'rgba(0,255,136,.12)', medium: 'rgba(255,200,0,.12)', hard: 'rgba(255,136,68,.12)', expert: 'rgba(255,68,68,.12)' };
    var badge = document.createElement('span');
    badge.className = 'difficulty-badge';
    badge.setAttribute('data-difficulty', difficulty.level);
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:700;padding:.15rem .55rem;border-radius:100px;letter-spacing:.3px;color:' + difficulty.color + ';background:' + (bgMap[difficulty.level] || bgMap.medium) + ';white-space:nowrap;';
    badge.innerHTML = difficulty.label + ' <span style="opacity:.7">' + difficulty.score + '</span>';
    badge.title = 'Difficulty: ' + difficulty.label + ' (' + difficulty.score + '/100)\nComplexity: ' + difficulty.breakdown.complexity + '/40\nSkills: ' + difficulty.breakdown.skills + '/20\nBudget/Scope: ' + difficulty.breakdown.budgetScope + '/20\nDeadline: ' + difficulty.breakdown.deadline + '/20';
    return badge;
  }

  /* ── Core Processing ── */

  function processDigestJobs() {
    var digestBody = document.querySelector('.digest-body');
    if (!digestBody) return;

    var jobElements = digestBody.querySelectorAll('.digest-job');
    if (!jobElements.length) return;

    var counts = { easy: 0, medium: 0, hard: 0, expert: 0 };
    var filters = getActiveFilters();

    jobElements.forEach(function (jobEl) {
      // Remove existing badge if re-processing
      var existingBadge = jobEl.querySelector('.difficulty-badge');
      if (existingBadge) existingBadge.remove();

      // Extract text
      var titleEl = jobEl.querySelector('.digest-job-title');
      var metaEl = jobEl.querySelector('.digest-job-meta');
      var skillsEl = jobEl.querySelector('.digest-job-skills');

      var jobText = '';
      if (titleEl) jobText += titleEl.textContent + ' ';
      if (metaEl) jobText += metaEl.textContent + ' ';
      if (skillsEl) jobText += skillsEl.textContent + ' ';

      var difficulty = scoreDifficulty(jobText);

      // Add badge to title area
      if (titleEl) {
        var badge = createBadge(difficulty);
        badge.style.marginLeft = '.5rem';
        badge.style.verticalAlign = 'middle';
        titleEl.appendChild(badge);
      }

      // Set data attribute for filtering
      jobEl.setAttribute('data-difficulty', difficulty.level);
      counts[difficulty.level]++;

      // Apply filter visibility
      if (filters[difficulty.level]) {
        jobEl.style.display = '';
      } else {
        jobEl.style.display = 'none';
      }
    });

    // Update counts in filter bar
    Object.keys(counts).forEach(function (level) {
      var countEl = document.querySelector('[data-count-for="' + level + '"]');
      if (countEl) countEl.textContent = counts[level];
    });
  }

  /* ── Event Binding ── */

  function bindFilterEvents() {
    var bar = document.getElementById('difficulty-filter-bar');
    if (!bar) return;

    // Filter buttons
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.diff-filter-btn');
      if (!btn) return;

      var difficulty = btn.getAttribute('data-difficulty');
      var filters = getActiveFilters();
      filters[difficulty] = !filters[difficulty];
      saveActiveFilters(filters);

      // Update button style
      var levels = {
        easy: { color: 'var(--green)', bg: 'rgba(0,255,136,.1)' },
        medium: { color: '#ffc800', bg: 'rgba(255,200,0,.1)' },
        hard: { color: 'var(--orange)', bg: 'rgba(255,136,68,.1)' },
        expert: { color: 'var(--red)', bg: 'rgba(255,68,68,.1)' }
      };

      var lvl = levels[difficulty];
      if (filters[difficulty]) {
        btn.style.borderColor = lvl.color;
        btn.style.background = lvl.bg;
        btn.style.color = lvl.color;
      } else {
        btn.style.borderColor = 'rgba(255,255,255,.1)';
        btn.style.background = 'var(--bg3)';
        btn.style.color = 'var(--text3)';
      }

      // Apply filter to jobs
      applyFilters();

      try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-difficulty-ranker', action: 'filter_toggle', difficulty: difficulty, active: filters[difficulty] }); } catch (e) {}
    });

    // Skill level selector
    var skillSelect = document.getElementById('user-skill-level');
    if (skillSelect) {
      skillSelect.addEventListener('change', function () {
        setUserSkillLevel(skillSelect.value);
        processDigestJobs();
        try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-difficulty-ranker', action: 'set_skill_level', level: skillSelect.value }); } catch (e) {}
      });
    }
  }

  function applyFilters() {
    var filters = getActiveFilters();
    var jobs = document.querySelectorAll('.digest-job[data-difficulty]');

    jobs.forEach(function (job) {
      var level = job.getAttribute('data-difficulty');
      job.style.display = filters[level] ? '' : 'none';
    });
  }

  /* ── Init ── */

  document.addEventListener('DOMContentLoaded', function () {
    // Insert filter bar before the digest preview
    var digestPreview = document.getElementById('digest-preview');
    if (!digestPreview) return;

    var filterBar = buildFilterBar();
    digestPreview.parentNode.insertBefore(filterBar, digestPreview);
    bindFilterEvents();

    // Observe digest envelope for rendered jobs
    var envelope = document.getElementById('digest-envelope');
    if (envelope) {
      var observer = new MutationObserver(function (mutations) {
        var hasNewContent = false;
        mutations.forEach(function (m) {
          if (m.addedNodes.length > 0) hasNewContent = true;
        });
        if (hasNewContent) {
          setTimeout(processDigestJobs, 150);
        }
      });

      observer.observe(envelope, { childList: true, subtree: true });
    }

    // Process any existing jobs
    setTimeout(processDigestJobs, 300);

    // Expose API
    window.CortexDifficultyRanker = {
      score: scoreDifficulty,
      process: processDigestJobs,
      getSkillLevel: getUserSkillLevel,
      setSkillLevel: function (level) {
        setUserSkillLevel(level);
        var select = document.getElementById('user-skill-level');
        if (select) select.value = level;
        processDigestJobs();
      }
    };

    try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-difficulty-ranker', action: 'init' }); } catch (e) {}
  });
})();
