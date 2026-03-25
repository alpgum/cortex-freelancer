#!/usr/bin/env node
/**
 * Client Communication Automation with Smart Scheduling
 * CFX-064
 *
 * Comprehensive system for scheduling, templating, tracking, and
 * optimising freelancer ↔ client communications.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage helpers ────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'communications'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  messages:  () => path.join(DATA_DIR, 'messages.json'),
  responses: () => path.join(DATA_DIR, 'responses.json'),
  templates: () => path.join(DATA_DIR, 'templates.json'),
  timing:    () => path.join(DATA_DIR, 'timing-analytics.json'),
  followups: () => path.join(DATA_DIR, 'followups.json'),
};

// ─── Utility helpers ────────────────────────────────────────────────────────

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

function now() {
  return new Date().toISOString();
}

/**
 * Calculate a future Date based on a human-readable interval string.
 * Supports: "1d", "3d", "7d", "14d", "1h", "30m", etc.
 */
function addInterval(from, interval) {
  const d = new Date(from);
  const match = String(interval).match(/^(\d+)\s*(m|h|d|w)$/i);
  if (!match) throw new Error(`Invalid interval: ${interval}`);
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return new Date(d.getTime() + n * multipliers[unit]);
}

/**
 * Very lightweight timezone-aware hour calculator.
 * offset is a string like "+03:00" or "-05:00" or an integer (hours).
 */
function clientLocalHour(utcDate, offset) {
  const d = new Date(utcDate);
  let hrs;
  if (typeof offset === 'string') {
    const m = offset.match(/^([+-]?)(\d{1,2}):?(\d{2})?$/);
    if (m) {
      hrs = parseInt(m[2], 10) + (parseInt(m[3] || '0', 10) / 60);
      if (m[1] === '-') hrs = -hrs;
    } else {
      hrs = 0;
    }
  } else {
    hrs = Number(offset) || 0;
  }
  return (d.getUTCHours() + hrs + 24) % 24;
}

// ─── Tone detection ─────────────────────────────────────────────────────────

const TONE_SIGNALS = {
  formal: [
    /\bdear\b/i, /\bkind regards\b/i, /\bsincerely\b/i,
    /\bplease find\b/i, /\bfurthermore\b/i, /\bhereby\b/i,
    /\brespectfully\b/i, /\bI would like to\b/i
  ],
  casual: [
    /\bhey\b/i, /\bthanks!\b/i, /\bcheers\b/i, /\bcool\b/i,
    /\bawesome\b/i, /\bno worries\b/i, /:\)/, /\blol\b/i,
    /\bbtw\b/i
  ],
  technical: [
    /\bAPI\b/, /\brepository\b/i, /\bmerge\b/i, /\bdeploy\b/i,
    /\bCI\/CD\b/i, /\blatency\b/i, /\bendpoint\b/i, /\bstack\b/i,
    /\bregression\b/i
  ]
};

function detectTone(text) {
  if (!text) return 'neutral';
  const scores = { formal: 0, casual: 0, technical: 0 };
  for (const [tone, patterns] of Object.entries(TONE_SIGNALS)) {
    for (const p of patterns) {
      if (p.test(text)) scores[tone]++;
    }
  }
  const max = Math.max(...Object.values(scores));
  if (max === 0) return 'neutral';
  return Object.entries(scores).find(([, v]) => v === max)[0];
}

// ─── Templates ──────────────────────────────────────────────────────────────

