(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_onboarding';
  var COMPLETE_KEY = 'cortex_onboarding_complete';
  var SETTINGS_KEY = 'cortex_settings';

  // ── Skills catalog ──
  var SKILLS = [
    'Web Development', 'Mobile Development', 'UI/UX Design', 'Graphic Design',
    'Data Science', 'Machine Learning', 'DevOps', 'Cloud Architecture',
    'Content Writing', 'Copywriting', 'SEO', 'Digital Marketing',
    'Video Editing', 'Animation', 'Virtual Assistant', 'Project Management',
    'Blockchain', 'Cybersecurity', 'QA Testing', 'Full-Stack Development',
    'WordPress', 'Shopify', 'React', 'Python', 'Node.js', 'iOS', 'Android',
    'Data Entry', 'Translation', 'Accounting'
  ];

  // ── State ──
  var state = {
    step: 1,
    data: {
      displayName: '',
      skills: [],
      hourlyRate: null,
      currency: 'USD',
      rateType: 'hourly',
      timezone: '',
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      startHour: 9,
      endHour: 17,
      importMethod: 'fresh',
      upworkData: null
    }
  };

  // ── Redirect if already complete (unless ?reset param) ──
  var params = new URLSearchParams(window.location.search);
  if (!params.get('reset') && isComplete()) {
    window.location.href = '/app/dashboard.html';
    return;
  }

  // ── Load saved progress ──
  loadProgress();

  // ── Initialize ──
  document.addEventListener('DOMContentLoaded', function () {
    renderSkillChips();
    populateTimezones();
    populateHours();
    bindEvents();
    goToStep(state.step);
  });

  // ── Navigation ──
  function goToStep(n) {
    state.step = n;
    saveProgress();

    // Hide all steps
    document.querySelectorAll('.onb-step').forEach(function (el) {
      el.classList.remove('active');
    });

    // Show target step
    var stepId = n <= 4 ? 'onb-step-' + n : 'onb-step-done';
    var stepEl = document.getElementById(stepId);
    if (stepEl) stepEl.classList.add('active');

    // Update progress bar
    for (var i = 1; i <= 4; i++) {
      var p = document.getElementById('prog-' + i);
      if (!p) continue;
      p.classList.remove('active', 'done');
      if (i < n) p.classList.add('done');
      else if (i === n) p.classList.add('active');
    }

    // Update aria
    var prog = document.querySelector('.onb-progress');
    if (prog) prog.setAttribute('aria-valuenow', Math.min(n, 4));

    // Validate current step
    validateStep(n);

    // Auto-focus first input
    if (stepEl) {
      var firstInput = stepEl.querySelector('input:not([type=file]),select');
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 100);
    }

    // Start countdown on success
    if (n > 4) startCountdown();
  }

  // ── Skill chips ──
  function renderSkillChips() {
    var container = document.getElementById('onb-skills');
    if (!container) return;

    var html = '';
    SKILLS.forEach(function (skill) {
      var sel = state.data.skills.indexOf(skill) !== -1 ? ' selected' : '';
      html += '<div class="onb-chip' + sel + '" data-skill="' + escHtml(skill) + '">' + escHtml(skill) + '</div>';
    });

    // Show custom skills not in the catalog
    state.data.skills.forEach(function (skill) {
      if (SKILLS.indexOf(skill) === -1) {
        html += '<div class="onb-chip selected" data-skill="' + escHtml(skill) + '">' + escHtml(skill) + '</div>';
      }
    });

    html += '<div class="onb-chip-add" id="onb-add-skill">+ Custom</div>';
    container.innerHTML = html;
  }

  // ── Timezones ──
  function populateTimezones() {
    var select = document.getElementById('onb-timezone');
    if (!select) return;

    var zones = [
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Toronto', 'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin',
      'Europe/Amsterdam', 'Europe/Istanbul', 'Europe/Warsaw', 'Europe/Bucharest',
      'Europe/Kiev', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi',
      'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Jakarta',
      'Asia/Manila', 'Australia/Sydney', 'Pacific/Auckland'
    ];

    // Detect user timezone
    var userTz = '';
    try { userTz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* noop */ }
    if (!state.data.timezone && userTz) state.data.timezone = userTz;

    // Add detected tz to list if not present
    if (userTz && zones.indexOf(userTz) === -1) zones.unshift(userTz);

    var html = '';
    zones.forEach(function (tz) {
      var label = tz.replace(/_/g, ' ').replace(/\//g, ' / ');
      var offset = getUtcOffset(tz);
      var sel = state.data.timezone === tz ? ' selected' : '';
      html += '<option value="' + tz + '"' + sel + '>' + label + ' (UTC' + offset + ')</option>';
    });

    select.innerHTML = html;
  }

  function getUtcOffset(tz) {
    try {
      var d = new Date();
      var utcStr = d.toLocaleString('en-US', { timeZone: 'UTC', hour: '2-digit', hour12: false });
      var tzStr = d.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', hour12: false });
      var diff = parseInt(tzStr, 10) - parseInt(utcStr, 10);
      if (diff > 12) diff -= 24;
      if (diff < -12) diff += 24;
      return (diff >= 0 ? '+' : '') + diff;
    } catch (e) {
      return '+0';
    }
  }

  // ── Hours dropdowns ──
  function populateHours() {
    var startSel = document.getElementById('onb-start-hour');
    var endSel = document.getElementById('onb-end-hour');
    if (!startSel || !endSel) return;

    var html = '';
    for (var h = 0; h < 24; h++) {
      var label = (h === 0 ? '12' : h > 12 ? (h - 12) : h) + ':00 ' + (h < 12 ? 'AM' : 'PM');
      html += '<option value="' + h + '">' + label + '</option>';
    }
    startSel.innerHTML = html;
    endSel.innerHTML = html;

    startSel.value = state.data.startHour;
    endSel.value = state.data.endHour;
  }

  // ── Event bindings ──
  function bindEvents() {
    // Step 1: Name input
    var nameInput = document.getElementById('onb-name');
    if (nameInput) {
      nameInput.value = state.data.displayName;
      nameInput.addEventListener('input', function () {
        state.data.displayName = this.value.trim();
        validateStep(1);
        saveProgress();
      });
    }

    // Step 1: Skill chips (delegated)
    var skillsContainer = document.getElementById('onb-skills');
    if (skillsContainer) {
      skillsContainer.addEventListener('click', function (e) {
        var chip = e.target.closest('.onb-chip');
        var addBtn = e.target.closest('.onb-chip-add');

        if (addBtn) {
          var wrap = document.getElementById('onb-custom-skill-wrap');
          wrap.classList.toggle('visible');
          if (wrap.classList.contains('visible')) {
            document.getElementById('onb-custom-skill').focus();
          }
          return;
        }

        if (!chip) return;
        var skill = chip.dataset.skill;

        if (chip.classList.contains('selected')) {
          chip.classList.remove('selected');
          state.data.skills = state.data.skills.filter(function (s) { return s !== skill; });
        } else {
          if (state.data.skills.length >= 8) {
            showToast('Maximum 8 skills allowed');
            return;
          }
          chip.classList.add('selected');
          state.data.skills.push(skill);
        }
        validateStep(1);
        saveProgress();
      });
    }

    // Step 1: Add custom skill
    var addSkillBtn = document.getElementById('onb-add-skill-btn');
    var customInput = document.getElementById('onb-custom-skill');
    if (addSkillBtn && customInput) {
      function addCustomSkill() {
        var val = customInput.value.trim();
        if (!val || state.data.skills.length >= 8) return;
        if (state.data.skills.indexOf(val) !== -1) {
          showToast('Skill already added');
          return;
        }
        state.data.skills.push(val);
        customInput.value = '';
        renderSkillChips();
        validateStep(1);
        saveProgress();
      }
      addSkillBtn.addEventListener('click', addCustomSkill);
      customInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); }
      });
    }

    // Step 1: Skip
    var skipBtn = document.getElementById('onb-skip-all');
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        markComplete();
        window.location.href = '/app/dashboard.html';
      });
    }

    // Step 2: Rate
    var rateInput = document.getElementById('onb-rate');
    if (rateInput) {
      if (state.data.hourlyRate) rateInput.value = state.data.hourlyRate;
      rateInput.addEventListener('input', function () {
        state.data.hourlyRate = parseFloat(this.value) || null;
        validateStep(2);
        saveProgress();
      });
    }

    // Step 2: Currency
    var currencySelect = document.getElementById('onb-currency');
    if (currencySelect) {
      currencySelect.value = state.data.currency;
      currencySelect.addEventListener('change', function () {
        state.data.currency = this.value;
        saveProgress();
      });
    }

    // Step 2: Rate type
    var rateTypeSelect = document.getElementById('onb-rate-type');
    if (rateTypeSelect) {
      rateTypeSelect.value = state.data.rateType;
      rateTypeSelect.addEventListener('change', function () {
        state.data.rateType = this.value;
        saveProgress();
      });
    }

    // Step 3: Timezone
    var tzSelect = document.getElementById('onb-timezone');
    if (tzSelect) {
      tzSelect.addEventListener('change', function () {
        state.data.timezone = this.value;
        saveProgress();
      });
    }

    // Step 3: Working days
    var daysContainer = document.getElementById('onb-days');
    if (daysContainer) {
      // Restore saved days
      daysContainer.querySelectorAll('.onb-day').forEach(function (el) {
        var day = el.dataset.day;
        if (state.data.workingDays.indexOf(day) !== -1) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      daysContainer.addEventListener('click', function (e) {
        var dayEl = e.target.closest('.onb-day');
        if (!dayEl) return;
        dayEl.classList.toggle('active');

        state.data.workingDays = [];
        daysContainer.querySelectorAll('.onb-day.active').forEach(function (d) {
          state.data.workingDays.push(d.dataset.day);
        });
        saveProgress();
      });
    }

    // Step 3: Hours
    var startHour = document.getElementById('onb-start-hour');
    var endHour = document.getElementById('onb-end-hour');
    if (startHour) {
      startHour.addEventListener('change', function () {
        state.data.startHour = parseInt(this.value, 10);
        saveProgress();
      });
    }
    if (endHour) {
      endHour.addEventListener('change', function () {
        state.data.endHour = parseInt(this.value, 10);
        saveProgress();
      });
    }

    // Step 4: Import options
    var options = document.querySelectorAll('.onb-option');
    options.forEach(function (opt) {
      opt.addEventListener('click', function () {
        options.forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        state.data.importMethod = opt.dataset.import;

        // Show/hide import fields
        document.getElementById('onb-upwork-field').classList.remove('visible');
        document.getElementById('onb-csv-field').classList.remove('visible');

        if (opt.dataset.import === 'upwork') {
          document.getElementById('onb-upwork-field').classList.add('visible');
        } else if (opt.dataset.import === 'csv') {
          document.getElementById('onb-csv-field').classList.add('visible');
        }
        saveProgress();
      });
    });

    // Restore selected import option
    if (state.data.importMethod) {
      var selected = document.querySelector('.onb-option[data-import="' + state.data.importMethod + '"]');
      if (selected) selected.click();
    }

    // Navigation buttons
    bindNav('onb-btn-1', function () { goToStep(2); });
    bindNav('onb-btn-2', function () { goToStep(3); });
    bindNav('onb-btn-3', function () { goToStep(4); });
    bindNav('onb-btn-4', function () { finishSetup(); });
    bindNav('onb-back-2', function () { goToStep(1); });
    bindNav('onb-back-3', function () { goToStep(2); });
    bindNav('onb-back-4', function () { goToStep(3); });
  }

  function bindNav(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  // ── Validation ──
  function validateStep(n) {
    var btn;
    switch (n) {
      case 1:
        btn = document.getElementById('onb-btn-1');
        if (btn) btn.disabled = !(state.data.displayName.length >= 2 && state.data.skills.length >= 1);
        break;
      case 2:
        btn = document.getElementById('onb-btn-2');
        if (btn) btn.disabled = !(state.data.hourlyRate && state.data.hourlyRate > 0);
        break;
    }
  }

  // ── Finish setup ──
  function finishSetup() {
    // Parse Upwork data if provided
    if (state.data.importMethod === 'upwork') {
      var pasteEl = document.getElementById('onb-upwork-paste');
      var raw = pasteEl ? pasteEl.value.trim() : '';
      if (raw.length > 20 && window.parseUpworkProfile) {
        state.data.upworkData = window.parseUpworkProfile(raw);
      }
    }

    // Build settings object
    var settings = loadSettings();
    settings.user = settings.user || {};
    settings.user.displayName = state.data.displayName;
    settings.user.timezone = state.data.timezone;
    settings.user.currency = state.data.currency;

    settings.rates = settings.rates || {};
    settings.rates.defaultHourlyRate = state.data.hourlyRate;
    settings.rates.defaultCurrency = state.data.currency;

    settings.schedule = settings.schedule || {};
    settings.schedule.workingDays = state.data.workingDays;
    settings.schedule.startHour = state.data.startHour;
    settings.schedule.endHour = state.data.endHour;

    settings.onboarding = {
      skills: state.data.skills,
      rateType: state.data.rateType,
      importMethod: state.data.importMethod,
      completedAt: new Date().toISOString()
    };

    // Save to localStorage
    saveSettings(settings);
    markComplete();

    // Save Upwork profile if imported
    if (state.data.upworkData && window.CortexFreelancer && window.CortexFreelancer.setProfile) {
      window.CortexFreelancer.setProfile(state.data.upworkData);
    }

    // Save to Firestore if authenticated
    saveToFirestore(settings);

    // Show success
    goToStep(5);
  }

  // ── Firestore sync ──
  function saveToFirestore(settings) {
    try {
      var auth = window._cortexFirebaseAuth || (window.firebase && window.firebase.auth());
      if (!auth) return;

      var user = auth.currentUser;
      if (!user) return;

      var db = window._cortexFirestore || (window.firebase && window.firebase.firestore());
      if (!db) return;

      db.collection('users').doc(user.uid).set({
        settings: settings,
        onboarding: settings.onboarding,
        displayName: state.data.displayName
      }, { merge: true });
    } catch (e) {
      // Silent fail — localStorage is the primary store
    }
  }

  // ── Countdown ──
  function startCountdown() {
    var count = 5;
    var el = document.getElementById('onb-countdown');
    var timer = setInterval(function () {
      count--;
      if (el) el.textContent = count;
      if (count <= 0) {
        clearInterval(timer);
        window.location.href = '/app/dashboard.html';
      }
    }, 1000);
  }

  // ── Persistence ──
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
      localStorage.setItem(COMPLETE_KEY, 'true');
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* noop */ }
  }

  function isComplete() {
    try {
      return localStorage.getItem(COMPLETE_KEY) === 'true';
    } catch (e) { return false; }
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) { /* quota */ }
  }

  // ── Helpers ──
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }
})();
