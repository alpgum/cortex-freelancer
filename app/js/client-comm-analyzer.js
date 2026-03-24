/**
 * Cortex Freelancer — Client Communication Style Analyzer
 * [CF-044] Client communication style analyzer
 *
 * Analyzes client job posts and reviews for communication patterns:
 * responsive, demanding, ghosting risk, professionalism, respect.
 * Expose as window.CortexCommAnalyzer
 */

(function () {
  'use strict';

  // ─── Pattern Dictionaries ──────────────────────────────────────────

  var RESPONSIVENESS_POSITIVE = [
    'responsive', 'quick to respond', 'fast response', 'replied quickly',
    'always available', 'prompt', 'timely', 'communicative', 'great communication',
    'easy to reach', 'replied within', 'fast feedback', 'quick feedback',
    'answered questions', 'clear instructions', 'well explained', 'detailed brief',
    'thorough description', 'provided examples', 'shared references'
  ];

  var RESPONSIVENESS_NEGATIVE = [
    'slow to respond', 'no response', 'disappeared', 'ghosted', 'ghost',
    'went silent', 'stopped responding', 'hard to reach', 'unreachable',
    'took weeks', 'took days to respond', 'never replied', 'radio silence',
    'MIA', 'absent', 'unresponsive', 'ignored messages', 'delayed response',
    'waited forever', 'no updates'
  ];

  var DEMANDING_PATTERNS = [
    'ASAP', 'urgent', 'immediately', 'right now', 'need it yesterday',
    'tight deadline', 'rush', 'fast turnaround', 'overnight', '24/7',
    'always available', 'weekends', 'on call', 'unlimited revisions',
    'constant changes', 'keeps changing', 'scope creep', 'moving goalposts',
    'micromanag', 'every detail', 'hourly updates', 'daily reports',
    'multiple revisions', 'not what I wanted', 'redo', 'start over',
    'expected more', 'not good enough', 'disappointed'
  ];

  var PROFESSIONAL_PATTERNS = [
    'milestone', 'deliverable', 'timeline', 'scope', 'requirements',
    'specification', 'NDA', 'contract', 'escrow', 'SOW', 'budget',
    'project plan', 'deadline', 'phases', 'payment schedule', 'review cycle',
    'feedback round', 'approval process', 'well-organized', 'professional',
    'clear expectations', 'fair', 'reasonable', 'respectful'
  ];

  var GHOSTING_RISK = [
    'no hire history', 'first project', 'new client', 'unverified',
    'no reviews', 'payment unverified', 'no payment method',
    'vague description', 'not sure what I need', 'figure it out',
    'just get started', "we'll discuss later", 'TBD', 'to be determined',
    'disappeared before', 'cancelled project', 'left without paying',
    'ended contract early', 'dispute', 'stopped funding'
  ];

  var RESPECTFUL_PATTERNS = [
    'please', 'thank you', 'thanks', 'appreciate', 'great work',
    'well done', 'excellent', 'impressed', 'valued', 'respected',
    'fair rate', 'good pay', 'bonus', 'tip', 'repeat client',
    'long-term', 'ongoing', 'came back', 'rehired', 'recommended'
  ];

  var DISRESPECTFUL_PATTERNS = [
    'cheap', 'lowest bid', 'bargain', 'discount', 'free trial',
    'free sample', 'test project', 'prove yourself', 'exposure',
    'do it for experience', 'portfolio piece', 'contest',
    'rude', 'condescending', 'dismissive', 'belittling',
    'threatened', 'bad review threat', 'withhold payment'
  ];

  // ─── Helpers ───────────────────────────────────────────────────────

  function countMatches(text, patterns) {
    var lower = text.toLowerCase();
    var count = 0;
    var matched = [];
    for (var i = 0; i < patterns.length; i++) {
      if (lower.indexOf(patterns[i].toLowerCase()) !== -1) {
        count++;
        matched.push(patterns[i]);
      }
    }
    return { count: count, matched: matched };
  }

  // ─── Analysis Engine ───────────────────────────────────────────────

  function analyzeCommStyle(jobPost, reviews, messages) {
    var allText = ((jobPost || '') + ' ' + (reviews || '') + ' ' + (messages || '')).trim();
    if (!allText) return null;

    var respPositive = countMatches(allText, RESPONSIVENESS_POSITIVE);
    var respNegative = countMatches(allText, RESPONSIVENESS_NEGATIVE);
    var demanding = countMatches(allText, DEMANDING_PATTERNS);
    var professional = countMatches(allText, PROFESSIONAL_PATTERNS);
    var ghostRisk = countMatches(allText, GHOSTING_RISK);
    var respectful = countMatches(allText, RESPECTFUL_PATTERNS);
    var disrespectful = countMatches(allText, DISRESPECTFUL_PATTERNS);

    var responsivenessScore = 50 + Math.min(respPositive.count * 10, 40) - Math.min(respNegative.count * 12, 45);
    responsivenessScore = Math.max(5, Math.min(95, responsivenessScore));

    var demandLevel = 30 + Math.min(demanding.count * 8, 55) - Math.min(professional.count * 3, 15);
    demandLevel = Math.max(5, Math.min(95, demandLevel));

    var ghostingRisk = 25 + Math.min(ghostRisk.count * 10, 50) + Math.min(respNegative.count * 8, 20) - Math.min(respPositive.count * 5, 15) - Math.min(professional.count * 4, 15);
    ghostingRisk = Math.max(5, Math.min(95, ghostingRisk));

    var professionalism = 50 + Math.min(professional.count * 7, 35) + Math.min(respectful.count * 5, 15) - Math.min(disrespectful.count * 10, 30) - Math.min(demanding.count * 3, 15);
    professionalism = Math.max(5, Math.min(95, professionalism));

    var respectScore = 55 + Math.min(respectful.count * 8, 35) - Math.min(disrespectful.count * 12, 45);
    respectScore = Math.max(5, Math.min(95, respectScore));

    var overallScore = Math.round(
      responsivenessScore * 0.25 +
      (100 - demandLevel) * 0.2 +
      (100 - ghostingRisk) * 0.2 +
      professionalism * 0.2 +
      respectScore * 0.15
    );

    var styleLabel;
    if (overallScore >= 75) styleLabel = 'Excellent Communicator';
    else if (overallScore >= 60) styleLabel = 'Generally Professional';
    else if (overallScore >= 40) styleLabel = 'Mixed Signals';
    else styleLabel = 'Communication Risk';

    return {
      overallScore: overallScore,
      styleLabel: styleLabel,
      dimensions: {
        responsiveness: Math.round(responsivenessScore),
        demandLevel: Math.round(demandLevel),
        ghostingRisk: Math.round(ghostingRisk),
        professionalism: Math.round(professionalism),
        respect: Math.round(respectScore)
      },
      signals: { respPositive: respPositive, respNegative: respNegative, demanding: demanding, professional: professional, ghostRisk: ghostRisk, respectful: respectful, disrespectful: disrespectful }
    };
  }

  // ─── Renderer ──────────────────────────────────────────────────────

  function getColor(score) {
    if (score >= 75) return '#00ff88';
    if (score >= 60) return '#4488ff';
    if (score >= 40) return '#ffcc00';
    return '#ff4466';
  }

  function getDimColor(score, invert) {
    var s = invert ? (100 - score) : score;
    if (s >= 70) return '#00ff88';
    if (s >= 50) return '#4488ff';
    if (s >= 30) return '#ffcc00';
    return '#ff4466';
  }

  function renderCommAnalyzer(profile, container) {
    var jobDesc = '';
    var reviews = '';

    if (profile) {
      jobDesc = profile.description || profile.overview || profile.title || '';
      if (profile.reviews && Array.isArray(profile.reviews)) {
        reviews = profile.reviews.map(function(r) { return typeof r === 'string' ? r : (r.text || r.comment || ''); }).join('\n');
      } else if (typeof profile.reviews === 'string') {
        reviews = profile.reviews;
      }
      if (profile.feedback) {
        reviews += '\n' + (typeof profile.feedback === 'string' ? profile.feedback : JSON.stringify(profile.feedback));
      }
    }

    var css = '<style>' +
      '.cca-widget{font-size:.88rem;color:var(--text,#f0f0f0)}' +
      '.cca-form{margin-bottom:1rem}' +
      '.cca-label{display:block;font-size:.7rem;font-weight:700;color:var(--text-dim,#666);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem}' +
      '.cca-textarea{width:100%;padding:.6rem .8rem;border:1px solid rgba(255,255,255,.1);border-radius:8px;font-size:.85rem;color:var(--text,#f0f0f0);background:var(--bg-input,#1a1a24);font-family:inherit;outline:none;resize:vertical;min-height:80px;line-height:1.5}' +
      '.cca-textarea:focus{border-color:#4488ff}' +
      '.cca-btn{width:100%;background:linear-gradient(135deg,#4488ff,#aa66ff);color:#fff;padding:.65rem;border-radius:100px;font-weight:800;font-size:.85rem;border:none;cursor:pointer;font-family:inherit;margin-top:.5rem}' +
      '.cca-btn:hover{opacity:.9}' +
      '.cca-score-wrap{text-align:center;margin:1rem 0}' +
      '.cca-score{font-size:2rem;font-weight:900}' +
      '.cca-score-label{font-size:.75rem;color:var(--text-dim,#666);text-transform:uppercase;letter-spacing:.5px}' +
      '.cca-style{font-size:1rem;font-weight:800;margin:.25rem 0}' +
      '.cca-dims{margin:1rem 0}' +
      '.cca-dim{margin-bottom:.6rem}' +
      '.cca-dim-header{display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.2rem}' +
      '.cca-dim-label{color:var(--text-dim,#999)}' +
      '.cca-dim-val{font-weight:700}' +
      '.cca-dim-bar{height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}' +
      '.cca-dim-fill{height:100%;border-radius:3px;transition:width .5s}' +
      '.cca-note{font-size:.78rem;color:var(--text-dim,#666);margin-top:.75rem;line-height:1.5}' +
      '</style>';

    var html = css +
      '<div class="cca-widget">' +
        '<div class="cca-form">' +
          '<label class="cca-label">Job Post / Description</label>' +
          '<textarea class="cca-textarea" id="cca-job-input" placeholder="Paste client job post...">' + escapeHtml(jobDesc) + '</textarea>' +
          '<label class="cca-label" style="margin-top:.5rem">Client Reviews (optional)</label>' +
          '<textarea class="cca-textarea" id="cca-reviews-input" placeholder="Paste reviews about this client...">' + escapeHtml(reviews) + '</textarea>' +
          '<button class="cca-btn" onclick="window.CortexCommAnalyzer._runWidget()">Analyze Communication Style</button>' +
        '</div>' +
        '<div id="cca-results"></div>' +
      '</div>';

    container.innerHTML = html;

    if (jobDesc || reviews) {
      setTimeout(function() { window.CortexCommAnalyzer._runWidget(); }, 100);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _runWidget() {
    var jobEl = document.getElementById('cca-job-input');
    var revEl = document.getElementById('cca-reviews-input');
    var resEl = document.getElementById('cca-results');
    if (!jobEl || !resEl) return;

    var jobPost = jobEl.value.trim();
    var reviews = revEl ? revEl.value.trim() : '';

    if (!jobPost && !reviews) {
      resEl.innerHTML = '<div class="cca-note">Enter a job post or reviews to analyze.</div>';
      return;
    }

    var result = analyzeCommStyle(jobPost, reviews, '');
    if (!result) return;

    var color = getColor(result.overallScore);
    var dims = [
      { label: 'Responsiveness', value: result.dimensions.responsiveness, invert: false },
      { label: 'Demand Level', value: result.dimensions.demandLevel, invert: true },
      { label: 'Ghosting Risk', value: result.dimensions.ghostingRisk, invert: true },
      { label: 'Professionalism', value: result.dimensions.professionalism, invert: false },
      { label: 'Respect', value: result.dimensions.respect, invert: false }
    ];

    var html = '<div class="cca-score-wrap">' +
      '<div class="cca-score-label">Communication Score</div>' +
      '<div class="cca-score" style="color:' + color + '">' + result.overallScore + '<span style="font-size:.9rem;opacity:.6">/100</span></div>' +
      '<div class="cca-style" style="color:' + color + '">' + result.styleLabel + '</div>' +
      '</div>' +
      '<div class="cca-dims">';

    for (var i = 0; i < dims.length; i++) {
      var d = dims[i];
      var dc = getDimColor(d.value, d.invert);
      html += '<div class="cca-dim">' +
        '<div class="cca-dim-header">' +
          '<span class="cca-dim-label">' + d.label + '</span>' +
          '<span class="cca-dim-val" style="color:' + dc + '">' + d.value + '</span>' +
        '</div>' +
        '<div class="cca-dim-bar"><div class="cca-dim-fill" style="width:' + d.value + '%;background:' + dc + '"></div></div>' +
        '</div>';
    }

    html += '</div>';
    html += '<div class="cca-note">Scores based on keyword pattern analysis. Add reviews for more accurate results. <a href="/app/tools/client-comm-analyzer.html" style="color:#4488ff">Open full tool &rarr;</a></div>';

    resEl.innerHTML = html;
  }

  // ─── Export ────────────────────────────────────────────────────────

  window.CortexCommAnalyzer = {
    analyzeCommStyle: analyzeCommStyle,
    renderCommAnalyzer: renderCommAnalyzer,
    _runWidget: _runWidget
  };

})();
