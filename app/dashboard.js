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
      btn.textContent = 'Manage Subscription';
      btn.className = 'pro-status-btn active';
      btn.href = '#';
      btn.onclick = function (e) { e.preventDefault(); openBillingPortal(); };
    }
  }

  // ========== BILLING PORTAL ==========
  // [315] Show education modal before redirecting to Stripe portal
  function openBillingPortal() {
    var modal = document.getElementById('billingEducationModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.addEventListener('click', function handler(e) {
        if (e.target === modal) { modal.style.display = 'none'; modal.removeEventListener('click', handler); }
      });
    } else {
      confirmOpenBillingPortal();
    }
  }

  async function confirmOpenBillingPortal() {
    var uid = null;
    var email = null;
    try { uid = JSON.parse(localStorage.getItem('cortex_firebase_user'))?.uid; } catch (e) { /* ignore */ }
    try { email = JSON.parse(localStorage.getItem('cortex_user'))?.email; } catch (e) { /* ignore */ }
    if (!uid && !email) email = prompt('Enter the email you used to subscribe:');
    if (!uid && !email) return;

    try {
      var res = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid, email: email })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');
      window.location.href = data.url;
    } catch (err) {
      alert(err.message || 'Could not open billing portal. Please contact support.');
    }
  }

  // Expose for modal button
  window.confirmOpenBillingPortal = confirmOpenBillingPortal;

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

  // ========== SAVED ITEMS OVERVIEW ==========
  function loadSavedItems() {
    // Saved scope analyses
    try {
      var scopes = JSON.parse(localStorage.getItem('cortex_saved_scopes') || '[]');
      document.getElementById('savedAnalysesCount').textContent = scopes.length;
    } catch (e) { /* ignore */ }

    // Saved invoices
    try {
      var invoices = JSON.parse(localStorage.getItem('cortex_saved_invoices') || '[]');
      document.getElementById('savedInvoicesCount').textContent = invoices.length;
    } catch (e) { /* ignore */ }

    // Saved proposals
    try {
      var proposals = JSON.parse(localStorage.getItem('cortex_saved_proposals') || '[]');
      document.getElementById('savedProposalsCount').textContent = proposals.length;
    } catch (e) { /* ignore */ }

    // Saved rate
    var rate = localStorage.getItem('cortex_hourly_rate');
    if (rate) {
      document.getElementById('savedRate').textContent = '$' + rate + '/hr';
    }
  }

  // ========== SAVED ANALYSES SECTION ==========
  function loadSavedAnalyses() {
    var list = document.getElementById('savedAnalysesList');
    var scopes = [];
    try { scopes = JSON.parse(localStorage.getItem('cortex_saved_scopes') || '[]'); } catch (e) { /* ignore */ }

    if (scopes.length === 0) return;

    list.innerHTML = scopes.slice().reverse().slice(0, 10).map(function (s) {
      var d = s.date ? new Date(s.date) : new Date();
      return '<div class="activity-item">' +
        '<div class="activity-icon" style="background:linear-gradient(135deg,#00ff88,#00cc6a);color:#000">&#128203;</div>' +
        '<div class="activity-info">' +
          '<div class="activity-title">' + (s.name || 'Untitled Analysis') + '</div>' +
          '<div class="activity-meta">' + s.totalHours + ' hrs &middot; ' + s.quote + ' &middot; ' + s.deliverableCount + ' deliverables &middot; ' + getTimeAgo(d) + '</div>' +
        '</div>' +
        '<span class="activity-badge" style="background:rgba(0,255,136,.1);color:#00ff88">' + s.redFlags + ' flags</span>' +
      '</div>';
    }).join('');
  }

  // ========== SAVED INVOICES SECTION ==========
  function loadSavedInvoices() {
    var list = document.getElementById('savedInvoicesList');
    var invoices = [];
    try { invoices = JSON.parse(localStorage.getItem('cortex_saved_invoices') || '[]'); } catch (e) { /* ignore */ }

    if (invoices.length === 0) return;

    list.innerHTML = invoices.slice().reverse().slice(0, 10).map(function (inv) {
      var d = inv.date ? new Date(inv.date) : new Date();
      var client = inv.clientName || inv.client || 'Unknown Client';
      var amount = inv.total || inv.amount || '—';
      var status = inv.status || 'draft';
      var statusColor = status === 'paid' ? '#00ff88' : status === 'sent' ? '#4488ff' : '#ff8844';
      var statusBg = status === 'paid' ? 'rgba(0,255,136,.1)' : status === 'sent' ? 'rgba(68,136,255,.1)' : 'rgba(255,136,68,.1)';

      return '<div class="activity-item">' +
        '<div class="activity-icon" style="background:linear-gradient(135deg,#4488ff,#2266dd);color:#000">&#128452;</div>' +
        '<div class="activity-info">' +
          '<div class="activity-title">' + client + (inv.invoiceNumber ? ' — #' + inv.invoiceNumber : '') + '</div>' +
          '<div class="activity-meta">' + (typeof amount === 'number' ? '$' + amount.toLocaleString() : amount) + ' &middot; ' + getTimeAgo(d) + '</div>' +
        '</div>' +
        '<span class="activity-badge" style="background:' + statusBg + ';color:' + statusColor + '">' + status.charAt(0).toUpperCase() + status.slice(1) + '</span>' +
      '</div>';
    }).join('');
  }

  // ========== SAVED PROPOSALS SECTION ==========
  function loadSavedProposals() {
    var list = document.getElementById('savedProposalsList');
    var proposals = [];
    try { proposals = JSON.parse(localStorage.getItem('cortex_saved_proposals') || '[]'); } catch (e) { /* ignore */ }

    if (proposals.length === 0) return;

    list.innerHTML = proposals.slice().reverse().slice(0, 10).map(function (prop) {
      var d = prop.date ? new Date(prop.date) : new Date();
      var title = prop.projectTitle || prop.title || 'Untitled Proposal';
      var client = prop.clientName || prop.client || '';
      var status = prop.status || 'draft';
      var statusColor = status === 'accepted' ? '#00ff88' : status === 'sent' ? '#4488ff' : '#aa66ff';
      var statusBg = status === 'accepted' ? 'rgba(0,255,136,.1)' : status === 'sent' ? 'rgba(68,136,255,.1)' : 'rgba(170,102,255,.1)';

      return '<div class="activity-item">' +
        '<div class="activity-icon" style="background:linear-gradient(135deg,#aa66ff,#8844dd);color:#000">&#128221;</div>' +
        '<div class="activity-info">' +
          '<div class="activity-title">' + title + '</div>' +
          '<div class="activity-meta">' + (client ? client + ' &middot; ' : '') + getTimeAgo(d) + '</div>' +
        '</div>' +
        '<span class="activity-badge" style="background:' + statusBg + ';color:' + statusColor + '">' + status.charAt(0).toUpperCase() + status.slice(1) + '</span>' +
      '</div>';
    }).join('');
  }

  // ========== SUBSCRIPTION CARD ==========
  function loadSubscriptionCard(isPro) {
    var header = document.getElementById('subCardHeader');
    var icon = document.getElementById('subPlanIcon');
    var name = document.getElementById('subPlanName');
    var status = document.getElementById('subPlanStatus');
    var footer = document.getElementById('subCardFooter');
    var upgradeBtn = document.getElementById('subUpgradeBtn');

    // Usage data
    var scopeUses = parseInt(localStorage.getItem('cortex_scope_uses') || '0', 10);
    var toolsUsed = 0;
    try {
      var hist = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]');
      var today = new Date().toDateString();
      toolsUsed = hist.filter(function (h) { return h.date && new Date(h.date).toDateString() === today; }).length;
    } catch (e) { /* ignore */ }

    if (isPro) {
      header.classList.add('is-pro');
      icon.innerHTML = '&#9733;';
      name.textContent = 'Pro Plan';
      status.textContent = 'Unlimited access to all features';
      footer.classList.add('is-pro');
      upgradeBtn.textContent = 'Manage Subscription';
      upgradeBtn.className = 'pro-status-btn active';
      upgradeBtn.href = '#';
      upgradeBtn.onclick = function (e) { e.preventDefault(); openBillingPortal(); };

      document.getElementById('subToolsUsed').textContent = toolsUsed + ' today';
      document.getElementById('subScopeUses').textContent = scopeUses + ' (unlimited)';
      document.getElementById('subPdfExports').textContent = 'Unlimited';
      document.getElementById('subUsageFill').style.width = '100%';
      document.getElementById('subUsageFill').style.background = 'var(--green)';
    } else {
      var maxFreeTools = 3;
      var pct = Math.min(100, Math.round((toolsUsed / maxFreeTools) * 100));
      document.getElementById('subToolsUsed').textContent = toolsUsed + ' / ' + maxFreeTools;
      document.getElementById('subScopeUses').textContent = scopeUses + ' / 1';
      document.getElementById('subUsageFill').style.width = pct + '%';
    }
  }

  // Listen for pro status for subscription card
  var dashProResolved = false;
  document.addEventListener('cortex-auth-ready', function (e) {
    var uid = e.detail && e.detail.uid;
    if (uid && window.checkProStatus) {
      window.checkProStatus(uid).then(function (isPro) {
        dashProResolved = true;
        loadSubscriptionCard(isPro);
      });
    } else {
      loadSubscriptionCard(false);
    }
  });
  // Fallback if auth doesn't fire
  setTimeout(function () {
    if (!dashProResolved) loadSubscriptionCard(false);
  }, 3000);

  // ========== [260] PERSONAL ANALYTICS SECTION ==========
  function loadPersonalAnalytics() {
    var container = document.getElementById('personalAnalytics');
    if (!container) return;

    // Tool usage this week
    var history = [];
    try { history = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]'); } catch (e) { /* ignore */ }

    var now = new Date();
    var weekAgo = new Date(now.getTime() - 7 * 86400000);
    var thisWeek = history.filter(function(h) { return h.date && new Date(h.date) >= weekAgo; });
    var lastWeek = history.filter(function(h) {
      var d = h.date ? new Date(h.date) : null;
      return d && d >= new Date(weekAgo.getTime() - 7 * 86400000) && d < weekAgo;
    });

    // Tools used count
    var toolsThisWeek = thisWeek.length;
    var toolsLastWeek = lastWeek.length;
    var toolsDelta = toolsThisWeek - toolsLastWeek;

    // Most used tool
    var toolCounts = {};
    thisWeek.forEach(function(h) {
      var name = h.tool || 'unknown';
      toolCounts[name] = (toolCounts[name] || 0) + 1;
    });
    var topTool = Object.keys(toolCounts).sort(function(a, b) { return toolCounts[b] - toolCounts[a]; })[0] || '—';
    var topToolName = topTool.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });

    // Active days this week
    var activeDays = {};
    thisWeek.forEach(function(h) {
      if (h.date) activeDays[new Date(h.date).toDateString()] = true;
    });
    var activeDayCount = Object.keys(activeDays).length;

    // Streak
    var streak = 0;
    var checkDate = new Date();
    for (var i = 0; i < 30; i++) {
      var dayStr = checkDate.toDateString();
      var hasActivity = history.some(function(h) { return h.date && new Date(h.date).toDateString() === dayStr; });
      if (hasActivity) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Render stats
    var el = document.getElementById('paToolsUsed');
    if (el) el.textContent = toolsThisWeek;
    el = document.getElementById('paToolsDelta');
    if (el) {
      el.textContent = (toolsDelta >= 0 ? '+' : '') + toolsDelta + ' vs last week';
      el.style.color = toolsDelta >= 0 ? 'var(--green)' : '#ff4444';
    }
    el = document.getElementById('paTopTool');
    if (el) el.textContent = topToolName;
    el = document.getElementById('paActiveDays');
    if (el) el.textContent = activeDayCount + '/7';
    el = document.getElementById('paStreak');
    if (el) el.textContent = streak + ' day' + (streak !== 1 ? 's' : '');

    // Usage by day chart (simple text bars)
    var chartEl = document.getElementById('paWeeklyChart');
    if (chartEl) {
      var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var dayCounts = [0, 0, 0, 0, 0, 0, 0];
      thisWeek.forEach(function(h) {
        if (h.date) dayCounts[new Date(h.date).getDay()]++;
      });
      var maxCount = Math.max.apply(null, dayCounts) || 1;
      chartEl.innerHTML = dayNames.map(function(name, idx) {
        var pct = (dayCounts[idx] / maxCount) * 100;
        var isToday = idx === now.getDay();
        return '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">' +
          '<span style="width:30px;font-size:.75rem;color:' + (isToday ? 'var(--orange)' : 'var(--text3)') + ';font-weight:' + (isToday ? '700' : '400') + '">' + name + '</span>' +
          '<div style="flex:1;height:20px;background:var(--bg3);border-radius:4px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--orange),var(--green));border-radius:4px;transition:width .5s"></div>' +
          '</div>' +
          '<span style="font-size:.75rem;color:var(--text3);width:20px;text-align:right">' + dayCounts[idx] + '</span>' +
        '</div>';
      }).join('');
    }
  }

  // ========== [486] REFERRAL PROGRAM UI ==========
  var REF_STORAGE_KEY = 'cortex_referral';

  function getReferralData() {
    try {
      return JSON.parse(localStorage.getItem(REF_STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveReferralData(data) {
    localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(data));
  }

  function generateReferralCode() {
    var data = getReferralData();
    if (data.code) return data.code;
    var code = 'CTX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    data.code = code;
    data.clicks = data.clicks || 0;
    data.signups = data.signups || 0;
    data.rewards = data.rewards || 0;
    saveReferralData(data);
    return code;
  }

  function initReferralUI() {
    var section = document.getElementById('referralSection');
    if (!section) return;

    var code = generateReferralCode();
    var link = 'https://cortexfreelancer.com/app/signup?ref=' + code;

    var linkInput = document.getElementById('referralLink');
    if (linkInput) linkInput.value = link;

    // Load stats
    var data = getReferralData();
    var clicks = document.getElementById('refLinkClicks');
    var signups = document.getElementById('refSignups');
    var rewards = document.getElementById('refRewards');
    if (clicks) clicks.textContent = data.clicks || 0;
    if (signups) signups.textContent = data.signups || 0;
    if (rewards) rewards.textContent = data.rewards || 0;
  }

  window.copyReferralLink = function () {
    var input = document.getElementById('referralLink');
    var btn = document.getElementById('copyReferralBtn');
    if (!input) return;

    navigator.clipboard.writeText(input.value).then(function () {
      btn.textContent = 'Copied!';
      btn.style.background = 'var(--green)';
      setTimeout(function () {
        btn.textContent = 'Copy';
        btn.style.background = '';
      }, 2000);
    }).catch(function () {
      input.select();
      document.execCommand('copy');
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
    });

    // Track click
    var data = getReferralData();
    data.clicks = (data.clicks || 0) + 1;
    saveReferralData(data);
    var el = document.getElementById('refLinkClicks');
    if (el) el.textContent = data.clicks;
  };

  window.shareReferral = function (platform) {
    var data = getReferralData();
    var link = 'https://cortexfreelancer.com/app/signup?ref=' + (data.code || '');
    var text = 'I use Cortex Freelancer to manage my freelance business — invoices, proposals, contracts, all AI-powered. Try it free:';
    var encoded = encodeURIComponent(text + ' ' + link);

    var urls = {
      twitter: 'https://twitter.com/intent/tweet?text=' + encoded,
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(link),
      whatsapp: 'https://wa.me/?text=' + encoded,
      email: 'mailto:?subject=' + encodeURIComponent('Check out Cortex Freelancer') + '&body=' + encoded
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400');
    }

    // Track share
    data.clicks = (data.clicks || 0) + 1;
    saveReferralData(data);
    if (window.dataLayer) dataLayer.push({ event: 'referral_share', platform: platform });
  };

  initReferralUI();

  // ========== [357] ACTIVATION NUDGE ==========
  function showActivationNudge() {
    var history = [];
    try { history = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]'); } catch (e) { /* ignore */ }
    if (history.length > 0) return;

    var dismissed = sessionStorage.getItem('cortex_nudge_dismissed');
    if (dismissed) return;

    var banner = document.createElement('div');
    banner.className = 'activation-nudge';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<div class="nudge-inner">' +
        '<span class="nudge-icon">&#128640;</span>' +
        '<div class="nudge-text">' +
          '<strong>Welcome aboard!</strong> Try your first tool to get started — ' +
          '<a href="/app/tools/">explore tools</a>' +
        '</div>' +
        '<button class="nudge-close" aria-label="Dismiss">&times;</button>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent =
      '.activation-nudge{background:linear-gradient(135deg,rgba(255,136,68,.15),rgba(170,102,255,.15));border:1px solid rgba(255,136,68,.3);border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.5rem;animation:nudgeFadeIn .4s ease}' +
      '.nudge-inner{display:flex;align-items:center;gap:.75rem}' +
      '.nudge-icon{font-size:1.5rem}' +
      '.nudge-text{flex:1;font-size:.95rem;color:var(--text1)}' +
      '.nudge-text a{color:var(--orange);text-decoration:underline}' +
      '.nudge-close{background:none;border:none;color:var(--text3);font-size:1.25rem;cursor:pointer;padding:0 .25rem}' +
      '.nudge-close:hover{color:var(--text1)}' +
      '@keyframes nudgeFadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);

    var greeting = document.querySelector('.dash-greeting');
    if (greeting && greeting.parentNode) {
      greeting.parentNode.insertBefore(banner, greeting.nextSibling);
    }

    banner.querySelector('.nudge-close').addEventListener('click', function () {
      banner.remove();
      sessionStorage.setItem('cortex_nudge_dismissed', '1');
    });
  }

  document.addEventListener('cortex-auth-ready', function () {
    showActivationNudge();
  });

  // ========== INIT ==========
  updateGreeting();
  loadRecentActivity();
  loadSavedItems();
  loadSavedAnalyses();
  loadSavedInvoices();
  loadSavedProposals();
  loadPersonalAnalytics();
})();
