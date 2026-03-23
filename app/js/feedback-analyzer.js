/**
 * CortexFeedbackAnalyzer
 * Analyzes client feedback sentiment and themes from work history data.
 * Exposed as window.CortexFeedbackAnalyzer
 */
(function () {
  'use strict';

  /* ── Theme keyword dictionaries ── */
  const THEME_KEYWORDS = {
    communication: [
      'responsive', 'communicated', 'kept me updated', 'great communicator',
      'communication', 'easy to work with', 'clear instructions', 'good listener',
      'promptly', 'available', 'reachable'
    ],
    quality: [
      'high quality', 'excellent work', 'amazing', 'exceeded expectations',
      'professional', 'top notch', 'outstanding', 'superb', 'great work',
      'well done', 'impressive', 'meticulous', 'thorough', 'flawless'
    ],
    deadline: [
      'on time', 'delivered early', 'fast', 'quick turnaround', 'met deadline',
      'ahead of schedule', 'timely', 'punctual', 'swift', 'speedy'
    ],
    expertise: [
      'expert', 'knowledgeable', 'skilled', 'talented', 'experienced',
      'knows their stuff', 'competent', 'proficient', 'specialist', 'guru'
    ],
    responsiveness: [
      'quick response', 'fast reply', 'always available', 'prompt',
      'responsive', 'replied quickly', 'got back to me', 'attentive'
    ],
    value: [
      'good value', 'worth every penny', 'affordable', 'fair price',
      'great deal', 'reasonable', 'cost effective', 'bang for the buck',
      'value for money', 'budget friendly'
    ]
  };

  const NEGATIVE_KEYWORDS = [
    'late', 'missed deadline', 'poor quality', 'unresponsive', 'disappointing',
    'slow', 'unprofessional', 'sloppy', 'incomplete', 'rushed', 'careless',
    'overcharged', 'never again', 'waste of money', 'not recommended',
    'terrible', 'awful', 'horrible', 'worst'
  ];

  const POSITIVE_WORDS = [
    'great', 'excellent', 'amazing', 'fantastic', 'wonderful', 'awesome',
    'perfect', 'brilliant', 'superb', 'outstanding', 'love', 'loved',
    'recommend', 'highly recommend', 'best', 'incredible', 'thank',
    'pleased', 'happy', 'satisfied', 'delighted', 'impressed'
  ];

  /* ── Single feedback analysis ── */
  function analyzeFeedback(entry) {
    const text = (entry.feedbackText || '').toLowerCase();
    const rating = entry.rating != null ? Number(entry.rating) : null;

    // Sentiment
    const hasPositiveWords = POSITIVE_WORDS.some(w => text.includes(w));
    const hasNegativeWords = NEGATIVE_KEYWORDS.some(w => text.includes(w));

    let sentiment;
    if (rating !== null) {
      if (rating >= 4 && !hasNegativeWords) sentiment = 'positive';
      else if (rating <= 3 && rating >= 1) sentiment = hasPositiveWords && rating === 3 ? 'neutral' : (rating < 3 ? 'negative' : 'neutral');
      else if (rating > 3 && rating < 4) sentiment = 'neutral';
      else sentiment = 'positive';
    } else {
      // No rating — rely on text
      if (hasNegativeWords && !hasPositiveWords) sentiment = 'negative';
      else if (hasPositiveWords && !hasNegativeWords) sentiment = 'positive';
      else sentiment = 'neutral';
    }

    // Override: strong negative words + low rating
    if (rating !== null && rating <= 2) sentiment = 'negative';
    if (hasNegativeWords && (rating === null || rating <= 3)) sentiment = 'negative';

    // Themes
    const themes = [];
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
      if (keywords.some(kw => text.includes(kw))) {
        themes.push(theme);
      }
    }

    return { sentiment, themes, text, rating, title: entry.title, earnedAmount: entry.earnedAmount };
  }

  /* ── Aggregate analysis ── */
  function aggregateAnalysis(workHistory) {
    const results = (workHistory || [])
      .filter(e => e.feedbackText || e.rating != null)
      .map(analyzeFeedback);

    const total = results.length || 1;
    const counts = { positive: 0, neutral: 0, negative: 0 };
    const themeCounts = {};
    let ratingSum = 0;
    let ratingCount = 0;
    const quotes = { positive: [], negative: [] };

    for (const r of results) {
      counts[r.sentiment]++;

      for (const t of r.themes) {
        themeCounts[t] = (themeCounts[t] || 0) + 1;
      }

      if (r.rating !== null) {
        ratingSum += r.rating;
        ratingCount++;
      }

      if (r.text && r.text.length > 10) {
        if (r.sentiment === 'positive') quotes.positive.push(r);
        if (r.sentiment === 'negative') quotes.negative.push(r);
      }
    }

    const pct = {
      positive: Math.round((counts.positive / total) * 100),
      neutral: Math.round((counts.neutral / total) * 100),
      negative: Math.round((counts.negative / total) * 100)
    };

    const sortedThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));

    const avgRating = ratingCount ? (ratingSum / ratingCount).toFixed(1) : null;

    // Build summary
    const topPositive = sortedThemes.filter(t => !['negative'].includes(t.name)).slice(0, 2).map(t => t.name);
    const hasNegativeTheme = sortedThemes.find(t => t.name === 'deadline' && counts.negative > 0);

    let summary = '';
    if (topPositive.length >= 2) {
      summary = `Clients love your ${topPositive[0]} and ${topPositive[1]}`;
    } else if (topPositive.length === 1) {
      summary = `Clients appreciate your ${topPositive[0]}`;
    } else {
      summary = 'Not enough feedback to identify strong themes yet';
    }
    if (hasNegativeTheme) {
      summary += ' but occasionally mention deadline issues';
    } else if (counts.negative > 0) {
      summary += `. ${counts.negative} client${counts.negative > 1 ? 's' : ''} left critical feedback — worth reviewing.`;
    } else {
      summary += '. Keep up the great work!';
    }

    return {
      results,
      counts,
      pct,
      sortedThemes,
      avgRating,
      quotes,
      summary,
      total: results.length
    };
  }

  /* ── SVG Donut Chart ── */
  function createDonutSVG(pct) {
    const size = 140;
    const cx = size / 2, cy = size / 2, r = 52, stroke = 14;
    const circumference = 2 * Math.PI * r;

    const segments = [
      { color: '#34d399', value: pct.positive },
      { color: '#6b7280', value: pct.neutral },
      { color: '#ef4444', value: pct.negative }
    ];

    let paths = '';
    let offset = 0;
    for (const seg of segments) {
      const len = (seg.value / 100) * circumference;
      if (seg.value > 0) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${seg.color}" stroke-width="${stroke}"
          stroke-dasharray="${len} ${circumference - len}"
          stroke-dashoffset="${-offset}"
          transform="rotate(-90 ${cx} ${cy})" />`;
      }
      offset += len;
    }

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1f2937" stroke-width="${stroke}" />
      ${paths}
    </svg>`;
  }

  /* ── Render ── */
  function renderFeedbackAnalysis(workHistory, container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;

    const a = aggregateAnalysis(workHistory);

    const themeLabel = {
      communication: '💬 Communication',
      quality: '⭐ Quality',
      deadline: '⏱️ Deadline',
      expertise: '🧠 Expertise',
      responsiveness: '⚡ Responsiveness',
      value: '💰 Value'
    };

    const themeBarsHTML = a.sortedThemes.map(t => `
      <div class="cfa-theme-row">
        <span class="cfa-theme-label">${themeLabel[t.name] || t.name}</span>
        <div class="cfa-theme-bar-bg">
          <div class="cfa-theme-bar" style="width:${Math.max(t.pct, 6)}%"></div>
        </div>
        <span class="cfa-theme-count">${t.count}</span>
      </div>
    `).join('');

    const pickQuotes = (list, max) => list.slice(0, max).map(q => {
      const preview = q.text.length > 120 ? q.text.slice(0, 117) + '…' : q.text;
      return `<div class="cfa-quote">
        <span class="cfa-quote-text">"${preview}"</span>
        ${q.title ? `<span class="cfa-quote-src">— ${q.title}</span>` : ''}
      </div>`;
    }).join('');

    const positiveQuotes = pickQuotes(a.quotes.positive, 3);
    const negativeQuotes = pickQuotes(a.quotes.negative, 2);

    container.innerHTML = `
      <style>
        .cfa-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb;max-width:720px}
        .cfa-card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:16px}
        .cfa-h2{font-size:16px;font-weight:600;color:#f9fafb;margin:0 0 14px}
        .cfa-h3{font-size:13px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px}

        /* Sentiment overview */
        .cfa-sent-grid{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
        .cfa-donut-wrap{flex-shrink:0}
        .cfa-sent-stats{display:flex;flex-direction:column;gap:6px}
        .cfa-sent-row{display:flex;align-items:center;gap:8px;font-size:14px}
        .cfa-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .cfa-dot--pos{background:#34d399}
        .cfa-dot--neu{background:#6b7280}
        .cfa-dot--neg{background:#ef4444}
        .cfa-sent-pct{font-weight:600;min-width:36px;text-align:right}
        .cfa-avg{font-size:28px;font-weight:700;color:#fbbf24;margin-left:auto;display:flex;align-items:center;gap:6px}
        .cfa-avg small{font-size:13px;color:#9ca3af;font-weight:400}

        /* Themes */
        .cfa-theme-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
        .cfa-theme-label{font-size:13px;min-width:140px;white-space:nowrap}
        .cfa-theme-bar-bg{flex:1;height:8px;background:#1f2937;border-radius:4px;overflow:hidden}
        .cfa-theme-bar{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:4px;transition:width .4s}
        .cfa-theme-count{font-size:12px;color:#9ca3af;min-width:20px;text-align:right}

        /* Quotes */
        .cfa-quote{background:#1f2937;border-radius:8px;padding:10px 14px;margin-bottom:8px}
        .cfa-quote-text{font-size:13px;color:#d1d5db;font-style:italic;display:block}
        .cfa-quote-src{font-size:11px;color:#6b7280;margin-top:4px;display:block}

        /* Summary */
        .cfa-summary{font-size:14px;line-height:1.6;color:#d1d5db}
        .cfa-summary strong{color:#f9fafb}
        .cfa-empty{color:#6b7280;font-size:14px;text-align:center;padding:30px 0}
      </style>

      <div class="cfa-root">
        ${a.total === 0 ? '<div class="cfa-empty">No feedback data to analyze yet.</div>' : `

        <!-- Sentiment Overview -->
        <div class="cfa-card">
          <div class="cfa-h2">Feedback Sentiment</div>
          <div class="cfa-sent-grid">
            <div class="cfa-donut-wrap">${createDonutSVG(a.pct)}</div>
            <div class="cfa-sent-stats">
              <div class="cfa-sent-row"><span class="cfa-dot cfa-dot--pos"></span><span class="cfa-sent-pct">${a.pct.positive}%</span> Positive (${a.counts.positive})</div>
              <div class="cfa-sent-row"><span class="cfa-dot cfa-dot--neu"></span><span class="cfa-sent-pct">${a.pct.neutral}%</span> Neutral (${a.counts.neutral})</div>
              <div class="cfa-sent-row"><span class="cfa-dot cfa-dot--neg"></span><span class="cfa-sent-pct">${a.pct.negative}%</span> Negative (${a.counts.negative})</div>
            </div>
            ${a.avgRating ? `<div class="cfa-avg">★ ${a.avgRating} <small>/ 5</small></div>` : ''}
          </div>
        </div>

        <!-- Themes -->
        ${a.sortedThemes.length ? `
        <div class="cfa-card">
          <div class="cfa-h2">Top Themes</div>
          ${themeBarsHTML}
        </div>` : ''}

        <!-- Notable Quotes -->
        ${positiveQuotes || negativeQuotes ? `
        <div class="cfa-card">
          <div class="cfa-h2">Notable Quotes</div>
          ${positiveQuotes ? `<div class="cfa-h3">🟢 Highlights</div>${positiveQuotes}` : ''}
          ${negativeQuotes ? `<div class="cfa-h3" style="margin-top:14px">🔴 Needs Attention</div>${negativeQuotes}` : ''}
        </div>` : ''}

        <!-- Summary -->
        <div class="cfa-card">
          <div class="cfa-h2">Summary</div>
          <div class="cfa-summary">
            ${a.summary}
            ${a.avgRating ? `<br><strong>${a.total} reviews</strong> analyzed · Average rating <strong>${a.avgRating}/5</strong>` : ''}
          </div>
        </div>

        `}
      </div>
    `;
  }

  /* ── Public API ── */
  window.CortexFeedbackAnalyzer = {
    analyze: aggregateAnalysis,
    analyzeSingle: analyzeFeedback,
    render: renderFeedbackAnalysis,
    renderFeedbackAnalysis: renderFeedbackAnalysis
  };

})();
