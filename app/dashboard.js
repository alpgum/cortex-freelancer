/**
 * Cortex Freelancer — Dashboard
 * Post-login home page with greeting, quick actions, recent activity,
 * Pro status card, and saved items.
 */
(function () {
  'use strict';

  // ========== GREETING ==========
  function updateGreeting() {
    var hour = new Date().getHours();
    var timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var sub = document.getElementById('greetingSub');
    if (hour < 12) sub.textContent = "Ready to start your day? Here's your overview.";
    else if (hour < 18) sub.textContent = "Here's your overview for today.";
    else sub.textContent = "Wrapping up? Here's where things stand.";

    // Update name from auth or onboarding
    document.addEventListener('cortex-auth-ready', function (e) {
      var name = e.detail && e.detail.displayName;
      if (name) {
        document.getElementById('userName').textContent = name.split(' ')[0];
      }
      document.querySelector('.dash-greeting h1').innerHTML =
        timeGreeting + ', <span id="userName">' + (name ? name.split(' ')[0] : 'Freelancer') + '</span>';
    });

    document.querySelector('.dash-greeting h1').innerHTML =
      timeGreeting + ', <span id="userName">Freelancer</span>';
  }

  // ========== PRO STATUS ==========
  function updateProStatus(isPro) {
    var card = document.getElementById('proStatusCard');
    var icon = document.getElementById('proIcon');
    var title = document.getElementById('proTitle');
    var desc = document.getElementById('proDesc');
    var btn = document.getElementById('proBtn');

    if (isPro) {
      card.classList.add('is-pro');
      icon.innerHTML = '&#9733;';
      icon.style.background = 'linear-gradient(135deg,var(--green),var(--green2))';
      title.textContent = 'Pro Plan Active';
      desc.textContent = 'You have unlimited access to all tools, exports, and premium features.';
      btn.textContent = 'Manage';
      btn.className = 'pro-status-btn active';
      btn.href = '/pricing';
    }
  }

  document.addEventListener('cortex-auth-ready', function (e) {
    var uid = e.detail && e.detail.uid;
    if (uid && window.checkProStatus) {
      window.checkProStatus(uid).then(updateProStatus);
    }
  });

  // ========== RECENT ACTIVITY ==========
  function loadRecentActivity() {
    var history = [];
    try {
      history = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]');
    } catch (e) { /* ignore */ }

    var list = document.getElementById('activityList');
    if (history.length === 0) return;

    var recent = history.slice(-8).reverse();
    var toolIcons = {
      'rate-calculator': { icon: '&#128176;', bg: 'linear-gradient(135deg,#ff8844,#ff6622)' },
      'invoice': { icon: '&#128452;', bg: 'linear-gradient(135deg,#4488ff,#2266dd)' },
      'proposal': { icon: '&#128221;', bg: 'linear-gradient(135deg,#aa66ff,#8844dd)' },
      'scope-analyzer': { icon: '&#128203;', bg: 'linear-gradient(135deg,#00ff88,#00cc6a)' },
      'contract-review': { icon: '&#128220;', bg: 'linear-gradient(135deg,#ffcc00,#ddaa00)' },
      'fee-calculator': { icon: '&#128178;', bg: 'linear-gradient(135deg,#ff8844,#ff6622)' },
      'client-red-flags': { icon: '&#9888;&#65039;', bg: 'linear-gradient(135deg,#ff4466,#cc3355)' },
      'tax-estimator': { icon: '&#128178;', bg: 'linear-gradient(135deg,#00cc88,#009966)' },
      'email-writer': { icon: '&#9993;&#65039;', bg: 'linear-gradient(135deg,#4488ff,#2266dd)' },
      'bio-generator': { icon: '&#128100;', bg: 'linear-gradient(135deg,#aa66ff,#8844dd)' },
      'payment-checker': { icon: '&#128179;', bg: 'linear-gradient(135deg,#ff8844,#ee6622)' },
      'portfolio-review': { icon: '&#127912;', bg: 'linear-gradient(135deg,#ee66aa,#cc4488)' }
    };

    list.innerHTML = recent.map(function (item) {
      var toolKey = item.tool || 'scope-analyzer';
      var meta = toolIcons[toolKey] || { icon: '&#128736;', bg: 'var(--bg3)' };
      var date = item.date ? new Date(item.date) : new Date();
      var timeAgo = getTimeAgo(date);
      var title = item.title || toolKey.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });

      return '<div class="activity-item">' +
        '<div class="activity-icon" style="background:' + meta.bg + ';color:#000">' + meta.icon + '</div>' +
        '<div class="activity-info">' +
          '<div class="activity-title">' + title + '</div>' +
          '<div class="activity-meta">' + timeAgo + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function getTimeAgo(date) {
    var diff = Date.now() - date.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return date.toLocaleDateString();
  }

  // ========== SAVED ITEMS ==========
  function loadSavedItems() {
    // Saved scope analyses
    try {
      var scopes = JSON.parse(localStorage.getItem('cortex_saved_scopes') || '[]');
      document.getElementById('savedAnalysesCount').textContent = scopes.length;
    } catch (e) { /* ignore */ }

    // Saved rate
    var rate = localStorage.getItem('cortex_hourly_rate');
    if (rate) {
      document.getElementById('savedRate').textContent = '$' + rate + '/hr';
    }
  }

  // ========== INIT ==========
  updateGreeting();
  loadRecentActivity();
  loadSavedItems();
})();
