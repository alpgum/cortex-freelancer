/**
 * [CF-069] Interview Preparation Coach
 * Category-specific mock questions, answer frameworks, scoring, and practice mode.
 * Enhanced with offline question banks, self-scoring, and session history.
 *
 * Exposed on window.CortexFreelancer.InterviewPrep AND window.CortexInterviewPrep (legacy)
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var API_BASE = window.CORTEX_API_BASE || '';
  var STORAGE_KEY = 'cortex_interview_prep';
  var SESSIONS_KEY = 'cortex_interview_sessions';

  // ── Question Banks (offline, category-specific) ────────────────────

  var QUESTION_BANKS = {
    'web-development': [
      { question: 'Can you walk me through your approach to building a new web application from scratch?', framework: 'STAR', category: 'process', difficulty: 'medium', suggestedAnswer: 'Start with requirements gathering, then plan architecture (frontend framework, backend, database). Set up CI/CD early. Build iteratively with client feedback at each milestone.', tip: 'Show you think beyond just coding — mention testing, deployment, and client communication.' },
      { question: 'How do you handle a project where the client\'s requirements keep changing?', framework: 'SITUATION', category: 'soft-skills', difficulty: 'medium', suggestedAnswer: 'I set clear change management processes early. Document requirements, use version-controlled specs, and scope each change request with time/cost impact before implementing.', tip: 'Clients love hearing you protect their budget while staying flexible.' },
      { question: 'What\'s your experience with responsive design and cross-browser compatibility?', framework: 'DIRECT', category: 'technical', difficulty: 'easy', suggestedAnswer: 'I use mobile-first CSS with flexbox/grid, test across Chrome, Firefox, Safari, and Edge. I leverage tools like BrowserStack for comprehensive testing and use progressive enhancement.', tip: 'Mention specific tools and methodologies you actually use.' },
      { question: 'How do you ensure the security of a web application?', framework: 'LIST', category: 'technical', difficulty: 'hard', suggestedAnswer: 'Input validation, parameterized queries to prevent SQL injection, CSRF tokens, Content Security Policy headers, HTTPS everywhere, secure authentication (bcrypt/argon2), rate limiting, and regular dependency audits.', tip: 'Security questions show senior-level thinking. Be specific about implementation.' },
      { question: 'Tell me about a time a project didn\'t go as planned. What happened and how did you handle it?', framework: 'STAR', category: 'behavioral', difficulty: 'medium', suggestedAnswer: 'Describe the situation honestly, what went wrong, the specific actions you took to recover, and the positive result. Emphasize lessons learned.', tip: 'Never blame the client. Show ownership and problem-solving.' },
      { question: 'How do you approach performance optimization?', framework: 'LIST', category: 'technical', difficulty: 'hard', suggestedAnswer: 'Measure first (Lighthouse, WebPageTest), then optimize: lazy loading, code splitting, image optimization, CDN usage, database query optimization, caching strategies (Redis, HTTP cache headers).', tip: 'Always mention "measure first" — it shows you\'re data-driven.' },
      { question: 'What\'s your availability and preferred communication style?', framework: 'DIRECT', category: 'logistics', difficulty: 'easy', suggestedAnswer: 'State your timezone, working hours, preferred tools (Slack, email), and update frequency. Be honest about availability.', tip: 'Clients value predictability. State a specific schedule rather than "flexible."' },
      { question: 'Can you share a relevant portfolio piece and explain your role?', framework: 'STAR', category: 'portfolio', difficulty: 'medium', suggestedAnswer: 'Choose your most relevant project. Explain the client\'s problem, your specific contributions, technologies used, and measurable results (faster load times, increased conversions, etc).', tip: 'Quantify results wherever possible — numbers are memorable.' }
    ],

    'mobile-development': [
      { question: 'What factors do you consider when choosing between native and cross-platform development?', framework: 'LIST', category: 'technical', difficulty: 'medium', suggestedAnswer: 'Budget, timeline, performance requirements, platform-specific features needed, team expertise, and long-term maintenance plans.', tip: 'Show you think about the client\'s business needs, not just tech preferences.' },
      { question: 'How do you handle app store submissions and review processes?', framework: 'DIRECT', category: 'process', difficulty: 'easy', suggestedAnswer: 'Follow guidelines carefully, prepare metadata and screenshots in advance, handle rejection feedback promptly, maintain CI/CD for builds, and plan for review timelines.', tip: 'Mention your track record — approval rates and turnaround times.' },
      { question: 'How do you approach testing for mobile applications?', framework: 'LIST', category: 'technical', difficulty: 'medium', suggestedAnswer: 'Unit tests, integration tests, UI automation (Detox/XCTest/Espresso), manual testing on multiple devices, beta testing with TestFlight/Firebase, and performance profiling.', tip: 'Testing confidence reduces client risk — emphasize your coverage.' },
      { question: 'What\'s your experience with offline-first architectures?', framework: 'DIRECT', category: 'technical', difficulty: 'hard', suggestedAnswer: 'Discuss local databases (Realm, SQLite, Core Data), sync strategies, conflict resolution, optimistic UI updates, and background sync.', tip: 'This is a differentiator — many devs don\'t handle offline well.' },
      { question: 'How do you handle push notifications and user engagement?', framework: 'DIRECT', category: 'technical', difficulty: 'medium', suggestedAnswer: 'FCM/APNs setup, notification channels/categories, deep linking, A/B testing notification copy, respecting user preferences, and measuring open rates.', tip: 'Show you think about UX, not just implementation.' }
    ],

    'ui-ux-design': [
      { question: 'Walk me through your design process from brief to final delivery.', framework: 'PROCESS', category: 'process', difficulty: 'medium', suggestedAnswer: 'Research → User personas → Information architecture → Low-fi wireframes → Client feedback → High-fi mockups → Prototyping → Usability testing → Design system handoff.', tip: 'Emphasize collaboration and iteration — clients want to be involved.' },
      { question: 'How do you validate your design decisions?', framework: 'LIST', category: 'technical', difficulty: 'hard', suggestedAnswer: 'User research, A/B testing, usability testing, analytics review, heuristic evaluation, accessibility audits, and stakeholder feedback.', tip: 'Data-driven design decisions are more convincing than "I think it looks good."' },
      { question: 'How do you handle disagreements with stakeholders about design direction?', framework: 'STAR', category: 'soft-skills', difficulty: 'medium', suggestedAnswer: 'Present data-backed rationale, create comparison prototypes, run user tests to settle debates, and find compromise that serves user needs.', tip: 'Show you can defend decisions diplomatically while remaining flexible.' },
      { question: 'What\'s your approach to design systems and component libraries?', framework: 'DIRECT', category: 'technical', difficulty: 'medium', suggestedAnswer: 'Build reusable components with consistent spacing, typography, and color systems. Document usage guidelines. Use tools like Figma libraries for team collaboration.', tip: 'This shows scalable thinking — clients love long-term value.' }
    ],

    'data-science': [
      { question: 'How do you approach a new data science problem?', framework: 'PROCESS', category: 'process', difficulty: 'medium', suggestedAnswer: 'Define the business question → Gather and explore data (EDA) → Clean and preprocess → Feature engineering → Model selection and training → Evaluation → Deployment → Monitoring.', tip: 'Start with the business question, not the model. This shows maturity.' },
      { question: 'How do you explain complex technical results to non-technical stakeholders?', framework: 'DIRECT', category: 'soft-skills', difficulty: 'medium', suggestedAnswer: 'Use visualizations, analogies, focus on business impact rather than technical details, present confidence intervals, and provide actionable recommendations.', tip: 'This is often THE differentiator between data scientists. Practice simplification.' },
      { question: 'What\'s your experience with production ML systems?', framework: 'STAR', category: 'technical', difficulty: 'hard', suggestedAnswer: 'Discuss model serving (Flask/FastAPI/cloud), monitoring for drift, retraining pipelines, A/B testing, and scaling considerations.', tip: 'Many data scientists only do notebooks. Production experience is valuable.' }
    ],

    'general': [
      { question: 'Why are you the right person for this project?', framework: 'VALUE', category: 'pitch', difficulty: 'medium', suggestedAnswer: 'Connect your specific experience to their needs, mention relevant past projects, highlight your unique approach, and express genuine interest in their problem.', tip: 'Be specific. "I\'ve built 3 similar projects" beats "I have 10 years experience."' },
      { question: 'What\'s your rate and how do you justify it?', framework: 'VALUE', category: 'negotiation', difficulty: 'hard', suggestedAnswer: 'State your rate confidently. Justify with: experience level, specialized skills, past results, speed of delivery, and the value/ROI you provide.', tip: 'Never apologize for your rate. If they can\'t afford you, that\'s okay.' },
      { question: 'How do you handle deadlines and time management?', framework: 'DIRECT', category: 'process', difficulty: 'easy', suggestedAnswer: 'Break projects into milestones, provide regular updates, use project management tools, build in buffer time, and communicate proactively about any risks.', tip: 'Mention a specific tool (Trello, Asana, Notion) to show you\'re organized.' },
      { question: 'Can you describe your experience with similar projects?', framework: 'STAR', category: 'experience', difficulty: 'medium', suggestedAnswer: 'Choose 2-3 relevant examples. For each: what was the challenge, what you did, what tools/tech you used, and what results you achieved.', tip: 'Prepare 3 "go-to" stories that cover different aspects of your work.' },
      { question: 'What questions do you have for me about the project?', framework: 'CURIOUS', category: 'engagement', difficulty: 'easy', suggestedAnswer: 'Ask about: timeline expectations, success metrics, current tech stack, team structure, and long-term vision. Shows genuine interest.', tip: 'ALWAYS have questions. Not having any signals disinterest.' }
    ]
  };

  // ── Answer Frameworks ──────────────────────────────────────────────

  var FRAMEWORKS = {
    STAR: { name: 'STAR Method', steps: ['Situation: Set the context', 'Task: What was your responsibility', 'Action: What specific steps you took', 'Result: What was the outcome (quantify if possible)'] },
    SITUATION: { name: 'Situation Framework', steps: ['Acknowledge the challenge', 'Share your approach/system', 'Give a specific example', 'State the positive outcome'] },
    DIRECT: { name: 'Direct Answer', steps: ['State your answer clearly', 'Provide supporting detail', 'Give a brief example if relevant'] },
    LIST: { name: 'Structured List', steps: ['Name the key areas/steps', 'Briefly explain each', 'Highlight your strongest area'] },
    PROCESS: { name: 'Process Walk-through', steps: ['Start with the first step', 'Walk through sequentially', 'Explain why each step matters', 'Note where client collaboration happens'] },
    VALUE: { name: 'Value Proposition', steps: ['Acknowledge the client\'s need', 'Connect your experience to it', 'Quantify past results', 'Express enthusiasm'] },
    CURIOUS: { name: 'Curious Engagement', steps: ['Ask about their goals', 'Ask about constraints', 'Ask about success criteria', 'Show genuine interest'] }
  };

  // ── Storage ────────────────────────────────────────────────────────

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  }

  // ── Session Management ─────────────────────────────────────────────

  function startSession(category, options) {
    options = options || {};
    var questions = getQuestionsForCategory(category, options);
    var session = {
      id: 'sess_' + Date.now().toString(36),
      category: category,
      startedAt: new Date().toISOString(),
      questions: questions.map(function (q, i) {
        return {
          index: i,
          question: q.question,
          framework: q.framework,
          category: q.category,
          difficulty: q.difficulty,
          suggestedAnswer: q.suggestedAnswer,
          tip: q.tip,
          userAnswer: '',
          selfScore: null, // 1-5
          notes: '',
          answeredAt: null
        };
      }),
      completed: false,
      overallScore: null
    };

    var sessions = loadJSON(SESSIONS_KEY) || [];
    sessions.unshift(session);
    if (sessions.length > 20) sessions = sessions.slice(0, 20);
    saveJSON(SESSIONS_KEY, sessions);

    return session;
  }

  function updateSession(sessionId, updates) {
    var sessions = loadJSON(SESSIONS_KEY) || [];
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === sessionId) {
        Object.keys(updates).forEach(function (k) { sessions[i][k] = updates[k]; });
        break;
      }
    }
    saveJSON(SESSIONS_KEY, sessions);
  }

  function scoreAnswer(sessionId, questionIndex, selfScore, notes) {
    var sessions = loadJSON(SESSIONS_KEY) || [];
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === sessionId) {
        var q = sessions[i].questions[questionIndex];
        if (q) {
          q.selfScore = selfScore;
          q.notes = notes || '';
          q.answeredAt = new Date().toISOString();
        }
        // Check if session complete
        var allScored = sessions[i].questions.every(function (q) { return q.selfScore !== null; });
        if (allScored) {
          sessions[i].completed = true;
          sessions[i].completedAt = new Date().toISOString();
          var totalScore = sessions[i].questions.reduce(function (s, q) { return s + q.selfScore; }, 0);
          sessions[i].overallScore = Math.round((totalScore / (sessions[i].questions.length * 5)) * 100);
        }
        break;
      }
    }
    saveJSON(SESSIONS_KEY, sessions);
  }

  function getSessionHistory() {
    return loadJSON(SESSIONS_KEY) || [];
  }

  function getQuestionsForCategory(category, options) {
    options = options || {};
    var questions = [];

    // Category-specific questions
    var catQuestions = QUESTION_BANKS[category] || [];
    questions = questions.concat(catQuestions);

    // Always add general questions
    questions = questions.concat(QUESTION_BANKS['general'] || []);

    // Filter by difficulty if specified
    if (options.difficulty) {
      questions = questions.filter(function (q) { return q.difficulty === options.difficulty; });
    }

    // Shuffle
    questions = shuffleArray(questions);

    // Limit
    var limit = options.limit || 8;
    return questions.slice(0, limit);
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ── Scoring Criteria ───────────────────────────────────────────────

  var SCORE_LABELS = {
    1: { label: 'Needs Work', color: '#f87171', emoji: '😟' },
    2: { label: 'Below Average', color: '#fb923c', emoji: '😐' },
    3: { label: 'Acceptable', color: '#facc15', emoji: '🙂' },
    4: { label: 'Good', color: '#a3e635', emoji: '😊' },
    5: { label: 'Excellent', color: '#4ade80', emoji: '🌟' }
  };

  // ── Styles ──────────────────────────────────────────────────────────

  var STYLES = '\
    .cx-ipc{background:#1a1a2e;border:1px solid #2d2d44;border-radius:16px;padding:24px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0}\
    .cx-ipc-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}\
    .cx-ipc-title{font-size:20px;font-weight:700;color:#f1f5f9;margin:0}\
    .cx-ipc-subtitle{font-size:13px;color:#64748b;margin:4px 0 0}\
    .cx-ipc-controls{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}\
    .cx-ipc-btn{padding:8px 16px;border:1px solid #3d3d5c;border-radius:8px;background:#2d2d44;color:#c0c0d0;font-size:13px;cursor:pointer;transition:all .2s}\
    .cx-ipc-btn:hover{background:#3d3d5c;color:#fff}\
    .cx-ipc-btn.active{background:#4a3f8a;border-color:#6c5ce7;color:#fff}\
    .cx-ipc-card{background:#0f0f23;border:1px solid #2d2d44;border-radius:10px;margin-bottom:10px;overflow:hidden;transition:border-color .2s}\
    .cx-ipc-card:hover{border-color:#4a3f8a}\
    .cx-ipc-q-header{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;user-select:none}\
    .cx-ipc-q-num{flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#4a3f8a;color:#fff;border-radius:50%;font-size:13px;font-weight:600}\
    .cx-ipc-q-text{flex:1;color:#d0d0e0;font-size:14px;font-weight:500;line-height:1.4}\
    .cx-ipc-q-meta{display:flex;gap:6px}\
    .cx-ipc-q-badge{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}\
    .cx-ipc-q-body{display:none;padding:0 16px 14px 58px}\
    .cx-ipc-q-body.open{display:block}\
    .cx-ipc-framework{background:#16213e;border-radius:8px;padding:12px;margin-bottom:12px}\
    .cx-ipc-framework-title{font-size:12px;font-weight:600;color:#a5b4fc;margin-bottom:8px}\
    .cx-ipc-framework-step{font-size:12px;color:#94a3b8;padding:3px 0}\
    .cx-ipc-answer-label{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6c5ce7;margin-bottom:6px}\
    .cx-ipc-answer-text{color:#b0b0c0;font-size:13px;line-height:1.6;margin-bottom:10px}\
    .cx-ipc-tip{display:flex;align-items:flex-start;gap:6px;background:#1a1a2e;border-left:3px solid #f39c12;padding:8px 12px;border-radius:0 6px 6px 0;margin-bottom:12px}\
    .cx-ipc-tip-text{color:#d4a853;font-size:12px;line-height:1.5}\
    .cx-ipc-score-area{display:flex;gap:4px;margin-top:8px}\
    .cx-ipc-score-btn{width:36px;height:36px;border:2px solid #2d2d44;border-radius:8px;background:#0f0f23;color:#94a3b8;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}\
    .cx-ipc-score-btn:hover{border-color:#6c5ce7;color:#e0e0f0}\
    .cx-ipc-score-btn.selected{border-color:#4ade80;background:rgba(74,222,128,.15);color:#4ade80}\
    .cx-ipc-practice{text-align:center;padding:20px 0}\
    .cx-ipc-practice-q{font-size:20px;font-weight:600;color:#e0e0e0;line-height:1.5;padding:24px;background:#0f0f23;border-radius:12px;margin-bottom:16px}\
    .cx-ipc-practice-textarea{width:100%;background:#0f0f23;color:#e2e8f0;border:1px solid #2d2d44;border-radius:10px;padding:14px;font-size:14px;line-height:1.6;resize:vertical;font-family:inherit;box-sizing:border-box;min-height:120px}\
    .cx-ipc-practice-textarea:focus{outline:none;border-color:#6c5ce7}\
    .cx-ipc-progress{font-size:12px;color:#64748b;margin-bottom:16px}\
    .cx-ipc-nav{display:flex;justify-content:center;gap:10px;margin-top:16px}\
    .cx-ipc-history{margin-top:20px;padding-top:20px;border-top:1px solid #2d2d44}\
    .cx-ipc-session-card{background:#16213e;border-radius:10px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}\
  ';

  function injectStyles() {
    if (document.getElementById('cx-ipc-styles')) return;
    var style = document.createElement('style');
    style.id = 'cx-ipc-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // ── Render ──────────────────────────────────────────────────────────

  function render(containerId, options) {
    options = options || {};
    injectStyles();

    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    var category = options.category || 'general';
    var mode = options.mode || 'browse'; // 'browse', 'practice', 'history'

    // Get or start session
    var session = options.session || startSession(category, { limit: options.limit || 8 });

    var html = '';
    html += '<div class="cx-ipc">';

    // Header
    html += '<div class="cx-ipc-header"><div>';
    html += '<h2 class="cx-ipc-title">🎤 Interview Preparation Coach</h2>';
    html += '<p class="cx-ipc-subtitle">Category: ' + escHtml(category) + ' · ' + session.questions.length + ' questions</p>';
    html += '</div></div>';

    // Mode tabs
    html += '<div class="cx-ipc-controls">';
    html += '<button class="cx-ipc-btn' + (mode === 'browse' ? ' active' : '') + '" data-mode="browse">📋 Browse All</button>';
    html += '<button class="cx-ipc-btn' + (mode === 'practice' ? ' active' : '') + '" data-mode="practice">🎯 Practice Mode</button>';
    html += '<button class="cx-ipc-btn' + (mode === 'history' ? ' active' : '') + '" data-mode="history">📊 History</button>';
    html += '</div>';

    if (mode === 'browse') {
      html += renderBrowseMode(session);
    } else if (mode === 'practice') {
      html += renderPracticeMode(session, options.practiceIndex || 0);
    } else if (mode === 'history') {
      html += renderHistoryMode();
    }

    html += '</div>';
    container.innerHTML = html;

    // Bind events
    bindEvents(container, session, category, options);
  }

  function renderBrowseMode(session) {
    var html = '';
    session.questions.forEach(function (q, i) {
      var diffColors = { easy: '#4ade80', medium: '#facc15', hard: '#f87171' };
      var diffColor = diffColors[q.difficulty] || '#94a3b8';

      html += '<div class="cx-ipc-card" data-index="' + i + '">';
      html += '<div class="cx-ipc-q-header">';
      html += '<span class="cx-ipc-q-num">' + (i + 1) + '</span>';
      html += '<span class="cx-ipc-q-text">' + escHtml(q.question) + '</span>';
      html += '<div class="cx-ipc-q-meta">';
      html += '<span class="cx-ipc-q-badge" style="background:' + diffColor + '22;color:' + diffColor + ';">' + q.difficulty + '</span>';
      html += '</div></div>';

      html += '<div class="cx-ipc-q-body">';

      // Framework
      var fw = FRAMEWORKS[q.framework];
      if (fw) {
        html += '<div class="cx-ipc-framework">';
        html += '<div class="cx-ipc-framework-title">📐 ' + fw.name + '</div>';
        fw.steps.forEach(function (step, si) {
          html += '<div class="cx-ipc-framework-step">' + (si + 1) + '. ' + step + '</div>';
        });
        html += '</div>';
      }

      // Suggested answer
      html += '<div class="cx-ipc-answer-label">Suggested Answer</div>';
      html += '<div class="cx-ipc-answer-text">' + escHtml(q.suggestedAnswer) + '</div>';

      // Tip
      if (q.tip) {
        html += '<div class="cx-ipc-tip">';
        html += '<span style="font-size:14px;">💡</span>';
        html += '<span class="cx-ipc-tip-text">' + escHtml(q.tip) + '</span>';
        html += '</div>';
      }

      // Self-score area
      html += '<div style="margin-top:8px;">';
      html += '<div style="font-size:11px;color:#64748b;margin-bottom:6px;">Rate your confidence:</div>';
      html += '<div class="cx-ipc-score-area" data-qi="' + i + '">';
      for (var s = 1; s <= 5; s++) {
        var sl = SCORE_LABELS[s];
        var selected = q.selfScore === s ? ' selected' : '';
        html += '<button class="cx-ipc-score-btn' + selected + '" data-score="' + s + '" title="' + sl.label + '">' + sl.emoji + '</button>';
      }
      html += '</div>';
      if (q.selfScore) {
        html += '<div style="font-size:11px;color:' + SCORE_LABELS[q.selfScore].color + ';margin-top:4px;">' + SCORE_LABELS[q.selfScore].label + '</div>';
      }
      html += '</div>';

      html += '</div></div>';
    });

    // Session summary if any scored
    var scored = session.questions.filter(function (q) { return q.selfScore !== null; });
    if (scored.length > 0) {
      var avg = scored.reduce(function (s, q) { return s + q.selfScore; }, 0) / scored.length;
      var pct = Math.round((avg / 5) * 100);
      html += '<div style="margin-top:16px;padding:16px;background:#16213e;border-radius:10px;text-align:center;">';
      html += '<div style="font-size:13px;color:#64748b;">Confidence Score</div>';
      html += '<div style="font-size:32px;font-weight:700;color:' + (pct >= 70 ? '#4ade80' : pct >= 50 ? '#facc15' : '#f87171') + ';">' + pct + '%</div>';
      html += '<div style="font-size:12px;color:#64748b;">' + scored.length + '/' + session.questions.length + ' rated</div>';
      html += '</div>';
    }

    return html;
  }

  function renderPracticeMode(session, currentIndex) {
    var q = session.questions[currentIndex];
    if (!q) return '<div style="text-align:center;color:#64748b;padding:40px;">No questions available.</div>';

    var html = '';
    html += '<div class="cx-ipc-practice">';
    html += '<div class="cx-ipc-progress">Question ' + (currentIndex + 1) + ' of ' + session.questions.length + '</div>';

    // Progress bar
    html += '<div style="height:4px;background:#2d2d44;border-radius:2px;margin-bottom:20px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + Math.round(((currentIndex + 1) / session.questions.length) * 100) + '%;background:#6c5ce7;border-radius:2px;transition:width 0.3s;"></div>';
    html += '</div>';

    // Difficulty badge
    var diffColors = { easy: '#4ade80', medium: '#facc15', hard: '#f87171' };
    html += '<div style="margin-bottom:12px;"><span class="cx-ipc-q-badge" style="background:' + (diffColors[q.difficulty] || '#94a3b8') + '22;color:' + (diffColors[q.difficulty] || '#94a3b8') + ';">' + q.difficulty + '</span></div>';

    // Question
    html += '<div class="cx-ipc-practice-q">' + escHtml(q.question) + '</div>';

    // User answer area
    html += '<div style="text-align:left;margin-bottom:16px;">';
    html += '<label style="font-size:12px;color:#64748b;display:block;margin-bottom:6px;">Your Answer:</label>';
    html += '<textarea class="cx-ipc-practice-textarea" id="cx-ipc-user-answer" placeholder="Type your answer here…">' + escHtml(q.userAnswer || '') + '</textarea>';
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
    html += '<button class="cx-ipc-btn" id="cx-ipc-show-answer">👁️ Show Suggested Answer</button>';
    html += '<button class="cx-ipc-btn" id="cx-ipc-show-framework">📐 Show Framework</button>';
    html += '</div>';

    // Hidden answer panel
    html += '<div id="cx-ipc-answer-reveal" style="display:none;text-align:left;margin-top:16px;">';

    var fw = FRAMEWORKS[q.framework];
    html += '<div id="cx-ipc-framework-reveal" style="display:none;">';
    if (fw) {
      html += '<div class="cx-ipc-framework">';
      html += '<div class="cx-ipc-framework-title">📐 ' + fw.name + '</div>';
      fw.steps.forEach(function (step, si) {
        html += '<div class="cx-ipc-framework-step">' + (si + 1) + '. ' + step + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="cx-ipc-answer-label">Suggested Answer</div>';
    html += '<div class="cx-ipc-answer-text">' + escHtml(q.suggestedAnswer) + '</div>';
    if (q.tip) {
      html += '<div class="cx-ipc-tip"><span style="font-size:14px;">💡</span><span class="cx-ipc-tip-text">' + escHtml(q.tip) + '</span></div>';
    }

    // Self-scoring
    html += '<div style="margin-top:12px;">';
    html += '<div style="font-size:12px;color:#64748b;margin-bottom:8px;">How did you do?</div>';
    html += '<div class="cx-ipc-score-area" data-qi="' + currentIndex + '">';
    for (var s = 1; s <= 5; s++) {
      var sl = SCORE_LABELS[s];
      html += '<button class="cx-ipc-score-btn" data-score="' + s + '" title="' + sl.label + '">' + sl.emoji + '</button>';
    }
    html += '</div></div>';
    html += '</div>';

    // Navigation
    html += '<div class="cx-ipc-nav">';
    if (currentIndex > 0) html += '<button class="cx-ipc-btn" data-nav="prev">← Previous</button>';
    if (currentIndex < session.questions.length - 1) html += '<button class="cx-ipc-btn" data-nav="next">Next →</button>';
    else html += '<button class="cx-ipc-btn" data-nav="finish" style="background:#4a3f8a;">🏁 Finish</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderHistoryMode() {
    var sessions = getSessionHistory();
    var html = '';

    if (sessions.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:#64748b;">';
      html += '<p style="font-size:48px;margin:0;">📊</p>';
      html += '<p style="font-size:16px;margin:12px 0;">No practice sessions yet</p>';
      html += '<p style="font-size:13px;">Start a practice session to track your progress.</p>';
      html += '</div>';
      return html;
    }

    // Overall stats
    var completedSessions = sessions.filter(function (s) { return s.completed; });
    var avgScore = completedSessions.length > 0
      ? Math.round(completedSessions.reduce(function (s, sess) { return s + sess.overallScore; }, 0) / completedSessions.length)
      : 0;

    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">';
    html += '<div style="background:#16213e;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:11px;color:#64748b;text-transform:uppercase;">Sessions</div>';
    html += '<div style="font-size:24px;font-weight:700;color:#f1f5f9;">' + sessions.length + '</div></div>';
    html += '<div style="background:#16213e;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:11px;color:#64748b;text-transform:uppercase;">Completed</div>';
    html += '<div style="font-size:24px;font-weight:700;color:#4ade80;">' + completedSessions.length + '</div></div>';
    html += '<div style="background:#16213e;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:11px;color:#64748b;text-transform:uppercase;">Avg Score</div>';
    html += '<div style="font-size:24px;font-weight:700;color:' + (avgScore >= 70 ? '#4ade80' : avgScore >= 50 ? '#facc15' : '#f87171') + ';">' + avgScore + '%</div></div>';
    html += '</div>';

    // Session list
    sessions.slice(0, 10).forEach(function (sess) {
      var date = '';
      try { date = new Date(sess.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) {}
      var scoreColor = sess.overallScore >= 70 ? '#4ade80' : sess.overallScore >= 50 ? '#facc15' : sess.overallScore ? '#f87171' : '#64748b';

      html += '<div class="cx-ipc-session-card">';
      html += '<div>';
      html += '<div style="font-size:14px;font-weight:600;color:#f1f5f9;">' + escHtml(sess.category) + '</div>';
      html += '<div style="font-size:12px;color:#64748b;">' + date + ' · ' + sess.questions.length + ' questions</div>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      if (sess.completed) {
        html += '<div style="font-size:20px;font-weight:700;color:' + scoreColor + ';">' + sess.overallScore + '%</div>';
        html += '<div style="font-size:11px;color:#64748b;">Completed</div>';
      } else {
        var answered = sess.questions.filter(function (q) { return q.selfScore !== null; }).length;
        html += '<div style="font-size:14px;color:#64748b;">' + answered + '/' + sess.questions.length + '</div>';
        html += '<div style="font-size:11px;color:#facc15;">In Progress</div>';
      }
      html += '</div></div>';
    });

    return html;
  }

  // ── Event Binding ──────────────────────────────────────────────────

  function bindEvents(container, session, category, options) {
    var currentMode = options.mode || 'browse';
    var practiceIndex = options.practiceIndex || 0;

    // Mode tabs
    container.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        render(container, { category: category, mode: btn.getAttribute('data-mode'), session: session, practiceIndex: practiceIndex });
      });
    });

    // Browse: card toggles
    container.querySelectorAll('.cx-ipc-q-header').forEach(function (header) {
      header.addEventListener('click', function () {
        var card = header.closest('.cx-ipc-card');
        var body = card.querySelector('.cx-ipc-q-body');
        if (body) body.classList.toggle('open');
      });
    });

    // Score buttons
    container.querySelectorAll('.cx-ipc-score-area').forEach(function (area) {
      var qi = parseInt(area.getAttribute('data-qi'), 10);
      area.querySelectorAll('.cx-ipc-score-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var score = parseInt(btn.getAttribute('data-score'), 10);
          scoreAnswer(session.id, qi, score);
          // Re-render
          render(container, { category: category, mode: currentMode, session: session, practiceIndex: practiceIndex });
        });
      });
    });

    // Practice mode events
    var showAnswerBtn = container.querySelector('#cx-ipc-show-answer');
    if (showAnswerBtn) {
      showAnswerBtn.addEventListener('click', function () {
        var reveal = container.querySelector('#cx-ipc-answer-reveal');
        if (reveal) reveal.style.display = reveal.style.display === 'none' ? 'block' : 'none';
      });
    }

    var showFrameworkBtn = container.querySelector('#cx-ipc-show-framework');
    if (showFrameworkBtn) {
      showFrameworkBtn.addEventListener('click', function () {
        var fw = container.querySelector('#cx-ipc-framework-reveal');
        if (fw) fw.style.display = fw.style.display === 'none' ? 'block' : 'none';
      });
    }

    // Navigation
    container.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        // Save current answer
        var ta = container.querySelector('#cx-ipc-user-answer');
        if (ta && session.questions[practiceIndex]) {
          session.questions[practiceIndex].userAnswer = ta.value;
          updateSession(session.id, { questions: session.questions });
        }

        var nav = btn.getAttribute('data-nav');
        if (nav === 'prev') practiceIndex = Math.max(0, practiceIndex - 1);
        else if (nav === 'next') practiceIndex = Math.min(session.questions.length - 1, practiceIndex + 1);
        else if (nav === 'finish') {
          render(container, { category: category, mode: 'history', session: session });
          return;
        }
        render(container, { category: category, mode: 'practice', session: session, practiceIndex: practiceIndex });
      });
    });
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Legacy API Bridge ──────────────────────────────────────────────

  function renderInterviewPrep(jobData, profileData, containerEl) {
    injectStyles();
    // Map job category to question bank
    var category = detectCategory(jobData);
    var session = startSession(category, { limit: 8 });
    render(containerEl, { category: category, mode: 'browse', session: session });
  }

  function detectCategory(jobData) {
    var text = ((jobData.jobTitle || jobData.title || '') + ' ' + (jobData.jobSkills || jobData.skills || []).join(' ')).toLowerCase();
    if (text.match(/react|angular|vue|node|javascript|typescript|web|frontend|backend|fullstack|full.stack/)) return 'web-development';
    if (text.match(/ios|android|mobile|react.native|flutter|swift|kotlin/)) return 'mobile-development';
    if (text.match(/figma|ui|ux|design|wireframe|prototype/)) return 'ui-ux-design';
    if (text.match(/data.science|machine.learning|ml|ai|deep.learning|nlp|tensorflow|python.*data/)) return 'data-science';
    return 'general';
  }

  // ── Init ───────────────────────────────────────────────────────────

  function init(options) {
    options = options || {};
    // Nothing to seed — question banks are built-in
  }

  // ── Public API ─────────────────────────────────────────────────────

  window.CortexFreelancer.InterviewPrep = {
    init: init,
    render: render,
    startSession: startSession,
    scoreAnswer: scoreAnswer,
    getSessionHistory: getSessionHistory,
    getQuestionsForCategory: getQuestionsForCategory,
    QUESTION_BANKS: QUESTION_BANKS,
    FRAMEWORKS: FRAMEWORKS
  };

  // Legacy compat
  window.CortexInterviewPrep = { renderInterviewPrep: renderInterviewPrep };

})();
