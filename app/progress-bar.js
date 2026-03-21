// ===== Page Loading Progress Bar — Cortex Freelancer =====
// Thin top progress bar like YouTube/GitHub
// Shows during page load and navigation

(function () {
  // Load CSS
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/app/progress-bar.css';
  document.head.appendChild(link);

  // Create bar element
  var bar = document.createElement('div');
  bar.className = 'progress-bar';
  document.documentElement.appendChild(bar);

  var progress = 0;
  var timer = null;

  function start() {
    progress = 0;
    bar.classList.remove('done');
    bar.style.width = '0%';
    bar.style.opacity = '1';

    // Simulate progress with diminishing increments
    timer = setInterval(function () {
      if (progress < 30) {
        progress += 3;
      } else if (progress < 60) {
        progress += 2;
      } else if (progress < 85) {
        progress += 0.5;
      } else if (progress < 95) {
        progress += 0.1;
      }
      bar.style.width = Math.min(progress, 95) + '%';
    }, 100);
  }

  function finish() {
    clearInterval(timer);
    progress = 100;
    bar.style.width = '100%';
    bar.classList.add('done');

    setTimeout(function () {
      bar.style.width = '0%';
      bar.style.opacity = '0';
      bar.classList.remove('done');
    }, 600);
  }

  // Start on initial page load
  start();

  // Finish when page fully loads
  window.addEventListener('load', function () {
    finish();
  });

  // Intercept link clicks for navigation progress
  document.addEventListener('click', function (e) {
    var anchor = e.target.closest ? e.target.closest('a') : null;
    if (!anchor) return;

    var href = anchor.getAttribute('href');
    if (!href) return;
    // Only internal navigation
    if (href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto')) return;
    if (anchor.target === '_blank') return;
    if (href.indexOf('://') !== -1 && href.indexOf(window.location.hostname) === -1) return;

    start();
  });

  // Handle popstate (back/forward)
  window.addEventListener('popstate', function () {
    start();
    setTimeout(finish, 500);
  });
})();
