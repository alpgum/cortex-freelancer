const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { askClaude, getApiKey, ClaudeError } = require('./lib/claude');

// ── Claude Prompt Builder ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a freelance negotiation expert with deep knowledge of Upwork dynamics. Your job is to help freelancers respond professionally to client messages to get the best deal while maintaining the relationship.

Respond ONLY in JSON (no markdown, no commentary) with this exact structure:
{
  "bestResponse": "The ideal response the freelancer should send",
  "alternativeResponse": "A softer or different-angle alternative response",
  "tips": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"],
  "whatToAvoid": ["Thing to avoid 1", "Thing to avoid 2"],
  "tactic": "Name of the negotiation tactic used (e.g., 'Value Anchoring', 'Collaborative Framing', 'Scarcity Play')"
}

Guidelines:
- Always be professional but firm on value
- Reference the freelancer's JSS and earnings as leverage when strong
- Never suggest undercutting own rate without getting something in return
- Frame everything as win-win
- Consider Upwork-specific dynamics (escrow, JSS impact, long-term contracts)
- Keep responses concise and ready to copy-paste`;

function buildUserMessage(scenario, clientMessage, profile) {
  const context = [];

  if (profile.name) context.push(`Freelancer: ${profile.name}`);
  if (profile.rate) context.push(`Current Rate: $${profile.rate}/hr`);
  if (profile.jss != null) context.push(`Job Success Score: ${profile.jss}%`);
  if (profile.earnings) context.push(`Total Earnings: ${profile.earnings}`);

  let message = '';
  if (context.length) {
    message += `Freelancer Profile:\n${context.join('\n')}\n\n`;
  }

  if (scenario && scenario !== 'custom') {
    message += `Negotiation Scenario: ${scenario}\n\n`;
  }

  message += `The client said:\n"${clientMessage}"`;

  return message;
}

// ── Rule-Based Fallback ─────────────────────────────────────────────────

const SCENARIO_RESPONSES = {
  'rate-reduction': {
    match: (msg) =>
      /lower.*(rate|price|cost)|discount|cheaper|budget|too (expensive|high|much)/i.test(msg),
    generate: (profile) => ({
      bestResponse: `I appreciate you sharing your budget considerations. My rate of $${profile.rate || 'X'}/hr reflects the quality and reliability I bring — ${profile.jss ? `backed by my ${profile.jss}% Job Success Score` : 'backed by consistent 5-star results'}${profile.earnings ? ` and ${profile.earnings} in successful project delivery` : ''}. I'd love to work with you — could we discuss adjusting the scope to fit your budget while still achieving your core goals?`,
      alternativeResponse: `I understand budget is a factor. Rather than lowering my rate, I could propose a phased approach — we tackle the most critical deliverables first at my standard rate, and you can see the quality before committing to the full scope. This way you get immediate value with lower upfront risk.`,
      tips: [
        'Never lower your rate without reducing scope — it sets a precedent',
        'Offer alternatives: phased delivery, milestone-based payment, or retainer discounts for long-term work',
        'Emphasize ROI — a higher rate often means faster delivery and fewer revisions',
        'If they insist, suggest a small paid discovery phase so they can evaluate quality firsthand'
      ],
      whatToAvoid: [
        'Don\'t immediately agree to lower your rate — it signals desperation',
        'Don\'t badmouth cheaper freelancers — focus on your unique value',
        'Don\'t get defensive or emotional about pricing'
      ],
      tactic: 'Value Anchoring'
    })
  },

  'free-test': {
    match: (msg) =>
      /free.*(test|trial|sample|work)|test.*free|unpaid.*(test|trial|work)|prove yourself/i.test(msg),
    generate: (profile) => ({
      bestResponse: `Thank you for wanting to evaluate fit before committing — that's smart! I don't do unpaid work, but I understand the concern. Here's what I suggest: a small paid trial project (2-4 hours) at my standard rate. This gives you a real sample of my work quality, communication style, and reliability${profile.jss ? ` — which my ${profile.jss}% JSS already speaks to` : ''}. If you're happy, we continue. If not, you've only invested a few hours.`,
      alternativeResponse: `I appreciate the thought, but my policy is to keep all work within Upwork's payment protection for both our sakes. I'd be happy to walk you through my portfolio of similar projects, share client testimonials, or set up a quick paid pilot task so you can evaluate my work with zero risk through Upwork's escrow system.`,
      tips: [
        'Free work devalues the entire freelance market — politely but firmly decline',
        'Offer a small paid trial instead — serious clients will agree',
        'Point to your portfolio, reviews, and JSS as existing proof of quality',
        'If they insist on free work, it\'s a red flag about how they\'ll treat the full project'
      ],
      whatToAvoid: [
        'Never agree to free work — it rarely converts to paid work',
        'Don\'t be rude — frame it as protecting both parties',
        'Don\'t offer extensive free consultations as a workaround'
      ],
      tactic: 'Paid Pilot Reframe'
    })
  },

  'unlimited-revisions': {
    match: (msg) =>
      /unlimited.*(revision|change|edit|update)|as many.*(revision|change)|keep changing|until.*perfect/i.test(msg),
    generate: (profile) => ({
      bestResponse: `I'm absolutely committed to getting this right for you! In my experience, the best results come from a structured feedback process. I include 2-3 rounds of revisions in my proposals — each round incorporates all your feedback at once, which is more efficient than ad-hoc changes. This process has consistently delivered excellent results${profile.jss ? ` (reflected in my ${profile.jss}% JSS)` : ''}. If additional rounds are needed beyond that, I'm happy to accommodate at a fair hourly rate.`,
      alternativeResponse: `Great question about revisions! Here's my approach: I invest extra time upfront to understand your vision thoroughly — this typically means fewer revisions are needed. I include 2 comprehensive revision rounds, and in most cases that's more than enough. For complex projects, I can build additional revision rounds into the proposal at a reduced rate. This keeps us both focused and efficient.`,
      tips: [
        'Define revision rounds clearly in your proposal/contract before starting',
        'Explain that structured revisions produce better results than unlimited back-and-forth',
        '2-3 rounds is industry standard — don\'t feel pressured to offer more',
        'Offer a "revision package" add-on if the client insists on more flexibility'
      ],
      whatToAvoid: [
        'Don\'t agree to unlimited revisions — it\'s a recipe for scope creep',
        'Don\'t sound inflexible — frame limits as good process, not restrictions',
        'Don\'t skip the revision discussion — unclear expectations kill projects'
      ],
      tactic: 'Structured Scope Framing'
    })
  },

  'outside-platform': {
    match: (msg) =>
      /outside.*(upwork|platform)|off.*(upwork|platform)|direct.*pay|bypass|pay.*directly|venmo|paypal|wire|bank.*transfer|skip.*upwork/i.test(msg),
    generate: (profile) => ({
      bestResponse: `I appreciate you thinking about efficiency! However, I prefer to keep our work through Upwork for both our protection. Here's why it benefits you too: Upwork's escrow ensures you only pay for approved work, you get dispute resolution if needed, and all payment records are clean for tax purposes. ${profile.jss ? `My ${profile.jss}% JSS is built on this trust system. ` : ''}After we've built a strong working relationship on-platform, we can always discuss options within Upwork's guidelines.`,
      alternativeResponse: `Thanks for suggesting that! I should mention that Upwork's Terms of Service require us to keep the working relationship on-platform for at least 2 years. Beyond the rules, Upwork's escrow actually protects both of us — you get payment protection, and I get guaranteed payment for completed work. It's a win-win. I'm happy to discuss ways to make our workflow efficient within the platform.`,
      tips: [
        'Going off-platform violates Upwork TOS and can get both accounts suspended',
        'Escrow protects you too — emphasize mutual benefit',
        'If the client is trying to save on fees, suggest hourly contracts (lower Upwork fees at higher earnings tiers)',
        'Report persistent off-platform payment requests — it\'s a common scam tactic'
      ],
      whatToAvoid: [
        'Never agree to off-platform payments — your account and earnings history are at stake',
        'Don\'t be accusatory — many clients genuinely don\'t know the rules',
        'Don\'t share personal payment details (PayPal, bank info) in Upwork messages'
      ],
      tactic: 'Mutual Protection Framing'
    })
  }
};

