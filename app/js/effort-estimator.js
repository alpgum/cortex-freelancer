/**
 * [CF-143] Effort Estimator with Story Points
 * Parses scope/deliverables text into tasks, assigns story points based on
 * complexity keywords, and provides a breakdown table with effort summary.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_effort_estimates';

  /* ══════════════════════════════════════════════
   * COMPLEXITY KEYWORD DICTIONARIES
   * ══════════════════════════════════════════════ */
  var COMPLEXITY_KEYWORDS = {
    trivial: {
      points: 1,
      hoursPerPoint: 1.5,
      keywords: [
        'typo', 'fix typo', 'text change', 'copy update', 'color change',
        'font change', 'rename', 'reword', 'label', 'placeholder',
        'tooltip', 'favicon', 'alt text', 'meta tag', 'title tag',
        'simple update', 'minor fix', 'small tweak', 'quick fix',
      ],
    },
    simple: {
      points: 2,
      hoursPerPoint: 2,
      keywords: [
        'button', 'link', 'icon', 'image', 'banner', 'badge', 'tag',
        'modal', 'popup', 'alert', 'notification', 'toast', 'dropdown',
        'toggle', 'checkbox', 'radio', 'input field', 'text field',
        'contact form', 'newsletter signup', 'email subscription',
        'breadcrumb', 'pagination', 'loading spinner', 'skeleton',
        'hover effect', 'animation', 'transition', 'css fix',
        'responsive fix', 'mobile fix', 'styling', 'layout fix',
      ],
    },
    moderate: {
      points: 3,
      hoursPerPoint: 2.5,
      keywords: [
        'form', 'form validation', 'search', 'search bar', 'filter',
        'sort', 'table', 'data table', 'list view', 'grid view',
        'carousel', 'slider', 'tabs', 'accordion', 'sidebar',
        'navigation', 'menu', 'header', 'footer', 'section',
        'landing page', 'about page', 'faq', 'testimonials',
        'pricing table', 'feature comparison', 'gallery', 'lightbox',
        'share button', 'social links', 'embed', 'iframe',
        'cookie consent', 'gdpr', 'terms page', 'privacy page',
        'sitemap', 'robots.txt', 'redirect', '404 page',
        'email template', 'pdf export', 'print stylesheet',
      ],
    },
    complex: {
      points: 5,
      hoursPerPoint: 3,
      keywords: [
        'authentication', 'login', 'signup', 'registration', 'oauth',
        'password reset', 'two-factor', '2fa', 'user profile',
        'dashboard', 'admin panel', 'cms', 'blog', 'blog post',
        'comments', 'comment system', 'reviews', 'ratings',
        'shopping cart', 'wishlist', 'favorites', 'bookmarks',
        'file upload', 'image upload', 'drag and drop', 'drag drop',
        'rich text editor', 'wysiwyg', 'markdown editor',
        'charts', 'graphs', 'data visualization', 'analytics',
        'map', 'google maps', 'location', 'geolocation',
        'notifications', 'push notifications', 'email notifications',
        'api integration', 'third-party api', 'webhook',
        'multi-language', 'i18n', 'internationalization', 'localization',
        'accessibility', 'a11y', 'wcag', 'aria',
        'seo optimization', 'performance optimization', 'caching',
        'database', 'crud', 'rest api', 'graphql',
      ],
    },
    very_complex: {
      points: 8,
      hoursPerPoint: 3.5,
      keywords: [
        'checkout', 'payment', 'stripe', 'paypal', 'payment gateway',
        'subscription', 'recurring billing', 'invoice',
        'e-commerce', 'product catalog', 'inventory', 'order management',
        'user roles', 'permissions', 'rbac', 'access control',
        'real-time', 'websocket', 'live chat', 'chat system',
        'search engine', 'elasticsearch', 'full-text search', 'algolia',
        'video streaming', 'video player', 'audio player',
        'calendar', 'scheduling', 'booking system', 'appointment',
        'workflow', 'state machine', 'approval process',
        'import', 'export', 'csv import', 'bulk operations',
        'multi-step form', 'wizard', 'onboarding flow',
        'testing', 'test suite', 'ci/cd', 'deployment pipeline',
        'migration', 'data migration', 'database migration',
        'responsive design', 'cross-browser', 'progressive web app', 'pwa',
      ],
    },
    epic: {
      points: 13,
      hoursPerPoint: 4,
      keywords: [
        'marketplace', 'platform', 'saas', 'multi-tenant',
        'machine learning', 'ai', 'artificial intelligence', 'recommendation engine',
        'blockchain', 'smart contract', 'nft',
        'microservices', 'distributed system', 'event-driven',
        'mobile app', 'native app', 'react native', 'flutter',
        'custom cms', 'headless cms', 'content management system',
        'social network', 'social platform', 'community',
        'complete redesign', 'full rebuild', 'rewrite', 'replatform',
        'white-label', 'multi-brand', 'franchise system',
        'data pipeline', 'etl', 'data warehouse',
        'compliance', 'hipaa', 'pci', 'soc2', 'gdpr compliance',
        'enterprise integration', 'erp', 'crm integration',
      ],
    },
  };

  var COMPLEXITY_ORDER = ['trivial', 'simple', 'moderate', 'complex', 'very_complex', 'epic'];

  /* ══════════════════════════════════════════════
   * TASK PARSING
   * ══════════════════════════════════════════════ */
  function parseTasksFromText(text) {
    if (!text || !text.trim()) return [];

    var lines = text.split(/\n/);
    var tasks = [];
    var currentGroup = '';

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;

      // Detect section headers (lines ending with colon, or all caps, or markdown headers)
      if (/^#{1,3}\s+/.test(trimmed)) {
        currentGroup = trimmed.replace(/^#{1,3}\s+/, '').replace(/:$/, '').trim();
        return;
      }
      if (/^[A-Z][A-Z\s]{3,}:?$/.test(trimmed)) {
        currentGroup = trimmed.replace(/:$/, '').trim();
        return;
      }
      if (/^[^-*\d].*:$/.test(trimmed) && trimmed.length < 60) {
        currentGroup = trimmed.replace(/:$/, '').trim();
        return;
      }

      // Extract task lines (bullet points, numbered lists, or plain sentences with deliverable keywords)
      var taskText = trimmed
        .replace(/^[-*+]\s+/, '')           // bullet points
        .replace(/^\d+[.)]\s+/, '')         // numbered lists
        .replace(/^\[[ x]?\]\s*/i, '')      // checkboxes
        .replace(/^>\s+/, '')               // blockquotes
        .trim();

      if (taskText.length < 3) return;

      // Skip pure comment/note lines
      if (/^(note|comment|fyi|ps|p\.s|btw|context):/i.test(taskText)) return;

      tasks.push({
        text: taskText,
        group: currentGroup || 'General',
      });
    });

    // If no tasks were parsed from line-by-line, try sentence splitting
    if (tasks.length === 0) {
      var sentences = text.split(/[.;]\s+/).filter(function (s) { return s.trim().length > 10; });
      sentences.forEach(function (s) {
        tasks.push({ text: s.trim(), group: 'General' });
      });
    }

    return tasks;
  }

  /* ══════════════════════════════════════════════
   * COMPLEXITY ASSESSMENT
   * ══════════════════════════════════════════════ */
  function assessComplexity(taskText) {
    var lower = taskText.toLowerCase();
    var bestMatch = null;
    var bestScore = 0;

    COMPLEXITY_ORDER.forEach(function (level) {
      var config = COMPLEXITY_KEYWORDS[level];
      var score = 0;

      config.keywords.forEach(function (kw) {
        if (lower.indexOf(kw.toLowerCase()) !== -1) {
          // Weight longer keyword matches higher (more specific)
          score += kw.split(' ').length;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = level;
      }
    });

    // Default to moderate if no keywords matched
    if (!bestMatch) {
      // Heuristic: longer descriptions tend to be more complex
      var wordCount = taskText.split(/\s+/).length;
      if (wordCount > 20) bestMatch = 'complex';
      else if (wordCount > 10) bestMatch = 'moderate';
      else bestMatch = 'simple';
    }

    return bestMatch;
  }

  function getComplexityConfig(level) {
    return COMPLEXITY_KEYWORDS[level] || COMPLEXITY_KEYWORDS.moderate;
  }

  /* ══════════════════════════════════════════════
   * ESTIMATION ENGINE
   * ══════════════════════════════════════════════ */
  function estimateEffort(text) {
    var tasks = parseTasksFromText(text);
    if (tasks.length === 0) return null;

    var estimatedTasks = [];
    var totalPoints = 0;
    var totalHours = 0;
    var complexityDistribution = {};

    COMPLEXITY_ORDER.forEach(function (level) {
      complexityDistribution[level] = 0;
    });

    tasks.forEach(function (task) {
      var complexity = assessComplexity(task.text);
      var config = getComplexityConfig(complexity);
      var points = config.points;
      var hours = Math.round(points * config.hoursPerPoint * 10) / 10;

      estimatedTasks.push({
        text: task.text,
        group: task.group,
        complexity: complexity,
        points: points,
        hours: hours,
      });

      totalPoints += points;
      totalHours += hours;
      complexityDistribution[complexity] = (complexityDistribution[complexity] || 0) + 1;
    });

    // Sprint and team calculations
    var hoursPerSprint = 40; // 1 week sprint for solo freelancer
    var sprintCount = Math.ceil(totalHours / hoursPerSprint);
    var recommendedTeamSize = 1;
    if (totalPoints > 80) recommendedTeamSize = 3;
    else if (totalPoints > 40) recommendedTeamSize = 2;

    // Velocity (typical freelancer: 20-30 points per sprint)
    var velocity = 25;
    var sprintsByVelocity = Math.ceil(totalPoints / velocity);

    return {
      tasks: estimatedTasks,
      totalPoints: totalPoints,
      totalHours: Math.round(totalHours * 10) / 10,
      taskCount: estimatedTasks.length,
      complexityDistribution: complexityDistribution,
      sprintCount: Math.max(sprintCount, sprintsByVelocity),
      recommendedTeamSize: recommendedTeamSize,
      velocity: velocity,
    };
  }

  /* ══════════════════════════════════════════════
   * PERSISTENCE
   * ══════════════════════════════════════════════ */
  function saveEstimate(estimate) {
    var history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) {}
    history.unshift({
      timestamp: new Date().toISOString(),
      totalPoints: estimate.totalPoints,
      totalHours: estimate.totalHours,
      taskCount: estimate.taskCount,
      sprintCount: estimate.sprintCount,
    });
    if (history.length > 30) history = history.slice(0, 30);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * UI BUILDING
   * ══════════════════════════════════════════════ */
  var COMPLEXITY_LABELS = {
    trivial: { label: 'Trivial', color: '#66ddaa', icon: '&#9679;' },
    simple: { label: 'Simple', color: 'var(--green)', icon: '&#9679;' },
    moderate: { label: 'Moderate', color: '#ffc800', icon: '&#9679;' },
    complex: { label: 'Complex', color: 'var(--orange)', icon: '&#9679;' },
    very_complex: { label: 'Very Complex', color: '#ff6622', icon: '&#9679;' },
    epic: { label: 'Epic', color: 'var(--red)', icon: '&#9679;' },
  };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function renderEstimation(estimate) {
    var panel = document.getElementById('effort-estimator-results');
    if (!panel) return;

    if (!estimate || estimate.tasks.length === 0) {
      panel.innerHTML = '<div style="background:rgba(255,200,0,.08);border:1px solid rgba(255,200,0,.15);border-radius:var(--radius);padding:1.25rem;text-align:center;color:#ffc800;font-weight:600;font-size:.88rem">No tasks could be parsed. Try pasting a deliverables list or project scope description.</div>';
      panel.style.display = 'block';
      return;
    }

    var html = '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius);padding:1.5rem">';

    // Summary cards
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1.5rem">';

    html += buildSummaryCard('Total Story Points', estimate.totalPoints + ' SP', 'var(--orange)');
    html += buildSummaryCard('Estimated Hours', estimate.totalHours + ' hrs', 'var(--green)');
    html += buildSummaryCard('Tasks Identified', estimate.taskCount, 'var(--text)');
    html += buildSummaryCard('Sprint Estimate', estimate.sprintCount + ' sprint' + (estimate.sprintCount !== 1 ? 's' : ''), '#ffc800');
    html += buildSummaryCard('Recommended Team', estimate.recommendedTeamSize + ' person' + (estimate.recommendedTeamSize !== 1 ? 's' : ''), '#aa88ff');
    html += buildSummaryCard('Velocity', estimate.velocity + ' SP/sprint', 'var(--text2)');

    html += '</div>';

    // Complexity distribution bar
    html += '<div style="margin-bottom:1.5rem">';
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem">Complexity Distribution</div>';
    html += '<div style="display:flex;height:24px;border-radius:100px;overflow:hidden;background:var(--bg3)">';
    var totalTasks = estimate.taskCount;
    COMPLEXITY_ORDER.forEach(function (level) {
      var count = estimate.complexityDistribution[level] || 0;
      if (count === 0) return;
      var pct = Math.round((count / totalTasks) * 100);
      var meta = COMPLEXITY_LABELS[level];
      html += '<div title="' + meta.label + ': ' + count + ' task' + (count !== 1 ? 's' : '') + ' (' + pct + '%)" style="width:' + pct + '%;background:' + meta.color + ';display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:#000;min-width:' + (pct > 8 ? '0' : '20px') + '">' + (pct >= 12 ? pct + '%' : '') + '</div>';
    });
    html += '</div>';
    // Legend
    html += '<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.5rem">';
    COMPLEXITY_ORDER.forEach(function (level) {
      var count = estimate.complexityDistribution[level] || 0;
      if (count === 0) return;
      var meta = COMPLEXITY_LABELS[level];
      html += '<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;color:var(--text2)">' + '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + meta.color + '"></span>' + meta.label + ' (' + count + ')</span>';
    });
    html += '</div></div>';

    // Task breakdown table
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem">Task Breakdown</div>';
    html += '<div style="overflow-x:auto;border-radius:var(--radius-sm);border:1px solid rgba(255,255,255,.06)">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:.82rem">';
    html += '<thead><tr style="background:var(--bg3)">';
    html += '<th style="text-align:left;padding:.65rem .85rem;font-weight:700;color:var(--text2);font-size:.72rem;text-transform:uppercase;letter-spacing:.5px">Task</th>';
    html += '<th style="text-align:center;padding:.65rem .85rem;font-weight:700;color:var(--text2);font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap">Complexity</th>';
    html += '<th style="text-align:center;padding:.65rem .85rem;font-weight:700;color:var(--text2);font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap">Story Points</th>';
    html += '<th style="text-align:center;padding:.65rem .85rem;font-weight:700;color:var(--text2);font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap">Est. Hours</th>';
    html += '</tr></thead><tbody>';

    var currentGroup = '';
    estimate.tasks.forEach(function (task, idx) {
      // Group header row
      if (task.group !== currentGroup) {
        currentGroup = task.group;
        html += '<tr><td colspan="4" style="padding:.6rem .85rem;font-weight:700;font-size:.78rem;color:var(--orange);background:rgba(255,136,68,.04);border-bottom:1px solid rgba(255,255,255,.04)">' + escapeHtml(currentGroup) + '</td></tr>';
      }

      var meta = COMPLEXITY_LABELS[task.complexity] || COMPLEXITY_LABELS.moderate;
      var rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)';

      html += '<tr style="background:' + rowBg + ';border-bottom:1px solid rgba(255,255,255,.03)">';
      html += '<td style="padding:.6rem .85rem;color:var(--text);max-width:320px;word-wrap:break-word">' + escapeHtml(task.text.length > 80 ? task.text.substring(0, 77) + '...' : task.text) + '</td>';
      html += '<td style="padding:.6rem .85rem;text-align:center"><span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:600;color:' + meta.color + ';background:rgba(255,255,255,.04);padding:.2rem .6rem;border-radius:100px;white-space:nowrap">' + meta.icon + ' ' + meta.label + '</span></td>';
      html += '<td style="padding:.6rem .85rem;text-align:center;font-weight:700;color:var(--orange)">' + task.points + '</td>';
      html += '<td style="padding:.6rem .85rem;text-align:center;color:var(--text2)">' + task.hours + 'h</td>';
      html += '</tr>';
    });

    // Total row
    html += '<tr style="background:var(--bg3);font-weight:700">';
    html += '<td style="padding:.7rem .85rem;color:var(--text)">Total</td>';
    html += '<td style="padding:.7rem .85rem;text-align:center;color:var(--text2)">' + estimate.taskCount + ' tasks</td>';
    html += '<td style="padding:.7rem .85rem;text-align:center;color:var(--orange)">' + estimate.totalPoints + ' SP</td>';
    html += '<td style="padding:.7rem .85rem;text-align:center;color:var(--green)">' + estimate.totalHours + 'h</td>';
    html += '</tr>';

    html += '</tbody></table></div>';

    // Recommendations
    html += '<div style="margin-top:1.25rem;background:var(--bg3);border:1px solid rgba(255,255,255,.04);border-radius:var(--radius-sm);padding:1rem">';
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1px;margin-bottom:.65rem">Project Summary</div>';

    var weekEstimate = Math.ceil(estimate.totalHours / 40);
    var dayEstimate = Math.ceil(estimate.totalHours / 8);

    html += '<div style="display:grid;gap:.4rem;font-size:.82rem;color:var(--text2);line-height:1.6">';
    html += '<div>&#8226; <strong style="color:var(--text)">' + estimate.totalPoints + ' story points</strong> across ' + estimate.taskCount + ' tasks</div>';
    html += '<div>&#8226; Estimated <strong style="color:var(--text)">' + estimate.totalHours + ' hours</strong> (~' + dayEstimate + ' working day' + (dayEstimate !== 1 ? 's' : '') + ' / ~' + weekEstimate + ' week' + (weekEstimate !== 1 ? 's' : '') + ')</div>';
    html += '<div>&#8226; Recommended team size: <strong style="color:var(--text)">' + estimate.recommendedTeamSize + '</strong> person' + (estimate.recommendedTeamSize !== 1 ? 's' : '') + '</div>';
    html += '<div>&#8226; Sprint estimate: <strong style="color:var(--text)">' + estimate.sprintCount + '</strong> sprint' + (estimate.sprintCount !== 1 ? 's' : '') + ' (at ' + estimate.velocity + ' SP/sprint velocity)</div>';

    // Dominant complexity
    var dominantLevel = '';
    var dominantCount = 0;
    COMPLEXITY_ORDER.forEach(function (level) {
      var count = estimate.complexityDistribution[level] || 0;
      if (count > dominantCount) { dominantCount = count; dominantLevel = level; }
    });
    if (dominantLevel) {
      var dominantMeta = COMPLEXITY_LABELS[dominantLevel];
      var pct = Math.round((dominantCount / estimate.taskCount) * 100);
      html += '<div>&#8226; Dominant complexity: <strong style="color:' + dominantMeta.color + '">' + dominantMeta.label + '</strong> (' + pct + '% of tasks)</div>';
    }

    // Risk warning for heavy projects
    if (estimate.totalPoints > 60) {
      html += '<div style="margin-top:.5rem;padding:.5rem .75rem;background:rgba(255,68,102,.06);border:1px solid rgba(255,68,102,.12);border-radius:8px;font-size:.78rem;color:var(--red)">&#9888; This is a large project. Consider breaking it into phases with milestone-based delivery to reduce risk for both parties.</div>';
    }
    if (estimate.complexityDistribution.epic > 0 || estimate.complexityDistribution.very_complex >= 3) {
      html += '<div style="margin-top:.5rem;padding:.5rem .75rem;background:rgba(255,200,0,.06);border:1px solid rgba(255,200,0,.12);border-radius:8px;font-size:.78rem;color:#ffc800">&#128161; High-complexity items detected. Add buffer time (20-30%) for unknowns and integration challenges.</div>';
    }

    html += '</div></div>';

    // Export button
    html += '<div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">';
    html += '<button id="effort-copy-md" style="background:var(--bg3);border:1px solid rgba(255,255,255,.1);color:var(--text2);padding:.5rem 1rem;border-radius:100px;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s">Copy as Markdown</button>';
    html += '<button id="effort-copy-csv" style="background:var(--bg3);border:1px solid rgba(255,255,255,.1);color:var(--text2);padding:.5rem 1rem;border-radius:100px;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s">Copy as CSV</button>';
    html += '</div>';

    html += '</div>';
    panel.innerHTML = html;
    panel.style.display = 'block';

    // Bind export buttons
    bindExportButtons(estimate);

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildSummaryCard(label, value, color) {
    return '<div style="background:var(--bg3);border:1px solid rgba(255,255,255,.04);border-radius:var(--radius-sm);padding:.85rem;text-align:center">' +
      '<div style="font-size:1.25rem;font-weight:800;color:' + color + ';margin-bottom:.2rem">' + value + '</div>' +
      '<div style="font-size:.68rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">' + label + '</div></div>';
  }

  function bindExportButtons(estimate) {
    var mdBtn = document.getElementById('effort-copy-md');
    if (mdBtn) {
      mdBtn.addEventListener('click', function () {
        var md = '# Effort Estimation\n\n';
        md += '| Task | Complexity | Story Points | Est. Hours |\n';
        md += '|------|-----------|-------------|------------|\n';
        estimate.tasks.forEach(function (t) {
          var meta = COMPLEXITY_LABELS[t.complexity] || COMPLEXITY_LABELS.moderate;
          md += '| ' + t.text.substring(0, 60) + ' | ' + meta.label + ' | ' + t.points + ' | ' + t.hours + 'h |\n';
        });
        md += '| **Total** | **' + estimate.taskCount + ' tasks** | **' + estimate.totalPoints + ' SP** | **' + estimate.totalHours + 'h** |\n';
        md += '\n## Summary\n';
        md += '- **Total effort:** ' + estimate.totalPoints + ' story points / ' + estimate.totalHours + ' hours\n';
        md += '- **Sprints:** ' + estimate.sprintCount + ' (at ' + estimate.velocity + ' SP/sprint)\n';
        md += '- **Recommended team:** ' + estimate.recommendedTeamSize + ' person(s)\n';

        navigator.clipboard.writeText(md).then(function () {
          mdBtn.textContent = 'Copied!';
          mdBtn.style.color = 'var(--green)';
          setTimeout(function () { mdBtn.textContent = 'Copy as Markdown'; mdBtn.style.color = 'var(--text2)'; }, 2000);
        });
      });
    }

    var csvBtn = document.getElementById('effort-copy-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        var csv = 'Task,Group,Complexity,Story Points,Estimated Hours\n';
        estimate.tasks.forEach(function (t) {
          var meta = COMPLEXITY_LABELS[t.complexity] || COMPLEXITY_LABELS.moderate;
          csv += '"' + t.text.replace(/"/g, '""') + '","' + t.group.replace(/"/g, '""') + '",' + meta.label + ',' + t.points + ',' + t.hours + '\n';
        });
        csv += '"Total","",' + estimate.taskCount + ' tasks,' + estimate.totalPoints + ',' + estimate.totalHours + '\n';

        navigator.clipboard.writeText(csv).then(function () {
          csvBtn.textContent = 'Copied!';
          csvBtn.style.color = 'var(--green)';
          setTimeout(function () { csvBtn.textContent = 'Copy as CSV'; csvBtn.style.color = 'var(--text2)'; }, 2000);
        });
      });
    }
  }

  /* ══════════════════════════════════════════════
   * UI INJECTION
   * ══════════════════════════════════════════════ */
  function buildEstimatorUI() {
    // Find the scope creep section to insert after it
    var creepSection = document.getElementById('creep-results');
    if (!creepSection) return;
    var parentSection = creepSection.parentNode;

    // Create the effort estimator section
    var section = document.createElement('section');
    section.className = 'main-container';
    section.style.cssText = 'margin-top:0';

    var inputPanel = document.createElement('div');
    inputPanel.className = 'input-section';
    inputPanel.style.cssText = 'background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem';

    inputPanel.innerHTML = '<h3 style="font-size:.75rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:.5rem">Effort Estimator</h3>' +
      '<p style="font-size:.85rem;color:var(--text2);margin-bottom:1rem">Paste a deliverables list or project scope to get story point estimates and effort breakdown.</p>' +
      '<textarea id="effort-input" style="width:100%;min-height:140px;background:var(--bg3);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.85rem 1rem;color:var(--text);font-size:.88rem;font-family:inherit;outline:none;resize:vertical;line-height:1.7" placeholder="Example:\n- Homepage with hero section and animations\n- User authentication (login, signup, password reset)\n- Admin dashboard with analytics\n- Payment integration with Stripe\n- Blog with CMS"></textarea>' +
      '<div style="display:flex;gap:.75rem;margin-top:.75rem;flex-wrap:wrap">' +
      '<button id="effort-estimate-btn" style="display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.5rem;border-radius:100px;font-size:.88rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#000;transition:all .2s">Estimate Effort</button>' +
      '<button id="effort-sample-btn" style="background:var(--bg3);color:var(--text2);border:1px solid rgba(255,255,255,.1);padding:.75rem 1.2rem;border-radius:100px;font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s">Try Sample</button>' +
      '</div>';

    section.appendChild(inputPanel);

    var resultsPanel = document.createElement('div');
    resultsPanel.id = 'effort-estimator-results';
    resultsPanel.style.cssText = 'display:none';
    section.appendChild(resultsPanel);

    // Insert after the scope creep detector section
    parentSection.parentNode.insertBefore(section, parentSection.nextSibling);

    // Bind events
    var estimateBtn = document.getElementById('effort-estimate-btn');
    if (estimateBtn) {
      estimateBtn.addEventListener('click', function () {
        var input = document.getElementById('effort-input');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;

        var estimate = estimateEffort(text);
        if (estimate) {
          saveEstimate(estimate);
          renderEstimation(estimate);

          window.dataLayer = window.dataLayer || [];
          dataLayer.push({
            event: 'tool_used',
            tool_name: 'scope-analyzer',
            action: 'estimate_effort',
            total_points: estimate.totalPoints,
            total_hours: estimate.totalHours,
            task_count: estimate.taskCount,
          });
        }
      });
    }

    var sampleBtn = document.getElementById('effort-sample-btn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        var sampleText = [
          'Project Deliverables:',
          '- Homepage with hero section, feature cards, and testimonials carousel',
          '- User authentication system (login, signup, password reset, OAuth with Google)',
          '- Admin dashboard with user management and analytics charts',
          '- Blog section with CMS for creating and editing posts',
          '- Payment integration with Stripe (subscription billing)',
          '- Contact form with email notifications',
          '- Mobile-responsive design across all pages',
          '- SEO optimization and meta tags setup',
          '',
          'Technical Requirements:',
          '- REST API backend with CRUD operations',
          '- Database design and migration scripts',
          '- File upload system for user avatars and blog images',
          '- Real-time notifications using WebSocket',
          '- CI/CD pipeline setup and deployment',
        ].join('\n');

        var input = document.getElementById('effort-input');
        if (input) input.value = sampleText;
      });
    }
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    buildEstimatorUI();
  });

  // Expose for external use
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EffortEstimator = {
    estimate: estimateEffort,
    parseTasks: parseTasksFromText,
    assessComplexity: assessComplexity,
  };

})();
