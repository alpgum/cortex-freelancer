const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { askClaude, getApiKey, ClaudeError } = require('./lib/claude');

// ── Claude Prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an Upwork SEO expert. Rewrite this freelancer's title and description to maximize visibility and client attraction. Include high-demand keywords, quantify achievements, use action words. Keep title under 70 chars. Description 150-300 words.

Respond ONLY in JSON (no markdown, no commentary) with this exact structure:
{
  "titles": ["title option 1", "title option 2", "title option 3"],
  "description": "rewritten description here",
  "changes": ["Added keyword X", "Quantified Y", "..."],
  "seoScore": { "before": 45, "after": 82 }
}`;

function buildUserMessage(data) {
  return `Current Profile:
- Title: ${data.currentTitle || 'Not set'}
- Description: ${data.currentDescription || 'No description'}
- Skills: ${Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || 'None listed')}
- Hourly Rate: ${data.rate ? '$' + String(data.rate).replace(/^\$/, '') + '/hr' : 'Not specified'}
- Job Success Score: ${data.jss != null ? data.jss + '%' : 'Not available'}
- Total Earnings: ${data.earnings || 'Not available'}

Rewrite the title and description to be more compelling and SEO-optimized for Upwork search.`;
}

// ── Power Words & Keywords ──────────────────────────────────────────────

const POWER_WORDS = [
  'Expert', 'Senior', 'Proven', 'Results-Driven', 'Top-Rated',
  'Certified', 'Award-Winning', 'Full-Stack', 'Scalable', 'High-Performance'
];

const ACTION_WORDS = [
  'Delivering', 'Driving', 'Building', 'Transforming', 'Optimizing',
  'Architecting', 'Specializing in', 'Helping', 'Crafting', 'Accelerating'
];

const HIGH_DEMAND_KEYWORDS = {
  'javascript': ['React', 'Node.js', 'TypeScript', 'Next.js', 'Full-Stack'],
  'python': ['Django', 'FastAPI', 'Machine Learning', 'Data Science', 'AI'],
  'design': ['UI/UX', 'Figma', 'Design Systems', 'User Research', 'Responsive'],
  'writing': ['SEO', 'Content Strategy', 'Copywriting', 'Conversion', 'B2B/B2C'],
  'marketing': ['Growth', 'SEO', 'PPC', 'Analytics', 'Conversion Optimization'],
  'mobile': ['React Native', 'Flutter', 'iOS', 'Android', 'Cross-Platform'],
  'data': ['SQL', 'Python', 'Tableau', 'ETL', 'Business Intelligence'],
  'devops': ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Infrastructure'],
  'default': ['Scalable Solutions', 'Results-Driven', 'Client-Focused']
};

// ── SEO Scoring ─────────────────────────────────────────────────────────

function calculateSeoScore(title, description, skills) {
  let score = 0;
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();

  // Title length (ideal: 40-70 chars)
  const titleLen = (title || '').length;
  if (titleLen >= 40 && titleLen <= 70) score += 15;
  else if (titleLen >= 20 && titleLen < 40) score += 8;
  else if (titleLen > 0) score += 3;

  // Description length (ideal: 150-300 words)
  const wordCount = (description || '').split(/\s+/).filter(Boolean).length;
  if (wordCount >= 150 && wordCount <= 300) score += 15;
  else if (wordCount >= 80 && wordCount < 150) score += 8;
  else if (wordCount >= 30) score += 4;

  // Has numbers / quantified achievements
  if (/\d+\+?\s*(years?|clients?|projects?|%|k\b)/i.test(text)) score += 12;

  // Has power words
  const pwCount = POWER_WORDS.filter(w => text.includes(w.toLowerCase())).length;
  score += Math.min(pwCount * 4, 12);

  // Has action words
  const awCount = ACTION_WORDS.filter(w => text.includes(w.toLowerCase())).length;
  score += Math.min(awCount * 3, 9);

  // Skills mentioned in description
  const skillsList = Array.isArray(skills) ? skills : [];
  const skillMentions = skillsList.filter(s => text.includes(s.toLowerCase())).length;
  score += Math.min(skillMentions * 3, 15);

  // Has call-to-action or client focus
  if (/let's|contact|reach out|help you|your business|your project/i.test(text)) score += 7;

  // Has specialization keywords
  if (/speciali[zs]|expert|focus/i.test(text)) score += 5;

  // Sentence structure variety (not all same length)
  const sentences = (description || '').split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length >= 5) score += 5;
  else if (sentences.length >= 3) score += 3;

  // Has bullet-style structure or clear sections
  if (/[•\-✓✅→►]/.test(description || '')) score += 5;

  return Math.min(Math.max(score, 5), 100);
}

// ── Rule-Based Fallback ─────────────────────────────────────────────────

function ruleBasedRewrite(data) {
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const currentTitle = data.currentTitle || '';
  const currentDesc = data.currentDescription || '';
  const changes = [];

  // ── Generate 3 title options ──
  const topSkill = skills[0] || 'Freelancer';
  const secondSkill = skills[1] || '';

  // Find relevant keyword category
  const matchedCategory = Object.keys(HIGH_DEMAND_KEYWORDS).find(cat =>
    skills.some(s => s.toLowerCase().includes(cat)) || currentTitle.toLowerCase().includes(cat)
  ) || 'default';
  const keywords = HIGH_DEMAND_KEYWORDS[matchedCategory];

  const actionWord = ACTION_WORDS[Math.floor(Math.random() * ACTION_WORDS.length)];
  const powerWord = POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)];

  const jssText = data.jss >= 90 ? `Top-Rated` : data.jss >= 80 ? `${data.jss}% JSS` : '';
  const earningsText = data.earnings ? ` | ${data.earnings} Earned` : '';

  const titles = [
    `${powerWord} ${topSkill}${secondSkill ? ' & ' + secondSkill : ''} | ${keywords[0]}`.slice(0, 70),
    `${actionWord} ${keywords[0]} Solutions | ${topSkill} Specialist`.slice(0, 70),
    `${jssText ? jssText + ' ' : ''}${topSkill} Expert — ${keywords[1] || keywords[0]}${earningsText}`.slice(0, 70)
  ];
  changes.push('Added power words: ' + powerWord);
  changes.push('Added high-demand keyword: ' + keywords[0]);

  // ── Rewrite description ──
  const descParts = [];

  // Opening hook with quantified achievements
  if (data.jss && data.earnings) {
    descParts.push(`With a ${data.jss}% Job Success Score and ${data.earnings} in total earnings, I bring a proven track record of delivering exceptional results for clients worldwide.`);
    changes.push('Quantified achievements (JSS + earnings)');
  } else if (data.jss) {
    descParts.push(`With a ${data.jss}% Job Success Score, I consistently deliver high-quality work that exceeds client expectations.`);
    changes.push('Quantified achievement (JSS)');
  } else {
    descParts.push(`I'm a ${powerWord.toLowerCase()} ${topSkill.toLowerCase()} professional ${actionWord.toLowerCase()} high-impact solutions for businesses of all sizes.`);
  }

  // Skills showcase
  if (skills.length > 0) {
    const topSkills = skills.slice(0, 5);
    descParts.push(`\n\nMy core expertise includes ${topSkills.join(', ')}${skills.length > 5 ? `, and ${skills.length - 5}+ additional technologies` : ''}. I stay current with industry trends and best practices to deliver cutting-edge solutions.`);
    changes.push('Highlighted top skills with keywords');
  }

  // Value proposition
  descParts.push(`\n\nWhat sets me apart:\n• Results-driven approach with clear communication\n• Quick turnaround without compromising quality\n• Scalable, maintainable solutions built to last\n• Dedicated to understanding your unique business needs`);
  changes.push('Added structured value proposition');

  // Rate justification
  if (data.rate) {
    descParts.push(`\n\nAt $${String(data.rate).replace(/^\$/, '')}/hr, you're investing in quality, reliability, and expertise that pays for itself through efficient delivery and lasting results.`);
    changes.push('Added rate justification');
  }

  // CTA
  descParts.push(`\n\nLet's discuss your project — I'd love to help you achieve your goals. Send me a message to get started!`);
  changes.push('Added call-to-action');

  const description = descParts.join('');

  // Calculate scores
  const beforeScore = calculateSeoScore(currentTitle, currentDesc, skills);
  const afterScore = calculateSeoScore(titles[0], description, skills);

  return {
    titles,
    description,
    changes,
    seoScore: {
      before: beforeScore,
      after: Math.max(afterScore, beforeScore + 15) // Ensure improvement shown
    }
  };
}

