// ===== RESULT ANIMATIONS — Cortex Freelancer =====
// Result reveal slide-in, score count-up, progress bar fill animation.
// Attaches to tool result containers and animates when results appear.

(function () {
  'use strict';

  // ── Bail if user prefers reduced motion ──
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Inject minimal styles ──
  var style = document.createElement('style');
  style.textContent =
    '.result-reveal{opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease}' +
    '.result-reveal.result-visible{opacity:1;transform:translateY(0)}' +
    '.result-slide-left{opacity:0;transform:translateX(-30px);transition:opacity .4s ease,transform .4s ease}' +
    '.result-slide-left.result-visible{opacity:1;transform:translateX(0)}' +
    '.result-slide-right{opacity:0;transform:translateX(30px);transition:opacity .4s ease,transform .4s ease}' +
    '.result-slide-right.result-visible{opacity:1;transform:translateX(0)}' +
    '@media(prefers-reduced-motion:reduce){.result-reveal,.result-slide-left,.result-slide-right{opacity:1;transform:none;transition:none}}';
  document.head.appendChild(style);

  // ── Count-up animation ──
  // Animates a number from 0 to target over duration ms
  function countUp(el, target, duration, prefix, suffix) {
    if (reducedMotion) { el.textContent = (prefix || '') + target + (suffix || ''); return; }
    var start = 0;
    var startTime = null;
    var isFloat = target % 1 !== 0;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = start + (target - start) * eased;

      if (isFloat) {
        el.textContent = (prefix || '') + current.toFixed(1) + (suffix || '');
      } else {
        el.textContent = (prefix || '') + Math.round(current) + (suffix || '');
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = (prefix || '') + target + (suffix || '');
      }
    }

    requestAnimationFrame(step);
  }

  // ── Progress bar fill animation ──
  // Animates width from 0 to targetPercent
  function fillBar(el, targetPercent, duration) {
    if (reducedMotion) { el.style.width = targetPercent + '%'; return; }
    el.style.width = '0%';
    el.style.transition = 'width ' + duration + 'ms cubic-bezier(0.4, 0, 0.2, 1)';
    // Trigger reflow
    el.offsetWidth; // eslint-disable-line no-unused-expressions
    el.style.width = targetPercent + '%';
  }

  // ── Reveal result container with slide-in ──
  function revealResult(container, delay) {
    if (reducedMotion) {
      container.style.opacity = '1';
      container.style.transform = 'none';
      return;
    }
    container.classList.add('result-reveal');
    setTimeout(function () {
      container.classList.add('result-visible');
    }, delay || 50);
  }

  // ── Staggered reveal for child elements ──
  function revealChildren(parent, selector, baseDelay) {
    var children = parent.querySelectorAll(selector);
    for (var i = 0; i < children.length; i++) {
      (function (child, index) {
        child.classList.add('result-slide-left');
        setTimeout(function () {
          child.classList.add('result-visible');
        }, (baseDelay || 100) + index * 80);
      })(children[i], i);
    }
  }

  // ── Expose public API ──
  window.CortexResultAnimations = {
    countUp: countUp,
    fillBar: fillBar,
    revealResult: revealResult,
    revealChildren: revealChildren
  };

  // ── Auto-detect and animate common result patterns ──
  function autoAnimate() {
    // Watch for result sections becoming visible (display change)
    if (!('MutationObserver' in window)) return;

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var target = mutations[i].target;

        // Check if a result/output section just became visible
        if (mutations[i].attributeName === 'style' || mutations[i].attributeName === 'class') {
          var display = window.getComputedStyle(target).display;
          if (display !== 'none' && target.dataset.cortexAnimated !== 'true') {
            // Check if this is a result container
            if (target.classList.contains('output-section') ||
                target.classList.contains('result-card') ||
                target.classList.contains('inv-preview') ||
                target.classList.contains('prop-preview') ||
                target.id === 'resultSection' ||
                target.id === 'outputSection') {
              target.dataset.cortexAnimated = 'true';
              revealResult(target, 50);

              // Auto-animate score elements
              var scoreEls = target.querySelectorAll('[data-score]');
              for (var j = 0; j < scoreEls.length; j++) {
                var val = parseFloat(scoreEls[j].getAttribute('data-score'));
                if (!isNaN(val)) {
                  countUp(scoreEls[j], val, 1200, '', '');
                }
              }

              // Auto-animate progress bars
              var bars = target.querySelectorAll('[data-fill]');
              for (var k = 0; k < bars.length; k++) {
                var pct = parseFloat(bars[k].getAttribute('data-fill'));
                if (!isNaN(pct)) {
                  fillBar(bars[k], pct, 800);
                }
              }

              // Stagger children
              revealChildren(target, '.result-item, .breakdown-item, .inv-line, .fee-bar', 150);
            }
          }
        }
      }
    });

    // Observe the whole document for style/class changes on result containers
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoAnimate);
  } else {
    autoAnimate();
  }
})();
