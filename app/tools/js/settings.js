/* ============================================
   CORTEX FREELANCER — Settings & Preferences
   cf3-040 | settings.js
   ============================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_user_settings';
  var RATE_KEY = 'cortex_hourly_rate';
  var THEME_KEY = 'cortex_theme';

  var TIMEZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
    'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
    'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Istanbul',
    'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok',
    'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Sydney', 'Pacific/Auckland'
  ];

  var CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '\u20ac', name: 'Euro' },
    { code: 'GBP', symbol: '\u00a3', name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'TRY', symbol: '\u20ba', name: 'Turkish Lira' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'INR', symbol: '\u20b9', name: 'Indian Rupee' },
    { code: 'JPY', symbol: '\u00a5', name: 'Japanese Yen' },
    { code: 'CNY', symbol: '\u00a5', name: 'Chinese Yuan' }
  ];

  var DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  var DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var NOTIFICATION_PREFS = [
    { key: 'emailDigest', label: 'Weekly email digest', desc: 'Summary of your week\u2019s activity', default: true },
    { key: 'jobAlerts', label: 'New job alerts', desc: 'Matching jobs from Upwork & boards', default: true },
    { key: 'proposalUpdates', label: 'Proposal status updates', desc: 'When clients view or respond', default: true },
    { key: 'billingAlerts', label: 'Billing & subscription alerts', desc: 'Payment confirmations and reminders', default: true },
    { key: 'tipsAndNews', label: 'Tips & product news', desc: 'Feature updates and freelance tips', default: false }
  ];

  // ---- State ----
  var original = null;  // snapshot for dirty detection
  var settings = null;
  var dirty = false;
  var saving = false;

  function $(id) { return document.getElementById(id); }

  // ---- Defaults ----
  function defaultSettings() {
    var notifs = {};
    NOTIFICATION_PREFS.forEach(function (p) { notifs[p.key] = p.default; });
    var hours = {};
    DAYS.forEach(function (d, i) {
      hours[d] = { enabled: i < 5, start: '09:00', end: '17:00' };
    });
    return {
      displayName: '',
      email: '',
      photoURL: '',
      title: '',
      hourlyRate: 0,
      currency: 'USD',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      workingHours: hours,
      notifications: notifs,
      theme: 'dark',
      updatedAt: null
    };
  }

  // ---- Persistence ----
  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveLocal(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
  }

  function getFirestore() {
    return (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
  }

  function getUserDocRef(uid) {
    var db = getFirestore();
    return (db && uid) ? db.collection('users').doc(uid) : null;
  }

  function loadSettings() {
    var local = loadLocal();
    settings = Object.assign(defaultSettings(), local || {});

    // Sync hourly rate from legacy key
    var legacyRate = localStorage.getItem(RATE_KEY);
    if (legacyRate && !settings.hourlyRate) {
      settings.hourlyRate = parseFloat(legacyRate) || 0;
    }

    // Sync theme from legacy key
    var legacyTheme = localStorage.getItem(THEME_KEY);
    if (legacyTheme) settings.theme = legacyTheme;

    original = JSON.stringify(settings);
    return settings;
  }

  function saveSettings() {
    if (saving) return;
    saving = true;
    settings.updatedAt = new Date().toISOString();
    saveLocal(settings);

    // Sync hourly rate to legacy key so other tools pick it up
    if (settings.hourlyRate) {
      localStorage.setItem(RATE_KEY, String(settings.hourlyRate));
    }
    // Sync theme
    localStorage.setItem(THEME_KEY, settings.theme);

    var uid = getCurrentUid();
    var ref = getUserDocRef(uid);
    if (!ref) {
      saving = false;
      dirty = false;
      original = JSON.stringify(settings);
      hideSaveBar();
      showToast('Settings saved locally');
      return;
    }

    ref.set({ settings: settings }, { merge: true }).then(function () {
      saving = false;
      dirty = false;
      original = JSON.stringify(settings);
      hideSaveBar();
      showToast('Settings saved');

      // Update Firebase Auth profile
      var user = firebase.auth().currentUser;
      if (user) {
        user.updateProfile({
          displayName: settings.displayName || null,
          photoURL: settings.photoURL || null
        }).catch(function () { /* non-critical */ });
      }
    }).catch(function (err) {
      saving = false;
      showToast('Save failed: ' + err.message, true);
    });
  }

  function fetchRemote(uid) {
    var ref = getUserDocRef(uid);
    if (!ref) return;
    ref.get().then(function (doc) {
      if (doc.exists && doc.data().settings) {
        settings = Object.assign(defaultSettings(), doc.data().settings);
        saveLocal(settings);
        original = JSON.stringify(settings);
        render();
      }
    }).catch(function () { /* use local */ });
  }

  // ---- Helpers ----
  function getCurrentUid() {
    if (typeof window.cortexGetUser === 'function') {
      var u = window.cortexGetUser();
      return u ? u.uid : null;
    }
    try {
      var cached = JSON.parse(localStorage.getItem('cortex_firebase_user') || '{}');
      return cached.uid || null;
    } catch (e) { return null; }
  }

  function markDirty() {
    dirty = true;
    showSaveBar();
  }

  function showSaveBar() { $('save-bar').classList.add('visible'); }
  function hideSaveBar() { $('save-bar').classList.remove('visible'); }

  function showToast(msg, isError) {
    var t = $('toast');
    var m = $('toast-msg');
    m.textContent = msg;
    t.className = 'settings-toast' + (isError ? ' error' : '') + ' visible';
    setTimeout(function () { t.classList.remove('visible'); }, 2500);
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ---- Theme application ----
  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === 'light') {
      root.style.setProperty('--bg', '#f5f5f7');
      root.style.setProperty('--bg2', '#ffffff');
      root.style.setProperty('--bg3', '#ececee');
      root.style.setProperty('--bg4', '#dddde0');
      root.style.setProperty('--text', '#1a1a2e');
      root.style.setProperty('--text2', '#555566');
      root.style.setProperty('--text3', '#999999');
    } else if (theme === 'midnight') {
      root.style.setProperty('--bg', '#08081a');
      root.style.setProperty('--bg2', '#0e0e28');
      root.style.setProperty('--bg3', '#161636');
      root.style.setProperty('--bg4', '#1e1e44');
      root.style.setProperty('--text', '#e8e8ff');
      root.style.setProperty('--text2', '#9090cc');
      root.style.setProperty('--text3', '#555588');
    } else {
      // Dark (default) — reset to original
      root.style.setProperty('--bg', '#0a0a0f');
      root.style.setProperty('--bg2', '#111118');
      root.style.setProperty('--bg3', '#1a1a22');
      root.style.setProperty('--bg4', '#222230');
      root.style.setProperty('--text', '#f0f0f0');
      root.style.setProperty('--text2', '#b0b0b0');
      root.style.setProperty('--text3', '#666666');
    }
  }

  // ---- Photo upload ----
  function handlePhoto(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select an image file', true);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2 MB', true);
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var size = 200;
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var sSize = Math.min(img.width, img.height);
        var sx = (img.width - sSize) / 2;
        var sy = (img.height - sSize) / 2;
        ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        settings.photoURL = dataUrl;
        var av = document.querySelector('.avatar-circle');
        if (av) av.innerHTML = '<img src="' + dataUrl + '" alt="Avatar">';
        markDirty();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ---- Data export / import ----
  function exportData() {
    var data = { _cortex_export: true, _version: 1, _exportedAt: new Date().toISOString(), settings: settings };
    // Gather tool data from localStorage
    var toolKeys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('cortex_')) toolKeys.push(k);
    }
    var toolData = {};
    toolKeys.forEach(function (k) {
      try { toolData[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { toolData[k] = localStorage.getItem(k); }
    });
    data.localStorage = toolData;

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'cortex-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported');
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data._cortex_export) {
          showToast('Invalid backup file', true);
          return;
        }
        // Restore localStorage entries
        if (data.localStorage) {
          Object.keys(data.localStorage).forEach(function (k) {
            var v = data.localStorage[k];
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          });
        }
        // Restore settings
        if (data.settings) {
          settings = Object.assign(defaultSettings(), data.settings);
          saveLocal(settings);
          original = JSON.stringify(settings);
          render();
        }
        showToast('Data imported — ' + Object.keys(data.localStorage || {}).length + ' keys restored');
      } catch (err) {
        showToast('Import failed: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  }

  // ---- Storage usage ----
  function getStorageUsage() {
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('cortex_')) {
        total += (localStorage.getItem(k) || '').length;
      }
    }
    return total;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ---- Account deletion ----
  function requestDeleteAccount() {
    var uid = getCurrentUid();
    if (!uid) {
      showToast('Sign in to delete your account', true);
      return;
    }
    var confirmed = confirm('Are you sure you want to delete your account?\n\nThis will permanently remove all your data. This action cannot be undone.');
    if (!confirmed) return;
    var doubleConfirm = prompt('Type DELETE to confirm account deletion:');
    if (doubleConfirm !== 'DELETE') {
      showToast('Account deletion cancelled', false);
      return;
    }

    // Call the delete account API
    var fetchFn = typeof window.cortexFetch === 'function' ? window.cortexFetch : fetch;
    fetchFn('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: uid })
    }).then(function (res) {
      if (!res.ok) throw new Error('Server error');
      // Clear local data
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith('cortex_')) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
      showToast('Account deleted. Redirecting...');
      setTimeout(function () { window.location.href = '/'; }, 2000);
    }).catch(function (err) {
      showToast('Deletion failed: ' + err.message, true);
    });
  }

  // ---- Render ----
  function render() {
    var root = $('settings-root');
    var s = settings;

    var tzOptions = TIMEZONES.map(function (tz) {
      var sel = tz === s.timezone ? ' selected' : '';
      return '<option value="' + tz + '"' + sel + '>' + tz.replace(/_/g, ' ') + '</option>';
    }).join('');

    var curOptions = CURRENCIES.map(function (c) {
      var sel = c.code === s.currency ? ' selected' : '';
      return '<option value="' + c.code + '"' + sel + '>' + c.symbol + ' ' + c.code + ' \u2014 ' + c.name + '</option>';
    }).join('');

    var hoursHtml = DAYS.map(function (d, i) {
      var h = (s.workingHours && s.workingHours[d]) || { enabled: i < 5, start: '09:00', end: '17:00' };
      var checked = h.enabled ? ' checked' : '';
      return '<span class="day-label">' + DAY_LABELS[i] + '</span>' +
        '<input type="time" class="form-input hours-start" data-day="' + d + '" value="' + h.start + '"' + (h.enabled ? '' : ' disabled') + '>' +
        '<input type="time" class="form-input hours-end" data-day="' + d + '" value="' + h.end + '"' + (h.enabled ? '' : ' disabled') + '>' +
        '<label class="toggle-switch"><input type="checkbox" class="hours-toggle" data-day="' + d + '"' + checked + '><span class="toggle-slider"></span></label>';
    }).join('');

    var notifsHtml = NOTIFICATION_PREFS.map(function (p) {
      var checked = (s.notifications && s.notifications[p.key]) ? ' checked' : '';
      return '<div class="toggle-row">' +
        '<div class="toggle-label">' + p.label + '<small>' + p.desc + '</small></div>' +
        '<label class="toggle-switch"><input type="checkbox" data-notif="' + p.key + '"' + checked + '><span class="toggle-slider"></span></label>' +
        '</div>';
    }).join('');

    var storageUsed = getStorageUsage();
    var maxStorage = 5 * 1024 * 1024; // 5 MB localStorage limit
    var storagePct = Math.min(100, Math.round(storageUsed / maxStorage * 100));

    root.innerHTML =
      '<div class="settings-header">' +
        '<h1><span>Settings</span> & Preferences</h1>' +
        '<p>Manage your profile, billing defaults, and workspace. Changes apply across all tools.</p>' +
      '</div>' +

      '<div class="settings-tabs" id="tabs">' +
        '<button class="settings-tab active" data-tab="profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Profile</button>' +
        '<button class="settings-tab" data-tab="billing"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Billing</button>' +
        '<button class="settings-tab" data-tab="schedule"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Schedule</button>' +
        '<button class="settings-tab" data-tab="notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> Notifications</button>' +
        '<button class="settings-tab" data-tab="appearance"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Appearance</button>' +
        '<button class="settings-tab" data-tab="data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Data</button>' +
        '<button class="settings-tab" data-tab="account"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Account</button>' +
      '</div>' +

      /* ---- Profile Section ---- */
      '<div class="settings-section active" data-section="profile">' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Profile Information</h3>' +
          '<p class="card-desc">Your public identity across Cortex tools and proposals.</p>' +
          '<div class="photo-wrap">' +
            '<div class="avatar-circle" id="avatar">' +
              (s.photoURL ? '<img src="' + s.photoURL.replace(/"/g, '&quot;') + '" alt="Avatar">' : '\ud83d\udc64') +
            '</div>' +
            '<div class="photo-actions">' +
              '<button class="btn-secondary" id="btn-upload-photo">Upload Photo</button>' +
              '<button class="btn-secondary" id="btn-remove-photo" style="color:var(--red)">Remove</button>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Display Name</label>' +
              '<input class="form-input" id="inp-name" type="text" value="' + esc(s.displayName) + '" placeholder="Your name">' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Professional Title</label>' +
              '<input class="form-input" id="inp-title" type="text" value="' + esc(s.title || '') + '" placeholder="e.g. Full-Stack Developer">' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Email</label>' +
            '<input class="form-input" id="inp-email" type="email" value="' + esc(s.email) + '" placeholder="your@email.com">' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Billing Section ---- */
      '<div class="settings-section" data-section="billing">' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> Billing Defaults</h3>' +
          '<p class="card-desc">Default rate and currency used across invoices, time tracker, and proposals.</p>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Default Hourly Rate</label>' +
              '<input class="form-input" id="inp-rate" type="number" min="0" step="1" value="' + (s.hourlyRate || '') + '" placeholder="50">' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Currency</label>' +
              '<select class="form-select" id="inp-currency">' + curOptions + '</select>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Schedule Section ---- */
      '<div class="settings-section" data-section="schedule">' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Timezone</h3>' +
          '<p class="card-desc">Used for time tracking, deadlines, and scheduling.</p>' +
          '<div class="form-group">' +
            '<label>Timezone</label>' +
            '<select class="form-select" id="inp-timezone">' + tzOptions + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Working Hours</h3>' +
          '<p class="card-desc">Set your default availability for each day of the week.</p>' +
          '<div class="hours-grid">' + hoursHtml + '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Notifications Section ---- */
      '<div class="settings-section" data-section="notifications">' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> Notification Preferences</h3>' +
          '<p class="card-desc">Choose which notifications you\u2019d like to receive.</p>' +
          notifsHtml +
        '</div>' +
      '</div>' +

      /* ---- Appearance Section ---- */
      '<div class="settings-section" data-section="appearance">' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/></svg> Theme</h3>' +
          '<p class="card-desc">Choose your preferred color scheme. Applied immediately.</p>' +
          '<div class="theme-options">' +
            '<div class="theme-option theme-dark' + (s.theme === 'dark' ? ' selected' : '') + '" data-theme="dark" title="Dark"><span class="check">\u2713</span></div>' +
            '<div class="theme-option theme-midnight' + (s.theme === 'midnight' ? ' selected' : '') + '" data-theme="midnight" title="Midnight"><span class="check">\u2713</span></div>' +
            '<div class="theme-option' + (s.theme === 'light' ? ' selected' : '') + '" data-theme="light" title="Light" style="background:linear-gradient(135deg,#f5f5f7,#dddde0)"><span class="check">\u2713</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Data Section ---- */
      '<div class="settings-section" data-section="data">' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export Data</h3>' +
          '<p class="card-desc">Download all your Cortex data as a JSON file.</p>' +
          '<div class="btn-row">' +
            '<button class="btn-primary" id="btn-export">Export All Data</button>' +
          '</div>' +
        '</div>' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Import Data</h3>' +
          '<p class="card-desc">Restore from a previously exported backup file.</p>' +
          '<div class="backup-zone" id="import-zone">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
            '<p>Click to select a backup file</p>' +
            '<small>.json files exported from Cortex</small>' +
          '</div>' +
        '</div>' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> Local Storage</h3>' +
          '<p class="card-desc">Data stored in your browser\u2019s local storage.</p>' +
          '<div class="storage-meter"><div class="storage-meter-fill" style="width:' + storagePct + '%"></div></div>' +
          '<div class="storage-label">' + formatBytes(storageUsed) + ' of ~5 MB used (' + storagePct + '%)</div>' +
          '<div class="btn-row" style="margin-top:1rem">' +
            '<button class="btn-danger" id="btn-clear-data">Clear All Local Data</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Account Section ---- */
      '<div class="settings-section" data-section="account">' +
        '<div class="settings-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Account Status</h3>' +
          '<p class="card-desc">Your current plan and subscription details.</p>' +
          '<div class="backup-meta" id="account-status">Checking status...</div>' +
        '</div>' +
        '<div class="settings-card danger-card">' +
          '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Danger Zone</h3>' +
          '<p class="card-desc">Permanently delete your account and all associated data. This cannot be undone.</p>' +
          '<div class="btn-row">' +
            '<button class="btn-danger" id="btn-delete-account">Delete My Account</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindEvents();
    applyTheme(s.theme);
    updateAccountStatus();
  }

  // ---- Event binding ----
  function bindEvents() {
    // Tab switching
    var tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.settings-section').forEach(function (sec) { sec.classList.remove('active'); });
        var target = document.querySelector('[data-section="' + tab.dataset.tab + '"]');
        if (target) target.classList.add('active');
      });
    });

    // Profile inputs
    var inputs = ['inp-name', 'inp-title', 'inp-email', 'inp-rate', 'inp-currency', 'inp-timezone'];
    inputs.forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () {
        readFormIntoSettings();
        markDirty();
      });
    });

    // Photo upload
    $('btn-upload-photo').addEventListener('click', function () { $('photo-file').click(); });
    $('photo-file').addEventListener('change', function () {
      if (this.files && this.files[0]) handlePhoto(this.files[0]);
    });
    $('btn-remove-photo').addEventListener('click', function () {
      settings.photoURL = '';
      var av = document.querySelector('.avatar-circle');
      if (av) av.innerHTML = '\ud83d\udc64';
      markDirty();
    });

    // Working hours toggles
    document.querySelectorAll('.hours-toggle').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var day = cb.dataset.day;
        var row = cb.closest('.hours-grid') || document;
        var starts = row.querySelectorAll('.hours-start[data-day="' + day + '"]');
        var ends = row.querySelectorAll('.hours-end[data-day="' + day + '"]');
        starts.forEach(function (el) { el.disabled = !cb.checked; });
        ends.forEach(function (el) { el.disabled = !cb.checked; });
        readFormIntoSettings();
        markDirty();
      });
    });
    document.querySelectorAll('.hours-start, .hours-end').forEach(function (el) {
      el.addEventListener('change', function () {
        readFormIntoSettings();
        markDirty();
      });
    });

    // Notification toggles
    document.querySelectorAll('[data-notif]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        settings.notifications[cb.dataset.notif] = cb.checked;
        markDirty();
      });
    });

    // Theme options
    document.querySelectorAll('.theme-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        document.querySelectorAll('.theme-option').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        settings.theme = opt.dataset.theme;
        applyTheme(settings.theme);
        markDirty();
      });
    });

    // Data buttons
    $('btn-export').addEventListener('click', exportData);
    $('import-zone').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function () {
      if (this.files && this.files[0]) importData(this.files[0]);
    });
    $('btn-clear-data').addEventListener('click', function () {
      if (!confirm('Clear all local Cortex data? This cannot be undone.')) return;
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith('cortex_')) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
      showToast('Local data cleared (' + keys.length + ' keys removed)');
      settings = defaultSettings();
      original = JSON.stringify(settings);
      dirty = false;
      hideSaveBar();
      render();
    });

    // Account
    $('btn-delete-account').addEventListener('click', requestDeleteAccount);

    // Save bar
    $('btn-save').addEventListener('click', saveSettings);
    $('btn-discard').addEventListener('click', function () {
      settings = JSON.parse(original);
      dirty = false;
      hideSaveBar();
      render();
    });
  }

  function readFormIntoSettings() {
    settings.displayName = ($('inp-name') || {}).value || '';
    settings.title = ($('inp-title') || {}).value || '';
    settings.email = ($('inp-email') || {}).value || '';
    settings.hourlyRate = parseFloat(($('inp-rate') || {}).value) || 0;
    settings.currency = ($('inp-currency') || {}).value || 'USD';
    settings.timezone = ($('inp-timezone') || {}).value || 'UTC';

    // Working hours
    DAYS.forEach(function (d) {
      var toggle = document.querySelector('.hours-toggle[data-day="' + d + '"]');
      var start = document.querySelector('.hours-start[data-day="' + d + '"]');
      var end = document.querySelector('.hours-end[data-day="' + d + '"]');
      if (toggle && start && end) {
        settings.workingHours[d] = {
          enabled: toggle.checked,
          start: start.value || '09:00',
          end: end.value || '17:00'
        };
      }
    });
  }

  function updateAccountStatus() {
    var el = $('account-status');
    if (!el) return;
    var uid = getCurrentUid();
    var isPro = typeof window.cortexIsPro === 'function' && window.cortexIsPro();
    if (!uid) {
      el.innerHTML = '<strong>Guest Mode</strong> — Sign in to sync settings across devices.';
    } else if (isPro) {
      el.innerHTML = '<strong style="color:var(--green)">Pro Plan</strong> — All features unlocked. UID: <code>' + uid.slice(0, 8) + '...</code>';
    } else {
      el.innerHTML = '<strong>Free Plan</strong> — <a href="/app/dashboard.html#upgrade">Upgrade to Pro</a> for full access. UID: <code>' + uid.slice(0, 8) + '...</code>';
    }
  }

  // ---- Init ----
  function init() {
    loadSettings();

    // Populate from Firebase user if available
    var cached;
    try { cached = JSON.parse(localStorage.getItem('cortex_firebase_user') || '{}'); } catch (e) { cached = {}; }
    if (!settings.displayName && cached.displayName) settings.displayName = cached.displayName;
    if (!settings.email && cached.email) settings.email = cached.email;
    if (!settings.photoURL && cached.photoURL) settings.photoURL = cached.photoURL;

    render();

    // Fetch from Firestore when auth is ready
    if (typeof window.cortexWhenAuth === 'function') {
      window.cortexWhenAuth(function (user) {
        if (user) fetchRemote(user.uid);
        updateAccountStatus();
      });
    } else if (typeof window.cortexAuthReady !== 'undefined') {
      window.cortexAuthReady.then(function () {
        var uid = getCurrentUid();
        if (uid) fetchRemote(uid);
        updateAccountStatus();
      }).catch(function () {});
    }

    // Nav auth button
    if (typeof window.cortexWhenAuth === 'function') {
      window.cortexWhenAuth(function (user) {
        var btn = $('nav-auth-btn');
        if (!btn) return;
        if (user) {
          btn.textContent = user.displayName || 'Account';
          btn.href = '#';
          btn.onclick = function (e) { e.preventDefault(); if (typeof window.cortexSignOut === 'function') window.cortexSignOut(); };
        }
      });
    }

    try { dataLayer.push({ 'event': 'tool_used', 'tool_name': 'settings' }); } catch (e) {}
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
