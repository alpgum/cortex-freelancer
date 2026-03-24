/**
 * /api/chat-stream — SSE streaming endpoint for OpenClaw responses
 * Fallback when WebSocket is unavailable (proxy issues, timeouts).
 * Streams token-by-token via Server-Sent Events.
 *
 * CFX-021
 */

const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

// Rate limiting (mirrors ws-bridge + chat.js)
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;

// Session history
const sessionHistory = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_HISTORY = 20;

// Single-threaded lock (OpenClaw CLI is single-threaded)
let busy = false;
const SPAWN_TIMEOUT_MS = 120_000;

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

function buildPrompt(message, session, profile, goals) {
  let prompt = '';
  const profileCtx = buildProfileContext(profile, goals);
  if (profileCtx) prompt += profileCtx + '\n\n';

  const historyMessages = session.messages.slice(0, -1);
  if (historyMessages.length > 0) {
    const contextBlock = historyMessages
      .map(m => '[' + m.role + ']: ' + m.content)
      .join('\n');
    prompt += '<conversation_history>\n' + contextBlock + '\n</conversation_history>\n\n';
  }

  const freelancerContext = 'I need help with my freelance business: ';
  prompt += freelancerContext + message.trim().substring(0, 4000 - freelancerContext.length);
  return prompt;
}

/**
 * Write an SSE event to the response.
 */
function sseWrite(res, event, data) {
  if (res.writableEnded) return;
  res.write('event: ' + event + '\n');
  res.write('data: ' + JSON.stringify(data) + '\n\n');
}

module.exports = function handler(req, res) {
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
  appendToSession(sid, 'user', message.trim());

  const prompt = buildPrompt(message, session, profile, goals);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send stream_start
  sseWrite(res, 'stream_start', { sessionId: sid });

  busy = true;
  let finished = false;
  let stdout = '';
  let chunkIndex = 0;

  const args = [
    'agent',
    '--message', prompt,
    '--session-id', sid,
    '--json',
    '--local'
  ];

  const proc = spawn('openclaw', args, { env: { ...process.env } });

  // Manual timeout
  const killTimer = setTimeout(() => {
    if (!finished) {
      console.warn('[chat-stream] openclaw timed out, killing');
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 5000);
      finish('error', { error: 'Request timed out.' });
    }
  }, SPAWN_TIMEOUT_MS);

  function finish(event, data) {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);
    busy = false;
    sseWrite(res, event, data);
    sseWrite(res, 'done', {});
    res.end();
  }

  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    if (!finished) {
      sseWrite(res, 'stream_chunk', { chunk, index: chunkIndex++ });
    }
  });

  proc.stderr.on('data', (data) => {
    // Log but don't send to client
    console.error('[chat-stream stderr]', data.toString());
  });

  proc.on('close', (code) => {
    if (finished) return;

    if (code !== 0 && !stdout.trim()) {
      finish('error', { error: 'Cortex is temporarily unavailable.' });
      return;
    }

    // Parse final response
    let text = 'No response from Cortex.';
    let meta = {};
    try {
      const jsonStart = stdout.indexOf('{');
      if (jsonStart !== -1) {
        const parsed = JSON.parse(stdout.slice(jsonStart));
        const responseText = (parsed.payloads || [])
          .map(p => p.text)
          .filter(Boolean)
          .join('\n\n');
        text = responseText || text;
        meta = {
          model: parsed.meta?.agentMeta?.model,
          durationMs: parsed.meta?.durationMs
        };
      } else {
        text = stdout.trim() || text;
      }
    } catch (e) {
      text = stdout.trim() || text;
    }

    appendToSession(sid, 'assistant', text);
    finish('stream_end', { reply: text, sessionId: sid, meta });
  });

  proc.on('error', (err) => {
    console.error('[chat-stream] spawn error:', err.message);
    finish('error', { error: 'Cortex is temporarily unavailable.' });
  });

  // Client disconnect — kill the process
  req.on('close', () => {
    if (!finished) {
      console.log('[chat-stream] Client disconnected, killing openclaw');
      finished = true;
      clearTimeout(killTimer);
      busy = false;
      try { proc.kill('SIGTERM'); } catch (_) {}
    }
  });
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
