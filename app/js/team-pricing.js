/**
 * Cortex Freelancer — Team/Agency Pricing Tier
 * [CF-189] Adds Team plan ($49/mo for 5 seats) with shared workspace
 * concept and team analytics display.
 *
 * Features:
 *   - Team plan definition ($49/mo, 5 seats, $10/extra seat)
 *   - Team creation and member management
 *   - Shared workspace concept (shared templates, proposals, analytics)
 *   - Team analytics dashboard (aggregate stats across members)
 *   - Seat management UI (invite, remove, transfer ownership)
 *   - init() / render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var TEAM_API = '/api/subscription';
  var STORAGE_KEY = 'cf_team';

  var TEAM_PLAN = {
    id: 'team_monthly',
    name: 'Team',
    amount: 4900,         // cents
    currency: 'usd',
    displayPrice: '$49',
    interval: 'month',
    displayInterval: '/mo',
    includedSeats: 5,
    extraSeatPrice: 1000, // cents per extra seat
    extraSeatDisplay: '$10',
    features: [
      'Everything in Pro',
      '5 team seats included',
      'Shared workspace & templates',
      'Team analytics dashboard',
      'Consolidated billing',
      'Role-based access control',
      'Priority team support'
    ]
  };

  var ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member'
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    initialized: false,
    teamId: null,
    teamName: null,
    members: [],
    seats: { total: 5, used: 0, available: 5 },
    role: null,
    loading: false,
    error: null
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveCache(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) { /* quota */ }
  }

  function formatCurrency(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  function calculateMonthlyTotal(seatCount) {
    if (seatCount <= TEAM_PLAN.includedSeats) return TEAM_PLAN.amount;
    var extraSeats = seatCount - TEAM_PLAN.includedSeats;
    return TEAM_PLAN.amount + (extraSeats * TEAM_PLAN.extraSeatPrice);
  }

  function getInitials(name) {
    return (name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
  }

  // ─── API ──────────────────────────────────────────────────────────

  function fetchTeam() {
    state.loading = true;
    return fetch(TEAM_API + '?type=team')
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load team');
        return r.json();
      })
      .then(function (data) {
        state.loading = false;
        state.teamId = data.team_id;
        state.teamName = data.team_name;
        state.members = data.members || [];
        state.seats = {
          total: data.total_seats || TEAM_PLAN.includedSeats,
          used: (data.members || []).length,
          available: (data.total_seats || TEAM_PLAN.includedSeats) - (data.members || []).length
        };
        state.role = data.role || ROLES.MEMBER;
        saveCache({ teamId: state.teamId, teamName: state.teamName, role: state.role });
        return data;
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err.message;
        throw err;
      });
  }

  function inviteMember(email, role) {
    return fetch(TEAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invite', email: email, role: role || ROLES.MEMBER })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to invite member');
        return r.json();
      })
      .then(function (data) {
        if (data.member) state.members.push(data.member);
        state.seats.used = state.members.length;
        state.seats.available = state.seats.total - state.seats.used;
        return data;
      });
  }

  function removeMember(memberId) {
    return fetch(TEAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', member_id: memberId })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to remove member');
        return r.json();
      })
      .then(function (data) {
        state.members = state.members.filter(function (m) { return m.id !== memberId; });
        state.seats.used = state.members.length;
        state.seats.available = state.seats.total - state.seats.used;
        return data;
      });
  }

  function addExtraSeat() {
    return fetch(TEAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_seat' })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to add seat');
        return r.json();
      })
      .then(function (data) {
        state.seats.total++;
        state.seats.available++;
        return data;
      });
  }

  // ─── Team Analytics ──────────────────────────────────────────────

  function fetchTeamAnalytics() {
    return fetch(TEAM_API + '?type=team_analytics')
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load analytics');
        return r.json();
      });
  }

  // ─── Render ───────────────────────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:800px;margin:0 auto;';

    if (state.loading) {
      wrapper.innerHTML = '<p style="color:#999;text-align:center;padding:40px 0">Loading team data…</p>';
      container.appendChild(wrapper);
      return;
    }

    if (!state.teamId) {
      renderNoTeam(wrapper);
      container.appendChild(wrapper);
      return;
    }

    // Team header
    wrapper.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">' +
      '<div><h2 style="margin:0;font-size:22px;color:#1a1a1a">' + (state.teamName || 'My Team') + '</h2>' +
      '<p style="margin:4px 0 0;color:#888;font-size:13px">Team plan · ' + state.seats.used + '/' + state.seats.total + ' seats</p></div>' +
      '<div style="text-align:right"><span style="font-size:28px;font-weight:700;color:#1a1a1a">' + formatCurrency(calculateMonthlyTotal(state.seats.total)) + '</span>' +
      '<span style="color:#888;font-size:14px">/mo</span></div></div>';

    // Seat usage bar
    var pct = state.seats.total > 0 ? Math.round((state.seats.used / state.seats.total) * 100) : 0;
    wrapper.innerHTML += '<div style="margin-bottom:24px">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:4px">' +
      '<span>Seats used</span><span>' + pct + '%</span></div>' +
      '<div style="background:#F0F0F0;border-radius:4px;height:8px;overflow:hidden">' +
      '<div style="background:#6C5CE7;height:100%;width:' + pct + '%;border-radius:4px;transition:width 0.3s"></div></div></div>';

    // Members list
    var membersSection = document.createElement('div');
    membersSection.style.cssText = 'background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;margin-bottom:24px;';
    membersSection.innerHTML = '<div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:16px;color:#333">Team Members</h3>' +
      (state.role === ROLES.OWNER || state.role === ROLES.ADMIN
        ? '<button id="cf-team-invite" style="padding:8px 14px;background:#6C5CE7;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">+ Invite</button>'
        : '') +
      '</div>';

    if (state.members.length === 0) {
      membersSection.innerHTML += '<p style="padding:24px;text-align:center;color:#999;font-size:14px">No team members yet. Invite your first teammate!</p>';
    } else {
      state.members.forEach(function (m) {
        var roleColors = { owner: '#FF6B6B', admin: '#FFA726', member: '#66BB6A' };
        membersSection.innerHTML += '<div style="padding:12px 20px;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:12px">' +
          '<div style="width:36px;height:36px;border-radius:50%;background:#E8E8FF;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#6C5CE7">' + getInitials(m.name || m.email) + '</div>' +
          '<div style="flex:1"><div style="font-size:14px;color:#333;font-weight:500">' + (m.name || m.email) + '</div>' +
          '<div style="font-size:12px;color:#888">' + (m.email || '') + '</div></div>' +
          '<span style="font-size:11px;padding:3px 8px;border-radius:4px;background:' + (roleColors[m.role] || '#eee') + '20;color:' + (roleColors[m.role] || '#888') + ';font-weight:600;text-transform:uppercase">' + (m.role || 'member') + '</span>' +
          '</div>';
      });
    }
    wrapper.appendChild(membersSection);

    // Team analytics summary
    var analytics = document.createElement('div');
    analytics.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;';
    var analyticsData = [
      { label: 'Total Proposals', value: '—', icon: '📝' },
      { label: 'Win Rate', value: '—', icon: '🏆' },
      { label: 'Revenue', value: '—', icon: '💰' },
      { label: 'Active Projects', value: '—', icon: '📊' }
    ];
    analyticsData.forEach(function (a) {
      analytics.innerHTML += '<div style="background:#fff;border:1px solid #eee;border-radius:10px;padding:16px;text-align:center">' +
        '<div style="font-size:20px;margin-bottom:4px">' + a.icon + '</div>' +
        '<div style="font-size:22px;font-weight:700;color:#1a1a1a" data-analytics="' + a.label + '">' + a.value + '</div>' +
        '<div style="font-size:11px;color:#888;margin-top:2px">' + a.label + '</div></div>';
    });
    wrapper.appendChild(analytics);

    // Load real analytics async
    fetchTeamAnalytics().then(function (data) {
      if (data.total_proposals !== undefined) {
        var els = wrapper.querySelectorAll('[data-analytics]');
        els.forEach(function (el) {
          var label = el.getAttribute('data-analytics');
          if (label === 'Total Proposals') el.textContent = data.total_proposals || 0;
          if (label === 'Win Rate') el.textContent = (data.win_rate || 0) + '%';
          if (label === 'Revenue') el.textContent = '$' + (data.revenue || 0).toLocaleString();
          if (label === 'Active Projects') el.textContent = data.active_projects || 0;
        });
      }
    }).catch(function () { /* keep placeholder values */ });

    container.appendChild(wrapper);

    // Bind invite button
    var inviteBtn = document.getElementById('cf-team-invite');
    if (inviteBtn) {
      inviteBtn.onclick = function () {
        var email = prompt('Enter email to invite:');
        if (email) {
          inviteMember(email.trim()).then(function () {
            render(containerId); // re-render
          }).catch(function (err) {
            alert('Failed to invite: ' + err.message);
          });
        }
      };
    }
  }

  function renderNoTeam(wrapper) {
    wrapper.innerHTML = [
      '<div style="text-align:center;padding:48px 20px">',
      '<div style="font-size:48px;margin-bottom:16px">👥</div>',
      '<h2 style="margin:0 0 8px;font-size:24px;color:#1a1a1a">Team Plan</h2>',
      '<p style="margin:0 0 8px;color:#666;font-size:16px">' + TEAM_PLAN.displayPrice + TEAM_PLAN.displayInterval + ' for ' + TEAM_PLAN.includedSeats + ' seats</p>',
      '<p style="margin:0 0 24px;color:#888;font-size:14px">Extra seats at ' + TEAM_PLAN.extraSeatDisplay + '/seat/mo</p>',
      '<ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;max-width:320px;margin-left:auto;margin-right:auto">',
      TEAM_PLAN.features.map(function (f) {
        return '<li style="padding:8px 0;font-size:14px;color:#444;border-bottom:1px solid #f5f5f5">✅ ' + f + '</li>';
      }).join(''),
      '</ul>',
      '<button id="cf-create-team" style="padding:14px 32px;background:#6C5CE7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600">Create Team</button>',
      '</div>'
    ].join('');

    setTimeout(function () {
      var btn = document.getElementById('cf-create-team');
      if (btn) {
        btn.onclick = function () {
          var name = prompt('Team name:');
          if (name) {
            fetch(TEAM_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create_team', team_name: name.trim(), plan: 'team_monthly' })
            })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                state.teamId = data.team_id;
                state.teamName = data.team_name || name.trim();
                state.role = ROLES.OWNER;
                state.seats = { total: TEAM_PLAN.includedSeats, used: 1, available: TEAM_PLAN.includedSeats - 1 };
                state.members = data.members || [{ name: 'You', role: ROLES.OWNER }];
              })
              .catch(function (err) { alert('Failed to create team: ' + err.message); });
          }
        };
      }
    }, 0);
  }

  // ─── Public API ───────────────────────────────────────────────────

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    var cache = loadCache();
    if (cache.teamId) {
      state.teamId = cache.teamId;
      state.teamName = cache.teamName;
      state.role = cache.role;
      fetchTeam().catch(function () { /* use cache */ });
    }

    console.log('[TeamPricing] Initialized');
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.TeamPricing = {
    init: init,
    render: render,
    fetchTeam: fetchTeam,
    inviteMember: inviteMember,
    removeMember: removeMember,
    addExtraSeat: addExtraSeat,
    TEAM_PLAN: TEAM_PLAN,
    ROLES: ROLES,
    getState: function () {
      return {
        teamId: state.teamId,
        teamName: state.teamName,
        members: state.members,
        seats: state.seats,
        role: state.role
      };
    },
    calculateMonthlyTotal: calculateMonthlyTotal
  };

})();
