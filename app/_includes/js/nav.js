// ===== GLOBAL NAVIGATION + TOOL LAUNCHER — Cortex Freelancer [cf3-038] =====
// Unified nav bar with logo, categories, active tool highlight, Cmd+K search,
// notification bell, user avatar. Tool launcher grid with recent usage order.
// Usage: <script src="/app/_includes/js/nav.js"></script>

(function () {
  'use strict';

  // ── Tool Registry ──
  var TOOLS = [
    // Business & Finance
    { id: 'time-tracker',        name: 'Time Tracker',         icon: '\u23F1',  cat: 'business',   desc: 'Track hours, daily & weekly totals',       href: '/app/tools/time-tracker.html' },
    { id: 'invoice',             name: 'Invoice Generator',    icon: '\uD83D\uDCCB', cat: 'business',   desc: 'Create professional invoices',             href: '/app/tools/invoice.html' },
    { id: 'income-dashboard',    name: 'Income Dashboard',     icon: '\uD83D\uDCCA', cat: 'business',   desc: 'Revenue tracking & breakdown',             href: '/app/tools/income-dashboard.html' },
    { id: 'rate-calculator',     name: 'Rate Calculator',      icon: '\uD83D\uDCB0', cat: 'business',   desc: 'Hourly & project pricing',                 href: '/app/tools/rate-calculator.html' },
    { id: 'fee-calculator',      name: 'Fee Calculator',       icon: '\uD83D\uDCB3', cat: 'business',   desc: 'Compare platform & transfer fees',         href: '/app/tools/fee-calculator.html' },
    { id: 'tax-estimator',       name: 'Tax Estimator',        icon: '\uD83C\uDFE6', cat: 'business',   desc: 'Quarterly & annual tax planning',          href: '/app/tools/tax-estimator.html' },
    { id: 'payment-checker',     name: 'Payment Checker',      icon: '\u2705',  cat: 'business',   desc: 'Track payment status',                     href: '/app/tools/payment-checker.html' },
    { id: 'revenue-forecast',    name: 'Revenue Forecast',     icon: '\uD83D\uDCC8', cat: 'business',   desc: 'Forecast future income',                   href: '/app/tools/revenue-forecast.html' },

    // Project Management
    { id: 'project-tracker',     name: 'Project Tracker',      icon: '\uD83D\uDCCB', cat: 'projects',   desc: 'Kanban board for all projects',            href: '/app/tools/project-tracker.html' },
    { id: 'project-timeline',    name: 'Project Timeline',     icon: '\uD83D\uDCC5', cat: 'projects',   desc: 'Gantt charts & milestones',                href: '/app/tools/project-timeline.html' },
    { id: 'project-brief',       name: 'Project Brief',        icon: '\uD83D\uDCD1', cat: 'projects',   desc: 'Generate project briefs',                  href: '/app/tools/project-brief.html' },
    { id: 'scope-analyzer',      name: 'Scope Analyzer',       icon: '\uD83D\uDD0D', cat: 'projects',   desc: 'Validate project scope',                   href: '/app/tools/scope-analyzer.html' },
    { id: 'sow-generator',       name: 'SOW Generator',        icon: '\uD83D\uDCC4', cat: 'projects',   desc: 'Statement of Work templates',              href: '/app/tools/sow-generator.html' },
    { id: 'meeting-notes',       name: 'Meeting Notes',        icon: '\uD83C\uDFA4', cat: 'projects',   desc: 'Transcribe & summarize meetings',          href: '/app/tools/meeting-notes.html' },
    { id: 'availability',        name: 'Availability',         icon: '\uD83D\uDCC6', cat: 'projects',   desc: 'Schedule availability windows',            href: '/app/tools/availability.html' },
    { id: 'timezone-overlap',    name: 'Timezone Overlap',     icon: '\uD83C\uDF0D', cat: 'projects',   desc: 'Find overlapping work hours',              href: '/app/tools/timezone-overlap.html' },

    // Client Management
    { id: 'client-crm',          name: 'Client CRM',           icon: '\uD83D\uDC65', cat: 'clients',    desc: 'Contact & interaction history',            href: '/app/tools/client-crm.html' },
    { id: 'client-directory',    name: 'Client Directory',     icon: '\uD83D\uDCD6', cat: 'clients',    desc: 'Full client directory',                    href: '/app/tools/client-directory.html' },
    { id: 'client-red-flags',    name: 'Client Red Flags',     icon: '\u26A0\uFE0F',  cat: 'clients',    desc: 'Identify risky clients',                   href: '/app/tools/client-red-flags.html' },
    { id: 'client-comm-analyzer',name: 'Comm Analyzer',        icon: '\uD83D\uDCAC', cat: 'clients',    desc: 'Analyze client messages',                  href: '/app/tools/client-comm-analyzer.html' },
    { id: 'repeat-client',       name: 'Repeat Client',        icon: '\uD83D\uDD01', cat: 'clients',    desc: 'Identify repeat opportunities',            href: '/app/tools/repeat-client.html' },
    { id: 'negotiation-coach',   name: 'Negotiation Coach',    icon: '\uD83E\uDD1D', cat: 'clients',    desc: 'Pricing negotiation tips',                 href: '/app/tools/negotiation-coach.html' },

    // AI Writing
    { id: 'proposal',            name: 'Proposal Writer',      icon: '\u270D\uFE0F',  cat: 'writing',    desc: 'AI-powered proposals',                     href: '/app/tools/proposal.html' },
    { id: 'email-writer',        name: 'Email Writer',         icon: '\u2709\uFE0F',  cat: 'writing',    desc: 'AI email templates',                       href: '/app/tools/email-writer.html' },
    { id: 'contract-review',     name: 'Contract Review',      icon: '\uD83D\uDCDC', cat: 'writing',    desc: 'Review contracts for red flags',            href: '/app/tools/contract-review.html' },
    { id: 'bio-generator',       name: 'Bio Generator',        icon: '\uD83D\uDCDD', cat: 'writing',    desc: 'AI profile bio writer',                    href: '/app/tools/bio-generator.html' },
    { id: 'weekly-summary',      name: 'Weekly Summary',       icon: '\uD83D\uDCCA', cat: 'writing',    desc: 'Auto-generate weekly reports',              href: '/app/tools/weekly-summary.html' },
    { id: 'templates',           name: 'Templates',            icon: '\uD83D\uDCC2', cat: 'writing',    desc: 'Large template library',                   href: '/app/tools/templates.html' },

    // Upwork & Profile
    { id: 'job-scanner',         name: 'Job Scanner',          icon: '\uD83D\uDD0E', cat: 'upwork',     desc: 'Match scores for opportunities',           href: '/app/tools/job-scanner.html' },
    { id: 'job-digest',          name: 'Job Digest',           icon: '\uD83D\uDCE8', cat: 'upwork',     desc: 'Summarize Upwork jobs',                    href: '/app/tools/job-digest.html' },
    { id: 'profile-seo',         name: 'Profile SEO',          icon: '\uD83D\uDD0D', cat: 'upwork',     desc: 'Optimize profile for search',              href: '/app/tools/profile-seo.html' },
    { id: 'portfolio-review',    name: 'Portfolio Review',     icon: '\uD83C\uDFA8', cat: 'upwork',     desc: 'Get portfolio feedback',                   href: '/app/tools/portfolio-review.html' },
    { id: 'ranking-simulator',   name: 'Ranking Simulator',    icon: '\uD83C\uDFC6', cat: 'upwork',     desc: 'Upwork ranking predictor',                 href: '/app/tools/ranking-simulator.html' }
  ];

  var CATEGORIES = [
    { id: 'all',       name: 'All Tools',       icon: '\u2B50' },
    { id: 'recent',    name: 'Recent',          icon: '\uD83D\uDD52' },
    { id: 'business',  name: 'Business & Finance', icon: '\uD83D\uDCB0' },
    { id: 'projects',  name: 'Project Mgmt',    icon: '\uD83D\uDCCB' },
    { id: 'clients',   name: 'Client Mgmt',     icon: '\uD83D\uDC65' },
    { id: 'writing',   name: 'AI Writing',      icon: '\u270D\uFE0F' },
    { id: 'upwork',    name: 'Upwork & Profile', icon: '\uD83D\uDD0E' }
  ];

  var STORAGE_KEY = 'cortex_nav_recent';

  // ── Recent usage tracking ──
  function getRecent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) { return []; }
  }

  function trackUsage(toolId) {
    var recent = getRecent().filter(function (id) { return id !== toolId; });
    recent.unshift(toolId);
    if (recent.length > 20) recent = recent.slice(0, 20);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent)); } catch (e) {}
  }

  function getToolsSorted(catId, query) {
    var list = TOOLS;
    var recent = getRecent();

    if (query) {
      var q = query.toLowerCase();
      list = list.filter(function (t) {
        return t.name.toLowerCase().indexOf(q) !== -1 ||
               t.desc.toLowerCase().indexOf(q) !== -1 ||
               t.id.toLowerCase().indexOf(q) !== -1;
      });
    }

    if (catId === 'recent') {
      var recentTools = [];
      for (var i = 0; i < recent.length; i++) {
        for (var j = 0; j < list.length; j++) {
          if (list[j].id === recent[i]) { recentTools.push(list[j]); break; }
        }
      }
      return recentTools;
    }

    if (catId && catId !== 'all') {
      list = list.filter(function (t) { return t.cat === catId; });
    }

    // Sort: recently used first, then alphabetical
    list = list.slice().sort(function (a, b) {
      var ai = recent.indexOf(a.id);
      var bi = recent.indexOf(b.id);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }

  // ── Detect active page ──
  var currentPath = window.location.pathname;

  function isActiveTool(href) {
    return currentPath === href || currentPath.replace(/\/index\.html$/, '/') === href;
  }

  function isActiveSection(href) {
    if (href === '/app/' || href === '/app') {
      return currentPath === '/app/' || currentPath === '/app' || currentPath === '/app/index.html';
    }
    return currentPath.indexOf(href) === 0;
  }

  var isMac = navigator.platform.indexOf('Mac') !== -1;
  var modKey = isMac ? '\u2318' : 'Ctrl';

  // ── Build Navigation ──
  function buildNav() {
    // Remove old nav if exists
    var oldNav = document.querySelector('.site-nav');
    if (oldNav) oldNav.remove();
    var oldOverlay = document.querySelector('.nav-overlay');
    if (oldOverlay) oldOverlay.remove();

    // Create nav element
    var nav = document.createElement('nav');
    nav.className = 'gnav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    // Determine what tool is active
    var activeTool = null;
    for (var i = 0; i < TOOLS.length; i++) {
      if (isActiveTool(TOOLS[i].href)) { activeTool = TOOLS[i]; break; }
    }

    // Track usage on tool pages
    if (activeTool) trackUsage(activeTool.id);

    nav.innerHTML =
      // Logo
      '<a href="/app/" class="gnav-logo" aria-label="Cortex Home">' +
        '<span class="gnav-logo-icon">C</span>' +
        '<span class="gnav-logo-text">Cortex</span>' +
      '</a>' +

      // Categories dropdown
      '<div class="gnav-categories">' +
        '<button class="gnav-categories-btn" aria-expanded="false" aria-haspopup="true">' +
          '<span>Tools</span>' +
          '<span class="arrow">\u25BC</span>' +
        '</button>' +
        '<div class="gnav-categories-dropdown" role="menu"></div>' +
      '</div>' +

      // Desktop nav links
      '<div class="gnav-links">' +
        '<a href="/app/"' + (isActiveSection('/app/') && !currentPath.includes('/tools') && !currentPath.includes('/chat') ? ' class="active"' : '') + '>Home</a>' +
        '<a href="/app/chat.html"' + (isActiveSection('/app/chat') ? ' class="active"' : '') + '>Chat</a>' +
        (activeTool
          ? '<a href="' + activeTool.href + '" class="active">' + activeTool.icon + ' ' + activeTool.name + '</a>'
          : (isActiveSection('/app/tools') ? '<a href="/app/tools/" class="active">Tools</a>' : '')
        ) +
      '</div>' +

      // Spacer
      '<div class="gnav-spacer"></div>' +

      // Search button
      '<button class="gnav-search-btn" aria-label="Search tools">' +
        '<span class="s-icon">\uD83D\uDD0D</span>' +
        '<span class="s-label">Search tools\u2026</span>' +
        '<kbd>' + modKey + '+K</kbd>' +
      '</button>' +

      // Notification bell
      '<button class="gnav-notif-btn" aria-label="Notifications">' +
        '\uD83D\uDD14' +
        '<span class="gnav-notif-badge" id="gnav-notif-badge"></span>' +
      '</button>' +

      // Auth area
      '<div class="gnav-auth" id="gnav-auth">' +
        '<button class="gnav-signin-btn" id="gnav-signin-btn">Sign In</button>' +
      '</div>' +

      // Hamburger
      '<button class="gnav-hamburger" id="gnav-hamburger" aria-label="Toggle menu" aria-expanded="false">' +
        '<span></span><span></span><span></span>' +
      '</button>';

    // Mobile drawer
    var drawerOverlay = document.createElement('div');
    drawerOverlay.className = 'gnav-drawer-overlay';

    var drawer = document.createElement('div');
    drawer.className = 'gnav-drawer';

    // Build drawer content
    var drawerHTML =
      '<div class="gnav-drawer-section">' +
        '<div class="gnav-drawer-search"><span>\uD83D\uDD0D</span><input type="text" placeholder="Search tools\u2026" id="gnav-drawer-search-input"></div>' +
      '</div>' +
      '<div class="gnav-drawer-section">' +
        '<div class="gnav-drawer-title">Navigation</div>' +
        '<a href="/app/"' + (isActiveSection('/app/') && !currentPath.includes('/tools') && !currentPath.includes('/chat') ? ' class="active"' : '') + '><span class="di">\uD83C\uDFE0</span>Home</a>' +
        '<a href="/app/tools/"' + (isActiveSection('/app/tools') ? ' class="active"' : '') + '><span class="di">\uD83D\uDEE0</span>All Tools</a>' +
        '<a href="/app/chat.html"' + (isActiveSection('/app/chat') ? ' class="active"' : '') + '><span class="di">\uD83D\uDCAC</span>Live Chat</a>' +
        '<a href="/pricing"><span class="di">\uD83D\uDCB3</span>Pricing</a>' +
      '</div>' +
      '<div id="gnav-drawer-tools"></div>';
    drawer.innerHTML = drawerHTML;

    // Tool launcher overlay
    var launcherOverlay = document.createElement('div');
    launcherOverlay.className = 'gnav-launcher-overlay';
    launcherOverlay.innerHTML =
      '<div class="gnav-launcher">' +
        '<div class="gnav-launcher-search">' +
          '<span class="ls-icon">\uD83D\uDD0D</span>' +
          '<input class="gnav-launcher-input" type="text" placeholder="Search all tools\u2026" id="gnav-launcher-input">' +
          '<kbd class="gnav-launcher-esc">ESC</kbd>' +
        '</div>' +
        '<div class="gnav-launcher-tabs" id="gnav-launcher-tabs"></div>' +
        '<div class="gnav-launcher-grid" id="gnav-launcher-grid"></div>' +
        '<div class="gnav-launcher-footer">' +
          '<span><kbd>\u2191</kbd><kbd>\u2193</kbd> navigate</span>' +
          '<span><kbd>\u21B5</kbd> open</span>' +
          '<span><kbd>esc</kbd> close</span>' +
        '</div>' +
      '</div>';

    // Insert into DOM
    var body = document.body;
    if (body.firstChild) {
      body.insertBefore(nav, body.firstChild);
    } else {
      body.appendChild(nav);
    }
    body.appendChild(drawerOverlay);
    body.appendChild(drawer);
    body.appendChild(launcherOverlay);
    body.classList.add('gnav-active');

    // ── Categories Dropdown ──
    var catBtn = nav.querySelector('.gnav-categories-btn');
    var catDropdown = nav.querySelector('.gnav-categories-dropdown');

    function buildCatDropdown() {
      var html = '';
      for (var i = 0; i < CATEGORIES.length; i++) {
        var c = CATEGORIES[i];
        if (c.id === 'all') continue;
        var count = c.id === 'recent' ? getRecent().length : TOOLS.filter(function (t) { return t.cat === c.id; }).length;
        html += '<button class="gnav-cat-item" data-cat="' + c.id + '" role="menuitem">' +
          '<span class="cat-icon">' + c.icon + '</span>' +
          '<span>' + c.name + '</span>' +
          '<span class="cat-count">' + count + '</span>' +
        '</button>';
        if (i === 1) html += '<div class="gnav-cat-divider"></div>';
      }
      html += '<div class="gnav-cat-divider"></div>' +
        '<button class="gnav-cat-item" data-action="launcher" role="menuitem">' +
          '<span class="cat-icon">\u2B50</span>' +
          '<span>Open Launcher</span>' +
          '<span class="cat-count">' + modKey + '+K</span>' +
        '</button>';
      catDropdown.innerHTML = html;
    }
    buildCatDropdown();

    function toggleCatDropdown(show) {
      var isOpen = typeof show === 'boolean' ? show : !catDropdown.classList.contains('open');
      catDropdown.classList.toggle('open', isOpen);
      catBtn.setAttribute('aria-expanded', String(isOpen));
    }

    catBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleCatDropdown();
    });

    catDropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.gnav-cat-item');
      if (!item) return;
      toggleCatDropdown(false);
      if (item.dataset.action === 'launcher') {
        openLauncher();
      } else if (item.dataset.cat) {
        openLauncher(item.dataset.cat);
      }
    });

    // Close dropdown on outside click
    document.addEventListener('click', function () {
      toggleCatDropdown(false);
    });

    // ── Hamburger / Mobile Drawer ──
    var hamburger = document.getElementById('gnav-hamburger');

    function openDrawer() {
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      drawer.classList.add('open');
      drawerOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      renderDrawerTools();
    }

    function closeDrawer() {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      drawer.classList.remove('open');
      drawerOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', function () {
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    drawerOverlay.addEventListener('click', closeDrawer);

    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeDrawer();
    });

    // Render tools in drawer
    function renderDrawerTools(query) {
      var container = document.getElementById('gnav-drawer-tools');
      var html = '';
      var cats = CATEGORIES.filter(function (c) { return c.id !== 'all'; });
      for (var ci = 0; ci < cats.length; ci++) {
        var cat = cats[ci];
        var tools = getToolsSorted(cat.id, query);
        if (tools.length === 0) continue;
        html += '<div class="gnav-drawer-section">' +
          '<div class="gnav-drawer-title">' + cat.icon + ' ' + cat.name + '</div>';
        for (var ti = 0; ti < tools.length; ti++) {
          var t = tools[ti];
          html += '<a href="' + t.href + '"' + (isActiveTool(t.href) ? ' class="active"' : '') + '>' +
            '<span class="di">' + t.icon + '</span>' + t.name + '</a>';
        }
        html += '</div>';
      }
      container.innerHTML = html || '<div style="padding:1rem;text-align:center;opacity:0.4;">No tools found</div>';
    }

    var drawerSearchInput = document.getElementById('gnav-drawer-search-input');
    if (drawerSearchInput) {
      drawerSearchInput.addEventListener('input', function () {
        renderDrawerTools(this.value);
      });
    }

    // ── Tool Launcher ──
    var activeTab = 'all';
    var highlightedIndex = -1;

    function openLauncher(initialCat) {
      if (initialCat) activeTab = initialCat;
      launcherOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      renderTabs();
      renderGrid();
      highlightedIndex = -1;
      var input = document.getElementById('gnav-launcher-input');
      if (input) { input.value = ''; input.focus(); }
    }

    function closeLauncher() {
      launcherOverlay.classList.remove('open');
      document.body.style.overflow = '';
      highlightedIndex = -1;
    }

    function renderTabs() {
      var container = document.getElementById('gnav-launcher-tabs');
      var html = '';
      for (var i = 0; i < CATEGORIES.length; i++) {
        var c = CATEGORIES[i];
        html += '<button class="gnav-launcher-tab' + (c.id === activeTab ? ' active' : '') + '" data-cat="' + c.id + '">' +
          c.icon + ' ' + c.name + '</button>';
      }
      container.innerHTML = html;
    }

    function renderGrid(query) {
      var container = document.getElementById('gnav-launcher-grid');
      var tools = getToolsSorted(activeTab, query);
      var recent = getRecent();

      if (tools.length === 0) {
        container.innerHTML = '<div class="gnav-launcher-empty">No tools found' + (query ? ' for "' + query + '"' : '') + '</div>';
        return;
      }

      var html = '';
      for (var i = 0; i < tools.length; i++) {
        var t = tools[i];
        var recentIdx = recent.indexOf(t.id);
        html += '<a class="gnav-tool-card' + (i === highlightedIndex ? ' highlighted' : '') + '" href="' + t.href + '" data-idx="' + i + '">' +
          '<span class="tc-icon">' + t.icon + '</span>' +
          '<span class="tc-info">' +
            '<span class="tc-name">' + t.name + '</span>' +
            '<span class="tc-desc">' + t.desc + '</span>' +
            (recentIdx !== -1 && recentIdx < 5 ? '<span class="tc-recent">Recently used</span>' : '') +
          '</span>' +
        '</a>';
      }
      container.innerHTML = html;
    }

    // Tab clicks
    document.getElementById('gnav-launcher-tabs').addEventListener('click', function (e) {
      var tab = e.target.closest('.gnav-launcher-tab');
      if (!tab) return;
      activeTab = tab.dataset.cat;
      highlightedIndex = -1;
      renderTabs();
      renderGrid(document.getElementById('gnav-launcher-input').value);
    });

    // Search input in launcher
    var launcherInput = document.getElementById('gnav-launcher-input');
    launcherInput.addEventListener('input', function () {
      highlightedIndex = -1;
      renderGrid(this.value);
    });

    // Keyboard navigation in launcher
    launcherInput.addEventListener('keydown', function (e) {
      var grid = document.getElementById('gnav-launcher-grid');
      var cards = grid.querySelectorAll('.gnav-tool-card');
      if (!cards.length) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, cards.length - 1);
        updateHighlight(cards);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        updateHighlight(cards);
      } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < cards.length) {
        e.preventDefault();
        cards[highlightedIndex].click();
      }
    });

    function updateHighlight(cards) {
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.toggle('highlighted', i === highlightedIndex);
      }
      if (highlightedIndex >= 0 && cards[highlightedIndex]) {
        cards[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }

    // Track tool clicks from launcher
    document.getElementById('gnav-launcher-grid').addEventListener('click', function (e) {
      var card = e.target.closest('.gnav-tool-card');
      if (!card) return;
      var href = card.getAttribute('href');
      for (var i = 0; i < TOOLS.length; i++) {
        if (TOOLS[i].href === href) { trackUsage(TOOLS[i].id); break; }
      }
      closeLauncher();
    });

    // Close launcher on overlay click
    launcherOverlay.addEventListener('click', function (e) {
      if (e.target === launcherOverlay) closeLauncher();
    });

    // Search button opens launcher
    nav.querySelector('.gnav-search-btn').addEventListener('click', function () {
      activeTab = 'all';
      openLauncher();
    });

    // ── Global Keyboard Shortcuts ──
    document.addEventListener('keydown', function (e) {
      // Cmd+K / Ctrl+K → open launcher
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (launcherOverlay.classList.contains('open')) {
          closeLauncher();
        } else {
          activeTab = 'all';
          openLauncher();
        }
      }

      // Escape → close launcher or drawer
      if (e.key === 'Escape') {
        if (launcherOverlay.classList.contains('open')) {
          closeLauncher();
        } else if (drawer.classList.contains('open')) {
          closeDrawer();
          hamburger.focus();
        }
      }
    });

    // ── Sticky Nav: hide on scroll down, show on scroll up ──
    var lastScrollY = 0;
    var scrollTicking = false;

    function onScroll() {
      var currentY = window.scrollY;
      if (currentY > 10) {
        nav.classList.add('nav-scrolled');
      } else {
        nav.classList.remove('nav-scrolled');
      }
      if (!drawer.classList.contains('open')) {
        if (currentY > lastScrollY && currentY > 80) {
          nav.classList.add('nav-hidden');
        } else {
          nav.classList.remove('nav-hidden');
        }
      }
      lastScrollY = currentY;
      scrollTicking = false;
    }

    window.addEventListener('scroll', function () {
      if (!scrollTicking) {
        window.requestAnimationFrame(onScroll);
        scrollTicking = true;
      }
    }, { passive: true });

    // ── Notification Bell ──
    var notifBadge = document.getElementById('gnav-notif-badge');
    function checkNotifications() {
      // Check localStorage for unread notifications
      try {
        var notifs = JSON.parse(localStorage.getItem('cortex_notifications') || '[]');
        var unread = notifs.filter(function (n) { return !n.read; });
        if (notifBadge) {
          notifBadge.classList.toggle('has-notifs', unread.length > 0);
        }
      } catch (e) {}
    }
    checkNotifications();

    nav.querySelector('.gnav-notif-btn').addEventListener('click', function () {
      // Navigate to notifications or show a panel (future)
      if (typeof window.showNotifications === 'function') {
        window.showNotifications();
      }
    });

    // ── Firebase Auth ──
    function updateAuthUI() {
      var authContainer = document.getElementById('gnav-auth');
      if (!authContainer) return;

      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (user) {
          if (user) {
            authContainer.innerHTML = '';
            var avatarEl;
            var safeName = user.displayName || 'User';
            var safeTitle = user.displayName || user.email || 'User';
            if (user.photoURL) {
              avatarEl = document.createElement('img');
              avatarEl.src = user.photoURL;
              avatarEl.alt = safeName;
              avatarEl.className = 'gnav-avatar';
              avatarEl.title = safeTitle;
              avatarEl.loading = 'lazy';
              avatarEl.width = 32;
              avatarEl.height = 32;
            } else {
              var initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
              avatarEl = document.createElement('div');
              avatarEl.className = 'gnav-avatar-placeholder';
              avatarEl.title = safeTitle;
              avatarEl.textContent = initials;
            }
            avatarEl.addEventListener('click', function () {
              window.location.href = '/app/';
            });
            authContainer.appendChild(avatarEl);
          } else {
            authContainer.innerHTML = '';
            var btn = document.createElement('button');
            btn.className = 'gnav-signin-btn';
            btn.textContent = 'Sign In';
            btn.addEventListener('click', function () {
              if (typeof cortexSignIn === 'function') { cortexSignIn(); }
              else if (typeof showAuthModal === 'function') { showAuthModal(); }
              else { window.location.href = '/app/login.html'; }
            });
            authContainer.appendChild(btn);
          }
        });
      } else {
        var btn = document.getElementById('gnav-signin-btn');
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
    openLauncher: function (cat) {
      var overlay = document.querySelector('.gnav-launcher-overlay');
      if (overlay) {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    },
    trackUsage: trackUsage,
    getRecent: getRecent,
    TOOLS: TOOLS,
    CATEGORIES: CATEGORIES
  };

  // Build nav when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNav);
  } else {
    buildNav();
  }
})();