const BUILTIN_TEMPLATES = {
  'meeting-request': {
    formal: 'Dear {{clientName}},\n\nI would like to schedule a meeting to discuss {{topic}}. Would {{proposedTime}} work for you?\n\nPlease let me know your availability.\n\nBest regards,\n{{senderName}}',
    casual: 'Hey {{clientName}}! 👋\n\nWant to hop on a quick call about {{topic}}? How about {{proposedTime}}?\n\nLet me know!\n{{senderName}}',
    technical: 'Hi {{clientName}},\n\nI\'d like to schedule a sync to go over {{topic}}. Proposed time: {{proposedTime}}.\n\nPlease confirm or suggest an alternative.\n\nThanks,\n{{senderName}}',
    neutral: 'Hi {{clientName}},\n\nI\'d like to schedule a meeting regarding {{topic}}. Would {{proposedTime}} work for you?\n\nLooking forward to your reply.\n\n{{senderName}}'
  },
  'status-update': {
    formal: 'Dear {{clientName}},\n\nPlease find below the current project status:\n\n{{statusDetails}}\n\nShould you have any questions, please do not hesitate to reach out.\n\nKind regards,\n{{senderName}}',
    casual: 'Hey {{clientName}}! Quick update on the project:\n\n{{statusDetails}}\n\nLet me know if you have questions!\n{{senderName}}',
    technical: 'Hi {{clientName}},\n\nProject status update:\n\n{{statusDetails}}\n\nNext steps are outlined above. Ping me if anything needs clarification.\n\n{{senderName}}',
    neutral: 'Hi {{clientName}},\n\nHere\'s a status update on the project:\n\n{{statusDetails}}\n\nPlease let me know if you have any questions.\n\n{{senderName}}'
  },
  'milestone-notification': {
    formal: 'Dear {{clientName}},\n\nI am pleased to inform you that we have reached the following milestone:\n\n{{milestoneDetails}}\n\nPlease review at your earliest convenience.\n\nBest regards,\n{{senderName}}',
    casual: 'Hey {{clientName}}! 🎉\n\nGreat news — we just hit a milestone:\n\n{{milestoneDetails}}\n\nTake a look when you get a chance!\n{{senderName}}',
    technical: 'Hi {{clientName}},\n\nMilestone achieved:\n\n{{milestoneDetails}}\n\nAll deliverables are ready for review.\n\n{{senderName}}',
    neutral: 'Hi {{clientName}},\n\nWe\'ve reached a project milestone:\n\n{{milestoneDetails}}\n\nPlease review and let me know your thoughts.\n\n{{senderName}}'
  },
  'feedback-request': {
    formal: 'Dear {{clientName}},\n\nI would greatly appreciate your feedback on the recent deliverable. Your input is invaluable to ensure we meet your expectations.\n\nPlease share any comments or revisions needed.\n\nRespectfully,\n{{senderName}}',
    casual: 'Hey {{clientName}}!\n\nWould love to get your thoughts on what we delivered. Any feedback? 🙏\n\nThanks!\n{{senderName}}',
    technical: 'Hi {{clientName}},\n\nThe latest deliverable is ready for review. Please provide feedback on functionality, performance, and any edge cases you\'d like addressed.\n\n{{senderName}}',
    neutral: 'Hi {{clientName}},\n\nI\'d appreciate your feedback on the recent deliverable. Please share any thoughts or revision requests.\n\nThank you,\n{{senderName}}'
  },
  'thank-you': {
    formal: 'Dear {{clientName}},\n\nThank you for {{reason}}. It has been a pleasure working with you, and I look forward to our continued collaboration.\n\nWarm regards,\n{{senderName}}',
    casual: 'Hey {{clientName}}! Just wanted to say thanks for {{reason}}. Really appreciate it! 🙌\n\n{{senderName}}',
    technical: 'Hi {{clientName}},\n\nThanks for {{reason}}. Solid collaboration — looking forward to the next phase.\n\n{{senderName}}',
    neutral: 'Hi {{clientName}},\n\nThank you for {{reason}}. I appreciate working with you and look forward to future collaboration.\n\n{{senderName}}'
  },
  'follow-up': {
    formal: 'Dear {{clientName}},\n\nI wanted to follow up on my previous message regarding {{topic}}. Please let me know if you need any additional information.\n\nBest regards,\n{{senderName}}',
    casual: 'Hey {{clientName}}! Just bumping this — any thoughts on {{topic}}? No rush, just checking in 😊\n\n{{senderName}}',
    technical: 'Hi {{clientName}},\n\nFollowing up on {{topic}}. Let me know if you need more details or want to schedule a quick call.\n\n{{senderName}}',
    neutral: 'Hi {{clientName}},\n\nI\'m following up on {{topic}}. Please let me know if you have any questions or need further information.\n\n{{senderName}}'
  },
  're-engagement': {
    formal: 'Dear {{clientName}},\n\nIt has been some time since we last connected. I hope all is well. I wanted to reach out to see if there are any upcoming projects or needs I might assist with.\n\nBest regards,\n{{senderName}}',
    casual: 'Hey {{clientName}}! It\'s been a while — hope you\'re doing great! 😊\n\nJust checking in to see if there\'s anything I can help with.\n\n{{senderName}}',
    technical: 'Hi {{clientName}},\n\nHaven\'t synced in a while. If you have any upcoming technical needs or projects, I\'d be happy to discuss.\n\n{{senderName}}',
    neutral: 'Hi {{clientName}},\n\nIt\'s been a while since we last spoke. I hope everything is going well. I\'d love to reconnect if you have any upcoming needs.\n\n{{senderName}}'
  }
};

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? (vars[key] ?? '') : '';
  });
}

