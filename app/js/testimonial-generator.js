/**
 * [CF-163] Testimonial Request Generator
 * Generate professional testimonial request messages based on completed
 * project details.
 * Exposed on window.CortexFreelancer.TestimonialGenerator
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_testimonial_generator';

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveHistory(history) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
    catch (e) { /* storage full */ }
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Templates ──

  var TEMPLATES = {
    professional: {
      name: 'Professional & Formal',
      generate: function (data) {
        return 'Dear ' + data.clientName + ',\n\n' +
          'I hope this message finds you well. It was a pleasure working with you on ' + data.projectName + '.\n\n' +
          'Now that we\'ve successfully completed the project' + (data.deliverables ? ' — including ' + data.deliverables : '') + ', I\'d love to kindly ask if you\'d be willing to share a brief testimonial about your experience working with me.\n\n' +
          'A few sentences about the following would be incredibly helpful:\n' +
          '• The quality of work delivered\n' +
          '• Communication and collaboration\n' +
          '• Whether you\'d recommend my services\n\n' +
          'Your testimonial would be featured on my professional profile and would help other clients feel confident in hiring me for similar projects.\n\n' +
          'If you\'re comfortable, you could also leave a review directly on ' + (data.platform || 'the platform') + '.\n\n' +
          'Thank you for the opportunity to work together, and I look forward to potential future collaborations.\n\n' +
          'Best regards,\n' + (data.freelancerName || '[Your Name]');
      }
    },
    casual: {
      name: 'Friendly & Casual',
      generate: function (data) {
        return 'Hey ' + data.clientName + '!\n\n' +
          'Thanks again for the great experience working on ' + data.projectName + '. I really enjoyed the collaboration' + (data.highlight ? ' — especially ' + data.highlight : '') + '.\n\n' +
          'I have a quick favor to ask: would you mind writing a short testimonial about working with me? It doesn\'t have to be long — even 2-3 sentences about your experience would mean a lot.\n\n' +
          'Something like:\n' +
          '• What the project was about\n' +
          '• How the work turned out\n' +
          '• Whether you\'d work with me again\n\n' +
          'It really helps me grow my freelance business and land more projects like ours.\n\n' +
          'No pressure at all — I totally understand if you\'re busy. But if you have a couple of minutes, I\'d really appreciate it!\n\n' +
          'Cheers,\n' + (data.freelancerName || '[Your Name]');
      }
    },
    linkedin: {
      name: 'LinkedIn Recommendation',
      generate: function (data) {
        return 'Hi ' + data.clientName + ',\n\n' +
          'I truly valued our work together on ' + data.projectName + (data.duration ? ' over the past ' + data.duration : '') + '.\n\n' +
          'Would you be open to writing a brief LinkedIn recommendation? It would help strengthen my professional profile and I\'d be happy to return the favor.\n\n' +
          'If it helps, here are a few talking points you might reference:\n' +
          (data.deliverables ? '• Deliverables: ' + data.deliverables + '\n' : '') +
          (data.results ? '• Results: ' + data.results + '\n' : '') +
          '• Working relationship and communication\n' +
          '• Overall experience\n\n' +
          'You can add it directly on my LinkedIn profile, or simply reply with the text and I can guide you through posting it.\n\n' +
          'Thanks so much for considering this!\n\n' +
          'Best,\n' + (data.freelancerName || '[Your Name]');
      }
    },
    followup: {
      name: 'Gentle Follow-up',
      generate: function (data) {
        return 'Hi ' + data.clientName + ',\n\n' +
          'I hope you\'re doing well! I\'m just following up on my earlier message about a possible testimonial for our work on ' + data.projectName + '.\n\n' +
          'I completely understand you\'re busy — no rush at all. If it\'s easier, I\'ve drafted a short sample that you could edit or use as inspiration:\n\n' +
          '"' + (data.freelancerName || '[Freelancer]') + ' delivered excellent work on ' + data.projectName + '. ' +
          (data.deliverables ? 'The ' + data.deliverables + ' exceeded our expectations. ' : '') +
          'Communication was clear and professional throughout. I would happily recommend their services."\n\n' +
          'Feel free to modify this in any way, or write something entirely different — whatever feels most natural to you.\n\n' +
          'Thank you again for the wonderful collaboration!\n\n' +
          'Warm regards,\n' + (data.freelancerName || '[Your Name]');
      }
    },
    portfolio: {
      name: 'Portfolio Case Study',
      generate: function (data) {
        return 'Hi ' + data.clientName + ',\n\n' +
          'I\'m putting together a case study for my portfolio based on our work on ' + data.projectName + ', and I\'d love to include a client quote.\n\n' +
          'Would you be comfortable providing a brief statement (2-4 sentences) I could feature? It could touch on:\n' +
          '• The challenge we solved together\n' +
          (data.results ? '• The results achieved (' + data.results + ')\n' : '• The impact of the deliverables\n') +
          '• Your overall satisfaction\n\n' +
          'I\'ll share the full case study with you before publishing, so you\'ll have full approval over how your quote is used.\n\n' +
          'Thank you for trusting me with this project!\n\n' +
          'Best,\n' + (data.freelancerName || '[Your Name]');
      }
    }
  };

  // ── Styles ──

  var styles = '\
    .tg-wrap{font-family:Inter,-apple-system,sans-serif;color:var(--text,#e0e0e0);max-width:900px;margin:0 auto;padding:1.5rem 1rem}\
    .tg-wrap h2{margin:0 0 .3rem;font-size:1.4rem;color:var(--text-bright,#fff)}\
    .tg-subtitle{color:var(--text-dim,#888);font-size:.85rem;margin-bottom:1.5rem}\
    .tg-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}\
    .tg-section{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1.2rem}\
    .tg-section h3{margin:0 0 .85rem;font-size:.95rem;color:var(--text-bright,#fff)}\
    .tg-field{margin-bottom:.75rem}\
    .tg-field label{display:block;font-size:.78rem;color:var(--text-dim,#888);margin-bottom:.25rem}\
    .tg-field input,.tg-field select,.tg-field textarea{width:100%;padding:.5rem .65rem;background:var(--bg,#0a0a0a);border:1px solid var(--border,#222);border-radius:var(--radius-sm,8px);color:var(--text,#e0e0e0);font-size:.85rem;font-family:inherit;box-sizing:border-box}\
    .tg-field textarea{min-height:50px;resize:vertical}\
    .tg-btn{background:var(--orange,#ff8844);color:#000;border:none;padding:.55rem 1.1rem;border-radius:var(--radius-sm,8px);cursor:pointer;font-size:.85rem;font-weight:600;transition:opacity .2s}\
    .tg-btn:hover{opacity:.85}\
    .tg-btn-sm{padding:.35rem .7rem;font-size:.78rem}\
    .tg-btn-outline{background:transparent;border:1px solid var(--border,#222);color:var(--text,#e0e0e0)}\
    .tg-btn-outline:hover{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844)}\
    .tg-output{background:var(--bg,#0a0a0a);border:1px solid var(--border,#222);border-radius:var(--radius-sm,8px);padding:1rem;white-space:pre-wrap;font-size:.85rem;line-height:1.6;min-height:200px;max-height:500px;overflow-y:auto;margin-bottom:.75rem}\
    .tg-actions{display:flex;gap:.5rem;flex-wrap:wrap}\
    .tg-template-pills{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1rem}\
    .tg-pill{padding:.35rem .7rem;border-radius:20px;border:1px solid var(--border,#222);background:transparent;color:var(--text-dim,#888);font-size:.75rem;cursor:pointer;transition:all .2s}\
    .tg-pill:hover,.tg-pill.active{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844);background:rgba(255,136,68,.08)}\
    .tg-history{margin-top:1.5rem}\
    .tg-history-item{display:flex;justify-content:space-between;align-items:center;padding:.5rem .65rem;border-bottom:1px solid var(--border,#222);font-size:.8rem}\
    .tg-history-item:last-child{border-bottom:none}\
    .tg-history-meta{color:var(--text-dim,#888);font-size:.72rem}\
    .tg-copied{position:fixed;bottom:20px;right:20px;background:var(--green,#00ff88);color:#000;padding:.5rem 1rem;border-radius:var(--radius-sm,8px);font-size:.82rem;font-weight:600;z-index:9999;animation:tgFadeIn .3s}\
    @keyframes tgFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}\
    @media(max-width:700px){.tg-grid{grid-template-columns:1fr}}\
  ';

  // ── Render ──

  function render(containerId) {
    if (!document.getElementById('tg-styles')) {
      var s = document.createElement('style');
      s.id = 'tg-styles';
      s.textContent = styles;
      document.head.appendChild(s);
    }

    var container = document.getElementById(containerId);
    if (!container) return;

    var templateKeys = Object.keys(TEMPLATES);
    var pillsHtml = '<div class="tg-template-pills">';
    templateKeys.forEach(function (key, i) {
      pillsHtml += '<button class="tg-pill' + (i === 0 ? ' active' : '') + '" data-template="' + key + '">' + escHtml(TEMPLATES[key].name) + '</button>';
    });
    pillsHtml += '</div>';

    var html = '<div class="tg-wrap">';
    html += '<h2>Testimonial Request Generator</h2>';
    html += '<p class="tg-subtitle">Generate professional messages to request testimonials from clients.</p>';

    html += '<div class="tg-grid">';

    // Input section
    html += '<div class="tg-section"><h3>Project Details</h3>';
    html += '<div class="tg-field"><label>Client Name *</label><input id="tg-client" placeholder="Jane Smith"></div>';
    html += '<div class="tg-field"><label>Project Name *</label><input id="tg-project" placeholder="Website Redesign"></div>';
    html += '<div class="tg-field"><label>Your Name</label><input id="tg-name" placeholder="Your Name"></div>';
    html += '<div class="tg-field"><label>Key Deliverables</label><input id="tg-deliverables" placeholder="responsive website, logo, brand guide"></div>';
    html += '<div class="tg-field"><label>Project Duration</label><input id="tg-duration" placeholder="6 weeks"></div>';
    html += '<div class="tg-field"><label>Key Results / Metrics</label><input id="tg-results" placeholder="40% increase in conversions"></div>';
    html += '<div class="tg-field"><label>Project Highlight</label><input id="tg-highlight" placeholder="the collaborative design process"></div>';
    html += '<div class="tg-field"><label>Platform</label><select id="tg-platform"><option value="Upwork">Upwork</option><option value="Fiverr">Fiverr</option><option value="Freelancer.com">Freelancer.com</option><option value="LinkedIn">LinkedIn</option><option value="Toptal">Toptal</option><option value="the platform">Other</option></select></div>';
    html += '<button class="tg-btn" id="tg-generate" style="width:100%;margin-top:.5rem">Generate Message</button>';
    html += '</div>';

    // Output section
    html += '<div class="tg-section"><h3>Generated Message</h3>';
    html += pillsHtml;
    html += '<div class="tg-output" id="tg-output">Fill in project details and click Generate to create a testimonial request message.</div>';
    html += '<div class="tg-actions">';
    html += '<button class="tg-btn tg-btn-sm" id="tg-copy">Copy to Clipboard</button>';
    html += '<button class="tg-btn tg-btn-sm tg-btn-outline" id="tg-save">Save to History</button>';
    html += '</div></div>';

    html += '</div>'; // grid

    // History
    var history = loadHistory();
    if (history.length) {
      html += '<div class="tg-history"><div class="tg-section"><h3>Request History</h3>';
      history.slice(0, 10).forEach(function (item, i) {
        var d = new Date(item.date);
        html += '<div class="tg-history-item"><div><strong>' + escHtml(item.clientName) + '</strong> — ' + escHtml(item.projectName) + '<br><span class="tg-history-meta">' + escHtml(item.template) + ' &middot; ' + d.toLocaleDateString() + '</span></div>';
        html += '<div><button class="tg-btn tg-btn-sm tg-btn-outline tg-history-load" data-idx="' + i + '">Load</button></div></div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // State
    var currentTemplate = templateKeys[0];

    // Events
    container.addEventListener('click', function (e) {
      var target = e.target;

      if (target.classList.contains('tg-pill')) {
        container.querySelectorAll('.tg-pill').forEach(function (p) { p.classList.remove('active'); });
        target.classList.add('active');
        currentTemplate = target.getAttribute('data-template');
        // Auto-regenerate if output has content
        var output = document.getElementById('tg-output');
        if (output && output.getAttribute('data-generated')) {
          generateMessage(currentTemplate);
        }
      }

      if (target.id === 'tg-generate') {
        generateMessage(currentTemplate);
      }

      if (target.id === 'tg-copy') {
        var output = document.getElementById('tg-output');
        if (output && output.textContent) {
          copyToClipboard(output.textContent);
        }
      }

      if (target.id === 'tg-save') {
        saveToHistory(currentTemplate);
      }

      if (target.classList.contains('tg-history-load')) {
        var idx = parseInt(target.getAttribute('data-idx'));
        var history = loadHistory();
        if (history[idx]) {
          document.getElementById('tg-output').textContent = history[idx].message;
          document.getElementById('tg-output').setAttribute('data-generated', '1');
        }
      }
    });
  }

  function gatherData() {
    return {
      clientName: (document.getElementById('tg-client') || {}).value || 'Client',
      projectName: (document.getElementById('tg-project') || {}).value || 'the project',
      freelancerName: (document.getElementById('tg-name') || {}).value || '',
      deliverables: (document.getElementById('tg-deliverables') || {}).value || '',
      duration: (document.getElementById('tg-duration') || {}).value || '',
      results: (document.getElementById('tg-results') || {}).value || '',
      highlight: (document.getElementById('tg-highlight') || {}).value || '',
      platform: (document.getElementById('tg-platform') || {}).value || 'the platform'
    };
  }

  function generateMessage(templateKey) {
    var data = gatherData();
    var template = TEMPLATES[templateKey];
    if (!template) return '';
    var message = template.generate(data);
    var output = document.getElementById('tg-output');
    if (output) {
      output.textContent = message;
      output.setAttribute('data-generated', '1');
    }
    return message;
  }

  function saveToHistory(templateKey) {
    var data = gatherData();
    var output = document.getElementById('tg-output');
    if (!output || !output.getAttribute('data-generated')) return;

    var history = loadHistory();
    history.unshift({
      clientName: data.clientName,
      projectName: data.projectName,
      template: TEMPLATES[templateKey] ? TEMPLATES[templateKey].name : templateKey,
      message: output.textContent,
      date: Date.now()
    });
    if (history.length > 50) history = history.slice(0, 50);
    saveHistory(history);
    showToast('Saved to history');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { showToast('Copied!'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Copied!');
    }
  }

  function showToast(msg) {
    var existing = document.querySelector('.tg-copied');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'tg-copied';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2000);
  }

  // ── Public API ──

  var TestimonialGenerator = {
    init: function () {},
    render: render,
    generate: function (templateKey, data) {
      var template = TEMPLATES[templateKey];
      return template ? template.generate(data) : '';
    },
    getTemplates: function () { return Object.keys(TEMPLATES); },
    getHistory: loadHistory
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TestimonialGenerator = TestimonialGenerator;
})();
