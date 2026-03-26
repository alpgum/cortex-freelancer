/**
 * Cortex Freelancer — Google Calendar Integration Engine v1.0
 * 
 * Full Google Calendar API integration with OAuth, scheduling,
 * time blocking, milestone sync, and meeting coordination.
 * 
 * Usage:
 *   const cal = CortexCalendarEngine;
 *   await cal.init({ clientId: 'YOUR_CLIENT_ID' });
 *   await cal.authorize();
 *   const events = await cal.listEvents();
 */

;(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CortexCalendarEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  /* ======== Constants ======== */
  const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const STORAGE_KEYS = {
    settings:     'cortex_calendar_settings',
    syncState:    'cortex_calendar_sync_state',
    cachedEvents: 'cortex_calendar_cached_events',
    timeBlocks:   'cortex_calendar_time_blocks',
    meetingPreps: 'cortex_calendar_meeting_preps',
    reminders:    'cortex_calendar_reminders'
  };

  /* ======== State ======== */
  let gapiLoaded = false;
  let gisLoaded = false;
  let tokenClient = null;
  let config = { clientId: '', apiKey: '' };
  let isAuthorized = false;
  let currentCalendarId = 'primary';
  let listeners = {};

  /* ======== Storage Helpers ======== */
  function getJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch(e) { console.warn('[calendar-core] Storage write failed', e); }
  }

  /* ======== Event Bus ======== */
  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }
  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }
  function emit(event, data) {
    (listeners[event] || []).forEach(fn => {
      try { fn(data); } catch(e) { console.error('[calendar-core] listener error', e); }
    });
  }

  /* ======== Date Helpers ======== */
  function todayISO() { return new Date().toISOString().split('T')[0]; }
  function toISO(date) { return new Date(date).toISOString(); }
  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  function addHours(date, hours) {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
  }
  function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function formatDateTime(date) {
    return `${formatDate(date)} ${formatTime(date)}`;
  }
  function isSameDay(a, b) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  }
  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* ======== GAPI / GIS Initialization ======== */
  async function loadGapiScript() {
    if (document.getElementById('gapi-script')) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = 'gapi-script';
      s.src = 'https://apis.google.com/js/api.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadGisScript() {
    if (document.getElementById('gis-script')) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = 'gis-script';
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initGapi() {
    if (gapiLoaded) return;
    await loadGapiScript();
    await new Promise((resolve, reject) => {
      gapi.load('client', { callback: resolve, onerror: reject });
    });
    await gapi.client.init({
      apiKey: config.apiKey,
      discoveryDocs: [DISCOVERY_DOC]
    });
    gapiLoaded = true;
  }

  async function initGis() {
    if (gisLoaded) return;
    await loadGisScript();
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          emit('auth:error', tokenResponse);
          return;
        }
        isAuthorized = true;
        emit('auth:success', tokenResponse);
      }
    });
    gisLoaded = true;
  }

  /* ======== Public: Init & Auth ======== */
  async function init(cfg) {
    config = { ...config, ...cfg };
    const settings = getJSON(STORAGE_KEYS.settings, {});
    if (cfg.clientId) settings.clientId = cfg.clientId;
    if (cfg.apiKey) settings.apiKey = cfg.apiKey;
    setJSON(STORAGE_KEYS.settings, settings);
    
    try {
      await initGapi();
      await initGis();
      emit('init:ready');
      return true;
    } catch(e) {
      console.warn('[calendar-core] Init in demo mode (no GAPI)', e.message);
      emit('init:demo');
      return false;
    }
  }

  function authorize() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        reject(new Error('Not initialized. Call init() first.'));
        return;
      }
      const origCallback = tokenClient.callback;
      tokenClient.callback = (resp) => {
        if (resp.error) {
          reject(resp);
          emit('auth:error', resp);
        } else {
          isAuthorized = true;
          resolve(resp);
          emit('auth:success', resp);
        }
      };
      if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  function signOut() {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken('');
    }
    isAuthorized = false;
    emit('auth:signout');
  }

  /* ======== Calendar API Operations ======== */
  async function listCalendars() {
    if (!isAuthorized) throw new Error('Not authorized');
    const resp = await gapi.client.calendar.calendarList.list();
    return resp.result.items || [];
  }

  async function listEvents(options = {}) {
    if (!isAuthorized) return getCachedEvents(options);
    
    const {
      calendarId = currentCalendarId,
      timeMin = new Date().toISOString(),
      timeMax = addDays(new Date(), 30).toISOString(),
      maxResults = 100,
      singleEvents = true,
      orderBy = 'startTime',
      q = ''
    } = options;

    const params = { calendarId, timeMin, timeMax, maxResults, singleEvents, orderBy };
    if (q) params.q = q;

    const resp = await gapi.client.calendar.events.list(params);
    const events = resp.result.items || [];
    
    // Cache events
    setJSON(STORAGE_KEYS.cachedEvents, {
      events,
      fetchedAt: new Date().toISOString(),
      params: { timeMin, timeMax }
    });
    
    emit('events:loaded', events);
    return events;
  }

  async function createEvent(eventData) {
    if (!isAuthorized) throw new Error('Not authorized');
    
    const event = {
      summary: eventData.title || eventData.summary,
      description: eventData.description || '',
      location: eventData.location || '',
      start: eventData.allDay
        ? { date: eventData.startDate }
        : { dateTime: toISO(eventData.start), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: eventData.allDay
        ? { date: eventData.endDate }
        : { dateTime: toISO(eventData.end), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      colorId: eventData.colorId || undefined,
      reminders: eventData.reminders || { useDefault: true },
      attendees: (eventData.attendees || []).map(email => ({ email })),
      conferenceData: eventData.addMeet ? {
        createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } }
      } : undefined
    };

    const params = {
      calendarId: eventData.calendarId || currentCalendarId,
      resource: event,
      conferenceDataVersion: eventData.addMeet ? 1 : 0,
      sendUpdates: eventData.sendInvites ? 'all' : 'none'
    };

    const resp = await gapi.client.calendar.events.insert(params);
    emit('event:created', resp.result);
    return resp.result;
  }

  async function updateEvent(eventId, updates, calendarId) {
    if (!isAuthorized) throw new Error('Not authorized');
    
    const resp = await gapi.client.calendar.events.patch({
      calendarId: calendarId || currentCalendarId,
      eventId,
      resource: updates
    });
    emit('event:updated', resp.result);
    return resp.result;
  }

  async function deleteEvent(eventId, calendarId) {
    if (!isAuthorized) throw new Error('Not authorized');
    
    await gapi.client.calendar.events.delete({
      calendarId: calendarId || currentCalendarId,
      eventId
    });
    emit('event:deleted', { eventId });
  }

  async function getFreeBusy(timeMin, timeMax, calendarIds) {
    if (!isAuthorized) throw new Error('Not authorized');
    
    const resp = await gapi.client.calendar.freebusy.query({
      resource: {
        timeMin: toISO(timeMin),
        timeMax: toISO(timeMax),
        items: (calendarIds || [currentCalendarId]).map(id => ({ id }))
      }
    });
    return resp.result.calendars;
  }

  /* ======== Cached / Demo Events ======== */
  function getCachedEvents(options = {}) {
    const cached = getJSON(STORAGE_KEYS.cachedEvents, { events: [] });
    return cached.events;
  }

  /* ======== Time Blocking Engine ======== */
  const TimeBlocker = {
    BLOCK_TYPES: {
      deep_work:    { label: 'Deep Work',       color: '#4488ff', colorId: '9',  icon: '🎯', duration: 120 },
      admin:        { label: 'Admin & Email',    color: '#aa66ff', colorId: '3',  icon: '📋', duration: 60 },
      client_calls: { label: 'Client Calls',     color: '#00ff88', colorId: '10', icon: '📞', duration: 60 },
      breaks:       { label: 'Break',            color: '#ffcc00', colorId: '5',  icon: '☕', duration: 15 },
      review:       { label: 'Review & Planning', color: '#ff8844', colorId: '6',  icon: '📊', duration: 30 },
      learning:     { label: 'Learning',         color: '#ff4466', colorId: '11', icon: '📚', duration: 45 }
    },

    getBlocks() {
      return getJSON(STORAGE_KEYS.timeBlocks, []);
    },

    saveBlocks(blocks) {
      setJSON(STORAGE_KEYS.timeBlocks, blocks);
    },

    generateWeeklySchedule(preferences = {}) {
      const {
        workStart = 9,
        workEnd = 18,
        deepWorkHours = 4,
        adminHours = 1,
        clientCallHours = 2,
        breakEvery = 2,
        excludeDays = [0, 6] // Sun, Sat
      } = preferences;

      const blocks = [];
      const weekStart = getWeekStart(new Date());

      for (let d = 0; d < 7; d++) {
        const day = addDays(weekStart, d);
        if (excludeDays.includes(day.getDay())) continue;

        let hour = workStart;

        // Morning deep work
        const deepBlocks = Math.floor(deepWorkHours / 2);
        for (let i = 0; i < deepBlocks; i++) {
          blocks.push({
            id: crypto.randomUUID(),
            type: 'deep_work',
            date: day.toISOString().split('T')[0],
            startHour: hour,
            duration: 120,
            title: `Deep Work Block ${i + 1}`,
            synced: false
          });
          hour += 2;
          // Break
          blocks.push({
            id: crypto.randomUUID(),
            type: 'breaks',
            date: day.toISOString().split('T')[0],
            startHour: hour,
            duration: 15,
            title: 'Break',
            synced: false
          });
          hour += 0.25;
        }

        // Admin block
        blocks.push({
          id: crypto.randomUUID(),
          type: 'admin',
          date: day.toISOString().split('T')[0],
          startHour: hour,
          duration: 60,
          title: 'Admin & Email',
          synced: false
        });
        hour += 1;

        // Client calls
        blocks.push({
          id: crypto.randomUUID(),
          type: 'client_calls',
          date: day.toISOString().split('T')[0],
          startHour: hour,
          duration: Math.min(clientCallHours * 60, (workEnd - hour) * 60),
          title: 'Client Calls Window',
          synced: false
        });
        hour += clientCallHours;

        // Afternoon deep work if time remains
        if (hour + 1 <= workEnd) {
          blocks.push({
            id: crypto.randomUUID(),
            type: 'deep_work',
            date: day.toISOString().split('T')[0],
            startHour: hour,
            duration: Math.min(120, (workEnd - hour - 0.5) * 60),
            title: 'Afternoon Focus',
            synced: false
          });
          hour = workEnd - 0.5;
        }

        // End of day review
        blocks.push({
          id: crypto.randomUUID(),
          type: 'review',
          date: day.toISOString().split('T')[0],
          startHour: workEnd - 0.5,
          duration: 30,
          title: 'Daily Review & Tomorrow Planning',
          synced: false
        });
      }

      this.saveBlocks(blocks);
      emit('timeblocks:generated', blocks);
      return blocks;
    },

    async syncBlocksToCalendar(blocks) {
      if (!isAuthorized) throw new Error('Not authorized');
      const results = [];
      
      for (const block of blocks) {
        if (block.synced) continue;
        
        const type = this.BLOCK_TYPES[block.type] || this.BLOCK_TYPES.deep_work;
        const startDate = new Date(block.date);
        startDate.setHours(Math.floor(block.startHour), (block.startHour % 1) * 60, 0, 0);
        const endDate = new Date(startDate.getTime() + block.duration * 60000);

        try {
          const event = await createEvent({
            title: `${type.icon} ${block.title || type.label}`,
            description: `[Cortex Time Block: ${type.label}]\nAuto-generated by Cortex Calendar Sync`,
            start: startDate,
            end: endDate,
            colorId: type.colorId
          });
          block.synced = true;
          block.googleEventId = event.id;
          results.push({ block, event, status: 'created' });
        } catch(e) {
          results.push({ block, error: e.message, status: 'failed' });
        }
      }

      this.saveBlocks(blocks);
      emit('timeblocks:synced', results);
      return results;
    },

    getBlocksForDate(dateStr) {
      return this.getBlocks().filter(b => b.date === dateStr);
    }
  };

  /* ======== Milestone Sync ======== */
  const MilestoneSync = {
    getSyncState() {
      return getJSON(STORAGE_KEYS.syncState, {
        lastSync: null,
        syncedMilestones: {},
        syncedDeadlines: {}
      });
    },

    saveSyncState(state) {
      setJSON(STORAGE_KEYS.syncState, state);
    },

    getProjectTimelines() {
      // Integration with cf3-012 Project Timeline
      try {
        const projects = getJSON('cortex_projects', []);
        const timelines = getJSON('cortex_project_timelines', []);
        return { projects, timelines };
      } catch(e) {
        return { projects: [], timelines: [] };
      }
    },

    extractMilestones() {
      const { projects, timelines } = this.getProjectTimelines();
      const milestones = [];

      // From projects: deadlines
      projects.forEach(p => {
        if (p.deadline) {
          milestones.push({
            id: `proj-deadline-${p.id}`,
            type: 'deadline',
            title: `📅 Deadline: ${p.name}`,
            date: p.deadline,
            project: p.name,
            client: p.client,
            priority: 'high',
            description: `Project deadline for ${p.name}${p.client ? ` (${p.client})` : ''}`
          });
        }
      });

      // From timelines: milestones
      timelines.forEach(t => {
        (t.milestones || []).forEach(m => {
          milestones.push({
            id: `milestone-${t.projectId}-${m.id || m.name}`,
            type: 'milestone',
            title: `🏁 ${m.name}`,
            date: m.date || m.dueDate,
            project: t.projectName,
            priority: m.priority || 'medium',
            description: m.description || `Milestone: ${m.name}`
          });
        });
      });

      return milestones;
    },

    async syncToCalendar() {
      if (!isAuthorized) throw new Error('Not authorized');
      
      const milestones = this.extractMilestones();
      const state = this.getSyncState();
      const results = [];

      for (const ms of milestones) {
        if (!ms.date) continue;
        
        const existing = state.syncedMilestones[ms.id];
        
        // Create or update
        try {
          if (existing && existing.googleEventId) {
            // Update if date changed
            if (existing.date !== ms.date) {
              await updateEvent(existing.googleEventId, {
                start: { date: ms.date },
                end: { date: ms.date },
                summary: ms.title,
                description: ms.description
              });
              state.syncedMilestones[ms.id] = { ...ms, googleEventId: existing.googleEventId };
              results.push({ milestone: ms, status: 'updated' });
            } else {
              results.push({ milestone: ms, status: 'unchanged' });
            }
          } else {
            const event = await createEvent({
              title: ms.title,
              description: `${ms.description}\n\nProject: ${ms.project}\nPriority: ${ms.priority}\n\n[Synced by Cortex Calendar]`,
              allDay: true,
              startDate: ms.date,
              endDate: ms.date
            });
            state.syncedMilestones[ms.id] = { ...ms, googleEventId: event.id };
            results.push({ milestone: ms, status: 'created' });
          }
        } catch(e) {
          results.push({ milestone: ms, status: 'failed', error: e.message });
        }
      }

      state.lastSync = new Date().toISOString();
      this.saveSyncState(state);
      emit('milestones:synced', results);
      return results;
    },

    getMilestonesByMonth(year, month) {
      return this.extractMilestones().filter(m => {
        if (!m.date) return false;
        const d = new Date(m.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }
  };

  /* ======== Meeting Coordinator ======== */
  const MeetingCoordinator = {
    getClientDirectory() {
      // Integration with cf3-005 Client Directory
      try {
        return getJSON('cortex_clients', []);
      } catch(e) {
        return [];
      }
    },

    getMeetingPreps() {
      return getJSON(STORAGE_KEYS.meetingPreps, []);
    },

    saveMeetingPreps(preps) {
      setJSON(STORAGE_KEYS.meetingPreps, preps);
    },

    async findAvailableSlots(dateRange, duration = 60, preferences = {}) {
      const {
        startHour = 9,
        endHour = 18,
        excludeDays = [0, 6],
        bufferMinutes = 15,
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      } = preferences;

      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      const slots = [];

      // Get existing events
      let events = [];
      try {
        events = await listEvents({
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString()
        });
      } catch(e) {
        events = getCachedEvents();
      }

      // Build busy times
      const busyTimes = events.map(e => ({
        start: new Date(e.start.dateTime || e.start.date),
        end: new Date(e.end.dateTime || e.end.date)
      }));

      // Find free slots
      const current = new Date(startDate);
      while (current <= endDate) {
        if (!excludeDays.includes(current.getDay())) {
          const dayStart = new Date(current);
          dayStart.setHours(startHour, 0, 0, 0);
          const dayEnd = new Date(current);
          dayEnd.setHours(endHour, 0, 0, 0);

          let slotStart = new Date(dayStart);
          while (slotStart.getTime() + duration * 60000 <= dayEnd.getTime()) {
            const slotEnd = new Date(slotStart.getTime() + duration * 60000);
            
            const isConflict = busyTimes.some(busy => {
              const bufferStart = new Date(busy.start.getTime() - bufferMinutes * 60000);
              const bufferEnd = new Date(busy.end.getTime() + bufferMinutes * 60000);
              return slotStart < bufferEnd && slotEnd > bufferStart;
            });

            if (!isConflict) {
              slots.push({
                start: new Date(slotStart),
                end: new Date(slotEnd),
                date: formatDate(slotStart),
                time: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
                available: true
              });
            }

            slotStart = new Date(slotStart.getTime() + 30 * 60000); // 30min increments
          }
        }
        current.setDate(current.getDate() + 1);
      }

      emit('slots:found', slots);
      return slots;
    },

    async scheduleMeeting(meetingData) {
      const {
        client,
        title,
        description,
        start,
        end,
        duration = 60,
        addMeet = true,
        sendInvites = true,
        addPrep = true,
        prepTime = 15,
        addFollowUp = true
      } = meetingData;

      const results = { meeting: null, prep: null, followUp: null };

      // Create the meeting
      const eventStart = new Date(start);
      const eventEnd = end ? new Date(end) : addHours(eventStart, duration / 60);

      results.meeting = await createEvent({
        title: title || `Meeting with ${client.name || client}`,
        description: description || `Client meeting\n\n${client.company ? `Company: ${client.company}\n` : ''}${client.email ? `Email: ${client.email}` : ''}`,
        start: eventStart,
        end: eventEnd,
        attendees: client.email ? [client.email] : [],
        addMeet,
        sendInvites
      });

      // Prep event
      if (addPrep && prepTime > 0) {
        const prepStart = new Date(eventStart.getTime() - prepTime * 60000);
        results.prep = await createEvent({
          title: `📋 Prep: ${title || `Meeting with ${client.name || client}`}`,
          description: `Preparation time for upcoming meeting.\n\nReview:\n- Previous notes\n- Action items\n- Agenda`,
          start: prepStart,
          end: eventStart,
          colorId: '3' // purple
        });
      }

      // Follow-up reminder (next day, 10am)
      if (addFollowUp) {
        const followUpDate = addDays(eventStart, 1);
        followUpDate.setHours(10, 0, 0, 0);
        
        const prep = {
          id: crypto.randomUUID(),
          meetingId: results.meeting.id,
          client: client.name || client,
          meetingDate: eventStart.toISOString(),
          followUpDate: followUpDate.toISOString(),
          status: 'pending',
          notes: '',
          actionItems: []
        };
        
        const preps = this.getMeetingPreps();
        preps.push(prep);
        this.saveMeetingPreps(preps);
        results.followUpPrep = prep;
      }

      emit('meeting:scheduled', results);
      return results;
    },

    generateMeetingMessage(client, slots, options = {}) {
      const { type = 'scheduling', timezone = '' } = options;
      const clientName = client.name || client;
      const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (type === 'scheduling') {
        const slotList = slots.slice(0, 3).map((s, i) => 
          `  ${i + 1}. ${s.date} at ${s.time}`
        ).join('\n');

        return `Hi ${clientName},

I'd love to schedule a call to discuss our project. Here are a few times that work on my end (${tz}):

${slotList}

Would any of these work for you? If not, feel free to suggest a time that's more convenient.

Looking forward to connecting!`;
      }

      if (type === 'reminder') {
        const meeting = slots[0];
        return `Hi ${clientName},

Just a friendly reminder about our meeting ${meeting.date} at ${meeting.time}. Looking forward to our conversation!

Please let me know if you need to reschedule.`;
      }

      if (type === 'followup') {
        return `Hi ${clientName},

Thank you for the great conversation today! Here's a quick summary of what we discussed and the next steps:

[Meeting notes here]

Action items:
- [Item 1]
- [Item 2]

Please let me know if I missed anything. Looking forward to our next steps!`;
      }

      return '';
    },

    getPendingFollowUps() {
      const preps = this.getMeetingPreps();
      return preps.filter(p => p.status === 'pending' && new Date(p.followUpDate) <= new Date());
    }
  };

  /* ======== Time Tracker Integration ======== */
  const TimeTrackerBridge = {
    getTimeEntries() {
      // Integration with cf3-001 Time Tracker
      try {
        return getJSON('cortex_time_entries', []);
      } catch(e) {
        return [];
      }
    },

    suggestTimeEntries(events) {
      const entries = this.getTimeEntries();
      const suggestions = [];

      events.forEach(event => {
        if (!event.start.dateTime) return; // skip all-day events
        
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        const durationMin = (eventEnd - eventStart) / 60000;

        // Check if there's already a time entry for this event
        const hasEntry = entries.some(e => {
          const entryStart = new Date(e.start || e.startTime);
          return isSameDay(entryStart, eventStart) && 
                 Math.abs(entryStart - eventStart) < 30 * 60000;
        });

        if (!hasEntry && durationMin >= 15) {
          // Detect project from event title/description
          const project = this.detectProject(event);
          
          suggestions.push({
            eventId: event.id,
            summary: event.summary,
            start: event.start.dateTime,
            end: event.end.dateTime,
            duration: durationMin,
            project: project,
            client: this.detectClient(event),
            type: this.detectEntryType(event),
            billable: this.isBillable(event)
          });
        }
      });

      emit('timeentry:suggestions', suggestions);
      return suggestions;
    },

    detectProject(event) {
      const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
      const projects = getJSON('cortex_projects', []);
      
      for (const p of projects) {
        if (text.includes(p.name.toLowerCase())) return p.name;
        if (p.client && text.includes(p.client.toLowerCase())) return p.name;
      }
      return null;
    },

    detectClient(event) {
      const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
      const clients = getJSON('cortex_clients', []);
      
      for (const c of clients) {
        if (c.name && text.includes(c.name.toLowerCase())) return c.name;
        if (c.company && text.includes(c.company.toLowerCase())) return c.company;
      }

      // Check attendees
      if (event.attendees) {
        for (const a of event.attendees) {
          const client = clients.find(c => c.email === a.email);
          if (client) return client.name || client.company;
        }
      }
      return null;
    },

    detectEntryType(event) {
      const text = `${event.summary || ''}`.toLowerCase();
      if (text.includes('meeting') || text.includes('call') || text.includes('sync')) return 'meeting';
      if (text.includes('review') || text.includes('feedback')) return 'review';
      if (text.includes('deep work') || text.includes('focus')) return 'deep_work';
      if (text.includes('admin') || text.includes('email')) return 'admin';
      return 'other';
    },

    isBillable(event) {
      const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
      if (text.includes('internal') || text.includes('personal') || text.includes('break')) return false;
      if (text.includes('billable')) return true;
      // Default: meetings with clients are billable
      return event.attendees && event.attendees.length > 0;
    },

    async createTimeEntriesFromEvents(suggestions) {
      if (typeof CortexTimeEngine === 'undefined') {
        console.warn('[calendar-core] CortexTimeEngine not available');
        return [];
      }

      const created = [];
      for (const s of suggestions) {
        try {
          const entry = {
            project: s.project || 'Uncategorized',
            client: s.client || '',
            desc: s.summary,
            start: new Date(s.start).getTime(),
            end: new Date(s.end).getTime(),
            tags: [s.type, s.billable ? 'billable' : 'non-billable'],
            source: 'calendar-sync'
          };
          // Manual add via time engine
          const entries = getJSON('cortex_time_entries', []);
          entries.push({
            ...entry,
            id: crypto.randomUUID(),
            duration: s.duration * 60000,
            createdAt: new Date().toISOString()
          });
          setJSON('cortex_time_entries', entries);
          created.push(entry);
        } catch(e) {
          console.warn('[calendar-core] Failed to create time entry', e);
        }
      }

      emit('timeentry:created', created);
      return created;
    }
  };

  /* ======== Communication Hub Bridge ======== */
  const CommHubBridge = {
    scheduleReminder(meetingEvent, options = {}) {
      const {
        reminderMinutes = [1440, 60, 15], // 1 day, 1 hour, 15 min
        channels = ['browser']
      } = options;

      const reminders = getJSON(STORAGE_KEYS.reminders, []);
      const eventStart = new Date(meetingEvent.start.dateTime || meetingEvent.start.date);

      reminderMinutes.forEach(mins => {
        const triggerAt = new Date(eventStart.getTime() - mins * 60000);
        if (triggerAt > new Date()) {
          reminders.push({
            id: crypto.randomUUID(),
            eventId: meetingEvent.id,
            eventTitle: meetingEvent.summary,
            triggerAt: triggerAt.toISOString(),
            minutesBefore: mins,
            channels,
            fired: false,
            client: MeetingCoordinator.detectClient ? TimeTrackerBridge.detectClient(meetingEvent) : null
          });
        }
      });

      setJSON(STORAGE_KEYS.reminders, reminders);
      emit('reminders:scheduled', reminders);
      return reminders;
    },

    checkReminders() {
      const reminders = getJSON(STORAGE_KEYS.reminders, []);
      const now = new Date();
      const due = [];

      reminders.forEach(r => {
        if (!r.fired && new Date(r.triggerAt) <= now) {
          r.fired = true;
          due.push(r);
          
          // Browser notification
          if (r.channels.includes('browser') && Notification.permission === 'granted') {
            const label = r.minutesBefore >= 60 
              ? `${Math.floor(r.minutesBefore / 60)}h` 
              : `${r.minutesBefore}min`;
            new Notification(`📅 ${r.eventTitle}`, {
              body: `Starting in ${label}${r.client ? ` — ${r.client}` : ''}`,
              icon: '/favicon.ico',
              tag: r.id
            });
          }
        }
      });

      if (due.length > 0) {
        setJSON(STORAGE_KEYS.reminders, reminders);
        emit('reminders:fired', due);
      }

      return due;
    },

    startReminderLoop(intervalMs = 60000) {
      this._reminderInterval = setInterval(() => this.checkReminders(), intervalMs);
      this.checkReminders(); // immediate check
    },

    stopReminderLoop() {
      if (this._reminderInterval) clearInterval(this._reminderInterval);
    }
  };

  /* ======== Demo Data Generator ======== */
  function generateDemoEvents() {
    const now = new Date();
    const events = [];
    const clients = ['Sarah Chen', 'Marcus Johnson', 'Elena Rodriguez', 'Tom Williams', 'Ana Park'];
    const types = ['Project Review', 'Sprint Planning', 'Design Review', 'Kickoff Call', 'Status Update'];

    for (let d = -2; d < 14; d++) {
      const day = addDays(now, d);
      if (day.getDay() === 0 || day.getDay() === 6) continue;

      const numEvents = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numEvents; i++) {
        const hour = 9 + Math.floor(Math.random() * 7);
        const duration = [30, 45, 60][Math.floor(Math.random() * 3)];
        const start = new Date(day);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start.getTime() + duration * 60000);

        events.push({
          id: `demo-${d}-${i}`,
          summary: `${types[Math.floor(Math.random() * types.length)]} — ${clients[Math.floor(Math.random() * clients.length)]}`,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          status: 'confirmed',
          colorId: String(Math.floor(Math.random() * 11) + 1),
          attendees: [{ email: 'client@example.com', responseStatus: 'accepted' }],
          htmlLink: '#',
          _demo: true
        });
      }
    }

    return events;
  }

  /* ======== Settings ======== */
  function getSettings() {
    return getJSON(STORAGE_KEYS.settings, {
      clientId: '',
      apiKey: '',
      defaultCalendar: 'primary',
      workStart: 9,
      workEnd: 18,
      deepWorkHours: 4,
      excludeDays: [0, 6],
      autoSync: false,
      syncInterval: 15,
      reminderDefaults: [1440, 60, 15],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      theme: 'auto'
    });
  }

  function saveSettings(updates) {
    const current = getSettings();
    const merged = { ...current, ...updates };
    setJSON(STORAGE_KEYS.settings, merged);
    emit('settings:updated', merged);
    return merged;
  }

  /* ======== Auto-Sync Loop ======== */
  let syncInterval = null;

  function startAutoSync(intervalMinutes = 15) {
    stopAutoSync();
    syncInterval = setInterval(async () => {
      try {
        await listEvents();
        await MilestoneSync.syncToCalendar();
        emit('autosync:complete', { timestamp: new Date().toISOString() });
      } catch(e) {
        emit('autosync:error', e);
      }
    }, intervalMinutes * 60000);
  }

  function stopAutoSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = null;
  }

  /* ======== Public API ======== */
  return {
    // Core
    init,
    authorize,
    signOut,
    isAuthorized: () => isAuthorized,
    
    // Calendar operations
    listCalendars,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getFreeBusy,
    setCalendar: (id) => { currentCalendarId = id; },
    
    // Sub-engines
    TimeBlocker,
    MilestoneSync,
    MeetingCoordinator,
    TimeTrackerBridge,
    CommHubBridge,
    
    // Settings
    getSettings,
    saveSettings,
    
    // Auto-sync
    startAutoSync,
    stopAutoSync,
    
    // Demo
    generateDemoEvents,
    
    // Utils
    formatTime,
    formatDate,
    formatDateTime,
    
    // Events
    on,
    off,
    
    // Storage keys (for debugging)
    STORAGE_KEYS
  };
});
