/**
 * /api/chat-poll — Long Polling Fallback Endpoint (CFX-022)
 *
 * Final tier in progressive degradation: WebSocket → SSE → Long Polling.
 * Designed for restrictive networks that block persistent connections.
 *
 * Endpoints:
 *   POST /api/chat-poll           — Submit message or poll for updates
 *   Body: { action: "send"|"poll"|"ack", message?, sessionId?, pollId?, profile?, goals? }
 *
 * Flow:
 *   1. Client sends { action: "send", message, sessionId } → gets { pollId, status: "processing" }
 *   2. Client polls  { action: "poll", pollId, sessionId } → hangs up to 25s, returns chunks or final
 *   3. Client acks   { action: "ack",  pollId, sessionId } → cleanup
 */

const { randomUUID } = require('crypto');

// ── Configuration ──
const POLL_TIMEOUT_MS     = 25_000;   // Max long-poll hang time (below most proxy 30s limits)
const POLL_CHECK_MS       = 200;      // Internal check interval
const RESPONSE_TTL_MS     = 5 * 60_000; // Keep completed responses for 5 min
const SESSION_TTL_MS      = 24 * 60 * 60_000; // CFX-041: default 24h
const MAX_HISTORY         = 20;
const RATE_WINDOW_MS      = 5 * 60_000;
const RATE_MAX            = 20;
const SPAWN_TIMEOUT_MS    = 120_000;
const MAX_PENDING_POLLS   = 50;       // Global limit on pending poll responses

// ── State ──
const pendingResponses = new Map();   // pollId → { status, chunks[], finalText, createdAt, sessionId }
const { createServerSessionStore } = require('../src/session/server-session-store');
const sessionStore = global.__cfx041SessionStore || (global.__cfx041SessionStore = createServerSessionStore({
  timeoutMs: process.env.CORTEX_SESSION_TIMEOUT_MS ? Number(process.env.CORTEX_SESSION_TIMEOUT_MS) : SESSION_TTL_MS,
  maxHistory: MAX_HISTORY,
}));
const rateLimitMap     = new Map();

// Processing lock (single-threaded like other endpoints)
let busy = false;
const processingQueue = [];

// ── Helpers ──

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
  return sessionStore.getOrCreate(sid);
}

function appendToSession(sid, role, content) {
  sessionStore.append(sid, role, content);
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

// ── Process message (spawn openclaw or use Anthropic SDK) ──

function processMessage(pollId, prompt, sid) {
  const entry = pendingResponses.get(pollId);
  if (!entry) return;

  // Determine if Railway mode (Anthropic SDK) or local mode (OpenClaw CLI)
  const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.ANTHROPIC_API_KEY);

  if (isRailway) {
    processWithAnthropic(pollId, prompt, sid, entry);
  } else {
    processWithCLI(pollId, prompt, sid, entry);
  }
}

