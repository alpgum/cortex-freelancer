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

    // Check trial status
    var onTrial = window.cortexTrial && window.cortexTrial.isActive();
    var trialExpired = window.cortexTrial && window.cortexTrial.isExpired();
    var trialDays = window.cortexTrial ? window.cortexTrial.getDaysRemaining() : -1;

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
    } else if (onTrial) {
      icon.innerHTML = '&#9733;';
      icon.style.background = 'linear-gradient(135deg,#aa66ff,#8844dd)';
      name.textContent = 'Pro Trial';
      status.textContent = trialDays + ' day' + (trialDays !== 1 ? 's' : '') + ' remaining';
      upgradeBtn.textContent = 'Upgrade to Pro';

      document.getElementById('subToolsUsed').textContent = toolsUsed + ' today (unlimited)';
      document.getElementById('subScopeUses').textContent = scopeUses + ' (unlimited)';
      document.getElementById('subPdfExports').textContent = 'Trial Access';
      document.getElementById('subUsageFill').style.width = '100%';
      document.getElementById('subUsageFill').style.background = 'linear-gradient(90deg,#aa66ff,#8844dd)';
    } else if (trialExpired) {
      name.textContent = 'Trial Expired';
      status.textContent = 'Upgrade to continue with Pro features';
      icon.innerHTML = '&#128274;';
      icon.style.background = 'linear-gradient(135deg,#ff4466,#cc3355)';
      upgradeBtn.textContent = 'Upgrade to Pro';

      var maxFreeTools = 3;
      var pct = Math.min(100, Math.round((toolsUsed / maxFreeTools) * 100));
      document.getElementById('subToolsUsed').textContent = toolsUsed + ' / ' + maxFreeTools;
      document.getElementById('subScopeUses').textContent = scopeUses + ' / 1';
      document.getElementById('subUsageFill').style.width = pct + '%';
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

  // ========== [530] WELCOME BACK BANNER ==========
  function showWelcomeBack() {
    var LAST_VISIT_KEY = 'cortex_last_visit';
    var now = Date.now();
    var lastVisit = parseInt(localStorage.getItem(LAST_VISIT_KEY) || '0', 10);

    // Always update last visit timestamp
    localStorage.setItem(LAST_VISIT_KEY, String(now));

    // Only show for returning users (visited at least once before, and >1 hour gap)
    if (!lastVisit || (now - lastVisit) < 3600000) return;

    // Already dismissed this session
    if (sessionStorage.getItem('cortex_wb_dismissed')) return;

    // Calculate time since last visit
    var diffMs = now - lastVisit;
    var diffDays = Math.floor(diffMs / 86400000);
    var diffHours = Math.floor(diffMs / 3600000);
    var timeAgoStr;
    if (diffDays >= 1) {
      timeAgoStr = diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
    } else {
      timeAgoStr = diffHours + ' hour' + (diffHours !== 1 ? 's' : '') + ' ago';
    }

    // Get user name
    var userName = 'Freelancer';
    try {
      var fbUser = JSON.parse(localStorage.getItem('cortex_firebase_user') || '{}');
      if (fbUser.displayName) userName = fbUser.displayName.split(' ')[0];
    } catch (e) { /* ignore */ }
    try {
      var cUser = JSON.parse(localStorage.getItem('cortex_user') || '{}');
      if (cUser.name) userName = cUser.name.split(' ')[0];
    } catch (e) { /* ignore */ }

    // Count unpaid invoices
    var unpaidCount = 0;
    try {
      var invoices = JSON.parse(localStorage.getItem('cortex_saved_invoices') || '[]');
      invoices.forEach(function (inv) {
        var status = (inv.status || 'draft').toLowerCase();
        if (status !== 'paid') unpaidCount++;
      });
    } catch (e) { /* ignore */ }

    // Count new job matches (since last visit)
    var newJobCount = 0;
    try {
      var jobs = JSON.parse(localStorage.getItem('cortex_job_matches') || '[]');
      jobs.forEach(function (j) {
        if (j.date && new Date(j.date).getTime() > lastVisit) newJobCount++;
      });
      // If no dates, just count all as "new"
      if (newJobCount === 0 && jobs.length > 0) newJobCount = jobs.length;
    } catch (e) { /* ignore */ }

    // Build summary items
    var summaryParts = [];
    if (unpaidCount > 0) {
      summaryParts.push(unpaidCount + ' unpaid invoice' + (unpaidCount !== 1 ? 's' : ''));
    }
    if (newJobCount > 0) {
      summaryParts.push(newJobCount + ' new job match' + (newJobCount !== 1 ? 'es' : ''));
    }

    // Count tool uses since last visit
    var recentToolUses = 0;
    try {
      var history = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]');
      history.forEach(function (h) {
        if (h.date && new Date(h.date).getTime() > lastVisit) recentToolUses++;
      });
    } catch (e) { /* ignore */ }

    // Build message
    var msg = 'Welcome back, ' + userName + '! Last visit: ' + timeAgoStr + '.';
    if (summaryParts.length > 0) {
      msg += ' You have ' + summaryParts.join(' and ') + '.';
    }

    var banner = document.createElement('div');
    banner.className = 'welcome-back-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<div class="wb-inner">' +
        '<span class="wb-icon">&#128075;</span>' +
        '<div class="wb-content">' +
          '<strong>' + msg + '</strong>' +
          (summaryParts.length === 0 && recentToolUses === 0
            ? '<span class="wb-sub">Everything is up to date. <a href="/app/tools/">Explore tools</a></span>'
            : '') +
        '</div>' +
        '<button class="wb-close" aria-label="Dismiss">&times;</button>' +
      '</div>';

    // Styles
    if (!document.getElementById('welcomeBackStyles')) {
      var style = document.createElement('style');
      style.id = 'welcomeBackStyles';
      style.textContent =
        '.welcome-back-banner{background:linear-gradient(135deg,rgba(0,255,136,.1),rgba(68,136,255,.1));border:1px solid rgba(0,255,136,.25);border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.5rem;animation:wbSlideIn .4s ease}' +
        '.wb-inner{display:flex;align-items:center;gap:.75rem}' +
        '.wb-icon{font-size:1.5rem;flex-shrink:0}' +
        '.wb-content{flex:1;font-size:.95rem;color:var(--text1);line-height:1.5}' +
        '.wb-content a{color:var(--orange);text-decoration:underline}' +
        '.wb-sub{display:block;font-size:.85rem;color:var(--text3);margin-top:.25rem;font-weight:400}' +
        '.wb-close{background:none;border:none;color:var(--text3);font-size:1.25rem;cursor:pointer;padding:0 .25rem}' +
        '.wb-close:hover{color:var(--text1)}' +
        '@keyframes wbSlideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(style);
    }

    var greeting = document.querySelector('.dash-greeting');
    if (greeting && greeting.parentNode) {
      greeting.parentNode.insertBefore(banner, greeting.nextSibling);
    }

    banner.querySelector('.wb-close').addEventListener('click', function () {
      banner.style.animation = 'none';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-8px)';
      banner.style.transition = 'opacity .3s,transform .3s';
      setTimeout(function () { banner.remove(); }, 300);
      sessionStorage.setItem('cortex_wb_dismissed', '1');
    });
  }

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

  // ========== [523] ACTIVITY FEED ==========
  function feedTimeAgo(date) {
    var diff = Date.now() - date.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return mins + ' minutes ago';
    var hrs = Math.floor(mins / 60);
    if (hrs === 1) return '1 hour ago';
    if (hrs < 24) return hrs + ' hours ago';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 14) return 'last week';
    return date.toLocaleDateString();
  }

  function loadActivityFeed() {
    var section = document.getElementById('activityFeedSection');
    var container = document.getElementById('activityFeed');
    if (!section || !container) return;

    var items = [];

    // Pull from tool history
    var history = [];
    try { history = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]'); } catch (e) { /* ignore */ }

    var toolLabels = {
      'rate-calculator': { verb: 'Used Rate Calculator', icon: '&#128176;', color: '#ff8844' },
      'invoice': { verb: 'Created an invoice', icon: '&#128452;', color: '#4488ff' },
      'proposal': { verb: 'Drafted a proposal', icon: '&#128221;', color: '#aa66ff' },
      'scope-analyzer': { verb: 'Ran scope analysis', icon: '&#128203;', color: '#00ff88' },
      'contract-review': { verb: 'Reviewed a contract', icon: '&#128220;', color: '#ffcc00' },
      'fee-calculator': { verb: 'Calculated fees', icon: '&#128178;', color: '#ff8844' },
      'client-red-flags': { verb: 'Checked client red flags', icon: '&#9888;&#65039;', color: '#ff4466' },
      'tax-estimator': { verb: 'Estimated taxes', icon: '&#128178;', color: '#00cc88' },
      'email-writer': { verb: 'Wrote a client email', icon: '&#9993;&#65039;', color: '#4488ff' },
      'bio-generator': { verb: 'Generated a bio', icon: '&#128100;', color: '#aa66ff' },
      'payment-checker': { verb: 'Checked payment terms', icon: '&#128179;', color: '#ff8844' },
      'portfolio-review': { verb: 'Reviewed portfolio', icon: '&#127912;', color: '#ee66aa' },
      'time-tracker': { verb: 'Tracked time', icon: '&#9201;', color: '#00cc88' },
      'job-scanner': { verb: 'Scanned for jobs', icon: '&#128270;', color: '#4488ff' },
      'client-crm': { verb: 'Updated CRM', icon: '&#128101;', color: '#aa66ff' },
      'income-dashboard': { verb: 'Checked income dashboard', icon: '&#128200;', color: '#00ff88' },
      'meeting-notes': { verb: 'Took meeting notes', icon: '&#128221;', color: '#aa66ff' },
      'weekly-summary': { verb: 'Generated weekly summary', icon: '&#128202;', color: '#00cc88' },
      'project-tracker': { verb: 'Updated project tracker', icon: '&#128203;', color: '#00ff88' },
      'sow-generator': { verb: 'Generated a SOW', icon: '&#128196;', color: '#ffcc00' },
      'availability': { verb: 'Updated availability', icon: '&#128197;', color: '#4488ff' },
      'project-brief': { verb: 'Created a project brief', icon: '&#128196;', color: '#aa66ff' },
      'templates': { verb: 'Used a template', icon: '&#128195;', color: '#ff8844' }
    };

    // Track which tools are already in history
    var historyTools = {};

    history.forEach(function(h) {
      var toolKey = h.tool || 'unknown';
      historyTools[toolKey] = true;
      var meta = toolLabels[toolKey] || { verb: 'Used ' + toolKey.replace(/-/g, ' '), icon: '&#128736;', color: '#888' };
      items.push({
        text: meta.verb,
        detail: h.title || '',
        icon: meta.icon,
        color: meta.color,
        date: h.date ? new Date(h.date) : new Date(),
        type: 'tool'
      });
    });

    // Pull from cortex_tool_usage for tools not already in history
    if (window.cortexToolUsage) {
      var usage = window.cortexToolUsage.get();
      Object.keys(usage).forEach(function(toolKey) {
        if (historyTools[toolKey]) return;
        var entry = usage[toolKey];
        if (!entry.lastUsed) return;
        var meta = toolLabels[toolKey] || { verb: 'Used ' + toolKey.replace(/-/g, ' '), icon: '&#128736;', color: '#888' };
        items.push({
          text: meta.verb,
          detail: entry.count > 1 ? entry.count + ' times' : '',
          icon: meta.icon,
          color: meta.color,
          date: new Date(entry.lastUsed),
          type: 'tool'
        });
      });
    }

    // Pull from saved invoices
    try {
      var invoices = JSON.parse(localStorage.getItem('cortex_saved_invoices') || '[]');
      invoices.forEach(function(inv) {
        var client = inv.clientName || inv.client || '';
        var amount = inv.total || inv.amount;
        var detail = client ? client : '';
        if (amount) detail += (detail ? ' — ' : '') + (typeof amount === 'number' ? '$' + amount.toLocaleString() : amount);
        items.push({
          text: 'Created an invoice',
          detail: detail,
          icon: '&#128452;',
          color: '#4488ff',
          date: inv.date ? new Date(inv.date) : new Date(),
          type: 'invoice'
        });
      });
    } catch (e) { /* ignore */ }

    // Pull from saved proposals
    try {
      var proposals = JSON.parse(localStorage.getItem('cortex_saved_proposals') || '[]');
      proposals.forEach(function(p) {
        items.push({
          text: 'Drafted a proposal',
          detail: p.projectTitle || p.title || '',
          icon: '&#128221;',
          color: '#aa66ff',
          date: p.date ? new Date(p.date) : new Date(),
          type: 'proposal'
        });
      });
    } catch (e) { /* ignore */ }

    // Pull from saved scopes
    try {
      var scopes = JSON.parse(localStorage.getItem('cortex_saved_scopes') || '[]');
      scopes.forEach(function(s) {
        items.push({
          text: 'Saved a scope analysis',
          detail: s.name || '',
          icon: '&#128203;',
          color: '#00ff88',
          date: s.date ? new Date(s.date) : new Date(),
          type: 'scope'
        });
      });
    } catch (e) { /* ignore */ }

    // Pull from job scanner results
    try {
      var jobs = JSON.parse(localStorage.getItem('cortex_job_matches') || '[]');
      if (jobs.length > 0) {
        var latestJob = jobs[jobs.length - 1];
        items.push({
          text: 'New job matches found (' + jobs.length + ')',
          detail: '',
          icon: '&#128270;',
          color: '#4488ff',
          date: latestJob.date ? new Date(latestJob.date) : new Date(),
          type: 'jobs'
        });
      }
    } catch (e) { /* ignore */ }

    // Check saved rate
    var rate = localStorage.getItem('cortex_hourly_rate');
    if (rate) {
      items.push({
        text: 'Set hourly rate to $' + rate + '/hr',
        detail: '',
        icon: '&#128176;',
        color: '#ff8844',
        date: new Date(localStorage.getItem('cortex_rate_date') || Date.now()),
        type: 'rate'
      });
    }

    if (items.length === 0) return;

    // Deduplicate by keeping the latest entry per type+detail combo
    var seen = {};
    var unique = [];
    items.sort(function(a, b) { return b.date - a.date; });
    items.forEach(function(item) {
      var key = item.type + '::' + item.text + '::' + item.detail;
      if (!seen[key]) {
        seen[key] = true;
        unique.push(item);
      }
    });

    // Show max 8 items
    var feed = unique.slice(0, 8);

    section.style.display = '';
    container.innerHTML = feed.map(function(item) {
      var ago = feedTimeAgo(item.date);
      return '<div class="activity-feed-item">' +
        '<div class="af-icon" style="color:' + item.color + '">' + item.icon + '</div>' +
        '<div class="af-content">' +
          '<span class="af-text">You ' + item.text.charAt(0).toLowerCase() + item.text.slice(1) +
            (item.detail ? ' <span class="af-detail">' + item.detail + '</span>' : '') +
          '</span>' +
          '<span class="af-time">' + ago + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    // Inject styles once
    if (!document.getElementById('activityFeedStyles')) {
      var style = document.createElement('style');
      style.id = 'activityFeedStyles';
      style.textContent =
        '.activity-feed{display:flex;flex-direction:column;gap:.5rem}' +
        '.activity-feed-item{display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 1rem;background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:12px;transition:border-color .2s}' +
        '.activity-feed-item:hover{border-color:rgba(255,255,255,.12)}' +
        '.af-icon{font-size:1.2rem;flex-shrink:0;margin-top:.1rem}' +
        '.af-content{flex:1;display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;flex-wrap:wrap}' +
        '.af-text{font-size:.9rem;color:var(--text);line-height:1.5}' +
        '.af-detail{color:var(--text2);font-weight:600}' +
        '.af-time{font-size:.78rem;color:var(--text3);white-space:nowrap;flex-shrink:0}';
      document.head.appendChild(style);
    }
  }

  // ========== [528] PROGRESS TRACKING GAMIFICATION ==========
  function loadProgressTracker() {
    var section = document.getElementById('progressTracker');
    if (!section) return;

    // Don't show if user dismissed it
    if (localStorage.getItem('cortex_progress_dismissed') === '1') return;

    var steps = [
      {
        key: 'profile',
        label: 'Create profile',
        check: function () {
          try {
            var u = JSON.parse(localStorage.getItem('cortex_firebase_user') || '{}');
            return !!(u.displayName || u.email);
          } catch (e) { return false; }
        },
        link: '/app/onboarding'
      },
      {
        key: 'first-tool',
        label: 'Use first tool',
        check: function () {
          try {
            var h = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]');
            return h.length > 0;
          } catch (e) { return false; }
        },
        link: '/app/tools/'
      },
      {
        key: 'invoice',
        label: 'Generate invoice',
        check: function () {
          try {
            var inv = JSON.parse(localStorage.getItem('cortex_saved_invoices') || '[]');
            return inv.length > 0;
          } catch (e) { return false; }
        },
        link: '/app/tools/invoice'
      },
      {
        key: 'rate',
        label: 'Set hourly rate',
        check: function () {
          return !!localStorage.getItem('cortex_hourly_rate');
        },
        link: '/app/tools/rate-calculator'
      },
      {
        key: 'client',
        label: 'Add first client',
        check: function () {
          try {
            var clients = JSON.parse(localStorage.getItem('cortex_crm_clients') || '[]');
            return clients.length > 0;
          } catch (e) { return false; }
        },
        link: '/app/tools/client-crm'
      }
    ];

    var completed = 0;
    steps.forEach(function (s) {
      s.done = s.check();
      if (s.done) completed++;
    });

    // Hide if all complete
    if (completed === steps.length) return;

    var pct = Math.round((completed / steps.length) * 100);

    section.style.display = '';
    var pctEl = document.getElementById('progressPercent');
    if (pctEl) pctEl.textContent = pct + '% complete';
    var barEl = document.getElementById('progressBar');
    if (barEl) barEl.style.width = pct + '%';

    var stepsEl = document.getElementById('progressSteps');
    if (!stepsEl) return;
    stepsEl.innerHTML = steps.map(function (s) {
      var check = s.done
        ? '<span style="color:var(--green);font-weight:700;font-size:1rem">&#10003;</span>'
        : '<span style="color:var(--text3);font-size:1rem">&#9675;</span>';
      var labelStyle = s.done
        ? 'color:var(--text3);text-decoration:line-through'
        : 'color:var(--text)';
      var actionLink = s.done
        ? ''
        : ' <a href="' + s.link + '" style="color:var(--orange);font-size:.8rem;font-weight:600;margin-left:.5rem">Start &rarr;</a>';
      return '<div style="display:flex;align-items:center;gap:.75rem">' +
        check +
        '<span style="font-size:.9rem;' + labelStyle + '">' + s.label + '</span>' +
        actionLink +
      '</div>';
    }).join('');

    // Dismiss handler
    var dismissBtn = document.getElementById('progressDismiss');
    if (dismissBtn) dismissBtn.addEventListener('click', function () {
      section.style.display = 'none';
      localStorage.setItem('cortex_progress_dismissed', '1');
    });
  }

  // ========== [529] SMART TOOL RECOMMENDATIONS ==========
  function loadSmartRecommendations() {
    var container = document.getElementById('smartRecommendations');
    if (!container) return;

    // Gather usage data
    var history = [];
    try { history = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]'); } catch (e) { /* ignore */ }

    var usedTools = {};
    history.forEach(function (h) { if (h.tool) usedTools[h.tool] = true; });

    // Also check cortex_tool_usage
    if (window.cortexToolUsage) {
      var usage = window.cortexToolUsage.get();
      Object.keys(usage).forEach(function (k) { usedTools[k] = true; });
    }

    // Check saved data as implicit tool usage
    try {
      if (JSON.parse(localStorage.getItem('cortex_saved_invoices') || '[]').length > 0) usedTools['invoice'] = true;
    } catch (e) { /* ignore */ }
    try {
      if (JSON.parse(localStorage.getItem('cortex_saved_proposals') || '[]').length > 0) usedTools['proposal'] = true;
    } catch (e) { /* ignore */ }
    try {
      if (JSON.parse(localStorage.getItem('cortex_saved_scopes') || '[]').length > 0) usedTools['scope-analyzer'] = true;
    } catch (e) { /* ignore */ }
    try {
      if (JSON.parse(localStorage.getItem('cortex_crm_clients') || '[]').length > 0) usedTools['client-crm'] = true;
    } catch (e) { /* ignore */ }
    if (localStorage.getItem('cortex_hourly_rate')) usedTools['rate-calculator'] = true;

    // No usage yet — don't show recommendations (activation nudge handles this)
    if (Object.keys(usedTools).length === 0) return;

    // Define recommendation rules: if user did X but not Y, suggest Y
    var rules = [
      {
        condition: function () { return usedTools['invoice'] && !usedTools['payment-checker']; },
        icon: '&#128179;', color: '#ff8844',
        text: 'Track your invoice payments',
        link: '/app/tools/payment-checker'
      },
      {
        condition: function () { return usedTools['job-scanner'] && !usedTools['proposal']; },
        icon: '&#128221;', color: '#aa66ff',
        text: 'Write a winning proposal',
        link: '/app/tools/proposal'
      },
      {
        condition: function () { return usedTools['proposal'] && !usedTools['contract-review']; },
        icon: '&#128220;', color: '#ffcc00',
        text: 'Review your contract before signing',
        link: '/app/tools/contract-review'
      },
      {
        condition: function () { return usedTools['rate-calculator'] && !usedTools['fee-calculator']; },
        icon: '&#128178;', color: '#ff8844',
        text: 'Compare platform fees for your rate',
        link: '/app/tools/fee-calculator'
      },
      {
        condition: function () { return usedTools['invoice'] && !usedTools['tax-estimator']; },
        icon: '&#128178;', color: '#00cc88',
        text: 'Estimate your tax obligations',
        link: '/app/tools/tax-estimator'
      },
      {
        condition: function () { return usedTools['client-crm'] && !usedTools['email-writer']; },
        icon: '&#9993;&#65039;', color: '#4488ff',
        text: 'Draft a professional client email',
        link: '/app/tools/email-writer'
      },
      {
        condition: function () { return usedTools['proposal'] && !usedTools['scope-analyzer']; },
        icon: '&#128203;', color: '#00ff88',
        text: 'Analyze scope before committing',
        link: '/app/tools/scope-analyzer'
      },
      {
        condition: function () { return usedTools['scope-analyzer'] && !usedTools['sow-generator']; },
        icon: '&#128196;', color: '#ffcc00',
        text: 'Generate a statement of work',
        link: '/app/tools/sow-generator'
      },
      {
        condition: function () { return usedTools['invoice'] && !usedTools['income-dashboard']; },
        icon: '&#128200;', color: '#00ff88',
        text: 'See your income at a glance',
        link: '/app/tools/income-dashboard'
      },
      {
        condition: function () { return (usedTools['time-tracker'] || usedTools['project-tracker']) && !usedTools['weekly-summary']; },
        icon: '&#128202;', color: '#00cc88',
        text: 'Generate your weekly summary',
        link: '/app/tools/weekly-summary'
      },
      {
        condition: function () { return !usedTools['bio-generator'] && Object.keys(usedTools).length >= 3; },
        icon: '&#128100;', color: '#aa66ff',
        text: 'Create a standout freelancer bio',
        link: '/app/tools/bio-generator'
      },
      {
        condition: function () { return usedTools['job-scanner'] && !usedTools['client-red-flags']; },
        icon: '&#9888;&#65039;', color: '#ff4466',
        text: 'Check client red flags before applying',
        link: '/app/tools/client-red-flags'
      }
    ];

    var recommendations = [];
    rules.forEach(function (rule) {
      if (rule.condition()) recommendations.push(rule);
    });

    // Show max 3 recommendations
    recommendations = recommendations.slice(0, 3);
    if (recommendations.length === 0) return;

    container.style.display = '';
    var list = container.querySelector('.smart-reco-list');
    if (!list) return;

    list.innerHTML = recommendations.map(function (r) {
      return '<a href="' + r.link + '" class="smart-reco-card">' +
        '<span class="smart-reco-icon" style="color:' + r.color + '">' + r.icon + '</span>' +
        '<span class="smart-reco-text">' + r.text + ' &rarr;</span>' +
      '</a>';
    }).join('');

    // Inject styles once
    if (!document.getElementById('smartRecoStyles')) {
      var style = document.createElement('style');
      style.id = 'smartRecoStyles';
      style.textContent =
        '.smart-reco-list{display:flex;gap:.75rem;flex-wrap:wrap}' +
        '.smart-reco-card{display:flex;align-items:center;gap:.6rem;padding:.75rem 1.1rem;background:linear-gradient(135deg,rgba(255,136,68,.08),rgba(170,102,255,.08));border:1px solid rgba(255,136,68,.2);border-radius:12px;text-decoration:none;color:var(--text);font-size:.9rem;transition:border-color .2s,transform .15s}' +
        '.smart-reco-card:hover{border-color:rgba(255,136,68,.5);transform:translateY(-1px)}' +
        '.smart-reco-icon{font-size:1.2rem;flex-shrink:0}' +
        '.smart-reco-text{font-weight:600;white-space:nowrap}' +
        '@media(max-width:768px){.smart-reco-list{flex-direction:column}.smart-reco-text{white-space:normal}}';
      document.head.appendChild(style);
    }
  }

  // ========== INIT ==========
  updateGreeting();
  showWelcomeBack();
  loadActivityFeed();
  loadRecentActivity();
  loadSavedItems();
  loadSavedAnalyses();
  loadSavedInvoices();
  loadSavedProposals();
  loadPersonalAnalytics();
  loadProgressTracker();
  loadSmartRecommendations();
})();
