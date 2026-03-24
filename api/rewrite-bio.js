/**
 * CF-004: Bio/Overview AI Rewriter API
 * POST { bio, tone: "professional"|"friendly"|"bold", skills: string[] }
 * Returns { rewritten, tone, source: "ai"|"rules", changes: string[] }
 */
const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { askClaude, getApiKey } = require('./lib/claude');

// ── Tone prompts ────────────────────────────────────────────────────────

const TONE_INSTRUCTIONS = {
  professional: 'Use a polished, authoritative tone. Emphasize expertise, measurable results, and professionalism. Avoid casual language.',
  friendly: 'Use a warm, conversational tone. Be approachable and enthusiastic while still showing competence. Use first person naturally.',
  bold: 'Use a confident, high-energy tone. Be direct and assertive. Emphasize dominance in the field, transformation, and urgency.'
};

const SYSTEM_PROMPT = `You are an Upwork SEO copywriter. Rewrite the freelancer's bio/overview to maximize client conversion and search visibility.

Rules:
- Keep it 150-300 words
- Include quantified achievements if possible
- Weave in the listed skills naturally
- End with a clear call-to-action
- Do NOT invent facts — enhance what's given

Respond ONLY in JSON (no markdown):
{
  "rewritten": "the full rewritten bio",
  "changes": ["change 1", "change 2", ...]
}`;

function buildUserMessage(bio, tone, skills) {
  const toneGuide = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional;
  return `Tone: ${tone}
${toneGuide}

Skills to emphasize: ${skills.length > 0 ? skills.join(', ') : 'Not specified'}

Current bio:
${bio}

Rewrite this bio in the specified tone.`;
}

// ── Rule-based fallback ─────────────────────────────────────────────────

const TONE_CONFIG = {
  professional: {
    opening: 'With extensive experience in {skills}, I deliver high-quality results that drive measurable business outcomes.',
    connector: 'My expertise spans',
    closing: 'I welcome the opportunity to discuss how I can contribute to your project\'s success.',
    adjectives: ['seasoned', 'meticulous', 'strategic', 'results-oriented']
  },
  friendly: {
    opening: 'Hey there! I\'m passionate about {skills} and love helping clients bring their ideas to life.',
    connector: 'I\'m skilled in',
    closing: 'Let\'s chat about your project — I\'d love to hear what you\'re working on!',
    adjectives: ['enthusiastic', 'collaborative', 'creative', 'approachable']
  },
  bold: {
    opening: 'I don\'t just do {skills} — I transform businesses with it.',
    connector: 'I dominate in',
    closing: 'Ready to level up? Let\'s make it happen. Message me now.',
    adjectives: ['unstoppable', 'elite', 'top-tier', 'game-changing']
  }
};

function ruleBasedRewrite(bio, tone, skills) {
  const config = TONE_CONFIG[tone] || TONE_CONFIG.professional;
  const changes = [];
  const sentences = bio.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
  const parts = [];

  const skillsText = skills.length > 0 ? skills.slice(0, 3).join(', ') : 'my field';
  parts.push(config.opening.replace('{skills}', skillsText));
  changes.push(`Added ${tone}-tone opening hook`);

  const kept = sentences
    .filter(s => !/^(i am|i'm|my name|hello|hi |hey |welcome)/i.test(s.toLowerCase()))
    .slice(0, 4);

  if (kept.length > 0) {
    parts.push('\n\n' + kept.join(' '));
    changes.push(`Preserved ${kept.length} core sentences from original`);
  }

  if (skills.length > 0) {
    parts.push('\n\n' + config.connector + ' ' + skills.join(', ') + '.');
    changes.push('Highlighted skills with tone-appropriate framing');
  }

  const adj = config.adjectives;
  parts.push(`\n\nI bring a ${adj[0]}, ${adj[1]} approach to every engagement — ensuring ${adj[2]} solutions that exceed expectations.`);
  changes.push('Added value proposition');

  parts.push('\n\n' + config.closing);
  changes.push('Added call-to-action');

  return { rewritten: parts.join(''), changes };
}

// ── Handler ─────────────────────────────────────────────────────────────

const VALID_TONES = ['professional', 'friendly', 'bold'];

async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  sanitize(req);
  const { bio, tone, skills } = req.body || {};

  if (!bio || typeof bio !== 'string' || !bio.trim()) {
    return sendError(res, 400, 'bio is required');
  }

  const safeTone = VALID_TONES.includes(tone) ? tone : 'professional';
  const safeSkills = Array.isArray(skills) ? skills.slice(0, 20) : [];

  // Try AI rewrite
  if (getApiKey()) {
    try {
      const result = await askClaude(SYSTEM_PROMPT, buildUserMessage(bio, safeTone, safeSkills), {
        maxTokens: 2000,
        timeout: 25000
      });

      if (result && result.rewritten) {
        return res.status(200).json({
          rewritten: result.rewritten,
          tone: safeTone,
          source: 'ai',
          changes: result.changes || ['AI-rewritten with ' + safeTone + ' tone']
        });
      }
    } catch (err) {
      console.warn('[rewrite-bio] Claude fallback:', err.message);
    }
  }

  // Rule-based fallback
  const result = ruleBasedRewrite(bio, safeTone, safeSkills);
  return res.status(200).json({
    rewritten: result.rewritten,
    tone: safeTone,
    source: 'rules',
    changes: result.changes
  });
}

module.exports = withErrorHandler(function (req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  return handler(req, res);
});
