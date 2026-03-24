/**
 * CortexProposalLength — Proposal Length Optimizer
 * Analyzes proposal word count against ideal ranges per job category
 * and renders a visual length indicator.
 */
(function () {
  'use strict';

  var IDEAL_RANGES = {
    'web-development': { min: 150, max: 250 },
    'design':          { min: 100, max: 200 },
    'writing':         { min: 200, max: 350 },
    'data-science':    { min: 150, max: 250 }
  };
  var DEFAULT_RANGE = { min: 150, max: 250 };
  var WORDS_PER_MINUTE = 200;

  function getRange(jobCategory) {
    if (jobCategory && IDEAL_RANGES[jobCategory]) {
      return IDEAL_RANGES[jobCategory];
    }
    return DEFAULT_RANGE;
  }

  function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    var trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function formatReadingTime(wordCount) {
    var minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
    if (minutes < 1) return '< 1 min';
    return '~' + minutes + ' min';
  }

  function buildSuggestion(wordCount, status, range) {
    if (status === 'too-short') {
      var deficit = range.min - wordCount;
      return 'Your proposal is ' + wordCount + ' words — add ~' + deficit +
        ' more words about your approach, timeline, and relevant experience.';
    }
    if (status === 'too-long') {
      var excess = wordCount - range.max;
      return 'Your proposal is ' + wordCount + ' words — trim ~' + excess +
        ' words. Focus on your strongest points and remove filler.';
    }
    return 'Your proposal is ' + wordCount + ' words — right in the sweet spot for this category.';
  }

  /**
   * Analyze proposal length against ideal range for a job category.
   * @param {string} proposalText - The proposal text to analyze.
   * @param {string} [jobCategory] - One of: web-development, design, writing, data-science.
   * @returns {Object} Analysis result.
   */
  function analyzeLength(proposalText, jobCategory) {
    var wordCount = countWords(proposalText);
    var charCount = (proposalText && typeof proposalText === 'string') ? proposalText.length : 0;
    var range = getRange(jobCategory);
    var status;

    if (wordCount < range.min) {
      status = 'too-short';
    } else if (wordCount > range.max) {
      status = 'too-long';
    } else {
      status = 'good';
    }

    return {
      wordCount: wordCount,
      charCount: charCount,
      idealRange: { min: range.min, max: range.max },
      status: status,
      suggestion: buildSuggestion(wordCount, status, range),
      readingTime: formatReadingTime(wordCount)
    };
  }

  /**
   * Render a visual length indicator as an HTML string.
   * @param {string} proposalText - The proposal text to analyze.
   * @param {string} [jobCategory] - One of: web-development, design, writing, data-science.
   * @returns {string} HTML string with dark-themed length indicator.
   */
  function renderLengthIndicator(proposalText, jobCategory) {
    var analysis = analyzeLength(proposalText, jobCategory);
    var range = analysis.idealRange;

    // Bar scale: 0 to max * 1.6 (so "too long" is visible)
    var barMax = Math.round(range.max * 1.6);
    var pct = Math.min((analysis.wordCount / barMax) * 100, 100);
    var rangeStartPct = (range.min / barMax) * 100;
    var rangeEndPct = (range.max / barMax) * 100;

    // Colors
    var statusColor;
    var statusLabel;
    if (analysis.status === 'too-short') {
      statusColor = '#ef4444';
      statusLabel = 'Too Short';
    } else if (analysis.status === 'too-long') {
      statusColor = '#f97316';
      statusLabel = 'Too Long';
    } else {
      statusColor = '#22c55e';
      statusLabel = 'Ideal Length';
    }

    var html = '';
    html += '<div style="background:#1e1e2e;border:1px solid #313244;border-radius:10px;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#cdd6f4;max-width:480px;">';

    // Header row: word count + reading time
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<div style="font-size:14px;font-weight:600;">';
    html += '<span style="color:#cdd6f4;">' + analysis.wordCount + ' words</span>';
    html += '<span style="color:#6c7086;margin-left:8px;font-weight:400;">' + analysis.readingTime + ' read</span>';
    html += '</div>';
    html += '<span style="font-size:12px;font-weight:600;color:' + statusColor + ';background:' + statusColor + '1a;padding:2px 8px;border-radius:4px;">' + statusLabel + '</span>';
    html += '</div>';

    // Bar container
    html += '<div style="position:relative;height:8px;background:#313244;border-radius:4px;overflow:visible;margin-bottom:8px;">';

    // Ideal range zone (subtle green background)
    html += '<div style="position:absolute;left:' + rangeStartPct.toFixed(1) + '%;width:' + (rangeEndPct - rangeStartPct).toFixed(1) + '%;top:0;height:100%;background:rgba(34,197,94,0.15);border-radius:4px;"></div>';

    // Fill bar
    html += '<div style="position:absolute;left:0;top:0;height:100%;width:' + pct.toFixed(1) + '%;background:' + statusColor + ';border-radius:4px;transition:width 0.3s ease;"></div>';

    // Min marker
    html += '<div style="position:absolute;left:' + rangeStartPct.toFixed(1) + '%;top:-3px;width:2px;height:14px;background:#22c55e;border-radius:1px;"></div>';

    // Max marker
    html += '<div style="position:absolute;left:' + rangeEndPct.toFixed(1) + '%;top:-3px;width:2px;height:14px;background:#22c55e;border-radius:1px;"></div>';

    html += '</div>';

    // Range labels
    html += '<div style="position:relative;font-size:10px;color:#6c7086;margin-bottom:12px;height:14px;">';
    html += '<span style="position:absolute;left:' + rangeStartPct.toFixed(1) + '%;transform:translateX(-50%);">' + range.min + '</span>';
    html += '<span style="position:absolute;left:' + rangeEndPct.toFixed(1) + '%;transform:translateX(-50%);">' + range.max + '</span>';
    html += '</div>';

    // Suggestion
    html += '<div style="font-size:12px;color:#a6adc8;line-height:1.5;padding:8px 10px;background:#181825;border-radius:6px;">';
    html += analysis.suggestion;
    html += '</div>';

    html += '</div>';

    return html;
  }

  window.CortexProposalLength = {
    analyzeLength: analyzeLength,
    renderLengthIndicator: renderLengthIndicator
  };
})();