function generateFallbackResponse(scenario, clientMessage, profile) {
  // Try to match scenario by key first
  if (scenario && SCENARIO_RESPONSES[scenario]) {
    return SCENARIO_RESPONSES[scenario].generate(profile);
  }

  // Try to match by message content
  for (const [, handler] of Object.entries(SCENARIO_RESPONSES)) {
    if (handler.match(clientMessage)) {
      return handler.generate(profile);
    }
  }

  // Generic fallback
  return {
    bestResponse: `Thank you for your message. I've carefully considered your points, and here's my perspective: ${profile.jss ? `With a ${profile.jss}% Job Success Score` : 'With a strong track record'}${profile.earnings ? ` and ${profile.earnings} in completed projects` : ''}, I'm confident we can find an arrangement that works for both of us. Could you share more about your goals for this project? I'd like to propose a structure that maximizes value for your investment.`,
    alternativeResponse: `I appreciate you raising this — open communication is key to a great working relationship. Let me understand your priorities better so I can tailor a solution. What are the top 3 outcomes you need from this project? Once I understand that, I can propose the most efficient path forward${profile.rate ? ` within a $${profile.rate}/hr framework` : ''}.`,
    tips: [
      'Always respond within 24 hours to maintain momentum',
      'Ask clarifying questions to show engagement and professionalism',
      'Frame everything in terms of value to the client, not cost to you',
      'Put agreements in writing within Upwork messages for documentation'
    ],
    whatToAvoid: [
      'Don\'t react emotionally to unexpected requests',
      'Don\'t make concessions without getting something in return',
      'Don\'t ignore red flags — trust your instincts'
    ],
    tactic: 'Discovery & Collaborative Framing'
  };
}

// ── Handler ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const { scenario, clientMessage, profile } = req.body || {};

  if (!clientMessage || typeof clientMessage !== 'string' || !clientMessage.trim()) {
    return sendError(res, 400, 'clientMessage is required');
  }

  if (!profile || typeof profile !== 'object') {
    return sendError(res, 400, 'profile object is required');
  }

  // Try AI-powered coaching first
  if (getApiKey()) {
    try {
      const userMessage = buildUserMessage(scenario, clientMessage, profile);
      const result = await askClaude(SYSTEM_PROMPT, userMessage, {
        maxTokens: 1500
      });

      if (result && result.bestResponse) {
        return res.status(200).json({
          success: true,
          ...result,
          source: 'ai'
        });
      }
    } catch (err) {
      console.warn('Claude negotiation-coach failed, using fallback:', err.message);
    }
  }

  // Fallback: rule-based responses
  const result = generateFallbackResponse(scenario, clientMessage, profile);

  return res.status(200).json({
    success: true,
    ...result,
    source: 'template'
  });
}

module.exports = withErrorHandler(async (req, res) => {
  await cors(req, res);
  await rateLimit(req, res, { max: 15, windowSec: 60 });
  sanitize(req);
  return handler(req, res);
});
