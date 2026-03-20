// ===== SHARED NAV — Cortex Freelancer =====
// Dynamic navigation: logo, Home, Tools, Chat, Pricing, Sign In/avatar, hamburger menu
// Highlights active page based on current URL
// Usage: <script src="/app/_includes/nav.js"></script> (place at top of <body> or end of <head>)

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

    var nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.innerHTML =
      '<a href="/app/" class="nav-logo">' +
        '<span class="nav-logo-icon">C</span>' +
        '<span class="nav-logo-text">Cortex</span>' +
      '</a>' +
      '<div class="nav-links" id="nav-links">' +
        '<a href="/app/"' + (isActive('/app/') && !path.includes('/tools') && !path.includes('/chat') ? ' class="active"' : '') + '>Home</a>' +
        '<a href="/app/tools/"' + (isActive('/app/tools') ? ' class="active"' : '') + '>Tools</a>' +
        '<a href="/app/chat.html"' + (isActive('/app/chat') ? ' class="active"' : '') + '>Chat</a>' +
        '<a href="/pricing"' + (isActive('/pricing') ? ' class="active"' : '') + '>Pricing</a>' +
        '<div class="nav-auth" id="nav-auth">' + authHTML + '</div>' +
      '</div>' +
      '<button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu">' +
        '<span></span><span></span><span></span>' +
      '</button>';

    // Insert as first child of body
    if (document.body.firstChild) {
      document.body.insertBefore(nav, document.body.firstChild);
    } else {
      document.body.appendChild(nav);
    }

    // Hamburger toggle
    var hamburger = document.getElementById('nav-hamburger');
    var links = document.getElementById('nav-links');

    hamburger.addEventListener('click', function () {
      hamburger.classList.toggle('open');
      links.classList.toggle('open');
    });

    // Close menu on link click (mobile)
    var navAnchors = links.querySelectorAll('a');
    for (var i = 0; i < navAnchors.length; i++) {
      navAnchors[i].addEventListener('click', function () {
        hamburger.classList.remove('open');
        links.classList.remove('open');
      });
    }

    // Firebase auth state listener
    function updateAuthUI() {
      var authContainer = document.getElementById('nav-auth');
      if (!authContainer) return;

      // Check if Firebase is available
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (user) {
          if (user) {
            // Signed in — show avatar
            if (user.photoURL) {
              authContainer.innerHTML =
                '<img src="' + user.photoURL + '" alt="' + (user.displayName || 'User') + '" class="nav-avatar" id="nav-avatar" title="' + (user.displayName || user.email) + '">';
            } else {
              var initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
              authContainer.innerHTML =
                '<div class="nav-avatar-placeholder" id="nav-avatar" title="' + (user.displayName || user.email) + '">' + initials + '</div>';
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
