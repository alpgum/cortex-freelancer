/**
 * T04: /api/chat — Cortex AI Chat Endpoint
 * Mode 1 (Direct): Anthropic API → claude-sonnet
 * Mode 2 (Bridge): OpenClaw sessions_spawn via bridge server
 */

// In-memory rate limit (resets on cold start — fine for MVP)
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 min
const RATE_MAX = 20; // per window per IP

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

// System prompt builder (server-side duplicate of client logic)
function buildSystemPrompt(profile, goals) {
  const lines = [
    'You are Cortex, a freelancer AI business manager.',
    'You help freelancers with: proposals, emails, job analysis, rate advice, and career strategy.',
    '',
    'Rules:',
    '- Short, action-oriented answers (max 3 paragraphs unless more detail needed)',
    "- Match the user's language (Turkish → Turkish, English → English)",
    '- Always give concrete output (proposal text, email draft, analysis)',
    '- Use profile data to personalize',
    '- For non-freelancing: politely redirect',
    '- Use emoji sparingly, bullet points for structure',
    '',
    'Tone: Professional but friendly. Senior freelancer friend.',
  ];

  if (profile && !profile._skipped) {
    lines.push('', 'User profile:');
    if (profile.name) lines.push('- Name: ' + profile.name);
    if (profile.title) lines.push('- Title: ' + profile.title);
    if (profile.hourlyRate) lines.push('- Rate: $' + profile.hourlyRate + '/hr');
    if (profile.skills && profile.skills.length) lines.push('- Skills: ' + profile.skills.slice(0, 15).join(', '));
    if (profile.jobSuccessScore) lines.push('- JSS: ' + profile.jobSuccessScore + '%');
    if (profile.totalEarnings) lines.push('- Earned: $' + profile.totalEarnings);
    if (profile.country) lines.push('- Country: ' + profile.country);
  }

  if (goals) {
    if (goals.incomeGoal) lines.push('- Income goal: $' + goals.incomeGoal + '/mo');
    if (goals.taxCountry) lines.push('- Tax country: ' + goals.taxCountry);
    if (goals.workType) lines.push('- Work preference: ' + goals.workType);
  }

  return lines.join('\n');
}

export default async function handler(req, res) {
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

  const { message, sessionId, profile, goals, history } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sid = sessionId || crypto.randomUUID();
  const bridgeUrl = process.env.OPENCLAW_BRIDGE_URL;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Mode 2: OpenClaw Bridge
  if (bridgeUrl) {
    try {
      const bridgeRes = await fetch(bridgeUrl + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), sessionId: sid, profile, goals, history }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await bridgeRes.json();
      return res.status(200).json({ reply: data.reply || data.message || 'No response', sessionId: sid });
    } catch (e) {
      console.error('Bridge error, falling back to direct:', e.message);
      // Fall through to direct mode
    }
  }

  // Mode 1: Anthropic Direct
  if (!anthropicKey) {
    return res.status(200).json({
      reply: "👋 Cortex AI is being set up! In the meantime, I can help with proposals, emails, job analysis, and rate advice. Check back soon for full AI responses!",
      sessionId: sid,
      _demo: true,
    });
  }

  try {
    const systemPrompt = buildSystemPrompt(profile, goals);

    // Build messages array
    const messages = [];
    if (history && Array.isArray(history)) {
      history.slice(-10).forEach(function (m) {
        if (m.role === 'user' || m.role === 'assistant') {
          messages.push({ role: m.role, content: String(m.content).substring(0, 2000) });
        }
      });
    }
    messages.push({ role: 'user', content: message.trim().substring(0, 4000) });

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      return res.status(200).json({
        reply: "I'm having trouble connecting right now. Please try again in a moment! 🔄",
        sessionId: sid,
        _error: true,
      });
    }

    const data = await apiRes.json();
    const reply = data.content && data.content[0] && data.content[0].text
      ? data.content[0].text
      : "I couldn't generate a response. Please try again.";

    return res.status(200).json({ reply, sessionId: sid });
  } catch (e) {
    console.error('Chat API error:', e);
    return res.status(200).json({
      reply: "Something went wrong. Please try again! 🔄",
      sessionId: sid,
      _error: true,
    });
  }
}
