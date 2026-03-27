/**
 * CortexTestimonialRequest — Testimonial Request Generator
 * Generate personalized testimonial request emails after project completion.
 * Include project details, deliverables, metrics. Provide client with a
 * simple structure to write their testimonial. Store collected testimonials.
 *
 * window.CortexTestimonialRequest
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_testimonials';
  var REQUESTS_KEY = 'cortex_testimonial_requests';

  /* ── Storage helpers ─────────────────────────────────────── */

  function loadData(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function generateId() {
    return 'tst_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ── Email templates ─────────────────────────────────────── */

  function buildSubjectLine(data) {
    var templates = [
      'Quick favor — would you share a few words about our work together?',
      'Would love your feedback on the ' + (data.projectName || 'project'),
      'A short testimonial would mean the world to me',
      data.clientName + ', could I get a quick testimonial?'
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  function buildDeliverablesBlock(deliverables) {
    if (!deliverables || !deliverables.length) return '';
    var lines = deliverables.map(function (d) { return '  - ' + d; });
    return '\nKey deliverables:\n' + lines.join('\n') + '\n';
  }

  function buildMetricsBlock(metrics) {
    if (!metrics || !metrics.length) return '';
    var lines = metrics.map(function (m) { return '  - ' + m; });
    return '\nResults achieved:\n' + lines.join('\n') + '\n';
  }

  function buildTestimonialStructure() {
    return [
      '--- TESTIMONIAL STRUCTURE (pick any format) ---',
      '',
      'Option A — Quick One-liner:',
      '"[Your name] helped me [result]. I\'d recommend them to anyone who needs [skill]."',
      '',
      'Option B — Short Paragraph (3-4 sentences):',
      '1. What was the challenge/project?',
      '2. How was the experience working together?',
      '3. What was the result or impact?',
      '4. Would you recommend? Why?',
      '',
      'Option C — Structured:',
      '- Project type: ___',
      '- What stood out: ___',
      '- Results/impact: ___',
      '- Rating (1-5): ___',
      '- Would you hire again? ___',
      '',
      '--- END STRUCTURE ---'
    ].join('\n');
  }

  /**
   * Generate a personalized testimonial request email.
   * @param {Object} data
   * @param {string} data.clientName
   * @param {string} data.clientEmail
   * @param {string} data.projectName
   * @param {string} [data.projectDescription]
   * @param {string[]} [data.deliverables]
   * @param {string[]} [data.metrics]
   * @param {string} [data.startDate]
   * @param {string} [data.endDate]
   * @param {string} [data.tone] — 'friendly' | 'professional' | 'casual'
   * @param {string} [data.freelancerName]
   * @returns {Object} { subject, body, html }
   */
  function generateEmail(data) {
    if (!data || !data.clientName) {
      throw new Error('clientName is required');
    }

    var tone = data.tone || 'friendly';
    var fname = data.freelancerName || 'your freelancer';
    var subject = buildSubjectLine(data);

    var greeting = tone === 'casual'
      ? 'Hey ' + data.clientName + '!'
      : tone === 'professional'
        ? 'Dear ' + data.clientName + ','
        : 'Hi ' + data.clientName + ',';

    var opener = tone === 'casual'
      ? 'Hope you\'re doing great! Now that we\'ve wrapped up ' + (data.projectName || 'the project') + ', I wanted to reach out with a small ask.'
      : tone === 'professional'
        ? 'I hope this message finds you well. With the successful completion of ' + (data.projectName || 'our project') + ', I wanted to follow up with a brief request.'
        : 'Hope all is well! Now that ' + (data.projectName || 'the project') + ' is wrapped up, I wanted to reach out.';

    var timeframe = '';
    if (data.startDate && data.endDate) {
      timeframe = '\nProject timeline: ' + data.startDate + ' — ' + data.endDate + '\n';
    }

    var deliverablesBlock = buildDeliverablesBlock(data.deliverables);
    var metricsBlock = buildMetricsBlock(data.metrics);

    var ask = tone === 'professional'
      ? 'If you were satisfied with the work, I would greatly appreciate a brief testimonial. It would help me tremendously in building my freelance practice.'
      : tone === 'casual'
        ? 'If you liked the work, a quick testimonial would seriously help me out. No pressure at all — even a couple sentences would be amazing.'
        : 'If you\'re happy with how things turned out, I\'d really appreciate a short testimonial. It helps me a lot when connecting with new clients.';

    var structure = buildTestimonialStructure();

    var closer = tone === 'professional'
      ? 'Thank you for your time, and it was a pleasure working with you.'
      : tone === 'casual'
        ? 'Thanks a ton — really enjoyed working together!'
        : 'Thanks so much, and I really enjoyed working together!';

    var signoff = tone === 'professional'
      ? 'Best regards,\n' + fname
      : 'Cheers,\n' + fname;

    var body = [
      greeting,
      '',
      opener,
      timeframe,
      data.projectDescription ? 'Project: ' + data.projectDescription + '\n' : '',
      deliverablesBlock,
      metricsBlock,
      ask,
      '',
      'To make it easy, here\'s a simple structure you can use (or just write freely):',
      '',
      structure,
      '',
      closer,
      '',
      signoff
    ].filter(Boolean).join('\n');

    // Build HTML version
    var html = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/--- TESTIMONIAL STRUCTURE.*?---/g, '<strong style="color:#ff8844">$&</strong>')
      .replace(/--- END STRUCTURE ---/g, '<strong style="color:#ff8844">$&</strong>');

    return { subject: subject, body: body, html: html };
  }

  /* ── Request tracking ────────────────────────────────────── */

  function saveRequest(data, email) {
    var requests = loadData(REQUESTS_KEY);
    var request = {
      id: generateId(),
      clientName: data.clientName,
      clientEmail: data.clientEmail || '',
      projectName: data.projectName || '',
      subject: email.subject,
      sentAt: new Date().toISOString(),
      status: 'sent',
      testimonial: null
    };
    requests.unshift(request);
    saveData(REQUESTS_KEY, requests);
    return request;
  }

  function getRequests() {
    return loadData(REQUESTS_KEY);
  }

  function updateRequestStatus(id, status) {
    var requests = loadData(REQUESTS_KEY);
    for (var i = 0; i < requests.length; i++) {
      if (requests[i].id === id) {
        requests[i].status = status;
        requests[i].updatedAt = new Date().toISOString();
        saveData(REQUESTS_KEY, requests);
        return requests[i];
      }
    }
    return null;
  }

  /* ── Testimonial storage ─────────────────────────────────── */

  function saveTestimonial(testimonial) {
    if (!testimonial || !testimonial.clientName || !testimonial.text) {
      throw new Error('clientName and text are required');
    }
    var testimonials = loadData(STORAGE_KEY);
    var entry = {
      id: generateId(),
      clientName: testimonial.clientName,
      clientEmail: testimonial.clientEmail || '',
      projectName: testimonial.projectName || '',
      text: testimonial.text,
      rating: testimonial.rating || null,
      platform: testimonial.platform || '',
      createdAt: new Date().toISOString(),
      featured: false
    };
    testimonials.unshift(entry);
    saveData(STORAGE_KEY, testimonials);

    // If linked to a request, mark it received
    if (testimonial.requestId) {
      updateRequestStatus(testimonial.requestId, 'received');
    }

    return entry;
  }

  function getTestimonials() {
    return loadData(STORAGE_KEY);
  }

  function deleteTestimonial(id) {
    var testimonials = loadData(STORAGE_KEY);
    var filtered = testimonials.filter(function (t) { return t.id !== id; });
    saveData(STORAGE_KEY, filtered);
    return filtered;
  }

  function toggleFeatured(id) {
    var testimonials = loadData(STORAGE_KEY);
    for (var i = 0; i < testimonials.length; i++) {
      if (testimonials[i].id === id) {
        testimonials[i].featured = !testimonials[i].featured;
        saveData(STORAGE_KEY, testimonials);
        return testimonials[i];
      }
    }
    return null;
  }

  function getFeatured() {
    return loadData(STORAGE_KEY).filter(function (t) { return t.featured; });
  }

  function deleteRequest(id) {
    var requests = loadData(REQUESTS_KEY);
    var filtered = requests.filter(function (r) { return r.id !== id; });
    saveData(REQUESTS_KEY, filtered);
    return filtered;
  }

  /* ── Stats ───────────────────────────────────────────────── */

  function getStats() {
    var requests = loadData(REQUESTS_KEY);
    var testimonials = loadData(STORAGE_KEY);
    var received = requests.filter(function (r) { return r.status === 'received'; }).length;
    var avgRating = 0;
    var rated = testimonials.filter(function (t) { return t.rating; });
    if (rated.length) {
      var sum = rated.reduce(function (a, t) { return a + t.rating; }, 0);
      avgRating = Math.round((sum / rated.length) * 10) / 10;
    }
    return {
      totalRequests: requests.length,
      received: received,
      responseRate: requests.length ? Math.round((received / requests.length) * 100) : 0,
      totalTestimonials: testimonials.length,
      featured: testimonials.filter(function (t) { return t.featured; }).length,
      avgRating: avgRating
    };
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.CortexTestimonialRequest = {
    generateEmail: generateEmail,
    saveRequest: saveRequest,
    getRequests: getRequests,
    updateRequestStatus: updateRequestStatus,
    deleteRequest: deleteRequest,
    saveTestimonial: saveTestimonial,
    getTestimonials: getTestimonials,
    deleteTestimonial: deleteTestimonial,
    toggleFeatured: toggleFeatured,
    getFeatured: getFeatured,
    getStats: getStats
  };
})();
