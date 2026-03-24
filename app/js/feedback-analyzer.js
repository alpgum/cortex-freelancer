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

  /* ── [CF-073] Review Pattern Analyzer ── */

  /**
   * Find recurring patterns in client feedback — praise themes,
   * criticism patterns, sentiment trends over time, and actionable insights.
   */
  function analyzePatterns(feedbackEntries) {
    if (!feedbackEntries || !feedbackEntries.length) {
      return { hasData: false, patterns: [], trends: [], insights: [], wordCloud: [] };
    }

    var analyzed = feedbackEntries.map(function (entry) {
      var text = typeof entry === 'string' ? entry : (entry.feedback || entry.comment || entry.text || '');
      var rating = typeof entry === 'object' ? (entry.rating || 0) : 0;
      var date = typeof entry === 'object' ? (entry.date || entry.endDate || null) : null;
      return { text: text, rating: rating, date: date, analysis: analyzeFeedback(text) };
    });

    // Praise patterns (recurring positive themes)
    var praiseMap = {};
    var criticismMap = {};
    var phraseFrequency = {};

    analyzed.forEach(function (item) {
      var lower = item.text.toLowerCase();

      // Extract meaningful phrases (2-3 word ngrams)
      var words = lower.replace(/[^a-z\s]/g, '').split(/\s+/).filter(function (w) { return w.length > 3; });
      for (var i = 0; i < words.length - 1; i++) {
        var bigram = words[i] + ' ' + words[i + 1];
        phraseFrequency[bigram] = (phraseFrequency[bigram] || 0) + 1;
        if (i < words.length - 2) {
          var trigram = bigram + ' ' + words[i + 2];
          phraseFrequency[trigram] = (phraseFrequency[trigram] || 0) + 1;
        }
      }

      // Map themes to praise/criticism
      Object.keys(THEME_KEYWORDS).forEach(function (theme) {
        var matches = THEME_KEYWORDS[theme].filter(function (kw) {
          return lower.includes(kw.toLowerCase());
        });
        if (matches.length > 0) {
          if (item.analysis.sentiment === 'positive' || item.rating >= 4) {
            praiseMap[theme] = (praiseMap[theme] || 0) + matches.length;
          } else if (item.analysis.sentiment === 'negative' || item.rating <= 2) {
            criticismMap[theme] = (criticismMap[theme] || 0) + matches.length;
          }
        }
      });
    });

    // Sort praise and criticism by frequency
    var praisePatterns = Object.keys(praiseMap).map(function (k) {
      return { theme: k, count: praiseMap[k], type: 'praise' };
    }).sort(function (a, b) { return b.count - a.count; });

    var criticismPatterns = Object.keys(criticismMap).map(function (k) {
      return { theme: k, count: criticismMap[k], type: 'criticism' };
    }).sort(function (a, b) { return b.count - a.count; });

    // Recurring phrases (word cloud data)
    var wordCloud = Object.keys(phraseFrequency)
      .filter(function (p) { return phraseFrequency[p] >= 2; })
      .map(function (p) { return { phrase: p, count: phraseFrequency[p] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 20);

    // Sentiment trend over time
    var trends = [];
    var datedEntries = analyzed.filter(function (a) { return a.date; }).sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });

    if (datedEntries.length >= 3) {
      // Rolling average sentiment
      for (var i = 0; i < datedEntries.length; i++) {
        var windowStart = Math.max(0, i - 2);
        var window = datedEntries.slice(windowStart, i + 1);
        var avgScore = window.reduce(function (s, e) { return s + e.analysis.score; }, 0) / window.length;
        trends.push({
          date: datedEntries[i].date,
          sentimentScore: Math.round(avgScore * 100) / 100,
          rating: datedEntries[i].rating,
        });
      }
    }

    // Detect sentiment direction
    var sentimentDirection = 'stable';
    if (trends.length >= 4) {
      var firstHalf = trends.slice(0, Math.floor(trends.length / 2));
      var secondHalf = trends.slice(Math.floor(trends.length / 2));
      var firstAvg = firstHalf.reduce(function (s, t) { return s + t.sentimentScore; }, 0) / firstHalf.length;
      var secondAvg = secondHalf.reduce(function (s, t) { return s + t.sentimentScore; }, 0) / secondHalf.length;
      if (secondAvg > firstAvg + 0.1) sentimentDirection = 'improving';
      else if (secondAvg < firstAvg - 0.1) sentimentDirection = 'declining';
    }

    // Generate actionable insights
    var insights = [];

    if (praisePatterns.length > 0) {
      insights.push({
        type: 'strength',
        icon: '💪',
        text: 'Your strongest areas: ' + praisePatterns.slice(0, 3).map(function (p) { return p.theme; }).join(', ') + '. Highlight these in your profile.',
      });
    }

    if (criticismPatterns.length > 0) {
      insights.push({
        type: 'improvement',
        icon: '🎯',
        text: 'Areas to improve: ' + criticismPatterns.slice(0, 2).map(function (p) { return p.theme; }).join(', ') + '. Address these proactively in proposals.',
      });
    }

    if (sentimentDirection === 'improving') {
      insights.push({ type: 'trend', icon: '📈', text: 'Your feedback sentiment is trending upward — great trajectory! Keep doing what you\'re doing.' });
    } else if (sentimentDirection === 'declining') {
      insights.push({ type: 'trend', icon: '📉', text: 'Feedback sentiment is declining. Review recent projects for patterns — consider adjusting your approach.' });
    }

    var avgRating = analyzed.reduce(function (s, a) { return s + a.rating; }, 0) / analyzed.length;
    if (avgRating >= 4.8) {
      insights.push({ type: 'badge', icon: '⭐', text: 'Average rating of ' + avgRating.toFixed(1) + '/5 — you\'re in the top tier. Use this in your proposals.' });
    } else if (avgRating > 0 && avgRating < 4.0) {
      insights.push({ type: 'warning', icon: '⚠️', text: 'Average rating is ' + avgRating.toFixed(1) + '/5. Focus on the criticism patterns above to improve.' });
    }

    // Consistency analysis
    var ratings = analyzed.filter(function (a) { return a.rating > 0; }).map(function (a) { return a.rating; });
    if (ratings.length >= 3) {
      var ratingStd = stdDev(ratings);
      if (ratingStd < 0.3) {
        insights.push({ type: 'consistency', icon: '🎯', text: 'Very consistent ratings (σ=' + ratingStd.toFixed(2) + ') — clients know what to expect from you.' });
      } else if (ratingStd > 1.0) {
        insights.push({ type: 'consistency', icon: '🎲', text: 'Ratings vary significantly (σ=' + ratingStd.toFixed(2) + '). Look for patterns in lower-rated projects.' });
      }
    }

    return {
      hasData: true,
      praisePatterns: praisePatterns,
      criticismPatterns: criticismPatterns,
      wordCloud: wordCloud,
      trends: trends,
      sentimentDirection: sentimentDirection,
      insights: insights,
      totalReviews: analyzed.length,
      avgRating: avgRating > 0 ? Math.round(avgRating * 10) / 10 : null,
    };
  }

  function stdDev(arr) {
    var mean = arr.reduce(function (s, v) { return s + v; }, 0) / arr.length;
    var sqDiffs = arr.map(function (v) { return Math.pow(v - mean, 2); });
    return Math.sqrt(sqDiffs.reduce(function (s, v) { return s + v; }, 0) / arr.length);
  }

  /**
   * Render pattern analysis into a container
   */
  function renderPatternAnalysis(feedbackEntries, container) {
    if (!container) return;
    var p = analyzePatterns(feedbackEntries);

    if (!p.hasData) {
      container.innerHTML = '<div style="color:#6b7280;font-size:14px;text-align:center;padding:30px;">No feedback data to analyze patterns.</div>';
      return p;
    }

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:720px;">';

    // Insights card
    if (p.insights.length) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 12px;color:#7c83ff;font-size:16px;">💡 Actionable Insights</h3>';
      p.insights.forEach(function (ins) {
        var borderColor = ins.type === 'strength' ? '#00d4aa' : ins.type === 'improvement' ? '#f97316' : ins.type === 'warning' ? '#ef4444' : '#7c83ff';
        html += '<div style="background:#1a1a2e;border-left:3px solid ' + borderColor + ';border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px;">';
        html += '<span style="font-size:14px;">' + ins.icon + '</span> <span style="font-size:13px;color:#d1d5db;">' + escP(ins.text) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Praise & Criticism patterns
    if (p.praisePatterns.length || p.criticismPatterns.length) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 12px;color:#7c83ff;font-size:16px;">🔍 Recurring Patterns</h3>';
      html += '<div style="display:flex;gap:16px;flex-wrap:wrap;">';

      if (p.praisePatterns.length) {
        html += '<div style="flex:1;min-width:200px;">';
        html += '<div style="font-size:12px;color:#00d4aa;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🟢 Praise Themes</div>';
        p.praisePatterns.forEach(function (pp) {
          var barW = Math.min(100, pp.count * 20);
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
          html += '<span style="font-size:12px;min-width:100px;color:#d1d5db;">' + escP(pp.theme) + '</span>';
          html += '<div style="flex:1;height:6px;background:#1f2937;border-radius:3px;"><div style="width:' + barW + '%;height:100%;background:#00d4aa;border-radius:3px;"></div></div>';
          html += '<span style="font-size:11px;color:#888;">' + pp.count + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      if (p.criticismPatterns.length) {
        html += '<div style="flex:1;min-width:200px;">';
        html += '<div style="font-size:12px;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔴 Criticism Themes</div>';
        p.criticismPatterns.forEach(function (cp) {
          var barW = Math.min(100, cp.count * 20);
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
          html += '<span style="font-size:12px;min-width:100px;color:#d1d5db;">' + escP(cp.theme) + '</span>';
          html += '<div style="flex:1;height:6px;background:#1f2937;border-radius:3px;"><div style="width:' + barW + '%;height:100%;background:#ef4444;border-radius:3px;"></div></div>';
          html += '<span style="font-size:11px;color:#888;">' + cp.count + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div></div>';
    }

    // Word cloud (top recurring phrases)
    if (p.wordCloud.length) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 12px;color:#7c83ff;font-size:16px;">☁️ Recurring Phrases</h3>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      p.wordCloud.forEach(function (w) {
        var size = Math.min(18, 11 + w.count * 2);
        var opacity = Math.min(1, 0.5 + w.count * 0.15);
        html += '<span style="font-size:' + size + 'px;color:rgba(124,131,255,' + opacity + ');background:#1a1a2e;padding:4px 10px;border-radius:6px;">' + escP(w.phrase) + ' <sup style="font-size:9px;color:#888;">' + w.count + '</sup></span>';
      });
      html += '</div></div>';
    }

    // Sentiment trend
    if (p.trends.length >= 3) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 4px;color:#7c83ff;font-size:16px;">📈 Sentiment Trend <span style="font-size:12px;color:' + (p.sentimentDirection === 'improving' ? '#00d4aa' : p.sentimentDirection === 'declining' ? '#ef4444' : '#888') + ';">(' + p.sentimentDirection + ')</span></h3>';
      html += '<div style="display:flex;align-items:flex-end;gap:4px;height:60px;margin-top:12px;">';
      var maxScore = Math.max.apply(null, p.trends.map(function (t) { return Math.abs(t.sentimentScore); }));
      p.trends.forEach(function (t) {
        var h = Math.max(4, Math.round((t.sentimentScore / (maxScore || 1)) * 50));
        var color = t.sentimentScore >= 0.5 ? '#00d4aa' : t.sentimentScore >= 0 ? '#fbbf24' : '#ef4444';
        html += '<div title="' + (t.date || '') + ': ' + t.sentimentScore + '" style="flex:1;height:' + h + 'px;background:' + color + ';border-radius:2px 2px 0 0;min-width:6px;"></div>';
      });
      html += '</div>';
      html += '<div style="font-size:10px;color:#888;margin-top:4px;display:flex;justify-content:space-between;"><span>Oldest</span><span>Most Recent</span></div>';
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    return p;
  }

  function escP(str) { if (!str) return ''; var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  /* ── Public API ── */
  window.CortexFeedbackAnalyzer = {
    analyze: aggregateAnalysis,
    analyzeSingle: analyzeFeedback,
    analyzePatterns: analyzePatterns,
    render: renderFeedbackAnalysis,
    renderFeedbackAnalysis: renderFeedbackAnalysis,
    renderPatternAnalysis: renderPatternAnalysis,
    version: '2.0.0'
  };

})();
