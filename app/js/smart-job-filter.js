/**
 * [CF-020] Smart Job Filter — Hide Low-Quality Posts Automatically
 * Auto-hides jobs below a quality threshold with configurable sensitivity.
 * Integrates with JobQualityScore for scoring.
 *
 * window.CortexFreelancer.SmartJobFilter
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_smart_filter_config';

  var SENSITIVITY_PRESETS = {
    relaxed: { threshold: 3, label: 'Relaxed', description: 'Only hide very low quality posts', color: '#00d4aa' },
    moderate: { threshold: 5, label: 'Moderate', description: 'Hide below-average posts', color: '#6c5ce7' },
    strict: { threshold: 7, label: 'Strict', description: 'Only show good and excellent posts', color: '#fdcb6e' },
    elite: { threshold: 8.5, label: 'Elite', description: 'Only show top-tier opportunities', color: '#e74c3c' }
  };

  var DEFAULT_CONFIG = {
    sensitivity: 'moderate',
    customThreshold: 5,
    autoHideEnabled: true,
    showHiddenCount: true
  };

  // ─── CSS ────────────────────────────────────────────────────────────
  var CSS_INJECTED = false;
  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.sjf-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;margin-bottom:16px}',
      '.sjf-config{background:#151515;padding:16px 18px;border-bottom:1px solid #222}',
      '.sjf-config-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px}',
      '.sjf-toggle-wrap{display:flex;align-items:center;gap:10px}',
      '.sjf-toggle{position:relative;width:40px;height:22px;cursor:pointer}',
      '.sjf-toggle input{opacity:0;width:0;height:0}',
      '.sjf-slider{position:absolute;inset:0;background:#333;border-radius:11px;transition:.3s}',
      '.sjf-slider:before{content:"";position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#888;border-radius:50%;transition:.3s}',
      '.sjf-toggle input:checked+.sjf-slider{background:#7c3aed}',
      '.sjf-toggle input:checked+.sjf-slider:before{transform:translateX(18px);background:#fff}',
      '.sjf-label{color:#e0e0e0;font-size:14px;font-weight:600}',
      '.sjf-info{color:#888;font-size:13px}',
      '.sjf-info span{color:#7c3aed;font-weight:700}',
      '.sjf-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
      '.sjf-preset{padding:8px 16px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#888;font-size:13px;cursor:pointer;transition:all .2s;text-align:left}',
      '.sjf-preset:hover{border-color:#555;color:#ccc}',
      '.sjf-preset.active{border-color:var(--preset-color);color:var(--preset-color);background:color-mix(in srgb,var(--preset-color) 10%,#1a1a1a)}',
      '.sjf-preset-label{font-weight:600}',
      '.sjf-preset-desc{font-size:11px;margin-top:2px;opacity:.7}',
      '.sjf-slider-row{display:flex;align-items:center;gap:12px}',
      '.sjf-slider-row label{color:#888;font-size:12px}',
      '.sjf-slider-row input[type="range"]{flex:1;accent-color:#7c3aed}',
      '.sjf-slider-val{color:#7c3aed;font-size:13px;font-weight:700;min-width:40px;text-align:center}',
      '.sjf-stats{display:flex;gap:10px;margin:16px 18px}',
      '.sjf-stat{flex:1;background:#151515;border:1px solid #222;border-radius:8px;padding:10px;text-align:center}',
      '.sjf-stat-num{font-size:22px;font-weight:700}',
      '.sjf-stat-label{font-size:11px;color:#888;margin-top:2px}',
      '.sjf-jobs{padding:0 18px 14px}',
      '.sjf-job{background:#151515;border:1px solid #222;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.sjf-job.hidden{opacity:.5;border-left:3px solid #ef4444}',
      '.sjf-job-info{flex:1;min-width:200px}',
      '.sjf-job-title{color:#e0e0e0;font-size:14px;font-weight:600}',
      '.sjf-job.hidden .sjf-job-title{text-decoration:line-through;color:#666}',
      '.sjf-job-meta{color:#777;font-size:12px;margin-top:3px}',
      '.sjf-job-reason{color:#ef4444;font-size:11px;margin-top:3px}',
      '.sjf-job-score{display:flex;align-items:center;gap:8px}',
      '.sjf-score-bar{width:50px;height:4px;background:#222;border-radius:2px;overflow:hidden}',
      '.sjf-score-fill{height:100%;border-radius:2px}',
      '.sjf-score-num{font-size:16px;font-weight:700;min-width:30px;text-align:right}',
      '.sjf-show-hidden{width:100%;padding:12px;border-radius:8px;border:1px dashed #333;background:transparent;color:#888;font-size:13px;cursor:pointer;margin-top:8px}',
      '.sjf-show-hidden:hover{border-color:#555;color:#ccc}',
      '@media(max-width:600px){.sjf-config-top{flex-direction:column;align-items:flex-start}.sjf-presets{flex-direction:column}.sjf-stats{flex-direction:column}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function scoreColor(val) {
    if (val >= 8) return '#22c55e';
    if (val >= 6.5) return '#84cc16';
    if (val >= 5) return '#eab308';
    if (val >= 3.5) return '#f97316';
    return '#ef4444';
  }

  function scoreLabel(val) {
    if (val >= 8) return 'Excellent';
    if (val >= 6.5) return 'Good';
    if (val >= 5) return 'Average';
    if (val >= 3.5) return 'Below Average';
    return 'Poor';
  }

  // ─── Config Persistence ────────────────────────────────────────────
  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      var saved = JSON.parse(raw);
      var cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      for (var k in saved) {
        if (saved.hasOwnProperty(k)) cfg[k] = saved[k];
      }
      return cfg;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }

  function saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) { /* quota */ }
  }

  // ─── Built-in Scoring (used when JobQualityScore not available) ────
  function quickScore(job) {
    // Prefer external scorer
    if (window.CortexFreelancer.JobQualityScore &&
        typeof window.CortexFreelancer.JobQualityScore.scoreJob === 'function') {
      return window.CortexFreelancer.JobQualityScore.scoreJob(job);
    }

    var scores = {};

    // Budget/rate
    var budgetMin = parseFloat(job.budgetMin || job.budget || 0);
    var budgetMax = parseFloat(job.budgetMax || job.budget || budgetMin);
    var rate;
    if (job.budgetType === 'hourly') {
      rate = (budgetMin + budgetMax) / 2;
    } else {
      var avg = (budgetMin + budgetMax) / 2;
      var estHours = avg < 200 ? 5 : avg < 1000 ? 20 : avg < 5000 ? 60 : 120;
      rate = avg / estHours;
    }
    scores.budgetRatio = Math.min(10, Math.max(1, 1 + (rate / 100) * 9));

    // Client history
    var cs = 0;
    var spent = parseFloat(job.clientSpent || job.clientTotalSpent || 0);
    if (spent >= 100000) cs += 3; else if (spent >= 10000) cs += 2; else if (spent >= 1000) cs += 1; else cs += 0.3;
    var hires = parseInt(job.clientHires || job.hires || 0, 10);
    if (hires >= 20) cs += 2.5; else if (hires >= 5) cs += 1.5; else if (hires >= 1) cs += 0.8;
    var rating = parseFloat(job.clientRating || job.rating || 0);
    if (rating >= 4.5) cs += 3; else if (rating >= 4.0) cs += 2; else if (rating > 0) cs += 1;
    cs += (job.paymentVerified || job.clientPaymentVerified) ? 1.5 : 0;
    scores.clientHistory = Math.min(10, Math.max(1, cs));

    // Description clarity
    var desc = job.description || '';
    var dc = 0;
    if (desc.length >= 200) dc += 2; else if (desc.length >= 50) dc += 1; else dc += 0.3;
    if (/deliverable|requirement|milestone/i.test(desc)) dc += 1;
    if ((job.skills || []).length >= 3) dc += 2; else if ((job.skills || []).length >= 1) dc += 1;
    if (!/!!+|URGENT|asap|cheapest/i.test(desc)) dc += 1.5;
    var sentences = desc.split(/[.!?]+/).filter(function (s) { return s.trim().length > 10; });
    if (sentences.length >= 3) dc += 1.5; else if (sentences.length >= 1) dc += 0.8;
    scores.descriptionClarity = Math.min(10, Math.max(1, dc));

    // Competition
    var p = parseInt(job.proposals || job.applicants || 0, 10);
    if (p <= 5) scores.competition = 10;
    else if (p <= 10) scores.competition = 8;
    else if (p <= 20) scores.competition = 6;
    else if (p <= 40) scores.competition = 4;
    else scores.competition = 2;

    var overall = scores.budgetRatio * 0.25 +
      scores.clientHistory * 0.25 +
      scores.descriptionClarity * 0.25 +
      scores.competition * 0.25;

    return {
      overall: Math.round(overall * 10) / 10,
      label: scoreLabel(overall),
      factors: {
        budgetRatio: { score: Math.round(scores.budgetRatio * 10) / 10 },
        clientHistory: { score: Math.round(scores.clientHistory * 10) / 10 },
        descriptionClarity: { score: Math.round(scores.descriptionClarity * 10) / 10 },
        competition: { score: Math.round(scores.competition * 10) / 10 }
      }
    };
  }

  // ─── Filter Logic ─────────────────────────────────────────────────
  function getThreshold(config) {
    if (SENSITIVITY_PRESETS[config.sensitivity]) {
      return SENSITIVITY_PRESETS[config.sensitivity].threshold;
    }
    return config.customThreshold;
  }

  function filterJobs(jobs, config) {
    if (!jobs || !jobs.length) return { visible: [], hidden: [] };

    var cfg = config || loadConfig();
    var threshold = getThreshold(cfg);
    var visible = [];
    var hidden = [];

    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var score = job._qualityScore || quickScore(job);
      job._qualityScore = score;

      if (!cfg.autoHideEnabled || score.overall >= threshold) {
        visible.push(job);
      } else {
        var reasons = [];
        var factors = score.factors || {};
        if (factors.budgetRatio && factors.budgetRatio.score < 4) reasons.push('Low budget');
        if (factors.clientHistory && factors.clientHistory.score < 4) reasons.push('Weak client history');
        if (factors.descriptionClarity && factors.descriptionClarity.score < 4) reasons.push('Unclear description');
        if (factors.competition && factors.competition.score < 4) reasons.push('High competition');
        if (reasons.length === 0) reasons.push('Below threshold');

        hidden.push({
          job: job,
          score: score,
          reasons: reasons
        });
      }
    }

    return { visible: visible, hidden: hidden };
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function renderJobCard(item, isHidden) {
    var s = isHidden ? item.score : (item._qualityScore || quickScore(item));
    var j = isHidden ? item.job : item;
    var c = scoreColor(s.overall);

    var budget = '';
    if (j.budgetType === 'hourly' && j.budgetMin != null) {
      budget = '$' + j.budgetMin + '-$' + j.budgetMax + '/hr';
    } else if (j.budget) {
      budget = '$' + j.budget;
      if (j.budgetType === 'hourly') budget += '/hr';
    } else if (j.budgetMin != null) {
      budget = '$' + j.budgetMin + '-$' + j.budgetMax;
    }

    var proposals = j.proposals || j.applicants || 0;
    var verified = j.paymentVerified || j.clientPaymentVerified;

    var h = '<div class="sjf-job' + (isHidden ? ' hidden' : '') + '">';
    h += '<div class="sjf-job-info">';
    h += '<div class="sjf-job-title">' + esc(j.title || 'Untitled') + '</div>';
    h += '<div class="sjf-job-meta">';
    if (budget) h += budget + ' · ';
    h += proposals + ' proposals · ' + (verified ? 'Verified' : 'Unverified');
    h += '</div>';
    if (isHidden && item.reasons) {
      h += '<div class="sjf-job-reason">Hidden: ' + esc(item.reasons.join(', ')) + '</div>';
    }
    h += '</div>';
    h += '<div class="sjf-job-score">';
    h += '<div class="sjf-score-bar"><div class="sjf-score-fill" style="width:' + (s.overall * 10) + '%;background:' + c + '"></div></div>';
    h += '<span class="sjf-score-num" style="color:' + c + '">' + s.overall.toFixed(1) + '</span>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  function render(container, jobs, state) {
    injectCSS();

    var config = state.config;
    var threshold = getThreshold(config);
    var preset = SENSITIVITY_PRESETS[config.sensitivity] || SENSITIVITY_PRESETS.moderate;

    // Score and sort jobs
    var scored = jobs.map(function (job) {
      job._qualityScore = job._qualityScore || quickScore(job);
      return job;
    }).sort(function (a, b) {
      return b._qualityScore.overall - a._qualityScore.overall;
    });

    var filtered = filterJobs(scored, config);
    state.lastResult = filtered;

    var h = '<div class="sjf-panel">';

    // Config section
    h += '<div class="sjf-config">';
    h += '<div class="sjf-config-top">';
    h += '<div class="sjf-toggle-wrap">';
    h += '<label class="sjf-toggle"><input type="checkbox" data-sjf="toggle"' + (config.autoHideEnabled ? ' checked' : '') + '><span class="sjf-slider"></span></label>';
    h += '<span class="sjf-label">Smart Filter</span>';
    h += '</div>';
    h += '<div class="sjf-info">Threshold: <span>' + threshold.toFixed(1) + '/10</span> · Showing <span>' + filtered.visible.length + '</span> of ' + jobs.length + ' jobs</div>';
    h += '</div>';

    // Presets
    h += '<div class="sjf-presets">';
    var presetKeys = Object.keys(SENSITIVITY_PRESETS);
    for (var p = 0; p < presetKeys.length; p++) {
      var pk = presetKeys[p];
      var pr = SENSITIVITY_PRESETS[pk];
      var active = config.sensitivity === pk;
      h += '<button class="sjf-preset' + (active ? ' active' : '') + '" data-sjf="preset" data-preset="' + pk + '" style="--preset-color:' + pr.color + '">';
      h += '<div class="sjf-preset-label">' + esc(pr.label) + '</div>';
      h += '<div class="sjf-preset-desc">' + esc(pr.description) + '</div>';
      h += '</button>';
    }
    h += '</div>';

    // Custom slider
    h += '<div class="sjf-slider-row">';
    h += '<label>Custom:</label>';
    h += '<input type="range" min="1" max="10" step="0.5" value="' + threshold + '" data-sjf="threshold">';
    h += '<span class="sjf-slider-val" data-sjf="thresholdVal">' + threshold.toFixed(1) + '</span>';
    h += '</div>';

    h += '</div>'; // config

    // Stats
    var excellent = filtered.visible.filter(function (j) { return j._qualityScore.overall >= 8; }).length;
    var good = filtered.visible.filter(function (j) { return j._qualityScore.overall >= 6.5 && j._qualityScore.overall < 8; }).length;
    var avg = filtered.visible.filter(function (j) { return j._qualityScore.overall >= 5 && j._qualityScore.overall < 6.5; }).length;

    h += '<div class="sjf-stats">';
    h += '<div class="sjf-stat"><div class="sjf-stat-num" style="color:#22c55e">' + excellent + '</div><div class="sjf-stat-label">Excellent</div></div>';
    h += '<div class="sjf-stat"><div class="sjf-stat-num" style="color:#84cc16">' + good + '</div><div class="sjf-stat-label">Good</div></div>';
    h += '<div class="sjf-stat"><div class="sjf-stat-num" style="color:#eab308">' + avg + '</div><div class="sjf-stat-label">Average</div></div>';
    h += '<div class="sjf-stat"><div class="sjf-stat-num" style="color:#ef4444">' + filtered.hidden.length + '</div><div class="sjf-stat-label">Hidden</div></div>';
    h += '</div>';

    // Visible jobs
    h += '<div class="sjf-jobs">';
    for (var v = 0; v < filtered.visible.length; v++) {
      h += renderJobCard(filtered.visible[v], false);
    }

    // Hidden toggle
    if (filtered.hidden.length > 0) {
      h += '<button class="sjf-show-hidden" data-sjf="showHidden">';
      h += (state.showHidden ? 'Hide' : 'Show') + ' ' + filtered.hidden.length + ' filtered job' + (filtered.hidden.length !== 1 ? 's' : '');
      h += '</button>';

      if (state.showHidden) {
        for (var hi = 0; hi < filtered.hidden.length; hi++) {
          h += renderJobCard(filtered.hidden[hi], true);
        }
      }
    }

    h += '</div>';
    h += '</div>';

    container.innerHTML = h;
    return filtered;
  }

  // ─── Init ──────────────────────────────────────────────────────────
  function init(containerId, jobs, options) {
    var opts = options || {};
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return null;

    var state = {
      config: loadConfig(),
      showHidden: false,
      lastResult: null
    };

    if (opts.sensitivity) state.config.sensitivity = opts.sensitivity;
    if (opts.threshold != null) state.config.customThreshold = opts.threshold;
    if (opts.enabled !== undefined) state.config.autoHideEnabled = opts.enabled;

    var currentJobs = jobs || [];

    function update() {
      var result = render(container, currentJobs, state);
      bindEvents();
      saveConfig(state.config);
      if (opts.onChange) opts.onChange(result);
      return result;
    }

    function bindEvents() {
      var toggle = container.querySelector('[data-sjf="toggle"]');
      if (toggle) {
        toggle.addEventListener('change', function () {
          state.config.autoHideEnabled = this.checked;
          update();
        });
      }

      var presetBtns = container.querySelectorAll('[data-sjf="preset"]');
      for (var i = 0; i < presetBtns.length; i++) {
        presetBtns[i].addEventListener('click', function () {
          state.config.sensitivity = this.getAttribute('data-preset');
          update();
        });
      }

      var slider = container.querySelector('[data-sjf="threshold"]');
      var sliderVal = container.querySelector('[data-sjf="thresholdVal"]');
      if (slider && sliderVal) {
        slider.addEventListener('input', function () {
          sliderVal.textContent = parseFloat(this.value).toFixed(1);
        });
        slider.addEventListener('change', function () {
          state.config.customThreshold = parseFloat(this.value);
          state.config.sensitivity = 'custom';
          update();
        });
      }

      var showBtn = container.querySelector('[data-sjf="showHidden"]');
      if (showBtn) {
        showBtn.addEventListener('click', function () {
          state.showHidden = !state.showHidden;
          update();
        });
      }
    }

    update();

    return {
      getVisible: function () { return state.lastResult ? state.lastResult.visible : currentJobs; },
      getHidden: function () { return state.lastResult ? state.lastResult.hidden : []; },
      getConfig: function () { return JSON.parse(JSON.stringify(state.config)); },
      setJobs: function (newJobs) { currentJobs = newJobs || []; return update(); },
      setSensitivity: function (level) {
        state.config.sensitivity = level;
        return update();
      },
      setThreshold: function (val) {
        state.config.customThreshold = val;
        state.config.sensitivity = 'custom';
        return update();
      },
      setEnabled: function (on) { state.config.autoHideEnabled = on; return update(); },
      destroy: function () { container.innerHTML = ''; }
    };
  }

  // ─── Public API ────────────────────────────────────────────────────
  window.CortexFreelancer.SmartJobFilter = {
    init: init,
    filterJobs: filterJobs,
    SENSITIVITY_PRESETS: SENSITIVITY_PRESETS,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    version: '2.0.0'
  };

})();
