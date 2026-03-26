// ===== UNIVERSAL NAVIGATION — Cortex Freelancer =====
// nav-core.js — Drop-in navigation for every page
//
// Usage:
//   <link rel="stylesheet" href="/app/shared/css/navigation.css">
//   <script src="/app/shared/js/nav-core.js"></script>
//
// Config (optional, set before script loads):
//   window.CX_NAV = { breadcrumbs: false, search: false };

(function () {
  'use strict';

  // ── Tool Registry ──
  // Central registry of all Cortex tools with metadata for nav, search, palette
  var TOOLS = [
    // Core
    { id: 'dashboard',     name: 'Dashboard',          icon: '📊', href: '/app/',                      category: 'Core',       desc: 'Your freelance command center' },
    { id: 'tools',         name: 'All Tools',          icon: '🧰', href: '/app/tools/',                category: 'Core',       desc: 'Browse all Cortex tools' },
    { id: 'chat',          name: 'Live Chat',          icon: '💬', href: '/app/chat.html',             category: 'Core',       desc: 'AI-powered freelance assistant' },
    // Proposals & Clients
    { id: 'proposal',      name: 'Proposal Generator', icon: '📝', href: '/app/tools/proposal.html',   category: 'Proposals',  desc: 'Create winning proposals fast' },
    { id: 'sow',           name: 'SOW Generator',      icon: '📋', href: '/app/tools/sow-generator.html', category: 'Proposals', desc: 'Scope of work documents' },
    { id: 'scope',         name: 'Scope Analyzer',     icon: '🔍', href: '/app/tools/scope-analyzer.html', category: 'Proposals', desc: 'Analyze project scope & risk' },
    { id: 'contract',      name: 'Contract Review',    icon: '⚖️', href: '/app/tools/contract-review.html', category: 'Proposals', desc: 'AI contract review' },
    { id: 'templates',     name: 'Templates',          icon: '📄', href: '/app/tools/templates.html',  category: 'Proposals',  desc: 'Reusable document templates' },
    // Finance
    { id: 'invoice',       name: 'Invoice',            icon: '🧾', href: '/app/tools/invoice.html',    category: 'Finance',    desc: 'Professional invoices' },
    { id: 'rate-calc',     name: 'Rate Calculator',    icon: '💰', href: '/app/tools/rate-calculator.html', category: 'Finance', desc: 'Find your ideal rate' },
    { id: 'fee-calc',      name: 'Fee Calculator',     icon: '🏷️', href: '/app/tools/fee-calculator.html', category: 'Finance', desc: 'Platform fee breakdown' },
    { id: 'tax',           name: 'Tax Estimator',      icon: '📊', href: '/app/tools/tax-estimator.html', category: 'Finance',  desc: 'Freelance tax estimation' },
    { id: 'income',        name: 'Income Dashboard',   icon: '📈', href: '/app/tools/income-dashboard.html', category: 'Finance', desc: 'Track earnings & revenue' },
    { id: 'revenue',       name: 'Revenue Forecast',   icon: '🔮', href: '/app/tools/revenue-forecast.html', category: 'Finance', desc: 'Predict future income' },
    { id: 'payment',       name: 'Payment Checker',    icon: '✅', href: '/app/tools/payment-checker.html', category: 'Finance', desc: 'Track payment status' },
    // Time & Projects
    { id: 'time-tracker',  name: 'Time Tracker',       icon: '⏱️', href: '/app/tools/time-tracker.html', category: 'Projects', desc: 'Track billable hours' },
    { id: 'time-reports',  name: 'Time Reports',       icon: '📊', href: '/app/tools/time-reports.html', category: 'Projects', desc: 'Reports & export timesheets' },
    { id: 'project-track', name: 'Project Tracker',    icon: '📌', href: '/app/tools/project-tracker.html', category: 'Projects', desc: 'Manage active projects' },
    { id: 'project-time',  name: 'Project Timeline',   icon: '📅', href: '/app/tools/project-timeline.html', category: 'Projects', desc: 'Visual project timeline' },
    { id: 'project-brief', name: 'Project Brief',      icon: '📑', href: '/app/tools/project-brief.html', category: 'Projects', desc: 'Generate project briefs' },
    { id: 'weekly',        name: 'Weekly Summary',     icon: '📰', href: '/app/tools/weekly-summary.html', category: 'Projects', desc: 'Weekly progress report' },
    { id: 'availability',  name: 'Availability',       icon: '🗓️', href: '/app/tools/availability.html', category: 'Projects', desc: 'Set your availability' },
    { id: 'timezone',      name: 'Timezone Overlap',   icon: '🌐', href: '/app/tools/timezone-overlap.html', category: 'Projects', desc: 'Find meeting times' },
    { id: 'meeting',       name: 'Meeting Notes',      icon: '✍️', href: '/app/tools/meeting-notes.html', category: 'Projects', desc: 'AI meeting summaries' },
    // Clients
    { id: 'client-crm',    name: 'Client CRM',         icon: '👥', href: '/app/tools/client-crm.html', category: 'Clients',    desc: 'Client relationship manager' },
    { id: 'client-comm',   name: 'Comm Analyzer',      icon: '📧', href: '/app/tools/client-comm-analyzer.html', category: 'Clients', desc: 'Analyze client communication' },
    { id: 'red-flags',     name: 'Red Flag Detector',  icon: '🚩', href: '/app/tools/client-red-flags.html', category: 'Clients', desc: 'Spot problematic clients' },
    { id: 'repeat-client', name: 'Repeat Client',      icon: '🔄', href: '/app/tools/repeat-client.html', category: 'Clients', desc: 'Win repeat business' },
    { id: 'email-writer',  name: 'Email Writer',       icon: '✉️', href: '/app/tools/email-writer.html', category: 'Clients',  desc: 'Professional email drafts' },
    { id: 'negotiation',   name: 'Negotiation Coach',  icon: '🤝', href: '/app/tools/negotiation-coach.html', category: 'Clients', desc: 'Negotiation strategies' },
    // Profile & Jobs
    { id: 'profile-seo',   name: 'Profile SEO',        icon: '🔎', href: '/app/tools/profile-seo.html', category: 'Growth',    desc: 'Optimize your profile' },
    { id: 'bio',           name: 'Bio Generator',      icon: '🪪', href: '/app/tools/bio-generator.html', category: 'Growth',  desc: 'Craft your professional bio' },
    { id: 'portfolio',     name: 'Portfolio Review',    icon: '🎨', href: '/app/tools/portfolio-review.html', category: 'Growth', desc: 'Portfolio feedback' },
    { id: 'ranking',       name: 'Ranking Simulator',  icon: '🏆', href: '/app/tools/ranking-simulator.html', category: 'Growth', desc: 'Simulate search ranking' },
    { id: 'job-scanner',   name: 'Job Scanner',        icon: '🔭', href: '/app/tools/job-scanner.html', category: 'Growth',    desc: 'Find matching jobs' },
    { id: 'job-digest',    name: 'Job Digest',         icon: '📬', href: '/app/tools/job-digest.html',  category: 'Growth',    desc: 'Curated job alerts' },
  ];

  // ── Config ──
  var config = window.CX_NAV || {};
  var showBreadcrumbs = config.breadcrumbs !== false;
  var showSearch = config.search !== false;
  var showSideRail = config.sideRail === true;

  // ── Helpers ──
  var path = window.location.pathname;

  function isActive(href) {
    if (href === '/app/' || href === '/app') {
      return (path === '/app/' || path === '/app' || path === '/app/index.html') && !path.includes('/tools');
    }
    if (href === '/app/tools/') {
      return path === '/app/tools/' || path === '/app/tools/index.html';
    }
    return path === href || path === href.replace('.html', '');
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') e.className = attrs[k];
        else if (k === 'textContent') e.textContent = attrs[k];
        else if (k === 'innerHTML') e.innerHTML = attrs[k];
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c) e.appendChild(c);
      });
    }
    return e;
  }

  // ── Build Top Nav ──
  function buildNav() {
    // Skip link
    document.body.insertBefore(
      el('a', { className: 'cx-skip-link', href: '#main-content', textContent: 'Skip to content' }),
      document.body.firstChild
    );

    var nav = el('nav', { className: 'cx-nav', role: 'navigation', 'aria-label': 'Main navigation' });

    // Logo
    nav.appendChild(
      el('a', { className: 'cx-nav-logo', href: '/app/' }, [
        el('span', { className: 'cx-nav-logo-icon', textContent: 'C' }),
        el('span', { className: 'cx-nav-logo-text', textContent: 'Cortex' })
      ])
    );

    // Primary links
    var primaryLinks = [
      { name: 'Home',     icon: '🏠', href: '/app/' },
      { name: 'Tools',    icon: '🧰', href: '/app/tools/' },
      { name: 'Chat',     icon: '💬', href: '/app/chat.html' },
      { name: 'Pricing',  icon: '💎', href: '/pricing' },
    ];

    var linksWrap = el('div', { className: 'cx-nav-links', role: 'menubar' });
    primaryLinks.forEach(function (link) {
      var a = el('a', {
        href: link.href,
        role: 'menuitem',
      }, [
        el('span', { className: 'nav-icon', textContent: link.icon }),
        document.createTextNode(link.name)
      ]);
      if (isActive(link.href)) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
      linksWrap.appendChild(a);
    });
    nav.appendChild(linksWrap);

    // Spacer
    nav.appendChild(el('div', { className: 'cx-nav-spacer' }));

    // Search button
    if (showSearch) {
      var isMac = navigator.platform && navigator.platform.indexOf('Mac') > -1;
      var searchBtn = el('button', {
        className: 'cx-nav-search-btn',
        'aria-label': 'Search tools',
        onClick: function () { openPalette(); }
      }, [
        el('span', { className: 'search-icon', textContent: '🔍' }),
        el('span', { className: 'search-label', textContent: 'Search tools…' }),
        el('kbd', { textContent: isMac ? '⌘K' : 'Ctrl+K' })
      ]);
      nav.appendChild(searchBtn);
    }

    // Auth area
    var authArea = el('div', { className: 'cx-nav-auth', id: 'cx-nav-auth' });
    authArea.appendChild(el('button', {
      className: 'nav-signin',
      id: 'cx-signin-btn',
      textContent: 'Sign In'
    }));
    nav.appendChild(authArea);

    // Hamburger
    var hamburger = el('button', {
      className: 'cx-nav-hamburger',
      'aria-label': 'Toggle menu',
      'aria-expanded': 'false'
    }, [
      el('span'), el('span'), el('span')
    ]);
    nav.appendChild(hamburger);

    // Insert nav
    document.body.insertBefore(nav, document.body.firstChild.nextSibling);

    // ── Mobile Drawer ──
    var drawerOverlay = el('div', { className: 'cx-nav-drawer-overlay' });
    var drawer = el('div', { className: 'cx-nav-drawer', role: 'menu' });

    // Group tools by category for drawer
    var categories = {};
    TOOLS.forEach(function (tool) {
      if (!categories[tool.category]) categories[tool.category] = [];
      categories[tool.category].push(tool);
    });

    Object.keys(categories).forEach(function (cat) {
      var section = el('div', { className: 'drawer-section' });
      section.appendChild(el('div', { className: 'drawer-section-title', textContent: cat }));
      categories[cat].forEach(function (tool) {
        var a = el('a', { href: tool.href, role: 'menuitem' }, [
          el('span', { className: 'nav-icon', textContent: tool.icon }),
          document.createTextNode(tool.name)
        ]);
        if (isActive(tool.href)) a.classList.add('active');
        section.appendChild(a);
      });
      drawer.appendChild(section);
    });

    document.body.appendChild(drawerOverlay);
    document.body.appendChild(drawer);

    // Hamburger toggle
    function toggleDrawer(open) {
      var isOpen = open !== undefined ? open : !drawer.classList.contains('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      drawer.classList.toggle('open', isOpen);
      drawerOverlay.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    hamburger.addEventListener('click', function () { toggleDrawer(); });
    drawerOverlay.addEventListener('click', function () { toggleDrawer(false); });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) toggleDrawer(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        toggleDrawer(false);
        hamburger.focus();
      }
    });

    // ── Scroll behavior ──
    var lastScrollY = 0;
    var ticking = false;

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var y = window.scrollY;
          nav.classList.toggle('nav-scrolled', y > 10);
          if (!drawer.classList.contains('open')) {
            nav.classList.toggle('nav-hidden', y > lastScrollY && y > 80);
          }
          lastScrollY = y;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // ── Auth UI ──
    setupAuth();

    // Body class
    document.body.classList.add('cx-nav-active');
  }

  // ── Breadcrumbs ──
  function buildBreadcrumbs() {
    if (!showBreadcrumbs) {
      document.body.classList.add('no-breadcrumbs');
      return;
    }

    // Determine crumb trail from current path
    var crumbs = [{ name: 'Home', href: '/app/' }];

    if (path.includes('/tools/') || path.includes('/tools')) {
      crumbs.push({ name: 'Tools', href: '/app/tools/' });

      // Find current tool
      var currentTool = TOOLS.find(function (t) { return isActive(t.href); });
      if (currentTool && currentTool.id !== 'tools' && currentTool.id !== 'dashboard') {
        crumbs.push({ name: currentTool.name, href: null }); // current = no link
      }
    } else if (path.includes('/chat')) {
      crumbs.push({ name: 'Live Chat', href: null });
    }

    // Don't show breadcrumbs if only Home
    if (crumbs.length <= 1) {
      document.body.classList.add('no-breadcrumbs');
      return;
    }

    var bc = el('div', { className: 'cx-breadcrumbs', 'aria-label': 'Breadcrumb', role: 'navigation' });

    crumbs.forEach(function (crumb, i) {
      if (i > 0) {
        bc.appendChild(el('span', { className: 'bc-sep', textContent: '›' }));
      }
      if (crumb.href && i < crumbs.length - 1) {
        bc.appendChild(el('a', { href: crumb.href, textContent: crumb.name }));
      } else {
        bc.appendChild(el('span', { className: 'bc-current', textContent: crumb.name }));
      }
    });

    // Insert after nav
    var navEl = document.querySelector('.cx-nav');
    if (navEl && navEl.nextSibling) {
      navEl.parentNode.insertBefore(bc, navEl.nextSibling);
    } else {
      document.body.appendChild(bc);
    }
  }

  // ── Command Palette ──
  var paletteOverlay = null;
  var paletteInput = null;
  var paletteResults = null;
  var highlightedIndex = -1;

  function buildPalette() {
    if (!showSearch) return;

    paletteOverlay = el('div', { className: 'cx-palette-overlay' });

    var palette = el('div', { className: 'cx-palette' });

    // Input
    var inputWrap = el('div', { className: 'cx-palette-input-wrap' });
    inputWrap.appendChild(el('span', { className: 'search-icon', textContent: '🔍' }));
    paletteInput = el('input', {
      className: 'cx-palette-input',
      type: 'text',
      placeholder: 'Search tools, pages, actions…',
      'aria-label': 'Search',
      autocomplete: 'off',
      spellcheck: 'false'
    });
    inputWrap.appendChild(paletteInput);
    palette.appendChild(inputWrap);

    // Results
    paletteResults = el('div', { className: 'cx-palette-results', role: 'listbox' });
    palette.appendChild(paletteResults);

    // Footer
    palette.appendChild(el('div', { className: 'cx-palette-footer', innerHTML:
      '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>' +
      '<span><kbd>↵</kbd> open</span>' +
      '<span><kbd>esc</kbd> close</span>'
    }));

    paletteOverlay.appendChild(palette);
    document.body.appendChild(paletteOverlay);

    // Events
    paletteInput.addEventListener('input', function () {
      renderPaletteResults(paletteInput.value.trim());
    });

    paletteInput.addEventListener('keydown', function (e) {
      var items = paletteResults.querySelectorAll('.cx-palette-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        updateHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        updateHighlight(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[highlightedIndex]) {
          var href = items[highlightedIndex].getAttribute('data-href');
          if (href) window.location.href = href;
        }
      }
    });

    paletteOverlay.addEventListener('click', function (e) {
      if (e.target === paletteOverlay) closePalette();
    });

    // Keyboard shortcut: Cmd+K / Ctrl+K
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (paletteOverlay.classList.contains('open')) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (e.key === 'Escape' && paletteOverlay.classList.contains('open')) {
        closePalette();
      }
    });

    // Show all tools initially
    renderPaletteResults('');
  }

  function renderPaletteResults(query) {
    paletteResults.innerHTML = '';
    highlightedIndex = 0;

    var filtered = TOOLS;
    if (query) {
      var q = query.toLowerCase();
      filtered = TOOLS.filter(function (t) {
        return t.name.toLowerCase().indexOf(q) > -1 ||
               t.desc.toLowerCase().indexOf(q) > -1 ||
               t.category.toLowerCase().indexOf(q) > -1 ||
               t.id.toLowerCase().indexOf(q) > -1;
      });
    }

    if (filtered.length === 0) {
      paletteResults.appendChild(el('div', { className: 'cx-palette-empty', textContent: 'No tools found for "' + query + '"' }));
      return;
    }

    // Group by category
    var cats = {};
    filtered.forEach(function (t) {
      if (!cats[t.category]) cats[t.category] = [];
      cats[t.category].push(t);
    });

    var idx = 0;
    Object.keys(cats).forEach(function (cat) {
      cats[cat].forEach(function (tool) {
        var item = el('div', {
          className: 'cx-palette-item' + (idx === 0 ? ' highlighted' : ''),
          'data-href': tool.href,
          role: 'option',
          onClick: function () { window.location.href = tool.href; }
        }, [
          el('span', { className: 'pi-icon', textContent: tool.icon }),
          el('div', { className: 'pi-info' }, [
            el('div', { className: 'pi-name', textContent: tool.name }),
            el('div', { className: 'pi-desc', textContent: tool.desc })
          ])
        ]);
        paletteResults.appendChild(item);
        idx++;
      });
    });
  }

  function updateHighlight(items) {
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('highlighted', i === highlightedIndex);
    }
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function openPalette() {
    if (!paletteOverlay) return;
    paletteOverlay.classList.add('open');
    paletteInput.value = '';
    renderPaletteResults('');
    setTimeout(function () { paletteInput.focus(); }, 50);
  }

  function closePalette() {
    if (!paletteOverlay) return;
    paletteOverlay.classList.remove('open');
    highlightedIndex = -1;
  }

  // ── Firebase Auth ──
  function setupAuth() {
    function updateAuthUI() {
      var authContainer = document.getElementById('cx-nav-auth');
      if (!authContainer) return;

      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (user) {
          authContainer.innerHTML = '';
          if (user) {
            // Avatar
            var avatarEl;
            if (user.photoURL) {
              avatarEl = el('img', {
                className: 'cx-nav-avatar',
                src: user.photoURL,
                alt: user.displayName || 'User',
                title: user.displayName || user.email || 'User',
                loading: 'lazy',
                width: '32',
                height: '32',
                onClick: function () { window.location.href = '/app/'; }
              });
            } else {
              var initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
              avatarEl = el('div', {
                className: 'cx-nav-avatar-placeholder',
                title: user.displayName || user.email || 'User',
                textContent: initials,
                onClick: function () { window.location.href = '/app/'; }
              });
            }
            authContainer.appendChild(avatarEl);

            // Pro badge
            if (localStorage.getItem('cortex_pro') === 'true') {
              authContainer.appendChild(el('span', { className: 'cx-nav-pro-badge', innerHTML: '&#9733; PRO' }));
            }
          } else {
            var btn = el('button', {
              className: 'nav-signin',
              textContent: 'Sign In',
              onClick: function () {
                if (typeof showAuthModal === 'function') showAuthModal();
                else if (typeof cortexSignIn === 'function') cortexSignIn();
                else window.location.href = '/app/login.html';
              }
            });
            authContainer.appendChild(btn);
          }
        });
      } else {
        // Firebase not ready — wire sign-in button
        var btn = document.getElementById('cx-signin-btn');
        if (btn) {
          btn.addEventListener('click', function () {
            window.location.href = '/app/login.html';
          });
        }
      }
    }

    setTimeout(updateAuthUI, 500);
    setTimeout(updateAuthUI, 2000);
  }

  // ── Public API ──
  window.CortexNav = {
    tools: TOOLS,
    openPalette: openPalette,
    closePalette: closePalette,

    // Register additional tools at runtime
    registerTool: function (tool) {
      TOOLS.push(tool);
    },

    // Programmatic breadcrumbs override
    setBreadcrumbs: function (crumbs) {
      var existing = document.querySelector('.cx-breadcrumbs');
      if (existing) existing.remove();

      if (!crumbs || crumbs.length === 0) return;

      var bc = el('div', { className: 'cx-breadcrumbs', 'aria-label': 'Breadcrumb', role: 'navigation' });
      crumbs.forEach(function (crumb, i) {
        if (i > 0) bc.appendChild(el('span', { className: 'bc-sep', textContent: '›' }));
        if (crumb.href && i < crumbs.length - 1) {
          bc.appendChild(el('a', { href: crumb.href, textContent: crumb.name }));
        } else {
          bc.appendChild(el('span', { className: 'bc-current', textContent: crumb.name }));
        }
      });

      var navEl = document.querySelector('.cx-nav');
      if (navEl && navEl.nextSibling) {
        navEl.parentNode.insertBefore(bc, navEl.nextSibling);
      }
    },

    // Get current active tool
    getActiveTool: function () {
      return TOOLS.find(function (t) { return isActive(t.href); }) || null;
    },

    // Navigate to a tool by ID
    goTo: function (toolId) {
      var tool = TOOLS.find(function (t) { return t.id === toolId; });
      if (tool) window.location.href = tool.href;
    }
  };

  // ── Init ──
  function init() {
    buildNav();
    buildBreadcrumbs();
    buildPalette();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
