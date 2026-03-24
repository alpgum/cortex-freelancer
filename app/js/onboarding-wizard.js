(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var CSS_INJECTED = false;
  var STORAGE_KEY = 'cortex_onboarding';
  var COLLECTION = 'users';

  var NICHES = [
    'Web Development', 'Mobile Development', 'UI/UX Design', 'Graphic Design',
    'Data Science', 'Machine Learning', 'DevOps', 'Cloud Architecture',
    'Content Writing', 'Copywriting', 'SEO', 'Digital Marketing',
    'Video Editing', 'Animation', 'Virtual Assistant', 'Project Management',
    'Blockchain', 'Cybersecurity', 'QA Testing', 'Other'
  ];

  var PRIORITY_TOOLS = [
    { id: 'proposal-generator', name: 'Proposal Generator', desc: 'AI-powered proposals' },
    { id: 'job-scorer', name: 'Job Scorer', desc: 'Rate job quality instantly' },
    { id: 'rate-optimizer', name: 'Rate Optimizer', desc: 'Find your ideal rate' },
    { id: 'profile-rewriter', name: 'Profile Rewriter', desc: 'Optimize your profile' },
    { id: 'earnings-dashboard', name: 'Earnings Dashboard', desc: 'Track your income' },
    { id: 'connects-tracker', name: 'Connects Tracker', desc: 'Manage your connects' },
    { id: 'client-crm', name: 'Client CRM', desc: 'Manage client relationships' },
    { id: 'contract-review', name: 'Contract Review', desc: 'Analyze contracts' },
    { id: 'tax-estimator', name: 'Tax Estimator', desc: 'Estimate your taxes' }
  ];

  var state = {
    step: 1,
    data: {
      displayName: '',
      niche: '',
      customNiche: '',
      importMethod: null,
      upworkUrl: '',
      priorityTools: []
    }
  };

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getCurrentUser() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth().currentUser;
    }
    return null;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step: state.step, data: state.data }));
    } catch (e) { /* quota */ }
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        state.step = saved.step || 1;
        state.data = Object.assign(state.data, saved.data || {});
      }
    } catch (e) { /* corrupt */ }
  }

  function markComplete() {
    try {
      localStorage.setItem(STORAGE_KEY + '_complete', 'true');
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* */ }
  }

  function isComplete() {
    try {
      return localStorage.getItem(STORAGE_KEY + '_complete') === 'true';
    } catch (e) {
      return false;
    }
  }

  function saveToFirestore() {
    var user = getCurrentUser();
    if (!user) return Promise.resolve();
    var db = getFirestore();
    if (!db) return Promise.resolve();

    var onboardingData = {
      onboarding: {
        displayName: state.data.displayName,
        niche: state.data.niche === 'Other' ? state.data.customNiche : state.data.niche,
        importMethod: state.data.importMethod,
        upworkUrl: state.data.upworkUrl || null,
        priorityTools: state.data.priorityTools,
        completedAt: new Date().toISOString()
      }
    };

    if (state.data.displayName) {
      onboardingData.settings = onboardingData.settings || {};
      onboardingData.displayName = state.data.displayName;
    }

    return db.collection(COLLECTION).doc(user.uid).set(onboardingData, { merge: true })
      .catch(function (err) {
        console.error('[Onboarding] Save failed:', err);
      });
  }

  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.cf-onboard { max-width: 520px; margin: 40px auto; padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cf-onboard-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 32px; }',
      '.cf-onboard-step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; border: 2px solid #e2e8f0; color: #94a3b8; background: #fff; transition: all 0.2s; }',
      '.cf-onboard-step-dot.active { border-color: #6366f1; color: #6366f1; background: #eef2ff; }',
      '.cf-onboard-step-dot.done { border-color: #22c55e; color: #fff; background: #22c55e; }',
      '.cf-onboard-step-line { flex: 1; height: 2px; background: #e2e8f0; }',
      '.cf-onboard-step-line.done { background: #22c55e; }',
      '.cf-onboard-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; }',
      '.cf-onboard-card h2 { font-size: 20px; font-weight: 700; margin: 0 0 6px; color: #1a1a2e; }',
      '.cf-onboard-card .subtitle { font-size: 14px; color: #64748b; margin: 0 0 24px; }',
      '.cf-onboard-field { margin-bottom: 16px; }',
      '.cf-onboard-label { display: block; font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 6px; }',
      '.cf-onboard-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; }',
      '.cf-onboard-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }',
      '.cf-onboard-select { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: #fff; outline: none; }',
      '.cf-onboard-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }',
      '.cf-onboard-method { padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; text-align: center; transition: all 0.15s; }',
      '.cf-onboard-method:hover { border-color: #c7d2fe; }',
      '.cf-onboard-method.selected { border-color: #6366f1; background: #eef2ff; }',
      '.cf-onboard-method .icon { font-size: 28px; margin-bottom: 6px; }',
      '.cf-onboard-method .name { font-size: 14px; font-weight: 600; color: #334155; }',
      '.cf-onboard-method .desc { font-size: 12px; color: #94a3b8; margin-top: 2px; }',
      '.cf-onboard-tools { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; }',
      '@media (max-width: 520px) { .cf-onboard-tools { grid-template-columns: 1fr 1fr; } }',
      '.cf-onboard-tool { padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.15s; }',
      '.cf-onboard-tool:hover { border-color: #c7d2fe; }',
      '.cf-onboard-tool.selected { border-color: #6366f1; background: #eef2ff; }',
      '.cf-onboard-tool .tool-name { font-size: 13px; font-weight: 600; color: #334155; }',
      '.cf-onboard-tool .tool-desc { font-size: 11px; color: #94a3b8; margin-top: 2px; }',
      '.cf-onboard-tool-count { font-size: 13px; color: #64748b; margin-bottom: 12px; }',
      '.cf-onboard-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }',
      '.cf-onboard-btn { padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }',
      '.cf-onboard-next { background: #6366f1; color: #fff; }',
      '.cf-onboard-next:hover { background: #4f46e5; }',
      '.cf-onboard-next:disabled { opacity: 0.4; cursor: not-allowed; }',
      '.cf-onboard-back { background: transparent; color: #64748b; border: 1px solid #e2e8f0; }',
      '.cf-onboard-back:hover { background: #f8fafc; }',
      '.cf-onboard-skip { background: none; border: none; color: #94a3b8; font-size: 13px; cursor: pointer; text-decoration: underline; }',
      '.cf-onboard-skip:hover { color: #64748b; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderProgressBar() {
    var html = '<div class="cf-onboard-progress">';
    for (var i = 1; i <= 3; i++) {
      var cls = 'cf-onboard-step-dot';
      if (i < state.step) cls += ' done';
      else if (i === state.step) cls += ' active';
      html += '<div class="' + cls + '">' + (i < state.step ? '&#10003;' : i) + '</div>';
      if (i < 3) {
        html += '<div class="cf-onboard-step-line' + (i < state.step ? ' done' : '') + '"></div>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderStep1() {
    return '<div class="cf-onboard-card">' +
      '<h2>Welcome! Let\'s get started</h2>' +
      '<p class="subtitle">Tell us a bit about yourself</p>' +
      '<div class="cf-onboard-field">' +
        '<label class="cf-onboard-label">Your Name</label>' +
        '<input class="cf-onboard-input" id="cf-ob-name" type="text" value="' + (state.data.displayName || '').replace(/"/g, '&quot;') + '" placeholder="What should we call you?">' +
      '</div>' +
      '<div class="cf-onboard-field">' +
        '<label class="cf-onboard-label">Your Niche / Specialty</label>' +
        '<select class="cf-onboard-select" id="cf-ob-niche">' +
          '<option value="">Select your niche...</option>' +
          NICHES.map(function (n) {
            var sel = n === state.data.niche ? ' selected' : '';
            return '<option value="' + n + '"' + sel + '>' + n + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="cf-onboard-field" id="cf-ob-custom-wrap" style="display:' + (state.data.niche === 'Other' ? 'block' : 'none') + '">' +
        '<label class="cf-onboard-label">Describe your niche</label>' +
        '<input class="cf-onboard-input" id="cf-ob-custom-niche" type="text" value="' + (state.data.customNiche || '').replace(/"/g, '&quot;') + '" placeholder="e.g. Technical Documentation">' +
      '</div>' +
      '<div class="cf-onboard-actions">' +
        '<button class="cf-onboard-skip" id="cf-ob-skip">Skip setup</button>' +
        '<button class="cf-onboard-btn cf-onboard-next" id="cf-ob-next">Continue</button>' +
      '</div>' +
    '</div>';
  }

  function renderStep2() {
    var upworkSel = state.data.importMethod === 'upwork' ? ' selected' : '';
    var manualSel = state.data.importMethod === 'manual' ? ' selected' : '';

    return '<div class="cf-onboard-card">' +
      '<h2>Set up your profile</h2>' +
      '<p class="subtitle">Import your existing data or start fresh</p>' +
      '<div class="cf-onboard-methods">' +
        '<div class="cf-onboard-method' + upworkSel + '" data-method="upwork">' +
          '<div class="icon">&#127760;</div>' +
          '<div class="name">Import from Upwork</div>' +
          '<div class="desc">Auto-fill your profile</div>' +
        '</div>' +
        '<div class="cf-onboard-method' + manualSel + '" data-method="manual">' +
          '<div class="icon">&#9998;</div>' +
          '<div class="name">Manual Setup</div>' +
          '<div class="desc">Start from scratch</div>' +
        '</div>' +
      '</div>' +
      '<div id="cf-ob-upwork-field" style="display:' + (state.data.importMethod === 'upwork' ? 'block' : 'none') + '">' +
        '<div class="cf-onboard-field">' +
          '<label class="cf-onboard-label">Upwork Profile URL</label>' +
          '<input class="cf-onboard-input" id="cf-ob-upwork-url" type="url" value="' + (state.data.upworkUrl || '').replace(/"/g, '&quot;') + '" placeholder="https://www.upwork.com/freelancers/~yourprofile">' +
        '</div>' +
      '</div>' +
      '<div class="cf-onboard-actions">' +
        '<button class="cf-onboard-btn cf-onboard-back" id="cf-ob-back">Back</button>' +
        '<button class="cf-onboard-btn cf-onboard-next" id="cf-ob-next">Continue</button>' +
      '</div>' +
    '</div>';
  }

  function renderStep3() {
    var selected = state.data.priorityTools || [];

    return '<div class="cf-onboard-card">' +
      '<h2>Pick your top tools</h2>' +
      '<p class="subtitle">Choose up to 3 tools to pin to your dashboard</p>' +
      '<div class="cf-onboard-tool-count">Selected: <strong id="cf-ob-tool-count">' + selected.length + '</strong> / 3</div>' +
      '<div class="cf-onboard-tools">' +
        PRIORITY_TOOLS.map(function (t) {
          var sel = selected.indexOf(t.id) >= 0 ? ' selected' : '';
          return '<div class="cf-onboard-tool' + sel + '" data-tool="' + t.id + '">' +
            '<div class="tool-name">' + t.name + '</div>' +
            '<div class="tool-desc">' + t.desc + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="cf-onboard-actions">' +
        '<button class="cf-onboard-btn cf-onboard-back" id="cf-ob-back">Back</button>' +
        '<button class="cf-onboard-btn cf-onboard-next" id="cf-ob-next">Finish Setup</button>' +
      '</div>' +
    '</div>';
  }

  function render(container, onComplete) {
    injectCSS();
    loadProgress();

    function draw() {
      var stepHTML;
      if (state.step === 1) stepHTML = renderStep1();
      else if (state.step === 2) stepHTML = renderStep2();
      else stepHTML = renderStep3();

      container.innerHTML = '<div class="cf-onboard">' + renderProgressBar() + stepHTML + '</div>';
      bindStepEvents(container, draw, onComplete);
    }

    draw();
  }

  function bindStepEvents(container, redraw, onComplete) {
    var nextBtn = container.querySelector('#cf-ob-next');
    var backBtn = container.querySelector('#cf-ob-back');
    var skipBtn = container.querySelector('#cf-ob-skip');

    if (state.step === 1) {
      var nameInput = container.querySelector('#cf-ob-name');
      var nicheSelect = container.querySelector('#cf-ob-niche');
      var customWrap = container.querySelector('#cf-ob-custom-wrap');

      nicheSelect.addEventListener('change', function () {
        state.data.niche = nicheSelect.value;
        customWrap.style.display = nicheSelect.value === 'Other' ? 'block' : 'none';
      });

      nextBtn.addEventListener('click', function () {
        state.data.displayName = nameInput.value.trim();
        state.data.niche = nicheSelect.value;
        if (nicheSelect.value === 'Other') {
          state.data.customNiche = container.querySelector('#cf-ob-custom-niche').value.trim();
        }
        state.step = 2;
        saveProgress();
        redraw();
      });

      if (skipBtn) {
        skipBtn.addEventListener('click', function () {
          markComplete();
          if (onComplete) onComplete(state.data);
        });
      }
    }

    if (state.step === 2) {
      container.querySelectorAll('.cf-onboard-method').forEach(function (el) {
        el.addEventListener('click', function () {
          container.querySelectorAll('.cf-onboard-method').forEach(function (m) { m.classList.remove('selected'); });
          el.classList.add('selected');
          state.data.importMethod = el.dataset.method;
          var upworkField = container.querySelector('#cf-ob-upwork-field');
          upworkField.style.display = el.dataset.method === 'upwork' ? 'block' : 'none';
        });
      });

      nextBtn.addEventListener('click', function () {
        if (state.data.importMethod === 'upwork') {
          var urlInput = container.querySelector('#cf-ob-upwork-url');
          state.data.upworkUrl = urlInput ? urlInput.value.trim() : '';
        }
        state.step = 3;
        saveProgress();
        redraw();
      });
    }

    if (state.step === 3) {
      container.querySelectorAll('.cf-onboard-tool').forEach(function (el) {
        el.addEventListener('click', function () {
          var toolId = el.dataset.tool;
          var idx = state.data.priorityTools.indexOf(toolId);
          if (idx >= 0) {
            state.data.priorityTools.splice(idx, 1);
            el.classList.remove('selected');
          } else if (state.data.priorityTools.length < 3) {
            state.data.priorityTools.push(toolId);
            el.classList.add('selected');
          }
          var countEl = container.querySelector('#cf-ob-tool-count');
          if (countEl) countEl.textContent = state.data.priorityTools.length;
        });
      });

      nextBtn.addEventListener('click', function () {
        saveToFirestore().then(function () {
          markComplete();
          if (onComplete) onComplete(state.data);
        });
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        state.step--;
        saveProgress();
        redraw();
      });
    }
  }

  window.CortexFreelancer.OnboardingWizard = {
    render: render,
    isComplete: isComplete,
    reset: function () {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + '_complete');
      state.step = 1;
      state.data = { displayName: '', niche: '', customNiche: '', importMethod: null, upworkUrl: '', priorityTools: [] };
    },
    NICHES: NICHES,
    PRIORITY_TOOLS: PRIORITY_TOOLS
  };
})();