// ─── Channel formatting ─────────────────────────────────────────────────────

function formatForChannel(text, channel) {
  switch (channel) {
    case 'email':
      return { subject: text.split('\n')[0].replace(/^(Dear|Hey|Hi)\s+.*?,?\s*/, '').trim() || 'Update', body: text };
    case 'slack':
      return text
        .replace(/^Dear\s+/gm, '')
        .replace(/\nBest regards,\n/g, '\n')
        .replace(/\nKind regards,\n/g, '\n')
        .replace(/\nRespectfully,\n/g, '\n')
        .replace(/\nWarm regards,\n/g, '\n');
    case 'formal-letter':
      return `${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n${text}`;
    default:
      return text;
  }
}

// ─── Smart Scheduling Engine ────────────────────────────────────────────────

const DEFAULT_BUSINESS_HOURS = { start: 9, end: 17 }; // in client local time
const URGENCY_MULTIPLIERS = { low: 1.0, normal: 0.7, high: 0.3, critical: 0 }; // delay factor

/**
 * Determine the optimal send time for a message.
 *
 * @param {Object} opts
 * @param {string}  opts.clientId
 * @param {string}  [opts.clientTimezone] - e.g. "+03:00"
 * @param {string}  [opts.urgency]        - low|normal|high|critical
 * @param {string}  [opts.preferredDay]   - e.g. "tuesday"
 * @returns {{ sendAt: string, reason: string }}
 */
function calculateOptimalTime(opts = {}) {
  const {
    clientId,
    clientTimezone = '+00:00',
    urgency = 'normal',
    preferredDay = null
  } = opts;

  const urgMult = URGENCY_MULTIPLIERS[urgency] ?? URGENCY_MULTIPLIERS.normal;

  // If critical, send now
  if (urgMult === 0) {
    return { sendAt: now(), reason: 'Critical urgency — send immediately.' };
  }

  // Try to use historical response data to pick best hour
  const analytics = analyzeClientTiming(clientId);
  let bestHour = analytics.bestHour ?? 10; // default 10 AM local

  // Clamp to business hours
  bestHour = Math.max(DEFAULT_BUSINESS_HOURS.start, Math.min(DEFAULT_BUSINESS_HOURS.end - 1, bestHour));

  // Build candidate send time
  let candidate = new Date();
  const currentLocalHour = clientLocalHour(candidate, clientTimezone);

  // If we\'re past the best hour today, push to tomorrow
  if (currentLocalHour > bestHour + 1) {
    candidate = new Date(candidate.getTime() + 86_400_000);
  }

  // Set hour (approximate — shift by tz offset)
  const offsetHours = typeof clientTimezone === 'string'
    ? parseFloat(clientTimezone.replace(':', '.'))
    : Number(clientTimezone) || 0;
  candidate.setUTCHours(bestHour - Math.round(offsetHours), 0, 0, 0);

  // Avoid weekends
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6) {
    candidate = new Date(candidate.getTime() + 86_400_000);
  }

  // Preferred day
  if (preferredDay) {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = days.indexOf(preferredDay.toLowerCase());
    if (target >= 0) {
      while (candidate.getUTCDay() !== target) {
        candidate = new Date(candidate.getTime() + 86_400_000);
      }
    }
  }

  return {
    sendAt: candidate.toISOString(),
    reason: `Scheduled for ${bestHour}:00 client local time (${analytics.bestHour ? 'based on response history' : 'default business hours'}).`
  };
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Schedule a message for sending.
 */
