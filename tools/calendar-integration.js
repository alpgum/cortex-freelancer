#!/usr/bin/env node
/**
 * Calendar Integration & Time Blocking
 * Sprint 2 Task 20 — Cortex Freelancer
 *
 * Smart scheduling, time blocking for deep work, client meeting
 * management, availability windows, buffer time, recurring events,
 * and daily/weekly planning. Optimize your freelancer schedule.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'calendar'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  events:      () => path.join(DATA_DIR, 'events.json'),
  blocks:      () => path.join(DATA_DIR, 'time-blocks.json'),
  templates:   () => path.join(DATA_DIR, 'day-templates.json'),
  availability:() => path.join(DATA_DIR, 'availability.json'),
  settings:    () => path.join(DATA_DIR, 'settings.json'),
};

// ─── Time Helpers ───────────────────────────────────────────────────────────

function parseTime(timeStr) {
  // Accept "9:00", "09:00", "9am", "2pm", "14:30"
  const match = timeStr.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const period = (match[3] || '').toLowerCase();

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return { hours, minutes, total: hours * 60 + minutes };
}

function formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(dd.toISOString().split('T')[0]);
  }
  return dates;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Default Day Templates ──────────────────────────────────────────────────

const DEFAULT_TEMPLATES = {
  deep_work: {
    id: 'deep_work',
    name: 'Deep Work Day',
    description: 'Maximize focused, uninterrupted work',
    blocks: [
      { start: '09:00', end: '09:30', type: 'routine', label: 'Morning Review & Planning', color: '🟡' },
      { start: '09:30', end: '12:30', type: 'deep_work', label: 'Deep Work Block 1', color: '🟣' },
      { start: '12:30', end: '13:30', type: 'break', label: 'Lunch Break', color: '⬜' },
      { start: '13:30', end: '14:00', type: 'admin', label: 'Email & Messages', color: '🟠' },
      { start: '14:00', end: '16:30', type: 'deep_work', label: 'Deep Work Block 2', color: '🟣' },
      { start: '16:30', end: '17:00', type: 'routine', label: 'Daily Wrap-up & Tomorrow Planning', color: '🟡' },
    ]
  },
  client_day: {
    id: 'client_day',
    name: 'Client Meeting Day',
    description: 'Structured for multiple client interactions',
    blocks: [
      { start: '09:00', end: '09:30', type: 'routine', label: 'Morning Prep', color: '🟡' },
      { start: '09:30', end: '10:30', type: 'meeting', label: 'Client Meeting Slot 1', color: '🔵' },
      { start: '10:30', end: '10:45', type: 'buffer', label: 'Buffer / Notes', color: '⬜' },
      { start: '10:45', end: '12:00', type: 'work', label: 'Follow-up Work', color: '🟢' },
      { start: '12:00', end: '13:00', type: 'break', label: 'Lunch', color: '⬜' },
      { start: '13:00', end: '14:00', type: 'meeting', label: 'Client Meeting Slot 2', color: '🔵' },
      { start: '14:00', end: '14:15', type: 'buffer', label: 'Buffer / Notes', color: '⬜' },
      { start: '14:15', end: '15:30', type: 'work', label: 'Project Work', color: '🟢' },
      { start: '15:30', end: '16:30', type: 'meeting', label: 'Client Meeting Slot 3', color: '🔵' },
      { start: '16:30', end: '17:00', type: 'admin', label: 'Email & Wrap-up', color: '🟠' },
    ]
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced Day',
    description: 'Mix of focused work, meetings, and admin',
    blocks: [
      { start: '09:00', end: '09:30', type: 'routine', label: 'Morning Planning', color: '🟡' },
      { start: '09:30', end: '11:30', type: 'deep_work', label: 'Deep Work Block', color: '🟣' },
      { start: '11:30', end: '12:00', type: 'admin', label: 'Email & Messages', color: '🟠' },
      { start: '12:00', end: '13:00', type: 'break', label: 'Lunch', color: '⬜' },
      { start: '13:00', end: '14:00', type: 'meeting', label: 'Meeting Slot', color: '🔵' },
      { start: '14:00', end: '14:15', type: 'buffer', label: 'Buffer', color: '⬜' },
      { start: '14:15', end: '16:15', type: 'work', label: 'Project Work', color: '🟢' },
      { start: '16:15', end: '16:45', type: 'admin', label: 'Admin & Invoicing', color: '🟠' },
      { start: '16:45', end: '17:00', type: 'routine', label: 'Daily Wrap-up', color: '🟡' },
    ]
  },
  admin_day: {
    id: 'admin_day',
    name: 'Admin & Business Day',
    description: 'Dedicated to business operations and planning',
    blocks: [
      { start: '09:00', end: '10:00', type: 'admin', label: 'Invoicing & Payments', color: '🟠' },
      { start: '10:00', end: '11:00', type: 'admin', label: 'Email & Communications', color: '🟠' },
      { start: '11:00', end: '12:00', type: 'admin', label: 'Proposals & Contracts', color: '🟠' },
      { start: '12:00', end: '13:00', type: 'break', label: 'Lunch', color: '⬜' },
      { start: '13:00', end: '14:00', type: 'admin', label: 'Marketing & Social', color: '🟠' },
      { start: '14:00', end: '15:00', type: 'admin', label: 'Bookkeeping & Expenses', color: '🟠' },
      { start: '15:00', end: '16:00', type: 'routine', label: 'Weekly Planning / Review', color: '🟡' },
      { start: '16:00', end: '17:00', type: 'education', label: 'Learning & Skills Development', color: '📚' },
    ]
  }
};

// ─── Core Functions ─────────────────────────────────────────────────────────

function addEvent(title, date, startTime, opts = {}) {
  const events = readJSON(PATHS.events());

  const start = parseTime(startTime);
  if (!start) return { error: `Invalid time format: "${startTime}". Use "9:00", "2pm", "14:30"` };

  const durationMin = opts.duration ? parseInt(opts.duration) : 60;
  const endTotal = start.total + durationMin;

  const event = {
    id: crypto.randomUUID(),
    title,
    date,
    start_time: formatTime(start.total),
    end_time: formatTime(endTotal),
    start_minutes: start.total,
    end_minutes: endTotal,
    duration_minutes: durationMin,
    type: opts.type || 'meeting', // meeting, deadline, reminder, personal, client_call
    client: opts.client || null,
    project: opts.project || null,
    location: opts.location || null,
    description: opts.description || '',
    recurring: opts.recurring || null, // daily, weekly, biweekly, monthly
    buffer_before: opts.buffer_before ? parseInt(opts.buffer_before) : 0,
    buffer_after: opts.buffer_after ? parseInt(opts.buffer_after) : 15,
    reminder_minutes: opts.reminder ? parseInt(opts.reminder) : 30,
    status: 'scheduled', // scheduled, completed, cancelled, rescheduled
    notes: opts.notes || '',
    created_at: new Date().toISOString()
  };

  // Check for conflicts
  const dayEvents = events.filter(e => e.date === date && e.status === 'scheduled');
  const conflicts = dayEvents.filter(e => {
    const eStart = e.start_minutes - e.buffer_before;
    const eEnd = e.end_minutes + e.buffer_after;
    const newStart = start.total - event.buffer_before;
    const newEnd = endTotal + event.buffer_after;
    return (newStart < eEnd && newEnd > eStart);
  });

  if (conflicts.length > 0 && opts.force !== 'true') {
    return {
      warning: true,
      message: `⚠️ Time conflict detected with ${conflicts.length} event(s):\n` +
               conflicts.map(c => `  • ${c.title} (${c.start_time} — ${c.end_time})`).join('\n') +
               '\n\nUse --force true to schedule anyway.',
      conflicts: conflicts.map(c => ({ title: c.title, time: `${c.start_time} — ${c.end_time}` }))
    };
  }

  events.push(event);

  // Generate recurring events
  if (event.recurring) {
    const recurringEvents = generateRecurring(event, opts.until || null);
    events.push(...recurringEvents);
  }

  writeJSON(PATHS.events(), events);

  const typeIcon = { meeting: '🤝', deadline: '⏰', reminder: '🔔', personal: '👤', client_call: '📞' }[event.type] || '📅';
  return {
    success: true,
    event_id: event.id,
    message: `${typeIcon} Event scheduled: ${title}\n` +
             `📅 ${date} | ${event.start_time} — ${event.end_time} (${formatDuration(durationMin)})\n` +
             (event.client ? `👤 Client: ${event.client}\n` : '') +
             (conflicts.length > 0 ? '⚠️ Scheduled with conflict!' : ''),
    event
  };
}

function generateRecurring(baseEvent, untilDate) {
  const events = [];
  const maxOccurrences = 12; // Generate up to 12 occurrences
  const until = untilDate ? new Date(untilDate) : new Date(Date.now() + 90 * 86400000); // 90 days default

  let currentDate = new Date(baseEvent.date);
  for (let i = 0; i < maxOccurrences; i++) {
    switch (baseEvent.recurring) {
      case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
      case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
      case 'biweekly': currentDate.setDate(currentDate.getDate() + 14); break;
      case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
    }
    if (currentDate > until) break;

    events.push({
      ...JSON.parse(JSON.stringify(baseEvent)),
      id: crypto.randomUUID(),
      date: currentDate.toISOString().split('T')[0],
      parent_event_id: baseEvent.id,
      created_at: new Date().toISOString()
    });
  }
  return events;
}

function getDay(date) {
  const events = readJSON(PATHS.events());
  const blocks = readJSON(PATHS.blocks());
  const targetDate = date || new Date().toISOString().split('T')[0];

  const dayEvents = events.filter(e => e.date === targetDate && e.status === 'scheduled')
    .sort((a, b) => a.start_minutes - b.start_minutes);

  const dayBlocks = blocks.filter(b => b.date === targetDate)
    .sort((a, b) => a.start_minutes - b.start_minutes);

  const dayName = DAY_NAMES[new Date(targetDate + 'T12:00:00').getDay()];

  // Merge events and blocks into timeline
  const timeline = [];

  for (const block of dayBlocks) {
    timeline.push({
      type: 'block',
      icon: block.color || '🟢',
      label: block.label,
      time: `${block.start_time} — ${block.end_time}`,
      duration: formatDuration(block.end_minutes - block.start_minutes),
      category: block.type,
      start_min: block.start_minutes
    });
  }

  for (const event of dayEvents) {
    const typeIcon = { meeting: '🤝', deadline: '⏰', reminder: '🔔', personal: '👤', client_call: '📞' }[event.type] || '📅';
    timeline.push({
      type: 'event',
      icon: typeIcon,
      label: event.title + (event.client ? ` (${event.client})` : ''),
      time: `${event.start_time} — ${event.end_time}`,
      duration: formatDuration(event.duration_minutes),
      category: event.type,
      start_min: event.start_minutes
    });
  }

  timeline.sort((a, b) => a.start_min - b.start_min);

  // Calculate stats
  const totalMeetings = dayEvents.filter(e => e.type === 'meeting' || e.type === 'client_call').length;
  const deepWorkMin = dayBlocks.filter(b => b.type === 'deep_work').reduce((sum, b) => sum + (b.end_minutes - b.start_minutes), 0);
  const meetingMin = dayEvents.reduce((sum, e) => sum + e.duration_minutes, 0);

  return {
    date: targetDate,
    day: dayName,
    events: dayEvents.length,
    time_blocks: dayBlocks.length,
    stats: {
      meetings: totalMeetings,
      deep_work: formatDuration(deepWorkMin),
      meeting_time: formatDuration(meetingMin),
      available_slots: findAvailableSlots(targetDate, dayEvents, dayBlocks)
    },
    timeline
  };
}

function findAvailableSlots(date, events, blocks) {
  const settings = readJSON(PATHS.settings(), {});
  const workStart = settings.work_start || 540; // 9:00 AM
  const workEnd = settings.work_end || 1020; // 5:00 PM
  const minSlot = 30; // Minimum 30 min slot

  // Combine all occupied time
  const occupied = [
    ...events.map(e => ({ start: e.start_minutes - e.buffer_before, end: e.end_minutes + e.buffer_after })),
    ...blocks.map(b => ({ start: b.start_minutes, end: b.end_minutes }))
  ].sort((a, b) => a.start - b.start);

  const slots = [];
  let current = workStart;

  for (const occ of occupied) {
    if (occ.start > current + minSlot) {
      slots.push({
        start: formatTime(current),
        end: formatTime(occ.start),
        duration: formatDuration(occ.start - current)
      });
    }
    current = Math.max(current, occ.end);
  }

  if (workEnd > current + minSlot) {
    slots.push({
      start: formatTime(current),
      end: formatTime(workEnd),
      duration: formatDuration(workEnd - current)
    });
  }

  return slots;
}

function getWeek(date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const weekDates = getWeekDates(targetDate);
  const events = readJSON(PATHS.events());
  const blocks = readJSON(PATHS.blocks());

  const weekView = weekDates.map(d => {
    const dayEvents = events.filter(e => e.date === d && e.status === 'scheduled');
    const dayBlocks = blocks.filter(b => b.date === d);
    const dayName = DAY_ABBREVS[new Date(d + 'T12:00:00').getDay()];

    const meetingCount = dayEvents.filter(e => e.type === 'meeting' || e.type === 'client_call').length;
    const deepWorkMin = dayBlocks.filter(b => b.type === 'deep_work').reduce((sum, b) => sum + (b.end_minutes - b.start_minutes), 0);

    return {
      date: d,
      day: dayName,
      events: dayEvents.length,
      meetings: meetingCount,
      deep_work: formatDuration(deepWorkMin),
      items: [
        ...dayEvents.map(e => `  ${e.start_time} ${e.title}`).slice(0, 3),
        ...(dayEvents.length > 3 ? [`  +${dayEvents.length - 3} more`] : [])
      ]
    };
  });

  const totalEvents = weekView.reduce((sum, d) => sum + d.events, 0);
  const totalMeetings = weekView.reduce((sum, d) => sum + d.meetings, 0);

  return {
    week_of: weekDates[0],
    week_end: weekDates[6],
    total_events: totalEvents,
    total_meetings: totalMeetings,
    days: weekView
  };
}

function addTimeBlock(date, startTime, endTime, label, opts = {}) {
  const blocks = readJSON(PATHS.blocks());

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (!start || !end) return { error: 'Invalid time format' };
  if (end.total <= start.total) return { error: 'End time must be after start time' };

  const block = {
    id: crypto.randomUUID(),
    date,
    start_time: formatTime(start.total),
    end_time: formatTime(end.total),
    start_minutes: start.total,
    end_minutes: end.total,
    duration_minutes: end.total - start.total,
    label,
    type: opts.type || 'work', // deep_work, work, meeting, admin, break, buffer, routine, education, personal
    color: opts.color || getTypeColor(opts.type || 'work'),
    client: opts.client || null,
    project: opts.project || null,
    notes: opts.notes || '',
    completed: false,
    created_at: new Date().toISOString()
  };

  blocks.push(block);
  writeJSON(PATHS.blocks(), blocks);

  return {
    success: true,
    block_id: block.id,
    message: `${block.color} Time block set: ${label}\n` +
             `📅 ${date} | ${block.start_time} — ${block.end_time} (${formatDuration(block.duration_minutes)})`,
    block
  };
}

function getTypeColor(type) {
  return {
    deep_work: '🟣', work: '🟢', meeting: '🔵', admin: '🟠',
    break: '⬜', buffer: '⬜', routine: '🟡', education: '📚', personal: '👤'
  }[type] || '🟢';
}

function applyTemplate(date, templateId) {
  const templates = readJSON(PATHS.templates(), DEFAULT_TEMPLATES);
  const template = typeof templates === 'object' && !Array.isArray(templates)
    ? templates[templateId]
    : null;

  // Also check defaults
  const tmpl = template || DEFAULT_TEMPLATES[templateId];
  if (!tmpl) {
    return { error: `Template "${templateId}" not found`, available: Object.keys(DEFAULT_TEMPLATES) };
  }

  const blocks = readJSON(PATHS.blocks());
  // Remove existing blocks for this date
  const filteredBlocks = blocks.filter(b => b.date !== date);

  // Add template blocks
  const newBlocks = tmpl.blocks.map(b => {
    const start = parseTime(b.start);
    const end = parseTime(b.end);
    return {
      id: crypto.randomUUID(),
      date,
      start_time: formatTime(start.total),
      end_time: formatTime(end.total),
      start_minutes: start.total,
      end_minutes: end.total,
      duration_minutes: end.total - start.total,
      label: b.label,
      type: b.type,
      color: b.color,
      client: null,
      project: null,
      notes: '',
      completed: false,
      template_id: templateId,
      created_at: new Date().toISOString()
    };
  });

  filteredBlocks.push(...newBlocks);
  writeJSON(PATHS.blocks(), filteredBlocks);

  return {
    success: true,
    message: `📋 Applied "${tmpl.name}" template to ${date}\n` +
             `🔢 ${newBlocks.length} time blocks created`,
    date,
    template: tmpl.name,
    blocks: newBlocks.length
  };
}

function setAvailability(opts = {}) {
  const availability = readJSON(PATHS.availability(), {});

  if (opts.work_days) {
    availability.work_days = opts.work_days.split(',').map(d => d.trim());
  }
  if (opts.work_start) {
    const t = parseTime(opts.work_start);
    if (t) availability.work_start = t.total;
  }
  if (opts.work_end) {
    const t = parseTime(opts.work_end);
    if (t) availability.work_end = t.total;
  }
  if (opts.meeting_days) {
    availability.meeting_days = opts.meeting_days.split(',').map(d => d.trim());
  }
  if (opts.meeting_start) {
    const t = parseTime(opts.meeting_start);
    if (t) availability.meeting_start = t.total;
  }
  if (opts.meeting_end) {
    const t = parseTime(opts.meeting_end);
    if (t) availability.meeting_end = t.total;
  }
  if (opts.min_break) availability.min_break_minutes = parseInt(opts.min_break);
  if (opts.max_meetings) availability.max_meetings_per_day = parseInt(opts.max_meetings);
  if (opts.buffer) availability.default_buffer_minutes = parseInt(opts.buffer);
  if (opts.timezone) availability.timezone = opts.timezone;

  availability.updated_at = new Date().toISOString();
  writeJSON(PATHS.availability(), availability);

  return {
    success: true,
    message: '✅ Availability updated',
    availability
  };
}

function getAvailability(date) {
  const availability = readJSON(PATHS.availability(), {});
  const targetDate = date || new Date().toISOString().split('T')[0];

  const dayResult = getDay(targetDate);
  const slots = dayResult.stats.available_slots;

  return {
    date: targetDate,
    day: dayResult.day,
    work_hours: availability.work_start && availability.work_end
      ? `${formatTime(availability.work_start)} — ${formatTime(availability.work_end)}`
      : '9:00 AM — 5:00 PM',
    max_meetings: availability.max_meetings_per_day || 'No limit',
    meetings_today: dayResult.stats.meetings,
    available_slots: slots,
    is_meeting_day: availability.meeting_days
      ? availability.meeting_days.includes(dayResult.day.substring(0, 3))
      : true
  };
}

function completeBlock(blockId) {
  const blocks = readJSON(PATHS.blocks());
  const block = blocks.find(b => b.id === blockId || b.id.startsWith(blockId));
  if (!block) return { error: 'Block not found' };

  block.completed = true;
  block.completed_at = new Date().toISOString();
  writeJSON(PATHS.blocks(), blocks);

  return {
    success: true,
    message: `✅ Completed: ${block.label} (${block.start_time} — ${block.end_time})`
  };
}

function cancelEvent(eventId, opts = {}) {
  const events = readJSON(PATHS.events());
  const event = events.find(e => e.id === eventId || e.id.startsWith(eventId));
  if (!event) return { error: 'Event not found' };

  event.status = 'cancelled';
  event.cancelled_at = new Date().toISOString();
  event.cancel_reason = opts.reason || '';

  // Cancel recurring instances too
  if (opts.all_recurring === 'true' && event.recurring) {
    events.filter(e => e.parent_event_id === event.id).forEach(e => {
      e.status = 'cancelled';
      e.cancelled_at = new Date().toISOString();
    });
  }

  writeJSON(PATHS.events(), events);
  return {
    success: true,
    message: `❌ Cancelled: ${event.title} (${event.date} ${event.start_time})`
  };
}

function getDailyPlan(date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const dayView = getDay(targetDate);

  let plan = `\n📅 DAILY PLAN — ${dayView.day}, ${targetDate}\n`;
  plan += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (dayView.timeline.length === 0) {
    plan += `  No events or blocks scheduled.\n`;
    plan += `  💡 Try: apply-template ${targetDate} balanced\n`;
  } else {
    for (const item of dayView.timeline) {
      plan += `${item.icon} ${item.time}  ${item.label}  (${item.duration})\n`;
    }
  }

  plan += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  plan += `📊 Meetings: ${dayView.stats.meetings} | Deep Work: ${dayView.stats.deep_work} | Meeting Time: ${dayView.stats.meeting_time}\n`;

  if (dayView.stats.available_slots.length > 0) {
    plan += `\n🟢 Available Slots:\n`;
    dayView.stats.available_slots.forEach(slot => {
      plan += `  ${slot.start} — ${slot.end} (${slot.duration})\n`;
    });
  }

  return { plan, ...dayView };
}

function listTemplates() {
  return {
    templates: Object.values(DEFAULT_TEMPLATES).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      blocks: t.blocks.length,
      total_hours: formatDuration(t.blocks.reduce((sum, b) => {
        const s = parseTime(b.start);
        const e = parseTime(b.end);
        return sum + (e.total - s.total);
      }, 0))
    }))
  };
}

function configureSettings(opts = {}) {
  const settings = readJSON(PATHS.settings(), {});
  if (opts.work_start) { const t = parseTime(opts.work_start); if (t) settings.work_start = t.total; }
  if (opts.work_end) { const t = parseTime(opts.work_end); if (t) settings.work_end = t.total; }
  if (opts.timezone) settings.timezone = opts.timezone;
  if (opts.default_duration) settings.default_duration = parseInt(opts.default_duration);
  if (opts.default_buffer) settings.default_buffer = parseInt(opts.default_buffer);
  settings.updated_at = new Date().toISOString();
  writeJSON(PATHS.settings(), settings);
  return { success: true, settings };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
📅 Calendar Integration & Time Blocking
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVENTS:
  add <title> <date> <time>        Add event
    --duration <min>               Duration in minutes (default: 60)
    --type <type>                  Type: meeting|deadline|reminder|personal|client_call
    --client <name>                Client name
    --project <name>               Project name
    --location <loc>               Location
    --recurring <freq>             Recurring: daily|weekly|biweekly|monthly
    --buffer-before <min>          Buffer before (default: 0)
    --buffer-after <min>           Buffer after (default: 15)
    --reminder <min>               Reminder minutes before
    --force true                   Schedule despite conflicts

  cancel <event-id>                Cancel event
    --reason <text>                Cancellation reason
    --all-recurring true           Cancel all recurring instances

TIME BLOCKING:
  block <date> <start> <end> <label>   Add time block
    --type <type>                  Type: deep_work|work|meeting|admin|break|buffer|routine|education
    --client, --project, --notes

  apply-template <date> <template>     Apply day template
    Templates: deep_work|client_day|balanced|admin_day

  complete-block <block-id>            Mark block as completed

VIEWS:
  today                            Today's plan
  day <date>                       View specific day
  week [date]                      Week overview
  plan [date]                      Formatted daily plan

AVAILABILITY:
  availability [date]              Check availability
  set-availability                 Configure availability
    --work-days <Mon,Tue,...>       Working days
    --work-start <time>            Work start time
    --work-end <time>              Work end time
    --meeting-days <Mon,Tue,...>    Days for meetings
    --meeting-start <time>         Meeting window start
    --meeting-end <time>           Meeting window end
    --max-meetings <n>             Max meetings per day
    --buffer <min>                 Default buffer between meetings
    --timezone <tz>                Timezone

  templates                        List day templates
  settings                         Configure settings
    --work-start, --work-end, --timezone, --default-duration, --default-buffer

  help                             Show this help

EXAMPLES:
  node calendar-integration.js add "Client call" 2024-02-01 10am --duration 45 --type client_call --client "Acme"
  node calendar-integration.js block 2024-02-01 9:00 12:00 "Deep coding" --type deep_work
  node calendar-integration.js apply-template 2024-02-01 deep_work
  node calendar-integration.js today
  node calendar-integration.js week
  node calendar-integration.js availability 2024-02-01
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    printHelp();
    return;
  }

  const command = args[0];
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  let result;

  switch (command) {
    case 'add':
      result = addEvent(args[1], args[2], args[3], {
        duration: getFlag('--duration'), type: getFlag('--type'),
        client: getFlag('--client'), project: getFlag('--project'),
        location: getFlag('--location'), description: getFlag('--description'),
        recurring: getFlag('--recurring'), buffer_before: getFlag('--buffer-before'),
        buffer_after: getFlag('--buffer-after'), reminder: getFlag('--reminder'),
        force: getFlag('--force'), until: getFlag('--until'), notes: getFlag('--notes'),
      });
      break;
    case 'cancel':
      result = cancelEvent(args[1], {
        reason: getFlag('--reason'),
        all_recurring: getFlag('--all-recurring'),
      });
      break;
    case 'block':
      result = addTimeBlock(args[1], args[2], args[3], args[4], {
        type: getFlag('--type'), client: getFlag('--client'),
        project: getFlag('--project'), notes: getFlag('--notes'),
        color: getFlag('--color'),
      });
      break;
    case 'apply-template':
      result = applyTemplate(args[1], args[2]);
      break;
    case 'complete-block':
      result = completeBlock(args[1]);
      break;
    case 'today':
      result = getDailyPlan();
      break;
    case 'day':
      result = getDay(args[1]);
      break;
    case 'week':
      result = getWeek(args[1]);
      break;
    case 'plan':
      result = getDailyPlan(args[1]);
      break;
    case 'availability':
      result = getAvailability(args[1]);
      break;
    case 'set-availability':
      result = setAvailability({
        work_days: getFlag('--work-days'), work_start: getFlag('--work-start'),
        work_end: getFlag('--work-end'), meeting_days: getFlag('--meeting-days'),
        meeting_start: getFlag('--meeting-start'), meeting_end: getFlag('--meeting-end'),
        max_meetings: getFlag('--max-meetings'), buffer: getFlag('--buffer'),
        timezone: getFlag('--timezone'), min_break: getFlag('--min-break'),
      });
      break;
    case 'templates':
      result = listTemplates();
      break;
    case 'settings':
      result = configureSettings({
        work_start: getFlag('--work-start'), work_end: getFlag('--work-end'),
        timezone: getFlag('--timezone'), default_duration: getFlag('--default-duration'),
        default_buffer: getFlag('--default-buffer'),
      });
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }

  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
}

main();
