/**
 * [CF-073] Feedback Analyzer for Review Patterns
 * Find patterns in client feedback, identify recurring praise/criticism,
 * track sentiment trends over time, and surface actionable insights.
 * Exposed as window.CortexFreelancer.FeedbackAnalyzer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ══════════════════════════════════════════════
   * STORAGE
   * ══════════════════════════════════════════════ */
  var STORAGE_KEY = 'cortex_feedback_data';

  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }
  function saveFeedback(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * THEME KEYWORD DICTIONARIES
   * ══════════════════════════════════════════════ */
  var THEME_KEYWORDS = {
    communication: [
      'responsive', 'communicated', 'kept me updated', 'great communicator',
      'communication', 'easy to work with', 'clear instructions', 'good listener',
      'promptly', 'available', 'reachable', 'clear communication', 'kept informed',
    ],
    quality: [
      'high quality', 'excellent work', 'amazing', 'exceeded expectations',
      'professional', 'top notch', 'outstanding', 'superb', 'great work',
      'well done', 'impressive', 'meticulous', 'thorough', 'flawless',
      'attention to detail', 'pixel perfect', 'clean code', 'well structured',
    ],
    deadline: [
      'on time', 'delivered early', 'fast', 'quick turnaround', 'met deadline',
      'ahead of schedule', 'timely', 'punctual', 'swift', 'speedy',
    ],
    expertise: [
      'expert', 'knowledgeable', 'skilled', 'talented', 'experienced',
      'knows their stuff', 'competent', 'proficient', 'specialist', 'guru',
      'deep understanding', 'technical expertise',
    ],
    proactivity: [
      'proactive', 'suggested', 'initiative', 'went above and beyond',
      'extra mile', 'beyond expectations', 'anticipated', 'recommended improvements',
      'took initiative', 'self-starter',
    ],
    value: [
      'good value', 'worth every penny', 'affordable', 'fair price',
      'great deal', 'reasonable', 'cost effective', 'bang for the buck',
      'value for money', 'budget friendly',
    ],
    reliability: [
      'reliable', 'dependable', 'consistent', 'trustworthy', 'counted on',
      'always delivers', 'never disappointed', 'rock solid',
    ],
  };

  var NEGATIVE_KEYWORDS = {
    missed_deadlines: ['late', 'missed deadline', 'delayed', 'behind schedule', 'took too long', 'slow delivery'],
    poor_quality: ['poor quality', 'sloppy', 'incomplete', 'rushed', 'careless', 'bugs', 'errors', 'broken'],
    communication_issues: ['unresponsive', 'hard to reach', 'didn\'t communicate', 'no updates', 'ghosted', 'silent'],
    scope_issues: ['scope creep', 'overcharged', 'unexpected costs', 'more than quoted', 'hidden fees'],
    professionalism: ['unprofessional', 'rude', 'dismissive', 'arrogant', 'difficult to work with'],
    general_negative: ['disappointing', 'never again', 'waste of money', 'not recommended', 'terrible', 'awful', 'worst'],
  };

  var POSITIVE_WORDS = [
    'great', 'excellent', 'amazing', 'fantastic', 'wonderful', 'awesome',
    'perfect', 'brilliant', 'superb', 'outstanding', 'love', 'loved',
    'recommend', 'highly recommend', 'best', 'incredible', 'thank',
    'pleased', 'happy', 'satisfied', 'delighted', 'impressed',
  ];

  /* ══════════════════════════════════════════════
   * SINGLE FEEDBACK ANALYSIS
   * ══════════════════════════════════════════════ */

  function analyzeSingle(entry) {
    var text = (entry.feedbackText || '').toLowerCase();
    var rating = entry.rating != null ? Number(entry.rating) : null;

    // Sentiment scoring
    var positiveCount = POSITIVE_WORDS.filter(function (w) { return text.includes(w); }).length;
    var negativeCount = 0;
    var negativeCategories = [];

    Object.keys(NEGATIVE_KEYWORDS).forEach(function (cat) {
      var matched = NEGATIVE_KEYWORDS[cat].filter(function (w) { return text.includes(w); });
      if (matched.length > 0) {
        negativeCount += matched.length;
        negativeCategories.push({ category: cat, keywords: matched });
      }
    });

    // Determine sentiment
    var sentiment;
    var sentimentScore; // -1 to 1
    if (rating !== null) {
      if (rating >= 4.5) { sentiment = 'very_positive'; sentimentScore = 1; }
      else if (rating >= 3.5) { sentiment = negativeCount > 0 ? 'mixed' : 'positive'; sentimentScore = 0.5; }
      else if (rating >= 2.5) { sentiment = 'neutral'; sentimentScore = 0; }
      else { sentiment = 'negative'; sentimentScore = -0.5; }
      if (rating <= 2) { sentiment = 'very_negative'; sentimentScore = -1; }
    } else {
      sentimentScore = (positiveCount - negativeCount * 2) / Math.max(positiveCount + negativeCount, 1);
      if (sentimentScore > 0.5) sentiment = 'positive';
      else if (sentimentScore > 0) sentiment = 'mixed';
      else if (sentimentScore > -0.5) sentiment = 'neutral';
      else sentiment = 'negative';
    }

    // Positive themes
    var themes = [];
    Object.keys(THEME_KEYWORDS).forEach(function (theme) {
      var matched = THEME_KEYWORDS[theme].filter(function (kw) { return text.includes(kw); });
      if (matched.length > 0) {
        themes.push({ theme: theme, matchCount: matched.length, keywords: matched });
      }
    });

    // Extract key phrases (simple n-gram extraction)
    var keyPhrases = [];
    var words = text.split(/\s+/).filter(function (w) { return w.length > 3; });
    for (var i = 0; i < words.length - 1; i++) {
      var bigram = words[i] + ' ' + words[i + 1];
      if (POSITIVE_WORDS.some(function (pw) { return bigram.includes(pw); }) ||
          Object.values(THEME_KEYWORDS).some(function (kws) { return kws.some(function (kw) { return bigram.includes(kw); }); })) {
        keyPhrases.push(bigram);
      }
    }

    return {
      sentiment: sentiment,
      sentimentScore: sentimentScore,
      themes: themes,
      negativeCategories: negativeCategories,
      keyPhrases: keyPhrases.slice(0, 5),
      text: entry.feedbackText || '',
      rating: rating,
      title: entry.title || '',
      earnedAmount: entry.earnedAmount || 0,
      date: entry.endDate || entry.date || null,
    };
  }

  /* ══════════════════════════════════════════════
   * PATTERN DETECTION
   * ══════════════════════════════════════════════ */

  function detectPatterns(results) {
    var patterns = {
      recurringPraise: [],
      recurringCriticism: [],
      sentimentTrend: 'stable',
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };

    if (results.length < 2) return patterns;

    // Count theme frequencies
    var themeFreq = {};
    var negCatFreq = {};

    results.forEach(function (r) {
      r.themes.forEach(function (t) {
        themeFreq[t.theme] = (themeFreq[t.theme] || 0) + 1;
      });
      r.negativeCategories.forEach(function (nc) {
        negCatFreq[nc.category] = (negCatFreq[nc.category] || 0) + 1;
      });
    });

    // Recurring praise (mentioned in 30%+ of reviews)
    var threshold = Math.max(2, Math.ceil(results.length * 0.3));
    Object.keys(themeFreq).forEach(function (theme) {
      if (themeFreq[theme] >= threshold) {
        patterns.recurringPraise.push({
          theme: theme,
          count: themeFreq[theme],
          percentage: Math.round((themeFreq[theme] / results.length) * 100),
        });
      }
    });
    patterns.recurringPraise.sort(function (a, b) { return b.count - a.count; });

    // Recurring criticism
    Object.keys(negCatFreq).forEach(function (cat) {
      if (negCatFreq[cat] >= 2) {
        patterns.recurringCriticism.push({
          category: cat,
          count: negCatFreq[cat],
          percentage: Math.round((negCatFreq[cat] / results.length) * 100),
        });
      }
    });

    // Sentiment trend (compare first half vs second half)
    var half = Math.floor(results.length / 2);
    var firstHalf = results.slice(0, half);
    var secondHalf = results.slice(half);

    var avgFirst = firstHalf.reduce(function (s, r) { return s + r.sentimentScore; }, 0) / (firstHalf.length || 1);
    var avgSecond = secondHalf.reduce(function (s, r) { return s + r.sentimentScore; }, 0) / (secondHalf.length || 1);

    if (avgSecond - avgFirst > 0.2) patterns.sentimentTrend = 'improving';
    else if (avgFirst - avgSecond > 0.2) patterns.sentimentTrend = 'declining';

    // Top strengths (most praised themes)
    patterns.strengths = patterns.recurringPraise.slice(0, 3).map(function (p) { return p.theme; });

    // Weaknesses
    patterns.weaknesses = patterns.recurringCriticism.slice(0, 3).map(function (c) { return c.category; });

    // Generate recommendations
    if (patterns.weaknesses.indexOf('missed_deadlines') >= 0) {
      patterns.recommendations.push({
        priority: 'high',
        text: 'Multiple clients mention deadline issues. Consider adding buffer time to estimates and using milestone-based delivery.',
      });
    }
    if (patterns.weaknesses.indexOf('communication_issues') >= 0) {
      patterns.recommendations.push({
        priority: 'high',
        text: 'Communication is flagged as a concern. Set up daily/weekly update schedules with clients proactively.',
      });
    }
    if (patterns.weaknesses.indexOf('poor_quality') >= 0) {
      patterns.recommendations.push({
        priority: 'high',
        text: 'Quality concerns detected. Implement a review checklist before delivering work.',
      });
    }
    if (patterns.strengths.indexOf('communication') >= 0) {
      patterns.recommendations.push({
        priority: 'low',
        text: 'Communication is consistently praised — highlight this in your profile and proposals.',
      });
    }
    if (patterns.strengths.indexOf('quality') >= 0) {
      patterns.recommendations.push({
        priority: 'low',
        text: 'Your work quality is a differentiator — use specific client quotes in proposals.',
      });
    }
    if (patterns.sentimentTrend === 'declining') {
      patterns.recommendations.push({
        priority: 'medium',
        text: 'Recent reviews are trending lower. Review your recent projects for common issues.',
      });
    }
    if (patterns.sentimentTrend === 'improving') {
      patterns.recommendations.push({
        priority: 'low',
        text: 'Great trend! Your recent reviews are improving. Keep doing what you\'re doing.',
      });
    }

    patterns.recommendations.sort(function (a, b) {
      var order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] || 2) - (order[b.priority] || 2);
    });

    return patterns;
  }

  /* ══════════════════════════════════════════════
   * AGGREGATE ANALYSIS
   * ══════════════════════════════════════════════ */

  function analyze(workHistory) {
    var results = (workHistory || [])
      .filter(function (e) { return e.feedbackText || e.rating != null; })
      .map(analyzeSingle);

    var total = results.length || 1;
    var counts = { very_positive: 0, positive: 0, mixed: 0, neutral: 0, negative: 0, very_negative: 0 };
    var ratingSum = 0;
    var ratingCount = 0;
    var quotes = { positive: [], negative: [] };

    results.forEach(function (r) {
      counts[r.sentiment] = (counts[r.sentiment] || 0) + 1;
      if (r.rating !== null) { ratingSum += r.rating; ratingCount++; }
      if (r.text && r.text.length > 10) {
        if (r.sentimentScore > 0) quotes.positive.push(r);
        else if (r.sentimentScore < 0) quotes.negative.push(r);
      }
    });

    var positiveTotal = (counts.very_positive || 0) + (counts.positive || 0);
    var negativeTotal = (counts.negative || 0) + (counts.very_negative || 0);
    var pct = {
      positive: Math.round((positiveTotal / total) * 100),
      neutral: Math.round(((counts.mixed + counts.neutral) / total) * 100),
      negative: Math.round((negativeTotal / total) * 100),
    };

    var avgRating = ratingCount ? (ratingSum / ratingCount).toFixed(1) : null;
    var patterns = detectPatterns(results);

    // Theme counts
    var themeMap = {};
    results.forEach(function (r) {
      r.themes.forEach(function (t) {
        themeMap[t.theme] = (themeMap[t.theme] || 0) + 1;
      });
    });
    var sortedThemes = Object.keys(themeMap).map(function (name) {
      return { name: name, count: themeMap[name], pct: Math.round((themeMap[name] / total) * 100) };
    }).sort(function (a, b) { return b.count - a.count; });

    // Summary
    var topPositive = patterns.strengths.slice(0, 2);
    var summary = '';
    if (topPositive.length >= 2) {
      summary = 'Clients consistently praise your ' + topPositive[0] + ' and ' + topPositive[1] + '.';
    } else if (topPositive.length === 1) {
      summary = 'Clients love your ' + topPositive[0] + '.';
    } else {
      summary = 'Not enough feedback to identify strong patterns yet.';
    }
    if (patterns.sentimentTrend === 'improving') summary += ' Reviews are trending upward!';
    else if (patterns.sentimentTrend === 'declining') summary += ' Recent reviews need attention.';

    return {
      results: results,
      counts: counts,
      pct: pct,
      sortedThemes: sortedThemes,
      avgRating: avgRating,
      quotes: quotes,
      summary: summary,
      total: results.length,
      patterns: patterns,
    };
  }

  /* ══════════════════════════════════════════════
   * SVG DONUT
   * ══════════════════════════════════════════════ */

  function createDonutSVG(pct) {
    var size = 120, cx = 60, cy = 60, r = 45, stroke = 12;
    var circ = 2 * Math.PI * r;
    var segs = [
      { color: '#34d399', value: pct.positive },
      { color: '#6b7280', value: pct.neutral },
      { color: '#ef4444', value: pct.negative },
    ];
    var paths = '';
    var offset = 0;
    segs.forEach(function (seg) {
      var len = (seg.value / 100) * circ;
      if (seg.value > 0) {
        paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + seg.color + '" stroke-width="' + stroke + '" stroke-dasharray="' + len + ' ' + (circ - len) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      }
      offset += len;
    });
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#1f2937" stroke-width="' + stroke + '"/>' + paths + '</svg>';
  }

  /* ══════════════════════════════════════════════
   * RENDER
   * ══════════════════════════════════════════════ */

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render(containerId) {
    var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;

    var stored = loadFeedback();
    var analysis = analyze(stored);

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e5e7eb;max-width:760px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:20px;">';
    html += '<h2 style="margin:0 0 6px;font-size:20px;color:#f9fafb;">📊 Feedback Pattern Analyzer</h2>';
    html += '<p style="margin:0;font-size:13px;color:#9ca3af;">' + analysis.total + ' reviews analyzed</p>';
    html += '</div>';

    if (analysis.total === 0) {
      html += '<div style="text-align:center;padding:40px;color:#6b7280;font-size:14px;">No feedback data to analyze yet.<br><span style="font-size:12px;">Add work history with feedbackText and rating fields.</span></div>';
      html += '</div>';
      el.innerHTML = html;
      return;
    }

    // Sentiment overview
    html += '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="font-size:15px;color:#f9fafb;margin:0 0 14px;">Sentiment Overview</h3>';
    html += '<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">';
    html += '<div>' + createDonutSVG(analysis.pct) + '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;font-size:14px;"><span style="width:10px;height:10px;border-radius:50%;background:#34d399;flex-shrink:0;"></span><strong style="min-width:36px;text-align:right;">' + analysis.pct.positive + '%</strong> Positive</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;font-size:14px;"><span style="width:10px;height:10px;border-radius:50%;background:#6b7280;flex-shrink:0;"></span><strong style="min-width:36px;text-align:right;">' + analysis.pct.neutral + '%</strong> Neutral</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;font-size:14px;"><span style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;"></span><strong style="min-width:36px;text-align:right;">' + analysis.pct.negative + '%</strong> Negative</div>';
    html += '</div>';
    if (analysis.avgRating) {
      html += '<div style="margin-left:auto;font-size:28px;font-weight:700;color:#fbbf24;">★ ' + analysis.avgRating + ' <span style="font-size:13px;color:#9ca3af;font-weight:400;">/5</span></div>';
    }
    html += '</div></div>';

    // Patterns
    var patterns = analysis.patterns;

    // Recurring praise
    if (patterns.recurringPraise.length > 0) {
      html += '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="font-size:15px;color:#f9fafb;margin:0 0 14px;">🌟 Recurring Praise</h3>';
      var themeIcons = { communication: '💬', quality: '⭐', deadline: '⏱️', expertise: '🧠', proactivity: '🚀', value: '💰', reliability: '🛡️' };
      patterns.recurringPraise.forEach(function (p) {
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
        html += '<span style="font-size:13px;min-width:150px;">' + (themeIcons[p.theme] || '📌') + ' ' + esc(p.theme.charAt(0).toUpperCase() + p.theme.slice(1)) + '</span>';
        html += '<div style="flex:1;height:8px;background:#1f2937;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.max(p.percentage, 8) + '%;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:4px;"></div></div>';
        html += '<span style="font-size:12px;color:#9ca3af;min-width:40px;text-align:right;">' + p.percentage + '%</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Recurring criticism
    if (patterns.recurringCriticism.length > 0) {
      html += '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="font-size:15px;color:#f9fafb;margin:0 0 14px;">⚠️ Areas for Improvement</h3>';
      var catLabels = {
        missed_deadlines: '⏰ Missed Deadlines',
        poor_quality: '📉 Quality Concerns',
        communication_issues: '📵 Communication Gaps',
        scope_issues: '💸 Scope/Pricing Issues',
        professionalism: '👔 Professionalism',
        general_negative: '😟 General Dissatisfaction',
      };
      patterns.recurringCriticism.forEach(function (c) {
        html += '<div style="background:#1f2937;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px;">';
        html += '<div style="font-size:13px;font-weight:600;color:#fca5a5;">' + (catLabels[c.category] || esc(c.category)) + '</div>';
        html += '<div style="font-size:12px;color:#9ca3af;margin-top:2px;">Mentioned in ' + c.count + ' review' + (c.count !== 1 ? 's' : '') + ' (' + c.percentage + '%)</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Trend
    var trendColors = { improving: '#22c55e', stable: '#6b7280', declining: '#ef4444' };
    var trendIcons = { improving: '📈', stable: '➡️', declining: '📉' };
    html += '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">';
    html += '<span style="font-size:24px;">' + (trendIcons[patterns.sentimentTrend] || '➡️') + '</span>';
    html += '<div>';
    html += '<div style="font-size:14px;font-weight:600;color:' + (trendColors[patterns.sentimentTrend] || '#6b7280') + ';">Sentiment Trend: ' + esc(patterns.sentimentTrend.charAt(0).toUpperCase() + patterns.sentimentTrend.slice(1)) + '</div>';
    html += '<div style="font-size:12px;color:#9ca3af;">Based on comparing earlier vs recent reviews</div>';
    html += '</div></div>';

    // Recommendations
    if (patterns.recommendations.length > 0) {
      html += '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="font-size:15px;color:#f9fafb;margin:0 0 14px;">💡 Recommendations</h3>';
      var prioColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
      patterns.recommendations.forEach(function (rec) {
        html += '<div style="padding:10px 14px;margin-bottom:8px;background:#1f2937;border-radius:8px;border-left:3px solid ' + (prioColors[rec.priority] || '#6b7280') + ';">';
        html += '<span style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:' + (prioColors[rec.priority] || '#6b7280') + ';font-weight:600;">' + esc(rec.priority) + '</span>';
        html += '<div style="font-size:13px;color:#d1d5db;margin-top:2px;">' + esc(rec.text) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Notable quotes
    if (analysis.quotes.positive.length > 0 || analysis.quotes.negative.length > 0) {
      html += '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="font-size:15px;color:#f9fafb;margin:0 0 14px;">💬 Notable Quotes</h3>';

      if (analysis.quotes.positive.length > 0) {
        html += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🟢 Highlights</div>';
        analysis.quotes.positive.slice(0, 3).forEach(function (q) {
          var preview = q.text.length > 120 ? q.text.slice(0, 117) + '…' : q.text;
          html += '<div style="background:#1f2937;border-radius:8px;padding:10px 14px;margin-bottom:8px;">';
          html += '<div style="font-size:13px;color:#d1d5db;font-style:italic;">"' + esc(preview) + '"</div>';
          if (q.title) html += '<div style="font-size:11px;color:#6b7280;margin-top:4px;">— ' + esc(q.title) + '</div>';
          html += '</div>';
        });
      }

      if (analysis.quotes.negative.length > 0) {
        html += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 8px;">🔴 Needs Attention</div>';
        analysis.quotes.negative.slice(0, 2).forEach(function (q) {
          var preview = q.text.length > 120 ? q.text.slice(0, 117) + '…' : q.text;
          html += '<div style="background:#1f2937;border-radius:8px;padding:10px 14px;margin-bottom:8px;">';
          html += '<div style="font-size:13px;color:#d1d5db;font-style:italic;">"' + esc(preview) + '"</div>';
          if (q.title) html += '<div style="font-size:11px;color:#6b7280;margin-top:4px;">— ' + esc(q.title) + '</div>';
          html += '</div>';
        });
      }
      html += '</div>';
    }

    // Summary
    html += '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;">';
    html += '<h3 style="font-size:15px;color:#f9fafb;margin:0 0 8px;">Summary</h3>';
    html += '<p style="font-size:14px;color:#d1d5db;line-height:1.6;margin:0;">' + esc(analysis.summary) + '</p>';
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
    return analysis;
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */

  function init(options) {
    options = options || {};
    if (options.workHistory) {
      saveFeedback(options.workHistory);
    }
    return { ready: true, feedbackCount: loadFeedback().length };
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.FeedbackAnalyzer = {
    init: init,
    render: render,
    analyze: analyze,
    analyzeSingle: analyzeSingle,
    detectPatterns: detectPatterns,
    addFeedback: function (entries) {
      var data = loadFeedback();
      (Array.isArray(entries) ? entries : [entries]).forEach(function (e) { data.push(e); });
      saveFeedback(data);
    },
    clearFeedback: function () { saveFeedback([]); },
    version: '2.0.0',
  };

  // Legacy compat
  window.CortexFeedbackAnalyzer = window.CortexFreelancer.FeedbackAnalyzer;

})();