function scheduleMessage(opts) {
  const {
    clientId,
    clientName,
    template,
    channel = 'email',
    tone,
    variables = {},
    urgency = 'normal',
    clientTimezone = '+00:00',
    sendAt = null,
    senderName = 'Freelancer'
  } = opts;

  if (!clientId) throw new Error('clientId is required');
  if (!template) throw new Error('template name is required');

  // Detect/override tone
  const effectiveTone = tone || detectTone(variables._sampleText) || 'neutral';

  // Resolve template text
  const tmplSet = BUILTIN_TEMPLATES[template];
  if (!tmplSet) throw new Error(`Unknown template: ${template}. Available: ${Object.keys(BUILTIN_TEMPLATES).join(', ')}`);
  const tmplText = tmplSet[effectiveTone] || tmplSet.neutral;

  // Merge variables
  const allVars = { clientName: clientName || clientId, senderName, ...variables };
  const body = renderTemplate(tmplText, allVars);
  const formatted = formatForChannel(body, channel);

  // Determine send time
  const timing = sendAt
    ? { sendAt, reason: 'Manually specified.' }
    : calculateOptimalTime({ clientId, clientTimezone, urgency });

  const msg = {
    id: uid(),
    clientId,
    clientName: clientName || clientId,
    template,
    channel,
    tone: effectiveTone,
    urgency,
    body: typeof formatted === 'object' ? formatted.body || body : formatted,
    subject: typeof formatted === 'object' ? formatted.subject : undefined,
    sendAt: timing.sendAt,
    schedulingReason: timing.reason,
    status: 'scheduled',
    createdAt: now(),
    followUpCount: 0
  };

  const messages = readJSON(PATHS.messages());
  messages.push(msg);
  writeJSON(PATHS.messages(), messages);

  return msg;
}

/**
 * Generate a follow-up for a previously sent message.
 */
function generateFollowUp(opts) {
  const {
    messageId,
    interval = '3d',
    customBody = null,
    maxFollowUps = 3
  } = opts;

  const messages = readJSON(PATHS.messages());
  const original = messages.find(m => m.id === messageId);
  if (!original) throw new Error(`Message ${messageId} not found`);

  if (original.followUpCount >= maxFollowUps) {
    return { skipped: true, reason: `Max follow-ups (${maxFollowUps}) reached for message ${messageId}.` };
  }

  const sendAt = addInterval(now(), interval).toISOString();
  const tone = original.tone || 'neutral';
  const tmplText = (BUILTIN_TEMPLATES['follow-up'] || {})[tone]
    || BUILTIN_TEMPLATES['follow-up'].neutral;

  const body = customBody || renderTemplate(tmplText, {
    clientName: original.clientName,
    topic: original.subject || original.template,
    senderName: original.body.split('\n').pop()?.trim() || 'Freelancer'
  });

  const followUp = {
    id: uid(),
    parentId: messageId,
    clientId: original.clientId,
    clientName: original.clientName,
    channel: original.channel,
    tone,
    body,
    sendAt,
    status: 'scheduled',
    createdAt: now(),
    followUpNumber: original.followUpCount + 1
  };

  // Update parent
  const idx = messages.findIndex(m => m.id === messageId);
  messages[idx].followUpCount = (messages[idx].followUpCount || 0) + 1;
  messages.push(followUp);
  writeJSON(PATHS.messages(), messages);

  // Also store in follow-ups index
  const followups = readJSON(PATHS.followups());
  followups.push({ messageId: followUp.id, parentId: messageId, sendAt, createdAt: now() });
  writeJSON(PATHS.followups(), followups);

  return followUp;
}

/**
 * Record that a client responded to a message.
 */
