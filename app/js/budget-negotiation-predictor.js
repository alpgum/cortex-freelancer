/**
 * [CF-153] Budget Negotiation Range Predictor
 * Analyzes job postings to predict negotiable salary/budget ranges.
 * Shows floor, sweet spot, and ceiling with visual range bar
 * and negotiation tips based on analysis signals.
 */
(function () {
  'use strict';

  /* ── Signal Keywords ── */

  var URGENCY_SIGNALS = ['asap', 'urgent', 'immediately', 'right away', 'fast turnaround', 'rush', 'tight deadline', 'need this done quickly', 'time-sensitive', 'critical timeline'];
  var HIGH_VALUE_CLIENT_SIGNALS = ['enterprise', 'funded', 'series a', 'series b', 'venture', 'fortune 500', 'established', 'growing team', 'scale', 'well-funded', 'vc-backed'];
  var BUDGET_FLEXIBILITY_SIGNALS = ['negotiable', 'flexible', 'open to', 'depending on experience', 'based on skills', 'competitive rate', 'willing to pay', 'right candidate'];
  var LOW_BUDGET_SIGNALS = ['limited budget', 'startup', 'bootstrap', 'non-profit', 'student project', 'personal project', 'small budget', 'tight budget', 'low budget'];
  var COMPLEXITY_KEYWORDS = ['api integration', 'machine learning', 'ai', 'blockchain', 'real-time', 'scalable', 'microservices', 'devops', 'security', 'compliance', 'hipaa', 'pci', 'gdpr', 'authentication', 'payment', 'stripe', 'aws', 'cloud', 'infrastructure', 'architecture', 'system design', 'database design', 'ci/cd', 'kubernetes', 'docker'];
  var RARE_SKILLS = ['solidity', 'rust', 'elixir', 'haskell', 'scala', 'webgl', 'threejs', 'unity', 'unreal', 'ar/vr', 'computer vision', 'nlp', 'deep learning', 'tensorflow', 'pytorch', 'ios', 'swift', 'kotlin', 'react native', 'flutter', 'salesforce', 'sap', 'oracle', 'blockchain', 'web3', 'smart contract'];

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function countMatches(text, keywords) {
    var lower = text.toLowerCase();
    var count = 0;
    keywords.forEach(function (kw) {
      if (lower.indexOf(kw) >= 0) count++;
    });
    return count;
  }

  function extractBudget(text) {
    var lower = text.toLowerCase();

    // Range patterns: $X,XXX - $X,XXX or $X,XXX-$X,XXX
    var rangeMatch = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)\s*[-\u2013]\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/);
    if (rangeMatch) {
      var lo = parseFloat(rangeMatch[1].replace(/,/g, ''));
      var hi = parseFloat(rangeMatch[2].replace(/,/g, ''));
      return { min: lo, max: hi, avg: (lo + hi) / 2, type: 'range' };
    }

    // Hourly range: $XX - $XX/hr
    var hourlyMatch = text.match(/\$\s*([\d.]+)\s*[-\u2013]\s*\$?\s*([\d.]+)\s*\/?\s*(?:hr|hour|hourly)/i);
    if (hourlyMatch) {
      var hlo = parseFloat(hourlyMatch[1]);
      var hhi = parseFloat(hourlyMatch[2]);
      return { min: hlo, max: hhi, avg: (hlo + hhi) / 2, type: 'hourly' };
    }

    // Single budget: $X,XXX
    var singleMatch = text.match(/(?:budget|price|rate|pay|compensation)[:\s]*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (singleMatch) {
      var val = parseFloat(singleMatch[1].replace(/,/g, ''));
      return { min: val, max: val, avg: val, type: 'fixed' };
    }

    // Fallback: any dollar amount
    var anyMatch = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    if (anyMatch) {
      var v = parseFloat(anyMatch[1].replace(/,/g, ''));
      if (v > 10) return { min: v, max: v, avg: v, type: 'inferred' };
    }

    return null;
  }

  function countSkills(text) {
    var skillKeywords = ['react', 'node', 'javascript', 'typescript', 'python', 'php', 'laravel', 'vue', 'angular', 'next.js', 'figma', 'photoshop', 'wordpress', 'shopify', 'api', 'aws', 'docker', 'sql', 'mongodb', 'firebase', 'tailwind', 'css', 'html', 'seo', 'flutter', 'swift', 'kotlin', 'java', 'go', 'rust', 'django', 'flask', 'ruby', 'rails', '.net', 'c#'];
    return countMatches(text, skillKeywords);
  }

  /* ── Core Analysis ── */

  function analyzeNegotiationRange(jobText) {
    var budget = extractBudget(jobText);
    if (!budget) return null;

    var lower = jobText.toLowerCase();
    var skillCount = countSkills(lower);
    var urgencyScore = countMatches(lower, URGENCY_SIGNALS);
    var clientValueScore = countMatches(lower, HIGH_VALUE_CLIENT_SIGNALS);
    var flexibilityScore = countMatches(lower, BUDGET_FLEXIBILITY_SIGNALS);
    var lowBudgetScore = countMatches(lower, LOW_BUDGET_SIGNALS);
    var complexityScore = countMatches(lower, COMPLEXITY_KEYWORDS);
    var rareSkillScore = countMatches(lower, RARE_SKILLS);

    // Calculate multipliers
    var urgencyMultiplier = 1 + Math.min(urgencyScore * 0.08, 0.25);
    var clientMultiplier = 1 + Math.min(clientValueScore * 0.06, 0.2);
    var flexMultiplier = 1 + Math.min(flexibilityScore * 0.07, 0.2);
    var lowBudgetPenalty = 1 - Math.min(lowBudgetScore * 0.05, 0.15);
    var complexityMultiplier = 1 + Math.min(complexityScore * 0.05, 0.25);
    var rarityMultiplier = 1 + Math.min(rareSkillScore * 0.1, 0.35);

    // Combined upward pressure
    var upwardPressure = urgencyMultiplier * clientMultiplier * flexMultiplier * complexityMultiplier * rarityMultiplier * lowBudgetPenalty;

    var baseBudget = budget.avg;

    // Floor: 85-95% of posted budget (lower for ranges, higher for fixed)
    var floorPct = budget.type === 'range' ? 0.85 : 0.9;
    var floor = Math.round(baseBudget * floorPct * lowBudgetPenalty);

    // Sweet spot: posted budget adjusted by signals
    var sweetSpot = Math.round(baseBudget * Math.min(upwardPressure, 1.4));

    // Ceiling: upper range with maximum signal boost
    var ceilingBase = budget.type === 'range' ? budget.max : baseBudget;
    var ceiling = Math.round(ceilingBase * Math.min(upwardPressure * 1.15, 1.6));

    // Ensure order makes sense
    if (sweetSpot <= floor) sweetSpot = Math.round(floor * 1.1);
    if (ceiling <= sweetSpot) ceiling = Math.round(sweetSpot * 1.15);

    // Confidence: higher when more signals are present
    var totalSignals = urgencyScore + clientValueScore + flexibilityScore + complexityScore + rareSkillScore;
    var confidence = Math.min(40 + totalSignals * 10 + (budget.type === 'range' ? 15 : 0) + (skillCount > 3 ? 10 : 0), 95);

    // Generate tips
    var tips = [];

    if (urgencyScore > 0) {
      tips.push({ type: 'positive', text: 'Urgency detected — clients with tight deadlines often pay premium rates. Emphasize your availability.' });
    }
    if (rareSkillScore > 0) {
      tips.push({ type: 'positive', text: 'Rare/specialized skills required — fewer competitors means stronger negotiation position.' });
    }
    if (complexityScore >= 2) {
      tips.push({ type: 'positive', text: 'High technical complexity — justify premium pricing with your architecture/design experience.' });
    }
    if (clientValueScore > 0) {
      tips.push({ type: 'positive', text: 'Client appears well-funded — they likely have budget flexibility beyond posted range.' });
    }
    if (flexibilityScore > 0) {
      tips.push({ type: 'positive', text: 'Budget is described as flexible/negotiable — strong signal you can aim above posted amount.' });
    }
    if (lowBudgetScore > 0) {
      tips.push({ type: 'caution', text: 'Budget constraints detected — focus on demonstrating value and consider phased delivery.' });
    }
    if (skillCount >= 5) {
      tips.push({ type: 'caution', text: 'Many skills required — broad requirements can indicate scope creep risk. Clarify deliverables before quoting.' });
    }
    if (budget.type === 'inferred') {
      tips.push({ type: 'info', text: 'Budget was inferred from text — verify the actual budget with the client before negotiating.' });
    }

    if (!tips.length) {
      tips.push({ type: 'info', text: 'Standard job posting. Research similar projects on the platform to validate your rate.' });
      tips.push({ type: 'info', text: 'Consider offering milestone-based pricing to build client confidence and protect your cash flow.' });
    }

    return {
      budget: budget,
      floor: floor,
      sweetSpot: sweetSpot,
      ceiling: ceiling,
      confidence: confidence,
      signals: {
        urgency: urgencyScore,
        clientValue: clientValueScore,
        flexibility: flexibilityScore,
        lowBudget: lowBudgetScore,
        complexity: complexityScore,
        rareSkills: rareSkillScore,
        skillCount: skillCount
      },
      tips: tips,
      isHourly: budget.type === 'hourly'
    };
  }

  /* ── UI Rendering ── */

  function formatCurrency(val, isHourly) {
    return '$' + val.toLocaleString() + (isHourly ? '/hr' : '');
  }

  function buildRangeCard(analysis) {
    var card = document.createElement('div');
    card.className = 'job-card negotiation-range-card';
    card.style.cssText = 'border-color:rgba(0,255,136,.15);';

    var prefix = analysis.isHourly ? '/hr' : '';

    // Header
    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">' +
      '<div style="display:flex;align-items:center;gap:.5rem">' +
        '<span style="font-size:1rem">&#128176;</span>' +
        '<span style="font-size:.95rem;font-weight:700">Negotiation Range</span>' +
      '</div>' +
      '<span style="font-size:.72rem;font-weight:600;padding:.2rem .6rem;border-radius:100px;background:rgba(0,255,136,.1);color:var(--green)">' + analysis.confidence + '% confidence</span>' +
    '</div>';

    // Range values
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;margin-bottom:1.25rem;text-align:center">' +
      '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem .5rem">' +
        '<div style="font-size:.68rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.25rem">Floor</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--red)">' + formatCurrency(analysis.floor, analysis.isHourly) + '</div>' +
        '<div style="font-size:.68rem;color:var(--text3)">Minimum viable</div>' +
      '</div>' +
      '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem .5rem;border:1px solid rgba(0,255,136,.2)">' +
        '<div style="font-size:.68rem;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.25rem">Sweet Spot</div>' +
        '<div style="font-size:1.3rem;font-weight:900;color:var(--green)">' + formatCurrency(analysis.sweetSpot, analysis.isHourly) + '</div>' +
        '<div style="font-size:.68rem;color:var(--text3)">Optimal bid</div>' +
      '</div>' +
      '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem .5rem">' +
        '<div style="font-size:.68rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.25rem">Ceiling</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--orange)">' + formatCurrency(analysis.ceiling, analysis.isHourly) + '</div>' +
        '<div style="font-size:.68rem;color:var(--text3)">Maximum achievable</div>' +
      '</div>' +
    '</div>';

    // Visual range bar
    var range = analysis.ceiling - analysis.floor;
    var sweetPct = range > 0 ? Math.round(((analysis.sweetSpot - analysis.floor) / range) * 100) : 50;
    sweetPct = Math.max(10, Math.min(90, sweetPct));

    html += '<div style="margin-bottom:1.25rem">' +
      '<div style="position:relative;height:24px;background:var(--bg3);border-radius:100px;overflow:hidden">' +
        // Gradient bar
        '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,68,68,.3) 0%,rgba(0,255,136,.4) ' + sweetPct + '%,rgba(255,136,68,.3) 100%);border-radius:100px"></div>' +
        // Floor marker
        '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--red);border-radius:100px"></div>' +
        // Sweet spot marker
        '<div style="position:absolute;left:' + sweetPct + '%;top:-2px;bottom:-2px;width:4px;background:var(--green);border-radius:100px;transform:translateX(-50%);box-shadow:0 0 8px rgba(0,255,136,.5)"></div>' +
        // Ceiling marker
        '<div style="position:absolute;right:0;top:0;bottom:0;width:3px;background:var(--orange);border-radius:100px"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:.35rem;font-size:.68rem;color:var(--text3)">' +
        '<span>Floor</span><span style="color:var(--green);font-weight:600">Sweet Spot</span><span>Ceiling</span>' +
      '</div>' +
    '</div>';

    // Signal badges
    var signals = analysis.signals;
    var badges = [];
    if (signals.urgency > 0) badges.push({ label: 'Urgent', color: 'var(--orange)', bg: 'rgba(255,136,68,.1)' });
    if (signals.rareSkills > 0) badges.push({ label: 'Rare Skills', color: 'var(--green)', bg: 'rgba(0,255,136,.1)' });
    if (signals.complexity >= 2) badges.push({ label: 'Complex', color: '#ffc800', bg: 'rgba(255,200,0,.1)' });
    if (signals.clientValue > 0) badges.push({ label: 'Well-Funded', color: 'var(--green)', bg: 'rgba(0,255,136,.1)' });
    if (signals.flexibility > 0) badges.push({ label: 'Flexible Budget', color: 'var(--green)', bg: 'rgba(0,255,136,.1)' });
    if (signals.lowBudget > 0) badges.push({ label: 'Budget Limited', color: 'var(--red)', bg: 'rgba(255,68,68,.1)' });
    if (signals.skillCount >= 5) badges.push({ label: signals.skillCount + ' Skills', color: '#ffc800', bg: 'rgba(255,200,0,.1)' });

    if (badges.length) {
      html += '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem">';
      badges.forEach(function (b) {
        html += '<span style="font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:100px;color:' + b.color + ';background:' + b.bg + ';letter-spacing:.3px">' + b.label + '</span>';
      });
      html += '</div>';
    }

    // Tips
    if (analysis.tips.length) {
      html += '<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:1rem">' +
        '<div style="font-size:.72rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem">Negotiation Tips</div>';

      analysis.tips.forEach(function (tip) {
        var icon = tip.type === 'positive' ? '&#9989;' : tip.type === 'caution' ? '&#9888;&#65039;' : '&#128161;';
        var borderColor = tip.type === 'positive' ? 'var(--green)' : tip.type === 'caution' ? '#ffc800' : 'var(--orange)';
        html += '<div style="display:flex;align-items:flex-start;gap:.5rem;padding:.5rem .65rem;background:var(--bg3);border-radius:8px;margin-bottom:.35rem;border-left:2px solid ' + borderColor + ';font-size:.82rem;color:var(--text2);line-height:1.5">' +
          '<span style="flex-shrink:0">' + icon + '</span>' +
          '<span>' + esc(tip.text) + '</span>' +
        '</div>';
      });

      html += '</div>';
    }

    card.innerHTML = html;
    return card;
  }

  /* ── Integration ── */

  function injectNegotiationCards() {
    // For pasted job results
    var resultsContainer = document.getElementById('results');
    if (resultsContainer) processContainer(resultsContainer);

    // For RSS search results
    var rssContainer = document.getElementById('rss-results');
    if (rssContainer) processContainer(rssContainer);
  }

  function processContainer(container) {
    var jobCards = container.querySelectorAll('.job-card:not(.negotiation-range-card)');

    jobCards.forEach(function (card) {
      // Skip if already processed
      if (card.getAttribute('data-negotiation-done')) return;
      card.setAttribute('data-negotiation-done', 'true');

      // Extract job text from card
      var titleEl = card.querySelector('.job-title');
      var descEl = card.querySelector('.job-desc');
      var budgetEl = card.querySelector('.job-budget');
      var skillEls = card.querySelectorAll('.skill-tag');
      var flagEls = card.querySelectorAll('.flag');

      var jobText = '';
      if (titleEl) jobText += titleEl.textContent + ' ';
      if (descEl) jobText += descEl.textContent + ' ';
      if (budgetEl) jobText += 'Budget: ' + budgetEl.textContent + ' ';
      skillEls.forEach(function (s) { jobText += s.textContent + ' '; });
      flagEls.forEach(function (f) { jobText += f.textContent + ' '; });

      var analysis = analyzeNegotiationRange(jobText);
      if (!analysis) return;

      var rangeCard = buildRangeCard(analysis);
      card.parentNode.insertBefore(rangeCard, card.nextSibling);
    });

    dataLayer.push({ event: 'tool_used', tool_name: 'budget-negotiation-predictor', action: 'analyze' });
  }

  /* ── Init ── */

  document.addEventListener('DOMContentLoaded', function () {
    // Observe results containers for new job cards
    var observer = new MutationObserver(function (mutations) {
      var hasNewCards = false;
      mutations.forEach(function (m) {
        if (m.addedNodes.length > 0) {
          for (var i = 0; i < m.addedNodes.length; i++) {
            var node = m.addedNodes[i];
            if (node.nodeType === 1 && (node.classList.contains('job-card') || node.querySelector && node.querySelector('.job-card'))) {
              hasNewCards = true;
              break;
            }
          }
        }
      });

      if (hasNewCards) {
        // Delay slightly to let DOM settle
        setTimeout(injectNegotiationCards, 100);
      }
    });

    var rssResults = document.getElementById('rss-results');
    var pasteResults = document.getElementById('results');

    if (rssResults) observer.observe(rssResults, { childList: true, subtree: true });
    if (pasteResults) observer.observe(pasteResults, { childList: true, subtree: true });

    // Also run on existing results
    setTimeout(injectNegotiationCards, 500);

    // Expose for external use
    window.CortexNegotiationPredictor = {
      analyze: analyzeNegotiationRange,
      inject: injectNegotiationCards
    };

    dataLayer.push({ event: 'tool_used', tool_name: 'budget-negotiation-predictor', action: 'init' });
  });
})();
