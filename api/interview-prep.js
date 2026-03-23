const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { askClaude, getApiKey, ClaudeError } = require('./lib/claude');

// ── Claude Prompt Builder ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Upwork interview coach. Given a job posting and freelancer profile, generate 7 likely interview questions a client would ask, with suggested answers tailored to the freelancer's experience.

Respond ONLY in JSON (no markdown, no commentary) with this exact structure:
[
  {
    "question": "The interview question the client would ask",
    "suggestedAnswer": "A tailored answer using the freelancer's actual skills and experience",
    "tip": "A brief coaching tip for delivering this answer effectively"
  }
]

Guidelines:
- Questions should be specific to the job posting, not generic
- Answers should reference the freelancer's actual skills, JSS, and experience
- Tips should be actionable and concise
- Mix technical, behavioral, and logistical questions
- Always include at least one question about availability/process`;

function buildUserMessage(jobData, profile) {
  const skills = jobData.jobSkills?.length
    ? jobData.jobSkills.join(', ')
    : 'Not specified';

  const profileSkills = profile.skills?.length
    ? profile.skills.join(', ')
    : 'None listed';

  return `Job Posting:
- Title: ${jobData.jobTitle || 'Not specified'}
- Description: ${(jobData.jobDescription || 'No description').slice(0, 800)}
- Required Skills: ${skills}

