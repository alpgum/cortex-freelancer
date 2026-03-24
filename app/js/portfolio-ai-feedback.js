/**
 * [CF-150] Portfolio AI Feedback — per-item analysis
 * After the portfolio review runs, parses the description to identify
 * individual portfolio items/projects and provides detailed feedback
 * on each: description quality, visual presentation, impact metrics,
 * market relevance, and improvement suggestions.
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════
   * MARKET DEMAND KEYWORDS (2024-2025)
   * ══════════════════════════════════════════════ */
  var MARKET_DEMAND = {
    high: [
      'ai', 'machine learning', 'llm', 'generative ai', 'chatgpt', 'gpt',
      'react', 'next.js', 'nextjs', 'typescript', 'node', 'python',
      'aws', 'cloud', 'devops', 'kubernetes', 'docker',
      'mobile app', 'ios', 'android', 'flutter', 'react native',
      'saas', 'api', 'microservices', 'full stack', 'fullstack',
      'data analytics', 'dashboard', 'automation', 'workflow',
      'shopify', 'e-commerce', 'ecommerce', 'conversion', 'landing page',
      'figma', 'ui/ux', 'ux design', 'user experience', 'design system',
      'seo', 'content strategy', 'copywriting', 'brand identity',
      'cybersecurity', 'blockchain', 'web3',
    ],
    medium: [
      'wordpress', 'php', 'laravel', 'vue', 'angular', 'django',
      'java', 'spring', '.net', 'c#', 'ruby', 'rails',
      'sql', 'database', 'postgresql', 'mongodb',
      'graphic design', 'logo', 'branding', 'illustration',
      'video editing', 'motion graphics', 'animation',
      'email marketing', 'social media', 'marketing',
      'technical writing', 'documentation',
    ],
    low: [
      'flash', 'jquery', 'dreamweaver', 'coldfusion', 'vb',
      'basic html', 'simple website', 'static site',
    ],
  };

  /* ══════════════════════════════════════════════
   * IMPACT METRIC PATTERNS
   * ══════════════════════════════════════════════ */
  var METRIC_PATTERNS = [
    { regex: /(\d+[\d,.]*)\s*%\s*(increase|growth|improvement|boost|higher|more|uplift|up)/i, type: 'growth' },
    { regex: /(increase|improve|boost|grow|raise)[a-z]*\s+(?:by\s+)?(\d+[\d,.]*)\s*%/i, type: 'growth' },
    { regex: /(\d+[\d,.]*)\s*%\s*(decrease|reduction|lower|less|fewer|down|reduced|cut)/i, type: 'efficiency' },
    { regex: /(reduce|decrease|cut|lower)[a-z]*\s+(?:by\s+)?(\d+[\d,.]*)\s*%/i, type: 'efficiency' },
    { regex: /\$\s*(\d+[\d,.]*)\s*(k|m|million|thousand|billion)?/i, type: 'revenue' },
    { regex: /(\d+[\d,.]*)\s*(users|customers|clients|visitors|subscribers|downloads|installs)/i, type: 'scale' },
    { regex: /(\d+[\d,.]*)\s*x\s*(faster|more|growth|revenue|traffic|return)/i, type: 'multiplier' },
    { regex: /(\d+[\d,.]*)\s*(hours|days|weeks|months)\s*(saved|reduced|faster|quicker)/i, type: 'time_saved' },
    { regex: /roi|return on investment/i, type: 'roi' },
  ];

  /* ══════════════════════════════════════════════
   * VISUAL PRESENTATION KEYWORDS
   * ══════════════════════════════════════════════ */
  var VISUAL_KEYWORDS = [
    'screenshot', 'screenshots', 'demo', 'live demo', 'video', 'walkthrough',
    'prototype', 'mockup', 'wireframe', 'preview', 'gif', 'recording',
    'link', 'url', 'live site', 'live link', 'github', 'repo', 'repository',
    'case study', 'portfolio piece', 'before and after', 'before/after',
    'figma link', 'behance', 'dribbble', 'codepen', 'deployed',
  ];

  /* ══════════════════════════════════════════════
   * ITEM PARSER — extracts individual projects
   * ══════════════════════════════════════════════ */
  function parsePortfolioItems(desc) {
    if (!desc || typeof desc !== 'string') return [];

    var items = [];
    var lines = desc.split('\n');
    var currentItem = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      // Detect item headers: lines starting with -, *, •, numbers, or containing project-like keywords
      var isBullet = /^[-*•]\s+/.test(line);
      var isNumbered = /^\d+[.)]\s+/.test(line);
      var isProjectLine = /^(project|client|work|built|created|designed|developed|redesigned|launched|delivered|completed|implemented)/i.test(line.replace(/^[-*•\d.)]+\s*/, ''));

      if (isBullet || isNumbered || isProjectLine) {
        // Clean the line
        var cleaned = line.replace(/^[-*•\d.)]+\s*/, '').trim();
        if (cleaned.length < 5) continue;

        if (currentItem) {
          items.push(currentItem);
        }
        currentItem = { title: cleaned, details: cleaned, fullText: cleaned };
      } else if (currentItem) {
        // Continuation of the current item
        currentItem.details += ' ' + line;
        currentItem.fullText += '\n' + line;
      } else {
        // Standalone line that might be a project description
        if (line.length > 15 && /[A-Z]/.test(line[0])) {
          currentItem = { title: line, details: line, fullText: line };
        }
      }
    }

    if (currentItem) {
      items.push(currentItem);
    }

    // If no items found, try splitting by sentence-like chunks
    if (items.length === 0 && desc.length > 30) {
      var sentences = desc.split(/[.!?]+/).filter(function (s) { return s.trim().length > 15; });
      sentences.forEach(function (s) {
        items.push({ title: s.trim(), details: s.trim(), fullText: s.trim() });
      });
    }

    // Extract a cleaner title from each item (first meaningful phrase)
    items.forEach(function (item) {
      var titleMatch = item.title.match(/^(.{10,60}?)(?:\s*[-–—:,]|\s+for\s+|\s+\()/);
      if (titleMatch) {
        item.title = titleMatch[1].trim();
      } else if (item.title.length > 60) {
        item.title = item.title.substring(0, 57) + '...';
      }
    });

    return items.slice(0, 10); // Cap at 10 items
  }

  /* ══════════════════════════════════════════════
   * ANALYZE A SINGLE PORTFOLIO ITEM
   * ══════════════════════════════════════════════ */
  function analyzeItem(item) {
    var text = (item.details || '').toLowerCase();
    var result = {
      title: item.title,
      fullText: item.fullText,
      descriptionQuality: { score: 0, level: 'poor', feedback: '' },
      visualPresentation: { score: 0, mentions: [], feedback: '' },
      impactMetrics: { score: 0, metrics: [], feedback: '' },
      marketRelevance: { score: 0, matches: [], demand: 'unknown', feedback: '' },
      suggestions: [],
      totalScore: 0,
    };

    // --- Description Quality ---
    var wordCount = text.split(/\s+/).filter(function (w) { return w.length > 0; }).length;
    if (wordCount < 8) {
      result.descriptionQuality = {
        score: 15,
        level: 'too_short',
        feedback: 'Very brief description. Add context about the project scope, your role, technologies used, and the outcome. Aim for 30-60 words per item.',
      };
    } else if (wordCount < 20) {
      result.descriptionQuality = {
        score: 40,
        level: 'short',
        feedback: 'Description is a bit thin. Consider adding what problem you solved, the approach you took, and measurable results.',
      };
    } else if (wordCount < 50) {
      result.descriptionQuality = {
        score: 70,
        level: 'good',
        feedback: 'Solid description length. Make sure it covers the problem, your solution, and the result for maximum impact.',
      };
    } else {
      result.descriptionQuality = {
        score: 90,
        level: 'detailed',
        feedback: 'Comprehensive description. Clients appreciate this level of detail. Ensure key results are front-loaded for skimmers.',
      };
    }

    // Bonus for having structured elements
    if (/role|responsibilities|my part/i.test(text)) result.descriptionQuality.score = Math.min(100, result.descriptionQuality.score + 5);
    if (/technolog|stack|tools|built with|using/i.test(text)) result.descriptionQuality.score = Math.min(100, result.descriptionQuality.score + 5);
    if (/challenge|problem|goal|objective/i.test(text)) result.descriptionQuality.score = Math.min(100, result.descriptionQuality.score + 5);

    // --- Visual Presentation ---
    var visualMentions = [];
    VISUAL_KEYWORDS.forEach(function (kw) {
      if (text.indexOf(kw) !== -1) {
        visualMentions.push(kw);
      }
    });

    if (visualMentions.length === 0) {
      result.visualPresentation = {
        score: 10,
        mentions: [],
        feedback: 'No visual evidence mentioned. Add screenshots, a live demo link, or a video walkthrough to make this item 3x more compelling.',
      };
    } else if (visualMentions.length === 1) {
      result.visualPresentation = {
        score: 50,
        mentions: visualMentions,
        feedback: 'You mention ' + visualMentions[0] + '. Consider adding more visual proof — top freelancers include screenshots AND live links.',
      };
    } else {
      result.visualPresentation = {
        score: 85,
        mentions: visualMentions,
        feedback: 'Good visual coverage with ' + visualMentions.join(', ') + '. Visual evidence significantly increases client trust.',
      };
    }

    // --- Impact Metrics ---
    var foundMetrics = [];
    METRIC_PATTERNS.forEach(function (mp) {
      var match = text.match(mp.regex);
      if (match) {
        foundMetrics.push({ type: mp.type, text: match[0] });
      }
    });

    if (foundMetrics.length === 0) {
      result.impactMetrics = {
        score: 10,
        metrics: [],
        feedback: 'No quantified results found. Add metrics like "increased conversions by 23%" or "reduced load time by 40%". Numbers make your work tangible.',
      };
      result.suggestions.push('Add at least one measurable result (e.g., "improved page speed by 50%", "grew email list by 2,000 subscribers")');
    } else if (foundMetrics.length === 1) {
      result.impactMetrics = {
        score: 60,
        metrics: foundMetrics,
        feedback: 'One metric found: "' + foundMetrics[0].text + '". Try adding 2-3 different types of metrics (business impact, efficiency gains, scale).',
      };
    } else {
      result.impactMetrics = {
        score: 90,
        metrics: foundMetrics,
        feedback: 'Excellent! ' + foundMetrics.length + ' quantified results detected. Data-driven descriptions strongly differentiate your portfolio.',
      };
    }

    // --- Market Relevance ---
    var highMatches = [];
    var mediumMatches = [];
    var lowMatches = [];

    MARKET_DEMAND.high.forEach(function (kw) {
      if (text.indexOf(kw) !== -1) highMatches.push(kw);
    });
    MARKET_DEMAND.medium.forEach(function (kw) {
      if (text.indexOf(kw) !== -1) mediumMatches.push(kw);
    });
    MARKET_DEMAND.low.forEach(function (kw) {
      if (text.indexOf(kw) !== -1) lowMatches.push(kw);
    });

    var allMatches = highMatches.concat(mediumMatches);
    var demandLevel = 'low';
    var relevanceScore = 20;

    if (highMatches.length >= 2) {
      demandLevel = 'high';
      relevanceScore = 90;
    } else if (highMatches.length === 1) {
      demandLevel = 'high';
      relevanceScore = 75;
    } else if (mediumMatches.length >= 2) {
      demandLevel = 'medium';
      relevanceScore = 60;
    } else if (mediumMatches.length === 1) {
      demandLevel = 'medium';
      relevanceScore = 45;
    }

    if (lowMatches.length > 0 && highMatches.length === 0) {
      relevanceScore = Math.max(15, relevanceScore - 15);
      result.suggestions.push('This project uses older technologies (' + lowMatches.join(', ') + '). Consider highlighting any modern tech aspects or reframing it around the business outcome instead.');
    }

    var relevanceFeedback = '';
    if (demandLevel === 'high') {
      relevanceFeedback = 'Highly relevant to current market. Skills like ' + highMatches.slice(0, 3).join(', ') + ' are in strong demand.';
    } else if (demandLevel === 'medium') {
      relevanceFeedback = 'Moderately relevant. ' + mediumMatches.join(', ') + ' has steady demand. Consider highlighting any AI, cloud, or modern framework aspects.';
    } else {
      relevanceFeedback = 'Low market signal detected. Try framing this project around in-demand outcomes (performance, scalability, UX improvement) rather than just the technology.';
      result.suggestions.push('Reframe this project description to emphasize business outcomes and modern skills used.');
    }

    result.marketRelevance = {
      score: relevanceScore,
      matches: allMatches,
      demand: demandLevel,
      feedback: relevanceFeedback,
    };

    // --- Generate Suggestions ---
    if (result.descriptionQuality.level === 'too_short' || result.descriptionQuality.level === 'short') {
      result.suggestions.push('Expand this description to 30-60 words covering problem, solution, and result.');
    }
    if (visualMentions.length === 0) {
      result.suggestions.push('Add a screenshot or live demo link to this portfolio item.');
    }
    if (!/client|company|brand|startup|business/i.test(text)) {
      result.suggestions.push('Mention the type of client (e.g., "SaaS startup", "e-commerce brand") to help prospects relate.');
    }
    if (!/result|outcome|impact|achieve|deliver/i.test(text) && foundMetrics.length === 0) {
      result.suggestions.push('Add what you achieved or delivered — outcomes sell better than activities.');
    }

    // --- Total Score ---
    result.totalScore = Math.round(
      result.descriptionQuality.score * 0.25 +
      result.visualPresentation.score * 0.2 +
      result.impactMetrics.score * 0.3 +
      result.marketRelevance.score * 0.25
    );

    return result;
  }

  /* ══════════════════════════════════════════════
   * OVERALL PORTFOLIO STRENGTH
   * ══════════════════════════════════════════════ */
  function assessPortfolioStrength(itemResults) {
    if (itemResults.length === 0) {
      return {
        overallScore: 0,
        level: 'none',
        summary: 'No portfolio items could be identified. Add detailed project descriptions to get feedback.',
        tips: ['List your projects as bullet points with descriptions for best results.'],
      };
    }

    var avgScore = Math.round(itemResults.reduce(function (s, r) { return s + r.totalScore; }, 0) / itemResults.length);
    var itemsWithMetrics = itemResults.filter(function (r) { return r.impactMetrics.metrics.length > 0; }).length;
    var itemsWithVisuals = itemResults.filter(function (r) { return r.visualPresentation.mentions.length > 0; }).length;
    var highDemandItems = itemResults.filter(function (r) { return r.marketRelevance.demand === 'high'; }).length;

    var level, summary;
    var tips = [];

    if (avgScore >= 75) {
      level = 'strong';
      summary = 'Your portfolio is well-positioned to attract clients. Items are detailed with good evidence of impact.';
    } else if (avgScore >= 50) {
      level = 'moderate';
      summary = 'Your portfolio has a solid foundation but key improvements could significantly boost client conversions.';
    } else if (avgScore >= 30) {
      level = 'developing';
      summary = 'Your portfolio needs more detail and evidence. Clients look for specifics before hiring.';
    } else {
      level = 'weak';
      summary = 'Your portfolio descriptions need significant enhancement. Focus on adding details, metrics, and visual proof.';
    }

    // Generate specific tips
    if (itemsWithMetrics < itemResults.length / 2) {
      tips.push('Only ' + itemsWithMetrics + ' of ' + itemResults.length + ' items have quantified results. Add metrics to at least 75% of your projects.');
    }
    if (itemsWithVisuals < itemResults.length / 2) {
      tips.push('Most items lack visual evidence. Screenshots and live demos increase client engagement by up to 40%.');
    }
    if (highDemandItems < itemResults.length / 3) {
      tips.push('Few items highlight in-demand skills. Emphasize modern technologies and methodologies in your descriptions.');
    }
    if (itemResults.length < 3) {
      tips.push('Consider adding more portfolio items. 4-6 well-described projects is the sweet spot for most freelancers.');
    }
    if (itemResults.length > 8) {
      tips.push('You have many items. Consider curating to your top 5-6 strongest pieces for more impact.');
    }

    // Check description variety
    var allShort = itemResults.every(function (r) { return r.descriptionQuality.level === 'too_short' || r.descriptionQuality.level === 'short'; });
    if (allShort) {
      tips.push('All your descriptions are brief. Expand at least your top 3 projects with full problem-solution-result narratives.');
    }

    return {
      overallScore: avgScore,
      level: level,
      summary: summary,
      tips: tips,
      stats: {
        totalItems: itemResults.length,
        itemsWithMetrics: itemsWithMetrics,
        itemsWithVisuals: itemsWithVisuals,
        highDemandItems: highDemandItems,
      },
    };
  }

  /* ══════════════════════════════════════════════
   * HELPER: escape HTML
   * ══════════════════════════════════════════════ */
  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ══════════════════════════════════════════════
   * SCORE BADGE HELPER
   * ══════════════════════════════════════════════ */
  function scoreBadge(score) {
    var color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow, #ffcc00)' : 'var(--red)';
    var bg = score >= 70 ? 'rgba(0,255,136,.12)' : score >= 40 ? 'rgba(255,204,0,.12)' : 'rgba(255,68,102,.12)';
    return '<span style="display:inline-block;padding:2px 10px;border-radius:100px;font-size:.75rem;font-weight:700;background:' + bg + ';color:' + color + ';">' + score + '/100</span>';
  }

  /* ══════════════════════════════════════════════
   * DIMENSION ROW
   * ══════════════════════════════════════════════ */
  function dimensionRow(label, score, feedback) {
    var barColor = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow, #ffcc00)' : 'var(--red)';
    var html = '<div style="margin-bottom:.75rem;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    html += '<span style="font-size:.78rem;font-weight:600;color:var(--text);">' + esc(label) + '</span>';
    html += '<span style="font-size:.72rem;font-weight:700;color:' + barColor + ';">' + score + '</span>';
    html += '</div>';
    html += '<div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:4px;">';
    html += '<div style="height:100%;width:' + Math.max(score, 3) + '%;background:' + barColor + ';border-radius:3px;transition:width .5s ease;"></div>';
    html += '</div>';
    html += '<div style="font-size:.76rem;color:var(--text2);line-height:1.5;">' + esc(feedback) + '</div>';
    html += '</div>';
    return html;
  }

  /* ══════════════════════════════════════════════
   * RENDER
   * ══════════════════════════════════════════════ */
  function renderSection() {
    // Remove any existing section
    var existing = document.getElementById('portfolio-ai-feedback');
    if (existing) existing.remove();

    var desc = '';
    var descEl = document.getElementById('portfolio-desc');
    if (descEl) desc = descEl.value.trim();
    if (!desc) return;

    var items = parsePortfolioItems(desc);
    if (items.length === 0) return;

    var itemResults = items.map(analyzeItem);
    var strength = assessPortfolioStrength(itemResults);

    // Build the section
    var section = document.createElement('div');
    section.id = 'portfolio-ai-feedback';
    section.style.cssText = 'max-width:700px;margin:0 auto 2rem;padding:0 1.5rem;';

    var html = '';

    // Section header
    html += '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius);overflow:hidden;margin-bottom:1.5rem;">';
    html += '<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:1.25rem 1.5rem;color:#fff;">';
    html += '<h3 style="font-size:1rem;font-weight:800;margin:0;">Portfolio Item Analysis</h3>';
    html += '<p style="font-size:.8rem;opacity:.85;margin:.25rem 0 0;">AI-powered feedback on each portfolio piece</p>';
    html += '</div>';

    // Overall strength
    html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem;margin-bottom:.75rem;">';
    html += '<div style="font-size:.9rem;font-weight:700;color:var(--text);">Overall Portfolio Strength</div>';
    html += scoreBadge(strength.overallScore);
    html += '</div>';
    html += '<p style="font-size:.84rem;color:var(--text2);line-height:1.6;margin:0 0 .75rem;">' + esc(strength.summary) + '</p>';

    // Stats bar
    if (strength.stats) {
      html += '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem;">';
      html += '<div style="background:var(--bg3);padding:.4rem .75rem;border-radius:var(--radius-sm);font-size:.72rem;">';
      html += '<span style="color:var(--text3);">Items:</span> <strong style="color:var(--text);">' + strength.stats.totalItems + '</strong></div>';
      html += '<div style="background:var(--bg3);padding:.4rem .75rem;border-radius:var(--radius-sm);font-size:.72rem;">';
      html += '<span style="color:var(--text3);">With metrics:</span> <strong style="color:var(--green);">' + strength.stats.itemsWithMetrics + '</strong></div>';
      html += '<div style="background:var(--bg3);padding:.4rem .75rem;border-radius:var(--radius-sm);font-size:.72rem;">';
      html += '<span style="color:var(--text3);">With visuals:</span> <strong style="color:var(--orange);">' + strength.stats.itemsWithVisuals + '</strong></div>';
      html += '<div style="background:var(--bg3);padding:.4rem .75rem;border-radius:var(--radius-sm);font-size:.72rem;">';
      html += '<span style="color:var(--text3);">High demand:</span> <strong style="color:var(--green);">' + strength.stats.highDemandItems + '</strong></div>';
      html += '</div>';
    }

    // Tips
    if (strength.tips.length > 0) {
      html += '<div style="background:rgba(255,136,68,.05);border:1px solid rgba(255,136,68,.12);border-radius:var(--radius-sm);padding:.75rem 1rem;margin-top:.5rem;">';
      html += '<div style="font-size:.72rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.4rem;">Key Recommendations</div>';
      strength.tips.forEach(function (tip) {
        html += '<div style="font-size:.8rem;color:var(--text2);line-height:1.5;padding-left:1rem;position:relative;margin-bottom:.35rem;">';
        html += '<span style="position:absolute;left:0;top:.45rem;width:5px;height:5px;border-radius:50%;background:var(--orange);"></span>';
        html += esc(tip) + '</div>';
      });
      html += '</div>';
    }

    html += '</div>'; // end overall strength section

    // Individual item cards
    itemResults.forEach(function (ir, idx) {
      var borderColor = ir.totalScore >= 70 ? 'rgba(0,255,136,.2)' : ir.totalScore >= 40 ? 'rgba(255,204,0,.2)' : 'rgba(255,68,102,.2)';

      html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">';

      // Item header
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;margin-bottom:1rem;">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;">';
      html += '<span style="font-size:.72rem;font-weight:700;color:var(--text3);background:var(--bg3);padding:2px 8px;border-radius:100px;">#' + (idx + 1) + '</span>';
      html += '<h4 style="font-size:.88rem;font-weight:700;color:var(--text);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(ir.title) + '</h4>';
      html += '</div>';

      // Demand badge
      var demandColor = ir.marketRelevance.demand === 'high' ? 'var(--green)' : ir.marketRelevance.demand === 'medium' ? 'var(--yellow, #ffcc00)' : 'var(--red)';
      var demandBg = ir.marketRelevance.demand === 'high' ? 'rgba(0,255,136,.08)' : ir.marketRelevance.demand === 'medium' ? 'rgba(255,204,0,.08)' : 'rgba(255,68,102,.08)';
      html += '<span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 8px;border-radius:100px;background:' + demandBg + ';color:' + demandColor + ';">' + ir.marketRelevance.demand + ' demand</span>';

      html += '</div>';
      html += scoreBadge(ir.totalScore);
      html += '</div>';

      // Dimension breakdowns
      html += dimensionRow('Description Quality', ir.descriptionQuality.score, ir.descriptionQuality.feedback);
      html += dimensionRow('Visual Presentation', ir.visualPresentation.score, ir.visualPresentation.feedback);
      html += dimensionRow('Impact Metrics', ir.impactMetrics.score, ir.impactMetrics.feedback);
      html += dimensionRow('Market Relevance', ir.marketRelevance.score, ir.marketRelevance.feedback);

      // Matched keywords
      if (ir.marketRelevance.matches.length > 0) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:.75rem;">';
        ir.marketRelevance.matches.slice(0, 6).forEach(function (kw) {
          html += '<span style="font-size:.65rem;padding:2px 8px;border-radius:100px;background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.2);">' + esc(kw) + '</span>';
        });
        html += '</div>';
      }

      // Suggestions
      if (ir.suggestions.length > 0) {
        html += '<div style="background:rgba(255,68,102,.04);border-left:2px solid var(--red);border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:.6rem .85rem;margin-top:.5rem;">';
        html += '<div style="font-size:.7rem;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem;">Suggestions</div>';
        ir.suggestions.forEach(function (s) {
          html += '<div style="font-size:.78rem;color:var(--text2);line-height:1.5;margin-bottom:.25rem;">' + esc(s) + '</div>';
        });
        html += '</div>';
      }

      html += '</div>';
    });

    html += '</div>'; // end main card

    section.innerHTML = html;

    // Insert after #results
    var results = document.getElementById('results');
    if (results) {
      results.parentNode.insertBefore(section, results.nextSibling);
    }

    // GTM event
    if (window.dataLayer) {
      dataLayer.push({
        event: 'tool_used',
        tool_name: 'portfolio-review',
        action: 'ai_feedback_rendered',
        items_analyzed: itemResults.length,
        portfolio_strength: strength.overallScore,
      });
    }
  }

  /* ══════════════════════════════════════════════
   * HOOK INTO PORTFOLIO ANALYSIS
   * ══════════════════════════════════════════════ */
  function hookIntoAnalysis() {
    // Wrap the existing renderResults to trigger our section
    var origRenderResults = window.renderResults;
    if (typeof origRenderResults === 'function') {
      window.renderResults = function (score, passed, failed) {
        origRenderResults(score, passed, failed);
        setTimeout(renderSection, 100);
      };
    }

    // Also observe the results section for manual triggers
    var results = document.getElementById('results');
    if (results) {
      var observer = new MutationObserver(function (mutations) {
        if (results.classList.contains('show') && !document.getElementById('portfolio-ai-feedback')) {
          setTimeout(renderSection, 200);
        }
      });
      observer.observe(results, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookIntoAnalysis);
  } else {
    hookIntoAnalysis();
  }

})();
