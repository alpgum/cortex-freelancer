// ===== Notification Center — Cortex Freelancer [526] =====
// Bell icon in nav with unread count. Notifications stored in localStorage.
// Types: trial_expiring, usage_limit, job_match, payment_reminder
// Usage: <script defer src="/app/_includes/notifications.js"></script>

(function () {
  var STORAGE_KEY = 'cortex_notifications';
  var MAX_NOTIFICATIONS = 20;

  // ── Helpers ──

  function getNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveNotifications(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  }

  function unreadCount(list) {
    var c = 0;
    for (var i = 0; i < list.length; i++) { if (!list[i].read) c++; }
    return c;
  }

  function timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  // ── Seed default notifications for new users ──

  function seedDefaults() {
    var list = getNotifications();
    if (list.length > 0) return list;

    var now = Date.now();
    list = [
      { id: 'welcome', type: 'trial', title: 'Welcome to Cortex!', body: 'Your 7-day free trial has started. Explore all pro tools.', ts: now, read: false },
      { id: 'trial-5d', type: 'trial', title: 'Trial: 5 days left', body: 'Upgrade to keep unlimited access to all tools.', ts: now - 172800000, read: false },
      { id: 'job-1', type: 'job', title: 'New job match', body: 'React Developer — $60-80/hr on Upwork matches your profile.', ts: now - 3600000, read: false },
      { id: 'payment-1', type: 'payment', title: 'Invoice reminder', body: 'Invoice #1042 to Acme Corp is due in 3 days.', ts: now - 7200000, read: false }
    ];
    saveNotifications(list);
    return list;
  }

  // ── Icon map ──

  var ICONS = {
    trial: '\u23F3',    // hourglass
    usage: '\u26A0',    // warning
    job: '\uD83D\uDCBC', // briefcase
    payment: '\uD83D\uDCB3' // credit card
  };

  // ── Build UI ──

  function init() {
    // Support shared nav (.site-nav from nav.js), dashboard (.dash-nav), and app pages (nav[role])
    var nav = document.querySelector('.site-nav') || document.querySelector('.dash-nav') || document.querySelector('nav[role="navigation"]');
    if (!nav) return;

    // Inject CSS
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/app/_includes/notifications.css';
    document.head.appendChild(link);

    var list = seedDefaults();
    var count = unreadCount(list);

    // Bell wrapper (positioned relative for dropdown)
    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';

    // Bell button
    var bell = document.createElement('button');
    bell.className = 'notif-bell';
    bell.setAttribute('aria-label', 'Notifications');
    bell.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span class="notif-badge" id="notif-badge">' + (count > 0 ? count : '') + '</span>';
    wrapper.appendChild(bell);

    // Panel
    var panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.id = 'notif-panel';
    panel.innerHTML =
      '<div class="notif-header">' +
        '<h3>Notifications</h3>' +
        '<button class="notif-clear-btn" id="notif-clear">Mark all read</button>' +
      '</div>' +
      '<div class="notif-list" id="notif-list"></div>';
    wrapper.appendChild(panel);

    // Insert before auth area in both nav types
    var authEl = nav.querySelector('.nav-auth') || nav.querySelector('#cortex-auth');
    var linksEl = nav.querySelector('.nav-links');
    if (authEl && linksEl) {
      linksEl.insertBefore(wrapper, authEl);
    } else if (linksEl) {
      linksEl.appendChild(wrapper);
    } else {
      // fallback: append before hamburger or end of nav
      var hamburger = nav.querySelector('.nav-hamburger');
      if (hamburger) {
        nav.insertBefore(wrapper, hamburger);
      } else {
        nav.appendChild(wrapper);
      }
    }

    // Render list
    function renderList() {
      var items = getNotifications();
      var listEl = document.getElementById('notif-list');
      if (!listEl) return;

      if (items.length === 0) {
        listEl.innerHTML = '<div class="notif-empty">No notifications yet</div>';
        return;
      }

      var html = '';
      for (var i = 0; i < items.length; i++) {
        var n = items[i];
        var iconClass = n.type || 'trial';
        html +=
          '<div class="notif-item' + (n.read ? '' : ' unread') + '" data-id="' + n.id + '">' +
            '<div class="notif-icon ' + iconClass + '">' + (ICONS[iconClass] || '\uD83D\uDD14') + '</div>' +
            '<div class="notif-text">' +
              '<p><strong>' + escapeHtml(n.title) + '</strong> ' + escapeHtml(n.body) + '</p>' +
              '<div class="notif-time">' + timeAgo(n.ts) + '</div>' +
            '</div>' +
          '</div>';
      }
      listEl.innerHTML = html;
    }

    function updateBadge() {
      var badge = document.getElementById('notif-badge');
      var c = unreadCount(getNotifications());
      if (badge) {
        badge.textContent = c > 0 ? (c > 9 ? '9+' : c) : '';
        badge.setAttribute('data-count', c);
      }
    }

    // Toggle panel
    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = panel.classList.contains('open');
      if (isOpen) {
        panel.classList.remove('open');
      } else {
        renderList();
        panel.classList.add('open');
      }
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') panel.classList.remove('open');
    });

    // Mark all read
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'notif-clear') {
        var items = getNotifications();
        for (var i = 0; i < items.length; i++) items[i].read = true;
        saveNotifications(items);
        renderList();
        updateBadge();
      }
    });

    // Click individual notification to mark read
    document.addEventListener('click', function (e) {
      var item = e.target.closest && e.target.closest('.notif-item');
      if (item) {
        var id = item.getAttribute('data-id');
        var items = getNotifications();
        for (var i = 0; i < items.length; i++) {
          if (items[i].id === id) { items[i].read = true; break; }
        }
        saveNotifications(items);
        item.classList.remove('unread');
        updateBadge();
      }
    });

    // ── Smart notification generators ──

    // Trial expiring check
    (function checkTrial() {
      var trialStart = localStorage.getItem('cortex_trial_start');
      if (!trialStart) return;
      var daysLeft = 7 - Math.floor((Date.now() - parseInt(trialStart, 10)) / 86400000);
      if (daysLeft <= 2 && daysLeft > 0) {
        addNotification('trial-expire-' + daysLeft, 'trial',
          'Trial expiring soon',
          'Only ' + daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' left. Upgrade now to keep access.');
      } else if (daysLeft <= 0) {
        addNotification('trial-expired', 'trial',
          'Trial expired',
          'Your free trial has ended. Upgrade to continue using pro tools.');
      }
    })();

    // Usage limit check
    (function checkUsage() {
      var usageData = localStorage.getItem('cortex_usage');
      if (!usageData) return;
      try {
        var usage = JSON.parse(usageData);
        var pct = usage.count / (usage.limit || 10);
        if (pct >= 0.8 && pct < 1) {
          addNotification('usage-warn', 'usage',
            'Usage limit approaching',
            'You\'ve used ' + usage.count + '/' + usage.limit + ' free tool runs today.');
        } else if (pct >= 1) {
          addNotification('usage-hit', 'usage',
            'Daily limit reached',
            'Upgrade to Pro for unlimited tool runs.');
        }
      } catch (e) { /* ignore */ }
    })();

    updateBadge();
  }

  // ── Public API ──

  function addNotification(id, type, title, body) {
    var list = getNotifications();
    // Dedupe by id
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return;
    }
    list.unshift({ id: id, type: type, title: title, body: body, ts: Date.now(), read: false });
    saveNotifications(list);
    // Update badge if visible
    var badge = document.getElementById('notif-badge');
    if (badge) {
      var c = unreadCount(list);
      badge.textContent = c > 0 ? (c > 9 ? '9+' : c) : '';
      badge.setAttribute('data-count', c);
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // Expose for other scripts
  window.cortexNotifications = {
    add: addNotification,
    getAll: getNotifications,
    unreadCount: function () { return unreadCount(getNotifications()); }
  };

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
