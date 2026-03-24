(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var COLLECTION = 'users';
  var STORAGE_KEY = 'cortex_user_settings';
  var CSS_INJECTED = false;

  var state = {
    userId: null,
    settings: null,
    unsub: null,
    dirty: false,
    saving: false
  };

  var TIMEZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London',
    'Europe/Berlin', 'Europe/Istanbul', 'Asia/Dubai', 'Asia/Kolkata',
    'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'
  ];

  var NOTIFICATION_PREFS = [
    { key: 'emailDigest', label: 'Weekly email digest', default: true },
    { key: 'jobAlerts', label: 'New job alerts', default: true },
    { key: 'proposalUpdates', label: 'Proposal status updates', default: true },
    { key: 'billingAlerts', label: 'Billing & subscription alerts', default: true },
    { key: 'tipsAndNews', label: 'Tips & product news', default: false }
  ];

  function defaultSettings() {
    var notifs = {};
    NOTIFICATION_PREFS.forEach(function (p) {
      notifs[p.key] = p.default;
    });
    return {
      displayName: '',
      email: '',
      photoURL: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      notifications: notifs,
      updatedAt: null
    };
  }

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getUserDocRef(userId) {
    var db = getFirestore();
    if (!db || !userId) return null;
    return db.collection(COLLECTION).doc(userId);
  }

  function saveLocal(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* quota */ }
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function fetchSettings(userId) {
    state.userId = userId;
    var ref = getUserDocRef(userId);
    if (!ref) {
      var local = loadLocal();
      state.settings = local || defaultSettings();
      return Promise.resolve(state.settings);
    }

    return ref.get().then(function (doc) {
      if (doc.exists && doc.data().settings) {
        state.settings = Object.assign(defaultSettings(), doc.data().settings);
      } else {
        state.settings = defaultSettings();
        var user = typeof firebase !== 'undefined' && firebase.auth().currentUser;
        if (user) {
          state.settings.displayName = user.displayName || '';
          state.settings.email = user.email || '';
          state.settings.photoURL = user.photoURL || '';
        }
      }
      saveLocal(state.settings);
      return state.settings;
    }).catch(function () {
      var local = loadLocal();
      state.settings = local || defaultSettings();
      return state.settings;
    });
  }

  function saveSettings(userId) {
    if (state.saving) return Promise.resolve(state.settings);
    state.saving = true;
    state.settings.updatedAt = new Date().toISOString();

    var ref = getUserDocRef(userId || state.userId);
    saveLocal(state.settings);

    if (!ref) {
      state.saving = false;
      return Promise.resolve(state.settings);
    }

    return ref.set({ settings: state.settings }, { merge: true }).then(function () {
      state.saving = false;
      state.dirty = false;
      return state.settings;
    }).catch(function (err) {
      console.error('[UserSettings] Save failed:', err);
      state.saving = false;
      throw err;
    });
  }

  function startListener(userId) {
    stopListener();
    var ref = getUserDocRef(userId);
    if (!ref) return;

    state.unsub = ref.onSnapshot(function (doc) {
      if (doc.exists && doc.data().settings) {
        state.settings = Object.assign(defaultSettings(), doc.data().settings);
        saveLocal(state.settings);
      }
    }, function (err) {
      console.error('[UserSettings] Listener error:', err);
    });
  }

  function stopListener() {
    if (state.unsub) {
      state.unsub();
      state.unsub = null;
    }
  }

  function handlePhotoUpload(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('Please select an image file'));
      }
      if (file.size > 2 * 1024 * 1024) {
        return reject(new Error('Image must be under 2MB'));
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
          var sx = 0, sy = 0, sSize = Math.min(img.width, img.height);
          if (img.width > img.height) sx = (img.width - sSize) / 2;
          else sy = (img.height - sSize) / 2;
          ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          state.settings.photoURL = dataUrl;
          state.dirty = true;
          resolve(dataUrl);
        };
        img.onerror = function () { reject(new Error('Failed to load image')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    });
  }

  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.cf-settings-page { max-width: 640px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cf-settings-page h2 { font-size: 22px; font-weight: 700; margin: 0 0 24px; color: #1a1a2e; }',
      '.cf-settings-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; }',
      '.cf-settings-section h3 { font-size: 15px; font-weight: 600; margin: 0 0 16px; color: #334155; }',
      '.cf-settings-row { margin-bottom: 16px; }',
      '.cf-settings-row:last-child { margin-bottom: 0; }',
      '.cf-settings-label { display: block; font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 6px; }',
      '.cf-settings-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; transition: border-color 0.15s; outline: none; }',
      '.cf-settings-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }',
      '.cf-settings-select { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: #fff; outline: none; }',
      '.cf-settings-photo-wrap { display: flex; align-items: center; gap: 16px; }',
      '.cf-settings-avatar { width: 64px; height: 64px; border-radius: 50%; background: #e2e8f0; object-fit: cover; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #94a3b8; overflow: hidden; }',
      '.cf-settings-avatar img { width: 100%; height: 100%; object-fit: cover; }',
      '.cf-settings-upload-btn { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; font-size: 13px; cursor: pointer; color: #334155; transition: background 0.15s; }',
      '.cf-settings-upload-btn:hover { background: #f8fafc; }',
      '.cf-settings-notif-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }',
      '.cf-settings-notif-row:last-child { border-bottom: none; }',
      '.cf-settings-notif-label { font-size: 14px; color: #334155; }',
      '.cf-settings-toggle { position: relative; width: 44px; height: 24px; }',
      '.cf-settings-toggle input { opacity: 0; width: 0; height: 0; }',
      '.cf-settings-toggle .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; border-radius: 24px; transition: 0.2s; }',
      '.cf-settings-toggle .slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }',
      '.cf-settings-toggle input:checked + .slider { background: #6366f1; }',
      '.cf-settings-toggle input:checked + .slider:before { transform: translateX(20px); }',
      '.cf-settings-actions { display: flex; gap: 12px; margin-top: 8px; }',
      '.cf-settings-save { padding: 12px 28px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }',
      '.cf-settings-save:hover { background: #4f46e5; }',
      '.cf-settings-save:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.cf-settings-status { font-size: 13px; color: #22c55e; margin-top: 8px; min-height: 20px; }',
      '.cf-settings-error { color: #ef4444; }',
      '@media (max-width: 640px) { .cf-settings-page { padding: 16px 12px; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function render(container) {
    injectCSS();
    if (!state.settings) state.settings = defaultSettings();
    var s = state.settings;

    var html = '<div class="cf-settings-page">' +
      '<h2>Profile Settings</h2>' +

      '<div class="cf-settings-section">' +
        '<h3>Profile Photo</h3>' +
        '<div class="cf-settings-photo-wrap">' +
          '<div class="cf-settings-avatar" id="cf-settings-avatar">' +
            (s.photoURL ? '<img src="' + s.photoURL.replace(/"/g, '&quot;') + '" alt="Avatar">' : '&#128100;') +
          '</div>' +
          '<button class="cf-settings-upload-btn" id="cf-settings-upload-btn">Upload Photo</button>' +
          '<input type="file" id="cf-settings-file-input" accept="image/*" style="display:none">' +
        '</div>' +
      '</div>' +

      '<div class="cf-settings-section">' +
        '<h3>Basic Info</h3>' +
        '<div class="cf-settings-row">' +
          '<label class="cf-settings-label">Display Name</label>' +
          '<input class="cf-settings-input" id="cf-settings-name" type="text" value="' + (s.displayName || '').replace(/"/g, '&quot;') + '" placeholder="Your name">' +
        '</div>' +
        '<div class="cf-settings-row">' +
          '<label class="cf-settings-label">Email</label>' +
          '<input class="cf-settings-input" id="cf-settings-email" type="email" value="' + (s.email || '').replace(/"/g, '&quot;') + '" placeholder="your@email.com">' +
        '</div>' +
        '<div class="cf-settings-row">' +
          '<label class="cf-settings-label">Timezone</label>' +
          '<select class="cf-settings-select" id="cf-settings-timezone">' +
            TIMEZONES.map(function (tz) {
              var sel = tz === s.timezone ? ' selected' : '';
              return '<option value="' + tz + '"' + sel + '>' + tz.replace(/_/g, ' ') + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div class="cf-settings-section">' +
        '<h3>Notifications</h3>' +
        NOTIFICATION_PREFS.map(function (p) {
          var checked = s.notifications && s.notifications[p.key] ? ' checked' : '';
          return '<div class="cf-settings-notif-row">' +
            '<span class="cf-settings-notif-label">' + p.label + '</span>' +
            '<label class="cf-settings-toggle">' +
              '<input type="checkbox" data-notif="' + p.key + '"' + checked + '>' +
              '<span class="slider"></span>' +
            '</label>' +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="cf-settings-actions">' +
        '<button class="cf-settings-save" id="cf-settings-save">Save Changes</button>' +
      '</div>' +
      '<div class="cf-settings-status" id="cf-settings-status"></div>' +
    '</div>';

    container.innerHTML = html;
    bindEvents(container);
  }

  function bindEvents(container) {
    var uploadBtn = container.querySelector('#cf-settings-upload-btn');
    var fileInput = container.querySelector('#cf-settings-file-input');
    var saveBtn = container.querySelector('#cf-settings-save');
    var statusEl = container.querySelector('#cf-settings-status');

    uploadBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
      if (!fileInput.files || !fileInput.files[0]) return;
      handlePhotoUpload(fileInput.files[0]).then(function (dataUrl) {
        var avatarEl = container.querySelector('#cf-settings-avatar');
        avatarEl.innerHTML = '<img src="' + dataUrl.replace(/"/g, '&quot;') + '" alt="Avatar">';
        statusEl.textContent = 'Photo updated. Save to apply.';
        statusEl.className = 'cf-settings-status';
      }).catch(function (err) {
        statusEl.textContent = err.message;
        statusEl.className = 'cf-settings-status cf-settings-error';
      });
    });

    container.querySelectorAll('[data-notif]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.settings.notifications[cb.dataset.notif] = cb.checked;
        state.dirty = true;
      });
    });

    var nameInput = container.querySelector('#cf-settings-name');
    var emailInput = container.querySelector('#cf-settings-email');
    var tzSelect = container.querySelector('#cf-settings-timezone');

    [nameInput, emailInput, tzSelect].forEach(function (el) {
      el.addEventListener('change', function () { state.dirty = true; });
    });

    saveBtn.addEventListener('click', function () {
      state.settings.displayName = nameInput.value.trim();
      state.settings.email = emailInput.value.trim();
      state.settings.timezone = tzSelect.value;

      saveBtn.disabled = true;
      statusEl.textContent = 'Saving...';
      statusEl.className = 'cf-settings-status';

      saveSettings().then(function () {
        statusEl.textContent = 'Settings saved successfully!';
        statusEl.className = 'cf-settings-status';
        saveBtn.disabled = false;

        var user = typeof firebase !== 'undefined' && firebase.auth().currentUser;
        if (user) {
          user.updateProfile({
            displayName: state.settings.displayName,
            photoURL: state.settings.photoURL || null
          }).catch(function () { /* non-critical */ });
        }
      }).catch(function (err) {
        statusEl.textContent = 'Failed to save: ' + err.message;
        statusEl.className = 'cf-settings-status cf-settings-error';
        saveBtn.disabled = false;
      });
    });
  }

  function getSettings() {
    return state.settings || loadLocal() || defaultSettings();
  }

  window.CortexFreelancer.UserSettings = {
    fetch: fetchSettings,
    save: saveSettings,
    get: getSettings,
    render: render,
    startListener: startListener,
    stopListener: stopListener,
    handlePhotoUpload: handlePhotoUpload,
    TIMEZONES: TIMEZONES
  };
})();
