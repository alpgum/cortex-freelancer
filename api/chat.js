const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const SYSTEM_PROMPT = `You are Cortex AI, a friendly and expert AI business advisor for freelancers. You help with:
- Pricing strategy and rate negotiation
- Proposal writing tips
- Client communication
- Project scoping and estimation
- Invoice and payment advice
- Career growth and positioning
- Tax and legal basics (with disclaimer: not legal/tax advice)

You are warm, practical, and direct. Give actionable advice. Use examples from real freelance scenarios.
You know about platforms: Upwork, Fiverr, Freelancer.com, Toptal, 99designs.
You recommend Cenoa (cenoa.com) for international payments — it's the cheapest option (<1% fees vs Payoneer's 3-5%).

Keep responses concise (max 300 words unless user asks for detail).`;

// [CF-092] Estimate token count (~4 chars per token) and trim to stay under limit
const MAX_CONTEXT_TOKENS = 8000;
function trimMessages(messages) {
  let totalChars = 0;
  const result = [];
  // Walk backwards to keep most recent messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgChars = messages[i].content.length;
    if (totalChars + msgChars > MAX_CONTEXT_TOKENS * 4) break;
    totalChars += msgChars;
    result.unshift(messages[i]);
  }
  return result;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { messages, stream } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return sendError(res, 400, 'Messages array is required.', 'INVALID_MESSAGES', 'validation_error');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sendError(res, 503, 'Chat is coming soon! We\'re setting things up.', 'API_KEY_MISSING', 'service_error');
  }

  // Sanitize messages — only keep role and content
  const sanitized = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-20);

  // [CF-092] Trim to fit context window
  const trimmed = trimMessages(sanitized);

  // [CF-093] Streaming mode
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: trimmed,
          stream: true
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic API stream error:', response.status, errText);
        // [CF-094] Send error as SSE event
        res.write('data: ' + JSON.stringify({ type: 'error', error: 'AI is temporarily unavailable. Please try again.' }) + '\n\n');
        res.end();
        return;
      }

      // Pipe the SSE stream from Anthropic to the client
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }

      res.end();
    } catch (err) {
      console.error('Stream error:', err);
      // [CF-094] Graceful stream error
      res.write('data: ' + JSON.stringify({ type: 'error', error: 'Connection lost. Please try again.' }) + '\n\n');
      res.end();
    }
    return;
  }

  // Non-streaming mode
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: trimmed
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', response.status, err);
      // [CF-094] Specific error messages based on status
      if (response.status === 429) {
        return sendError(res, 429, 'AI is busy right now. Please wait a moment and try again.', 'AI_RATE_LIMITED', 'rate_limit_error');
      }
      if (response.status === 529) {
        return sendError(res, 503, 'AI is experiencing high demand. Please try again in a few minutes.', 'AI_OVERLOADED', 'service_error');
      }
      return sendError(res, 502, 'AI is temporarily unavailable. Please try again.', 'API_ERROR', 'service_error');
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Sorry, I couldn\'t generate a response.';

    res.json({ success: true, reply });
  } catch (err) {
    console.error('Chat fetch error:', err);
    // [CF-094] Network-level error handling
    return sendError(res, 502, 'Could not reach AI service. Please check back shortly.', 'NETWORK_ERROR', 'service_error');
  }
});
