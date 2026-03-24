/**
 * CF-010: Employment History Optimizer
 * Analyzes work history entries for keyword density, description quality,
 * date gaps, and suggests improvements.
 */
(function () {
  'use strict';

  /** Power words that signal strong descriptions */
  const POWER_WORDS = [
    'led', 'built', 'designed', 'developed', 'managed', 'launched',
    'increased', 'reduced', 'improved', 'automated', 'optimized',
    'delivered', 'implemented', 'architected', 'scaled', 'migrated',
    'mentored', 'streamlined', 'transformed', 'secured'
  ];

  /** Minimum thresholds */
  const MIN_DESC_WORDS = 30;
  const IDEAL_DESC_WORDS = 80;

  /**
   * Parse a date string or object to a Date.
   * @param {string|Date|undefined} d
   * @returns {Date|null}
   */
  function parseDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Calculate months between two dates.
   * @param {Date} a
   * @param {Date} b
   * @returns {number}
   */
  function monthsBetween(a, b) {
    return Math.abs((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
  }

  /**
   * Score a single work history entry.
   * @param {{title?: string, company?: string, description?: string, startDate?: string|Date, endDate?: string|Date, skills?: string[]}} entry
   * @returns {{title: string, score: number, suggestions: string[]}}
   */
  function scoreEntry(entry) {
    const suggestions = [];
    let score = 0;
    const maxScore = 100;

    const title = (entry.title || '').trim();
    const company = (entry.company || '').trim();
    const desc = (entry.description || '').trim();
    const words = desc.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Title quality (20 pts)
    if (!title) {
      suggestions.push('Add a job title — this is the first thing clients see');
    } else if (title.length < 10) {
      score += 8;
      suggestions.push('Make your title more specific (e.g. "Senior React Developer" instead of "Developer")');
    } else {
      score += 20;
    }

    // Company presence (10 pts)
    if (!company) {
      suggestions.push('Add company/client name for credibility (use "Confidential Client" if under NDA)');
    } else {
      score += 10;
    }

    // Description length (25 pts)
    if (!desc) {
      suggestions.push('Write a description highlighting your key responsibilities and achievements');
    } else if (wordCount < MIN_DESC_WORDS) {
      score += 8;
      suggestions.push(`Description is short (${wordCount} words). Aim for ${IDEAL_DESC_WORDS}+ words with specific achievements`);
    } else if (wordCount < IDEAL_DESC_WORDS) {
      score += 18;
      suggestions.push('Good description length. Add measurable results to strengthen it further');
    } else {
      score += 25;
    }

    // Power words / action verbs (15 pts)
    const lowerDesc = desc.toLowerCase();
    const usedPower = POWER_WORDS.filter(w => lowerDesc.includes(w));
    if (usedPower.length >= 3) {
      score += 15;
    } else if (usedPower.length >= 1) {
      score += 8;
      suggestions.push('Use more action verbs: ' + POWER_WORDS.filter(w => !lowerDesc.includes(w)).slice(0, 4).join(', '));
    } else if (desc) {
      suggestions.push('Start bullet points with action verbs like: built, led, designed, improved, launched');
    }

    // Quantified achievements (15 pts)
    const hasNumbers = /\d+[%+]|\$\d|increased.*\d|reduced.*\d|improved.*\d|\d+\s*(users|clients|projects|teams|countries)/i.test(desc);
    if (hasNumbers) {
      score += 15;
    } else if (desc) {
      suggestions.push('Quantify your impact — e.g. "Reduced load time by 40%" or "Managed team of 8"');
    }

    // Skills/technologies mentioned (15 pts)
    const skills = entry.skills || [];
    if (skills.length >= 3) {
      score += 15;
    } else if (skills.length >= 1) {
      score += 8;
      suggestions.push('Tag more relevant skills/technologies used in this role');
    } else if (desc) {
      suggestions.push('Add skill tags for technologies and tools used in this position');
    }

    return {
      title: title || '(Untitled position)',
      score: Math.min(maxScore, score),
      suggestions
    };
  }

  /**
   * Detect gaps between employment entries.
   * @param {{startDate?: string|Date, endDate?: string|Date}[]} entries
   * @returns {{from: string, to: string, months: number}[]}
   */
  function findGaps(entries) {
    const dated = entries
      .map(e => ({ start: parseDate(e.startDate), end: parseDate(e.endDate) }))
      .filter(e => e.start && e.end)
      .sort((a, b) => a.start - b.start);

    const gaps = [];
    for (let i = 0; i < dated.length - 1; i++) {
      const gapMonths = monthsBetween(dated[i].end, dated[i + 1].start);
      if (gapMonths > 3) {
        gaps.push({
          from: dated[i].end.toISOString().slice(0, 7),
          to: dated[i + 1].start.toISOString().slice(0, 7),
          months: gapMonths
        });
      }
    }
    return gaps;
  }

  /**
   * Analyze all work history entries.
   * @param {{title?: string, company?: string, description?: string, startDate?: string|Date, endDate?: string|Date, skills?: string[]}[]} workHistory
   * @returns {{overallScore: number, gaps: {from: string, to: string, months: number}[], entries: {title: string, score: number, suggestions: string[]}[]}}
   */
  function optimizeHistory(workHistory) {
    if (!workHistory || workHistory.length === 0) {
      return {
        overallScore: 0,
        gaps: [],
        entries: [{
          title: '(No work history)',
          score: 0,
          suggestions: ['Add your work history — even freelance projects count. Clients trust profiles with experience.']
        }]
      };
    }

    const entries = workHistory.map(scoreEntry);
    const gaps = findGaps(workHistory);
    const overallScore = Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length);

    // Gap-level suggestions
    gaps.forEach(g => {
      entries.push({
        title: `(Gap: ${g.from} → ${g.to})`,
        score: 0,
        suggestions: [`${g.months}-month gap detected. Fill with freelance work, courses, or side projects to strengthen your timeline.`]
      });
    });

    return { overallScore, gaps, entries };
  }

  // Export
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EmploymentOptimizer = {
    optimizeHistory: optimizeHistory,
    scoreEntry: scoreEntry,
    findGaps: findGaps
  };
})();
