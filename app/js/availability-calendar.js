/**
 * Cortex Freelancer — Availability Calendar with Auto-Status Updates
 * [CF-076] Sync availability with Upwork status and show to potential clients.
 *
 * Features:
 *   - Monthly calendar with per-day availability status
 *   - Recurring schedule support (weekday/weekend patterns)
 *   - Time-block management within each day
 *   - Auto-sync status to Upwork-compatible payload
 *   - Client-facing availability widget
 *   - Vacation / bulk-set / working-hours templates
 *   - Quick-set toolbar for rapid status updates
 *   - Status badge for embedding in other modules
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_availability_calendar';
  var STATUS_KEY = 'cf_availability_status';
  var SETTINGS_KEY = 'cf_availability_settings';

  var STATUS = {
    AVAILABLE: 'available',
    PARTIALLY: 'partially_available',
    BUSY: 'busy',
    AWAY: 'away',
    DO_NOT_DISTURB: 'do_not_disturb'
  };

  var STATUS_LABELS = {
    available:           { label: 'Available',           color: '#00ff88', icon: '🟢', upwork: 'Available' },
    partially_available: { label: 'Partially Available', color: '#ffaa00', icon: '🟡', upwork: 'Available — Limited' },
    busy:                { label: 'Busy',                color: '#ff4444', icon: '🔴', upwork: 'Not Available' },
    away:                { label: 'Away',                color: '#888888', icon: '⚪', upwork: 'Not Available' },
    do_not_disturb:      { label: 'Do Not Disturb',      color: '#ff0066', icon: '⛔', upwork: 'Not Available' }
  };

  var DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var _initialized = false;
  var _currentView = { year: null, month: null, containerId: null };
  var _autoSyncTimer = null;

  // ─── Utility ──────────────────────────────────────────────────────

  function dateKey(date) {
    var d = new Date(date);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function todayKey() { return dateKey(new Date()); }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }

  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* full */ }
  }

  // ─── Data Layer ───────────────────────────────────────────────────

  function loadCalendar()          { return loadJSON(STORAGE_KEY, {}); }
  function saveCalendar(data)      { saveJSON(STORAGE_KEY, data); }
  function loadGlobalStatus()      { return loadJSON(STATUS_KEY, {}); }
  function saveGlobalStatus(s)     { saveJSON(STATUS_KEY, s); }
  function loadSettings()          { return loadJSON(SETTINGS_KEY, { autoSync: true, defaultHours: 8, weekendOff: true }); }
  function saveSettings(s)         { saveJSON(SETTINGS_KEY, s); }

  // ─── Entry Management ────────────────────────────────────────────

  function setDayAvailability(date, opts) {
    var cal = loadCalendar();
    var key = dateKey(date);
    var existing = cal[key] || {};

    cal[key] = {
      date: key,
      status: opts.status || existing.status || STATUS.AVAILABLE,
      hoursAvailable: typeof opts.hoursAvailable === 'number' ? opts.hoursAvailable : (existing.hoursAvailable != null ? existing.hoursAvailable : 8),
      note: opts.note !== undefined ? opts.note : (existing.note || ''),
      blocks: opts.blocks || existing.blocks || [],
      recurring: opts.recurring !== undefined ? opts.recurring : (existing.recurring || false),
      recurringDay: opts.recurringDay !== undefined ? opts.recurringDay : (existing.recurringDay != null ? existing.recurringDay : null),
      updatedAt: new Date().toISOString()
    };

    saveCalendar(cal);
    _autoUpdateStatus();
    return cal[key];
  }

  function getDayAvailability(date) {
    var cal = loadCalendar();
    var key = dateKey(date);
    var entry = cal[key];

    // Fall back to recurring entry for matching day-of-week
    if (!entry) {
      var dayOfWeek = new Date(date).getDay();
      var entries = Object.values(cal);
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].recurring && entries[i].recurringDay === dayOfWeek) {
          return Object.assign({}, entries[i], { date: key });
        }
      }
      // Apply default settings
      var settings = loadSettings();
      var isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      return {
        date: key,
        status: isWeekend && settings.weekendOff ? STATUS.AWAY : STATUS.AVAILABLE,
        hoursAvailable: isWeekend && settings.weekendOff ? 0 : settings.defaultHours,
        note: '', blocks: []
      };
    }
    return entry;
  }

  function removeDayAvailability(date) {
    var cal = loadCalendar();
    delete cal[dateKey(date)];
    saveCalendar(cal);
    _autoUpdateStatus();
  }

  function getWeekAvailability(startDate) {
    var result = [];
    var d = new Date(startDate);
    var day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // snap to Monday
    for (var i = 0; i < 7; i++) {
      result.push(getDayAvailability(d));
      d.setDate(d.getDate() + 1);
    }
    return result;
  }

  function getMonthAvailability(year, month) {
    var result = [];
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var i = 1; i <= daysInMonth; i++) {
      result.push(getDayAvailability(new Date(year, month, i)));
    }
    return result;
  }

  // ─── Auto-Status Sync ────────────────────────────────────────────

  function _autoUpdateStatus() {
    var today = getDayAvailability(new Date());
    var meta = STATUS_LABELS[today.status] || STATUS_LABELS.available;
    var globalStatus = {
      current: today.status,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      upworkStatus: meta.upwork,
      hoursToday: today.hoursAvailable,
      lastUpdated: new Date().toISOString(),
      nextAvailable: _findNextAvailable()
    };
    saveGlobalStatus(globalStatus);

    // Dispatch event for other modules
    try {
      window.dispatchEvent(new CustomEvent('cf:availability:changed', { detail: globalStatus }));
    } catch (e) { /* old browser */ }

    return globalStatus;
  }

  function _findNextAvailable() {
    var d = new Date();
    for (var i = 0; i < 60; i++) {
      var entry = getDayAvailability(d);
      if (entry.status === STATUS.AVAILABLE || entry.status === STATUS.PARTIALLY) {
        return dateKey(d);
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  function getCurrentStatus() {
    var status = loadGlobalStatus();
    if (!status.current) return _autoUpdateStatus();
    return status;
  }

  function setManualStatus(statusValue) {
    if (!STATUS_LABELS[statusValue]) return null;
    var meta = STATUS_LABELS[statusValue];
    var globalStatus = loadGlobalStatus();
    globalStatus.current = statusValue;
    globalStatus.label = meta.label;
    globalStatus.icon = meta.icon;
    globalStatus.color = meta.color;
    globalStatus.upworkStatus = meta.upwork;
    globalStatus.lastUpdated = new Date().toISOString();
    globalStatus.manual = true;
    saveGlobalStatus(globalStatus);
    return globalStatus;
  }

  // ─── Upwork Sync Payload ─────────────────────────────────────────

  function getUpworkAvailabilityPayload() {
    var status = getCurrentStatus();
    var week = getWeekAvailability(new Date());
    var totalHours = week.reduce(function (s, d) { return s + d.hoursAvailable; }, 0);

    return {
      availability: {
        status: status.upworkStatus,
        hoursPerWeek: Math.min(totalHours, 40),
        contractToHire: status.current === STATUS.AVAILABLE,
        profileAccess: status.current !== STATUS.DO_NOT_DISTURB ? 'public' : 'private',
        responseTime: status.current === STATUS.AVAILABLE ? 'within_hours'
          : status.current === STATUS.PARTIALLY ? 'within_day' : 'more_than_day'
      },
      weeklySchedule: week.map(function (d) {
        return { date: d.date, hours: d.hoursAvailable, status: d.status };
      }),
      syncedAt: new Date().toISOString()
    };
  }

  /**
   * Simulate pushing status to Upwork. In production this would call the
   * Upwork API via ApiRateLimiter; here it logs the payload for testing.
   */
  function syncToUpwork() {
    var payload = getUpworkAvailabilityPayload();
    var RateLimiter = window.CortexFreelancer.ApiRateLimiter;
    if (RateLimiter) {
      return RateLimiter.execute(function () {
        // Simulated API call
        return Promise.resolve({ status: 200, data: payload });
      }, { endpoint: '/freelancers/me/availability', priority: 5 });
    }
    return Promise.resolve(payload);
  }

  // ─── Bulk Operations ─────────────────────────────────────────────

  function setWorkingHours(config) {
    var cfg = Object.assign({ weekdayHours: 8, weekendHours: 0, weekdayStatus: STATUS.AVAILABLE, weekendStatus: STATUS.AWAY, weeksAhead: 4 }, config);
    var d = new Date();
    var end = new Date();
    end.setDate(end.getDate() + cfg.weeksAhead * 7);
    while (d <= end) {
      var isWeekend = d.getDay() === 0 || d.getDay() === 6;
      setDayAvailability(d, {
        status: isWeekend ? cfg.weekendStatus : cfg.weekdayStatus,
        hoursAvailable: isWeekend ? cfg.weekendHours : cfg.weekdayHours
      });
      d.setDate(d.getDate() + 1);
    }
  }

  function setVacation(startDate, endDate, note) {
    var d = new Date(startDate);
    var end = new Date(endDate);
    while (d <= end) {
      setDayAvailability(d, { status: STATUS.AWAY, hoursAvailable: 0, note: note || 'Vacation' });
      d.setDate(d.getDate() + 1);
    }
  }

  function setRecurringDay(dayOfWeek, opts) {
    var d = new Date();
    while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
    return setDayAvailability(d, Object.assign({}, opts, { recurring: true, recurringDay: dayOfWeek }));
  }

  // ─── Stats ────────────────────────────────────────────────────────

  function getAvailabilityStats(days) {
    days = days || 30;
    var d = new Date();
    var stats = { available: 0, partial: 0, busy: 0, away: 0, dnd: 0, totalHours: 0, days: days };
    for (var i = 0; i < days; i++) {
      var entry = getDayAvailability(d);
      switch (entry.status) {
        case STATUS.AVAILABLE: stats.available++; break;
        case STATUS.PARTIALLY: stats.partial++; break;
        case STATUS.BUSY:      stats.busy++; break;
        case STATUS.DO_NOT_DISTURB: stats.dnd++; break;
        default: stats.away++;
      }
      stats.totalHours += entry.hoursAvailable;
      d.setDate(d.getDate() + 1);
    }
    stats.avgHoursPerDay = Math.round(stats.totalHours / days * 10) / 10;
    stats.avgHoursPerWeek = Math.round(stats.totalHours / days * 7 * 10) / 10;
    stats.utilizationPct = Math.round((stats.available + stats.partial * 0.5) / days * 100);
    return stats;
  }

  // ─── Client-Facing View ──────────────────────────────────────────

  function getClientView() {
    var status = getCurrentStatus();
    var stats = getAvailabilityStats(14);
    var week = getWeekAvailability(new Date());
    var meta = STATUS_LABELS[status.current] || STATUS_LABELS.available;

    return {
      statusIcon: meta.icon,
      statusLabel: meta.label,
      statusColor: meta.color,
      hoursThisWeek: week.reduce(function (s, d) { return s + d.hoursAvailable; }, 0),
      nextAvailable: status.nextAvailable,
      responseTime: status.current === STATUS.AVAILABLE ? 'Within hours'
        : status.current === STATUS.PARTIALLY ? 'Within 24 hours' : '2-3 days',
      weekSnapshot: week.map(function (d) {
        var m = STATUS_LABELS[d.status] || STATUS_LABELS.available;
        return { date: d.date, icon: m.icon, hours: d.hoursAvailable, label: m.label };
      }),
      utilization: stats.utilizationPct
    };
  }

  // ─── UI Renderer ─────────────────────────────────────────────────

  function render(containerId) {
    var now = new Date();
    _currentView.containerId = containerId;
    if (_currentView.year == null) _currentView.year = now.getFullYear();
    if (_currentView.month == null) _currentView.month = now.getMonth();
    _renderFull(containerId, _currentView.year, _currentView.month);
  }

  function _renderFull(containerId, year, month) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var now = new Date();
    var status = getCurrentStatus();
    var meta = STATUS_LABELS[status.current] || STATUS_LABELS.available;
    var stats = getAvailabilityStats(30);
    var entries = getMonthAvailability(year, month);
    var firstDay = new Date(year, month, 1).getDay();

    var html = '<div class="cf-availability-calendar">';

    // ── Status Banner
    html += '<div class="cf-avail-banner" style="border-left:4px solid ' + meta.color + ';padding:12px;margin-bottom:16px;background:rgba(255,255,255,0.03);border-radius:6px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
    html += '<div><span style="font-size:1.4em">' + meta.icon + '</span> <strong>' + meta.label + '</strong>';
    html += ' · ' + status.hoursToday + 'h today';
    if (status.nextAvailable && status.current !== STATUS.AVAILABLE) {
      html += ' · Next available: ' + status.nextAvailable;
    }
    html += '</div>';
    html += '<div style="font-size:0.85em;color:#888">Upwork: ' + meta.upwork + '</div>';
    html += '</div></div>';

    // ── Quick Status Toolbar
    html += '<div class="cf-avail-toolbar" style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">';
    Object.keys(STATUS_LABELS).forEach(function (key) {
      var m = STATUS_LABELS[key];
      var active = status.current === key ? 'font-weight:bold;outline:2px solid ' + m.color : 'opacity:0.6';
      html += '<button class="cf-status-quick" data-status="' + key + '" style="padding:6px 12px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#eee;cursor:pointer;font-size:0.85em;' + active + '">';
      html += m.icon + ' ' + m.label + '</button>';
    });
    html += '</div>';

    // ── Calendar Grid
    html += '<div class="cf-cal-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<button class="cf-cal-nav" data-dir="-1" style="background:none;border:1px solid #333;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer">◀</button>';
    html += '<span style="font-size:1.1em;font-weight:600">' + MONTHS[month] + ' ' + year + '</span>';
    html += '<button class="cf-cal-nav" data-dir="1" style="background:none;border:1px solid #333;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer">▶</button>';
    html += '</div>';

    html += '<div class="cf-cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
    DAYS_SHORT.forEach(function (d) {
      html += '<div style="text-align:center;font-size:0.75em;color:#888;padding:4px 0">' + d + '</div>';
    });
    for (var e = 0; e < firstDay; e++) {
      html += '<div style="min-height:60px"></div>';
    }
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var em = STATUS_LABELS[entry.status] || STATUS_LABELS.available;
      var isToday = (year === now.getFullYear() && month === now.getMonth() && i + 1 === now.getDate());
      html += '<div class="cf-cal-cell" data-date="' + entry.date + '" style="min-height:60px;padding:4px 6px;border-radius:4px;border-left:3px solid ' + em.color + ';background:' + (isToday ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)') + ';cursor:pointer;font-size:0.85em">';
      html += '<div style="display:flex;justify-content:space-between"><span style="font-weight:' + (isToday ? '700' : '400') + '">' + (i + 1) + '</span><span>' + em.icon + '</span></div>';
      if (entry.hoursAvailable > 0) html += '<div style="color:#aaa;font-size:0.8em">' + entry.hoursAvailable + 'h</div>';
      if (entry.note) html += '<div style="color:#666;font-size:0.7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + entry.note + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // ── Legend
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:0.8em;color:#999">';
    Object.keys(STATUS_LABELS).forEach(function (key) {
      var m = STATUS_LABELS[key];
      html += '<span>' + m.icon + ' ' + m.label + '</span>';
    });
    html += '</div>';

    // ── Stats Bar
    html += '<div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:0.85em;display:flex;gap:16px;flex-wrap:wrap;color:#bbb">';
    html += '<span>📊 Next 30 days:</span>';
    html += '<span>Utilization <strong>' + stats.utilizationPct + '%</strong></span>';
    html += '<span>Avg <strong>' + stats.avgHoursPerWeek + 'h/wk</strong></span>';
    html += '<span>🟢' + stats.available + ' 🟡' + stats.partial + ' 🔴' + stats.busy + ' ⚪' + stats.away + '</span>';
    html += '</div>';

    // ── Quick Actions
    html += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button id="cf-avail-set-wh" style="padding:6px 12px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.8em">⏰ Set Working Hours</button>';
    html += '<button id="cf-avail-set-vac" style="padding:6px 12px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.8em">🏖 Set Vacation</button>';
    html += '<button id="cf-avail-sync" style="padding:6px 12px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.8em">🔄 Sync to Upwork</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // ── Bind Events
    container.querySelectorAll('.cf-cal-nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = parseInt(btn.getAttribute('data-dir'));
        _currentView.month += dir;
        if (_currentView.month < 0) { _currentView.month = 11; _currentView.year--; }
        if (_currentView.month > 11) { _currentView.month = 0; _currentView.year++; }
        _renderFull(containerId, _currentView.year, _currentView.month);
      });
    });

    container.querySelectorAll('.cf-status-quick').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var st = btn.getAttribute('data-status');
        setDayAvailability(new Date(), { status: st });
        _renderFull(containerId, _currentView.year, _currentView.month);
      });
    });

    container.querySelectorAll('.cf-cal-cell[data-date]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var dt = cell.getAttribute('data-date');
        if (typeof mod.onDayClick === 'function') {
          mod.onDayClick(dt, getDayAvailability(dt));
        } else {
          // Cycle status on click
          var entry = getDayAvailability(dt);
          var keys = Object.keys(STATUS);
          var idx = keys.findIndex(function (k) { return STATUS[k] === entry.status; });
          var nextStatus = STATUS[keys[(idx + 1) % keys.length]];
          setDayAvailability(dt, { status: nextStatus });
          _renderFull(containerId, _currentView.year, _currentView.month);
        }
      });
    });

    var whBtn = document.getElementById('cf-avail-set-wh');
    if (whBtn) whBtn.addEventListener('click', function () {
      setWorkingHours({ weekdayHours: 8, weekendHours: 0, weeksAhead: 4 });
      _renderFull(containerId, _currentView.year, _currentView.month);
    });

    var vacBtn = document.getElementById('cf-avail-set-vac');
    if (vacBtn) vacBtn.addEventListener('click', function () {
      var start = prompt('Vacation start (YYYY-MM-DD):');
      var end = prompt('Vacation end (YYYY-MM-DD):');
      if (start && end) {
        setVacation(start, end, 'Vacation');
        _renderFull(containerId, _currentView.year, _currentView.month);
      }
    });

    var syncBtn = document.getElementById('cf-avail-sync');
    if (syncBtn) syncBtn.addEventListener('click', function () {
      syncBtn.textContent = '⏳ Syncing…';
      syncToUpwork().then(function () {
        syncBtn.textContent = '✅ Synced!';
        setTimeout(function () { syncBtn.textContent = '🔄 Sync to Upwork'; }, 2000);
      });
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Ensure today's status is calculated
    _autoUpdateStatus();

    // Auto-sync at midnight
    var now = new Date();
    var msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    _autoSyncTimer = setTimeout(function midnightSync() {
      _autoUpdateStatus();
      _autoSyncTimer = setTimeout(midnightSync, 86400000);
    }, msUntilMidnight);
  }

  // ─── Export ───────────────────────────────────────────────────────

  var mod = {
    STATUS: STATUS,
    STATUS_LABELS: STATUS_LABELS,

    // Lifecycle
    init: init,
    render: render,

    // Data
    setDayAvailability: setDayAvailability,
    getDayAvailability: getDayAvailability,
    removeDayAvailability: removeDayAvailability,
    getWeekAvailability: getWeekAvailability,
    getMonthAvailability: getMonthAvailability,

    // Status
    getCurrentStatus: getCurrentStatus,
    setManualStatus: setManualStatus,

    // Upwork
    getUpworkAvailabilityPayload: getUpworkAvailabilityPayload,
    syncToUpwork: syncToUpwork,

    // Bulk
    setWorkingHours: setWorkingHours,
    setVacation: setVacation,
    setRecurringDay: setRecurringDay,

    // Analytics
    getAvailabilityStats: getAvailabilityStats,
    getClientView: getClientView,

    // Settings
    loadSettings: loadSettings,
    saveSettings: saveSettings,

    // Callback hook
    onDayClick: null
  };

  window.CortexFreelancer.AvailabilityCalendar = mod;

})();