function processWithAnthropic(pollId, prompt, sid, entry) {
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch (e) {
    entry.status = 'error';
    entry.error = 'AI service unavailable.';
    busy = false;
    drainQueue();
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = `You are Cortex, an AI business manager for freelancers. You help freelancers with:
- Rate optimization and pricing strategy
- Proposal writing and job analysis
- Client communication and red flag detection
- Revenue forecasting and income tracking
- Contract review and negotiation
- Portfolio review and professional branding
- Tax planning and business operations

You are knowledgeable about platforms like Upwork, Fiverr, and direct client work.
Be practical, actionable, and supportive. Give specific advice, not generic platitudes.
Keep responses concise but thorough. Use bullet points and structure when helpful.`;

  const abortController = new AbortController();
  entry._abort = abortController;

  const timeout = setTimeout(() => {
    abortController.abort();
    if (entry.status === 'processing') {
      entry.status = 'error';
      entry.error = 'Request timed out.';
      busy = false;
      drainQueue();
    }
  }, SPAWN_TIMEOUT_MS);

  client.messages.stream({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  }).on('text', (text) => {
    if (entry.status !== 'processing') return;
    entry.chunks.push(text);
    entry.fullText += text;
  }).on('end', () => {
    clearTimeout(timeout);
    if (entry.status === 'processing') {
      entry.status = 'complete';
      appendToSession(sid, 'assistant', entry.fullText);
    }
    busy = false;
    drainQueue();
  }).on('error', (err) => {
    clearTimeout(timeout);
    console.error('[chat-poll] Anthropic error:', err.message);
    if (entry.status === 'processing') {
      entry.status = 'error';
      entry.error = err.status === 529 ? 'AI service is busy. Try again shortly.'
        : err.status === 429 ? 'Rate limit reached. Please wait.'
        : 'AI service temporarily unavailable.';
    }
    busy = false;
    drainQueue();
  });
}

function processWithCLI(pollId, prompt, sid, entry) {
  const { spawn } = require('child_process');

  const args = ['agent', '--message', prompt, '--session-id', sid, '--json', '--local'];
  const proc = spawn('openclaw', args, { env: { ...process.env } });

  let stdout = '';
  let finished = false;

  const killTimer = setTimeout(() => {
    if (!finished) {
      console.warn('[chat-poll] openclaw timed out, killing');
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 5000);
      entry.status = 'error';
      entry.error = 'Request timed out.';
      finished = true;
      busy = false;
      drainQueue();
    }
  }, SPAWN_TIMEOUT_MS);

  entry._kill = () => {
    if (!finished) {
      finished = true;
      clearTimeout(killTimer);
      try { proc.kill('SIGTERM'); } catch (_) {}
    }
  };

  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    entry.chunks.push(chunk);
  });

  proc.stderr.on('data', (data) => {
    console.error('[chat-poll stderr]', data.toString());
  });

  proc.on('close', (code) => {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);

    if (code !== 0 && !stdout.trim()) {
      entry.status = 'error';
      entry.error = 'Cortex is temporarily unavailable.';
    } else {
      let text = 'No response from Cortex.';
      try {
        const jsonStart = stdout.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(stdout.slice(jsonStart));
          const responseText = (parsed.payloads || [])
            .map(p => p.text)
            .filter(Boolean)
            .join('\n\n');
          text = responseText || text;
          entry.meta = {
            model: parsed.meta?.agentMeta?.model,
            durationMs: parsed.meta?.durationMs,
          };
        } else {
          text = stdout.trim() || text;
        }
      } catch (e) {
        text = stdout.trim() || text;
      }
      entry.fullText = text;
      entry.status = 'complete';
      appendToSession(sid, 'assistant', text);
    }

    busy = false;
    drainQueue();
  });

  proc.on('error', (err) => {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);
    console.error('[chat-poll] spawn error:', err.message);
    entry.status = 'error';
    entry.error = 'Cortex is temporarily unavailable.';
    busy = false;
    drainQueue();
  });
}

// ── Queue management ──

function drainQueue() {
  if (busy || processingQueue.length === 0) return;
  const next = processingQueue.shift();
  busy = true;
  processMessage(next.pollId, next.prompt, next.sid);
}

// ── Actions ──

function handleSend(req, res) {
  const rlKey = getRateLimitKey(req);
  if (!checkRateLimit(rlKey)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Try again in a few minutes.',
      retryAfter: 60,
    });
  }

  if (pendingResponses.size >= MAX_PENDING_POLLS) {
    return res.status(503).json({
      error: 'Server is busy. Please try again shortly.',
      retryAfter: 10,
    });
  }

  const { message, sessionId, profile, goals } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'Message too long. Keep under 4000 characters.' });
  }

  const sid = sessionId || 'poll-' + randomUUID().slice(0, 8);
  const session = getOrCreateSession(sid);
  appendToSession(sid, 'user', message.trim());

  const prompt = buildPrompt(message, session, profile, goals);
  const pollId = 'p-' + randomUUID().slice(0, 12);

  pendingResponses.set(pollId, {
    status: 'processing',
    chunks: [],
    fullText: '',
    error: null,
    meta: {},
    createdAt: Date.now(),
    lastPollAt: Date.now(),
    chunkCursor: 0,  // Track which chunks client has seen
    sessionId: sid,
  });

  if (busy) {
    processingQueue.push({ pollId, prompt, sid });
    return res.json({
      pollId,
      sessionId: sid,
      status: 'queued',
      position: processingQueue.length,
      retryAfter: 2,
    });
  }

  busy = true;
  processMessage(pollId, prompt, sid);

  return res.json({
    pollId,
    sessionId: sid,
    status: 'processing',
    retryAfter: 1,
  });
}

