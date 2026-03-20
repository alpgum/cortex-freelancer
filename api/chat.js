const { rateLimit } = require('./_middleware/rate-limit');

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

module.exports = async function handler(req, res) {
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Chat is coming soon! We\'re setting things up.',
      code: 'API_KEY_MISSING'
    });
  }

  const { messages } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'Messages array is required.',
      code: 'INVALID_MESSAGES'
    });
  }

  // Sanitize messages — only keep role and content
  const sanitized = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-20); // Keep last 20 messages for context

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: sanitized
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', response.status, err);
      return res.status(502).json({
        error: 'AI is temporarily unavailable. Please try again.',
        code: 'API_ERROR'
      });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Sorry, I couldn\'t generate a response.';

    res.json({ reply });
  } catch (err) {
    console.error('Chat API error:', err);
    res.status(500).json({
      error: 'Something went wrong. Please try again.',
      code: 'INTERNAL_ERROR'
    });
  }
};
