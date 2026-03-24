(function(){
'use strict';

document.addEventListener('DOMContentLoaded', function(){

  var STORAGE_KEY = 'cortex_meeting_history';

  // ========== DATE PARSING ==========
  function parseSchedulingReferences(text) {
    var events = [];
    var lines = text.split(/[\n.!?]+/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 5; });
    var today = new Date();
    var currentYear = today.getFullYear();
    var currentMonth = today.getMonth();

    var dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    var monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    var monthAbbrevs = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

    function getNextDayOfWeek(dayIndex) {
      var d = new Date(today);
      var diff = dayIndex - d.getDay();
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return d;
    }

    function parseTimeString(str) {
      if (!str) return { hours: 10, minutes: 0 };
      var lower = str.toLowerCase().trim();
      var match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!match) return { hours: 10, minutes: 0 };
      var h = parseInt(match[1], 10);
      var m = match[2] ? parseInt(match[2], 10) : 0;
      var ampm = match[3] ? match[3].toLowerCase() : null;
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      if (!ampm && h < 8) h += 12; // Assume PM for small numbers
      return { hours: h, minutes: m };
    }

    function formatDate(d) {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatTime(h, m) {
      var ampm = h >= 12 ? 'PM' : 'AM';
      var hour = h % 12 || 12;
      var min = m < 10 ? '0' + m : '' + m;
      return hour + ':' + min + ' ' + ampm;
    }

    // Patterns for scheduling references
    var patterns = [
      // "next meeting Thursday 2pm" or "next call Monday at 3:30pm"
      {
        regex: /(?:next\s+(?:meeting|call|sync|standup|check[\s-]?in|session|review))\s+(?:on\s+)?(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*(?:est|pst|cst|mst|et|pt|ct|mt|gmt|utc))?)/gi,
        handler: function(match) {
          var dayIdx = dayNames.indexOf(match[1].toLowerCase());
          var date = getNextDayOfWeek(dayIdx);
          var time = parseTimeString(match[2]);
          date.setHours(time.hours, time.minutes, 0, 0);
          var tz = '';
          var tzMatch = match[2].match(/(est|pst|cst|mst|et|pt|ct|mt|gmt|utc)/i);
          if (tzMatch) tz = ' ' + tzMatch[1].toUpperCase();
          return {
            title: 'Follow-up Meeting',
            date: date,
            dateStr: formatDate(date),
            timeStr: formatTime(time.hours, time.minutes) + tz,
            source: match[0],
            duration: 60
          };
        }
      },
      // "schedule for March 30" or "scheduled March 30 at 2pm"
      {
        regex: /(?:schedul(?:e|ed)\s+(?:for\s+)?)(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/gi,
        handler: function(match) {
          var monthStr = match[1].toLowerCase();
          var monthIdx = monthNames.indexOf(monthStr);
          if (monthIdx === -1) monthIdx = monthAbbrevs.indexOf(monthStr.substring(0, 3));
          var day = parseInt(match[2], 10);
          var year = currentYear;
          if (monthIdx < currentMonth || (monthIdx === currentMonth && day < today.getDate())) {
            year = currentYear + 1;
          }
          var date = new Date(year, monthIdx, day);
          var time = parseTimeString(match[3]);
          date.setHours(time.hours, time.minutes, 0, 0);
          return {
            title: 'Scheduled Meeting',
            date: date,
            dateStr: formatDate(date),
            timeStr: match[3] ? formatTime(time.hours, time.minutes) : 'TBD',
            source: match[0],
            duration: 60
          };
        }
      },
      // "meeting on March 30" or "call on April 5 at 3pm"
      {
        regex: /(?:meeting|call|sync|standup|review|session|check[\s-]?in)\s+(?:on\s+)(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/gi,
        handler: function(match) {
          var monthStr = match[1].toLowerCase();
          var monthIdx = monthNames.indexOf(monthStr);
          if (monthIdx === -1) monthIdx = monthAbbrevs.indexOf(monthStr.substring(0, 3));
          var day = parseInt(match[2], 10);
          var year = currentYear;
          if (monthIdx < currentMonth || (monthIdx === currentMonth && day < today.getDate())) {
            year = currentYear + 1;
          }
          var date = new Date(year, monthIdx, day);
          var time = parseTimeString(match[3]);
          date.setHours(time.hours, time.minutes, 0, 0);
          return {
            title: 'Scheduled Meeting',
            date: date,
            dateStr: formatDate(date),
            timeStr: match[3] ? formatTime(time.hours, time.minutes) : 'TBD',
            source: match[0],
            duration: 60
          };
        }
      },
      // "next meeting Thursday" (without time)
      {
        regex: /(?:next\s+(?:meeting|call|sync|standup|check[\s-]?in|session|review))\s+(?:on\s+)?(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?!\s+\d)/gi,
        handler: function(match) {
          var dayIdx = dayNames.indexOf(match[1].toLowerCase());
          var date = getNextDayOfWeek(dayIdx);
          date.setHours(10, 0, 0, 0);
          return {
            title: 'Follow-up Meeting',
            date: date,
            dateStr: formatDate(date),
            timeStr: 'TBD',
            source: match[0],
            duration: 60
          };
        }
      },
      // "meet next week" or "reconvene next week"
      {
        regex: /(?:meet|reconvene|sync|follow[\s-]?up|check[\s-]?in)\s+next\s+week/gi,
        handler: function(match) {
          var date = new Date(today);
          date.setDate(date.getDate() + (7 - date.getDay()) + 1); // Next Monday
          date.setHours(10, 0, 0, 0);
          return {
            title: 'Follow-up Meeting',
            date: date,
            dateStr: formatDate(date),
            timeStr: 'TBD',
            source: match[0],
            duration: 60
          };
        }
      },
      // "deadline Friday" or "due by Friday"
      {
        regex: /(?:deadline|due\s+(?:by|on)?)\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/gi,
        handler: function(match) {
          var dayIdx = dayNames.indexOf(match[1].toLowerCase());
          var date = getNextDayOfWeek(dayIdx);
          var time = match[2] ? parseTimeString(match[2]) : { hours: 17, minutes: 0 };
          date.setHours(time.hours, time.minutes, 0, 0);
          return {
            title: 'Deadline',
            date: date,
            dateStr: formatDate(date),
            timeStr: formatTime(time.hours, time.minutes),
            source: match[0],
            duration: 30
          };
        }
      },
      // "by March 30" or "due March 30"
      {
        regex: /(?:by|due|before)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/gi,
        handler: function(match) {
          var monthStr = match[1].toLowerCase();
          var monthIdx = monthNames.indexOf(monthStr);
          if (monthIdx === -1) monthIdx = monthAbbrevs.indexOf(monthStr.substring(0, 3));
          var day = parseInt(match[2], 10);
          var year = currentYear;
          if (monthIdx < currentMonth || (monthIdx === currentMonth && day < today.getDate())) {
            year = currentYear + 1;
          }
          var date = new Date(year, monthIdx, day, 17, 0, 0, 0);
          return {
            title: 'Deadline',
            date: date,
            dateStr: formatDate(date),
            timeStr: '5:00 PM',
            source: match[0],
            duration: 30
          };
        }
      }
    ];

    lines.forEach(function(line) {
      patterns.forEach(function(p) {
        p.regex.lastIndex = 0;
        var match;
        while ((match = p.regex.exec(line)) !== null) {
          var event = p.handler(match);
          if (event && event.date && !isNaN(event.date.getTime())) {
            // Try to extract a better title from context
            var contextTitle = extractContextTitle(line, event.title);
            if (contextTitle) event.title = contextTitle;
            events.push(event);
          }
        }
      });
    });

    // Deduplicate by date
    var seen = {};
    events = events.filter(function(e) {
      var key = e.date.toISOString().substring(0, 16);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    // Sort by date
    events.sort(function(a, b) { return a.date - b.date; });

    return events;
  }

  function extractContextTitle(line, fallback) {
    // Try to find a meeting-related context from the line
    var match = line.match(/(?:for|about|regarding|re:?)\s+(.{5,60})(?:\s+(?:on|at|by|next|this))/i);
    if (match) return match[1].trim();
    // Use the meeting title input if available
    var titleInput = document.getElementById('meetingTitle');
    if (titleInput && titleInput.value.trim()) return titleInput.value.trim() + ' Follow-up';
    return fallback;
  }

  // ========== ICS FILE GENERATION ==========
  function generateICS(event) {
    var start = event.date;
    var end = new Date(start.getTime() + (event.duration || 60) * 60000);

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function formatICSDate(d) {
      return d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) + 'T' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds());
    }

    var uid = 'cortex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9) + '@cortexfreelancer.com';
    var now = new Date();

    var ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Cortex Freelancer//Meeting Notes//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTART:' + formatICSDate(start),
      'DTEND:' + formatICSDate(end),
      'DTSTAMP:' + formatICSDate(now),
      'SUMMARY:' + (event.title || 'Meeting'),
      'DESCRIPTION:Detected from meeting notes via Cortex Freelancer.\\nSource: ' + (event.source || '').replace(/\n/g, '\\n'),
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return ics;
  }

  function downloadICS(event) {
    var ics = generateICS(event);
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (event.title || 'meeting').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    dataLayer.push({ event: 'tool_used', tool_name: 'meeting-notes', action: 'ics_download' });
  }

  // ========== GOOGLE CALENDAR LINK ==========
  function generateGoogleCalendarLink(event) {
    var start = event.date;
    var end = new Date(start.getTime() + (event.duration || 60) * 60000);

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function formatGDate(d) {
      return d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) + 'T' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds());
    }

    var params = {
      action: 'TEMPLATE',
      text: event.title || 'Meeting',
      dates: formatGDate(start) + '/' + formatGDate(end),
      details: 'Detected from meeting notes via Cortex Freelancer.\nSource: ' + (event.source || ''),
      sf: 'true'
    };

    var queryParts = [];
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        queryParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }

    return 'https://calendar.google.com/calendar/render?' + queryParts.join('&');
  }

  // ========== MEETING HISTORY ==========
  function loadHistory() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveToHistory(title, date, text, events) {
    var history = loadHistory();
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: title || 'Untitled Meeting',
      date: date || new Date().toISOString().split('T')[0],
      savedAt: new Date().toISOString(),
      textPreview: text.substring(0, 200),
      eventCount: events.length,
      charCount: text.length
    };
    history.unshift(entry);
    // Keep max 50 entries
    if (history.length > 50) history = history.slice(0, 50);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      // Storage full, remove oldest
      history = history.slice(0, 25);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
    return entry;
  }

  function deleteHistoryEntry(id) {
    var history = loadHistory();
    history = history.filter(function(e){ return e.id !== id; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ========== UI ==========
  function createCalendarUI() {
    var resultsContent = document.getElementById('resultsContent');
    if (!resultsContent || document.getElementById('calendarIntegrationCard')) return;

    var wrapper = document.createElement('div');
    wrapper.id = 'calendarIntegrationCard';
    wrapper.style.cssText = 'display:none;margin-bottom:2rem';

    // Insert after smartSummaryCard if it exists, otherwise after followups
    var smartCard = document.getElementById('smartSummaryCard');
    var followups = document.getElementById('followupsSection');
    var insertAfter = smartCard || followups;
    if (insertAfter && insertAfter.parentNode) {
      insertAfter.parentNode.insertBefore(wrapper, insertAfter.nextSibling);
    } else {
      resultsContent.appendChild(wrapper);
    }
  }

  function renderCalendarCard(events) {
    var wrapper = document.getElementById('calendarIntegrationCard');
    if (!wrapper) {
      createCalendarUI();
      wrapper = document.getElementById('calendarIntegrationCard');
    }
    if (!wrapper) return;

    // Save to history
    var title = (document.getElementById('meetingTitle').value || '').trim();
    var date = document.getElementById('meetingDate').value;
    var text = (document.getElementById('notesInput').value || '').trim();
    saveToHistory(title, date, text, events);

    var history = loadHistory();

    var html = '';
    html += '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius);overflow:hidden">';

    // Header
    html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
    html += '<div style="display:flex;align-items:center;gap:0.5rem">';
    html += '<div style="width:28px;height:28px;border-radius:8px;background:var(--blue);display:flex;align-items:center;justify-content:center;font-size:0.85rem;color:#000;font-weight:900">C</div>';
    html += '<span style="font-size:1.1rem;font-weight:800">Calendar Integration</span></div>';
    html += '<span style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px">' + events.length + ' event' + (events.length !== 1 ? 's' : '') + ' detected</span>';
    html += '</div>';

    if (events.length > 0) {
      // Detected Events
      html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.04)">';
      html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Detected Events</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.6rem">';

      events.forEach(function(evt, idx) {
        var isDeadline = evt.title.toLowerCase().indexOf('deadline') !== -1;
        var accentColor = isDeadline ? 'var(--red)' : 'var(--blue)';
        var icon = isDeadline ? '&#9888;' : '&#128197;';

        html += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-sm);padding:1rem;border-left:3px solid ' + accentColor + '">';
        html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">';

        // Event info
        html += '<div style="flex:1;min-width:200px">';
        html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.25rem">';
        html += '<span style="font-size:1rem">' + icon + '</span>';
        html += '<span style="font-size:0.92rem;font-weight:700;color:var(--text)">' + escHtml(evt.title) + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.82rem;color:var(--text2);margin-bottom:0.15rem">' + escHtml(evt.dateStr) + '</div>';
        html += '<div style="font-size:0.78rem;color:' + accentColor + ';font-weight:600">' + escHtml(evt.timeStr) + '</div>';
        if (evt.source) {
          html += '<div style="font-size:0.72rem;color:var(--text3);margin-top:0.35rem;font-style:italic">Source: "' + escHtml(evt.source.substring(0, 60)) + '"</div>';
        }
        html += '</div>';

        // Action buttons
        html += '<div style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap">';
        html += '<button class="cal-ics-btn" data-event-idx="' + idx + '" style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.4rem 0.8rem;border-radius:100px;font-size:0.75rem;font-weight:700;border:1px solid rgba(255,255,255,0.12);background:var(--bg3);color:var(--text2);cursor:pointer;font-family:inherit;transition:all 0.2s;white-space:nowrap">&#128229; Download .ics</button>';
        html += '<a class="cal-gcal-link" data-event-idx="' + idx + '" href="' + generateGoogleCalendarLink(evt) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.4rem 0.8rem;border-radius:100px;font-size:0.75rem;font-weight:700;border:1px solid rgba(100,180,255,0.2);background:rgba(100,180,255,0.08);color:var(--blue);text-decoration:none;cursor:pointer;font-family:inherit;transition:all 0.2s;white-space:nowrap">&#128197; Google Calendar</a>';
        html += '</div>';

        html += '</div></div>';
      });

      html += '</div></div>';

      // Mini calendar view
      html += renderMiniCalendar(events);
    } else {
      html += '<div style="padding:2rem 1.5rem;text-align:center">';
      html += '<div style="font-size:1.5rem;margin-bottom:0.5rem;opacity:0.5">&#128197;</div>';
      html += '<p style="font-size:0.88rem;color:var(--text3);margin:0">No scheduling references detected in the meeting notes.</p>';
      html += '<p style="font-size:0.78rem;color:var(--text3);margin:0.25rem 0 0">Try including phrases like "next meeting Thursday 2pm" or "schedule for March 30".</p>';
      html += '</div>';
    }

    // Meeting History
    if (history.length > 0) {
      html += '<div style="padding:1.25rem 1.5rem;border-top:1px solid rgba(255,255,255,0.06)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">';
      html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px">Meeting History</div>';
      html += '<span style="font-size:0.7rem;color:var(--text3)">' + history.length + ' saved</span>';
      html += '</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.35rem;max-height:240px;overflow-y:auto">';
      history.slice(0, 10).forEach(function(entry) {
        html += '<div class="history-entry" data-history-id="' + escHtml(entry.id) + '" style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:rgba(255,255,255,0.02);border-radius:6px;gap:0.5rem;transition:background 0.15s;cursor:default">';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="font-size:0.82rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(entry.title) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--text3)">' + escHtml(entry.date) + ' &middot; ' + entry.charCount + ' chars' + (entry.eventCount > 0 ? ' &middot; ' + entry.eventCount + ' events' : '') + '</div>';
        html += '</div>';
        html += '<button class="history-delete-btn" data-del-id="' + escHtml(entry.id) + '" style="flex-shrink:0;border:none;background:none;color:var(--text3);cursor:pointer;font-size:0.85rem;padding:0.2rem 0.4rem;border-radius:4px;transition:color 0.15s" title="Remove from history">&#10005;</button>';
        html += '</div>';
      });
      if (history.length > 10) {
        html += '<div style="font-size:0.72rem;color:var(--text3);text-align:center;padding:0.25rem">and ' + (history.length - 10) + ' more...</div>';
      }
      html += '</div></div>';
    }

    html += '</div>';

    wrapper.innerHTML = html;
    wrapper.style.display = 'block';

    // Bind event handlers
    wrapper.querySelectorAll('.cal-ics-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-event-idx'), 10);
        if (events[idx]) {
          downloadICS(events[idx]);
          this.innerHTML = '&#10003; Downloaded';
          this.style.borderColor = 'var(--green)';
          this.style.color = 'var(--green)';
          var self = this;
          setTimeout(function() {
            self.innerHTML = '&#128229; Download .ics';
            self.style.borderColor = '';
            self.style.color = '';
          }, 2000);
        }
      });
    });

    wrapper.querySelectorAll('.cal-gcal-link').forEach(function(link) {
      link.addEventListener('click', function() {
        dataLayer.push({ event: 'tool_used', tool_name: 'meeting-notes', action: 'google_calendar_link' });
      });
    });

    wrapper.querySelectorAll('.history-delete-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = this.getAttribute('data-del-id');
        deleteHistoryEntry(id);
        var row = this.closest('.history-entry');
        if (row) {
          row.style.opacity = '0';
          row.style.transform = 'translateX(20px)';
          row.style.transition = 'all 0.2s';
          setTimeout(function() { row.remove(); }, 200);
        }
        dataLayer.push({ event: 'tool_used', tool_name: 'meeting-notes', action: 'history_entry_deleted' });
      });
    });

    // Hover effects for history entries
    wrapper.querySelectorAll('.history-entry').forEach(function(el) {
      el.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.04)';
      });
      el.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(255,255,255,0.02)';
      });
    });

    // Hover effects for buttons
    wrapper.querySelectorAll('.cal-ics-btn').forEach(function(el) {
      el.addEventListener('mouseenter', function() {
        this.style.borderColor = 'var(--orange)';
        this.style.color = 'var(--orange)';
      });
      el.addEventListener('mouseleave', function() {
        if (this.innerHTML.indexOf('Downloaded') === -1) {
          this.style.borderColor = '';
          this.style.color = '';
        }
      });
    });

    dataLayer.push({ event: 'tool_used', tool_name: 'meeting-notes', action: 'calendar_integration_rendered' });
  }

  function renderMiniCalendar(events) {
    if (events.length === 0) return '';

    // Determine which month to show (first event's month)
    var firstDate = events[0].date;
    var calMonth = firstDate.getMonth();
    var calYear = firstDate.getFullYear();

    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dayHeaders = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    var firstDay = new Date(calYear, calMonth, 1).getDay();
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var today = new Date();

    // Build set of event days for this month
    var eventDays = {};
    events.forEach(function(evt) {
      if (evt.date.getMonth() === calMonth && evt.date.getFullYear() === calYear) {
        eventDays[evt.date.getDate()] = evt;
      }
    });

    var html = '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.04)">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Mini Calendar - ' + monthNames[calMonth] + ' ' + calYear + '</div>';

    html += '<div style="background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);padding:0.75rem;overflow-x:auto">';
    html += '<table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:220px">';

    // Day headers
    html += '<thead><tr>';
    dayHeaders.forEach(function(d) {
      html += '<th style="padding:0.3rem;font-size:0.65rem;font-weight:700;color:var(--text3);text-align:center;text-transform:uppercase">' + d + '</th>';
    });
    html += '</tr></thead>';

    // Calendar grid
    html += '<tbody>';
    var dayNum = 1;
    var started = false;

    for (var row = 0; row < 6 && dayNum <= daysInMonth; row++) {
      html += '<tr>';
      for (var col = 0; col < 7; col++) {
        if (row === 0 && col < firstDay) {
          html += '<td style="padding:0.25rem"></td>';
        } else if (dayNum <= daysInMonth) {
          var isToday = (today.getDate() === dayNum && today.getMonth() === calMonth && today.getFullYear() === calYear);
          var hasEvent = eventDays[dayNum];
          var cellStyle = 'padding:0.25rem;text-align:center;font-size:0.78rem;border-radius:6px;';

          if (hasEvent) {
            var isDeadline = hasEvent.title.toLowerCase().indexOf('deadline') !== -1;
            cellStyle += 'background:' + (isDeadline ? 'rgba(255,68,102,0.2)' : 'rgba(100,180,255,0.2)') + ';';
            cellStyle += 'color:' + (isDeadline ? 'var(--red)' : 'var(--blue)') + ';font-weight:800;';
          } else if (isToday) {
            cellStyle += 'background:rgba(255,136,68,0.15);color:var(--orange);font-weight:700;';
          } else {
            cellStyle += 'color:var(--text2);';
          }

          html += '<td style="' + cellStyle + '">';
          html += dayNum;
          if (hasEvent) html += '<div style="width:4px;height:4px;border-radius:50%;background:currentColor;margin:1px auto 0"></div>';
          html += '</td>';
          dayNum++;
        }
      }
      html += '</tr>';
    }

    html += '</tbody></table></div></div>';

    return html;
  }

  // ========== HOOK INTO EXISTING FLOW ==========
  var origSummarize = window.summarizeNotes;
  if (typeof origSummarize === 'function') {
    window.summarizeNotes = function() {
      // Reset calendar card
      var card = document.getElementById('calendarIntegrationCard');
      if (card) card.style.display = 'none';
      origSummarize.apply(this, arguments);
    };
  }

  // Observe results to trigger calendar detection
  var resultsContent = document.getElementById('resultsContent');
  if (resultsContent) {
    var observer = new MutationObserver(function() {
      if (resultsContent.style.display !== 'none') {
        // Short delay to let smart summary render first
        setTimeout(function() {
          var text = (document.getElementById('notesInput').value || '').trim();
          if (!text) return;
          var events = parseSchedulingReferences(text);
          createCalendarUI();
          renderCalendarCard(events);
        }, 100);
      }
    });
    observer.observe(resultsContent, { attributes: true, attributeFilter: ['style'] });
  }

});
})();
