// ===== Scroll to Top Button — Cortex Freelancer =====
// Appears after 500px scroll, smooth scrolls to top on click

(function () {
  function init() {
    // Load CSS
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/app/scroll-top.css';
    document.head.appendChild(link);

    // Create button
    var btn = document.createElement('button');
    btn.className = 'scroll-top-btn';
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.setAttribute('title', 'Back to top');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    document.body.appendChild(btn);

    // Show/hide on scroll
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          if (window.scrollY > 500) {
            btn.classList.add('visible');
          } else {
            btn.classList.remove('visible');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Scroll to top on click
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
