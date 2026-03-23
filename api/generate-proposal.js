const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

// Template-based proposal generator (fallback when no AI)
function generateTemplateProposal(job, profile) {
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

  return `Hi,

I'm ${name}, a ${title}${jssLine}${earningsLine}.

Your project "${job.jobTitle}" stood out to me — I have direct experience in this area and can deliver high-quality results.

Key qualifications:
${skillsList || '• Relevant experience in your project area'}
${rateLine}

I'd estimate completing this within ${timeline}. Happy to discuss scope and timeline on a quick call.

Looking forward to hearing from you!

Best,
${name.split(' ')[0]}`;
}

// Claude AI proposal generator
async function generateAIProposal(job, profile) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const profileSkills = (profile.skills || []).join(', ');
  const jobSkills = (job.jobSkills || []).join(', ');

  const prompt = `You are a top-rated Upwork freelancer writing a winning proposal. Be specific, mention relevant skills, address the client's needs directly. Keep it under 200 words. Professional but warm tone. Do NOT use generic filler.

Freelancer Profile:
- Name: ${profile.name || 'Freelancer'}
- Title: ${profile.title || 'Experienced Professional'}
- Rate: ${profile.rate || profile.hourlyRate || 'Flexible'}
- Job Success: ${profile.jss || profile.jobSuccess || 'N/A'}%
- Earnings: ${profile.earnings || profile.totalEarnings || 'N/A'}
- Skills: ${profileSkills || 'Various'}

Job Details:
- Title: ${job.jobTitle}
- Description: ${(job.jobDescription || '').substring(0, 500)}
- Budget: ${job.jobBudget || 'Not specified'}
- Required Skills: ${jobSkills || 'Not specified'}

Write the proposal now. Output ONLY the proposal text, no JSON, no markdown.`;

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

  const { jobTitle, jobDescription, jobBudget, jobSkills, profile } = req.body || {};

  if (!jobTitle || !profile) {
    return sendError(res, 400, 'Missing jobTitle or profile', 'MISSING_PARAMS', 'validation_error');
  }

  const job = { jobTitle, jobDescription, jobBudget, jobSkills };

  // Try AI first, fallback to template
  let proposal = await generateAIProposal(job, profile);
  let source = 'ai';

  if (!proposal) {
    proposal = generateTemplateProposal(job, profile);
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
