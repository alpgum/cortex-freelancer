// ===== Breadcrumb Navigation — Cortex Freelancer =====
// Auto-generates breadcrumbs on tool pages: Home > Tools > [Tool Name]
// Reads tool name from body[data-tool-name] or <title>

(function () {
  function buildBreadcrumbs() {
    var path = window.location.pathname;

    // Only show on tool pages
    if (path.indexOf('/app/tools/') === -1) return;
    // Skip tools index page
    if (path === '/app/tools/' || path === '/app/tools/index.html') return;

    // Get tool name from data attribute or title
    var toolName = document.body.getAttribute('data-tool-name');
    if (!toolName) {
      var titleEl = document.querySelector('title');
      if (titleEl) {
        toolName = titleEl.textContent.split('|')[0].split('—')[0].trim();
      }
    }
    if (!toolName) return;

    // Load CSS
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/app/breadcrumbs.css';
    document.head.appendChild(link);

    // Build breadcrumb markup
    var nav = document.createElement('nav');
    nav.className = 'breadcrumbs';
    nav.setAttribute('aria-label', 'Breadcrumb');

    var ol = document.createElement('ol');
    ol.setAttribute('itemscope', '');
    ol.setAttribute('itemtype', 'https://schema.org/BreadcrumbList');

    var crumbs = [
      { name: 'Home', href: '/app/' },
      { name: 'Tools', href: '/app/tools/' },
      { name: toolName, href: null }
    ];

    for (var i = 0; i < crumbs.length; i++) {
      var li = document.createElement('li');
      li.setAttribute('itemprop', 'itemListElement');
      li.setAttribute('itemscope', '');
      li.setAttribute('itemtype', 'https://schema.org/ListItem');

      if (crumbs[i].href) {
        var a = document.createElement('a');
        a.href = crumbs[i].href;
        a.textContent = crumbs[i].name;
        a.setAttribute('itemprop', 'item');
        var span = document.createElement('span');
        span.setAttribute('itemprop', 'name');
        span.textContent = crumbs[i].name;
        a.textContent = '';
        a.appendChild(span);
        li.appendChild(a);
      } else {
        var span = document.createElement('span');
        span.className = 'breadcrumb-current';
        span.setAttribute('itemprop', 'name');
        span.textContent = crumbs[i].name;
        li.appendChild(span);
      }

      var meta = document.createElement('meta');
      meta.setAttribute('itemprop', 'position');
      meta.setAttribute('content', String(i + 1));
      li.appendChild(meta);

      ol.appendChild(li);
    }

    nav.appendChild(ol);

    // Insert after nav element
    var siteNav = document.querySelector('nav:not(.breadcrumbs)');
    if (siteNav && siteNav.nextSibling) {
      siteNav.parentNode.insertBefore(nav, siteNav.nextSibling);
    } else {
      // Fallback: insert before first section/main
      var hero = document.querySelector('.hero, section, main');
      if (hero) {
        hero.parentNode.insertBefore(nav, hero);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBreadcrumbs);
  } else {
    buildBreadcrumbs();
  }
})();
