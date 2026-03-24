/**
 * [CF-203] Email Verification Flow
 * Send verification email on registration, show banner until confirmed,
 * resend option, auto-check verification status.
 * Exposed on window.CortexFreelancer.EmailVerification
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var BANNER_ID = 'cf-email-verify-banner';
  var CHECK_INTERVAL = 10000; // 10s
  var RESEND_COOLDOWN = 60000; // 60s

  var state = {
    checking: false,
    checkTimer: null,
    lastResent: 0,
    listeners: [],
    verified: false
  };

  // ── Firebase Helpers ──────────────────────────────────────────────────

  function getAuth() {
    var fb = (typeof firebase !== 'undefined') ? firebase : window.firebase;
    if (!fb) return null;
    if (fb.auth && typeof fb.auth === 'function') return fb.auth();
    return null;
  }

  function getCurrentUser() {
    var auth = getAuth();
    return auth ? auth.currentUser : null;
  }

  // ── Send Verification Email ───────────────────────────────────────────

  function sendVerificationEmail(actionCodeSettings) {
    var user = getCurrentUser();
    if (!user) return Promise.reject(new Error('No authenticated user'));

    if (user.emailVerified) {
      return Promise.resolve({ alreadyVerified: true });
    }

    return user.sendEmailVerification(actionCodeSettings || null).then(function () {
      state.lastResent = Date.now();
      console.info('[EmailVerification] Verification email sent to', user.email);
      return { sent: true, email: user.email };
    });
  }

  // ── Resend with Cooldown ──────────────────────────────────────────────

  function canResend() {
    return (Date.now() - state.lastResent) >= RESEND_COOLDOWN;
  }

  function resendCooldownRemaining() {
    var elapsed = Date.now() - state.lastResent;
    if (elapsed >= RESEND_COOLDOWN) return 0;
    return Math.ceil((RESEND_COOLDOWN - elapsed) / 1000);
  }

  function resend() {
    if (!canResend()) {
      var secs = resendCooldownRemaining();
      return Promise.reject(new Error('Please wait ' + secs + 's before resending'));
    }
    return sendVerificationEmail();
  }

  // ── Check Verification Status ─────────────────────────────────────────

  function checkVerification() {
    var user = getCurrentUser();
    if (!user) return Promise.resolve(false);

    return user.reload().then(function () {
      // Re-fetch after reload
      var freshUser = getCurrentUser();
      var verified = freshUser ? freshUser.emailVerified : false;

      if (verified && !state.verified) {
        state.verified = true;
        hideBanner();
        notifyListeners(true);
        stopAutoCheck();
        console.info('[EmailVerification] Email verified!');
      }

      return verified;
    }).catch(function (err) {
      console.warn('[EmailVerification] Check failed:', err);
      return false;
    });
  }

  // ── Auto-Check Loop ───────────────────────────────────────────────────

  function startAutoCheck(intervalMs) {
    stopAutoCheck();
    var interval = intervalMs || CHECK_INTERVAL;
    state.checkTimer = setInterval(function () {
      checkVerification();
    }, interval);
    console.info('[EmailVerification] Auto-check started (every ' + (interval / 1000) + 's)');
  }

  function stopAutoCheck() {
    if (state.checkTimer) {
      clearInterval(state.checkTimer);
      state.checkTimer = null;
    }
  }

  // ── Listeners ─────────────────────────────────────────────────────────

  function onVerified(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
    return function unsubscribe() {
      state.listeners = state.listeners.filter(function (l) { return l !== fn; });
    };
  }

  function notifyListeners(verified) {
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](verified); } catch (e) { console.error(e); }
    }
  }

  // ── Banner UI ─────────────────────────────────────────────────────────

  function showBanner(email) {
    hideBanner(); // Remove existing

    var user = getCurrentUser();
    if (user && user.emailVerified) return; // Already verified

    var displayEmail = email || (user ? user.email : 'your email');

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99997',
      'background:#eff6ff', 'border-bottom:1px solid #bfdbfe',
      'padding:10px 20px', 'display:flex', 'align-items:center',
      'justify-content:center', 'gap:12px', 'flex-wrap:wrap',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif', 'font-size:13px'
    ].join(';');

    var icon = document.createElement('span');
    icon.textContent = '✉️';
    icon.style.fontSize = '18px';

    var msg = document.createElement('span');
    msg.style.color = '#1e40af';
    msg.innerHTML = 'Please verify your email. We sent a link to <strong>' + escapeHtml(displayEmail) + '</strong>';

    var resendBtn = document.createElement('button');
    resendBtn.id = 'cf-verify-resend-btn';
    resendBtn.textContent = 'Resend email';
    resendBtn.style.cssText = [
      'background:#3b82f6', 'color:#fff', 'border:none', 'border-radius:6px',
      'padding:5px 14px', 'font-size:12px', 'font-weight:600', 'cursor:pointer'
    ].join(';');

    resendBtn.addEventListener('click', function () {
      resendBtn.disabled = true;
      resendBtn.textContent = 'Sending…';

      resend().then(function () {
        resendBtn.textContent = 'Sent! ✓';
        setTimeout(function () {
          var remaining = resendCooldownRemaining();
          if (remaining > 0) {
            resendBtn.textContent = 'Resend (' + remaining + 's)';
            var countdown = setInterval(function () {
              var r = resendCooldownRemaining();
              if (r <= 0) {
                clearInterval(countdown);
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend email';
              } else {
                resendBtn.textContent = 'Resend (' + r + 's)';
              }
            }, 1000);
          } else {
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend email';
          }
        }, 2000);
      }).catch(function (err) {
        resendBtn.textContent = err.message || 'Failed';
        setTimeout(function () {
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend email';
        }, 3000);
      });
    });

    var checkBtn = document.createElement('button');
    checkBtn.textContent = "I've verified";
    checkBtn.style.cssText = [
      'background:none', 'color:#3b82f6', 'border:1px solid #3b82f6',
      'border-radius:6px', 'padding:5px 14px', 'font-size:12px',
      'font-weight:500', 'cursor:pointer'
    ].join(';');

    checkBtn.addEventListener('click', function () {
      checkBtn.textContent = 'Checking…';
      checkVerification().then(function (verified) {
        if (verified) {
          checkBtn.textContent = 'Verified! ✓';
        } else {
          checkBtn.textContent = 'Not yet verified';
          setTimeout(function () {
            checkBtn.textContent = "I've verified";
          }, 2000);
        }
      });
    });

    banner.appendChild(icon);
    banner.appendChild(msg);
    banner.appendChild(resendBtn);
    banner.appendChild(checkBtn);

    if (document.body) {
      document.body.appendChild(banner);
    }
  }

  function hideBanner() {
    var banner = document.getElementById(BANNER_ID);
    if (banner) banner.remove();
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isVerified() {
    var user = getCurrentUser();
    return user ? user.emailVerified : false;
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init(options) {
    options = options || {};

    // Listen for auth state changes
    var auth = getAuth();
    if (auth) {
      auth.onAuthStateChanged(function (user) {
        if (user && !user.emailVerified) {
          if (options.showBanner !== false) showBanner(user.email);
          if (options.autoCheck !== false) startAutoCheck(options.checkInterval);
        } else {
          hideBanner();
          stopAutoCheck();
          if (user && user.emailVerified) {
            state.verified = true;
          }
        }
      });
    }

    console.info('[EmailVerification] Initialized');
  }

  function destroy() {
    stopAutoCheck();
    hideBanner();
    state.listeners = [];
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.CortexFreelancer.EmailVerification = {
    init: init,
    destroy: destroy,
    sendVerificationEmail: sendVerificationEmail,
    resend: resend,
    canResend: canResend,
    resendCooldownRemaining: resendCooldownRemaining,
    checkVerification: checkVerification,
    startAutoCheck: startAutoCheck,
    stopAutoCheck: stopAutoCheck,
    showBanner: showBanner,
    hideBanner: hideBanner,
    isVerified: isVerified,
    onVerified: onVerified
  };
})();