function trackResponse(opts) {
  const { messageId, clientId, respondedAt = now(), channel = null, notes = '' } = opts;

  if (!messageId && !clientId) throw new Error('messageId or clientId required');

  const responses = readJSON(PATHS.responses());
  const entry = {
    id: uid(),
    messageId: messageId || null,
    clientId: clientId || null,
    respondedAt,
    channel,
    notes,
    createdAt: now()
  };
  responses.push(entry);
  writeJSON(PATHS.responses(), responses);

  // Update message status if messageId provided
  if (messageId) {
    const messages = readJSON(PATHS.messages());
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx >= 0) {
      messages[idx].status = 'responded';
      messages[idx].respondedAt = respondedAt;
      writeJSON(PATHS.messages(), messages);
    }
  }

  // Update timing analytics
  _updateTimingAnalytics(clientId || (messageId && _getClientIdFromMessage(messageId)), respondedAt, messageId);

  return entry;
}

function _getClientIdFromMessage(messageId) {
  const messages = readJSON(PATHS.messages());
  const msg = messages.find(m => m.id === messageId);
  return msg ? msg.clientId : null;
}

function _updateTimingAnalytics(clientId, respondedAt, messageId) {
  if (!clientId) return;

  const timing = readJSON(PATHS.timing(), {});
  if (!timing[clientId]) timing[clientId] = { responseTimes: [], responseHours: [] };

  // Record response hour
  const hour = new Date(respondedAt).getUTCHours();
  timing[clientId].responseHours.push(hour);

  // Record response latency if we can find the original send time
  if (messageId) {
    const messages = readJSON(PATHS.messages());
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.sendAt) {
      const latencyMs = new Date(respondedAt).getTime() - new Date(msg.sendAt).getTime();
      timing[clientId].responseTimes.push(latencyMs);
    }
  }

  writeJSON(PATHS.timing(), timing);
}

/**
 * Analyze a client's response timing patterns.
 */
function analyzeClientTiming(clientId) {
  if (!clientId) return { bestHour: null, avgResponseTimeMs: null, responseCount: 0 };

  const timing = readJSON(PATHS.timing(), {});
  const data = timing[clientId];
  if (!data || !data.responseHours || data.responseHours.length === 0) {
    return { bestHour: null, avgResponseTimeMs: null, responseCount: 0 };
  }

  // Most common response hour
  const hourCounts = {};
  for (const h of data.responseHours) {
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  const bestHour = parseInt(
    Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0],
    10
  );

  // Average response time
  const avgResponseTimeMs = data.responseTimes.length > 0
    ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
    : null;

  return {
    bestHour,
    avgResponseTimeMs,
    avgResponseTimeHuman: avgResponseTimeMs ? humanDuration(avgResponseTimeMs) : null,
    responseCount: data.responseHours.length,
    hourDistribution: hourCounts
  };
}

