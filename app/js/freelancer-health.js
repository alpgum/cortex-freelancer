/**
 * [CF-165] Freelancer Health Check
 * Monthly business health assessment: income stability, client diversification,
 * skill relevance, pipeline strength.
 * Exposed on window.CortexFreelancer.FreelancerHealth
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_freelancer_health';

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Health Assessment Engine ──

  var CATEGORIES = {
    income: {
      name: 'Income Stability',
      icon: '💰',
      weight: 0.25,
      questions: [
        { id: 'monthly_income', label: 'Average monthly income ($)', type: 'number', placeholder: '5000' },
        { id: 'income_variance', label: 'Income variance (lowest month vs highest, %)', type: 'range', min: 0, max: 100, step: 5 },
        { id: 'recurring_income', label: 'Recurring/retainer income (%)', type: 'range', min: 0, max: 100, step: 5 },
        { id: 'months_runway', label: 'Emergency fund (months of expenses)', type: 'number', placeholder: '3' },
        { id: 'income_trend', label: 'Income trend (last 6 months)', type: 'select', options: ['Growing steadily', 'Stable', 'Fluctuating', 'Declining'] }
      ],
      score: function (answers) {
        var s = 0;
        var income = parseFloat(answers.monthly_income) || 0;
        if (income >= 8000) s += 25;
        else if (income >= 5000) s += 20;
        else if (income >= 3000) s += 15;
        else if (income >= 1000) s += 8;

        var variance = parseFloat(answers.income_variance) || 50;
        s += Math.round((100 - variance) * 0.25);

        var recurring = parseFloat(answers.recurring_income) || 0;
        s += Math.round(recurring * 0.25);

        var runway = parseFloat(answers.months_runway) || 0;
        if (runway >= 6) s += 25;
        else if (runway >= 3) s += 15;
        else if (runway >= 1) s += 8;

        var trend = answers.income_trend || 'Stable';
        if (trend === 'Growing steadily') s += 10;
        else if (trend === 'Stable') s += 7;
        else if (trend === 'Fluctuating') s += 3;

        return Math.min(s, 100);
      }
    },
    clients: {
      name: 'Client Diversification',
      icon: '👥',
      weight: 0.2,
      questions: [
        { id: 'total_clients', label: 'Active clients', type: 'number', placeholder: '5' },
        { id: 'top_client_pct', label: 'Largest client (% of income)', type: 'range', min: 0, max: 100, step: 5 },
        { id: 'repeat_client_pct', label: 'Repeat clients (%)', type: 'range', min: 0, max: 100, step: 5 },
        { id: 'client_industries', label: 'Number of different industries', type: 'number', placeholder: '3' },
        { id: 'lead_sources', label: 'Lead sources', type: 'select', options: ['1 source only', '2 sources', '3-4 sources', '5+ sources'] }
      ],
      score: function (answers) {
        var s = 0;
        var clients = parseInt(answers.total_clients) || 0;
        if (clients >= 5) s += 25;
        else if (clients >= 3) s += 18;
        else if (clients >= 2) s += 10;
        else s += 5;

        var topPct = parseFloat(answers.top_client_pct) || 100;
        s += Math.round((100 - topPct) * 0.25);

        var repeat = parseFloat(answers.repeat_client_pct) || 0;
        if (repeat >= 40 && repeat <= 70) s += 20;
        else if (repeat >= 20) s += 12;
        else s += 5;

        var industries = parseInt(answers.client_industries) || 1;
        s += Math.min(industries * 5, 15);

        var sources = answers.lead_sources || '1 source only';
        if (sources === '5+ sources') s += 15;
        else if (sources === '3-4 sources') s += 10;
        else if (sources === '2 sources') s += 6;
        else s += 2;

        return Math.min(s, 100);
      }
    },
    skills: {
      name: 'Skill Relevance',
      icon: '🎯',
      weight: 0.2,
      questions: [
        { id: 'skill_demand', label: 'Market demand for your primary skill', type: 'select', options: ['Very high demand', 'High demand', 'Moderate demand', 'Low demand', 'Declining'] },
        { id: 'learning_hours', label: 'Hours/week spent learning new skills', type: 'number', placeholder: '5' },
        { id: 'certifications', label: 'Recent certifications (last 12 months)', type: 'number', placeholder: '1' },
        { id: 'skill_breadth', label: 'Complementary skills offered', type: 'number', placeholder: '3' },
        { id: 'rate_competitiveness', label: 'Your rate vs market average', type: 'select', options: ['Above market', 'At market', 'Below market', 'Far below market'] }
      ],
      score: function (answers) {
        var s = 0;
        var demand = answers.skill_demand || 'Moderate demand';
        if (demand === 'Very high demand') s += 25;
        else if (demand === 'High demand') s += 20;
        else if (demand === 'Moderate demand') s += 12;
        else if (demand === 'Low demand') s += 5;

        var learn = parseFloat(answers.learning_hours) || 0;
        if (learn >= 10) s += 20;
        else if (learn >= 5) s += 15;
        else if (learn >= 2) s += 8;
        else s += 2;

        var certs = parseInt(answers.certifications) || 0;
        s += Math.min(certs * 8, 20);

        var breadth = parseInt(answers.skill_breadth) || 0;
        s += Math.min(breadth * 5, 15);

        var rate = answers.rate_competitiveness || 'At market';
        if (rate === 'Above market') s += 20;
        else if (rate === 'At market') s += 14;
        else if (rate === 'Below market') s += 8;
        else s += 3;

        return Math.min(s, 100);
      }
    },
    pipeline: {
      name: 'Pipeline Strength',
      icon: '📊',
      weight: 0.2,
      questions: [
        { id: 'active_proposals', label: 'Active proposals/quotes out', type: 'number', placeholder: '5' },
        { id: 'conversion_rate', label: 'Proposal win rate (%)', type: 'range', min: 0, max: 100, step: 5 },
        { id: 'pipeline_weeks', label: 'Weeks of work in confirmed pipeline', type: 'number', placeholder: '4' },
        { id: 'inbound_leads', label: 'Inbound leads per month', type: 'number', placeholder: '3' },
        { id: 'marketing_activity', label: 'Marketing/visibility efforts', type: 'select', options: ['Active (posting, networking, outreach)', 'Moderate (some visibility)', 'Minimal (only platforms)', 'None'] }
      ],
      score: function (answers) {
        var s = 0;
        var proposals = parseInt(answers.active_proposals) || 0;
        if (proposals >= 8) s += 20;
        else if (proposals >= 4) s += 15;
        else if (proposals >= 2) s += 10;
        else s += 3;

        var winRate = parseFloat(answers.conversion_rate) || 0;
        if (winRate >= 40) s += 25;
        else if (winRate >= 25) s += 18;
        else if (winRate >= 10) s += 10;
        else s += 3;

        var pipeline = parseFloat(answers.pipeline_weeks) || 0;
        if (pipeline >= 8) s += 25;
        else if (pipeline >= 4) s += 18;
        else if (pipeline >= 2) s += 10;
        else s += 3;

        var inbound = parseInt(answers.inbound_leads) || 0;
        s += Math.min(inbound * 3, 15);

        var marketing = answers.marketing_activity || 'None';
        if (marketing.indexOf('Active') === 0) s += 15;
        else if (marketing.indexOf('Moderate') === 0) s += 10;
        else if (marketing.indexOf('Minimal') === 0) s += 5;
        else s += 1;

        return Math.min(s, 100);
      }
    },
    wellbeing: {
      name: 'Work-Life Balance',
      icon: '⚖️',
      weight: 0.15,
      questions: [
        { id: 'work_hours', label: 'Average weekly work hours', type: 'number', placeholder: '40' },
        { id: 'vacation_days', label: 'Vacation days taken (last 12 months)', type: 'number', placeholder: '15' },
        { id: 'stress_level', label: 'Current stress level', type: 'select', options: ['Low — manageable', 'Moderate — some pressure', 'High — often overwhelmed', 'Burnout risk'] },
        { id: 'boundaries', label: 'Client boundary enforcement', type: 'select', options: ['Strong boundaries', 'Mostly enforced', 'Struggle sometimes', 'No boundaries'] },
        { id: 'satisfaction', label: 'Overall job satisfaction', type: 'select', options: ['Very satisfied', 'Satisfied', 'Neutral', 'Unsatisfied', 'Very unsatisfied'] }
      ],
      score: function (answers) {
        var s = 0;
        var hours = parseFloat(answers.work_hours) || 40;
        if (hours >= 30 && hours <= 45) s += 20;
        else if (hours >= 20 && hours <= 55) s += 12;
        else s += 5;

        var vacation = parseInt(answers.vacation_days) || 0;
        if (vacation >= 20) s += 20;
        else if (vacation >= 10) s += 15;
        else if (vacation >= 5) s += 8;
        else s += 2;

        var stress = answers.stress_level || 'Moderate — some pressure';
        if (stress.indexOf('Low') === 0) s += 25;
        else if (stress.indexOf('Moderate') === 0) s += 15;
        else if (stress.indexOf('High') === 0) s += 5;
        else s += 0;

        var boundaries = answers.boundaries || 'Mostly enforced';
        if (boundaries === 'Strong boundaries') s += 15;
        else if (boundaries === 'Mostly enforced') s += 10;
        else if (boundaries === 'Struggle sometimes') s += 5;
        else s += 1;

        var sat = answers.satisfaction || 'Neutral';
        if (sat === 'Very satisfied') s += 20;
        else if (sat === 'Satisfied') s += 15;
        else if (sat === 'Neutral') s += 8;
        else s += 3;

        return Math.min(s, 100);
      }
    }
  };

  function runAssessment(answers) {
    var results = {};
    var totalWeighted = 0;
    var catKeys = Object.keys(CATEGORIES);

    catKeys.forEach(function (key) {
      var cat = CATEGORIES[key];
      var score = cat.score(answers);
      results[key] = { score: score, weight: cat.weight, name: cat.name, icon: cat.icon };
      totalWeighted += score * cat.weight;
    });

    var overall = Math.round(totalWeighted);
    var grade;
    if (overall >= 80) grade = 'Excellent';
    else if (overall >= 65) grade = 'Good';
    else if (overall >= 50) grade = 'Fair';
    else if (overall >= 35) grade = 'Needs Attention';
    else grade = 'Critical';

    // Generate recommendations
    var recommendations = [];
    catKeys.forEach(function (key) {
      var s = results[key].score;
      if (s < 40) {
        recommendations.push({ category: results[key].name, priority: 'high', message: getRecommendation(key, 'low') });
      } else if (s < 65) {
        recommendations.push({ category: results[key].name, priority: 'medium', message: getRecommendation(key, 'medium') });
      }
    });

    return {
      overall: overall,
      grade: grade,
      categories: results,
      recommendations: recommendations,
      date: Date.now()
    };
  }

  function getRecommendation(category, level) {
    var recs = {
      income: {
        low: 'Your income stability needs urgent attention. Focus on building recurring revenue through retainer agreements and diversifying income sources.',
        medium: 'Consider negotiating retainer contracts with existing clients and building an emergency fund of 3-6 months expenses.'
      },
      clients: {
        low: 'High client concentration is risky. Actively seek new clients across different industries to reduce dependency.',
        medium: 'Good start on diversification. Try to ensure no single client exceeds 30% of your income.'
      },
      skills: {
        low: 'Your skills may be falling behind market demand. Invest in learning high-demand technologies and consider certifications.',
        medium: 'Dedicate more time to upskilling. Even 5 hours/week of focused learning can significantly boost your market position.'
      },
      pipeline: {
        low: 'Your pipeline is dangerously thin. Increase proposal volume, improve your profile visibility, and consider cold outreach.',
        medium: 'Strengthen your pipeline by tracking conversion rates and optimizing proposals. Aim for 4+ weeks of confirmed work.'
      },
      wellbeing: {
        low: 'Burnout risk detected. Set firm boundaries on work hours, schedule regular time off, and consider raising rates to work fewer hours.',
        medium: 'Monitor your work-life balance closely. Schedule dedicated rest time and enforce client communication boundaries.'
      }
    };
    return (recs[category] && recs[category][level]) || 'Review and improve this area of your freelance business.';
  }

  // ── Styles ──

  var styles = '\
    .fh-wrap{font-family:Inter,-apple-system,sans-serif;color:var(--text,#e0e0e0);max-width:900px;margin:0 auto;padding:1.5rem 1rem}\
    .fh-wrap h2{margin:0 0 .3rem;font-size:1.4rem;color:var(--text-bright,#fff)}\
    .fh-subtitle{color:var(--text-dim,#888);font-size:.85rem;margin-bottom:1.5rem}\
    .fh-card{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1.2rem;margin-bottom:1rem}\
    .fh-card h3{margin:0 0 .85rem;font-size:1rem;color:var(--text-bright,#fff)}\
    .fh-category-header{display:flex;align-items:center;gap:.5rem;cursor:pointer;user-select:none}\
    .fh-category-header:hover h3{color:var(--orange,#ff8844)}\
    .fh-field{margin-bottom:.65rem}\
    .fh-field label{display:block;font-size:.78rem;color:var(--text-dim,#888);margin-bottom:.25rem}\
    .fh-field input,.fh-field select{width:100%;padding:.45rem .6rem;background:var(--bg,#0a0a0a);border:1px solid var(--border,#222);border-radius:var(--radius-sm,8px);color:var(--text,#e0e0e0);font-size:.85rem;box-sizing:border-box}\
    .fh-field input[type=range]{padding:0;margin-top:.3rem}\
    .fh-range-val{float:right;font-size:.75rem;color:var(--orange,#ff8844);font-weight:600}\
    .fh-btn{background:var(--orange,#ff8844);color:#000;border:none;padding:.6rem 1.2rem;border-radius:var(--radius-sm,8px);cursor:pointer;font-size:.9rem;font-weight:600;transition:opacity .2s;width:100%;margin-top:.5rem}\
    .fh-btn:hover{opacity:.85}\
    .fh-btn-outline{background:transparent;border:1px solid var(--border,#222);color:var(--text,#e0e0e0);width:auto}\
    .fh-btn-outline:hover{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844)}\
    .fh-overall{text-align:center;padding:1.5rem}\
    .fh-score-ring{display:inline-flex;align-items:center;justify-content:center;width:120px;height:120px;border-radius:50%;border:4px solid var(--border,#222);margin:.75rem 0;position:relative}\
    .fh-score-num{font-size:2.5rem;font-weight:800}\
    .fh-grade{font-size:1.1rem;font-weight:600;margin-bottom:.5rem}\
    .fh-cats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem;margin:1.5rem 0}\
    .fh-cat-card{background:var(--bg,#0a0a0a);border-radius:var(--radius-sm,8px);padding:.85rem;text-align:center}\
    .fh-cat-icon{font-size:1.5rem;margin-bottom:.3rem}\
    .fh-cat-score{font-size:1.6rem;font-weight:700;margin:.2rem 0}\
    .fh-cat-name{font-size:.75rem;color:var(--text-dim,#888)}\
    .fh-bar{height:4px;background:var(--border,#222);border-radius:2px;margin-top:.4rem;overflow:hidden}\
    .fh-bar-fill{height:100%;border-radius:2px;transition:width .6s}\
    .fh-rec{padding:.75rem;border-left:3px solid var(--orange,#ff8844);margin-bottom:.5rem;background:rgba(255,136,68,.04);border-radius:0 var(--radius-sm,8px) var(--radius-sm,8px) 0}\
    .fh-rec-high{border-left-color:var(--red,#ff4444);background:rgba(255,68,68,.04)}\
    .fh-rec-cat{font-size:.72rem;font-weight:600;color:var(--text-dim,#888);text-transform:uppercase;letter-spacing:.5px}\
    .fh-rec-msg{font-size:.82rem;margin-top:.2rem;line-height:1.5}\
    .fh-history{margin-top:1rem}\
    .fh-history-item{display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border,#222);font-size:.82rem}\
    @media(max-width:600px){.fh-cats-grid{grid-template-columns:1fr 1fr}}\
  ';

  // ── Render ──

  function render(containerId) {
    if (!document.getElementById('fh-styles')) {
      var s = document.createElement('style');
      s.id = 'fh-styles';
      s.textContent = styles;
      document.head.appendChild(s);
    }

    var container = document.getElementById(containerId);
    if (!container) return;

    var savedData = loadData();
    var answers = savedData.lastAnswers || {};

    var html = '<div class="fh-wrap">';
    html += '<h2>Freelancer Business Health Check</h2>';
    html += '<p class="fh-subtitle">Monthly assessment of your freelance business health across 5 key areas.</p>';

    // Assessment form
    html += '<div id="fh-form">';
    var catKeys = Object.keys(CATEGORIES);
    catKeys.forEach(function (key) {
      var cat = CATEGORIES[key];
      html += '<div class="fh-card"><div class="fh-category-header"><span style="font-size:1.3rem">' + cat.icon + '</span><h3>' + escHtml(cat.name) + '</h3></div>';
      cat.questions.forEach(function (q) {
        var val = answers[q.id] || '';
        html += '<div class="fh-field"><label>' + escHtml(q.label);
        if (q.type === 'range') html += '<span class="fh-range-val" id="fh-rv-' + q.id + '">' + (val || q.min || 0) + '%</span>';
        html += '</label>';
        if (q.type === 'number') {
          html += '<input type="number" id="fh-' + q.id + '" value="' + escHtml(String(val)) + '" placeholder="' + (q.placeholder || '') + '">';
        } else if (q.type === 'range') {
          html += '<input type="range" id="fh-' + q.id + '" min="' + (q.min || 0) + '" max="' + (q.max || 100) + '" step="' + (q.step || 1) + '" value="' + (val || q.min || 0) + '">';
        } else if (q.type === 'select') {
          html += '<select id="fh-' + q.id + '">';
          (q.options || []).forEach(function (opt) {
            html += '<option value="' + escHtml(opt) + '"' + (val === opt ? ' selected' : '') + '>' + escHtml(opt) + '</option>';
          });
          html += '</select>';
        }
        html += '</div>';
      });
      html += '</div>';
    });

    html += '<button class="fh-btn" id="fh-assess">Run Health Assessment</button>';
    html += '</div>';

    // Results (hidden initially)
    html += '<div id="fh-results" style="display:none"></div>';

    // History
    var history = savedData.history || [];
    if (history.length) {
      html += '<div class="fh-history"><div class="fh-card"><h3>Assessment History</h3>';
      history.slice(0, 10).forEach(function (item) {
        var d = new Date(item.date);
        var color = item.overall >= 65 ? 'var(--green,#00ff88)' : item.overall >= 50 ? 'var(--orange,#ff8844)' : 'var(--red,#ff4444)';
        html += '<div class="fh-history-item"><span>' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</span>';
        html += '<span style="color:' + color + ';font-weight:600">' + item.overall + '/100 — ' + escHtml(item.grade) + '</span></div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Range display updaters
    catKeys.forEach(function (key) {
      CATEGORIES[key].questions.forEach(function (q) {
        if (q.type === 'range') {
          var el = document.getElementById('fh-' + q.id);
          if (el) {
            el.addEventListener('input', function () {
              var disp = document.getElementById('fh-rv-' + q.id);
              if (disp) disp.textContent = el.value + '%';
            });
          }
        }
      });
    });

    // Events
    container.addEventListener('click', function (e) {
      if (e.target.id === 'fh-assess') {
        var allAnswers = gatherAnswers();
        var result = runAssessment(allAnswers);
        showResults(result);

        // Save
        var saved = loadData();
        saved.lastAnswers = allAnswers;
        if (!saved.history) saved.history = [];
        saved.history.unshift({ overall: result.overall, grade: result.grade, date: result.date });
        if (saved.history.length > 24) saved.history = saved.history.slice(0, 24);
        saveData(saved);
      }

      if (e.target.id === 'fh-back-to-form') {
        document.getElementById('fh-form').style.display = 'block';
        document.getElementById('fh-results').style.display = 'none';
      }
    });

    function gatherAnswers() {
      var a = {};
      catKeys.forEach(function (key) {
        CATEGORIES[key].questions.forEach(function (q) {
          var el = document.getElementById('fh-' + q.id);
          if (el) a[q.id] = el.value;
        });
      });
      return a;
    }

    function showResults(result) {
      document.getElementById('fh-form').style.display = 'none';
      var resultsDiv = document.getElementById('fh-results');
      resultsDiv.style.display = 'block';

      var color = result.overall >= 65 ? 'var(--green,#00ff88)' : result.overall >= 50 ? 'var(--orange,#ff8844)' : 'var(--red,#ff4444)';

      var h = '<div class="fh-card fh-overall">';
      h += '<h3>Business Health Score</h3>';
      h += '<div class="fh-score-ring" style="border-color:' + color + '"><span class="fh-score-num" style="color:' + color + '">' + result.overall + '</span></div>';
      h += '<div class="fh-grade" style="color:' + color + '">' + escHtml(result.grade) + '</div>';
      h += '<div style="font-size:.82rem;color:var(--text-dim,#888)">Assessed on ' + new Date().toLocaleDateString() + '</div>';
      h += '</div>';

      // Category breakdown
      h += '<div class="fh-card"><h3>Category Breakdown</h3><div class="fh-cats-grid">';
      Object.keys(result.categories).forEach(function (key) {
        var cat = result.categories[key];
        var c = cat.score >= 65 ? 'var(--green,#00ff88)' : cat.score >= 50 ? 'var(--orange,#ff8844)' : 'var(--red,#ff4444)';
        h += '<div class="fh-cat-card"><div class="fh-cat-icon">' + cat.icon + '</div>';
        h += '<div class="fh-cat-score" style="color:' + c + '">' + cat.score + '</div>';
        h += '<div class="fh-cat-name">' + escHtml(cat.name) + '</div>';
        h += '<div class="fh-bar"><div class="fh-bar-fill" style="width:' + cat.score + '%;background:' + c + '"></div></div></div>';
      });
      h += '</div></div>';

      // Recommendations
      if (result.recommendations.length) {
        h += '<div class="fh-card"><h3>Recommendations</h3>';
        result.recommendations.forEach(function (rec) {
          h += '<div class="fh-rec' + (rec.priority === 'high' ? ' fh-rec-high' : '') + '">';
          h += '<div class="fh-rec-cat">' + escHtml(rec.category) + ' — ' + rec.priority + ' priority</div>';
          h += '<div class="fh-rec-msg">' + escHtml(rec.message) + '</div></div>';
        });
        h += '</div>';
      }

      h += '<button class="fh-btn" id="fh-back-to-form" style="margin-top:.5rem">Update Assessment</button>';
      resultsDiv.innerHTML = h;
    }
  }

  // ── Public API ──

  var FreelancerHealth = {
    init: function () {},
    render: render,
    assess: runAssessment,
    getHistory: function () { return (loadData().history || []); }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.FreelancerHealth = FreelancerHealth;
})();
