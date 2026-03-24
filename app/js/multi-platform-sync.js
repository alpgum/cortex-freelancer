/**
 * Cortex Freelancer — Multi-Platform Profile Sync
 * [CF-079] Import profile data from Upwork + Fiverr + Freelancer.com
 * for unified analysis.
 *
 * Features:
 *   - Platform-specific data normalizers (Upwork, Fiverr, Freelancer.com)
 *   - Unified profile schema for cross-platform analysis
 *   - Skills merge with cross-platform deduplication
 *   - Aggregated metrics (ratings, reviews, earnings, jobs)
 *   - Auto-generated insights and actionable recommendations
 *   - Manual JSON import and URL-based platform detection
 *   - Platform comparison matrix
 *   - Import/export for backup
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_multi_platform';
  var SYNC_LOG_KEY = 'cf_sync_log';

  var PLATFORMS = {
    upwork: {
      id: 'upwork',
      name: 'Upwork',
      icon: '💚',
      color: '#14a800',
      urlPattern: /upwork\.com\/freelancers\/~?(\w+)/i,
      fields: ['name', 'title', 'overview', 'hourlyRate', 'skills', 'jss',
               'earnings', 'jobs', 'hours', 'rating', 'reviews', 'portfolio',
               'location', 'memberSince', 'availability', 'badge']
    },
    fiverr: {
      id: 'fiverr',
      name: 'Fiverr',
      icon: '🟢',
      color: '#1dbf73',
      urlPattern: /fiverr\.com\/([a-zA-Z0-9_]+)/i,
      fields: ['name', 'title', 'description', 'rating', 'reviews',
               'completedOrders', 'responseTime', 'gigs', 'level',
               'location', 'memberSince', 'languages']
    },
    freelancer: {
      id: 'freelancer',
      name: 'Freelancer.com',
      icon: '🔵',
      color: '#0e74bc',
      urlPattern: /freelancer\.com\/u\/([a-zA-Z0-9_]+)/i,
      fields: ['name', 'title', 'description', 'hourlyRate', 'skills',
               'rating', 'reviews', 'earnings', 'completedProjects',
               'location', 'memberSince', 'verification']
    }
  };

  var _initialized = false;

  // ─── Parse Helpers ────────────────────────────────────────────────

  function _parseRate(rate) {
    if (!rate) return null;
    if (typeof rate === 'number') return { amount: rate, currency: 'USD' };
    if (typeof rate === 'string') {
      var m = rate.match(/([\d.]+)/);
      return m ? { amount: parseFloat(m[1]), currency: 'USD' } : null;
    }
    return rate;
  }

  function _parseEarnings(earnings) {
    if (!earnings) return null;
    if (typeof earnings === 'number') return { amount: earnings, currency: 'USD' };
    if (typeof earnings === 'string') {
      var cleaned = earnings.replace(/[^0-9.kKmM]/g, '');
      var val = parseFloat(cleaned);
      if (/[kK]/.test(cleaned)) val *= 1000;
      if (/[mM]/.test(cleaned)) val *= 1000000;
      return isNaN(val) ? null : { amount: val, currency: 'USD' };
    }
    return earnings;
  }

  function _normalizeRating(rating, outOf) {
    if (!rating && rating !== 0) return null;
    var score = typeof rating === 'object' ? (rating.score || rating.average || 0) : rating;
    var maxVal = typeof rating === 'object' ? (rating.outOf || rating.max || outOf) : outOf;
    return {
      score: parseFloat(score) || 0,
      outOf: maxVal,
      normalized: maxVal > 0 ? Math.round((parseFloat(score) / maxVal) * 5 * 100) / 100 : 0
    };
  }

  function _parseInt(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') { var n = parseInt(val.replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; }
    return 0;
  }

  function _ensureArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return [];
  }

  function _fiverrLevel(level) {
    if (!level) return null;
    var l = String(level).toLowerCase();
    if (l.indexOf('top') >= 0) return 'Top Rated Seller';
    if (l === '2' || l.indexOf('level 2') >= 0) return 'Level 2 Seller';
    if (l === '1' || l.indexOf('level 1') >= 0) return 'Level 1 Seller';
    return 'New Seller';
  }

  // ─── Normalizers ──────────────────────────────────────────────────

  function normalizeUpwork(raw) {
    return {
      platform: 'upwork', profileUrl: raw.url || raw.profileUrl || '',
      importedAt: new Date().toISOString(),
      name: raw.name || '', title: raw.title || raw.headline || '',
      description: raw.overview || raw.description || '',
      hourlyRate: _parseRate(raw.hourlyRate || raw.rate),
      skills: _ensureArray(raw.skills),
      rating: _normalizeRating(raw.rating, 5),
      reviewCount: _parseInt(raw.reviews || raw.reviewCount),
      completedJobs: _parseInt(raw.jobs || raw.completedJobs || raw.totalJobs),
      totalEarnings: _parseEarnings(raw.earnings || raw.totalEarnings),
      hoursWorked: _parseInt(raw.hours || raw.hoursWorked),
      responseTime: raw.responseTime || null,
      badge: raw.badge || raw.topRated || null,
      jss: typeof raw.jss === 'number' ? raw.jss : null,
      location: raw.location || '', memberSince: raw.memberSince || null,
      availability: raw.availability || null,
      portfolio: _ensureArray(raw.portfolio),
      raw: raw
    };
  }

  function normalizeFiverr(raw) {
    var skills = _ensureArray(raw.skills || raw.tags);
    if (raw.gigs && Array.isArray(raw.gigs)) {
      raw.gigs.forEach(function (gig) {
        _ensureArray(gig.tags || gig.skills).forEach(function (s) {
          if (skills.indexOf(s) === -1) skills.push(s);
        });
      });
    }
    return {
      platform: 'fiverr', profileUrl: raw.url || raw.profileUrl || '',
      importedAt: new Date().toISOString(),
      name: raw.name || raw.username || '', title: raw.title || '',
      description: raw.description || raw.about || '',
      hourlyRate: null,
      skills: skills,
      rating: _normalizeRating(raw.rating, 5),
      reviewCount: _parseInt(raw.reviews || raw.reviewCount || raw.totalReviews),
      completedJobs: _parseInt(raw.completedOrders || raw.deliveredOrders),
      totalEarnings: null,
      hoursWorked: null,
      responseTime: raw.responseTime || null,
      badge: _fiverrLevel(raw.level),
      jss: null,
      location: raw.location || raw.country || '', memberSince: raw.memberSince || null,
      availability: raw.onlineStatus || null,
      portfolio: (raw.gigs || []).map(function (g) {
        return { title: g.title || g.name || '', url: g.url || '', thumbnail: g.image || g.thumbnail || '', price: g.price || g.startingPrice || null };
      }),
      raw: raw
    };
  }

  function normalizeFreelancer(raw) {
    return {
      platform: 'freelancer', profileUrl: raw.url || raw.profileUrl || '',
      importedAt: new Date().toISOString(),
      name: raw.name || raw.username || '', title: raw.title || raw.tagline || '',
      description: raw.description || raw.about || '',
      hourlyRate: _parseRate(raw.hourlyRate),
      skills: _ensureArray(raw.skills),
      rating: _normalizeRating(raw.rating, 5),
      reviewCount: _parseInt(raw.reviews || raw.reviewCount),
      completedJobs: _parseInt(raw.completedProjects || raw.projectsCompleted),
      totalEarnings: _parseEarnings(raw.earnings),
      hoursWorked: null, responseTime: null,
      badge: raw.verification || raw.badge || null,
      jss: null,
      location: raw.location || raw.country || '', memberSince: raw.memberSince || null,
      availability: null,
      portfolio: _ensureArray(raw.portfolio),
      raw: raw
    };
  }

  var NORMALIZERS = { upwork: normalizeUpwork, fiverr: normalizeFiverr, freelancer: normalizeFreelancer };

  // ─── Storage ──────────────────────────────────────────────────────

  function loadProfiles() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveProfiles(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* full */ } }

  function _logSync(platform, action) {
    try {
      var log = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
      log.push({ platform: platform, action: action, timestamp: new Date().toISOString() });
      if (log.length > 100) log = log.slice(-100);
      localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log));
    } catch (e) { /* full */ }
  }

  function getSyncLog() {
    try { return JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]'); } catch (e) { return []; }
  }

  // ─── Import & Sync ───────────────────────────────────────────────

  function importProfile(platform, rawData) {
    var normalizer = NORMALIZERS[platform];
    if (!normalizer) throw new Error('Unknown platform: ' + platform + '. Supported: ' + Object.keys(PLATFORMS).join(', '));

    var normalized = normalizer(rawData);
    var profiles = loadProfiles();
    profiles[platform] = normalized;
    saveProfiles(profiles);
    _logSync(platform, 'import');

    // Dispatch event
    try { window.dispatchEvent(new CustomEvent('cf:platform:imported', { detail: { platform: platform, profile: normalized } })); } catch (e) { /* old */ }

    return normalized;
  }

  function detectPlatform(url) {
    for (var key in PLATFORMS) {
      if (PLATFORMS[key].urlPattern.test(url)) return key;
    }
    return null;
  }

  function getImportedProfiles() { return loadProfiles(); }

  function removeProfile(platform) {
    var profiles = loadProfiles();
    delete profiles[platform];
    saveProfiles(profiles);
    _logSync(platform, 'remove');
  }

  function exportAllData() {
    return JSON.stringify({ profiles: loadProfiles(), syncLog: getSyncLog(), exportedAt: new Date().toISOString() }, null, 2);
  }

  function importAllData(jsonString) {
    try {
      var data = JSON.parse(jsonString);
      if (data.profiles) saveProfiles(data.profiles);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ─── Unified Analysis ────────────────────────────────────────────

  function getUnifiedAnalysis() {
    var profiles = loadProfiles();
    var platforms = Object.keys(profiles);
    if (platforms.length === 0) return { error: 'No profiles imported', platforms: [] };

    var analysis = {
      platforms: platforms,
      profileCount: platforms.length,
      lastSync: new Date().toISOString(),
      name: _pickBest(profiles, 'name'),
      title: _pickBest(profiles, 'title'),
      skills: _mergeSkills(profiles),
      totalReviews: _sumField(profiles, 'reviewCount'),
      totalJobs: _sumField(profiles, 'completedJobs'),
      averageRating: _avgRating(profiles),
      earnings: _totalEarnings(profiles),
      breakdown: {},
      comparison: _buildComparison(profiles),
      insights: [],
      recommendations: []
    };

    platforms.forEach(function (p) {
      var prof = profiles[p];
      analysis.breakdown[p] = {
        platform: PLATFORMS[p].name, icon: PLATFORMS[p].icon,
        rating: prof.rating ? prof.rating.normalized : null,
        reviews: prof.reviewCount, jobs: prof.completedJobs,
        badge: prof.badge, importedAt: prof.importedAt
      };
    });

    analysis.insights = _generateInsights(profiles, analysis);
    analysis.recommendations = _generateRecommendations(profiles, analysis);
    return analysis;
  }

  function _pickBest(profiles, field) {
    if (profiles.upwork && profiles.upwork[field]) return profiles.upwork[field];
    var best = '';
    Object.keys(profiles).forEach(function (p) { var v = profiles[p][field] || ''; if (v.length > best.length) best = v; });
    return best;
  }

  function _mergeSkills(profiles) {
    var map = {};
    Object.keys(profiles).forEach(function (p) {
      (profiles[p].skills || []).forEach(function (skill) {
        var key = skill.toLowerCase().trim();
        if (!map[key]) map[key] = { name: skill, platforms: [], count: 0 };
        if (map[key].platforms.indexOf(p) === -1) { map[key].platforms.push(p); map[key].count++; }
      });
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
  }

  function _sumField(profiles, field) {
    var sum = 0; Object.values(profiles).forEach(function (p) { sum += (p[field] || 0); }); return sum;
  }

  function _avgRating(profiles) {
    var sum = 0, count = 0;
    Object.values(profiles).forEach(function (p) { if (p.rating && p.rating.normalized > 0) { sum += p.rating.normalized; count++; } });
    return count > 0 ? Math.round((sum / count) * 100) / 100 : null;
  }

  function _totalEarnings(profiles) {
    var total = 0;
    Object.values(profiles).forEach(function (p) { if (p.totalEarnings && p.totalEarnings.amount) total += p.totalEarnings.amount; });
    return total > 0 ? { amount: total, currency: 'USD' } : null;
  }

  function _buildComparison(profiles) {
    var platforms = Object.keys(profiles);
    if (platforms.length < 2) return null;
    var metrics = ['rating', 'reviewCount', 'completedJobs'];
    var rows = [];
    metrics.forEach(function (metric) {
      var row = { metric: metric, values: {} };
      platforms.forEach(function (p) {
        var prof = profiles[p];
        if (metric === 'rating') row.values[p] = prof.rating ? prof.rating.normalized : null;
        else row.values[p] = prof[metric] || 0;
      });
      // Find leader
      var best = null, bestVal = -Infinity;
      Object.keys(row.values).forEach(function (p) { if (row.values[p] > bestVal) { bestVal = row.values[p]; best = p; } });
      row.leader = best;
      rows.push(row);
    });
    return rows;
  }

  function _generateInsights(profiles, analysis) {
    var insights = [];
    var platforms = Object.keys(profiles);

    if (platforms.length > 1) {
      var ratings = {};
      platforms.forEach(function (p) { if (profiles[p].rating) ratings[p] = profiles[p].rating.normalized; });
      var best = Object.keys(ratings).sort(function (a, b) { return ratings[b] - ratings[a]; })[0];
      if (best) insights.push({ type: 'rating', icon: '⭐', message: 'Highest rating on ' + PLATFORMS[best].name + ' (' + ratings[best] + '/5)' });
    }

    var crossSkills = analysis.skills.filter(function (s) { return s.count > 1; });
    if (crossSkills.length > 0)
      insights.push({ type: 'skills', icon: '🔗', message: crossSkills.length + ' shared skill(s): ' + crossSkills.slice(0, 5).map(function (s) { return s.name; }).join(', ') });

    platforms.forEach(function (p) {
      var unique = (profiles[p].skills || []).filter(function (skill) {
        var m = analysis.skills.find(function (s) { return s.name.toLowerCase() === skill.toLowerCase(); });
        return m && m.count === 1;
      });
      if (unique.length > 0) insights.push({ type: 'unique_skills', icon: '✨', message: PLATFORMS[p].name + ' has ' + unique.length + ' unique skill(s)' });
    });

    if (analysis.totalJobs > 0) insights.push({ type: 'volume', icon: '📊', message: 'Total completed jobs: ' + analysis.totalJobs });
    if (analysis.earnings) insights.push({ type: 'earnings', icon: '💰', message: 'Total tracked earnings: $' + analysis.earnings.amount.toLocaleString() });

    return insights;
  }

  function _generateRecommendations(profiles, analysis) {
    var recs = [];
    var platforms = Object.keys(profiles);

    // Title consistency
    var titles = platforms.map(function (p) { return (profiles[p].title || '').toLowerCase(); }).filter(Boolean);
    var uniqueTitles = titles.filter(function (t, i) { return titles.indexOf(t) === i; });
    if (uniqueTitles.length > 1)
      recs.push({ priority: 'high', icon: '🎯', message: 'Professional titles differ across platforms. Align them for consistent branding.' });

    // Missing platforms
    Object.keys(PLATFORMS).forEach(function (p) {
      if (!profiles[p]) recs.push({ priority: 'medium', icon: '➕', message: 'Create a profile on ' + PLATFORMS[p].name + ' to expand reach.' });
    });

    // Low reviews
    platforms.forEach(function (p) {
      if (profiles[p].reviewCount < 5) recs.push({ priority: 'medium', icon: '📝', message: 'Few reviews on ' + PLATFORMS[p].name + '. Build testimonials there.' });
    });

    // Skills gaps
    var topSkills = analysis.skills.filter(function (s) { return s.count > 1; }).slice(0, 5);
    platforms.forEach(function (p) {
      var ps = (profiles[p].skills || []).map(function (s) { return s.toLowerCase(); });
      topSkills.forEach(function (skill) {
        if (ps.indexOf(skill.name.toLowerCase()) === -1)
          recs.push({ priority: 'low', icon: '🔧', message: 'Add "' + skill.name + '" to ' + PLATFORMS[p].name + ' — it\'s on your other profiles.' });
      });
    });

    var order = { high: 0, medium: 1, low: 2 };
    recs.sort(function (a, b) { return (order[a.priority] || 2) - (order[b.priority] || 2); });
    return recs;
  }

  // ─── UI Renderer ─────────────────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var profiles = loadProfiles();
    var platforms = Object.keys(profiles);

    var html = '<div class="cf-sync-dashboard">';
    html += '<h3 style="margin:0 0 16px">🔄 Multi-Platform Sync</h3>';

    // ── Platform cards
    Object.keys(PLATFORMS).forEach(function (key) {
      var plat = PLATFORMS[key];
      var prof = profiles[key];
      var imported = !!prof;

      html += '<div style="padding:12px;margin-bottom:10px;border-left:3px solid ' + plat.color + ';border-radius:6px;background:' + (imported ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)') + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:' + (imported ? '8px' : '0') + '">';
      html += '<span style="font-weight:600">' + plat.icon + ' ' + plat.name + '</span>';
      html += imported
        ? '<span style="color:#00ff88;font-size:0.85em">✅ Synced</span>'
        : '<span style="color:#666;font-size:0.85em">⬜ Not imported</span>';
      html += '</div>';

      if (imported) {
        html += '<div style="font-size:0.85em;color:#bbb;display:flex;gap:12px;flex-wrap:wrap">';
        html += '<span>⭐ ' + (prof.rating ? prof.rating.normalized + '/5' : 'N/A') + '</span>';
        html += '<span>📝 ' + prof.reviewCount + ' reviews</span>';
        html += '<span>✅ ' + prof.completedJobs + ' jobs</span>';
        if (prof.badge) html += '<span>🏅 ' + prof.badge + '</span>';
        if (prof.hourlyRate) html += '<span>💵 $' + prof.hourlyRate.amount + '/hr</span>';
        html += '</div>';
        html += '<div style="margin-top:6px"><button class="cf-sync-remove" data-platform="' + key + '" style="padding:2px 8px;border:1px solid #333;border-radius:4px;background:none;color:#888;cursor:pointer;font-size:0.75em">Remove</button></div>';
      } else {
        html += '<button class="cf-sync-import" data-platform="' + key + '" style="margin-top:6px;padding:4px 12px;border:1px solid ' + plat.color + ';border-radius:4px;background:none;color:' + plat.color + ';cursor:pointer;font-size:0.8em">+ Import</button>';
      }
      html += '</div>';
    });

    // ── Import via JSON
    html += '<details style="margin:16px 0"><summary style="cursor:pointer;color:#888;font-size:0.85em">📋 Import Profile Data (JSON)</summary>';
    html += '<div style="margin-top:8px">';
    html += '<select id="cf-sync-platform-select" style="padding:6px;border:1px solid #333;border-radius:4px;background:#111;color:#ccc;margin-bottom:8px;width:100%">';
    Object.keys(PLATFORMS).forEach(function (k) { html += '<option value="' + k + '">' + PLATFORMS[k].name + '</option>'; });
    html += '</select>';
    html += '<textarea id="cf-sync-json" rows="6" placeholder=\'Paste profile JSON data here…\' style="width:100%;padding:8px;border:1px solid #333;border-radius:4px;background:#0a0a0a;color:#ccc;font-family:monospace;font-size:0.85em;resize:vertical"></textarea>';
    html += '<button id="cf-sync-import-json" style="margin-top:6px;padding:6px 16px;border:1px solid #ff8844;border-radius:4px;background:none;color:#ff8844;cursor:pointer">Import</button>';
    html += '</div></details>';

    // ── Unified Analysis
    if (platforms.length > 0) {
      var analysis = getUnifiedAnalysis();

      html += '<div style="margin-top:20px;padding:16px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid #222">';
      html += '<h4 style="margin:0 0 12px">📊 Unified Analysis</h4>';

      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">';
      html += '<div style="text-align:center;padding:8px"><div style="font-size:0.75em;color:#888">Avg Rating</div><div style="font-size:1.3em;font-weight:600">' + (analysis.averageRating || 'N/A') + '<span style="font-size:0.6em;color:#888">/5</span></div></div>';
      html += '<div style="text-align:center;padding:8px"><div style="font-size:0.75em;color:#888">Total Reviews</div><div style="font-size:1.3em;font-weight:600">' + analysis.totalReviews + '</div></div>';
      html += '<div style="text-align:center;padding:8px"><div style="font-size:0.75em;color:#888">Total Jobs</div><div style="font-size:1.3em;font-weight:600">' + analysis.totalJobs + '</div></div>';
      if (analysis.earnings) html += '<div style="text-align:center;padding:8px"><div style="font-size:0.75em;color:#888">Earnings</div><div style="font-size:1.3em;font-weight:600">$' + analysis.earnings.amount.toLocaleString() + '</div></div>';
      html += '</div>';

      // Comparison matrix
      if (analysis.comparison) {
        html += '<div style="margin-bottom:16px"><strong style="font-size:0.9em;color:#aaa">Platform Comparison</strong>';
        html += '<div style="margin-top:8px;overflow-x:auto"><table style="width:100%;font-size:0.85em;border-collapse:collapse">';
        html += '<tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #222"></th>';
        platforms.forEach(function (p) { html += '<th style="padding:4px 8px;border-bottom:1px solid #222;color:' + PLATFORMS[p].color + '">' + PLATFORMS[p].icon + ' ' + PLATFORMS[p].name + '</th>'; });
        html += '</tr>';
        var labels = { rating: 'Rating (/5)', reviewCount: 'Reviews', completedJobs: 'Jobs' };
        analysis.comparison.forEach(function (row) {
          html += '<tr>';
          html += '<td style="padding:4px 8px;color:#aaa">' + (labels[row.metric] || row.metric) + '</td>';
          platforms.forEach(function (p) {
            var val = row.values[p];
            var isLeader = row.leader === p;
            html += '<td style="padding:4px 8px;text-align:center;' + (isLeader ? 'color:#00ff88;font-weight:600' : 'color:#ccc') + '">' + (val !== null && val !== undefined ? val : '—') + '</td>';
          });
          html += '</tr>';
        });
        html += '</table></div></div>';
      }

      // Skills cloud
      if (analysis.skills.length > 0) {
        html += '<div style="margin-bottom:16px"><strong style="font-size:0.9em;color:#aaa">Skills Across Platforms</strong>';
        html += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">';
        analysis.skills.slice(0, 20).forEach(function (s) {
          var opacity = s.count > 1 ? '1' : '0.6';
          html += '<span style="padding:3px 10px;border-radius:12px;font-size:0.8em;border:1px solid #333;color:#ccc;opacity:' + opacity + '">' + s.name;
          if (s.count > 1) html += ' <span style="color:#00ff88;font-size:0.8em">×' + s.count + '</span>';
          html += '</span>';
        });
        html += '</div></div>';
      }

      // Insights
      if (analysis.insights.length > 0) {
        html += '<div style="margin-bottom:12px"><strong style="font-size:0.9em;color:#aaa">💡 Insights</strong><ul style="padding-left:20px;margin:8px 0;color:#bbb;font-size:0.85em">';
        analysis.insights.forEach(function (i) { html += '<li style="margin-bottom:4px">' + i.icon + ' ' + i.message + '</li>'; });
        html += '</ul></div>';
      }

      // Recommendations
      if (analysis.recommendations.length > 0) {
        var icons = { high: '🔴', medium: '🟡', low: '🟢' };
        html += '<div><strong style="font-size:0.9em;color:#aaa">🎯 Recommendations</strong><ul style="padding-left:20px;margin:8px 0;color:#bbb;font-size:0.85em">';
        analysis.recommendations.slice(0, 6).forEach(function (r) {
          html += '<li style="margin-bottom:4px">' + (icons[r.priority] || '') + ' ' + r.message + '</li>';
        });
        html += '</ul></div>';
      }

      html += '</div>';
    }

    // ── Export/Import
    html += '<div style="margin-top:16px;display:flex;gap:8px">';
    html += '<button id="cf-sync-export" style="padding:6px 12px;border:1px solid #333;border-radius:4px;background:none;color:#888;cursor:pointer;font-size:0.8em">💾 Export All Data</button>';
    html += '<button id="cf-sync-import-all" style="padding:6px 12px;border:1px solid #333;border-radius:4px;background:none;color:#888;cursor:pointer;font-size:0.8em">📂 Import Backup</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // ── Bind Events
    container.querySelectorAll('.cf-sync-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeProfile(btn.getAttribute('data-platform'));
        render(containerId);
      });
    });

    container.querySelectorAll('.cf-sync-import').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var plat = btn.getAttribute('data-platform');
        var json = prompt('Paste ' + PLATFORMS[plat].name + ' profile JSON:');
        if (json) {
          try { importProfile(plat, JSON.parse(json)); render(containerId); }
          catch (e) { alert('Invalid JSON: ' + e.message); }
        }
      });
    });

    var importJsonBtn = document.getElementById('cf-sync-import-json');
    if (importJsonBtn) importJsonBtn.addEventListener('click', function () {
      var select = document.getElementById('cf-sync-platform-select');
      var textarea = document.getElementById('cf-sync-json');
      if (select && textarea && textarea.value) {
        try { importProfile(select.value, JSON.parse(textarea.value)); textarea.value = ''; render(containerId); }
        catch (e) { alert('Invalid JSON: ' + e.message); }
      }
    });

    var exportBtn = document.getElementById('cf-sync-export');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      var data = exportAllData();
      var blob = new Blob([data], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cortex-profiles-export.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    var importAllBtn = document.getElementById('cf-sync-import-all');
    if (importAllBtn) importAllBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.addEventListener('change', function () {
        var reader = new FileReader();
        reader.onload = function (e) {
          if (importAllData(e.target.result)) render(containerId);
          else alert('Invalid backup file');
        };
        if (input.files[0]) reader.readAsText(input.files[0]);
      });
      input.click();
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.MultiPlatformSync = {
    PLATFORMS: PLATFORMS,

    // Lifecycle
    init: init,
    render: render,

    // Data
    importProfile: importProfile,
    detectPlatform: detectPlatform,
    getImportedProfiles: getImportedProfiles,
    removeProfile: removeProfile,
    getUnifiedAnalysis: getUnifiedAnalysis,

    // Import/Export
    exportAllData: exportAllData,
    importAllData: importAllData,
    getSyncLog: getSyncLog,

    // Normalizers (for testing/extension)
    normalizers: NORMALIZERS
  };

})();