function humanDuration(ms) {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/**
 * Get re-engagement suggestions for clients who haven't responded in a while.
 */
function getReEngagementSuggestion(opts = {}) {
  const { thresholdDays = 14, senderName = 'Freelancer' } = opts;
  const messages = readJSON(PATHS.messages());
  const thresholdMs = thresholdDays * 86_400_000;
  const nowMs = Date.now();

  // Group messages by client, find last activity
  const clientLast = {};
  for (const msg of messages) {
    const ts = msg.respondedAt || msg.sendAt || msg.createdAt;
    const t = new Date(ts).getTime();
    if (!clientLast[msg.clientId] || t > clientLast[msg.clientId].time) {
      clientLast[msg.clientId] = { time: t, clientName: msg.clientName, tone: msg.tone };
    }
  }

  const suggestions = [];
  for (const [clientId, info] of Object.entries(clientLast)) {
    const silenceDays = Math.floor((nowMs - info.time) / 86_400_000);
    if (silenceDays >= thresholdDays) {
      const tone = info.tone || 'neutral';
      const tmplText = BUILTIN_TEMPLATES['re-engagement'][tone]
        || BUILTIN_TEMPLATES['re-engagement'].neutral;
      const body = renderTemplate(tmplText, {
        clientName: info.clientName || clientId,
        senderName
      });
      suggestions.push({
        clientId,
        clientName: info.clientName,
        silenceDays,
        suggestedMessage: body,
        tone
      });
    }
  }

  return suggestions.sort((a, b) => b.silenceDays - a.silenceDays);
}

/**
 * Send a batch status update to multiple clients.
 */
function batchUpdate(opts) {
  const {
    clientIds = [],
    template = 'status-update',
    channel = 'email',
    variables = {},
    urgency = 'normal',
    senderName = 'Freelancer'
  } = opts;

  if (!clientIds.length) throw new Error('clientIds array is required');

  const results = [];
  for (const clientId of clientIds) {
    const clientVars = typeof variables === 'function' ? variables(clientId) : variables;
    const msg = scheduleMessage({
      clientId,
      clientName: clientVars.clientName || clientId,
      template,
      channel,
      variables: clientVars,
      urgency,
      senderName
    });
    results.push(msg);
  }

  return { sent: results.length, messages: results };
}

/**
 * Get all pending (scheduled) messages, optionally filtered.
 */
function getPendingMessages(opts = {}) {
  const { clientId = null, before = null } = opts;
  let messages = readJSON(PATHS.messages()).filter(m => m.status === 'scheduled');
  if (clientId) messages = messages.filter(m => m.clientId === clientId);
  if (before) messages = messages.filter(m => new Date(m.sendAt) <= new Date(before));
  return messages.sort((a, b) => new Date(a.sendAt) - new Date(b.sendAt));
}

/**
 * Get communication analytics summary.
 */
function getAnalytics() {
  const messages = readJSON(PATHS.messages());
  const responses = readJSON(PATHS.responses());

  const totalSent = messages.filter(m => m.status !== 'scheduled').length;
  const totalScheduled = messages.filter(m => m.status === 'scheduled').length;
  const totalResponded = messages.filter(m => m.status === 'responded').length;
  const responseRate = totalSent > 0 ? ((totalResponded / totalSent) * 100).toFixed(1) : '0.0';

  // Per-client breakdown
  const byClient = {};
  for (const msg of messages) {
    if (!byClient[msg.clientId]) {
      byClient[msg.clientId] = { name: msg.clientName, sent: 0, responded: 0, scheduled: 0 };
    }
    if (msg.status === 'scheduled') byClient[msg.clientId].scheduled++;
    else byClient[msg.clientId].sent++;
    if (msg.status === 'responded') byClient[msg.clientId].responded++;
  }

  // Per-channel breakdown
  const byChannel = {};
  for (const msg of messages) {
    const ch = msg.channel || 'unknown';
    if (!byChannel[ch]) byChannel[ch] = { sent: 0, responded: 0 };
    byChannel[ch].sent++;
    if (msg.status === 'responded') byChannel[ch].responded++;
  }

  return {
    totalMessages: messages.length,
    totalSent,
    totalScheduled,
    totalResponded,
    responseRate: `${responseRate}%`,
    totalResponses: responses.length,
    byClient,
    byChannel
  };
}

// ─── Auto Follow-up Scheduler ───────────────────────────────────────────────

/**
 * Check for messages needing auto follow-ups and generate them.
 * Typically called from a cron/heartbeat.
 */
function processAutoFollowUps(opts = {}) {
  const { defaultInterval = '3d', maxFollowUps = 3 } = opts;
  const messages = readJSON(PATHS.messages());
  const nowMs = Date.now();
  const intervalMs = (() => {
    const match = defaultInterval.match(/^(\d+)(d|h|w)$/i);
    if (!match) return 3 * 86_400_000;
    const n = parseInt(match[1], 10);
    const mult = { d: 86_400_000, h: 3_600_000, w: 604_800_000 };
    return n * (mult[match[2].toLowerCase()] || 86_400_000);
  })();

  const generated = [];
  for (const msg of messages) {
    if (msg.status !== 'scheduled' && msg.status !== 'responded') continue;
    if (msg.status === 'responded') continue;
    if ((msg.followUpCount || 0) >= maxFollowUps) continue;
    if (msg.parentId) continue; // don't follow up on follow-ups

    const sentTime = new Date(msg.sendAt).getTime();
    if (nowMs - sentTime < intervalMs) continue;

    // Check if there\'s already a pending follow-up
    const hasPending = messages.some(m => m.parentId === msg.id && m.status === 'scheduled');
    if (hasPending) continue;

    try {
      const fu = generateFollowUp({ messageId: msg.id, interval: defaultInterval, maxFollowUps });
      if (!fu.skipped) generated.push(fu);
    } catch {
      // skip errors
    }
  }

  return { generated: generated.length, followUps: generated };
}

// ─── CLI Handler ────────────────────────────────────────────────────────────

function parseCliArgs(args) {
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(args[i]);
    }
  }
  return parsed;
}

