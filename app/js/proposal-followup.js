/**
 * [CF-037] Proposal Follow-up Generator
 * Auto-generate follow-up messages based on proposal status and time elapsed.
 * Integrates with CortexProposalTracker for status data.
 *
 * window.CortexFreelancer.ProposalFollowup
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ── Time Helpers ──────────────────────────────────────── */

  function daysSince(isoDate) {
    if (!isoDate) return Infinity;
    return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  }

  function hoursSince(isoDate) {
    if (!isoDate) return Infinity;
    return Math.floor((Date.now() - new Date(isoDate).getTime()) / 3600000);
  }

  /* ── Follow-up Rules ───────────────────────────────────── */

  var FOLLOWUP_RULES = [
    {
      status: 'sent',
      minDays: 3,
      maxDays: 5,
      type: 'gentle-checkin',
      label: 'Gentle Check-in',
      urgency: 'low'
    },
    {
      status: 'sent',
      minDays: 7,
      maxDays: 14,
      type: 'value-add',
      label: 'Value-Add Follow-up',
      urgency: 'medium'
    },
    {
      status: 'sent',
      minDays: 14,
      maxDays: null,
      type: 'final-followup',
      label: 'Final Follow-up',
      urgency: 'high'
    },
    {
      status: 'viewed',
      minDays: 2,
      maxDays: 5,
      type: 'viewed-followup',
      label: 'They Viewed — Follow Up',
      urgency: 'medium'
    },
    {
      status: 'viewed',
      minDays: 5,
      maxDays: null,
      type: 'viewed-nudge',
      label: 'Viewed But Silent — Nudge',
      urgency: 'high'
    },
    {
      status: 'shortlisted',
      minDays: 3,
      maxDays: 7,
      type: 'shortlist-engage',
      label: 'Shortlisted — Show Enthusiasm',
      urgency: 'medium'
    },
    {
      status: 'shortlisted',
      minDays: 7,
      maxDays: null,
      type: 'shortlist-availability',
      label: 'Shortlisted — Confirm Availability',
      urgency: 'high'
    }
  ];

  /* ── Message Templates ─────────────────────────────────── */

  var TEMPLATES = {
    'gentle-checkin': function (p) {
      return {
        subject: 'Quick check-in on ' + (p.jobTitle || 'your project'),
        message: 'Hi' + nameGreeting(p.clientName) + ',\n\n' +
          'I wanted to quickly follow up on my proposal for "' + (p.jobTitle || 'your project') + '." ' +
          'I\'m still very interested and available to get started.\n\n' +
          'If you have any questions about my approach or would like to discuss the project further, ' +
          'I\'d be happy to hop on a quick call.\n\n' +
          'Looking forward to hearing from you!\n\n' +
          'Best regards'
      };
    },

    'value-add': function (p) {
      return {
        subject: 'A thought on ' + (p.jobTitle || 'your project'),
        message: 'Hi' + nameGreeting(p.clientName) + ',\n\n' +
          'I\'ve been thinking more about "' + (p.jobTitle || 'your project') + '" since I submitted my proposal ' +
          'and wanted to share an additional idea.\n\n' +
          '[INSERT: A specific suggestion, resource, or insight relevant to their project]\n\n' +
          'I believe this could add significant value to the project. ' +
          'I\'m still available and would love to discuss this approach with you.\n\n' +
          'Best regards'
      };
    },

    'final-followup': function (p) {
      return {
        subject: 'Following up — ' + (p.jobTitle || 'your project'),
        message: 'Hi' + nameGreeting(p.clientName) + ',\n\n' +
          'I wanted to reach out one more time regarding my proposal for "' + (p.jobTitle || 'your project') + '."\n\n' +
          'I understand you may have gone in a different direction, and that\'s completely fine. ' +
          'If the project is still open or if you need help with similar work in the future, ' +
          'please don\'t hesitate to reach out.\n\n' +
          'Wishing you all the best with the project!\n\n' +
          'Best regards'
      };
    },

    'viewed-followup': function (p) {
      return {
        subject: 'Re: ' + (p.jobTitle || 'your project') + ' — happy to discuss',
        message: 'Hi' + nameGreeting(p.clientName) + ',\n\n' +
          'I noticed my proposal for "' + (p.jobTitle || 'your project') + '" has been viewed — thank you for taking the time!\n\n' +
          'If you have any questions about my approach, timeline, or budget, ' +
          'I\'d love to chat. I\'m flexible and happy to adjust my proposal based on your specific needs.\n\n' +
          'Would a quick 15-minute call work for you this week?\n\n' +
          'Best regards'
      };
    },

    'viewed-nudge': function (p) {
      return {
        subject: 'Still interested in ' + (p.jobTitle || 'your project'),
        message: 'Hi' + nameGreeting(p.clientName) + ',\n\n' +
          'Just a quick note — I\'m still interested and available for "' + (p.jobTitle || 'your project') + '."\n\n' +
          'I noticed there hasn\'t been any activity, so I wanted to check: ' +
          'is the project still moving forward? If so, I\'d love to be considered.\n\n' +
          'If priorities have shifted, no worries at all. Either way, feel free to reach out anytime.\n\n' +
          'Best regards'
      };
    },

    'shortlist-engage': function (p) {
      return {
        subject: 'Excited to be shortlisted — ' + (p.jobTitle || 'your project'),
        message: 'Hi' + nameGreeting(p.clientName) + ',\n\n' +
          'Thank you for shortlisting me for "' + (p.jobTitle || 'your project') + '"! I\'m genuinely excited about this opportunity.\n\n' +
          'I wanted to let you know I\'ve cleared my schedule and can start as soon as we align on the details. ' +
          'If there\'s anything else you\'d like to see — a sample, a more detailed plan, or references — ' +
          'I\'m happy to provide.\n\n' +
          'Looking forward to next steps!\n\n' +
          'Best regards'
      };
    },

    'shortlist-availability': function (p) {
      return {
        subject: 'Availability update — ' + (p.jobTitle || 'your project'),
        message: 'Hi' + nameGreeting(p.clientName) + ',\n\n' +
          'I wanted to give you a quick update: I\'m still available and committed to "' + (p.jobTitle || 'your project') + '."\n\n' +
          'However, I do have another opportunity coming up, so I wanted to check on the timeline for your decision. ' +
          'I\'d love to prioritize your project if the timing works out.\n\n' +
          'Please let me know if there\'s anything I can do to help move things forward.\n\n' +
          'Best regards'
      };
    }
  };

  function nameGreeting(name) {
    return name ? ' ' + name : '';
  }

  /* ── Core Functions ────────────────────────────────────── */

  /**
   * Determine which follow-up is appropriate for a proposal.
   * @param {Object} proposal - Proposal record from ProposalTracker
   * @returns {Object|null} { type, label, urgency, daysSinceSent, template } or null if no follow-up needed
   */
  function getFollowupRecommendation(proposal) {
    if (!proposal || !proposal.status || !proposal.sentDate) return null;

    // No follow-up for terminal statuses
    if (proposal.status === 'hired' || proposal.status === 'rejected') return null;

    var elapsed = daysSince(proposal.sentDate);
    var status = proposal.status;

    // Find the best matching rule (most specific / highest urgency)
    var bestRule = null;
    for (var i = 0; i < FOLLOWUP_RULES.length; i++) {
      var rule = FOLLOWUP_RULES[i];
      if (rule.status !== status) continue;
      if (elapsed < rule.minDays) continue;
      if (rule.maxDays !== null && elapsed > rule.maxDays) continue;
      bestRule = rule;
    }

    // If no bounded rule matched, check unbounded ones
    if (!bestRule) {
      for (var j = FOLLOWUP_RULES.length - 1; j >= 0; j--) {
        var r = FOLLOWUP_RULES[j];
        if (r.status !== status) continue;
        if (r.maxDays === null && elapsed >= r.minDays) {
          bestRule = r;
          break;
        }
      }
    }

    if (!bestRule) return null;

    return {
      type: bestRule.type,
      label: bestRule.label,
      urgency: bestRule.urgency,
      daysSinceSent: elapsed,
      status: status
    };
  }

  /**
   * Generate a follow-up message for a proposal.
   * @param {Object} proposal - Proposal record
   * @param {Object} [options] - Options
   * @param {string} [options.type] - Override follow-up type
   * @returns {Object|null} { subject, message, type, label, urgency } or null
   */
  function generateFollowup(proposal, options) {
    var opts = options || {};
    var rec = opts.type
      ? { type: opts.type, label: opts.type, urgency: 'medium', daysSinceSent: daysSince(proposal.sentDate), status: proposal.status }
      : getFollowupRecommendation(proposal);

    if (!rec) return null;

    var templateFn = TEMPLATES[rec.type];
    if (!templateFn) return null;

    var tmpl = templateFn(proposal);

    return {
      subject: tmpl.subject,
      message: tmpl.message,
      type: rec.type,
      label: rec.label,
      urgency: rec.urgency,
      daysSinceSent: rec.daysSinceSent
    };
  }

  /**
   * Get all proposals that need follow-up.
   * Requires CortexProposalTracker to be loaded.
   * @returns {Object[]} Array of { proposal, recommendation, followup }
   */
  function getProposalsNeedingFollowup() {
    if (!window.CortexProposalTracker) return [];

    var proposals = window.CortexProposalTracker.getProposals();
    var results = [];

    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      var rec = getFollowupRecommendation(p);
      if (rec) {
        var followup = generateFollowup(p);
        results.push({
          proposal: p,
          recommendation: rec,
          followup: followup
        });
      }
    }

    // Sort by urgency: high first, then medium, then low
    var urgencyOrder = { high: 0, medium: 1, low: 2 };
    results.sort(function (a, b) {
      return (urgencyOrder[a.recommendation.urgency] || 2) -
             (urgencyOrder[b.recommendation.urgency] || 2);
    });

    return results;
  }

  /**
   * Get a summary of follow-up actions needed.
   * @returns {Object} { total, urgent, pending, breakdown }
   */
  function getFollowupSummary() {
    var items = getProposalsNeedingFollowup();
    var breakdown = { high: 0, medium: 0, low: 0 };

    for (var i = 0; i < items.length; i++) {
      var u = items[i].recommendation.urgency;
      breakdown[u] = (breakdown[u] || 0) + 1;
    }

    return {
      total: items.length,
      urgent: breakdown.high,
      pending: breakdown.medium + breakdown.low,
      breakdown: breakdown,
      items: items
    };
  }

  /**
   * Get available follow-up types for a given proposal.
   * @param {Object} proposal - Proposal record
   * @returns {Object[]} Array of { type, label }
   */
  function getAvailableTypes(proposal) {
    if (!proposal || !proposal.status) return [];

    var types = [];
    var seen = {};

    for (var i = 0; i < FOLLOWUP_RULES.length; i++) {
      var rule = FOLLOWUP_RULES[i];
      if (rule.status !== proposal.status) continue;
      if (seen[rule.type]) continue;
      seen[rule.type] = true;
      types.push({ type: rule.type, label: rule.label });
    }

    return types;
  }

  /* ── Public API ────────────────────────────────────────── */

  window.CortexFreelancer.ProposalFollowup = {
    getFollowupRecommendation: getFollowupRecommendation,
    generateFollowup: generateFollowup,
    getProposalsNeedingFollowup: getProposalsNeedingFollowup,
    getFollowupSummary: getFollowupSummary,
    getAvailableTypes: getAvailableTypes,
    FOLLOWUP_RULES: FOLLOWUP_RULES
  };

})();