function handlePoll(req, res) {
  const { pollId, sessionId } = req.body || {};
  if (!pollId) {
    return res.status(400).json({ error: 'pollId is required' });
  }

  const entry = pendingResponses.get(pollId);
  if (!entry) {
    return res.status(404).json({ error: 'Poll not found or expired', code: 'POLL_EXPIRED' });
  }

  // Security: validate session ownership
  if (sessionId && entry.sessionId !== sessionId) {
    return res.status(403).json({ error: 'Session mismatch' });
  }

  entry.lastPollAt = Date.now();

  // If already complete or errored, return immediately
  if (entry.status === 'complete') {
    const newChunks = entry.chunks.slice(entry.chunkCursor);
    entry.chunkCursor = entry.chunks.length;
    return res.json({
      status: 'complete',
      chunks: newChunks,
      fullText: entry.fullText,
      meta: entry.meta,
      pollId,
    });
  }

  if (entry.status === 'error') {
    return res.json({
      status: 'error',
      error: entry.error,
      pollId,
    });
  }

  if (entry.status === 'queued') {
    const pos = processingQueue.findIndex(q => q.pollId === pollId);
    return res.json({
      status: 'queued',
      position: pos + 1,
      pollId,
      retryAfter: 2,
    });
  }

  // Long poll: hang until we have new chunks or timeout
  const startTime = Date.now();
  const startCursor = entry.chunkCursor;

  const interval = setInterval(() => {
    // Check for new data
    if (entry.chunks.length > startCursor || entry.status !== 'processing') {
      clearInterval(interval);
      const newChunks = entry.chunks.slice(entry.chunkCursor);
      entry.chunkCursor = entry.chunks.length;

      return res.json({
        status: entry.status,
        chunks: newChunks,
        fullText: entry.status === 'complete' ? entry.fullText : undefined,
        error: entry.status === 'error' ? entry.error : undefined,
        meta: entry.status === 'complete' ? entry.meta : undefined,
        pollId,
      });
    }

    // Timeout — return empty with retry hint
    if (Date.now() - startTime >= POLL_TIMEOUT_MS) {
      clearInterval(interval);
      return res.json({
        status: 'processing',
        chunks: [],
        pollId,
        retryAfter: 1,
      });
    }
  }, POLL_CHECK_MS);

  // Client disconnect cleanup
  req.on('close', () => {
    clearInterval(interval);
  });
}

function handleAck(req, res) {
  const { pollId } = req.body || {};
  if (!pollId) {
    return res.status(400).json({ error: 'pollId is required' });
  }

  const entry = pendingResponses.get(pollId);
  if (entry) {
    // Kill any running process
    if (entry._kill) entry._kill();
    if (entry._abort) entry._abort.abort();
    pendingResponses.delete(pollId);
  }

  return res.json({ ok: true });
}

// ── Main handler ──

module.exports = function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action } = req.body || {};

  switch (action) {
    case 'send': return handleSend(req, res);
    case 'poll': return handlePoll(req, res);
    case 'ack':  return handleAck(req, res);
    default:
      return res.status(400).json({
        error: 'Invalid action. Use "send", "poll", or "ack".',
      });
  }
};

// ── Cleanup expired entries ──
setInterval(() => {
  const now = Date.now();

  // Cleanup completed/errored responses older than TTL
  for (const [pollId, entry] of pendingResponses) {
    const age = now - entry.createdAt;
    if (entry.status === 'complete' || entry.status === 'error') {
      if (age > RESPONSE_TTL_MS) {
        pendingResponses.delete(pollId);
      }
    } else if (age > SPAWN_TIMEOUT_MS + 30_000) {
      // Stuck processing entries
      console.warn('[chat-poll] Cleaning stuck entry:', pollId);
      if (entry._kill) entry._kill();
      if (entry._abort) entry._abort.abort();
      pendingResponses.delete(pollId);
    }
  }

  // Cleanup expired sessions (CFX-041)
  try { sessionStore.cleanup(); } catch (_e) {}

  // Cleanup stale rate limit entries
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > RATE_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000).unref();

// ── Exports for testing ──
module.exports.POLL_TIMEOUT_MS = POLL_TIMEOUT_MS;
module.exports.MAX_PENDING_POLLS = MAX_PENDING_POLLS;
