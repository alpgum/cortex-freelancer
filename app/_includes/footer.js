/* ===== SHARED FOOTER — auto-injected on all pages ===== */
(function () {
  'use strict';

  /* Load footer CSS */
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/app/_includes/footer.css';
  document.head.appendChild(link);

  /* Load theme CSS + JS (dark/light mode) */
  if (!document.getElementById('cortex-theme-css')) {
    var themeCss = document.createElement('link');
    themeCss.rel = 'stylesheet';
    themeCss.href = '/app/theme.css';
    themeCss.id = 'cortex-theme-css';
    document.head.appendChild(themeCss);
  }
  if (!document.getElementById('cortex-theme-js')) {
    var themeJs = document.createElement('script');
    themeJs.src = '/app/theme.js';
    themeJs.id = 'cortex-theme-js';
    document.head.appendChild(themeJs);
  }

  var year = new Date().getFullYear();

  var html = '' +
    '<footer class="site-footer">' +
      '<div class="footer-inner">' +
        /* Brand column */
        '<div class="footer-brand">' +
          '<a href="/app/" class="footer-logo">' +
            '<div class="footer-logo-icon">C</div>' +
            '<span class="footer-logo-text">CORTEX FREELANCER</span>' +
          '</a>' +
          '<p class="footer-tagline">AI-powered freelancer tools. Analyze your profile, find jobs, and stop losing money on fees.</p>' +
          '<div class="footer-socials">' +
            '<a href="https://twitter.com/" target="_blank" rel="noopener" aria-label="Twitter">𝕏</a>' +
            '<a href="https://linkedin.com/" target="_blank" rel="noopener" aria-label="LinkedIn">in</a>' +
          '</div>' +
        '</div>' +
        /* Product column */
        '<div class="footer-col">' +
          '<h4>Product</h4>' +
          '<ul>' +
            '<li><a href="/app/">Home</a></li>' +
            '<li><a href="/app/tools/">Tools</a></li>' +
            '<li><a href="/pricing.html">Pricing</a></li>' +
          '</ul>' +
        '</div>' +
        /* Legal column */
        '<div class="footer-col">' +
          '<h4>Legal</h4>' +
          '<ul>' +
            '<li><a href="/terms.html">Terms</a></li>' +
            '<li><a href="/privacy.html">Privacy</a></li>' +
          '</ul>' +
        '</div>' +
        /* Support column */
        '<div class="footer-col">' +
          '<h4>Support</h4>' +
          '<ul>' +
            '<li><a href="mailto:support@cortexfreelancer.com">Contact</a></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<span>&copy; ' + year + ' Cortex Freelancer. All rights reserved.</span>' +
        '<span class="built-with">Built with <span>\u26A1</span> by Cortex</span>' +
      '</div>' +
    '</footer>';

  /* Inject before </body> */
  document.body.insertAdjacentHTML('beforeend', html);
})();
