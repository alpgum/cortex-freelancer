/**
 * [CF-062] Competitor Profile Tracker
 * Monitor top 5 competitors — track profiles, get alerts when they change
 * rates, skills, or availability. Enhanced with polling, alert notifications,
 * trend analysis, and dashboard rendering.
 *
 * Persists to localStorage key: 'cortex_competitor_profiles'
 * Exposed on window.CortexFreelancer.CompetitorTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_competitor_profiles';
  var ALERTS_KEY = 'cortex_competitor_alerts';
  var MAX_COMPETITORS = 5;
  var POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  var pollTimer = null;

  // ─── Persistence helpers ────────────────────────────────────────────

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted data, reset */ }
    return { competitors: {}, changeLog: [] };
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[CompetitorTracker] localStorage write failed:', e);
    }
  }

  function _loadAlerts() {
    try {
      var raw = localStorage.getItem(ALERTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return [];
  }

  function _saveAlerts(alerts) {
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    } catch (e) { /* ignore */ }
  }

  function _generateId() {
    return 'comp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  // ─── Core CRUD ──────────────────────────────────────────────────────

  function addCompetitor(profile) {
    if (!profile || !profile.name) {
      throw new Error('Competitor name is required');
    }
    var data = _load();
    var count = Object.keys(data.competitors).length;
    if (count >= MAX_COMPETITORS) {
      throw new Error('Maximum ' + MAX_COMPETITORS + ' competitors allowed. Remove one first.');
    }

    var id = _generateId();
    var now = new Date().toISOString();

    var competitor = {
      id: id,
      name: profile.name,
      url: profile.url || '',
      rate: profile.rate || null,
      skills: profile.skills || [],
      jss: profile.jss || null,
      availability: profile.availability || 'unknown',
      earnings: profile.earnings || null,
      category: profile.category || '',
      createdAt: now,
      updatedAt: now,
      history: [{
        timestamp: now,
        type: 'created',
        snapshot: {
          rate: profile.rate || null,
          skills: (profile.skills || []).slice(),
          jss: profile.jss || null,
          availability: profile.availability || 'unknown'
        }
      }]
    };

    data.competitors[id] = competitor;
    _save(data);
    return { id: id, competitor: competitor };
  }

  function updateCompetitor(id, newData) {
    if (!id || !newData) return null;

    var data = _load();
    var comp = data.competitors[id];
    if (!comp) return null;

    var now = new Date().toISOString();
    var changes = [];
    var trackFields = ['rate', 'skills', 'jss', 'availability'];

    trackFields.forEach(function (field) {
      if (newData[field] === undefined) return;
      var oldVal = comp[field];
      var newVal = newData[field];
      var changed = false;
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        changed = oldVal.length !== newVal.length ||
                  oldVal.some(function (v, i) { return v !== newVal[i]; });
      } else {
        changed = oldVal !== newVal;
      }
      if (changed) {
        changes.push({
          field: field,
          oldValue: Array.isArray(oldVal) ? oldVal.slice() : oldVal,
          newValue: Array.isArray(newVal) ? newVal.slice() : newVal
        });
      }
    });

    Object.keys(newData).forEach(function (key) {
      comp[key] = newData[key];
    });
    comp.updatedAt = now;

    if (changes.length > 0) {
      var historyEntry = {
        timestamp: now,
        type: 'updated',
        changes: changes,
        snapshot: {
          rate: comp.rate,
          skills: (comp.skills || []).slice(),
          jss: comp.jss,
          availability: comp.availability
        }
      };
      comp.history.push(historyEntry);

      data.changeLog.push({
        competitorId: id,
        competitorName: comp.name,
        timestamp: now,
        changes: changes
      });

      // Generate alerts for significant changes
      _generateAlerts(comp, changes, now);
    }

    data.competitors[id] = comp;
    _save(data);
    return comp;
  }

  function removeCompetitor(id) {
    var data = _load();
    if (!data.competitors[id]) return false;
    delete data.competitors[id];
    data.changeLog = data.changeLog.filter(function (entry) {
      return entry.competitorId !== id;
    });
    _save(data);
    return true;
  }

  function getCompetitors() {
    var data = _load();
    return Object.keys(data.competitors).map(function (id) {
      return data.competitors[id];
    });
  }

  function getCompetitor(id) {
    var data = _load();
    return data.competitors[id] || null;
  }

  function getChanges(competitorId) {
    var data = _load();
    var comp = data.competitors[competitorId];
    if (!comp) return [];
    return comp.history || [];
  }

  // ─── Alert System ───────────────────────────────────────────────────

  function _generateAlerts(comp, changes, timestamp) {
    var alerts = _loadAlerts();
    changes.forEach(function (change) {
      var severity = 'info';
      var message = '';

      if (change.field === 'rate') {
        var diff = (change.newValue || 0) - (change.oldValue || 0);
        if (diff < 0) {
          severity = 'warning';
          message = comp.name + ' lowered rate from $' + change.oldValue + ' to $' + change.newValue + '/hr';
        } else {
          severity = 'info';
          message = comp.name + ' raised rate from $' + change.oldValue + ' to $' + change.newValue + '/hr';
        }
      } else if (change.field === 'skills') {
        var added = (change.newValue || []).filter(function (s) {
          return (change.oldValue || []).indexOf(s) === -1;
        });
        var removed = (change.oldValue || []).filter(function (s) {
          return (change.newValue || []).indexOf(s) === -1;
        });
        if (added.length) message = comp.name + ' added skills: ' + added.join(', ');
        if (removed.length) message += (message ? '. ' : comp.name) + ' removed skills: ' + removed.join(', ');
        severity = added.length > 2 ? 'warning' : 'info';
      } else if (change.field === 'availability') {
        message = comp.name + ' changed availability: ' + change.oldValue + ' → ' + change.newValue;
        severity = change.newValue === 'available' ? 'warning' : 'info';
      } else if (change.field === 'jss') {
        message = comp.name + ' JSS changed: ' + change.oldValue + ' → ' + change.newValue;
        severity = (change.newValue || 0) > (change.oldValue || 0) ? 'warning' : 'info';
      }

      if (message) {
        alerts.unshift({
          id: 'alert_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
          competitorId: comp.id,
          competitorName: comp.name,
          field: change.field,
          severity: severity,
          message: message,
          timestamp: timestamp,
          read: false
        });
      }
    });

    // Keep last 50 alerts
    if (alerts.length > 50) alerts = alerts.slice(0, 50);
    _saveAlerts(alerts);
  }

  function getAlerts(opts) {
    var alerts = _loadAlerts();
    if (opts && opts.unreadOnly) {
      alerts = alerts.filter(function (a) { return !a.read; });
    }
    if (opts && opts.competitorId) {
      alerts = alerts.filter(function (a) { return a.competitorId === opts.competitorId; });
    }
    return alerts;
  }

  function markAlertRead(alertId) {
    var alerts = _loadAlerts();
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i].id === alertId) {
        alerts[i].read = true;
        _saveAlerts(alerts);
        return true;
      }
    }
    return false;
  }

  function markAllAlertsRead() {
    var alerts = _loadAlerts();
    alerts.forEach(function (a) { a.read = true; });
    _saveAlerts(alerts);
  }

  // ─── Trend Analysis ─────────────────────────────────────────────────

  function getCompetitorTrends(competitorId) {
    var data = _load();
    var comp = data.competitors[competitorId];
    if (!comp || !comp.history || comp.history.length < 2) return null;

    var rateHistory = [];
    var jssHistory = [];
    var skillCountHistory = [];

    comp.history.forEach(function (entry) {
      if (entry.snapshot) {
        if (entry.snapshot.rate != null) {
          rateHistory.push({ date: entry.timestamp, value: entry.snapshot.rate });
        }
        if (entry.snapshot.jss != null) {
          jssHistory.push({ date: entry.timestamp, value: entry.snapshot.jss });
        }
        if (entry.snapshot.skills) {
          skillCountHistory.push({ date: entry.timestamp, value: entry.snapshot.skills.length });
        }
      }
    });

    function trend(arr) {
      if (arr.length < 2) return 'stable';
      var first = arr[0].value;
      var last = arr[arr.length - 1].value;
      var diff = last - first;
      if (diff > 0) return 'increasing';
      if (diff < 0) return 'decreasing';
      return 'stable';
    }

    return {
      rateTrend: trend(rateHistory),
      rateHistory: rateHistory,
      jssTrend: trend(jssHistory),
      jssHistory: jssHistory,
      skillGrowth: trend(skillCountHistory),
      skillCountHistory: skillCountHistory,
      totalChanges: comp.history.length - 1
    };
  }

  // ─── Comparison ─────────────────────────────────────────────────────

  function compareWithUser(userProfile) {
    if (!userProfile) return [];

    var competitors = getCompetitors();
    var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase(); });
    var userRate = userProfile.rate || 0;
    var userJSS = userProfile.jss || 0;

    return competitors.map(function (comp) {
      var compSkills = (comp.skills || []).map(function (s) { return s.toLowerCase(); });

      var overlap = userSkills.filter(function (s) { return compSkills.indexOf(s) !== -1; });
      var onlyCompetitor = compSkills.filter(function (s) { return userSkills.indexOf(s) === -1; });
      var onlyUser = userSkills.filter(function (s) { return compSkills.indexOf(s) === -1; });

      var compRate = comp.rate || 0;
      var rateDiff = userRate - compRate;
      var rateLabel = rateDiff > 5 ? 'You charge more'
                    : rateDiff < -5 ? 'They charge more'
                    : 'Similar rates';

      var compJSS = comp.jss || 0;
      var jssGap = userJSS - compJSS;
      var jssLabel = jssGap > 5 ? 'Your JSS is higher'
                   : jssGap < -5 ? 'Their JSS is higher'
                   : 'Similar JSS';

      var threatScore = 0;
      if (compRate < userRate && compRate > 0) threatScore++;
      if (compJSS > userJSS) threatScore++;
      if (overlap.length > userSkills.length * 0.5) threatScore++;
      var threatLevel = threatScore >= 2 ? 'high'
                      : threatScore === 1 ? 'medium'
                      : 'low';

      return {
        competitor: comp,
        rateDifference: rateDiff,
        rateLabel: rateLabel,
        skillOverlap: overlap,
        skillsOnlyCompetitor: onlyCompetitor,
        skillsOnlyUser: onlyUser,
        jssGap: jssGap,
        jssLabel: jssLabel,
        threatLevel: threatLevel,
        trends: getCompetitorTrends(comp.id)
      };
    });
  }

  // ─── Polling ────────────────────────────────────────────────────────

  function startPolling(fetchCallback, intervalMs) {
    stopPolling();
    var interval = intervalMs || POLL_INTERVAL_MS;

    function poll() {
      var competitors = getCompetitors();
      competitors.forEach(function (comp) {
        if (typeof fetchCallback === 'function') {
          fetchCallback(comp, function (freshData) {
            if (freshData) updateCompetitor(comp.id, freshData);
          });
        }
      });
    }

    poll(); // immediate first poll
    pollTimer = setInterval(poll, interval);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────────

  function renderDashboard(containerId, userProfile) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var competitors = getCompetitors();
    var alerts = getAlerts({ unreadOnly: true });
    var comparisons = userProfile ? compareWithUser(userProfile) : [];

    var html = '<div class="ct-dashboard">';

    // Alert banner
    if (alerts.length > 0) {
      html += '<div class="ct-alert-banner" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;margin-bottom:16px;">';
      html += '<strong>' + alerts.length + ' new alert' + (alerts.length > 1 ? 's' : '') + '</strong>';
      alerts.slice(0, 3).forEach(function (a) {
        var icon = a.severity === 'warning' ? '⚠️' : 'ℹ️';
        html += '<div style="margin-top:6px;font-size:13px;">' + icon + ' ' + _esc(a.message) + '</div>';
      });
      html += '</div>';
    }

    // Competitor cards
    if (competitors.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:#6b7280;">';
      html += '<p>No competitors tracked yet. Add up to ' + MAX_COMPETITORS + ' competitors to monitor.</p>';
      html += '</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">';
      competitors.forEach(function (comp, i) {
        var comparison = comparisons[i];
        var threatColor = !comparison ? '#6b7280'
          : comparison.threatLevel === 'high' ? '#ef4444'
          : comparison.threatLevel === 'medium' ? '#f59e0b'
          : '#10b981';

        html += '<div class="ct-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;border-left:4px solid ' + threatColor + ';">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html += '<strong style="font-size:15px;">' + _esc(comp.name) + '</strong>';
        if (comparison) {
          html += '<span style="font-size:11px;background:' + threatColor + ';color:#fff;padding:2px 8px;border-radius:12px;">' + comparison.threatLevel + ' threat</span>';
        }
        html += '</div>';

        if (comp.rate) html += '<div style="font-size:13px;color:#374151;">Rate: $' + comp.rate + '/hr</div>';
        if (comp.jss) html += '<div style="font-size:13px;color:#374151;">JSS: ' + comp.jss + '%</div>';
        if (comp.availability) html += '<div style="font-size:13px;color:#374151;">Status: ' + _esc(comp.availability) + '</div>';
        if (comp.skills && comp.skills.length) {
          html += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">';
          comp.skills.slice(0, 5).forEach(function (s) {
            html += '<span style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px;">' + _esc(s) + '</span>';
          });
          if (comp.skills.length > 5) html += '<span style="font-size:11px;color:#9ca3af;">+' + (comp.skills.length - 5) + '</span>';
          html += '</div>';
        }

        var trends = getCompetitorTrends(comp.id);
        if (trends) {
          html += '<div style="margin-top:8px;font-size:11px;color:#6b7280;">';
          html += 'Rate: ' + _trendIcon(trends.rateTrend) + ' • JSS: ' + _trendIcon(trends.jssTrend) + ' • ' + trends.totalChanges + ' change' + (trends.totalChanges !== 1 ? 's' : '');
          html += '</div>';
        }

        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function _trendIcon(trend) {
    if (trend === 'increasing') return '↑';
    if (trend === 'decreasing') return '↓';
    return '→';
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    console.log('[CompetitorTracker] Initialized — tracking up to ' + MAX_COMPETITORS + ' competitors');
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.CompetitorTracker = {
    init: init,
    addCompetitor: addCompetitor,
    updateCompetitor: updateCompetitor,
    removeCompetitor: removeCompetitor,
    getCompetitors: getCompetitors,
    getCompetitor: getCompetitor,
    getChanges: getChanges,
    compareWithUser: compareWithUser,
    getAlerts: getAlerts,
    markAlertRead: markAlertRead,
    markAllAlertsRead: markAllAlertsRead,
    getCompetitorTrends: getCompetitorTrends,
    startPolling: startPolling,
    stopPolling: stopPolling,
    renderDashboard: renderDashboard
  };

  // Legacy compat
  window.CortexFreelancer.competitorTracker = window.CortexFreelancer.CompetitorTracker;
})();