async function handleCLI(args) {
  const parsed = parseCliArgs(args);
  const command = parsed._[0];

  switch (command) {
    case 'schedule': {
      const msg = scheduleMessage({
        clientId: parsed.client || parsed['client-id'],
        clientName: parsed.name || parsed.client,
        template: parsed.template || 'status-update',
        channel: parsed.channel || 'email',
        tone: parsed.tone,
        urgency: parsed.urgency || 'normal',
        clientTimezone: parsed.timezone || '+00:00',
        senderName: parsed.sender || 'Freelancer',
        variables: parsed.vars ? JSON.parse(parsed.vars) : {},
        sendAt: parsed['send-at'] || null
      });
      return msg;
    }

    case 'followup': {
      const fu = generateFollowUp({
        messageId: parsed.message || parsed['message-id'],
        interval: parsed.interval || '3d',
        maxFollowUps: parseInt(parsed['max-followups'] || '3', 10)
      });
      return fu;
    }

    case 'track': {
      const resp = trackResponse({
        messageId: parsed.message || parsed['message-id'],
        clientId: parsed.client || parsed['client-id'],
        notes: parsed.notes || ''
      });
      return resp;
    }

    case 'batch': {
      const clients = (parsed.clients || '').split(',').filter(Boolean);
      const result = batchUpdate({
        clientIds: clients,
        template: parsed.template || 'status-update',
        channel: parsed.channel || 'email',
        urgency: parsed.urgency || 'normal',
        senderName: parsed.sender || 'Freelancer',
        variables: parsed.vars ? JSON.parse(parsed.vars) : {}
      });
      return result;
    }

    case 'analytics': {
      if (parsed.client) {
        return analyzeClientTiming(parsed.client);
      }
      return getAnalytics();
    }

    case 'pending': {
      return getPendingMessages({ clientId: parsed.client || null });
    }

    case 'reminders':
    case 're-engage': {
      return getReEngagementSuggestion({
        thresholdDays: parseInt(parsed.days || '14', 10),
        senderName: parsed.sender || 'Freelancer'
      });
    }

    case 'auto-followup': {
      return processAutoFollowUps({
        defaultInterval: parsed.interval || '3d',
        maxFollowUps: parseInt(parsed['max-followups'] || '3', 10)
      });
    }

    case 'help':
    default:
      return {
        usage: 'cortex comm <command> [options]',
        commands: {
          schedule: 'Schedule a message — --client <id> --template <name> --channel <ch> [--tone <tone>] [--urgency <lvl>] [--timezone <tz>] [--sender <name>] [--vars <json>]',
          followup: 'Generate follow-up — --message <id> [--interval 3d] [--max-followups 3]',
          track: 'Track a response — --message <id> or --client <id> [--notes <text>]',
          batch: 'Batch update — --clients <id1,id2,...> --template <name> [--channel <ch>] [--vars <json>]',
          analytics: 'View analytics — [--client <id>]',
          pending: 'List pending messages — [--client <id>]',
          reminders: 'Get re-engagement suggestions — [--days 14] [--sender <name>]',
          'auto-followup': 'Process auto follow-ups — [--interval 3d] [--max-followups 3]'
        },
        templates: Object.keys(BUILTIN_TEMPLATES),
        channels: ['email', 'slack', 'formal-letter'],
        tones: ['formal', 'casual', 'technical', 'neutral']
      };
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Core API
  scheduleMessage,
  generateFollowUp,
  trackResponse,
  getReEngagementSuggestion,
  batchUpdate,
  analyzeClientTiming,

  // Additional API
  getPendingMessages,
  getAnalytics,
  processAutoFollowUps,
  calculateOptimalTime,
  detectTone,
  formatForChannel,
  renderTemplate,

  // CLI
  handleCLI,

  // Constants (for testing)
  BUILTIN_TEMPLATES,
  DATA_DIR,
  PATHS
};

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  handleCLI(args)
    .then(result => {
      if (result) console.log(JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
