/**
 * CortexRepeatClient — Repeat client identification & outreach data layer
 * Scans CRM data to surface past clients ripe for re-engagement,
 * scores them, and generates outreach message templates.
 * All data stored in localStorage.
 *
 * window.CortexRepeatClient
 */
(function () {
  'use strict';

  var CRM_KEY = 'cortex_client_crm';
  var OUTREACH_KEY = 'cortex_repeat_outreach';

  /* ── Helpers ────────────────────────────────────────────── */

  function loadClients() {
    try {
      return JSON.parse(localStorage.getItem(CRM_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function loadOutreach() {
    try {
      return JSON.parse(localStorage.getItem(OUTREACH_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveOutreach(items) {
    localStorage.setItem(OUTREACH_KEY, JSON.stringify(items));
  }

  function daysSince(dateStr) {
    if (!dateStr) return 999;
    var then = new Date(dateStr);
    if (isNaN(then.getTime())) return 999;
    return Math.floor((Date.now() - then.getTime()) / 86400000);
  }

  /* ── Scoring ───────────────────────────────────────────── */

  /**
   * Score a client for re-engagement potential (0-100).
   * Higher = more likely to re-engage and worth reaching out.
   */
  function scoreClient(client) {
    var score = 50; // baseline

    // Tag bonus
    if (client.tag === 'hot') score += 20;
    else if (client.tag === 'warm') score += 10;
    else if (client.tag === 'cold') score -= 5;
    else if (client.tag === 'lost') score -= 15;

    // Recency of last communication
    var lastComm = null;
    if (client.communications && client.communications.length > 0) {
      lastComm = client.communications[client.communications.length - 1];
    }
    var lastContactDate = lastComm ? lastComm.date : client.updatedAt;
    var days = daysSince(lastContactDate);

    // Sweet spot: 30-90 days = best re-engagement window
    if (days >= 30 && days <= 60) score += 15;
    else if (days > 60 && days <= 90) score += 10;
    else if (days > 90 && days <= 180) score += 5;
    else if (days > 180) score -= 5;
    else if (days < 14) score -= 10; // too recent

    // Has email = easier outreach
    if (client.email) score += 5;

    // Has notes = richer relationship
    if (client.notes && client.notes.length > 0) score += 5;

    // Multiple communications = established relationship
    if (client.communications && client.communications.length >= 3) score += 10;
    else if (client.communications && client.communications.length >= 1) score += 5;

    // Follow-up date is past due
    if (client.followUpDate && daysSince(client.followUpDate) > 0) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get repeat client candidates sorted by score descending.
   * Filters out 'lost' clients by default unless includeAll is true.
   */
  function getCandidates(opts) {
    opts = opts || {};
    var clients = loadClients();
    var minScore = opts.minScore || 0;
    var includeAll = opts.includeAll || false;
    var minDays = opts.minDaysSinceContact || 14;

    var candidates = [];
    for (var i = 0; i < clients.length; i++) {
      var c = clients[i];

      // Skip lost unless requested
      if (!includeAll && c.tag === 'lost') continue;

      // Skip very recent contacts
      var lastComm = null;
      if (c.communications && c.communications.length > 0) {
        lastComm = c.communications[c.communications.length - 1];
      }
      var lastContactDate = lastComm ? lastComm.date : c.updatedAt;
      var days = daysSince(lastContactDate);
      if (days < minDays) continue;

      var s = scoreClient(c);
      if (s < minScore) continue;

      candidates.push({
        client: c,
        score: s,
        daysSinceContact: days,
        lastContactDate: lastContactDate,
        reason: buildReason(c, s, days)
      });
    }

    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates;
  }

  function buildReason(client, score, days) {
    var reasons = [];
    if (days >= 30 && days <= 90) reasons.push('In re-engagement sweet spot (' + days + ' days)');
    else if (days > 90) reasons.push('Haven\'t heard from them in ' + days + ' days');
    if (client.tag === 'hot') reasons.push('Tagged as hot lead');
    else if (client.tag === 'warm') reasons.push('Tagged as warm lead');
    if (client.followUpDate && daysSince(client.followUpDate) > 0) reasons.push('Follow-up overdue');
    if (client.communications && client.communications.length >= 3) reasons.push('Established relationship');
    if (score >= 75) reasons.push('High re-engagement potential');
    return reasons.length > 0 ? reasons.join('; ') : 'Potential repeat client';
  }

  /* ── Outreach Templates ────────────────────────────────── */

  var OUTREACH_TEMPLATES = {
    checkIn: {
      label: 'Friendly Check-In',
      desc: 'Casual message to reconnect without an ask',
      build: function (client, opts) {
        var name = client.name || 'there';
        var yourName = opts.yourName || '';
        var closer = yourName ? '\nBest,\n' + yourName : '\nBest';
        var subject = 'Hey ' + name.split(' ')[0] + ' — quick check-in';
        var body = 'Hi ' + name + ',\n\n';
        body += 'It\'s been a while since we last connected and I wanted to see how things are going on your end.\n\n';
        if (opts.lastProject) {
          body += 'I really enjoyed working on ' + opts.lastProject + ' together. Hope it\'s been delivering great results!\n\n';
        }
        body += 'No agenda here — just genuinely curious how things are going. Would love to catch up if you have a few minutes.';
        body += closer;
        return { subject: subject, body: body };
      }
    },
    newService: {
      label: 'New Service Offering',
      desc: 'Introduce a new skill or service to past clients',
      build: function (client, opts) {
        var name = client.name || 'there';
        var yourName = opts.yourName || '';
        var closer = yourName ? '\nBest regards,\n' + yourName : '\nBest regards';
        var service = opts.newService || 'expanded my service offerings';
        var subject = 'Something new I thought you\'d find useful';
        var body = 'Hi ' + name + ',\n\n';
        body += 'I hope you\'ve been well! I wanted to reach out because I\'ve recently ' + service + '.\n\n';
        body += 'Given the work we\'ve done together, I thought this could be a great fit for what you\'re building.\n\n';
        body += 'Here\'s what I can now help with:\n';
        body += '- ' + (opts.bullet1 || 'Strategy and planning for the next phase') + '\n';
        body += '- ' + (opts.bullet2 || 'Implementation and execution') + '\n';
        body += '- ' + (opts.bullet3 || 'Ongoing support and optimization') + '\n\n';
        body += 'Would you be interested in a quick 15-minute call to explore if this could help? No pressure at all.';
        body += closer;
        return { subject: subject, body: body };
      }
    },
    seasonalTouch: {
      label: 'Seasonal / Milestone Touch',
      desc: 'Reconnect around a season, holiday, or anniversary',
      build: function (client, opts) {
        var name = client.name || 'there';
        var yourName = opts.yourName || '';
        var closer = yourName ? '\nWarm regards,\n' + yourName : '\nWarm regards';
        var occasion = opts.occasion || 'the new quarter';
        var subject = 'Happy ' + occasion + ', ' + name.split(' ')[0] + '!';
        var body = 'Hi ' + name + ',\n\n';
        body += 'With ' + occasion + ' coming up, I wanted to drop a quick note and say hi.\n\n';
        if (opts.lastProject) {
          body += 'I still think about the work we did on ' + opts.lastProject + ' — it was one of my favorite projects last year.\n\n';
        }
        body += 'If you\'re planning anything new this season, I\'d love to be part of it. My schedule has some openings and I always prioritize returning clients.\n\n';
        body += 'Either way, hope you\'re doing great!';
        body += closer;
        return { subject: subject, body: body };
      }
    },
    valueAdd: {
      label: 'Value-Add Resource',
      desc: 'Share something useful to re-open the conversation',
      build: function (client, opts) {
        var name = client.name || 'there';
        var yourName = opts.yourName || '';
        var closer = yourName ? '\nCheers,\n' + yourName : '\nCheers';
        var resource = opts.resource || 'an article about trends in your industry';
        var subject = 'Thought you\'d find this useful';
        var body = 'Hi ' + name + ',\n\n';
        body += 'I came across ' + resource + ' and immediately thought of you.\n\n';
        if (opts.relevance) {
          body += 'Given that you\'re working on ' + opts.relevance + ', I think you\'ll find it particularly relevant.\n\n';
        }
        body += 'No strings attached — just wanted to share. But if it sparks any ideas for projects you need help with, I\'d love to chat.\n\n';
        body += 'Hope things are going well on your end!';
        body += closer;
        return { subject: subject, body: body };
      }
    },
    projectFollow: {
      label: 'Project Results Follow-Up',
      desc: 'Check on results from past work to open door for more',
      build: function (client, opts) {
        var name = client.name || 'there';
        var yourName = opts.yourName || '';
        var closer = yourName ? '\nBest,\n' + yourName : '\nBest';
        var project = opts.lastProject || 'our last project';
        var subject = 'How did ' + project + ' turn out?';
        var body = 'Hi ' + name + ',\n\n';
        body += 'I\'ve been thinking about ' + project + ' and I\'m curious — how have things been going since we wrapped up?\n\n';
        body += 'I ask because:\n';
        body += '- I genuinely care about the outcomes, not just the deliverables\n';
        body += '- Any feedback helps me improve for future work\n';
        body += '- If there are any tweaks needed, I\'d be happy to discuss\n\n';
        body += 'Also, if there are any new initiatives on the horizon where I could help, I\'d love to hear about them. My calendar has some availability over the next few weeks.\n\n';
        body += 'Either way, I\'d appreciate hearing how things are going!';
        body += closer;
        return { subject: subject, body: body };
      }
    }
  };

  /**
   * Generate outreach message for a client using a template.
   */
  function generateOutreach(clientId, templateKey, opts) {
    opts = opts || {};
    var clients = loadClients();
    var client = null;
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].id === clientId) { client = clients[i]; break; }
    }
    if (!client) return null;

    var template = OUTREACH_TEMPLATES[templateKey];
    if (!template) return null;

    var result = template.build(client, opts);
    return {
      clientId: clientId,
      clientName: client.name,
      template: templateKey,
      templateLabel: template.label,
      subject: result.subject,
      body: result.body,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Save a generated outreach to history.
   */
  function saveOutreachRecord(record) {
    var items = loadOutreach();
    items.unshift(record);
    if (items.length > 50) items.length = 50;
    saveOutreach(items);
    return record;
  }

  /**
   * Get outreach history.
   */
  function getOutreachHistory() {
    return loadOutreach();
  }

  /**
   * Delete an outreach record by index.
   */
  function deleteOutreachRecord(index) {
    var items = loadOutreach();
    if (index >= 0 && index < items.length) {
      items.splice(index, 1);
      saveOutreach(items);
    }
    return items;
  }

  /**
   * Get available template keys and labels.
   */
  function getTemplates() {
    var result = [];
    for (var key in OUTREACH_TEMPLATES) {
      if (OUTREACH_TEMPLATES.hasOwnProperty(key)) {
        result.push({
          key: key,
          label: OUTREACH_TEMPLATES[key].label,
          desc: OUTREACH_TEMPLATES[key].desc
        });
      }
    }
    return result;
  }

  /* ── Public API ─────────────────────────────────────────── */

  window.CortexRepeatClient = {
    getCandidates: getCandidates,
    scoreClient: scoreClient,
    generateOutreach: generateOutreach,
    saveOutreachRecord: saveOutreachRecord,
    getOutreachHistory: getOutreachHistory,
    deleteOutreachRecord: deleteOutreachRecord,
    getTemplates: getTemplates
  };
})();