Freelancer Profile:
- Name: ${profile.name || 'Unknown'}
- Title: ${profile.title || 'Not set'}
- Skills: ${profileSkills}
- Job Success Score: ${profile.jss != null ? profile.jss + '%' : 'Not available'}
- Total Earnings: ${profile.earnings || 'Not available'}`;
}

// ── Template-Based Fallback ─────────────────────────────────────────────

function templateQuestions(jobData, profile) {
  const jobTitle = jobData.jobTitle || 'this project';
  const skills = jobData.jobSkills || [];
  const profileName = profile.name || 'freelancer';
  const profileTitle = profile.title || 'professional';
  const profileSkills = profile.skills || [];
  const jss = profile.jss;
  const earnings = profile.earnings;

  const questions = [];

  // Skill-specific questions (up to 2)
  const relevantSkills = skills.length > 0 ? skills : profileSkills;
  if (relevantSkills.length > 0) {
    questions.push({
      question: `Tell me about your experience with ${relevantSkills[0]}.`,
      suggestedAnswer: `I've been working with ${relevantSkills[0]} extensively as a ${profileTitle}. ${jss ? `My ${jss}% Job Success Score reflects the quality I bring to projects involving ${relevantSkills[0]}.` : `I've consistently delivered high-quality work involving ${relevantSkills[0]}.`} ${earnings ? `Over my career on Upwork, I've earned ${earnings}, much of it from projects requiring this exact skill.` : 'I have a strong track record of successful projects using this skill.'}`,
      tip: 'Lead with specific project examples. Clients love hearing about similar work you\'ve done.'
    });
  }

  if (relevantSkills.length > 1) {
    questions.push({
      question: `How proficient are you with ${relevantSkills[1]}?`,
      suggestedAnswer: `${relevantSkills[1]} is one of my core competencies as a ${profileTitle}. I regularly combine it with ${relevantSkills[0] || 'other skills'} to deliver comprehensive solutions. I'd be happy to share portfolio pieces demonstrating this.`,
      tip: 'Offer to show portfolio work — it builds confidence faster than words alone.'
    });
  }

  // Always include these core questions
  questions.push({
    question: `How would you approach ${jobTitle}?`,
    suggestedAnswer: `I'd start by thoroughly understanding your requirements and goals. As a ${profileTitle}, my typical approach is: 1) Discovery call to align on scope, 2) Break down deliverables into milestones, 3) Regular check-ins and progress updates. ${jss ? `My ${jss}% JSS shows I consistently deliver on this process.` : 'I focus on clear communication throughout.'}`,
    tip: 'Show you have a structured process. Clients hire freelancers who reduce uncertainty.'
  });

  questions.push({
    question: "What's your availability and turnaround time?",
    suggestedAnswer: `I'm currently available to take on this project and can start within 24-48 hours of agreement. I typically respond to messages within a few hours during business hours and provide regular progress updates. I'll give you a realistic timeline upfront so there are no surprises.`,
    tip: 'Be honest about your availability. Over-promising on timelines is the #1 cause of bad reviews.'
  });

  questions.push({
    question: "Can you share similar past work?",
    suggestedAnswer: `Absolutely! As a ${profileTitle}${relevantSkills.length > 0 ? ` specializing in ${relevantSkills.slice(0, 3).join(', ')}` : ''}, I've completed similar projects on Upwork. ${earnings ? `With ${earnings} in total earnings, I have a solid portfolio of relevant work.` : 'I have several relevant portfolio pieces.'} I can share specific examples that align closely with your project needs.`,
    tip: 'Prepare 2-3 specific examples before the interview. Screenshots or demos seal the deal.'
  });

  questions.push({
    question: "How do you handle revisions and feedback?",
    suggestedAnswer: `I welcome feedback — it's how we get to the best result. I typically include a defined number of revision rounds in my proposals and use structured feedback sessions to keep things efficient. ${jss ? `My ${jss}% Job Success Score reflects my commitment to client satisfaction.` : 'Client satisfaction is my top priority.'}`,
    tip: 'Set clear revision expectations upfront. This protects both you and the client.'
  });

  questions.push({
    question: "What's your communication style?",
    suggestedAnswer: `I'm proactive and transparent. I send regular updates without being asked, flag potential issues early, and prefer to over-communicate rather than leave clients guessing. I'm comfortable with Upwork messages, Zoom calls, Slack — whatever works best for your workflow.`,
    tip: 'Mirror the client\'s communication style. If they write long messages, match that energy.'
  });

  questions.push({
    question: `Why should I hire you over other freelancers for ${jobTitle}?`,
    suggestedAnswer: `Three things set me apart: ${jss ? `1) My ${jss}% Job Success Score — I consistently deliver, ` : '1) My commitment to quality work, '}${relevantSkills.length > 0 ? `2) Deep expertise in ${relevantSkills.slice(0, 2).join(' and ')}` : '2) My versatile skill set'}, and 3) I treat every project like a long-term relationship, not a transaction. ${earnings ? `My ${earnings} in Upwork earnings shows clients keep coming back.` : 'I focus on building lasting client relationships.'}`,
    tip: 'Don\'t bash competitors. Focus on your unique value. Specificity wins over generalities.'
  });

  return questions;
}

// ── Handler ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const { jobTitle, jobDescription, jobSkills, profile } = req.body || {};

  if (!jobTitle && !jobDescription) {
    return sendError(res, 400, 'At least jobTitle or jobDescription is required');
  }

  if (!profile || typeof profile !== 'object') {
    return sendError(res, 400, 'profile object is required');
  }

  const jobData = { jobTitle, jobDescription, jobSkills };

  // Try AI-powered generation first
  if (getApiKey()) {
    try {
      const userMessage = buildUserMessage(jobData, profile);
      const questions = await askClaude(SYSTEM_PROMPT, userMessage, {
        maxTokens: 2000
      });

      if (Array.isArray(questions) && questions.length > 0) {
        return res.status(200).json({
          success: true,
          questions,
          source: 'ai'
        });
      }
    } catch (err) {
      // Fall through to template
      console.warn('Claude interview-prep failed, using template:', err.message);
    }
  }

  // Fallback: template-based questions
  const questions = templateQuestions(jobData, profile);

  return res.status(200).json({
    success: true,
    questions,
    source: 'template'
  });
}

module.exports = withErrorHandler(async (req, res) => {
  await cors(req, res);
  await rateLimit(req, res, { max: 15, windowSec: 60 });
  sanitize(req);
  return handler(req, res);
});
