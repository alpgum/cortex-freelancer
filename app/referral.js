/**
 * Referral Program Logic
 * Generates unique referral links, handles sharing, and displays referral count.
 */
(function() {
  'use strict';

  var referralCodeEl = document.getElementById('referralCode');
  var referralLinkEl = document.getElementById('referralLink');
  var copyBtn = document.getElementById('copyReferralLink');
  var referralCountEl = document.getElementById('referralCount');
  var referralStatusEl = document.getElementById('referralStatus');

  function getUserEmail() {
    try {
      var user = JSON.parse(localStorage.getItem('cortex_user'));
      return user && user.email;
    } catch (e) { return null; }
  }

  function getUserUid() {
    try {
      var user = JSON.parse(localStorage.getItem('cortex_user'));
      return user && user.uid;
    } catch (e) { return null; }
  }

  async function loadReferralData() {
    var email = getUserEmail();
    if (!email) {
      showLoginPrompt();
      return;
    }

    try {
      var res = await fetch('/api/referral?email=' + encodeURIComponent(email));
      var data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to load referral data');

      var code = data.code;
      var link = window.location.origin + '/?ref=' + code;

      if (referralCodeEl) referralCodeEl.textContent = code;
      if (referralLinkEl) referralLinkEl.value = link;
      if (referralCountEl) referralCountEl.textContent = data.referrals || 0;

      setupShareButtons(link, code);
    } catch (err) {
      if (referralStatusEl) {
        referralStatusEl.textContent = 'Could not load referral data. Please try again.';
        referralStatusEl.style.color = 'var(--red)';
      }
    }
  }

  function showLoginPrompt() {
    var container = document.getElementById('referralContent');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><p style="color:var(--text2);font-size:1.1rem;margin-bottom:1.5rem">Sign in to access your referral link.</p><a href="/app/login" style="display:inline-block;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#000;padding:.85rem 2rem;border-radius:100px;font-weight:700;font-size:.95rem;text-decoration:none">Sign In &rarr;</a></div>';
    }
  }

  function setupShareButtons(link, code) {
    var shareText = 'I use Cortex Freelancer to manage my freelance business. Sign up with my link and we both get 1 month free! ' + link;

    var twitterBtn = document.getElementById('shareTwitter');
    if (twitterBtn) {
      twitterBtn.addEventListener('click', function() {
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText), '_blank', 'width=550,height=400');
      });
    }

    var linkedinBtn = document.getElementById('shareLinkedin');
    if (linkedinBtn) {
      linkedinBtn.addEventListener('click', function() {
        window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(link), '_blank', 'width=550,height=400');
      });
    }

    var emailBtn = document.getElementById('shareEmail');
    if (emailBtn) {
      emailBtn.addEventListener('click', function() {
        window.location.href = 'mailto:?subject=' + encodeURIComponent('Try Cortex Freelancer — we both get 1 month free') + '&body=' + encodeURIComponent(shareText);
      });
    }

    var whatsappBtn = document.getElementById('shareWhatsapp');
    if (whatsappBtn) {
      whatsappBtn.addEventListener('click', function() {
        window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank');
      });
    }
  }

  // Copy link
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      var link = referralLinkEl ? referralLinkEl.value : '';
      if (!link) return;
      navigator.clipboard.writeText(link).then(function() {
        copyBtn.textContent = 'Copied!';
        setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
      });
    });
  }

  // Track referral click on landing
  (function trackReferralVisit() {
    var params = new URLSearchParams(window.location.search);
    var ref = params.get('ref');
    if (ref) {
      try { localStorage.setItem('cortex_referral_code', ref); } catch (e) {}
      fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'click', code: ref })
      }).catch(function() {});
    }
  })();

  // Load on page ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadReferralData);
  } else {
    loadReferralData();
  }
})();
