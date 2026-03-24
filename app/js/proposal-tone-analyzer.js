/**
 * [CF-034] Proposal Tone Analyzer — Professional vs Casual scoring
 * Exposed as window.CortexProposalTone
 */
(function () {
  'use strict';

  // ── Word lists ──
  const FORMAL_WORDS = [
    'regarding', 'hereby', 'pursuant', 'enclosed', 'accordingly',
    'furthermore', 'therefore', 'henceforth', 'whereas', 'notwithstanding',
    'aforementioned', 'herein', 'therein', 'facilitate', 'commence',
    'subsequently', 'nevertheless', 'consequently', 'respectively', 'endeavor',
    'undertake', 'pertaining', 'shall', 'forthwith', 'deem',
  ];

  const CASUAL_WORDS = [
    'hey', 'awesome', 'cool', 'gonna', 'stuff', 'basically',
    'wanna', 'kinda', 'sorta', 'lol', 'btw', 'tbh', 'imho',
    'tons', 'super', 'guys', 'yeah', 'yep', 'nope', 'legit',
    'chill', 'vibe', 'dope', 'sick', 'lit', 'fyi',
  ];

  const FORMAL_GREETINGS = ['dear', 'esteemed', 'respected'];
  const NEUTRAL_GREETINGS = ['hello', 'hi', 'greetings'];
  const CASUAL_GREETINGS = ['hey', 'yo', 'sup', 'hiya', 'heya'];

  const FORMAL_CLOSINGS = ['sincerely', 'respectfully', 'yours truly', 'yours faithfully', 'kind regards'];
  const NEUTRAL_CLOSINGS = ['best', 'best regards', 'regards', 'thanks', 'thank you'];
  const CASUAL_CLOSINGS = ['cheers', 'later', 'peace', 'take care', 'ciao', 'ttyl'];

  // ── Helpers ──
  function wordsIn(text) {
    return text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  }

  function countMatches(words, list) {
    let count = 0;
    const positions = [];
    words.forEach((w, i) => {
      if (list.includes(w)) { count++; positions.push({ word: w, index: i }); }
    });
    return { count, positions };
  }

  function detectGreeting(text) {
    const first = text.trim().split(/\n/)[0].toLowerCase();
    for (const g of FORMAL_GREETINGS)  if (first.includes(g)) return { type: 'formal', word: g, score: 20 };
    for (const g of CASUAL_GREETINGS)  if (first.includes(g)) return { type: 'casual', word: g, score: -15 };
    for (const g of NEUTRAL_GREETINGS) if (first.includes(g)) return { type: 'neutral', word: g, score: 5 };
    return { type: 'none', word: null, score: 0 };
  }

  function detectClosing(text) {
    const lines = text.trim().split(/\n/).filter(Boolean);
    const last3 = lines.slice(-3).join(' ').toLowerCase();
    for (const c of FORMAL_CLOSINGS)  if (last3.includes(c)) return { type: 'formal', word: c, score: 15 };
    for (const c of CASUAL_CLOSINGS)  if (last3.includes(c)) return { type: 'casual', word: c, score: -10 };
    for (const c of NEUTRAL_CLOSINGS) if (last3.includes(c)) return { type: 'neutral', word: c, score: 5 };
    return { type: 'none', word: null, score: 0 };
  }

  function classifyTone(score) {
    if (score >= 80) return 'very-formal';
    if (score >= 60) return 'professional';
    if (score >= 40) return 'balanced';
    if (score >= 20) return 'casual';
    return 'too-casual';
  }

  function buildSuggestions(formalCount, casualCount, greeting, closing, score) {
    const s = [];
    if (greeting.type === 'casual')
      s.push(`Consider replacing '${capitalize(greeting.word)}' with 'Hello' or 'Hi' for a more professional tone`);
    if (greeting.type === 'formal' && score > 70)
      s.push(`'${capitalize(greeting.word)}' feels very formal — 'Hello' or 'Hi' may feel warmer`);
    if (closing.type === 'casual')
      s.push(`'${capitalize(closing.word)}' is informal — consider 'Best regards' or 'Thanks'`);
    if (closing.type === 'none')
      s.push('Add a closing like "Best regards" or "Thanks" for a polished finish');
    if (casualCount > 3)
      s.push('Several casual words detected — tighten language for client-facing proposals');
    if (formalCount > 6)
      s.push('Heavy formal language may seem stiff — aim for a conversational-yet-professional tone');
    if (score >= 40 && score <= 70 && s.length === 0)
      s.push('Tone looks great — within the ideal range for winning proposals');
    return s;
  }

  function capitalize(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  // ── Core: analyzeTone ──
  function analyzeTone(proposalText) {
    if (!proposalText || typeof proposalText !== 'string') {
      return { formalityScore: 50, tone: 'balanced', formalWordCount: 0, casualWordCount: 0, suggestions: ['Paste a proposal to analyze'], idealRange: { min: 40, max: 70, note: 'Most successful proposals score 50-65' } };
    }

    const words = wordsIn(proposalText);
    const totalWords = words.length || 1;

    const formal = countMatches(words, FORMAL_WORDS);
    const casual = countMatches(words, CASUAL_WORDS);

    const greeting = detectGreeting(proposalText);
    const closing = detectClosing(proposalText);

    // Base score: start at 50 (neutral)
    let score = 50;

    // Word density adjustments
    const formalDensity = formal.count / totalWords;
    const casualDensity = casual.count / totalWords;
    score += formalDensity * 600;   // formal words push up
    score -= casualDensity * 600;   // casual words push down

    // Greeting & closing
    score += greeting.score;
    score += closing.score;

    // Sentence length — longer avg = more formal
    const sentences = proposalText.split(/[.!?]+/).filter(s => s.trim().length > 3);
    const avgLen = sentences.length ? sentences.reduce((a, s) => a + wordsIn(s).length, 0) / sentences.length : 12;
    if (avgLen > 20) score += 5;
    if (avgLen < 8) score -= 5;

    // Clamp
    score = Math.max(0, Math.min(100, Math.round(score)));

    const suggestions = buildSuggestions(formal.count, casual.count, greeting, closing, score);

    return {
      formalityScore: score,
      tone: classifyTone(score),
      formalWordCount: formal.count,
      casualWordCount: casual.count,
      formalPositions: formal.positions,
      casualPositions: casual.positions,
      greeting,
      closing,
      suggestions,
      idealRange: { min: 40, max: 70, note: 'Most successful proposals score 50-65' },
    };
  }

  // ── Styles (injected once) ──
  const STYLE_ID = 'cortex-tone-analyzer-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      .cta-container{background:#111118;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:1.25rem;margin-top:1rem;font-family:inherit}
      .cta-title{font-size:.82rem;font-weight:800;color:#f0f0f0;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}
      .cta-title span{font-size:1rem}

      /* Meter */
      .cta-meter-wrap{position:relative;height:28px;margin-bottom:.6rem}
      .cta-meter{height:10px;border-radius:100px;background:linear-gradient(90deg,#ff4444 0%,#ff8844 25%,#00ff88 50%,#4488ff 75%,#6644ff 100%);position:relative;top:9px}
      .cta-ideal{position:absolute;top:5px;height:18px;border:2px solid rgba(0,255,136,.35);border-radius:6px;background:rgba(0,255,136,.06);pointer-events:none}
      .cta-ideal-label{position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:.6rem;font-weight:700;color:#00ff88;white-space:nowrap;letter-spacing:.5px;text-transform:uppercase}
      .cta-marker{position:absolute;top:2px;width:24px;height:24px;border-radius:50%;background:#f0f0f0;border:3px solid #111118;box-shadow:0 2px 10px rgba(0,0,0,.5);transform:translateX(-50%);transition:left .4s ease;z-index:2}

      /* Score badge */
      .cta-score-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
      .cta-badge{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .8rem;border-radius:100px;font-size:.82rem;font-weight:800}
      .cta-badge.very-formal{background:rgba(102,68,255,.15);color:#8866ff}
      .cta-badge.professional{background:rgba(68,136,255,.15);color:#4488ff}
      .cta-badge.balanced{background:rgba(0,255,136,.12);color:#00ff88}
      .cta-badge.casual{background:rgba(255,136,68,.12);color:#ff8844}
      .cta-badge.too-casual{background:rgba(255,68,68,.12);color:#ff4444}
      .cta-score-num{font-size:1.6rem;font-weight:900;color:#f0f0f0}

      /* Counts */
      .cta-counts{display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap}
      .cta-count{font-size:.75rem;font-weight:700;padding:.25rem .65rem;border-radius:100px}
      .cta-count-formal{background:rgba(68,136,255,.1);color:#4488ff}
      .cta-count-casual{background:rgba(255,136,68,.1);color:#ff8844}

      /* Highlighted text */
      .cta-text-preview{background:#1a1a22;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:1rem;font-size:.85rem;line-height:1.8;color:#999;max-height:180px;overflow-y:auto;margin-bottom:1rem;white-space:pre-wrap;word-break:break-word}
      .cta-hl-formal{background:rgba(68,136,255,.18);color:#6aa4ff;padding:1px 3px;border-radius:4px}
      .cta-hl-casual{background:rgba(255,136,68,.18);color:#ffaa66;padding:1px 3px;border-radius:4px}

      /* Suggestions */
      .cta-suggestions{list-style:none;padding:0;margin:0}
      .cta-suggestions li{font-size:.8rem;color:#999;padding:.4rem 0 .4rem 1.2rem;position:relative;line-height:1.5}
      .cta-suggestions li::before{content:'💡';position:absolute;left:0;top:.35rem;font-size:.75rem}
      .cta-no-text{color:#555;font-size:.85rem;text-align:center;padding:2rem 0}
    `;
    document.head.appendChild(el);
  }

  // ── Render: highlightedText ──
  function highlightText(text, formalPositions, casualPositions) {
    const words = text.split(/(\s+)/);
    let wordIdx = 0;
    const formalSet = new Set(FORMAL_WORDS);
    const casualSet = new Set(CASUAL_WORDS);

    return words.map(token => {
      if (/^\s+$/.test(token)) return token;
      const clean = token.toLowerCase().replace(/[^a-z']/g, '');
      wordIdx++;
      if (formalSet.has(clean)) return `<span class="cta-hl-formal">${escapeHtml(token)}</span>`;
      if (casualSet.has(clean)) return `<span class="cta-hl-casual">${escapeHtml(token)}</span>`;
      return escapeHtml(token);
    }).join('');
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Render: tone meter + UI ──
  function renderToneAnalyzer(proposalText, container) {
    injectStyles();

    if (!container) return;

    const result = analyzeTone(proposalText);
    const { formalityScore, tone, formalWordCount, casualWordCount, suggestions, idealRange, formalPositions, casualPositions } = result;

    const toneLabels = {
      'very-formal': '🎩 Very Formal',
      'professional': '💼 Professional',
      'balanced': '✅ Balanced',
      'casual': '😎 Casual',
      'too-casual': '⚠️ Too Casual',
    };

    const idealLeft = idealRange.min;
    const idealWidth = idealRange.max - idealRange.min;

    let html = `
      <div class="cta-container">
        <div class="cta-title"><span>🎯</span> Tone Analysis</div>

        <!-- Meter -->
        <div class="cta-meter-wrap">
          <div class="cta-meter"></div>
          <div class="cta-ideal" style="left:${idealLeft}%;width:${idealWidth}%">
            <span class="cta-ideal-label">Ideal</span>
          </div>
          <div class="cta-marker" style="left:${formalityScore}%"></div>
        </div>

        <!-- Score + Badge -->
        <div class="cta-score-row">
          <span class="cta-badge ${tone}">${toneLabels[tone] || tone}</span>
          <span class="cta-score-num">${formalityScore}</span>
        </div>

        <!-- Counts -->
        <div class="cta-counts">
          <span class="cta-count cta-count-formal">📘 ${formalWordCount} formal word${formalWordCount !== 1 ? 's' : ''}</span>
          <span class="cta-count cta-count-casual">📙 ${casualWordCount} casual word${casualWordCount !== 1 ? 's' : ''}</span>
        </div>
    `;

    // Highlighted preview
    if (proposalText && proposalText.trim()) {
      const preview = proposalText.length > 1200 ? proposalText.slice(0, 1200) + '…' : proposalText;
      html += `<div class="cta-text-preview">${highlightText(preview, formalPositions, casualPositions)}</div>`;
    }

    // Suggestions
    if (suggestions.length) {
      html += '<ul class="cta-suggestions">';
      suggestions.forEach(s => { html += `<li>${escapeHtml(s)}</li>`; });
      html += '</ul>';
    }

    html += '</div>';
    container.innerHTML = html;

    return result;
  }

  // ── Wire into Proposal Generator if present ──
  function wireProposalGenerator() {
    // Observe DOM for proposal panels being rendered, then auto-analyze
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const panels = node.querySelectorAll ? node.querySelectorAll('.cpg-panel') : [];
          panels.forEach(panel => {
            const textEl = panel.querySelector('.cpg-proposal-text');
            if (!textEl) return;
            // Skip if already analyzed
            if (panel.querySelector('.cta-container')) return;
            const text = textEl.textContent || '';
            if (text.length < 10) return;
            const analyzerDiv = document.createElement('div');
            analyzerDiv.className = 'cta-auto-attached';
            panel.appendChild(analyzerDiv);
            renderToneAnalyzer(text, analyzerDiv);
          });
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireProposalGenerator);
  } else {
    wireProposalGenerator();
  }

  // ── Expose ──
  window.CortexProposalTone = {
    analyzeTone,
    renderToneAnalyzer,
  };

})();
