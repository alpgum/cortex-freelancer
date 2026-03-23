/**
 * Cortex Freelancer — Interview Prep Module
 * Renders interview questions with practice mode
 */
(function () {
  'use strict';

  const API_BASE = window.CORTEX_API_BASE || '';

  // ── Styles ──────────────────────────────────────────────────────────

  const STYLES = `
    .cx-interview-prep {
      background: #1a1a2e;
      border: 1px solid #2d2d44;
      border-radius: 12px;
      margin: 16px 0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .cx-interview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #16213e;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s;
    }

    .cx-interview-header:hover {
      background: #1a2745;
    }

    .cx-interview-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #e0e0e0;
    }

    .cx-interview-toggle {
      font-size: 14px;
      color: #888;
      transition: transform 0.3s;
    }

    .cx-interview-toggle.open {
      transform: rotate(180deg);
    }

    .cx-interview-body {
      display: none;
      padding: 16px 20px;
    }

    .cx-interview-body.open {
      display: block;
    }

    .cx-interview-controls {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .cx-interview-btn {
      padding: 8px 16px;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      background: #2d2d44;
      color: #c0c0d0;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cx-interview-btn:hover {
      background: #3d3d5c;
      color: #fff;
    }

    .cx-interview-btn.active {
      background: #4a3f8a;
      border-color: #6c5ce7;
      color: #fff;
    }

    .cx-interview-source {
      font-size: 12px;
      color: #666;
      margin-bottom: 12px;
    }

    .cx-interview-source span {
      background: #2d2d44;
      padding: 2px 8px;
      border-radius: 4px;
      color: #888;
    }

    /* Card accordion */
    .cx-qa-card {
      background: #0f0f23;
      border: 1px solid #2d2d44;
      border-radius: 8px;
      margin-bottom: 10px;
      overflow: hidden;
      transition: border-color 0.2s;
    }

    .cx-qa-card:hover {
      border-color: #4a3f8a;
    }

    .cx-qa-question {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      cursor: pointer;
      user-select: none;
    }

    .cx-qa-number {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #4a3f8a;
      color: #fff;
      border-radius: 50%;
      font-size: 13px;
      font-weight: 600;
    }

    .cx-qa-question-text {
      flex: 1;
      color: #d0d0e0;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
    }

    .cx-qa-chevron {
      flex-shrink: 0;
      color: #666;
      font-size: 12px;
      transition: transform 0.2s;
    }

    .cx-qa-chevron.open {
      transform: rotate(90deg);
    }

    .cx-qa-answer {
      display: none;
      padding: 0 16px 14px 54px;
    }

    .cx-qa-answer.open {
      display: block;
    }

    .cx-qa-answer-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6c5ce7;
      margin-bottom: 6px;
    }

    .cx-qa-answer-text {
      color: #b0b0c0;
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 10px;
    }

    .cx-qa-tip {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      background: #1a1a2e;
      border-left: 3px solid #f39c12;
      padding: 8px 12px;
      border-radius: 0 6px 6px 0;
    }

    .cx-qa-tip-icon {
      flex-shrink: 0;
      font-size: 14px;
    }

    .cx-qa-tip-text {
      color: #d4a853;
      font-size: 12px;
      line-height: 1.5;
    }

    /* Practice mode */
    .cx-practice-container {
      display: none;
      text-align: center;
      padding: 20px 0;
    }

    .cx-practice-container.active {
      display: block;
    }

    .cx-practice-progress {
      font-size: 12px;
      color: #666;
      margin-bottom: 16px;
    }

    .cx-practice-question {
      font-size: 18px;
      font-weight: 600;
      color: #e0e0e0;
      line-height: 1.5;
      padding: 20px;
      background: #0f0f23;
      border-radius: 12px;
      margin-bottom: 16px;
    }

    .cx-practice-reveal {
      padding: 10px 24px;
      border: 1px solid #6c5ce7;
      border-radius: 8px;
      background: transparent;
      color: #6c5ce7;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      margin: 0 6px;
    }

    .cx-practice-reveal:hover {
      background: #6c5ce7;
      color: #fff;
    }

    .cx-practice-answer-box {
      display: none;
      text-align: left;
      margin-top: 16px;
      padding: 16px;
      background: #0f0f23;
      border-radius: 8px;
    }

    .cx-practice-answer-box.open {
      display: block;
    }

    .cx-practice-nav {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 16px;
    }

    .cx-qa-list {
      display: block;
    }

    .cx-qa-list.hidden {
      display: none;
    }

    .cx-interview-loading {
      text-align: center;
      padding: 30px;
      color: #888;
    }

    .cx-interview-loading .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 3px solid #2d2d44;
      border-top-color: #6c5ce7;
      border-radius: 50%;
      animation: cx-spin 0.8s linear infinite;
      margin-bottom: 10px;
    }

    @keyframes cx-spin {
      to { transform: rotate(360deg); }
    }

    .cx-interview-error {
      padding: 16px;
      background: #2d1515;
      border: 1px solid #5c2020;
      border-radius: 8px;
      color: #e88;
      font-size: 13px;
    }
  `;

  // ── Inject Styles ───────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cx-interview-prep-styles')) return;
    const style = document.createElement('style');
    style.id = 'cx-interview-prep-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // ── API Call ────────────────────────────────────────────────────────

  async function fetchQuestions(jobData, profileData) {
    const res = await fetch(`${API_BASE}/api/interview-prep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitle: jobData.jobTitle || jobData.title,
        jobDescription: jobData.jobDescription || jobData.description,
        jobSkills: jobData.jobSkills || jobData.skills,
        profile: profileData
      })
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  // ── Render ──────────────────────────────────────────────────────────

  function renderInterviewPrep(jobData, profileData, container) {
    injectStyles();

    const el = document.createElement('div');
    el.className = 'cx-interview-prep';
    el.innerHTML = `
      <div class="cx-interview-header">
        <h3>🎤 Interview Prep</h3>
        <span class="cx-interview-toggle">▼</span>
      </div>
      <div class="cx-interview-body">
        <div class="cx-interview-loading">
          <div class="spinner"></div>
          <div>Generating interview questions…</div>
        </div>
      </div>
    `;

    container.appendChild(el);

    // Toggle expand/collapse
    const header = el.querySelector('.cx-interview-header');
    const body = el.querySelector('.cx-interview-body');
    const toggle = el.querySelector('.cx-interview-toggle');

    header.addEventListener('click', () => {
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    });

    // Auto-expand
    body.classList.add('open');
    toggle.classList.add('open');

    // Fetch and render questions
    fetchQuestions(jobData, profileData)
      .then(data => {
        if (!data.success || !data.questions?.length) {
          throw new Error('No questions returned');
        }
        renderQuestions(body, data.questions, data.source);
      })
      .catch(err => {
        body.innerHTML = `<div class="cx-interview-error">⚠️ ${err.message}</div>`;
      });
  }

  function renderQuestions(body, questions, source) {
    let practiceIndex = 0;

    body.innerHTML = `
      <div class="cx-interview-controls">
        <button class="cx-interview-btn cx-btn-browse active">📋 Browse All</button>
        <button class="cx-interview-btn cx-btn-practice">🎯 Practice Mode</button>
      </div>
      <div class="cx-interview-source">Generated via <span>${source === 'ai' ? '🤖 AI' : '📝 Templates'}</span></div>
      <div class="cx-qa-list">
        ${questions.map((q, i) => `
          <div class="cx-qa-card" data-index="${i}">
            <div class="cx-qa-question">
              <span class="cx-qa-number">${i + 1}</span>
              <span class="cx-qa-question-text">${esc(q.question)}</span>
              <span class="cx-qa-chevron">▶</span>
            </div>
            <div class="cx-qa-answer">
              <div class="cx-qa-answer-label">Suggested Answer</div>
              <div class="cx-qa-answer-text">${esc(q.suggestedAnswer)}</div>
              ${q.tip ? `
                <div class="cx-qa-tip">
                  <span class="cx-qa-tip-icon">💡</span>
                  <span class="cx-qa-tip-text">${esc(q.tip)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="cx-practice-container">
        <div class="cx-practice-progress"></div>
        <div class="cx-practice-question"></div>
        <div>
          <button class="cx-practice-reveal">Show Answer</button>
        </div>
        <div class="cx-practice-answer-box">
          <div class="cx-qa-answer-label">Suggested Answer</div>
          <div class="cx-qa-answer-text cx-practice-answer-text"></div>
          <div class="cx-qa-tip cx-practice-tip" style="display:none">
            <span class="cx-qa-tip-icon">💡</span>
            <span class="cx-qa-tip-text cx-practice-tip-text"></span>
          </div>
        </div>
        <div class="cx-practice-nav">
          <button class="cx-interview-btn cx-practice-prev">← Previous</button>
          <button class="cx-interview-btn cx-practice-next">Next →</button>
        </div>
      </div>
    `;

    // Accordion toggles
    body.querySelectorAll('.cx-qa-question').forEach(qEl => {
      qEl.addEventListener('click', () => {
        const card = qEl.closest('.cx-qa-card');
        const answer = card.querySelector('.cx-qa-answer');
        const chevron = card.querySelector('.cx-qa-chevron');
        answer.classList.toggle('open');
        chevron.classList.toggle('open');
      });
    });

    // Mode toggle
    const btnBrowse = body.querySelector('.cx-btn-browse');
    const btnPractice = body.querySelector('.cx-btn-practice');
    const qaList = body.querySelector('.cx-qa-list');
    const practiceContainer = body.querySelector('.cx-practice-container');

    btnBrowse.addEventListener('click', () => {
      btnBrowse.classList.add('active');
      btnPractice.classList.remove('active');
      qaList.classList.remove('hidden');
      practiceContainer.classList.remove('active');
    });

    btnPractice.addEventListener('click', () => {
      btnPractice.classList.add('active');
      btnBrowse.classList.remove('active');
      qaList.classList.add('hidden');
      practiceContainer.classList.add('active');
      practiceIndex = 0;
      showPracticeQuestion();
    });

    // Practice mode
    const progressEl = body.querySelector('.cx-practice-progress');
    const questionEl = body.querySelector('.cx-practice-question');
    const revealBtn = body.querySelector('.cx-practice-reveal');
    const answerBox = body.querySelector('.cx-practice-answer-box');
    const answerText = body.querySelector('.cx-practice-answer-text');
    const tipEl = body.querySelector('.cx-practice-tip');
    const tipText = body.querySelector('.cx-practice-tip-text');

    function showPracticeQuestion() {
      const q = questions[practiceIndex];
      progressEl.textContent = `Question ${practiceIndex + 1} of ${questions.length}`;
      questionEl.textContent = q.question;
      answerBox.classList.remove('open');
      answerText.textContent = q.suggestedAnswer;
      if (q.tip) {
        tipEl.style.display = 'flex';
        tipText.textContent = q.tip;
      } else {
        tipEl.style.display = 'none';
      }
    }

    revealBtn.addEventListener('click', () => {
      answerBox.classList.toggle('open');
    });

    body.querySelector('.cx-practice-prev').addEventListener('click', () => {
      practiceIndex = (practiceIndex - 1 + questions.length) % questions.length;
      showPracticeQuestion();
    });

    body.querySelector('.cx-practice-next').addEventListener('click', () => {
      practiceIndex = (practiceIndex + 1) % questions.length;
      showPracticeQuestion();
    });
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Export ──────────────────────────────────────────────────────────

  window.CortexInterviewPrep = { renderInterviewPrep };
})();
