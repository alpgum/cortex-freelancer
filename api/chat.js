/**
 * /api/chat — Cortex AI Chat (Simplified)
 * Uses OpenRouter API for Claude models when OPENROUTER_API_KEY is available.
 * Falls back to error message when no API key is configured.
 */

// System Prompt
const SYSTEM_PROMPT = `You are Cortex, an AI business manager for freelancers. You help freelancers with:
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

// Rate limiting
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_MAX = 20;

// Session history for conversation context
const sessionHistory = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
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

// OpenRouter API call
async function callOpenRouter(prompt) {
  const axios = require('axios');
  
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.ANTHROPIC_MODEL || 'anthropic/claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    },
    {
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://cortexfreelancer.com',
        'X-Title': 'Cortex Freelancer'
      },
      timeout: 30000
    }
  );

  const text = response.data.choices?.[0]?.message?.content || 'No response from Cortex.';
  return {
    text,
    meta: { model: response.data.model, usage: response.data.usage }
  };
}

// Prevent concurrent requests
let busy = false;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit
  const rlKey = getRateLimitKey(req);
  if (!checkRateLimit(rlKey)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a few minutes.' });
  }

  if (busy) {
    return res.status(429).json({ error: 'Cortex is processing another request. Please wait a moment.' });
  }

  const { message, sessionId } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ 
      error: 'Chat service is temporarily unavailable. API key not configured.',
      reply: 'Cortex is temporarily unavailable. Please try again in a moment.',
      sessionId: sessionId || 'error',
      _error: true
    });
  }

  const sid = sessionId || 'ctx-' + Date.now();
  const session = getOrCreateSession(sid);

  // Store user message
  appendToSession(sid, 'user', message.trim());

  // Build prompt with conversation history
  const historyMessages = session.messages.slice(0, -1); // exclude current msg
  let prompt = '';

  if (historyMessages.length > 0) {
    const contextBlock = historyMessages
      .map(m => '[' + m.role + ']: ' + m.content)
      .join('\n');
    prompt += '<conversation_history>\n' + contextBlock + '\n</conversation_history>\n\n';
  }

  prompt += message.trim().substring(0, 4000);

  busy = true;
  try {
    const result = await callOpenRouter(prompt);
    
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
    console.error('Chat failed:', e.message || e);

    if (e.response?.status === 429) {
      return res.status(429).json({
        reply: 'Cortex is receiving too many requests. Please wait a moment and try again.',
        sessionId: sid,
        _error: true
      });
    }

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