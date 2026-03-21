// ===== SHARED NAV — Cortex Freelancer =====
// Responsive navigation: desktop horizontal, mobile hamburger slide-out
// Sticky with hide-on-scroll-down / show-on-scroll-up
// Active page indicator based on current URL
// Usage: <script src="/app/_includes/nav.js"></script>

(function () {
  function buildNav() {
    var path = window.location.pathname;

    // Determine active page
    function isActive(href) {
      if (href === '/app/' || href === '/app') {
        return path === '/app/' || path === '/app' || path === '/app/index.html';
      }
      return path.startsWith(href);
    }

    // Check Firebase auth state
    var authHTML = '<button class="nav-signin" id="nav-signin-btn">Sign In</button>';

    // Build nav element
    var nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML =
      '<a href="/app/" class="nav-logo">' +
        '<span class="nav-logo-icon">C</span>' +
        '<span class="nav-logo-text">Cortex</span>' +
      '</a>' +
      '<div class="nav-links" id="nav-links" role="menu">' +
        '<a href="/app/"' + (isActive('/app/') && !path.includes('/tools') && !path.includes('/chat') ? ' class="active" aria-current="page"' : '') + ' role="menuitem">Home</a>' +
        '<a href="/app/tools/"' + (isActive('/app/tools') ? ' class="active" aria-current="page"' : '') + ' role="menuitem">Tools</a>' +
        '<a href="/app/chat.html"' + (isActive('/app/chat') ? ' class="active" aria-current="page"' : '') + ' role="menuitem">Chat</a>' +
        '<a href="/pricing"' + (isActive('/pricing') ? ' class="active" aria-current="page"' : '') + ' role="menuitem">Pricing</a>' +
        '<div class="nav-auth" id="nav-auth">' + authHTML + '</div>' +
      '</div>' +
      '<button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu" aria-expanded="false">' +
        '<span></span><span></span><span></span>' +
      '</button>';

    // Create mobile overlay backdrop
    var overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'nav-overlay';

    // Insert nav as first child of body
    if (document.body.firstChild) {
      document.body.insertBefore(nav, document.body.firstChild);
      nav.parentNode.insertBefore(overlay, nav.nextSibling);
    } else {
      document.body.appendChild(nav);
      document.body.appendChild(overlay);
    }

    // Hamburger toggle
    var hamburger = document.getElementById('nav-hamburger');
    var links = document.getElementById('nav-links');
    var navOverlay = document.getElementById('nav-overlay');

    function openMenu() {
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      links.classList.add('open');
      navOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      links.classList.remove('open');
      navOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', function () {
      if (links.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close menu on overlay click
    navOverlay.addEventListener('click', closeMenu);

    // Close menu on link click (mobile)
    var navAnchors = links.querySelectorAll('a');
    for (var i = 0; i < navAnchors.length; i++) {
      navAnchors[i].addEventListener('click', closeMenu);
    }

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        closeMenu();
        hamburger.focus();
      }
    });

    // ── Sticky nav: hide on scroll down, show on scroll up ──
    var lastScrollY = 0;
    var ticking = false;

    function onScroll() {
      var currentY = window.scrollY;

      // Add shadow when scrolled
      if (currentY > 10) {
        nav.classList.add('nav-scrolled');
      } else {
        nav.classList.remove('nav-scrolled');
      }

      // Hide/show on scroll direction (only when menu is closed)
      if (!links.classList.contains('open')) {
        if (currentY > lastScrollY && currentY > 80) {
          nav.classList.add('nav-hidden');
        } else {
          nav.classList.remove('nav-hidden');
        }
      }

      lastScrollY = currentY;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, { passive: true });

    // Firebase auth state listener
    function updateAuthUI() {
      var authContainer = document.getElementById('nav-auth');
      if (!authContainer) return;

      // Check if Firebase is available
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (user) {
          if (user) {
            // Signed in — show avatar (safe DOM construction)
            authContainer.textContent = '';
            var avatarEl;
            var safeDisplayName = user.displayName || 'User';
            var safeTitle = user.displayName || user.email || 'User';
            if (user.photoURL) {
              avatarEl = document.createElement('img');
              avatarEl.src = user.photoURL;
              avatarEl.alt = safeDisplayName;
              avatarEl.className = 'nav-avatar';
              avatarEl.id = 'nav-avatar';
              avatarEl.title = safeTitle;
              avatarEl.loading = 'lazy';
              avatarEl.width = 32;
              avatarEl.height = 32;
            } else {
              var initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
              avatarEl = document.createElement('div');
              avatarEl.className = 'nav-avatar-placeholder';
              avatarEl.id = 'nav-avatar';
              avatarEl.title = safeTitle;
              avatarEl.textContent = initials;
            }
            authContainer.appendChild(avatarEl);
            // Pro badge or Upgrade link
            var isPro = localStorage.getItem('cortex_pro') === 'true';
            if (isPro) {
              var badge = document.createElement('span');
              badge.className = 'nav-pro-badge';
              badge.title = 'Pro member';
              badge.innerHTML = '&#9733; PRO';
              authContainer.appendChild(badge);
              // [331] Manage subscription link next to Pro badge
              var manageLink = document.createElement('a');
              manageLink.href = '/api/billing-portal';
              manageLink.className = 'nav-manage-sub';
              manageLink.textContent = 'Manage';
              manageLink.addEventListener('click', function(e) {
                e.preventDefault();
                var email;
                try { email = JSON.parse(localStorage.getItem('cortex_user')).email; } catch(ex) {}
                if (!email) { window.location.href = '/pricing'; return; }
                fetch('/api/billing-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
                  .then(function(r) { return r.json(); })
                  .then(function(d) { if (d.url) window.location.href = d.url; })
                  .catch(function() { window.location.href = '/pricing'; });
              });
              authContainer.appendChild(manageLink);
            } else {
              var upgradeLink = document.createElement('a');
              upgradeLink.href = '/pricing';
              upgradeLink.className = 'nav-upgrade-link';
              upgradeLink.textContent = 'Upgrade';
              authContainer.appendChild(upgradeLink);
            }

            // Click avatar → go to dashboard or profile
            var avatar = document.getElementById('nav-avatar');
            if (avatar) {
              avatar.addEventListener('click', function () {
                window.location.href = '/app/';
              });
            }
          } else {
            // Signed out — show Sign In
            authContainer.innerHTML = '<button class="nav-signin" id="nav-signin-btn">Sign In</button>';
            var btn = document.getElementById('nav-signin-btn');
            if (btn) {
              btn.addEventListener('click', function () {
                // Try to use cortexSignIn if available, else redirect to login
                if (typeof cortexSignIn === 'function') {
                  cortexSignIn();
                } else if (typeof showAuthModal === 'function') {
                  showAuthModal();
                } else {
                  window.location.href = '/app/login.html';
                }
              });
            }
          }
        });
      } else {
        // Firebase not loaded yet — attach Sign In click to redirect
        var btn = document.getElementById('nav-signin-btn');
        if (btn) {
          btn.addEventListener('click', function () {
            window.location.href = '/app/login.html';
          });
        }
      }
    }

    // Delay auth check slightly to let Firebase SDK load
    setTimeout(updateAuthUI, 500);
    // Also retry after Firebase might have initialized
    setTimeout(updateAuthUI, 2000);
  }

  // Build nav when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNav);
  } else {
    buildNav();
  }
})();
