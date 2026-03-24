const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

// Template-based proposal generator (fallback when no AI)
function generateTemplateProposal(job, profile, tone) {
  const name = profile.name || 'there';
  const title = profile.title || 'experienced freelancer';
  const jss = profile.jss || profile.jobSuccess;
  const earnings = profile.earnings || profile.totalEarnings;
  const rate = profile.rate || profile.hourlyRate;

  // Find overlapping skills
  const profileSkills = (profile.skills || []).map(s => s.toLowerCase());
  const jobSkills = (job.jobSkills || []).map(s => s.toLowerCase());
  const overlap = profileSkills.filter(s => jobSkills.some(js => js.includes(s) || s.includes(js)));
  const topSkills = overlap.length > 0 ? overlap.slice(0, 3) : profileSkills.slice(0, 3);

  const jssLine = jss ? ` with ${jss}% job success` : '';
  const earningsLine = earnings ? ` and ${earnings} earned on Upwork` : '';
  const rateLine = rate ? `\n\nMy rate is ${rate}, and I'm flexible on scope-based pricing for the right project.` : '';

  const skillsList = topSkills.map(s => `• ${s.charAt(0).toUpperCase() + s.slice(1)}`).join('\n');

  const timeline = job.jobBudget && job.jobBudget.includes('Fixed')
    ? '1-2 weeks (depending on scope)'
    : 'an ongoing basis with weekly deliverables';

  if (tone === 'friendly') {
    return `Hey there! 👋

I just came across your project "${job.jobTitle}" and got genuinely excited — this is right in my wheelhouse!

I'm ${name}, a ${title}${jssLine}${earningsLine}. I've done plenty of similar work and can hit the ground running.

${topSkills.length > 0 ? `Skills that match your needs:\n${skillsList}` : 'I have direct experience in your project area and can deliver great results.'}
${rateLine}

A few things that set me apart:
• I communicate proactively — no ghosting, no surprises
• I deliver on time (or early)
• I genuinely care about quality

I'd estimate completing this within ${timeline}. Would love to hop on a quick call to chat about the details!

Cheers,
${name.split(' ')[0]}`;
  }

  // Professional tone (default)
  return `Dear Hiring Manager,

I'm ${name}, a ${title}${jssLine}${earningsLine}.

Your project "${job.jobTitle}" stood out to me — I have direct experience in this area and can deliver high-quality results.

Key qualifications:
${skillsList || '• Relevant experience in your project area'}
${rateLine}

I'd estimate completing this within ${timeline}. Happy to discuss scope and timeline on a quick call.

Looking forward to hearing from you!

Best regards,
${name.split(' ')[0]}`;
}

// Claude AI proposal generator — supports tone variants
async function generateAIProposal(job, profile, tone) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const profileSkills = (profile.skills || []).join(', ');
  const jobSkills = (job.jobSkills || []).join(', ');

  const toneInstruction = tone === 'friendly'
    ? 'Write in a warm, casual, approachable tone. Use conversational language, show genuine enthusiasm. Start with "Hey" or "Hi there". Include a friendly emoji or two. Be personable but still competent.'
    : 'Write in a professional, polished tone. Be structured and metrics-focused. Emphasize track record and reliability. Start with "Dear Hiring Manager" or similar. No emojis.';

  const prompt = `You are a top-rated Upwork freelancer writing a winning proposal. Be specific, mention relevant skills, address the client's needs directly. Keep it under 200 words. Do NOT use generic filler.

${toneInstruction}

Freelancer Profile:
- Name: ${profile.name || 'Freelancer'}
- Title: ${profile.title || 'Experienced Professional'}
- Rate: ${profile.rate || profile.hourlyRate || 'Flexible'}
- Job Success: ${profile.jss || profile.jobSuccess || 'N/A'}%
- Earnings: ${profile.earnings || profile.totalEarnings || 'N/A'}
- Skills: ${profileSkills || 'Various'}

Job Details:
- Title: ${job.jobTitle}
- Description: ${(job.jobDescription || '').substring(0, 1500)}
- Budget: ${job.jobBudget || 'Not specified'}
- Required Skills: ${jobSkills || 'Not specified'}

Write the proposal now. Output ONLY the proposal text, no JSON, no markdown formatting.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    return text || null;
  } catch {
    return null;
  }
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { jobTitle, jobDescription, jobBudget, jobSkills, profile, variants: wantVariants } = req.body || {};

  if (!profile) {
    return sendError(res, 400, 'Missing profile', 'MISSING_PARAMS', 'validation_error');
  }

  // Support new flow: jobDescription only (no jobTitle required)
  const effectiveTitle = jobTitle || extractTitleFromDescription(jobDescription) || 'Project';
  const job = { jobTitle: effectiveTitle, jobDescription, jobBudget, jobSkills };

  // ── Dual-variant mode (CF-031) ──
  if (wantVariants) {
    const tones = ['professional', 'friendly'];
    const results = [];

    // Try AI for both tones in parallel
    const aiResults = await Promise.all(
      tones.map(tone => generateAIProposal(job, profile, tone))
    );

    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i];
      let proposal = aiResults[i];
      let source = 'ai';

      if (!proposal) {
        proposal = generateTemplateProposal(job, profile, tone);
        source = 'template';
      }

      results.push({
        tone,
        label: tone === 'professional' ? '💼 Professional' : '👋 Friendly',
        proposal,
        source,
      });
    }

    return res.json({
      success: true,
      variants: results,
      estimatedBudget: jobBudget || 'Discuss with client',
      suggestedTimeline: jobBudget && jobBudget.includes('Fixed') ? '1-2 weeks' : 'Ongoing',
    });
  }

  // ── Legacy single-proposal mode ──
  let proposal = await generateAIProposal(job, profile, 'professional');
  let source = 'ai';

  if (!proposal) {
    proposal = generateTemplateProposal(job, profile, 'professional');
    source = 'template';
  }

  res.json({
    success: true,
    proposal,
    source,
    estimatedBudget: jobBudget || 'Discuss with client',
    suggestedTimeline: jobBudget && jobBudget.includes('Fixed') ? '1-2 weeks' : 'Ongoing',
  });
});

// Extract a reasonable title from description text
function extractTitleFromDescription(desc) {
  if (!desc) return null;
  const firstLine = desc.split(/[\n.!?]+/)[0]?.trim();
  if (firstLine && firstLine.length > 5 && firstLine.length < 120) {
    return firstLine;
  }
  return null;
}
