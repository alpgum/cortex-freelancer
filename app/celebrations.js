// ===== CELEBRATIONS — Cortex Freelancer =====
// Confetti + banner on first invoice/proposal generation.
// Detects via localStorage flags: cortex_first_invoice, cortex_first_proposal.

(function () {
  'use strict';

  var INVOICE_KEY = 'cortex_first_invoice';
  var PROPOSAL_KEY = 'cortex_first_proposal';

  // ── Load celebrations CSS ──
  if (!document.getElementById('cortex-celebrations-css')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/app/celebrations.css';
    link.id = 'cortex-celebrations-css';
    document.head.appendChild(link);
  }

  // ── Confetti particle system ──
  function launchConfetti(duration) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var particles = [];
    var colors = ['#ff8844', '#00ff88', '#ff4466', '#ffcc00', '#4488ff', '#aa66ff', '#00ccff'];
    var startTime = Date.now();
    var totalDuration = duration || 3000;

    // Create particles
    for (var i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * canvas.height * 0.5,
        w: 4 + Math.random() * 6,
        h: 6 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        oscillation: Math.random() * Math.PI * 2,
        oscillationSpeed: 0.02 + Math.random() * 0.03
      });
    }

    function animate() {
      var elapsed = Date.now() - startTime;
      var progress = elapsed / totalDuration;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fade out in last 30%
      var alpha = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx + Math.sin(p.oscillation) * 0.5;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.oscillation += p.oscillationSpeed;
        p.vy += 0.05; // gravity

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < totalDuration) {
        requestAnimationFrame(animate);
      } else {
        canvas.parentNode.removeChild(canvas);
      }
    }

    requestAnimationFrame(animate);

    // Handle resize
    function onResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', onResize);
    setTimeout(function () {
      window.removeEventListener('resize', onResize);
    }, totalDuration + 100);
  }

  // ── Show celebration banner ──
  function showBanner(type) {
    var emoji, title, message;

    if (type === 'invoice') {
      emoji = '\uD83C\uDF89';
      title = 'First Invoice Created!';
      message = 'You just created your first professional invoice. You\'re on your way to getting paid faster!';
    } else {
      emoji = '\uD83D\uDE80';
      title = 'First Proposal Sent!';
      message = 'Your first AI-powered proposal is ready. Time to win that client!';
    }

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    document.body.appendChild(overlay);

    // Create banner
    var banner = document.createElement('div');
    banner.className = 'celebration-banner';
    banner.innerHTML =
      '<span class="celebration-emoji">' + emoji + '</span>' +
      '<h3>' + title + '</h3>' +
      '<p>' + message + '</p>' +
      '<button class="celebration-dismiss">Awesome!</button>';
    document.body.appendChild(banner);

    // Show with delay
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('show');
        banner.classList.add('show');
      });
    });

    // Dismiss handler
    function dismiss() {
      banner.classList.remove('show');
      overlay.classList.remove('show');
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 400);
    }

    banner.querySelector('.celebration-dismiss').addEventListener('click', dismiss);
    overlay.addEventListener('click', dismiss);

    // Auto-dismiss after 6 seconds
    setTimeout(dismiss, 6000);
  }

  // ── Trigger celebration ──
  function celebrate(type) {
    launchConfetti(3500);
    setTimeout(function () {
      showBanner(type);
    }, 500);
  }

  // ── Public API ──
  // Tools call this when an invoice or proposal is generated
  window.CortexCelebrations = {
    checkAndCelebrate: function (type) {
      var key = type === 'invoice' ? INVOICE_KEY : PROPOSAL_KEY;
      if (localStorage.getItem(key)) return; // Already celebrated
      localStorage.setItem(key, Date.now().toString());
      celebrate(type);
    },
    // Manual trigger for testing
    triggerConfetti: launchConfetti
  };

  // ── Auto-detect first generation ──
  // Watch for common invoice/proposal generation events
  function setupAutoDetection() {
    var path = window.location.pathname;

    // Invoice page
    if (path.indexOf('/tools/invoice') !== -1) {
      watchForGeneration('invoice');
    }
    // Proposal page
    if (path.indexOf('/tools/proposal') !== -1) {
      watchForGeneration('proposal');
    }
  }

  function watchForGeneration(type) {
    var key = type === 'invoice' ? INVOICE_KEY : PROPOSAL_KEY;
    if (localStorage.getItem(key)) return; // Already celebrated

    // Listen for the preview section becoming visible
    var previewSelector = type === 'invoice' ? '.inv-preview' : '.prop-preview';

    if (!('MutationObserver' in window)) return;

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var target = mutations[i].target;
        // Check if the preview section or its parent became visible
        var preview = document.querySelector(previewSelector);
        if (preview) {
          var display = window.getComputedStyle(preview).display;
          var opacity = window.getComputedStyle(preview).opacity;
          if (display !== 'none' && opacity !== '0' && preview.innerHTML.trim().length > 100) {
            if (!localStorage.getItem(key)) {
              observer.disconnect();
              // Small delay to let the result render
              setTimeout(function () {
                window.CortexCelebrations.checkAndCelebrate(type);
              }, 800);
            }
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoDetection);
  } else {
    setupAutoDetection();
  }
})();
