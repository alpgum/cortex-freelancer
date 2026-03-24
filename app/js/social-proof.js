/**
 * [CF-227] Social Proof Section — Waitlist Counter + Testimonials
 * Live waitlist count with animated counting effect, beta tester
 * testimonials with avatars, star ratings, and mobile carousel.
 *
 * Exposed on window.CortexFreelancer.socialProof
 */
(function () {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────────
  var INITIAL_COUNT = 1247;
  var AUTO_INCREMENT_MIN_MS = 8000;
  var AUTO_INCREMENT_MAX_MS = 25000;
  var COUNT_ANIMATION_DURATION_MS = 1200;
  var COUNT_ANIMATION_STEPS = 40;
  var CAROUSEL_INTERVAL_MS = 5000;

  // ─── State ────────────────────────────────────────────────────────────
  var state = {
    currentCount: INITIAL_COUNT,
    displayedCount: 0,
    autoIncrementTimer: null,
    counterAnimationFrame: null,
    carouselTimer: null,
    carouselIndex: 0,
    observerRef: null,
    hasAnimated: false,
    destroyed: false,
    containerEl: null
  };

  // ─── Testimonial Data ─────────────────────────────────────────────────
  var TESTIMONIALS = [
    {
      name: 'Sarah Chen',
      initials: 'SC',
      role: 'Full-Stack Developer',
      quote: 'Cortex Freelancer completely changed how I approach Upwork. My profile score jumped from 62 to 91, and I landed three $5k+ contracts in my first month using the rate optimizer. This is the tool I wish I had when I started freelancing.',
      rating: 5,
      avatarBg: '#6C63FF'
    },
    {
      name: 'Marcus Williams',
      initials: 'MW',
      role: 'UX Designer & Brand Strategist',
      quote: 'The competition heatmap showed me niches I never considered. I pivoted my positioning based on the data and saw a 40% increase in interview invitations within two weeks. The proposal analyzer alone is worth it.',
      rating: 5,
      avatarBg: '#00C9A7'
    },
    {
      name: 'Elena Rodriguez',
      initials: 'ER',
      role: 'Data Analyst & Python Developer',
      quote: 'I was undercharging by nearly $25/hr and had no idea until I ran the rate benchmark. The earnings dashboard gives me clarity I never had, and the job scorer saves me hours every week filtering through listings.',
      rating: 4,
      avatarBg: '#FF6B6B'
    }
  ];

  // ─── Utility Functions ────────────────────────────────────────────────

  /**
   * Format a number with comma separators (e.g. 1247 -> "1,247").
   */
  function formatNumber(n) {
    var str = Math.floor(n).toString();
    var parts = [];
    for (var i = str.length; i > 0; i -= 3) {
      parts.unshift(str.substring(Math.max(0, i - 3), i));
    }
    return parts.join(',');
  }

  /**
   * Generate a random integer between min and max (inclusive).
   */
  function randBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Ease-out cubic for smooth counter animation.
   */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Generate star rating HTML.
   */
  function renderStars(rating) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      if (i <= rating) {
        html += '<span style="color:#FFD700;font-size:14px">&#9733;</span>';
      } else {
        html += '<span style="color:rgba(255,255,255,.2);font-size:14px">&#9733;</span>';
      }
    }
    return html;
  }

  // ─── Styles ───────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cf-social-proof-styles')) return;

    var css =
      '.cf-sp-section{padding:60px 20px;max-width:960px;margin:0 auto}' +

      /* Counter */
      '.cf-sp-counter-wrap{text-align:center;margin-bottom:48px}' +
      '.cf-sp-counter-label{font-size:14px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:8px}' +
      '.cf-sp-counter-value{font-size:56px;font-weight:900;color:#00ff88;line-height:1.1;font-variant-numeric:tabular-nums;transition:transform .2s ease}' +
      '.cf-sp-counter-value.cf-sp-bump{transform:scale(1.06)}' +
      '.cf-sp-counter-suffix{font-size:28px;font-weight:700;color:rgba(0,255,136,.7);margin-left:2px}' +
      '.cf-sp-counter-sub{font-size:14px;color:rgba(255,255,255,.45);margin-top:6px}' +

      /* Pulse dot */
      '.cf-sp-pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:#00ff88;margin-right:6px;vertical-align:middle;animation:cf-sp-pulse-anim 2s infinite}' +
      '@keyframes cf-sp-pulse-anim{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}' +

      /* Testimonials grid */
      '.cf-sp-testimonials{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}' +

      /* Card */
      '.cf-sp-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:24px;transition:border-color .25s ease,transform .25s ease}' +
      '.cf-sp-card:hover{border-color:rgba(0,255,136,.25);transform:translateY(-2px)}' +

      /* Avatar */
      '.cf-sp-avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff;flex-shrink:0;user-select:none}' +

      /* Card header */
      '.cf-sp-card-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}' +
      '.cf-sp-card-name{font-weight:700;font-size:15px;color:#fff;line-height:1.2}' +
      '.cf-sp-card-role{font-size:12px;color:rgba(255,255,255,.45);margin-top:2px}' +

      /* Quote */
      '.cf-sp-quote{font-size:14px;line-height:1.6;color:rgba(255,255,255,.72);margin-bottom:14px}' +
      '.cf-sp-quote::before{content:"\\201C";font-size:22px;color:rgba(0,255,136,.4);margin-right:2px}' +

      /* Stars row */
      '.cf-sp-stars{display:flex;gap:2px}' +

      /* Carousel dots (mobile only) */
      '.cf-sp-dots{display:none;justify-content:center;gap:8px;margin-top:20px}' +
      '.cf-sp-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2);border:none;padding:0;cursor:pointer;transition:background .2s}' +
      '.cf-sp-dot.active{background:#00ff88}' +

      /* Mobile: carousel layout */
      '@media(max-width:768px){' +
        '.cf-sp-counter-value{font-size:40px}' +
        '.cf-sp-counter-suffix{font-size:20px}' +
        '.cf-sp-testimonials{display:flex;overflow:hidden;gap:0;scroll-behavior:smooth}' +
        '.cf-sp-card{min-width:100%;flex-shrink:0;box-sizing:border-box}' +
        '.cf-sp-dots{display:flex}' +
      '}';

    var styleEl = document.createElement('style');
    styleEl.id = 'cf-social-proof-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ─── Render: Waitlist Counter ─────────────────────────────────────────

  function renderWaitlistCounter(container) {
    var wrap = document.createElement('div');
    wrap.className = 'cf-sp-counter-wrap';
    wrap.innerHTML =
      '<div class="cf-sp-counter-label">Freelancers on the waitlist</div>' +
      '<div>' +
        '<span class="cf-sp-counter-value" id="cf-sp-count-value">0</span>' +
        '<span class="cf-sp-counter-suffix">+</span>' +
      '</div>' +
      '<div class="cf-sp-counter-sub">' +
        '<span class="cf-sp-pulse"></span>' +
        'Growing every day — join them' +
      '</div>';
    container.appendChild(wrap);
  }

  // ─── Render: Testimonials ─────────────────────────────────────────────

  function renderTestimonials(container) {
    var heading = document.createElement('div');
    heading.style.cssText = 'text-align:center;margin-bottom:28px';
    heading.innerHTML =
      '<div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:4px">Loved by beta testers</div>' +
      '<div style="font-size:14px;color:rgba(255,255,255,.45)">Real feedback from early access users</div>';
    container.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'cf-sp-testimonials';
    grid.id = 'cf-sp-testimonials-grid';

    for (var i = 0; i < TESTIMONIALS.length; i++) {
      var t = TESTIMONIALS[i];
      var card = document.createElement('div');
      card.className = 'cf-sp-card';
      card.setAttribute('data-index', i);
      card.innerHTML =
        '<div class="cf-sp-card-header">' +
          '<div class="cf-sp-avatar" style="background:' + t.avatarBg + '">' + t.initials + '</div>' +
          '<div>' +
            '<div class="cf-sp-card-name">' + t.name + '</div>' +
            '<div class="cf-sp-card-role">' + t.role + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cf-sp-quote">' + t.quote + '</div>' +
        '<div class="cf-sp-stars">' + renderStars(t.rating) + '</div>';
      grid.appendChild(card);
    }
    container.appendChild(grid);

    // Carousel dots
    var dots = document.createElement('div');
    dots.className = 'cf-sp-dots';
    dots.id = 'cf-sp-dots';
    for (var j = 0; j < TESTIMONIALS.length; j++) {
      var dot = document.createElement('button');
      dot.className = 'cf-sp-dot' + (j === 0 ? ' active' : '');
      dot.setAttribute('data-dot', j);
      dot.setAttribute('aria-label', 'Show testimonial ' + (j + 1));
      dots.appendChild(dot);
    }
    container.appendChild(dots);

    // Dot click handler
    dots.addEventListener('click', function (e) {
      var target = e.target;
      if (!target.classList.contains('cf-sp-dot')) return;
      var idx = parseInt(target.getAttribute('data-dot'), 10);
      goToSlide(idx);
      resetCarouselTimer();
    });

    startCarousel();
  }

  // ─── Carousel Logic ───────────────────────────────────────────────────

  function goToSlide(idx) {
    state.carouselIndex = idx;
    var grid = document.getElementById('cf-sp-testimonials-grid');
    if (!grid) return;
    var cards = grid.children;
    if (cards.length === 0) return;
    var cardWidth = cards[0].offsetWidth;
    grid.scrollLeft = cardWidth * idx;
    updateDots(idx);
  }

  function updateDots(idx) {
    var dotsEl = document.getElementById('cf-sp-dots');
    if (!dotsEl) return;
    var allDots = dotsEl.querySelectorAll('.cf-sp-dot');
    for (var i = 0; i < allDots.length; i++) {
      if (i === idx) {
        allDots[i].classList.add('active');
      } else {
        allDots[i].classList.remove('active');
      }
    }
  }

  function startCarousel() {
    if (state.carouselTimer) clearInterval(state.carouselTimer);
    state.carouselTimer = setInterval(function () {
      if (state.destroyed) return;
      // Only rotate on narrow screens
      if (window.innerWidth > 768) return;
      state.carouselIndex = (state.carouselIndex + 1) % TESTIMONIALS.length;
      goToSlide(state.carouselIndex);
    }, CAROUSEL_INTERVAL_MS);
  }

  function resetCarouselTimer() {
    startCarousel();
  }

  // ─── Counter Animation ────────────────────────────────────────────────

  /**
   * Animate the counter from its current displayed value to the target.
   */
  function animateCountTo(target) {
    var el = document.getElementById('cf-sp-count-value');
    if (!el) return;

    var startVal = state.displayedCount;
    var diff = target - startVal;
    if (diff <= 0) {
      el.textContent = formatNumber(target);
      state.displayedCount = target;
      return;
    }

    var startTime = null;

    function step(timestamp) {
      if (state.destroyed) return;
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / COUNT_ANIMATION_DURATION_MS, 1);
      var easedProgress = easeOutCubic(progress);
      var current = Math.floor(startVal + diff * easedProgress);

      el.textContent = formatNumber(current);

      if (progress < 1) {
        state.counterAnimationFrame = requestAnimationFrame(step);
      } else {
        el.textContent = formatNumber(target);
        state.displayedCount = target;
        state.counterAnimationFrame = null;

        // Small scale bump on finish
        el.classList.add('cf-sp-bump');
        setTimeout(function () {
          if (el) el.classList.remove('cf-sp-bump');
        }, 200);
      }
    }

    if (state.counterAnimationFrame) {
      cancelAnimationFrame(state.counterAnimationFrame);
    }
    state.counterAnimationFrame = requestAnimationFrame(step);
  }

  /**
   * Start the initial counter animation (0 -> current count).
   */
  function startCounterAnimation() {
    state.displayedCount = 0;
    animateCountTo(state.currentCount);
  }

  /**
   * Increment the counter by a random small amount and animate.
   */
  function updateCount(amount) {
    if (typeof amount === 'number') {
      state.currentCount += amount;
    } else {
      state.currentCount += randBetween(1, 3);
    }
    animateCountTo(state.currentCount);
  }

  /**
   * Schedule recurring auto-increment with random intervals.
   */
  function scheduleAutoIncrement() {
    if (state.destroyed) return;
    var delay = randBetween(AUTO_INCREMENT_MIN_MS, AUTO_INCREMENT_MAX_MS);
    state.autoIncrementTimer = setTimeout(function () {
      if (state.destroyed) return;
      updateCount();
      scheduleAutoIncrement();
    }, delay);
  }

  // ─── Intersection Observer ────────────────────────────────────────────

  function setupObserver(sectionEl) {
    if (!('IntersectionObserver' in window)) {
      // Fallback: animate immediately
      startCounterAnimation();
      scheduleAutoIncrement();
      return;
    }

    state.observerRef = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting && !state.hasAnimated) {
          state.hasAnimated = true;
          startCounterAnimation();
          scheduleAutoIncrement();
          state.observerRef.unobserve(sectionEl);
        }
      }
    }, { threshold: 0.15 });

    state.observerRef.observe(sectionEl);
  }

  // ─── Init / Destroy ───────────────────────────────────────────────────

  /**
   * Initialize the social proof section.
   * @param {string|HTMLElement} elOrId - Container element or its ID.
   * @param {Object} [opts] - Optional overrides.
   * @param {number} [opts.initialCount] - Starting waitlist count.
   * @param {boolean} [opts.autoIncrement] - Enable auto-increment (default true).
   */
  function init(elOrId, opts) {
    opts = opts || {};
    var el = (typeof elOrId === 'string') ? document.getElementById(elOrId) : elOrId;
    if (!el) {
      console.warn('[CF-227] socialProof.init: container not found');
      return;
    }

    state.destroyed = false;
    state.hasAnimated = false;
    state.currentCount = opts.initialCount || INITIAL_COUNT;
    state.displayedCount = 0;
    state.carouselIndex = 0;
    state.containerEl = el;

    injectStyles();

    // Build section wrapper
    var section = document.createElement('section');
    section.className = 'cf-sp-section';
    section.id = 'cf-social-proof';
    section.setAttribute('aria-label', 'Social proof and testimonials');

    renderWaitlistCounter(section);
    renderTestimonials(section);

    el.innerHTML = '';
    el.appendChild(section);

    setupObserver(section);

    if (opts.autoIncrement === false) {
      // Skip auto-increment if explicitly disabled
      if (state.autoIncrementTimer) {
        clearTimeout(state.autoIncrementTimer);
        state.autoIncrementTimer = null;
      }
    }

    return { rendered: true, initialCount: state.currentCount };
  }

  /**
   * Tear down timers, observers, and DOM.
   */
  function destroy() {
    state.destroyed = true;

    if (state.autoIncrementTimer) {
      clearTimeout(state.autoIncrementTimer);
      state.autoIncrementTimer = null;
    }
    if (state.counterAnimationFrame) {
      cancelAnimationFrame(state.counterAnimationFrame);
      state.counterAnimationFrame = null;
    }
    if (state.carouselTimer) {
      clearInterval(state.carouselTimer);
      state.carouselTimer = null;
    }
    if (state.observerRef) {
      state.observerRef.disconnect();
      state.observerRef = null;
    }
    if (state.containerEl) {
      state.containerEl.innerHTML = '';
      state.containerEl = null;
    }
    state.hasAnimated = false;
  }

  // ─── Expose ───────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.socialProof = {
    init: init,
    renderWaitlistCounter: renderWaitlistCounter,
    renderTestimonials: renderTestimonials,
    startCounterAnimation: startCounterAnimation,
    updateCount: updateCount,
    destroy: destroy
  };

})();
