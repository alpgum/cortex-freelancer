/**
 * /api/chat — Cortex AI Chat via OpenClaw CLI
 * Executes openclaw agent with cortex-freelancer skill context.
 * No direct Anthropic API — all intelligence via OpenClaw.
 */

const { execFile } = require('child_process');
const { randomUUID } = require('crypto');

// In-memory rate limit (resets on cold start)
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;

// In-memory session history for conversation context
const sessionHistory = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_HISTORY = 20;

function getRateLimitKey(req) {
  return (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

function checkRateLimit(key) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  return entry.count <= RATE_MAX;
}

function getOrCreateSession(sid) {
  if (sessionHistory.has(sid)) {
    const s = sessionHistory.get(sid);
    if (Date.now() - s.lastActivity < SESSION_TIMEOUT_MS) {
      s.lastActivity = Date.now();
      return s;
    }
    sessionHistory.delete(sid);
  }
  const s = { messages: [], lastActivity: Date.now() };
  sessionHistory.set(sid, s);
  return s;
}

function appendToSession(sid, role, content) {
  const s = sessionHistory.get(sid);
  if (!s) return;
  s.messages.push({ role, content });
  if (s.messages.length > MAX_HISTORY) {
    s.messages = s.messages.slice(-MAX_HISTORY);
  }
  s.lastActivity = Date.now();
}

function buildProfileContext(profile, goals) {
  const lines = [];
  if (profile && !profile._skipped) {
    lines.push('<user_profile>');
    if (profile.name) lines.push('Name: ' + profile.name);
    if (profile.title) lines.push('Title: ' + profile.title);
    if (profile.hourlyRate) lines.push('Rate: $' + profile.hourlyRate + '/hr');
    if (profile.skills && profile.skills.length) lines.push('Skills: ' + profile.skills.slice(0, 15).join(', '));
    if (profile.jobSuccessScore) lines.push('JSS: ' + profile.jobSuccessScore + '%');
    if (profile.totalEarnings) lines.push('Earned: $' + profile.totalEarnings);
    if (profile.country) lines.push('Country: ' + profile.country);
    lines.push('</user_profile>');
  }
  if (goals) {
    lines.push('<user_goals>');
    if (goals.incomeGoal) lines.push('Income goal: $' + goals.incomeGoal + '/mo');
    if (goals.taxCountry) lines.push('Tax country: ' + goals.taxCountry);
    if (goals.workType) lines.push('Work preference: ' + goals.workType);
    lines.push('</user_goals>');
  }
  return lines.length > 0 ? lines.join('\n') : '';
}

function runOpenClaw(prompt, sessionId) {
  return new Promise((resolve, reject) => {
    const args = [
      'agent',
      '--message', prompt,
      '--session-id', sessionId,
      '--json',
      '--local'
    ];

    execFile('openclaw', args, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[openclaw error]', err.message);
        return reject(err);
      }

      try {
        // stdout may have warnings before JSON — find the JSON block
        const jsonStart = stdout.indexOf('{');
        if (jsonStart === -1) {
          // No JSON — return raw text
          resolve({ text: stdout.trim() || 'No response from Cortex.', meta: {} });
          return;
        }
        const parsed = JSON.parse(stdout.slice(jsonStart));
        const responseText = (parsed.payloads || [])
          .map(p => p.text)
          .filter(Boolean)
          .join('\n\n');

        resolve({
          text: responseText || 'No response from Cortex.',
          meta: {
            model: parsed.meta?.agentMeta?.model,
            durationMs: parsed.meta?.durationMs
          }
        });
      } catch (parseErr) {
        // JSON parse failed — return raw output
        console.error('[parse warning]', parseErr.message);
        resolve({ text: stdout.trim() || 'No response from Cortex.', meta: {} });
      }
    });
  });
}

// Prevent concurrent openclaw calls (CLI is single-threaded)
let busy = false;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Rate limit
  const rlKey = getRateLimitKey(req);
  if (!checkRateLimit(rlKey)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a few minutes.', retryAfter: 60 });
  }

  if (busy) {
    return res.status(429).json({ error: 'Cortex is processing another request. Please wait a moment.', retryAfter: 5 });
  }

  const { message, sessionId, profile, goals } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sid = sessionId || 'ctx-' + randomUUID().slice(0, 8);
  const session = getOrCreateSession(sid);

  // Store user message
  appendToSession(sid, 'user', message.trim());

  // Build prompt with profile context + conversation history
  const profileCtx = buildProfileContext(profile, goals);
  const historyMessages = session.messages.slice(0, -1); // exclude current msg

  let prompt = '';

  if (profileCtx) {
    prompt += profileCtx + '\n\n';
  }

  if (historyMessages.length > 0) {
    const contextBlock = historyMessages
      .map(m => '[' + m.role + ']: ' + m.content)
      .join('\n');
    prompt += '<conversation_history>\n' + contextBlock + '\n</conversation_history>\n\n';
  }

  prompt += message.trim().substring(0, 4000);

  busy = true;
  try {
    const result = await runOpenClaw(prompt, sid);

    // Store assistant response
    appendToSession(sid, 'assistant', result.text);

    busy = false;
    return res.status(200).json({
      reply: result.text,
      sessionId: sid,
      meta: result.meta
    });
  } catch (e) {
    busy = false;
    console.error('OpenClaw failed:', e.message);
    return res.status(200).json({
      reply: 'Cortex is temporarily unavailable. Please try again in a moment.',
      sessionId: sid,
      _error: true
    });
  }
};

// Cleanup expired sessions every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [sid, s] of sessionHistory) {
    if (now - s.lastActivity >= SESSION_TIMEOUT_MS) {
      sessionHistory.delete(sid);
    }
  }
}, 5 * 60 * 1000).unref();
