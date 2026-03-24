/**
 * CF-006: Portfolio Item Analyzer with Scoring
 * Reviews portfolio items for description length, image presence,
 * client visibility, keyword density, and suggests improvements.
 */
(function () {
  'use strict';

  /** Minimum thresholds for scoring */
  const THRESHOLDS = {
    descMinWords: 50,
    descIdealWords: 120,
    titleMinLength: 10,
    titleIdealLength: 40,
    minKeywordDensity: 0.02,
    idealKeywordDensity: 0.05
  };

  /** Weight of each scoring category (total = 100) */
  const WEIGHTS = {
    description: 30,
    images: 25,
    title: 15,
    clientInfo: 15,
    keywords: 15
  };

  /**
   * Count words in a string.
   * @param {string} text
   * @returns {number}
   */
  function wordCount(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Calculate keyword density (ratio of unique meaningful words).
   * @param {string} text
   * @returns {number}
   */
  function keywordDensity(text) {
    const words = (text || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return 0;
    const unique = new Set(words);
    // Higher unique-to-total ratio means richer vocabulary/keywords
    return unique.size / words.length;
  }

  /**
   * Score a single portfolio item.
   * @param {{title?: string, description?: string, images?: string[]|number, clientName?: string, clientVisible?: boolean, url?: string, skills?: string[]}} item
   * @returns {{title: string, score: number, issues: string[], suggestions: string[]}}
   */
  function scoreItem(item) {
    const issues = [];
    const suggestions = [];
    let score = 0;

    // --- Title ---
    const title = (item.title || '').trim();
    if (!title) {
      issues.push('Missing portfolio item title');
      suggestions.push('Add a descriptive title with relevant keywords');
    } else if (title.length < THRESHOLDS.titleMinLength) {
      score += WEIGHTS.title * 0.3;
      issues.push('Title is too short');
      suggestions.push(`Expand title to at least ${THRESHOLDS.titleIdealLength} characters with keywords`);
    } else if (title.length < THRESHOLDS.titleIdealLength) {
      score += WEIGHTS.title * 0.7;
      suggestions.push('Consider adding more descriptive keywords to your title');
    } else {
      score += WEIGHTS.title;
    }

    // --- Description ---
    const desc = (item.description || '').trim();
    const wc = wordCount(desc);
    if (!desc) {
      issues.push('Missing description');
      suggestions.push('Write a detailed description covering the problem, solution, and results');
    } else if (wc < THRESHOLDS.descMinWords) {
      score += WEIGHTS.description * 0.3;
      issues.push(`Description too short (${wc} words)`);
      suggestions.push(`Expand to ${THRESHOLDS.descIdealWords}+ words — describe the challenge, your approach, and measurable outcomes`);
    } else if (wc < THRESHOLDS.descIdealWords) {
      score += WEIGHTS.description * 0.7;
      suggestions.push('Add measurable results (e.g. "increased conversion by 35%") to strengthen this item');
    } else {
      score += WEIGHTS.description;
    }

    // Quality signals in description
    if (desc && !/\d/.test(desc)) {
      suggestions.push('Include numbers or metrics to quantify your impact');
    }
    if (desc && !/https?:\/\/|link|live|demo|site/i.test(desc)) {
      suggestions.push('Consider adding a link to the live project or demo');
    }

    // --- Images ---
    const imageCount = Array.isArray(item.images) ? item.images.length : (item.images || 0);
    if (imageCount === 0) {
      issues.push('No images attached');
      suggestions.push('Add 2-3 high-quality screenshots or mockups showing the final result');
    } else if (imageCount === 1) {
      score += WEIGHTS.images * 0.5;
      suggestions.push('Add more images (2-3 recommended) to showcase different aspects');
    } else if (imageCount >= 2) {
      score += WEIGHTS.images;
    }

    // --- Client info ---
    if (item.clientVisible || item.clientName) {
      score += WEIGHTS.clientInfo;
    } else {
      issues.push('Client attribution not visible');
      suggestions.push('Enable client visibility or mention the client/company (with permission) for credibility');
    }

    // --- Keywords ---
    const density = keywordDensity(desc);
    if (density >= THRESHOLDS.idealKeywordDensity) {
      score += WEIGHTS.keywords;
    } else if (density >= THRESHOLDS.minKeywordDensity) {
      score += WEIGHTS.keywords * 0.6;
      suggestions.push('Add more relevant keywords and technical terms to your description');
    } else {
      suggestions.push('Description lacks keyword variety — include tools, technologies, and industry terms');
    }

    return {
      title: title || '(Untitled)',
      score: Math.round(score),
      issues,
      suggestions
    };
  }

  /**
   * Analyze all portfolio items and return overall + per-item scoring.
   * @param {{title?: string, description?: string, images?: string[]|number, clientName?: string, clientVisible?: boolean, url?: string, skills?: string[]}[]} items
   * @returns {{overallScore: number, items: {title: string, score: number, issues: string[], suggestions: string[]}[]}}
   */
  function analyzePortfolio(items) {
    if (!items || items.length === 0) {
      return {
        overallScore: 0,
        items: [],
        summary: 'No portfolio items found. Add at least 2-3 items showcasing your best work.'
      };
    }

    const scored = items.map(scoreItem);
    const avg = Math.round(scored.reduce((sum, i) => sum + i.score, 0) / scored.length);

    // Portfolio-level suggestions
    if (items.length < 3) {
      scored.push({
        title: '(Portfolio-level)',
        score: 0,
        issues: [`Only ${items.length} portfolio item(s)`],
        suggestions: ['Add at least 3 portfolio items — clients compare breadth of experience']
      });
    }

    return {
      overallScore: avg,
      items: scored
    };
  }

  // Export
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PortfolioAnalyzer = {
    analyzePortfolio: analyzePortfolio,
    scoreItem: scoreItem
  };
})();
