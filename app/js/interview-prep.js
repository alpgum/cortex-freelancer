/**
 * [CF-069] Interview Preparation Coach
 * Category-specific mock questions, answer frameworks, and scoring system.
 *
 * Exposed as window.CortexFreelancer.interviewPrep AND window.CortexInterviewPrep (legacy)
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var API_BASE = window.CORTEX_API_BASE || '';

  // ─── Category-Specific Question Banks ─────────────────────────────

  var QUESTION_BANKS = {
    'Web Development': [
      { question: 'Walk me through how you would build a scalable web application from scratch.', category: 'technical', difficulty: 'hard', framework: 'STAR', suggestedAnswer: 'Start with requirements gathering, then architecture design (monolith vs microservices), tech stack selection based on scale needs, CI/CD pipeline setup, database design, API layer, frontend framework, and monitoring. Give a specific example.', tip: 'Mention specific technologies and trade-offs you\'ve considered in real projects.', timeLimit: 180 },
      { question: 'How do you handle state management in complex frontend applications?', category: 'technical', difficulty: 'medium', framework: 'Problem-Solution', suggestedAnswer: 'Discuss the spectrum: local state (useState), context for shared state, Redux/Zustand for complex global state, server state with React Query/SWR. Explain your decision framework based on app complexity.', tip: 'Show you understand trade-offs, not just one solution.', timeLimit: 120 },
      { question: 'Describe a time when you had to debug a critical production issue.', category: 'behavioral', difficulty: 'medium', framework: 'STAR', suggestedAnswer: 'Situation: Production outage affecting users. Task: Identify and fix root cause. Action: Used monitoring tools, reproduced issue, implemented fix with tests. Result: Resolved in X hours, added monitoring to prevent recurrence.', tip: 'Include specific metrics: downtime reduced, users affected, time to resolution.', timeLimit: 150 },
      { question: 'How do you ensure code quality and maintainability?', category: 'process', difficulty: 'easy', framework: 'List', suggestedAnswer: 'Code reviews, automated testing (unit/integration/e2e), linting/formatting, CI checks, documentation, TypeScript for type safety, consistent patterns, refactoring sprints.', tip: 'Give percentages: "I aim for 80%+ test coverage on critical paths."', timeLimit: 120 },
      { question: 'Tell me about a project that failed or didn\'t meet expectations. What did you learn?', category: 'behavioral', difficulty: 'hard', framework: 'STAR', suggestedAnswer: 'Be honest about a real failure. Focus on what you learned: better estimation, clearer communication, different technical choices. Show growth mindset.', tip: 'Vulnerability + learning = trust. Don\'t blame others.', timeLimit: 150 },
      { question: 'How would you optimize a slow-loading web page?', category: 'technical', difficulty: 'medium', framework: 'Problem-Solution', suggestedAnswer: 'Audit with Lighthouse/WebPageTest. Common fixes: code splitting, lazy loading, image optimization (WebP/AVIF), CDN, caching headers, critical CSS, reducing JS bundle, tree shaking, server-side rendering for FCP.', tip: 'Mention real numbers: "I reduced LCP from 4.2s to 1.1s by implementing..."', timeLimit: 120 },
      { question: 'How do you handle scope creep from clients?', category: 'client-management', difficulty: 'medium', framework: 'STAR', suggestedAnswer: 'Acknowledge the request positively, document the change, explain impact on timeline/budget, propose options (add to next phase, adjust scope elsewhere, additional budget). Always in writing.', tip: 'Frame it as protecting the client\'s investment, not saying no.', timeLimit: 120 }
    ],
    'AI/LLM': [
      { question: 'Explain how RAG works and when you would use it vs fine-tuning.', category: 'technical', difficulty: 'hard', framework: 'Compare-Contrast', suggestedAnswer: 'RAG: retrieval-augmented generation — embed documents, retrieve relevant chunks, inject into prompt context. Use for: dynamic/frequently updated knowledge, domain-specific Q&A. Fine-tuning: modify model weights for style/behavior changes, specialized tasks. RAG is cheaper, more flexible; fine-tuning for behavior modification.', tip: 'Give a real example of each approach you\'ve implemented.', timeLimit: 180 },
      { question: 'How do you evaluate LLM output quality?', category: 'technical', difficulty: 'medium', framework: 'List', suggestedAnswer: 'Automated metrics (BLEU, ROUGE for text), human evaluation rubrics, A/B testing, factual accuracy checks, hallucination detection, latency/cost metrics, user satisfaction surveys, edge case testing.', tip: 'Mention specific evaluation frameworks you\'ve built or used.', timeLimit: 120 },
      { question: 'Walk me through building a production-ready AI chatbot.', category: 'technical', difficulty: 'hard', framework: 'Sequential', suggestedAnswer: 'Architecture: user input → intent classification → RAG retrieval → prompt engineering → LLM call → output validation → response. Include: rate limiting, token management, conversation memory, fallback handling, moderation, logging, A/B testing, cost monitoring.', tip: 'Discuss guardrails and safety measures — clients care about reliability.', timeLimit: 180 },
      { question: 'How do you handle hallucinations in LLM applications?', category: 'technical', difficulty: 'medium', framework: 'Problem-Solution', suggestedAnswer: 'Prevention: grounded generation (RAG), constrained outputs, temperature control. Detection: fact-checking against source, confidence scoring, citation requirements. Mitigation: human-in-the-loop, clear disclaimers, fallback to rule-based responses.', tip: 'Share metrics from a real project: "Reduced hallucination rate from 12% to 2%."', timeLimit: 120 },
      { question: 'Describe your experience with prompt engineering for complex tasks.', category: 'technical', difficulty: 'medium', framework: 'STAR', suggestedAnswer: 'Share a specific complex task. Discuss: chain-of-thought prompting, few-shot examples, system prompts, structured output (JSON mode), iterative refinement process, version control for prompts.', tip: 'Show systematic approach, not just trial-and-error.', timeLimit: 150 }
    ],
    'Mobile Development': [
      { question: 'How do you decide between native and cross-platform development?', category: 'technical', difficulty: 'medium', framework: 'Compare-Contrast', suggestedAnswer: 'Consider: performance requirements, platform-specific features needed, team expertise, timeline/budget, long-term maintenance. Native for performance-critical/complex UI; cross-platform (RN/Flutter) for faster MVP, shared codebase, simpler apps.', tip: 'Show you\'ve made this decision in real projects with real trade-offs.', timeLimit: 150 },
      { question: 'How do you handle offline functionality in mobile apps?', category: 'technical', difficulty: 'hard', framework: 'Problem-Solution', suggestedAnswer: 'Local database (SQLite/Realm/CoreData), sync queue for pending changes, conflict resolution strategy, optimistic UI updates, background sync, data freshness indicators, storage limits management.', tip: 'Mention specific sync conflict scenarios you\'ve resolved.', timeLimit: 150 },
      { question: 'Tell me about the most complex mobile app you\'ve built.', category: 'behavioral', difficulty: 'medium', framework: 'STAR', suggestedAnswer: 'Describe scope, technical challenges, team size, your role, key decisions, outcome. Include: downloads, ratings, performance metrics.', tip: 'App Store metrics are powerful proof points. Include them.', timeLimit: 180 },
      { question: 'How do you approach mobile app performance optimization?', category: 'technical', difficulty: 'medium', framework: 'List', suggestedAnswer: 'Profiling (Instruments/Android Profiler), reducing re-renders, image caching, lazy loading, virtualized lists, memory management, network optimization, reducing app size, startup time optimization.', tip: 'Include before/after metrics from real optimizations.', timeLimit: 120 },
      { question: 'How do you handle app store review processes and rejections?', category: 'process', difficulty: 'easy', framework: 'STAR', suggestedAnswer: 'Proactive: follow guidelines carefully, test on all device sizes, handle permissions properly. Reactive: read rejection reason carefully, fix specific issue, appeal if mistaken, maintain good relationship with review team.', tip: 'Share a specific rejection you handled and what you learned.', timeLimit: 120 }
    ],
    'Data Science': [
      { question: 'Walk me through your approach to a new data analysis project.', category: 'process', difficulty: 'medium', framework: 'Sequential', suggestedAnswer: 'Understand business question → data audit/quality check → EDA → hypothesis formation → feature engineering → modeling/analysis → validation → communication of results → actionable recommendations.', tip: 'Emphasize the business question first, not the technical approach.', timeLimit: 150 },
      { question: 'How do you handle missing data in a dataset?', category: 'technical', difficulty: 'medium', framework: 'Problem-Solution', suggestedAnswer: 'First understand WHY data is missing (MCAR/MAR/MNAR). Approaches: deletion (listwise/pairwise), imputation (mean/median/mode, KNN, MICE, regression), indicator variable. Choice depends on missing mechanism, proportion, and analysis type.', tip: 'Show you think about the statistical implications, not just the code.', timeLimit: 120 },
      { question: 'Explain a complex analysis you did to a non-technical audience.', category: 'behavioral', difficulty: 'hard', framework: 'STAR', suggestedAnswer: 'Describe the analysis, then focus on HOW you communicated: visual storytelling, analogies, focusing on business impact, interactive dashboards, avoiding jargon.', tip: 'This tests communication more than technical skill. Practice your storytelling.', timeLimit: 150 },
      { question: 'How do you validate that your model is actually useful for the business?', category: 'technical', difficulty: 'hard', framework: 'Problem-Solution', suggestedAnswer: 'Beyond accuracy: business metrics (ROI, lift, cost savings), A/B testing in production, monitoring for drift, stakeholder feedback, comparison to current process/baseline, false positive/negative cost analysis.', tip: 'Always tie back to dollars or business KPIs.', timeLimit: 150 }
    ],
    'DevOps': [
      { question: 'How would you design a CI/CD pipeline from scratch?', category: 'technical', difficulty: 'hard', framework: 'Sequential', suggestedAnswer: 'Source control hooks → lint/format → unit tests → build → integration tests → security scanning → staging deploy → smoke tests → approval gate → production deploy (blue/green or canary) → monitoring → rollback plan.', tip: 'Mention specific tools and why you chose them over alternatives.', timeLimit: 180 },
      { question: 'Tell me about a production incident you handled.', category: 'behavioral', difficulty: 'hard', framework: 'STAR', suggestedAnswer: 'Describe the incident, detection method, triage process, root cause analysis, fix implementation, post-mortem findings, and preventive measures implemented.', tip: 'Include timeline: "Detected at 2am, identified root cause by 2:30, rolled back by 2:45, full fix by next morning."', timeLimit: 180 },
      { question: 'How do you approach infrastructure as code?', category: 'technical', difficulty: 'medium', framework: 'Problem-Solution', suggestedAnswer: 'Everything in version control (Terraform/Pulumi). State management, modular design, environments as code, drift detection, plan/apply workflow, peer review for infra changes, automated testing (terratest).', tip: 'Discuss real challenges: state file management, large refactors, provider limitations.', timeLimit: 150 },
      { question: 'How do you balance security with developer productivity?', category: 'process', difficulty: 'medium', framework: 'Compare-Contrast', suggestedAnswer: 'Shift-left security (scan in CI, not just production). Automate compliance. Self-service with guardrails. Pre-approved patterns/modules. Security as enabler, not blocker. Regular security training.', tip: 'Give an example where you made security easier, not harder, for developers.', timeLimit: 120 }
    ]
  };

  // Generic questions for unlisted categories
  var GENERIC_QUESTIONS = [
    { question: 'Tell me about your most successful freelance project.', category: 'behavioral', difficulty: 'easy', framework: 'STAR', suggestedAnswer: 'Describe the project scope, your approach, key challenges overcome, and measurable results delivered.', tip: 'Include specific metrics: time saved, revenue generated, satisfaction scores.', timeLimit: 120 },
    { question: 'How do you handle tight deadlines?', category: 'behavioral', difficulty: 'medium', framework: 'STAR', suggestedAnswer: 'Prioritize ruthlessly, communicate early if at risk, break work into milestones, deliver incrementally, negotiate scope if needed.', tip: 'Show you manage expectations proactively, not reactively.', timeLimit: 120 },
    { question: 'How do you communicate progress to clients?', category: 'client-management', difficulty: 'easy', framework: 'List', suggestedAnswer: 'Regular updates (daily/weekly depending on project), visual progress reports, milestone demos, proactive risk flagging, accessible communication channel.', tip: 'Mention specific tools: Loom videos, Notion docs, scheduled check-ins.', timeLimit: 90 },
    { question: 'Describe a situation where you disagreed with a client\'s approach.', category: 'behavioral', difficulty: 'hard', framework: 'STAR', suggestedAnswer: 'Present data/evidence for your position, acknowledge their perspective, propose alternatives with trade-offs, ultimately respect their decision while documenting recommendations.', tip: 'Never say "the client was wrong." Frame as "I offered an alternative perspective."', timeLimit: 150 },
    { question: 'What makes you different from other freelancers in your field?', category: 'self-presentation', difficulty: 'medium', framework: 'Value-Proposition', suggestedAnswer: 'Identify 2-3 unique differentiators: niche expertise, communication style, delivery speed, process maturity, specific industry experience.', tip: 'Prepare 3 concrete examples that prove each differentiator.', timeLimit: 120 }
  ];

  // ─── Answer Frameworks ────────────────────────────────────────────

  var FRAMEWORKS = {
    'STAR': {
      name: 'STAR Method',
      steps: ['Situation: Set the context', 'Task: What was your responsibility?', 'Action: What specific steps did you take?', 'Result: What was the measurable outcome?'],
      tip: 'Keep Situation/Task brief (20%). Action is the meat (50%). Result should have numbers (30%).'
    },
    'Problem-Solution': {
      name: 'Problem-Solution',
      steps: ['Problem: What was the challenge?', 'Analysis: How did you diagnose it?', 'Solution: What did you implement?', 'Impact: What improved?'],
      tip: 'Focus on your analytical process, not just the fix.'
    },
    'Compare-Contrast': {
      name: 'Compare-Contrast',
      steps: ['Context: Why does this decision matter?', 'Option A: Pros, cons, use cases', 'Option B: Pros, cons, use cases', 'Decision Framework: How to choose'],
      tip: 'Show you can think in trade-offs, not absolutes.'
    },
    'Sequential': {
      name: 'Step-by-Step',
      steps: ['Overview: High-level approach', 'Steps: Walk through each phase', 'Decision Points: Where choices matter', 'Validation: How to verify success'],
      tip: 'Number your steps. It shows organized thinking.'
    },
    'List': {
      name: 'Structured List',
      steps: ['Categorize your points', 'Prioritize: most important first', 'Give brief explanation per item', 'Summarize the theme'],
      tip: 'Limit to 5-7 items. More = less memorable.'
    },
    'Value-Proposition': {
      name: 'Value Proposition',
      steps: ['State your unique value', 'Provide evidence (case studies)', 'Connect to their specific need', 'Close with availability/next step'],
      tip: 'Mirror the client\'s language when connecting your value to their need.'
    }
  };

  // ─── Scoring System ───────────────────────────────────────────────

  /**
   * Score a practice answer against criteria.
   * @param {Object} question - Question object from the bank
   * @param {string} userAnswer - User's practice answer text
   * @returns {Object} scoring result
   */
  function scoreAnswer(question, userAnswer) {
    if (!userAnswer || !userAnswer.trim()) {
      return { totalScore: 0, breakdown: {}, feedback: ['No answer provided.'], grade: 'F' };
    }

    var answer = userAnswer.toLowerCase();
    var words = answer.split(/\s+/);
    var sentences = answer.split(/[.!?]+/).filter(function (s) { return s.trim(); });
    var breakdown = {};

    // 1. Length & Depth (25 pts)
    var lengthScore = 0;
    if (words.length >= 150) lengthScore = 25;
    else if (words.length >= 100) lengthScore = 20;
    else if (words.length >= 50) lengthScore = 15;
    else if (words.length >= 25) lengthScore = 10;
    else lengthScore = 5;
    breakdown.depth = { score: lengthScore, max: 25, label: 'Depth & Detail' };

    // 2. Structure (25 pts) — check for framework adherence
    var structureScore = 0;
    var framework = FRAMEWORKS[question.framework];
    if (framework) {
      // Check for transition words and structured thinking
      var structureMarkers = ['first', 'second', 'then', 'next', 'finally', 'result', 'outcome', 'because', 'therefore', 'situation', 'task', 'action', 'problem', 'solution', 'step'];
      var markerCount = structureMarkers.filter(function (m) { return answer.indexOf(m) !== -1; }).length;
      structureScore = Math.min(25, markerCount * 5);
      // Bonus for paragraphs/line breaks
      if (userAnswer.indexOf('\n') !== -1) structureScore = Math.min(25, structureScore + 5);
    } else {
      structureScore = sentences.length >= 3 ? 15 : 10;
    }
    breakdown.structure = { score: structureScore, max: 25, label: 'Structure' };

    // 3. Specificity (25 pts) — numbers, tools, names
    var specificityScore = 0;
    var hasNumbers = /\d+/.test(answer);
    var hasTools = /\b(react|node|python|aws|docker|kubernetes|terraform|postgresql|mongodb|typescript|graphql|firebase)\b/i.test(answer);
    var hasMetrics = /\b(\d+%|\$\d+|saved|reduced|increased|improved|delivered)\b/i.test(answer);
    if (hasNumbers) specificityScore += 8;
    if (hasTools) specificityScore += 8;
    if (hasMetrics) specificityScore += 9;
    specificityScore = Math.min(25, specificityScore);
    if (specificityScore < 10 && words.length > 30) specificityScore = 10; // base credit for trying
    breakdown.specificity = { score: specificityScore, max: 25, label: 'Specificity' };

    // 4. Relevance (25 pts) — keyword match with question and suggested answer
    var relevanceScore = 0;
    var questionWords = (question.question + ' ' + (question.suggestedAnswer || '')).toLowerCase().split(/\s+/);
    var keyTerms = questionWords.filter(function (w) { return w.length > 4; });
    var uniqueTerms = keyTerms.filter(function (t, i) { return keyTerms.indexOf(t) === i; });
    var matchCount = uniqueTerms.filter(function (t) { return answer.indexOf(t) !== -1; }).length;
    relevanceScore = Math.min(25, Math.round((matchCount / Math.max(1, uniqueTerms.length)) * 35));
    if (relevanceScore < 10 && words.length > 20) relevanceScore = 10;
    breakdown.relevance = { score: relevanceScore, max: 25, label: 'Relevance' };

    var totalScore = breakdown.depth.score + breakdown.structure.score + breakdown.specificity.score + breakdown.relevance.score;

    // Grade
    var grade;
    if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 75) grade = 'B+';
    else if (totalScore >= 65) grade = 'B';
    else if (totalScore >= 55) grade = 'C+';
    else if (totalScore >= 45) grade = 'C';
    else if (totalScore >= 35) grade = 'D';
    else grade = 'F';

    // Feedback
    var feedback = [];
    if (breakdown.depth.score < 15) feedback.push('Expand your answer with more detail. Aim for 100+ words.');
    if (breakdown.structure.score < 15) feedback.push('Use the ' + (question.framework || 'STAR') + ' framework to structure your response.');
    if (breakdown.specificity.score < 15) feedback.push('Add specific numbers, tools, or metrics to make your answer concrete.');
    if (breakdown.relevance.score < 15) feedback.push('Address the question more directly. Cover the key topics asked about.');
    if (totalScore >= 75) feedback.push('Strong answer! Consider adding one more concrete example for impact.');
    if (totalScore >= 85) feedback.push('Excellent! This would impress most interviewers.');

    return {
      totalScore: totalScore,
      grade: grade,
      breakdown: breakdown,
      feedback: feedback,
      timeEstimate: Math.round(words.length / 2.5) // speaking time in seconds at ~150 wpm
    };
  }

  // ─── Question Selection ───────────────────────────────────────────

  /**
   * Get questions for a category, optionally filtered.
   */
  function getQuestions(category, opts) {
    opts = opts || {};
    var bank = QUESTION_BANKS[category] || GENERIC_QUESTIONS;

    // Always include some generic questions
    var questions = bank.slice();
    if (category && QUESTION_BANKS[category]) {
      // Add 2 generic questions for well-roundedness
      var generics = GENERIC_QUESTIONS.slice().sort(function () { return Math.random() - 0.5; });
      questions = questions.concat(generics.slice(0, 2));
    }

    // Filter by difficulty
    if (opts.difficulty) {
      questions = questions.filter(function (q) { return q.difficulty === opts.difficulty; });
    }

    // Filter by category type
    if (opts.type) {
      questions = questions.filter(function (q) { return q.category === opts.type; });
    }

    // Limit
    if (opts.limit) {
      questions = questions.slice(0, opts.limit);
    }

    // Shuffle if requested
    if (opts.shuffle) {
      questions.sort(function () { return Math.random() - 0.5; });
    }

    return questions;
  }

  /**
   * Get a mock interview session (curated mix).
   */
  function getMockInterview(category, questionCount) {
    questionCount = questionCount || 5;
    var bank = QUESTION_BANKS[category] || GENERIC_QUESTIONS;
    var allQuestions = bank.slice();

    // Add 1-2 generic behavioral questions
    var generics = GENERIC_QUESTIONS.filter(function (q) { return q.category === 'behavioral'; });
    allQuestions = allQuestions.concat(generics.slice(0, 2));

    // Shuffle
    allQuestions.sort(function () { return Math.random() - 0.5; });

    // Try to get a mix of difficulties and categories
    var selected = [];
    var byDifficulty = { easy: [], medium: [], hard: [] };
    allQuestions.forEach(function (q) {
      (byDifficulty[q.difficulty] || byDifficulty.medium).push(q);
    });

    // Aim for: 1 easy, 2-3 medium, 1-2 hard
    if (byDifficulty.easy.length) selected.push(byDifficulty.easy[0]);
    byDifficulty.medium.slice(0, Math.ceil(questionCount * 0.5)).forEach(function (q) { selected.push(q); });
    byDifficulty.hard.slice(0, Math.ceil(questionCount * 0.3)).forEach(function (q) { selected.push(q); });

    // Fill remaining
    while (selected.length < questionCount && allQuestions.length > selected.length) {
      var next = allQuestions.find(function (q) { return selected.indexOf(q) === -1; });
      if (next) selected.push(next);
      else break;
    }

    return {
      category: category || 'General',
      questionCount: selected.length,
      totalTimeMinutes: Math.round(selected.reduce(function (s, q) { return s + (q.timeLimit || 120); }, 0) / 60),
      questions: selected.slice(0, questionCount)
    };
  }

  /**
   * Get the framework details.
   */
  function getFramework(name) {
    return FRAMEWORKS[name] || null;
  }

  /**
   * Get all available frameworks.
   */
  function getFrameworks() {
    return Object.keys(FRAMEWORKS).map(function (k) {
      return { id: k, name: FRAMEWORKS[k].name, steps: FRAMEWORKS[k].steps };
    });
  }

  /**
   * Get available categories.
   */
  function getAvailableCategories() {
    return Object.keys(QUESTION_BANKS);
  }

  // ─── Legacy: API-based fetch + UI render ──────────────────────────

  function fetchQuestions(jobData, profileData) {
    return fetch(API_BASE + '/api/interview-prep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitle: jobData.jobTitle || jobData.title,
        jobDescription: jobData.jobDescription || jobData.description,
        jobSkills: jobData.jobSkills || jobData.skills,
        profile: profileData
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('API error: ' + res.status);
      return res.json();
    });
  }

  // ─── UI Styles ────────────────────────────────────────────────────

  var STYLES = [
    '.cx-interview-prep{background:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;margin:16px 0;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.cx-interview-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#16213e;cursor:pointer}',
    '.cx-interview-header:hover{background:#1a2745}',
    '.cx-interview-header h3{margin:0;font-size:16px;font-weight:600;color:#e0e0e0}',
    '.cx-interview-toggle{font-size:14px;color:#888;transition:transform .3s}',
    '.cx-interview-toggle.open{transform:rotate(180deg)}',
    '.cx-interview-body{display:none;padding:16px 20px}',
    '.cx-interview-body.open{display:block}',
    '.cx-interview-controls{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}',
    '.cx-interview-btn{padding:8px 16px;border:1px solid #3d3d5c;border-radius:8px;background:#2d2d44;color:#c0c0d0;font-size:13px;cursor:pointer;transition:all .2s}',
    '.cx-interview-btn:hover{background:#3d3d5c;color:#fff}',
    '.cx-interview-btn.active{background:#4a3f8a;border-color:#6c5ce7;color:#fff}',
    '.cx-qa-card{background:#0f0f23;border:1px solid #2d2d44;border-radius:8px;margin-bottom:10px;overflow:hidden}',
    '.cx-qa-card:hover{border-color:#4a3f8a}',
    '.cx-qa-question{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer}',
    '.cx-qa-number{flex-shrink:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#4a3f8a;color:#fff;border-radius:50%;font-size:13px;font-weight:600}',
    '.cx-qa-difficulty{font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;text-transform:uppercase}',
    '.cx-qa-difficulty-easy{background:#22c55e20;color:#22c55e}',
    '.cx-qa-difficulty-medium{background:#f59e0b20;color:#f59e0b}',
    '.cx-qa-difficulty-hard{background:#ef444420;color:#ef4444}',
    '.cx-qa-question-text{flex:1;color:#d0d0e0;font-size:14px;font-weight:500;line-height:1.4}',
    '.cx-qa-chevron{flex-shrink:0;color:#666;font-size:12px;transition:transform .2s}',
    '.cx-qa-chevron.open{transform:rotate(90deg)}',
    '.cx-qa-answer{display:none;padding:0 16px 14px 54px}',
    '.cx-qa-answer.open{display:block}',
    '.cx-qa-answer-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6c5ce7;margin-bottom:6px}',
    '.cx-qa-answer-text{color:#b0b0c0;font-size:13px;line-height:1.6;margin-bottom:10px}',
    '.cx-qa-framework{background:#16213e;border-radius:8px;padding:10px 14px;margin-bottom:10px}',
    '.cx-qa-framework-title{font-size:11px;color:#6c5ce7;font-weight:600;margin-bottom:6px}',
    '.cx-qa-framework-step{font-size:12px;color:#94a3b8;padding:2px 0}',
    '.cx-qa-tip{display:flex;align-items:flex-start;gap:6px;background:#1a1a2e;border-left:3px solid #f39c12;padding:8px 12px;border-radius:0 6px 6px 0}',
    '.cx-qa-tip-text{color:#d4a853;font-size:12px;line-height:1.5}',
    '.cx-score-bar{display:flex;gap:4px;margin-top:10px}',
    '.cx-score-segment{height:6px;border-radius:3px;flex:1}',
    '.cx-score-label{font-size:11px;color:#94a3b8;margin-top:4px}',
    '.cx-practice-container{display:none;text-align:center;padding:20px 0}',
    '.cx-practice-container.active{display:block}',
    '.cx-practice-textarea{width:100%;background:#0f0f23;color:#e0e0e0;border:1px solid #2d2d44;border-radius:8px;padding:12px;font-size:14px;line-height:1.6;resize:vertical;font-family:inherit;box-sizing:border-box;min-height:120px}',
    '.cx-practice-textarea:focus{outline:none;border-color:#6c5ce7}',
    '.cx-score-result{background:#16213e;border-radius:10px;padding:16px;margin-top:16px;text-align:left}',
    '.cx-score-grade{font-size:36px;font-weight:700;text-align:center;margin-bottom:12px}',
    '.cx-score-grade-A{color:#22c55e}.cx-score-grade-B{color:#4ade80}.cx-score-grade-C{color:#f59e0b}.cx-score-grade-D{color:#ef4444}.cx-score-grade-F{color:#dc2626}',
    '.cx-feedback-item{font-size:13px;color:#b0b0c0;padding:4px 0;display:flex;gap:6px}',
    '.cx-interview-loading{text-align:center;padding:30px;color:#888}',
    '.cx-interview-error{padding:16px;background:#2d1515;border:1px solid #5c2020;border-radius:8px;color:#e88;font-size:13px}',
    '@keyframes cx-spin{to{transform:rotate(360deg)}}',
    '.cx-interview-loading .spinner{display:inline-block;width:24px;height:24px;border:3px solid #2d2d44;border-top-color:#6c5ce7;border-radius:50%;animation:cx-spin .8s linear infinite}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('cx-interview-prep-styles')) return;
    var style = document.createElement('style');
    style.id = 'cx-interview-prep-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ─── Enhanced UI Render ───────────────────────────────────────────

  function renderInterviewPrep(jobData, profileData, container) {
    injectStyles();
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;

    // Determine category from job skills
    var category = _detectCategory(jobData);
    var questions = getQuestions(category, { shuffle: true, limit: 8 });

    var el = document.createElement('div');
    el.className = 'cx-interview-prep';

    var headerHTML = '<div class="cx-interview-header"><h3>🎤 Interview Prep — ' + esc(category || 'General') + '</h3><span class="cx-interview-toggle open">▼</span></div>';
    headerHTML += '<div class="cx-interview-body open">';
    headerHTML += '<div class="cx-interview-controls">';
    headerHTML += '<button class="cx-interview-btn cx-btn-browse active">📋 Browse</button>';
    headerHTML += '<button class="cx-interview-btn cx-btn-practice">🎯 Practice & Score</button>';
    headerHTML += '<button class="cx-interview-btn cx-btn-mock">🎙️ Mock Interview</button>';
    headerHTML += '</div>';
    headerHTML += '<div class="cx-qa-list"></div>';
    headerHTML += '<div class="cx-practice-container"></div>';
    headerHTML += '</div>';

    el.innerHTML = headerHTML;
    container.appendChild(el);

    // Toggle
    var header = el.querySelector('.cx-interview-header');
    var body = el.querySelector('.cx-interview-body');
    var toggle = el.querySelector('.cx-interview-toggle');
    header.addEventListener('click', function () {
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    });

    // Render question list
    var qaList = el.querySelector('.cx-qa-list');
    var practiceContainer = el.querySelector('.cx-practice-container');
    _renderQuestionList(qaList, questions);

    // Mode buttons
    el.querySelector('.cx-btn-browse').addEventListener('click', function () {
      _setActive(el, '.cx-btn-browse');
      qaList.style.display = 'block';
      practiceContainer.classList.remove('active');
    });

    el.querySelector('.cx-btn-practice').addEventListener('click', function () {
      _setActive(el, '.cx-btn-practice');
      qaList.style.display = 'none';
      practiceContainer.classList.add('active');
      _renderPracticeMode(practiceContainer, questions, 0);
    });

    el.querySelector('.cx-btn-mock').addEventListener('click', function () {
      _setActive(el, '.cx-btn-mock');
      qaList.style.display = 'none';
      var mock = getMockInterview(category, 5);
      practiceContainer.classList.add('active');
      _renderPracticeMode(practiceContainer, mock.questions, 0, true);
    });

    // Also try API fetch for AI-generated questions
    if (API_BASE) {
      fetchQuestions(jobData, profileData).then(function (data) {
        if (data && data.questions && data.questions.length) {
          questions = questions.concat(data.questions);
          _renderQuestionList(qaList, questions);
        }
      }).catch(function () { /* API not available, use local bank */ });
    }
  }

  function _setActive(el, selector) {
    el.querySelectorAll('.cx-interview-btn').forEach(function (b) { b.classList.remove('active'); });
    el.querySelector(selector).classList.add('active');
  }

  function _renderQuestionList(container, questions) {
    var html = '';
    questions.forEach(function (q, i) {
      var diffClass = 'cx-qa-difficulty-' + (q.difficulty || 'medium');
      html += '<div class="cx-qa-card" data-index="' + i + '">';
      html += '<div class="cx-qa-question">';
      html += '<span class="cx-qa-number">' + (i + 1) + '</span>';
      html += '<span class="cx-qa-question-text">' + esc(q.question) + '</span>';
      html += '<span class="cx-qa-difficulty ' + diffClass + '">' + esc(q.difficulty || 'medium') + '</span>';
      html += '<span class="cx-qa-chevron">▶</span></div>';
      html += '<div class="cx-qa-answer">';
      // Framework
      if (q.framework && FRAMEWORKS[q.framework]) {
        var fw = FRAMEWORKS[q.framework];
        html += '<div class="cx-qa-framework"><div class="cx-qa-framework-title">📐 ' + esc(fw.name) + ' Framework</div>';
        fw.steps.forEach(function (s) { html += '<div class="cx-qa-framework-step">→ ' + esc(s) + '</div>'; });
        html += '</div>';
      }
      html += '<div class="cx-qa-answer-label">Suggested Answer</div>';
      html += '<div class="cx-qa-answer-text">' + esc(q.suggestedAnswer || '') + '</div>';
      if (q.tip) {
        html += '<div class="cx-qa-tip"><span>💡</span><span class="cx-qa-tip-text">' + esc(q.tip) + '</span></div>';
      }
      html += '</div></div>';
    });
    container.innerHTML = html;

    // Accordion
    container.querySelectorAll('.cx-qa-question').forEach(function (qEl) {
      qEl.addEventListener('click', function () {
        var card = qEl.closest('.cx-qa-card');
        card.querySelector('.cx-qa-answer').classList.toggle('open');
        card.querySelector('.cx-qa-chevron').classList.toggle('open');
      });
    });
  }

  function _renderPracticeMode(container, questions, index, isMock) {
    if (!questions.length) { container.innerHTML = '<p style="color:#888">No questions available.</p>'; return; }
    var q = questions[index];
    var fw = q.framework && FRAMEWORKS[q.framework] ? FRAMEWORKS[q.framework] : null;

    var html = '';
    html += '<div style="font-size:12px;color:#666;margin-bottom:12px">';
    html += (isMock ? '🎙️ Mock Interview — ' : '🎯 Practice — ') + 'Question ' + (index + 1) + ' of ' + questions.length;
    if (q.timeLimit) html += ' · ⏱️ ' + Math.round(q.timeLimit / 60) + ' min';
    html += '</div>';
    html += '<div style="font-size:18px;font-weight:600;color:#e0e0e0;line-height:1.5;padding:20px;background:#0f0f23;border-radius:12px;margin-bottom:16px;text-align:left">' + esc(q.question) + '</div>';
    if (fw) {
      html += '<div style="text-align:left;margin-bottom:12px;font-size:12px;color:#6c5ce7">Use the <strong>' + esc(fw.name) + '</strong> framework: ' + fw.steps.map(function (s) { return s.split(':')[0]; }).join(' → ') + '</div>';
    }
    html += '<textarea class="cx-practice-textarea" placeholder="Type your answer here…" rows="6"></textarea>';
    html += '<div style="display:flex;gap:10px;justify-content:center;margin-top:12px">';
    html += '<button class="cx-interview-btn cx-score-btn">📊 Score My Answer</button>';
    html += '<button class="cx-interview-btn cx-reveal-btn">👁️ Show Suggested</button>';
    html += '</div>';
    html += '<div class="cx-score-result" style="display:none"></div>';
    html += '<div class="cx-suggested-answer" style="display:none;text-align:left;margin-top:12px;padding:14px;background:#0f0f23;border-radius:8px">';
    html += '<div style="font-size:11px;color:#6c5ce7;text-transform:uppercase;margin-bottom:6px">Suggested Answer</div>';
    html += '<div style="font-size:13px;color:#b0b0c0;line-height:1.6">' + esc(q.suggestedAnswer || '') + '</div>';
    if (q.tip) html += '<div class="cx-qa-tip" style="margin-top:8px"><span>💡</span><span class="cx-qa-tip-text">' + esc(q.tip) + '</span></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:center;gap:10px;margin-top:16px">';
    if (index > 0) html += '<button class="cx-interview-btn cx-prev-btn">← Previous</button>';
    if (index < questions.length - 1) html += '<button class="cx-interview-btn cx-next-btn">Next →</button>';
    html += '</div>';

    container.innerHTML = html;

    // Score button
    container.querySelector('.cx-score-btn').addEventListener('click', function () {
      var answer = container.querySelector('.cx-practice-textarea').value;
      var result = scoreAnswer(q, answer);
      var scoreEl = container.querySelector('.cx-score-result');
      var gradeClass = result.grade.startsWith('A') ? 'A' : result.grade.startsWith('B') ? 'B' : result.grade.startsWith('C') ? 'C' : result.grade.startsWith('D') ? 'D' : 'F';
      var sh = '<div class="cx-score-grade cx-score-grade-' + gradeClass + '">' + result.grade + ' (' + result.totalScore + '/100)</div>';
      // Breakdown bars
      var keys = Object.keys(result.breakdown);
      keys.forEach(function (k) {
        var b = result.breakdown[k];
        var pct = Math.round((b.score / b.max) * 100);
        var color = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444';
        sh += '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-bottom:3px"><span>' + esc(b.label) + '</span><span>' + b.score + '/' + b.max + '</span></div>';
        sh += '<div style="height:6px;background:#2d2d44;border-radius:3px"><div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px"></div></div></div>';
      });
      // Feedback
      sh += '<div style="margin-top:12px">';
      result.feedback.forEach(function (f) { sh += '<div class="cx-feedback-item"><span>💡</span><span>' + esc(f) + '</span></div>'; });
      sh += '</div>';
      if (result.timeEstimate) sh += '<div style="font-size:11px;color:#666;margin-top:8px">⏱️ Estimated speaking time: ~' + result.timeEstimate + 's</div>';
      scoreEl.innerHTML = sh;
      scoreEl.style.display = 'block';
    });

    // Reveal
    container.querySelector('.cx-reveal-btn').addEventListener('click', function () {
      container.querySelector('.cx-suggested-answer').style.display = 'block';
    });

    // Navigation
    var prevBtn = container.querySelector('.cx-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', function () { _renderPracticeMode(container, questions, index - 1, isMock); });
    var nextBtn = container.querySelector('.cx-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', function () { _renderPracticeMode(container, questions, index + 1, isMock); });
  }

  /**
   * Detect best-matching category from job data.
   */
  function _detectCategory(jobData) {
    if (!jobData) return null;
    var text = ((jobData.title || '') + ' ' + (jobData.skills || []).join(' ')).toLowerCase();
    var scores = {};
    var categories = Object.keys(QUESTION_BANKS);
    categories.forEach(function (cat) {
      var catLower = cat.toLowerCase();
      scores[cat] = 0;
      if (text.indexOf(catLower) !== -1) scores[cat] += 10;
      // Check individual words
      catLower.split(/[\s/]+/).forEach(function (word) {
        if (word.length > 2 && text.indexOf(word) !== -1) scores[cat] += 3;
      });
    });
    var best = categories.reduce(function (a, b) { return scores[a] > scores[b] ? a : b; });
    return scores[best] > 0 ? best : null;
  }

  // ─── Expose ───────────────────────────────────────────────────────

  var api = {
    getQuestions: getQuestions,
    getMockInterview: getMockInterview,
    scoreAnswer: scoreAnswer,
    getFramework: getFramework,
    getFrameworks: getFrameworks,
    getAvailableCategories: getAvailableCategories,
    renderInterviewPrep: renderInterviewPrep
  };

  window.CortexFreelancer.interviewPrep = api;
  window.CortexInterviewPrep = api;

})();
