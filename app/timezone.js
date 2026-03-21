/* ===== Timezone Detection — Cortex Freelancer ===== */
/* Detects user timezone, shows contextual greeting, formats local dates.
   Usage: <script src="/app/timezone.js"></script>
   API: window.cortexTimezone.greeting() => "Good morning, ..."
        window.cortexTimezone.formatDate(date) => local formatted date */

(function () {
  'use strict';

  var tz;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    tz = 'UTC';
  }

  /* ── Get local hour ── */
  function localHour() {
    return new Date().getHours();
  }

  /* ── Time-based greeting ── */
  function greeting(name) {
    var h = localHour();
    var g;
    if (h >= 5 && h < 12) g = 'Good morning';
    else if (h >= 12 && h < 17) g = 'Good afternoon';
    else if (h >= 17 && h < 21) g = 'Good evening';
    else g = 'Good night';

    return name ? g + ', ' + name : g;
  }

  /* ── Format date in user's locale ── */
  function formatDate(date, opts) {
    if (!date) date = new Date();
    if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
    var defaults = { dateStyle: 'medium', timeZone: tz };
    var options = opts || defaults;
    try {
      return new Intl.DateTimeFormat(navigator.language || 'en', options).format(date);
    } catch (e) {
      return date.toLocaleDateString();
    }
  }

  /* ── Format time in user's locale ── */
  function formatTime(date, opts) {
    if (!date) date = new Date();
    if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
    var defaults = { timeStyle: 'short', timeZone: tz };
    var options = opts || defaults;
    try {
      return new Intl.DateTimeFormat(navigator.language || 'en', options).format(date);
    } catch (e) {
      return date.toLocaleTimeString();
    }
  }

  /* ── Format relative time ("2 hours ago") ── */
  function timeAgo(date) {
    if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
    var seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + 'd ago';
    return formatDate(date);
  }

  /* ── Auto-apply greeting to elements ── */
  function applyGreeting() {
    var els = document.querySelectorAll('[data-greeting]');
    for (var i = 0; i < els.length; i++) {
      var name = els[i].getAttribute('data-greeting') || '';
      els[i].textContent = greeting(name || undefined);
    }
  }

  /* ── Auto-format dates ── */
  function applyDates() {
    var els = document.querySelectorAll('[data-local-date]');
    for (var i = 0; i < els.length; i++) {
      var raw = els[i].getAttribute('data-local-date');
      if (raw) {
        els[i].textContent = formatDate(raw);
      }
    }
  }

  /* Init */
  function init() {
    applyGreeting();
    applyDates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Public API */
  window.cortexTimezone = {
    tz: tz,
    greeting: greeting,
    formatDate: formatDate,
    formatTime: formatTime,
    timeAgo: timeAgo,
    localHour: localHour
  };
})();