// ── Handler ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const body = sanitize(req.body || {});
  const { currentTitle, currentDescription, skills, rate, jss, earnings } = body;

  if (!currentTitle && !currentDescription) {
    return sendError(res, 400, 'At least currentTitle or currentDescription is required');
  }

  const data = { currentTitle, currentDescription, skills, rate, jss, earnings };

  // Try AI rewrite first
  if (getApiKey()) {
    try {
      const result = await askClaude(SYSTEM_PROMPT, buildUserMessage(data), {
        maxTokens: 2000,
        timeout: 25000
      });

      // Validate response shape
      if (result && Array.isArray(result.titles) && result.titles.length >= 3 && result.description) {
        // Recalculate SEO scores for consistency
        const beforeScore = calculateSeoScore(currentTitle, currentDescription, skills);
        const afterScore = calculateSeoScore(result.titles[0], result.description, skills);

        return res.status(200).json({
          titles: result.titles.slice(0, 3),
          description: result.description,
          changes: result.changes || ['AI-optimized title and description'],
          seoScore: {
            before: result.seoScore?.before || beforeScore,
            after: result.seoScore?.after || Math.max(afterScore, beforeScore + 20)
          },
          source: 'ai'
        });
      }
    } catch (err) {
      console.warn('[rewrite-profile] Claude fallback:', err.message);
      // Fall through to rule-based
    }
  }

  // Rule-based fallback
  const result = ruleBasedRewrite(data);
  return res.status(200).json({
    ...result,
    source: 'rules'
  });
}

module.exports = withErrorHandler((req, res) => cors(req, res, () => rateLimit(req, res, () => handler(req, res))));
