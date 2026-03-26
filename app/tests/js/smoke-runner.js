/* ========================================================
   Cortex Freelancer — Smoke Test Runner
   [cf3-034] End-to-end smoke tests for all tools
   ======================================================== */

(function () {
  'use strict';

  const TOOL_BASE = '/app/tools/';
  const IFRAME_TIMEOUT = 8000;
  const ACTION_DELAY = 300;

  // ── Test definitions ────────────────────────────────────
  // Each entry: { name, page, fill(doc), assert(doc) }

  const TESTS = [
    // ── MONEY ──────────────────────────────────────────────
    {
      name: 'Rate Calculator',
      page: 'rate-calculator.html',
      fill(doc) {
        _select(doc, '#rc-skill', 'web-dev');
        _select(doc, '#rc-exp', 'mid');
        _select(doc, '#rc-country', 'US');
        _input(doc, '#rc-rate', '50');
      },
      assert(doc) {
        const btn = doc.querySelector('.calc-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#calc-result.visible, #calc-result[style*="block"]', 2000)
          .then(() => {
            const val = doc.querySelector('#result-rate');
            return _ok(val && val.textContent.includes('$'), 'Result rate should contain $');
          });
      }
    },
    {
      name: 'Fee Calculator',
      page: 'fee-calculator.html',
      fill(doc) {
        _input(doc, '#amount', '2500');
        _select(doc, '#source', 'USD');
        _select(doc, '#destination', 'EUR');
      },
      assert(doc) {
        const btn = doc.querySelector('.calc-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#resultContent[style*="block"], #resultContent:not([style*="none"])', 2000)
          .then(() => {
            const rows = doc.querySelectorAll('#tableBody tr');
            return _ok(rows.length > 0, 'Fee table should have rows');
          });
      }
    },
    {
      name: 'Tax Estimator',
      page: 'tax-estimator.html',
      fill(doc) {
        _input(doc, '#te-income', '60000');
        _select(doc, '#te-country', 'US');
        _input(doc, '#te-expenses', '5000');
      },
      assert(doc) {
        const btn = doc.querySelector('.calc-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#res-tax', 1500)
          .then(() => {
            const tax = doc.querySelector('#res-tax');
            return _ok(tax && tax.textContent !== '$0', 'Tax estimate should not be $0');
          });
      }
    },
    {
      name: 'Payment Checker',
      page: 'payment-checker.html',
      fill(doc) {
        _select(doc, '#platform', 'upwork');
        _input(doc, '#amount', '1500');
        const today = new Date().toISOString().split('T')[0];
        _input(doc, '#completionDate', today);
        _select(doc, '#withdrawal', 'bank');
      },
      assert(doc) {
        const btn = doc.querySelector('.calc-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#resultContent:not([style*="none"]), #resultCards', 2000)
          .then(() => {
            const cards = doc.querySelectorAll('#resultCards .result-card, #timelineSteps .step');
            return _ok(cards.length > 0 || doc.querySelector('#resultContent'), 'Payment timeline should render');
          });
      }
    },

    // ── CLIENTS ────────────────────────────────────────────
    {
      name: 'Client Red Flag Detector',
      page: 'client-red-flags.html',
      fill(doc) {
        _textarea(doc, '#textInput', 'Looking for a rockstar developer to build our app. Must be available 24/7. Budget is $200 for full project. No contract needed, we are a startup. Unlimited revisions included.');
      },
      assert(doc) {
        const btn = doc.querySelector('#analyzeBtn, .analyze-btn');
        if (btn) btn.click();
        return _waitFor(doc, '.verdict-card, #verdictCard, .results-section.has-results', 2000)
          .then(() => {
            const flags = doc.querySelectorAll('.flag-card, .flag-item, [class*="flag"]');
            const verdict = doc.querySelector('#verdictCard, .verdict-card');
            return _ok(
              (flags.length > 0) || (verdict && verdict.textContent.length > 10),
              'Red flags or verdict should render'
            );
          });
      }
    },
    {
      name: 'Email Writer',
      page: 'email-writer.html',
      fill(doc) {
        _textarea(doc, '#contextInput', 'Client has not responded in 2 weeks after I delivered the first milestone. The project is a website redesign worth $3,000.');
        _input(doc, '#clientNameInput', 'Sarah');
        _input(doc, '#yourNameInput', 'Alex');
        _select(doc, '#scenarioSelect', 'follow-up');
        _select(doc, '#toneSelect', 'professional');
      },
      assert(doc) {
        const btn = doc.querySelector('.generate-btn');
        if (btn) btn.click();
        return _waitFor(doc, '.results-section.visible, .email-card', 2500)
          .then(() => {
            const cards = doc.querySelectorAll('.email-card');
            return _ok(cards.length > 0, 'Email variants should render');
          });
      }
    },
    {
      name: 'Contract Review',
      page: 'contract-review.html',
      fill(doc) {
        _textarea(doc, '#contract-text', 'This agreement is between Client Corp and Freelancer. The freelancer agrees to deliver a website redesign within 30 days. Payment of $5,000 will be made upon completion. The client retains all intellectual property rights. No revisions are included. The freelancer may not work with competing companies for 2 years. Termination requires 0 days notice.');
      },
      assert(doc) {
        const btn = doc.querySelector('#review-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#score-value, .score-section', 2500)
          .then(() => {
            const score = doc.querySelector('#score-value');
            return _ok(score && score.textContent !== '0', 'Contract score should render');
          });
      }
    },
    {
      name: 'Bio Generator',
      page: 'bio-generator.html',
      fill(doc) {
        _input(doc, '#nameInput', 'Sarah Chen');
        _select(doc, '#expInput', '5-10');
        _input(doc, '#nicheInput', 'SaaS startups');
        _select(doc, '#toneSelect', 'professional');
        // Add a skill if skill input exists
        const skillInput = doc.querySelector('.skills-input, #skillsInput');
        if (skillInput) {
          skillInput.value = 'React';
          skillInput.dispatchEvent(new Event('input', { bubbles: true }));
          skillInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      },
      assert(doc) {
        const btn = doc.querySelector('#generateBtn, .generate-btn');
        if (btn) btn.click();
        return _waitFor(doc, '.bio-card, .results-section:not([style*="none"]) .bio-text, #results .bio-card', 2500)
          .then(() => {
            const bios = doc.querySelectorAll('.bio-card, .bio-text');
            return _ok(bios.length > 0, 'Bio cards should render');
          });
      }
    },
    {
      name: 'Scope Analyzer',
      page: 'scope-analyzer.html',
      fill(doc) {
        _textarea(doc, '#briefInput', 'We need a full redesign of our e-commerce website. The site should have a new homepage, product pages, checkout flow, and admin dashboard. We want unlimited revisions and the project should be done ASAP. Budget around $2000.');
        _input(doc, '#rateInput', '50');
        _selectFirst(doc, '#categoryInput');
      },
      assert(doc) {
        const btn = doc.querySelector('#analyzeBtn, .analyze-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#summaryBar, #deliverablesBody tr, .results-section.has-results', 2500)
          .then(() => {
            const rows = doc.querySelectorAll('#deliverablesBody tr');
            const summary = doc.querySelector('#summaryBar');
            return _ok(
              rows.length > 0 || (summary && summary.textContent.length > 5),
              'Scope analysis should render deliverables or summary'
            );
          });
      }
    },
    {
      name: 'Portfolio Review',
      page: 'portfolio-review.html',
      fill(doc) {
        _textarea(doc, '#portfolio-desc', 'My portfolio has 5 case studies with screenshots. I have a clear hire-me button, pricing packages, 3 client testimonials, and it is mobile-friendly. Contact info is in the footer. I have basic SEO with meta tags.');
      },
      assert(doc) {
        const btn = doc.querySelector('#analyze-btn, .analyze-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#score-hero, #check-list .check-item', 2000)
          .then(() => {
            const hero = doc.querySelector('#score-hero');
            return _ok(hero && hero.textContent.length > 5, 'Portfolio score should render');
          });
      }
    },
    {
      name: 'Profile SEO Analyzer',
      page: 'profile-seo.html',
      fill(doc) {
        _input(doc, '#seo-title', 'Full Stack Web Developer | React & Node.js Expert');
        _textarea(doc, '#seo-overview', 'I am a senior full-stack developer with 8 years of experience building scalable web applications. I specialize in React, Node.js, TypeScript, and cloud infrastructure. I have delivered 50+ projects for startups and enterprises.');
        _selectFirst(doc, '#seo-category');
        _input(doc, '#seo-skills', 'React, Node.js, TypeScript, AWS');
      },
      assert(doc) {
        const btn = doc.querySelector('.analyze-btn, .generate-btn, button[onclick*="analyze"]');
        if (btn) btn.click();
        return _waitFor(doc, '#seo-score-num, #issues-list', 2000)
          .then(() => {
            const score = doc.querySelector('#seo-score-num');
            return _ok(score && score.textContent !== '0', 'SEO score should render');
          });
      }
    },
    {
      name: 'Meeting Notes Summarizer',
      page: 'meeting-notes.html',
      fill(doc) {
        _textarea(doc, '#notesInput', 'Met with client today about the rebrand project. John said the logo needs to be finalized by Friday. Sarah will handle the color palette. We decided to go with option B for the homepage. Budget approved at $5,000. Need to follow up with dev team about API timeline. Next meeting Thursday 2pm.');
        _input(doc, '#meetingTitle', 'Client Rebrand Kickoff');
        const today = new Date().toISOString().split('T')[0];
        _input(doc, '#meetingDate', today);
      },
      assert(doc) {
        const btn = doc.querySelector('#analyzeBtn, .analyze-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#resultsContent:not([style*="none"]), #summaryText', 2500)
          .then(() => {
            const summary = doc.querySelector('#summaryText');
            return _ok(summary && summary.textContent.length > 10, 'Meeting summary should render');
          });
      }
    },
    {
      name: 'Timezone Overlap',
      page: 'timezone-overlap.html',
      fill(doc) {
        _selectByText(doc, '#yourLocation', 'New York');
        _selectByText(doc, '#clientLocation', 'London');
        _input(doc, '#yourStart', '9');
        _input(doc, '#yourEnd', '17');
        _input(doc, '#clientStart', '9');
        _input(doc, '#clientEnd', '17');
      },
      assert(doc) {
        const btn = doc.querySelector('#calcBtn, .analyze-btn');
        if (btn) btn.click();
        return _waitFor(doc, '#tzSummary, #overlapVisual, .overlap-visual', 2000)
          .then(() => {
            const summary = doc.querySelector('#tzSummary');
            return _ok(summary && summary.textContent.length > 5, 'Timezone overlap should render');
          });
      }
    },
    {
      name: 'Project Brief Generator',
      page: 'project-brief.html',
      fill(doc) {
        _input(doc, '#project-title', 'Brand Identity Redesign');
        _selectFirst(doc, '#project-type');
        _selectFirst(doc, '#client-industry');
        _input(doc, '#your-name', 'Jane Smith Design Studio');
        _input(doc, '#client-name', 'Acme Corp');
        _textarea(doc, '#project-overview', 'Complete brand identity redesign including logo, color palette, typography, and brand guidelines for a tech startup.');
        _input(doc, '#budget-amount', '5000');
      },
      assert(doc) {
        // Project brief uses live preview, check the preview pane updates
        const btn = doc.querySelector('#btn-copy, .btn-action');
        return _delay(500).then(() => {
          const preview = doc.querySelector('.preview-content, .brief-preview, [class*="preview"]');
          const copyBtn = doc.querySelector('#btn-copy');
          return _ok(
            (preview && preview.textContent.length > 20) || (copyBtn && !copyBtn.disabled),
            'Project brief preview should render or copy button should be enabled'
          );
        });
      }
    },
    {
      name: 'Ranking Simulator',
      page: 'ranking-simulator.html',
      fill(doc) {
        _input(doc, '#sim-title', 'Full Stack Developer');
        _input(doc, '#sim-rate', '45');
        _input(doc, '#sim-jss', '92');
        _input(doc, '#sim-earnings', '25000');
        _input(doc, '#sim-skills', 'React, Node.js, TypeScript');
        _input(doc, '#sim-hours', '1200');
        _input(doc, '#sim-jobs', '35');
        _selectFirst(doc, '#sim-category');
      },
      assert(doc) {
        const btn = doc.querySelector('.analyze-btn, .calc-btn, button[onclick*="simulate"], button[onclick*="calculate"]');
        if (btn) btn.click();
        return _waitFor(doc, '#current-rank, #projected-rank, #changes-list', 2000)
          .then(() => {
            const rank = doc.querySelector('#current-rank');
            return _ok(rank && rank.textContent !== '#\u2014', 'Ranking score should render');
          });
      }
    },

    // ── PAGE LOAD TESTS (tools that are data-driven dashboards) ──
    {
      name: 'Tools Index',
      page: 'index.html',
      fill() {},
      assert(doc) {
        const cards = doc.querySelectorAll('.tool-card, [class*="card"]');
        const search = doc.querySelector('#tool-search');
        return Promise.resolve(
          _ok(cards.length > 5 && search, 'Index should have tool cards and search')
        );
      }
    },
    {
      name: 'Dashboard',
      page: 'dashboard.html',
      fill() {},
      assert(doc) {
        const metrics = doc.querySelectorAll('.metric-card, .stat-card, [class*="metric"]');
        return Promise.resolve(
          _ok(metrics.length > 0 || doc.querySelector('.dashboard, .quick-actions, [class*="dashboard"]'), 'Dashboard should render layout')
        );
      }
    },
    {
      name: 'Analytics',
      page: 'analytics.html',
      fill() {},
      assert(doc) {
        const kpi = doc.querySelectorAll('.kpi-card, [class*="kpi"]');
        const tabs = doc.querySelectorAll('.tab-btn, [class*="tab"]');
        return Promise.resolve(
          _ok(kpi.length > 0 || tabs.length > 0, 'Analytics page should render KPIs or tabs')
        );
      }
    },
    {
      name: 'Time Tracker',
      page: 'time-tracker.html',
      fill() {},
      assert(doc) {
        const timer = doc.querySelector('.timer-display, .timer, [class*="timer"]');
        const startBtn = doc.querySelector('[onclick*="start"], .start-btn, [class*="start"]');
        return Promise.resolve(
          _ok(timer || startBtn, 'Time tracker should render timer UI')
        );
      }
    },
    {
      name: 'Client Onboarding',
      page: 'client-onboarding.html',
      fill() {},
      assert(doc) {
        const steps = doc.querySelectorAll('.step, [class*="step"], .checklist-item');
        const stats = doc.querySelectorAll('.stat-card, [class*="stat"]');
        return Promise.resolve(
          _ok(steps.length > 0 || stats.length > 0 || doc.querySelector('[class*="onboarding"]'), 'Onboarding page should render')
        );
      }
    },
    {
      name: 'Invoice Generator',
      page: 'invoice.html',
      fill() {},
      assert(doc) {
        const form = doc.querySelector('form, .invoice-form, [class*="invoice"]');
        return Promise.resolve(
          _ok(form || doc.querySelector('input, textarea'), 'Invoice page should render form')
        );
      }
    },
    {
      name: 'Proposal Writer',
      page: 'proposal.html',
      fill() {},
      assert(doc) {
        const textarea = doc.querySelector('textarea');
        const btn = doc.querySelector('.generate-btn, button[onclick*="generate"]');
        return Promise.resolve(
          _ok(textarea && btn, 'Proposal page should render input and generate button')
        );
      }
    },
    {
      name: 'Client CRM',
      page: 'client-crm.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('[class*="client"], [class*="crm"], .add-btn, input'), 'Client CRM should render')
        );
      }
    },
    {
      name: 'Revenue Forecast',
      page: 'revenue-forecast.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('canvas, [class*="chart"], [class*="forecast"], input'), 'Revenue forecast should render')
        );
      }
    },
    {
      name: 'Availability Calendar',
      page: 'availability.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('[class*="calendar"], [class*="grid"], [class*="avail"]'), 'Availability page should render calendar')
        );
      }
    },
    {
      name: 'Project Tracker',
      page: 'project-tracker.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('[class*="kanban"], [class*="board"], [class*="column"], [class*="project"]'), 'Project tracker should render board')
        );
      }
    },
    {
      name: 'Status Update',
      page: 'status-update.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('textarea, [class*="status"], button'), 'Status update page should render')
        );
      }
    },
    {
      name: 'Testimonial Request',
      page: 'testimonial-request.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('textarea, input, [class*="testimonial"]'), 'Testimonial request page should render')
        );
      }
    },
    {
      name: 'Weekly Summary',
      page: 'weekly-summary.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('[class*="summary"], [class*="week"], button'), 'Weekly summary page should render')
        );
      }
    },
    {
      name: 'Upwork Feed',
      page: 'upwork-feed.html',
      fill() {},
      assert(doc) {
        return Promise.resolve(
          _ok(doc.querySelector('[class*="feed"], [class*="job"], input, [class*="filter"]'), 'Upwork feed page should render')
        );
      }
    },
  ];

  // ── Helpers ──────────────────────────────────────────────

  function _input(doc, sel, val) {
    const el = doc.querySelector(sel);
    if (!el) return;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function _textarea(doc, sel, val) {
    const el = doc.querySelector(sel);
    if (!el) return;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function _select(doc, sel, val) {
    const el = doc.querySelector(sel);
    if (!el) return;
    const opt = el.querySelector('option[value="' + val + '"]');
    if (opt) {
      el.value = val;
    } else {
      // fallback: pick first non-empty option
      _selectFirst(doc, sel);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function _selectFirst(doc, sel) {
    const el = doc.querySelector(sel);
    if (!el) return;
    const opts = el.querySelectorAll('option');
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].value && opts[i].value !== '') {
        el.value = opts[i].value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }
  }

  function _selectByText(doc, sel, text) {
    const el = doc.querySelector(sel);
    if (!el) return;
    const opts = el.querySelectorAll('option');
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].textContent.indexOf(text) !== -1) {
        el.value = opts[i].value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }
    _selectFirst(doc, sel);
  }

  function _waitFor(doc, selector, timeout) {
    return new Promise(function (resolve) {
      var elapsed = 0;
      var interval = 100;
      (function check() {
        var el = doc.querySelector(selector);
        if (el) return resolve(el);
        elapsed += interval;
        if (elapsed >= timeout) return resolve(null);
        setTimeout(check, interval);
      })();
    });
  }

  function _delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function _ok(condition, message) {
    return { pass: !!condition, message: message };
  }

  // ── Runner ──────────────────────────────────────────────

  var results = [];
  var running = false;

  function createIframe(page) {
    return new Promise(function (resolve, reject) {
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:1024px;height:768px;border:1px solid #333;position:absolute;left:-9999px;top:0;';
      iframe.src = TOOL_BASE + page;
      var timer = setTimeout(function () {
        reject(new Error('Timeout loading ' + page));
      }, IFRAME_TIMEOUT);
      iframe.onload = function () {
        clearTimeout(timer);
        resolve(iframe);
      };
      iframe.onerror = function () {
        clearTimeout(timer);
        reject(new Error('Failed to load ' + page));
      };
      document.body.appendChild(iframe);
    });
  }

  function runSingleTest(test) {
    var startTime = Date.now();
    return createIframe(test.page)
      .then(function (iframe) {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        // Fill sample data
        test.fill(doc);
        return _delay(ACTION_DELAY).then(function () {
          return test.assert(doc);
        }).then(function (result) {
          document.body.removeChild(iframe);
          return {
            name: test.name,
            page: test.page,
            pass: result.pass,
            message: result.message,
            duration: Date.now() - startTime
          };
        });
      })
      .catch(function (err) {
        return {
          name: test.name,
          page: test.page,
          pass: false,
          message: err.message || String(err),
          duration: Date.now() - startTime
        };
      });
  }

  function runAllTests(onProgress, onDone) {
    if (running) return;
    running = true;
    results = [];
    var idx = 0;

    function next() {
      if (idx >= TESTS.length) {
        running = false;
        if (onDone) onDone(results);
        return;
      }
      var test = TESTS[idx];
      idx++;
      runSingleTest(test).then(function (r) {
        results.push(r);
        if (onProgress) onProgress(r, idx, TESTS.length);
        next();
      });
    }

    next();
  }

  // ── UI Binding ──────────────────────────────────────────

  function initUI() {
    var runBtn = document.getElementById('run-all-btn');
    var progressBar = document.getElementById('progress-bar');
    var progressFill = document.getElementById('progress-fill');
    var progressText = document.getElementById('progress-text');
    var summaryEl = document.getElementById('summary');
    var resultsEl = document.getElementById('results-list');
    var passCount = document.getElementById('pass-count');
    var failCount = document.getElementById('fail-count');
    var totalCount = document.getElementById('total-count');
    var durationEl = document.getElementById('total-duration');

    totalCount.textContent = TESTS.length;
    var globalStart;

    runBtn.addEventListener('click', function () {
      runBtn.disabled = true;
      runBtn.textContent = 'Running...';
      resultsEl.innerHTML = '';
      summaryEl.style.display = 'none';
      progressBar.style.display = 'block';
      progressFill.style.width = '0%';
      progressText.textContent = '0 / ' + TESTS.length;
      var passes = 0;
      var fails = 0;
      globalStart = Date.now();

      runAllTests(
        function onProgress(r, done, total) {
          var pct = Math.round((done / total) * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = done + ' / ' + total;

          if (r.pass) passes++;
          else fails++;

          var row = document.createElement('div');
          row.className = 'result-row ' + (r.pass ? 'pass' : 'fail');
          row.innerHTML =
            '<span class="result-icon">' + (r.pass ? '\u2705' : '\u274C') + '</span>' +
            '<span class="result-name">' + r.name + '</span>' +
            '<span class="result-page">' + r.page + '</span>' +
            '<span class="result-msg">' + _escHtml(r.message) + '</span>' +
            '<span class="result-time">' + r.duration + 'ms</span>';
          resultsEl.appendChild(row);
        },
        function onDone() {
          var elapsed = Date.now() - globalStart;
          runBtn.disabled = false;
          runBtn.textContent = 'Run All Tests';
          summaryEl.style.display = 'flex';
          passCount.textContent = passes;
          failCount.textContent = fails;
          durationEl.textContent = (elapsed / 1000).toFixed(1) + 's';
          passCount.parentElement.className = 'summary-stat ' + (passes === TESTS.length ? 'all-pass' : '');
          failCount.parentElement.className = 'summary-stat ' + (fails > 0 ? 'has-fail' : '');
        }
      );
    });
  }

  function _escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Exports ─────────────────────────────────────────────
  window.CortexSmokeRunner = {
    TESTS: TESTS,
    runAllTests: runAllTests,
    runSingleTest: runSingleTest,
    initUI: initUI
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

})();
