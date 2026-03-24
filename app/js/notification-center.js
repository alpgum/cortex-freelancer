/**
 * Cortex Freelancer — Notification Center
 * [CF-218] In-app notification bell with dropdown: job matches, payments,
 * subscription updates, tips. Badge count for unread.
 *
 * @namespace window.CortexFreelancer.NotificationCenter
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_notifications';
  var MAX_NOTIFICATIONS = 100;
  var DROPDOWN_MAX_DISPLAY = 20;

  var TYPES = {
    JOB_MATCH: 'job_match',
    PAYMENT: 'payment',
    SUBSCRIPTION: 'subscription',
    TIP: 'tip',
    SYSTEM: 'system'
  };

  var TYPE_ICONS = {
    job_match: '💼',
    payment: '💰',
    subscription: '🔄',
    tip: '💡',
    system: 'ℹ️'
  };

  // ─── State ──────────────────────────────────────────────────────

  var notifications = [];
  var isOpen = false;
  var bellEl = null;
  var dropdownEl = null;
  var badgeEl = null;
  var overlayEl = null;

  // ─── Storage ────────────────────────────────────────────────────

  function loadNotifications() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      notifications = raw ? JSON.parse(raw) : [];
    } catch (e) {
      notifications = [];
    }
  }

  function saveNotifications() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
      // storage full
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  // ─── Unread Count ───────────────────────────────────────────────

  function getUnreadCount() {
    var count = 0;
    for (var i = 0; i < notifications.length; i++) {
      if (!notifications[i].read) count++;
    }
    return count;
  }

  function updateBadge() {
    if (!badgeEl) return;
    var count = getUnreadCount();
    badgeEl.textContent = count > 99 ? '99+' : count;
    badgeEl.style.display = count > 0 ? 'flex' : 'none';
  }

  // ─── Render ─────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cf-notif-styles')) return;
    var style = document.createElement('style');
    style.id = 'cf-notif-styles';
    style.textContent =
      '.cf-notif-bell{position:relative;cursor:pointer;padding:8px;border:none;background:none;font-size:20px;}' +
      '.cf-notif-badge{position:absolute;top:2px;right:2px;background:#e53e3e;color:#fff;border-radius:50%;' +
      'min-width:18px;height:18px;font-size:11px;font-weight:700;display:flex;align-items:center;' +
      'justify-content:center;padding:0 4px;}' +
      '.cf-notif-dropdown{position:absolute;top:100%;right:0;width:360px;max-height:480px;overflow-y:auto;' +
      'background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);z-index:9999;display:none;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;}' +
      '.cf-notif-dropdown.open{display:block;}' +
      '.cf-notif-header{padding:14px 16px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;}' +
      '.cf-notif-header h3{margin:0;font-size:15px;font-weight:600;color:#1a202c;}' +
      '.cf-notif-mark-read{border:none;background:none;color:#3182ce;cursor:pointer;font-size:13px;padding:0;}' +
      '.cf-notif-item{padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;gap:10px;cursor:pointer;transition:background 0.15s;}' +
      '.cf-notif-item:hover{background:#f7fafc;}' +
      '.cf-notif-item.unread{background:#ebf8ff;}' +
      '.cf-notif-icon{font-size:18px;flex-shrink:0;padding-top:2px;}' +
      '.cf-notif-body{flex:1;min-width:0;}' +
      '.cf-notif-title{font-size:13px;font-weight:600;color:#2d3748;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.cf-notif-msg{font-size:12px;color:#718096;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.cf-notif-time{font-size:11px;color:#a0aec0;margin-top:3px;}' +
      '.cf-notif-empty{padding:40px 16px;text-align:center;color:#a0aec0;font-size:14px;}' +
      '.cf-notif-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;display:none;}' +
      '.cf-notif-overlay.open{display:block;}';
    document.head.appendChild(style);
  }

  function renderDropdownContent() {
    if (!dropdownEl) return;

    var display = notifications.slice(0, DROPDOWN_MAX_DISPLAY);
    var html = '<div class="cf-notif-header">' +
      '<h3>Notifications</h3>' +
      '<button class="cf-notif-mark-read" id="cf-notif-mark-all">Mark all read</button>' +
      '</div>';

    if (display.length === 0) {
      html += '<div class="cf-notif-empty">No notifications yet</div>';
    } else {
      for (var i = 0; i < display.length; i++) {
        var n = display[i];
        var icon = TYPE_ICONS[n.type] || 'ℹ️';
        var unreadClass = n.read ? '' : ' unread';
        html += '<div class="cf-notif-item' + unreadClass + '" data-id="' + n.id + '">' +
          '<div class="cf-notif-icon">' + icon + '</div>' +
          '<div class="cf-notif-body">' +
          '<div class="cf-notif-title">' + escapeHtml(n.title) + '</div>' +
          '<div class="cf-notif-msg">' + escapeHtml(n.message) + '</div>' +
          '<div class="cf-notif-time">' + timeAgo(n.timestamp) + '</div>' +
          '</div></div>';
      }
    }

    dropdownEl.innerHTML = html;

    var markAllBtn = document.getElementById('cf-notif-mark-all');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.CortexFreelancer.NotificationCenter.markAllRead();
      });
    }

    var items = dropdownEl.querySelectorAll('.cf-notif-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        window.CortexFreelancer.NotificationCenter.markRead(id);
      });
    }
  }

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      renderDropdownContent();
      dropdownEl.classList.add('open');
      overlayEl.classList.add('open');
    } else {
      dropdownEl.classList.remove('open');
      overlayEl.classList.remove('open');
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    dropdownEl.classList.remove('open');
    overlayEl.classList.remove('open');
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexFreelancer.NotificationCenter = {
    TYPES: TYPES,

    /**
     * Initialize the notification center bell icon.
     * @param {string|HTMLElement} container — selector or element to mount bell in
     */
    init: function (container) {
      var target = typeof container === 'string' ? document.querySelector(container) : container;
      if (!target) {
        console.warn('[NotificationCenter] Container not found:', container);
        return;
      }

      injectStyles();
      loadNotifications();

      // Bell button
      bellEl = document.createElement('button');
      bellEl.className = 'cf-notif-bell';
      bellEl.setAttribute('aria-label', 'Notifications');
      bellEl.innerHTML = '🔔';
      bellEl.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle();
      });

      // Badge
      badgeEl = document.createElement('span');
      badgeEl.className = 'cf-notif-badge';
      bellEl.appendChild(badgeEl);

      // Dropdown
      dropdownEl = document.createElement('div');
      dropdownEl.className = 'cf-notif-dropdown';

      // Overlay to close on outside click
      overlayEl = document.createElement('div');
      overlayEl.className = 'cf-notif-overlay';
      overlayEl.addEventListener('click', close);

      var wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.appendChild(bellEl);
      wrapper.appendChild(dropdownEl);
      target.appendChild(wrapper);
      document.body.appendChild(overlayEl);

      updateBadge();
    },

    /**
     * Add a notification.
     * @param {{ type: string, title: string, message: string, link?: string }} opts
     */
    add: function (opts) {
      var notification = {
        id: generateId(),
        type: opts.type || TYPES.SYSTEM,
        title: opts.title || 'Notification',
        message: opts.message || '',
        link: opts.link || null,
        timestamp: Date.now(),
        read: false
      };

      notifications.unshift(notification);
      if (notifications.length > MAX_NOTIFICATIONS) {
        notifications = notifications.slice(0, MAX_NOTIFICATIONS);
      }
      saveNotifications();
      updateBadge();

      if (isOpen) renderDropdownContent();
      return notification;
    },

    /** Mark a single notification as read. */
    markRead: function (id) {
      for (var i = 0; i < notifications.length; i++) {
        if (notifications[i].id === id) {
          notifications[i].read = true;
          break;
        }
      }
      saveNotifications();
      updateBadge();
      if (isOpen) renderDropdownContent();
    },

    /** Mark all notifications as read. */
    markAllRead: function () {
      for (var i = 0; i < notifications.length; i++) {
        notifications[i].read = true;
      }
      saveNotifications();
      updateBadge();
      if (isOpen) renderDropdownContent();
    },

    /** Get unread count. */
    getUnreadCount: getUnreadCount,

    /** Clear all notifications. */
    clear: function () {
      notifications = [];
      saveNotifications();
      updateBadge();
      if (isOpen) renderDropdownContent();
    },

    /** Get all notifications. */
    getAll: function () {
      return notifications.slice();
    }
  };
})();
