/**
 * [UW-016] Generate Proposal Variants API
 * POST /api/generate-proposal-variants
 * 
 * Body: { jobTitle, jobDescription, jobSkills, profile }
 * Returns: { success, variants: [{ style, label, proposal }], source }
 */

const Anthropic = (() => {
  try { return require('@anthropic-ai/sdk'); } catch { return null; }
})();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, jobDescription, jobSkills, profile } = req.body || {};

  if (!jobTitle) {
    return res.status(400).json({ error: 'jobTitle is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && Anthropic) {
    try {
      const variants = await generateWithClaude(apiKey, { jobTitle, jobDescription, jobSkills, profile });
      return res.json({ success: true, variants, source: 'ai' });
    } catch (err) {
      console.error('[proposal-variants] Claude error, falling back to templates:', err.message);
    }
  }

  const variants = generateTemplateVariants({ jobTitle, jobDescription, jobSkills, profile });
  return res.json({ success: true, variants, source: 'template' });
};

// ── AI generation via Claude ──

async function generateWithClaude(apiKey, { jobTitle, jobDescription, jobSkills, profile }) {
  const client = new Anthropic({ apiKey });

  const skillsList = (jobSkills || []).join(', ') || 'relevant skills';
  const profileName = profile?.name || 'the freelancer';
  const profileTitle = profile?.title || 'experienced freelancer';

  const prompt = `You are helping a freelancer write proposals for an Upwork job. Generate 3 proposal variants in different tones. Each should be under 200 words, personalized, and ready to submit.

Job Title: ${jobTitle}
Job Description: ${jobDescription || 'Not provided'}
Required Skills: ${skillsList}
Freelancer Name: ${profileName}
Freelancer Title: ${profileTitle}
Freelancer Success Rate: ${profile?.successRate || 'high'}
Jobs Completed: ${profile?.jobsCompleted || '50+'}

Generate exactly 3 variants:

**Style A — Professional:** Formal tone, structured with bullet points, metrics-focused, emphasizes track record and reliability.

**Style B — Conversational:** Casual and warm, story-driven, personal connection, empathetic to the client's needs.

**Style C — Technical:** Detailed approach, methodology and tools mentioned, timeline breakdown, shows deep expertise.

Respond in this exact JSON format (no markdown, just raw JSON):
[
  { "style": "A", "label": "Professional", "proposal": "..." },
  { "style": "B", "label": "Conversational", "proposal": "..." },
  { "style": "C", "label": "Technical", "proposal": "..." }
]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content?.[0]?.text || '';

  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Failed to parse Claude response as JSON array');

  const variants = JSON.parse(match[0]);

  if (!Array.isArray(variants) || variants.length !== 3) {
    throw new Error('Expected 3 variants from Claude');
  }

  return variants.map(v => ({
    style: v.style,
    label: v.label,
    proposal: v.proposal,
  }));
}

// ── Template fallback ──

function generateTemplateVariants({ jobTitle, jobDescription, jobSkills, profile }) {
  const name = profile?.name || 'there';
  const title = jobTitle || 'your project';
  const skills = (jobSkills || []).slice(0, 5).join(', ') || 'the required skills';
  const profileTitle = profile?.title || 'experienced freelancer';
  const jobs = profile?.jobsCompleted || '50+';
  const rate = profile?.successRate || '95%+';

  return [
    {
      style: 'A',
      label: 'Professional',
      proposal: `Dear Hiring Manager,

I am writing to express my interest in "${title}." As a ${profileTitle}, I bring a proven track record of delivering high-quality results on time and within budget.

Key qualifications:
• Expertise in ${skills}
• ${jobs} projects completed with ${rate} success rate
• Strong focus on measurable outcomes and clear communication

I'd welcome the opportunity to discuss how I can contribute to your project's success. I'm available to start immediately and can provide relevant portfolio samples upon request.

Best regards,
${name}`,
    },
    {
      style: 'B',
      label: 'Conversational',
      proposal: `Hi there! 👋

I came across "${title}" and it immediately caught my eye — this is exactly the kind of work I love doing.

A quick bit about me: I'm a ${profileTitle} who genuinely enjoys solving these types of challenges. I've worked on similar projects before and understand the nuances that make the difference between "okay" and "great."

What excites me about your project is the chance to bring ${skills} together in a meaningful way. I want to understand your vision and help bring it to life.

Would love to chat more about what you have in mind!
${name}`,
    },
    {
      style: 'C',
      label: 'Technical',
      proposal: `## Proposed Approach for "${title}"

**Understanding:** This project requires expertise in ${skills}.

**Methodology:**
1. Discovery & Requirements Analysis (Day 1-2)
   - Deep dive into specifications and constraints
   - Clarify deliverables and acceptance criteria
2. Implementation Phase (Day 3-7)
   - Iterative development with daily progress updates
   - Tools: ${skills}
3. Testing & Delivery (Day 8-10)
   - Comprehensive QA and edge case handling
   - Documentation and handoff

**Timeline:** ~10 business days (adjustable based on scope)
**Communication:** Daily async updates + weekly sync calls

I've completed ${jobs} similar projects. Happy to share specific case studies.

— ${name}`,
    },
  ];
}
