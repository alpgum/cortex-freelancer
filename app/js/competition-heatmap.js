/**
 * CF-061: Competition Density Heatmap by Category
 * Visualises which freelancing categories are oversaturated vs underserved
 * using job-to-freelancer ratios, rendered as a colour-coded heatmap grid.
 *
 * @namespace window.CortexFreelancer.CompetitionHeatmap
 */
(function () {
  'use strict';

  // ─── Mock Data (18 categories) ───────────────────────────

  /**
   * Each entry: { name, jobs, freelancers, avgBid }
   * ratio and opportunityScore are computed at runtime.
   */
  var CATEGORIES = [
    { name: 'Web Development',        jobs: 4200, freelancers: 8900, avgBid: 45 },
    { name: 'Mobile Development',     jobs: 3100, freelancers: 6200, avgBid: 55 },
    { name: 'UI/UX Design',           jobs: 2800, freelancers: 5500, avgBid: 50 },
    { name: 'Data Science',           jobs: 2400, freelancers: 3100, avgBid: 72 },
    { name: 'Copywriting',            jobs: 3600, freelancers: 7800, avgBid: 30 },
    { name: 'SEO / SEM',              jobs: 1900, freelancers: 4100, avgBid: 38 },
    { name: 'DevOps / Cloud',         jobs: 1800, freelancers: 1600, avgBid: 80 },
    { name: 'Machine Learning',       jobs: 1500, freelancers: 1200, avgBid: 90 },
    { name: 'Blockchain / Web3',      jobs: 800,  freelancers: 2400, avgBid: 85 },
    { name: 'Video Editing',          jobs: 2200, freelancers: 5000, avgBid: 35 },
    { name: 'Graphic Design',         jobs: 3400, freelancers: 9200, avgBid: 32 },
    { name: 'Technical Writing',      jobs: 1100, freelancers: 900,  avgBid: 55 },
    { name: 'QA / Testing',           jobs: 1300, freelancers: 2100, avgBid: 42 },
    { name: 'Cybersecurity',          jobs: 950,  freelancers: 650,  avgBid: 95 },
    { name: 'Game Development',       jobs: 700,  freelancers: 2800, avgBid: 48 },
    { name: 'AR / VR Development',    jobs: 400,  freelancers: 350,  avgBid: 88 },
    { name: 'Illustration',           jobs: 1600, freelancers: 4800, avgBid: 28 },
    { name: 'Voice Over',             jobs: 900,  freelancers: 3200, avgBid: 25 }
  ];

  // ─── Computation ─────────────────────────────────────────

  /**
   * Compute ratio and opportunity score for each category.
   * ratio = jobs / freelancers (higher = less competition)
   * opportunityScore = ratio * log2(jobs + 1) -- rewards both
   *   ratio and absolute market size.
   * @returns {Array} Enriched category objects sorted by opportunityScore desc.
   */
  function computeScores() {
    var enriched = CATEGORIES.map(function (cat) {
      var ratio = cat.freelancers > 0 ? cat.jobs / cat.freelancers : cat.jobs;
      var opportunityScore = ratio * (Math.log(cat.jobs + 1) / Math.LN2);
      return {
        name: cat.name,
        jobs: cat.jobs,
        freelancers: cat.freelancers,
        avgBid: cat.avgBid,
        ratio: Math.round(ratio * 100) / 100,
        opportunityScore: Math.round(opportunityScore * 10) / 10
      };
    });

    enriched.sort(function (a, b) {
      return b.opportunityScore - a.opportunityScore;
    });

    return enriched;
  }

  // ─── Colour Helpers ──────────────────────────────────────

  /**
   * Map a normalised value (0..1) to a heatmap colour.
   *   0 = red (oversaturated)
   *   0.5 = yellow (moderate)
   *   1 = green (underserved / opportunity)
   * @param {number} t  Value between 0 and 1.
   * @returns {string} CSS rgb() colour.
   */
  function heatColour(t) {
    t = Math.max(0, Math.min(1, t));
    var r, g, b;
    if (t < 0.5) {
      var s = t / 0.5;
      r = 220;
      g = Math.round(80 + 140 * s);
      b = 60;
    } else {
      var s2 = (t - 0.5) / 0.5;
      r = Math.round(220 - 170 * s2);
      g = Math.round(220 - 30 * s2);
      b = Math.round(60 + 50 * s2);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /**
   * Choose a text colour that contrasts with the background.
   * @param {number} t  Normalised 0..1 value used for the background.
   * @returns {string}
   */
  function textColour(t) {
    return t < 0.35 ? '#fff' : '#1a1a2e';
  }

  // ─── Styles (injected once) ──────────────────────────────

  var STYLE_ID = 'cf-competition-heatmap-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.cf-heatmap-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:960px;margin:0 auto;color:#e0e0e0}',
      '.cf-heatmap-title{font-size:1.35rem;font-weight:700;margin:0 0 4px;color:#f0f0f0}',
      '.cf-heatmap-subtitle{font-size:.85rem;color:#999;margin:0 0 16px}',
      '.cf-heatmap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:18px}',
      '.cf-heatmap-cell{border-radius:8px;padding:14px 12px;cursor:default;transition:transform .15s,box-shadow .15s}',
      '.cf-heatmap-cell:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,0,0,.35)}',
      '.cf-heatmap-cell-name{font-size:.82rem;font-weight:600;margin:0 0 8px;line-height:1.25}',
      '.cf-heatmap-cell-score{font-size:1.5rem;font-weight:700;margin:0 0 6px}',
      '.cf-heatmap-cell-meta{font-size:.7rem;opacity:.85;line-height:1.5}',
      '.cf-heatmap-legend{display:flex;align-items:center;gap:8px;font-size:.75rem;color:#aaa;margin-top:4px}',
      '.cf-heatmap-legend-bar{height:12px;width:180px;border-radius:6px;flex-shrink:0}',
      '.cf-heatmap-table-wrap{margin-top:20px;overflow-x:auto}',
      '.cf-heatmap-table{width:100%;border-collapse:collapse;font-size:.78rem}',
      '.cf-heatmap-table th{text-align:left;padding:8px 10px;border-bottom:2px solid #333;color:#aaa;font-weight:600;white-space:nowrap}',
      '.cf-heatmap-table td{padding:7px 10px;border-bottom:1px solid #2a2a3e;white-space:nowrap}',
      '.cf-heatmap-table tr:hover td{background:rgba(255,255,255,.04)}',
      '.cf-heatmap-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}',
      '.cf-heatmap-label{font-size:.7rem;padding:2px 7px;border-radius:4px;font-weight:600;display:inline-block}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Rendering ───────────────────────────────────────────

  /**
   * Return a human-readable label for the competition level.
   * @param {number} t  Normalised 0..1
   * @returns {{ text: string }}
   */
  function competitionLabel(t) {
    if (t >= 0.7) return { text: 'Underserved' };
    if (t >= 0.4) return { text: 'Moderate' };
    return { text: 'Oversaturated' };
  }

  /**
   * Format a number with comma thousands separator.
   * @param {number} n
   * @returns {string}
   */
  function fmt(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Build the full heatmap UI inside the given container.
   * @param {string} containerId
   */
  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[CompetitionHeatmap] Container not found: #' + containerId);
      return;
    }

    injectStyles();

    var data = computeScores();

    // Normalise opportunity scores to 0..1 for colouring
    var scores = data.map(function (d) { return d.opportunityScore; });
    var minScore = Math.min.apply(null, scores);
    var maxScore = Math.max.apply(null, scores);
    var range = maxScore - minScore || 1;

    function normalise(score) {
      return (score - minScore) / range;
    }

    // ── Header
    var html = '';
    html += '<div class="cf-heatmap-wrap">';
    html += '<h2 class="cf-heatmap-title">Competition Density Heatmap</h2>';
    html += '<p class="cf-heatmap-subtitle">Job-to-freelancer ratio across ' + data.length + ' categories &mdash; green = opportunity, red = oversaturated</p>';

    // ── Grid
    html += '<div class="cf-heatmap-grid">';
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var t = normalise(d.opportunityScore);
      var bg = heatColour(t);
      var fg = textColour(t);
      var label = competitionLabel(t);
      html += '<div class="cf-heatmap-cell" style="background:' + bg + ';color:' + fg + '">';
      html += '<div class="cf-heatmap-cell-name">' + d.name + '</div>';
      html += '<div class="cf-heatmap-cell-score">' + d.opportunityScore + '</div>';
      html += '<div class="cf-heatmap-cell-meta">';
      html += 'Ratio: ' + d.ratio + ' &bull; ';
      html += fmt(d.jobs) + ' jobs / ' + fmt(d.freelancers) + ' freelancers<br>';
      html += 'Avg bid: $' + d.avgBid + ' &bull; ' + label.text;
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';

    // ── Legend
    html += '<div class="cf-heatmap-legend">';
    html += '<span>Oversaturated</span>';
    html += '<div class="cf-heatmap-legend-bar" style="background:linear-gradient(to right,' + heatColour(0) + ',' + heatColour(0.5) + ',' + heatColour(1) + ')"></div>';
    html += '<span>Underserved</span>';
    html += '</div>';

    // ── Detail Table
    html += '<div class="cf-heatmap-table-wrap">';
    html += '<table class="cf-heatmap-table">';
    html += '<thead><tr>';
    html += '<th>#</th><th>Category</th><th>Jobs</th><th>Freelancers</th>';
    html += '<th>Ratio</th><th>Avg Bid</th><th>Opportunity</th><th>Status</th>';
    html += '</tr></thead><tbody>';
    for (var j = 0; j < data.length; j++) {
      var row = data[j];
      var tn = normalise(row.opportunityScore);
      var lbl = competitionLabel(tn);
      var dotColour = heatColour(tn);
      html += '<tr>';
      html += '<td>' + (j + 1) + '</td>';
      html += '<td><span class="cf-heatmap-dot" style="background:' + dotColour + '"></span>' + row.name + '</td>';
      html += '<td>' + fmt(row.jobs) + '</td>';
      html += '<td>' + fmt(row.freelancers) + '</td>';
      html += '<td>' + row.ratio + '</td>';
      html += '<td>$' + row.avgBid + '</td>';
      html += '<td><strong>' + row.opportunityScore + '</strong></td>';
      html += '<td><span class="cf-heatmap-label" style="background:' + dotColour + ';color:' + textColour(tn) + '">' + lbl.text + '</span></td>';
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;
  }

  // ─── Public API ──────────────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};

  /**
   * @namespace window.CortexFreelancer.CompetitionHeatmap
   */
  window.CortexFreelancer.CompetitionHeatmap = {
    /**
     * Initialise and render the competition heatmap.
     * @param {string} containerId  ID of the target DOM element.
     */
    init: function (containerId) {
      render(containerId);
    },

    /**
     * Return computed category data (sorted by opportunity score).
     * Useful for programmatic access without rendering.
     * @returns {Array}
     */
    getData: function () {
      return computeScores();
    }
  };
})();
