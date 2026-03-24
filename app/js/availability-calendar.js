/**
 * Cortex Freelancer — Availability Calendar with Auto-Status
 * [CF-076] Sync availability with Upwork status, show to potential clients.
 * Calendar data structure + status management.
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_availability_calendar';
  var STATUS_KEY = 'cf_availability_status';

  var STATUS = {
    AVAILABLE: 'available',
    PARTIALLY: 'partially_available',
    BUSY: 'busy',
    AWAY: 'away',
    DO_NOT_DISTURB: 'do_not_disturb'
  };

  var STATUS_LABELS = {
    available: { label: 'Available', color: '#00ff88', icon: '🟢' },
    partially_available: { label: 'Partially Available', color: '#ffaa00', icon: '🟡' },
    busy: { label: 'Busy', color: '#ff4444', icon: '🔴' },
    away: { label: 'Away', color: '#888888', icon: '⚪' },
    do_not_disturb: { label: 'Do Not Disturb', color: '#ff0066', icon: '⛔' }
  };

  var UPWORK_STATUS_MAP = {
    available: 'Available',
    partially_available: 'Available — Limited',
    busy: 'Not Available',
    away: 'Not Available',
    do_not_disturb: 'Not Available'
  };

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // ─── Data Layer ───────────────────────────────────────────────────

  /**
   * Calendar entry structure:
   * {
   *   date: 'YYYY-MM-DD',
   *   status: STATUS enum value,
   *   hoursAvailable: 0-24,
   *   note: string,
   *   blocks: [{ start: 'HH:MM', end: 'HH:MM', label: string }],
   *   recurring: boolean,
   *   recurringDay: 0-6 (day of week if recurring)
   * }
   */

  function dateKey(date) {
    var d = new Date(date);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function loadCalendar() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveCalendar(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full */ }
  }

  function loadGlobalStatus() {
    try {
      return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveGlobalStatus(status) {
    try {
      localStorage.setItem(STATUS_KEY, JSON.stringify(status));
    } catch (e) { /* storage full */ }
  }

  // ─── Entry Management ────────────────────────────────────────────

  function setDayAvailability(date, opts) {
    var cal = loadCalendar();
    var key = dateKey(date);
    var existing = cal[key] || {};

    cal[key] = {
      date: key,
      status: opts.status || existing.status || STATUS.AVAILABLE,
      hoursAvailable: typeof opts.hoursAvailable === 'number' ? opts.hoursAvailable : (existing.hoursAvailable || 8),
      note: opts.note !== undefined ? opts.note : (existing.note || ''),
      blocks: opts.blocks || existing.blocks || [],
      recurring: opts.recurring !== undefined ? opts.recurring : (existing.recurring || false),
      recurringDay: opts.recurringDay !== undefined ? opts.recurringDay : (existing.recurringDay || null)
    };

    saveCalendar(cal);
    _autoUpdateStatus();
    return cal[key];
  }

  function getDayAvailability(date) {
    var cal = loadCalendar();
    var key = dateKey(date);
    var entry = cal[key];

    // Check recurring entries if no specific entry
    if (!entry) {
      var dayOfWeek = new Date(date).getDay();
      var entries = Object.values(cal);
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].recurring && entries[i].recurringDay === dayOfWeek) {
          return Object.assign({}, entries[i], { date: key });
        }
      }
    }

    return entry || { date: key, status: STATUS.AVAILABLE, hoursAvailable: 8, note: '', blocks: [] };
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
    // Snap to Monday
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);

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
      var d = new Date(year, month, i);
      result.push(getDayAvailability(d));
    }
    return result;
  }

  // ─── Auto-Status Sync ────────────────────────────────────────────

  function _autoUpdateStatus() {
    var today = getDayAvailability(new Date());
    var globalStatus = {
      current: today.status,
      upworkStatus: UPWORK_STATUS_MAP[today.status] || 'Available',
      hoursToday: today.hoursAvailable,
      lastUpdated: new Date().toISOString(),
      nextAvailable: _findNextAvailable()
    };
    saveGlobalStatus(globalStatus);
    return globalStatus;
  }

  function _findNextAvailable() {
    var d = new Date();
    for (var i = 0; i < 30; i++) {
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
    if (!status.current) {
      return _autoUpdateStatus();
    }
    return status;
  }

  function setManualStatus(statusValue) {
    if (!STATUS_LABELS[statusValue]) return null;
    var globalStatus = loadGlobalStatus();
    globalStatus.current = statusValue;
    globalStatus.upworkStatus = UPWORK_STATUS_MAP[statusValue];
    globalStatus.lastUpdated = new Date().toISOString();
    globalStatus.manual = true;
    saveGlobalStatus(globalStatus);
    return globalStatus;
  }

  // ─── Upwork Status Sync ──────────────────────────────────────────

  /**
   * Generate Upwork-compatible availability payload.
   * For use with Upwork API integration.
   */
  function getUpworkAvailabilityPayload() {
    var status = getCurrentStatus();
    var week = getWeekAvailability(new Date());
    var totalHours = week.reduce(function (sum, d) { return sum + d.hoursAvailable; }, 0);

    return {
      availability: {
        status: status.upworkStatus,
        hoursPerWeek: Math.min(totalHours, 40),
        contractToHire: status.current === STATUS.AVAILABLE,
        profileAccess: status.current !== STATUS.DO_NOT_DISTURB ? 'public' : 'private',
        responseTime: status.current === STATUS.AVAILABLE ? 'within_hours' :
                       status.current === STATUS.PARTIALLY ? 'within_day' : 'more_than_day'
      },
      weeklySchedule: week.map(function (d) {
        return { date: d.date, hours: d.hoursAvailable, status: d.status };
      })
    };
  }

  // ─── Bulk Operations ─────────────────────────────────────────────

  function setWorkingHours(config) {
    var defaults = {
      weekdayHours: 8,
      weekendHours: 0,
      weekdayStatus: STATUS.AVAILABLE,
      weekendStatus: STATUS.AWAY,
      weeksAhead: 4
    };
    var cfg = Object.assign({}, defaults, config);

    var d = new Date();
    var endDate = new Date();
    endDate.setDate(endDate.getDate() + cfg.weeksAhead * 7);

    while (d <= endDate) {
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
      setDayAvailability(d, {
        status: STATUS.AWAY,
        hoursAvailable: 0,
        note: note || 'Vacation'
      });
      d.setDate(d.getDate() + 1);
    }
  }

  // ─── Calendar Stats ──────────────────────────────────────────────

  function getAvailabilityStats(days) {
    days = days || 30;
    var d = new Date();
    var stats = { available: 0, partial: 0, busy: 0, away: 0, totalHours: 0 };

    for (var i = 0; i < days; i++) {
      var entry = getDayAvailability(d);
      if (entry.status === STATUS.AVAILABLE) stats.available++;
      else if (entry.status === STATUS.PARTIALLY) stats.partial++;
      else if (entry.status === STATUS.BUSY) stats.busy++;
      else stats.away++;
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
      responseTime: status.current === STATUS.AVAILABLE ? 'Within hours' :
                     status.current === STATUS.PARTIALLY ? 'Within 24 hours' : '2-3 days',
      weekSnapshot: week.map(function (d) {
        var m = STATUS_LABELS[d.status] || STATUS_LABELS.available;
        return { date: d.date, icon: m.icon, hours: d.hoursAvailable };
      })
    };
  }

  // ─── UI Renderer ─────────────────────────────────────────────────

  function renderCalendar(containerId, year, month) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var now = new Date();
    if (year === undefined) year = now.getFullYear();
    if (month === undefined) month = now.getMonth();

    var entries = getMonthAvailability(year, month);
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = entries.length;

    var html = '<div class="cf-calendar">';
    html += '<div class="cf-cal-header">';
    html += '<button class="cf-cal-nav" data-dir="-1">◀</button>';
    html += '<span class="cf-cal-title">' + MONTHS[month] + ' ' + year + '</span>';
    html += '<button class="cf-cal-nav" data-dir="1">▶</button>';
    html += '</div>';

    // Day headers
    html += '<div class="cf-cal-grid">';
    DAYS.forEach(function (d) {
      html += '<div class="cf-cal-day-header">' + d + '</div>';
    });

    // Empty cells before first day
    for (var e = 0; e < firstDay; e++) {
      html += '<div class="cf-cal-cell cf-cal-empty"></div>';
    }

    // Day cells
    for (var i = 0; i < daysInMonth; i++) {
      var entry = entries[i];
      var meta = STATUS_LABELS[entry.status] || STATUS_LABELS.available;
      var isToday = (year === now.getFullYear() && month === now.getMonth() && i + 1 === now.getDate());
      var cls = 'cf-cal-cell' + (isToday ? ' cf-cal-today' : '');

      html += '<div class="' + cls + '" data-date="' + entry.date + '" style="border-left:3px solid ' + meta.color + '">';
      html += '<span class="cf-cal-date">' + (i + 1) + '</span>';
      html += '<span class="cf-cal-icon">' + meta.icon + '</span>';
      if (entry.hoursAvailable > 0) {
        html += '<span class="cf-cal-hours">' + entry.hoursAvailable + 'h</span>';
      }
      html += '</div>';
    }

    html += '</div></div>';

    // Status legend
    html += '<div class="cf-cal-legend">';
    Object.keys(STATUS_LABELS).forEach(function (key) {
      var m = STATUS_LABELS[key];
      html += '<span class="cf-cal-legend-item">';
      html += '<span style="color:' + m.color + '">' + m.icon + '</span> ' + m.label;
      html += '</span> ';
    });
    html += '</div>';

    container.innerHTML = html;

    // Bind navigation
    container.querySelectorAll('.cf-cal-nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = parseInt(btn.getAttribute('data-dir'));
        var newMonth = month + dir;
        var newYear = year;
        if (newMonth < 0) { newMonth = 11; newYear--; }
        if (newMonth > 11) { newMonth = 0; newYear++; }
        renderCalendar(containerId, newYear, newMonth);
      });
    });

    // Bind day clicks
    container.querySelectorAll('.cf-cal-cell[data-date]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var date = cell.getAttribute('data-date');
        if (typeof window.CortexFreelancer.AvailabilityCalendar.onDayClick === 'function') {
          window.CortexFreelancer.AvailabilityCalendar.onDayClick(date, getDayAvailability(date));
        }
      });
    });
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.AvailabilityCalendar = {
    // Constants
    STATUS: STATUS,
    STATUS_LABELS: STATUS_LABELS,

    // Data operations
    setDayAvailability: setDayAvailability,
    getDayAvailability: getDayAvailability,
    removeDayAvailability: removeDayAvailability,
    getWeekAvailability: getWeekAvailability,
    getMonthAvailability: getMonthAvailability,

    // Status
    getCurrentStatus: getCurrentStatus,
    setManualStatus: setManualStatus,

    // Upwork sync
    getUpworkAvailabilityPayload: getUpworkAvailabilityPayload,

    // Bulk ops
    setWorkingHours: setWorkingHours,
    setVacation: setVacation,

    // Analytics
    getAvailabilityStats: getAvailabilityStats,
    getClientView: getClientView,

    // UI
    renderCalendar: renderCalendar,

    // Callback hook
    onDayClick: null
  };

})();
