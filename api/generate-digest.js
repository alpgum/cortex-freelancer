/**
 * [UW-014] Generate Digest API
 *
 * POST /api/generate-digest
 * Body: { digestData }
 *
 * If ANTHROPIC_API_KEY is set, uses Claude to generate a natural-language
 * weekly summary. Otherwise falls back to a template-based summary.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Generate a natural-language digest summary via Claude.
 */
async function generateWithClaude(digestData) {
  const prompt = `You are a helpful freelancer coach. Given this weekly performance data, write a brief, encouraging 3-4 sentence summary. Be specific with the numbers. Keep it conversational and actionable.

Week: ${digestData.weekOf}
Stats: ${digestData.stats.newJobs} new jobs found, ${digestData.stats.proposalsSent} proposals sent, profile score change: ${digestData.stats.scoreChange}, top match: ${digestData.stats.topMatchScore}%
Highlights: ${digestData.highlights.join('; ')}
Action items: ${digestData.actionItems.join('; ')}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Claude API error: ' + res.status + ' ' + err);
  }

  const data = await res.json();
  return data.content[0].text;
}

/**
 * Template-based fallback summary.
 */
function generateFromTemplate(digestData) {
  const { stats, weekOf, highlights, actionItems } = digestData;

  const parts = [];
  parts.push(`Here's your weekly roundup for ${weekOf}.`);

  if (stats.newJobs > 0) {
    parts.push(`We found ${stats.newJobs} new job${stats.newJobs !== 1 ? 's' : ''} matching your profile this week.`);
  } else {
    parts.push('No new matching jobs appeared this week — consider broadening your search criteria.');
  }

  if (stats.proposalsSent > 0) {
    parts.push(`You sent ${stats.proposalsSent} proposal${stats.proposalsSent !== 1 ? 's' : ''} — nice hustle!`);
  } else {
    parts.push('You haven\'t sent any proposals yet. Pick your strongest match and go for it.');
  }

  if (stats.scoreChange > 0) {
    parts.push(`Your profile score went up by ${stats.scoreChange} points — keep that momentum going.`);
  } else if (stats.scoreChange < 0) {
    parts.push(`Your profile score dipped by ${Math.abs(stats.scoreChange)} points. Check your completeness checklist for quick wins.`);
  }

  if (stats.topMatchScore >= 80) {
    parts.push(`Your top match hit ${stats.topMatchScore}% compatibility — that's a strong fit worth pursuing.`);
  }

  if (actionItems.length > 0) {
    parts.push(`Top priority: ${actionItems[0].toLowerCase()}.`);
  }

  return parts.join(' ');
}

/**
 * Express-compatible handler.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { digestData } = req.body || {};

    if (!digestData || !digestData.weekOf) {
      return res.status(400).json({ error: 'Missing digestData in request body' });
    }

    let summary;
    let source;

    if (ANTHROPIC_API_KEY) {
      try {
        summary = await generateWithClaude(digestData);
        source = 'claude';
      } catch (err) {
        console.error('[UW-014] Claude fallback:', err.message);
        summary = generateFromTemplate(digestData);
        source = 'template-fallback';
      }
    } else {
      summary = generateFromTemplate(digestData);
      source = 'template';
    }

    return res.status(200).json({
      summary: summary,
      source: source,
      weekOf: digestData.weekOf
    });
  } catch (err) {
    console.error('[UW-014] generate-digest error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = handler;
module.exports.generateFromTemplate = generateFromTemplate;
module.exports.generateWithClaude = generateWithClaude;
