/**
 * Cortex Freelancer — Multi-Platform Profile Sync
 * [CF-079] Import profile data from Upwork + Fiverr + Freelancer.com
 * for unified analysis. Data normalization layer.
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_multi_platform';

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

  // ─── Normalized Profile Schema ────────────────────────────────────

  /**
   * Normalized profile structure (platform-agnostic):
   * {
   *   platform: string,
   *   profileUrl: string,
   *   importedAt: ISO string,
   *   name: string,
   *   title: string,
   *   description: string,
   *   hourlyRate: { amount: number, currency: string },
   *   skills: [string],
   *   rating: { score: number, outOf: number, normalized: number (0-5) },
   *   reviewCount: number,
   *   completedJobs: number,
   *   totalEarnings: { amount: number, currency: string },
   *   hoursWorked: number,
   *   responseTime: string,
   *   badge: string,
   *   location: string,
   *   memberSince: string,
   *   availability: string,
   *   portfolio: [{ title, url, thumbnail }],
   *   raw: {} (original platform data)
   * }
   */

  // ─── Data Normalization ───────────────────────────────────────────

  function normalizeUpwork(raw) {
    return {
      platform: 'upwork',
      profileUrl: raw.url || raw.profileUrl || '',
      importedAt: new Date().toISOString(),
      name: raw.name || '',
      title: raw.title || raw.headline || '',
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
      location: raw.location || '',
      memberSince: raw.memberSince || null,
      availability: raw.availability || null,
      portfolio: _ensureArray(raw.portfolio),
      raw: raw
    };
  }

  function normalizeFiverr(raw) {
    return {
      platform: 'fiverr',
      profileUrl: raw.url || raw.profileUrl || '',
      importedAt: new Date().toISOString(),
      name: raw.name || raw.username || '',
      title: raw.title || '',
      description: raw.description || raw.about || '',
      hourlyRate: null, // Fiverr uses gig pricing
      skills: _extractFiverrSkills(raw),
      rating: _normalizeRating(raw.rating, 5),
      reviewCount: _parseInt(raw.reviews || raw.reviewCount || raw.totalReviews),
      completedJobs: _parseInt(raw.completedOrders || raw.deliveredOrders),
      totalEarnings: null, // Not publicly available on Fiverr
      hoursWorked: null,
      responseTime: raw.responseTime || null,
      badge: _fiverrLevel(raw.level),
      jss: null,
      location: raw.location || raw.country || '',
      memberSince: raw.memberSince || null,
      availability: raw.onlineStatus || null,
      portfolio: _parseFiverrGigs(raw.gigs),
      raw: raw
    };
  }

  function normalizeFreelancer(raw) {
    return {
      platform: 'freelancer',
      profileUrl: raw.url || raw.profileUrl || '',
      importedAt: new Date().toISOString(),
      name: raw.name || raw.username || '',
      title: raw.title || raw.tagline || '',
      description: raw.description || raw.about || '',
      hourlyRate: _parseRate(raw.hourlyRate),
      skills: _ensureArray(raw.skills),
      rating: _normalizeRating(raw.rating, 5),
      reviewCount: _parseInt(raw.reviews || raw.reviewCount),
      completedJobs: _parseInt(raw.completedProjects || raw.projectsCompleted),
      totalEarnings: _parseEarnings(raw.earnings),
      hoursWorked: null,
      responseTime: null,
      badge: raw.verification || raw.badge || null,
      jss: null,
      location: raw.location || raw.country || '',
      memberSince: raw.memberSince || null,
      availability: null,
      portfolio: _ensureArray(raw.portfolio),
      raw: raw
    };
  }

  var NORMALIZERS = {
    upwork: normalizeUpwork,
    fiverr: normalizeFiverr,
    freelancer: normalizeFreelancer
  };

  // ─── Normalization Helpers ────────────────────────────────────────

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
      if (cleaned.match(/[kK]/)) val *= 1000;
      if (cleaned.match(/[mM]/)) val *= 1000000;
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
    if (typeof val === 'string') {
      var n = parseInt(val.replace(/[^0-9]/g, ''), 10);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  function _ensureArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return [];
  }

  function _extractFiverrSkills(raw) {
    var skills = _ensureArray(raw.skills || raw.tags);
    if (raw.gigs && Array.isArray(raw.gigs)) {
      raw.gigs.forEach(function (gig) {
        _ensureArray(gig.tags || gig.skills).forEach(function (s) {
          if (skills.indexOf(s) === -1) skills.push(s);
        });
      });
    }
    return skills;
  }

  function _fiverrLevel(level) {
    if (!level) return null;
    var l = String(level).toLowerCase();
    if (l.indexOf('top') >= 0) return 'Top Rated Seller';
    if (l === '2' || l.indexOf('level 2') >= 0) return 'Level 2 Seller';
    if (l === '1' || l.indexOf('level 1') >= 0) return 'Level 1 Seller';
    return 'New Seller';
  }

  function _parseFiverrGigs(gigs) {
    if (!Array.isArray(gigs)) return [];
    return gigs.map(function (g) {
      return {
        title: g.title || g.name || '',
        url: g.url || '',
        thumbnail: g.image || g.thumbnail || '',
        price: g.price || g.startingPrice || null
      };
    });
  }

  // ─── Storage ──────────────────────────────────────────────────────

  function loadProfiles() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveProfiles(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full */ }
  }

  // ─── Import & Sync ───────────────────────────────────────────────

  /**
   * Import profile data from a platform.
   * @param {string} platform - 'upwork', 'fiverr', or 'freelancer'
   * @param {Object} rawData - raw profile data from the platform
   * @returns {Object} normalized profile
   */
  function importProfile(platform, rawData) {
    var normalizer = NORMALIZERS[platform];
    if (!normalizer) {
      throw new Error('Unknown platform: ' + platform + '. Supported: ' + Object.keys(PLATFORMS).join(', '));
    }

    var normalized = normalizer(rawData);
    var profiles = loadProfiles();
    profiles[platform] = normalized;
    saveProfiles(profiles);
    return normalized;
  }

  /**
   * Detect platform from URL.
   */
  function detectPlatform(url) {
    for (var key in PLATFORMS) {
      if (PLATFORMS[key].urlPattern.test(url)) return key;
    }
    return null;
  }

  /**
   * Get all imported profiles.
   */
  function getImportedProfiles() {
    return loadProfiles();
  }

  /**
   * Remove a platform profile.
   */
  function removeProfile(platform) {
    var profiles = loadProfiles();
    delete profiles[platform];
    saveProfiles(profiles);
  }

  // ─── Unified Analysis ────────────────────────────────────────────

  /**
   * Generate a unified cross-platform analysis.
   */
  function getUnifiedAnalysis() {
    var profiles = loadProfiles();
    var platforms = Object.keys(profiles);

    if (platforms.length === 0) {
      return { error: 'No profiles imported', platforms: [] };
    }

    var analysis = {
      platforms: platforms,
      profileCount: platforms.length,
      lastSync: new Date().toISOString(),

      // Aggregated metrics
      name: _pickBest(profiles, 'name'),
      title: _pickBest(profiles, 'title'),

      skills: _mergeSkills(profiles),
      totalReviews: _sumField(profiles, 'reviewCount'),
      totalJobs: _sumField(profiles, 'completedJobs'),
      averageRating: _avgRating(profiles),

      earnings: _totalEarnings(profiles),

      // Per-platform breakdown
      breakdown: {},

      // Cross-platform insights
      insights: [],
      recommendations: []
    };

    // Per-platform breakdown
    platforms.forEach(function (p) {
      var prof = profiles[p];
      analysis.breakdown[p] = {
        platform: PLATFORMS[p].name,
        icon: PLATFORMS[p].icon,
        rating: prof.rating ? prof.rating.normalized : null,
        reviews: prof.reviewCount,
        jobs: prof.completedJobs,
        badge: prof.badge,
        importedAt: prof.importedAt
      };
    });

    // Generate insights
    analysis.insights = _generateInsights(profiles, analysis);
    analysis.recommendations = _generateRecommendations(profiles, analysis);

    return analysis;
  }

  function _pickBest(profiles, field) {
    var best = '';
    var platforms = Object.keys(profiles);
    // Prefer Upwork, then longest value
    if (profiles.upwork && profiles.upwork[field]) return profiles.upwork[field];
    platforms.forEach(function (p) {
      var val = profiles[p][field] || '';
      if (val.length > best.length) best = val;
    });
    return best;
  }

  function _mergeSkills(profiles) {
    var skillMap = {};
    Object.keys(profiles).forEach(function (p) {
      (profiles[p].skills || []).forEach(function (skill) {
        var key = skill.toLowerCase().trim();
        if (!skillMap[key]) {
          skillMap[key] = { name: skill, platforms: [], count: 0 };
        }
        if (skillMap[key].platforms.indexOf(p) === -1) {
          skillMap[key].platforms.push(p);
          skillMap[key].count++;
        }
      });
    });

    return Object.values(skillMap)
      .sort(function (a, b) { return b.count - a.count; });
  }

  function _sumField(profiles, field) {
    var sum = 0;
    Object.values(profiles).forEach(function (p) {
      sum += (p[field] || 0);
    });
    return sum;
  }

  function _avgRating(profiles) {
    var sum = 0;
    var count = 0;
    Object.values(profiles).forEach(function (p) {
      if (p.rating && p.rating.normalized > 0) {
        sum += p.rating.normalized;
        count++;
      }
    });
    return count > 0 ? Math.round((sum / count) * 100) / 100 : null;
  }

  function _totalEarnings(profiles) {
    var total = 0;
    Object.values(profiles).forEach(function (p) {
      if (p.totalEarnings && p.totalEarnings.amount) {
        total += p.totalEarnings.amount;
      }
    });
    return total > 0 ? { amount: total, currency: 'USD' } : null;
  }

  function _generateInsights(profiles, analysis) {
    var insights = [];
    var platforms = Object.keys(profiles);

    // Rating comparison
    if (platforms.length > 1) {
      var ratings = {};
      platforms.forEach(function (p) {
        if (profiles[p].rating) ratings[p] = profiles[p].rating.normalized;
      });
      var best = Object.keys(ratings).sort(function (a, b) { return ratings[b] - ratings[a]; })[0];
      if (best) {
        insights.push({
          type: 'rating',
          message: 'Your highest rating is on ' + PLATFORMS[best].name + ' (' + ratings[best] + '/5)'
        });
      }
    }

    // Cross-platform skills
    var crossSkills = analysis.skills.filter(function (s) { return s.count > 1; });
    if (crossSkills.length > 0) {
      insights.push({
        type: 'skills',
        message: crossSkills.length + ' skill(s) listed across multiple platforms: ' +
          crossSkills.slice(0, 5).map(function (s) { return s.name; }).join(', ')
      });
    }

    // Unique skills per platform
    platforms.forEach(function (p) {
      var uniqueSkills = (profiles[p].skills || []).filter(function (skill) {
        var match = analysis.skills.find(function (s) { return s.name.toLowerCase() === skill.toLowerCase(); });
        return match && match.count === 1;
      });
      if (uniqueSkills.length > 0) {
        insights.push({
          type: 'unique_skills',
          message: PLATFORMS[p].name + ' has ' + uniqueSkills.length + ' unique skill(s) not on other platforms'
        });
      }
    });

    // Work volume
    if (analysis.totalJobs > 0) {
      insights.push({
        type: 'volume',
        message: 'Total completed jobs across all platforms: ' + analysis.totalJobs
      });
    }

    return insights;
  }

  function _generateRecommendations(profiles, analysis) {
    var recs = [];
    var platforms = Object.keys(profiles);

    // Profile consistency
    var titles = platforms.map(function (p) { return (profiles[p].title || '').toLowerCase(); }).filter(Boolean);
    var uniqueTitles = titles.filter(function (t, i) { return titles.indexOf(t) === i; });
    if (uniqueTitles.length > 1) {
      recs.push({
        priority: 'high',
        message: 'Your professional titles differ across platforms. Consider aligning them for consistent branding.'
      });
    }

    // Missing profiles
    Object.keys(PLATFORMS).forEach(function (p) {
      if (!profiles[p]) {
        recs.push({
          priority: 'medium',
          message: 'Consider creating a profile on ' + PLATFORMS[p].name + ' to expand your client reach.'
        });
      }
    });

    // Low reviews on a platform
    platforms.forEach(function (p) {
      if (profiles[p].reviewCount < 5) {
        recs.push({
          priority: 'medium',
          message: 'You have few reviews on ' + PLATFORMS[p].name + '. Focus on building testimonials there.'
        });
      }
    });

    // Skills gap
    var topSkills = analysis.skills.filter(function (s) { return s.count > 1; }).slice(0, 5);
    platforms.forEach(function (p) {
      var platformSkills = (profiles[p].skills || []).map(function (s) { return s.toLowerCase(); });
      topSkills.forEach(function (skill) {
        if (platformSkills.indexOf(skill.name.toLowerCase()) === -1) {
          recs.push({
            priority: 'low',
            message: 'Add "' + skill.name + '" to your ' + PLATFORMS[p].name + ' profile — it\'s listed on your other profiles.'
          });
        }
      });
    });

    // Sort by priority
    var priorityOrder = { high: 0, medium: 1, low: 2 };
    recs.sort(function (a, b) { return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2); });

    return recs;
  }

  // ─── UI Renderer ─────────────────────────────────────────────────

  function renderSyncDashboard(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var profiles = loadProfiles();
    var platforms = Object.keys(profiles);

    var html = '<div class="cf-sync-dashboard">';
    html += '<h3>🔄 Multi-Platform Sync</h3>';

    // Platform cards
    Object.keys(PLATFORMS).forEach(function (key) {
      var plat = PLATFORMS[key];
      var prof = profiles[key];
      var imported = !!prof;

      html += '<div class="cf-sync-platform ' + (imported ? 'cf-sync-connected' : '') + '" style="border-left:3px solid ' + plat.color + '">';
      html += '<div class="cf-sync-header">';
      html += '<span>' + plat.icon + ' ' + plat.name + '</span>';
      html += imported
        ? '<span class="cf-sync-status cf-sync-ok">✅ Synced</span>'
        : '<span class="cf-sync-status cf-sync-pending">⬜ Not imported</span>';
      html += '</div>';

      if (imported) {
        html += '<div class="cf-sync-details">';
        html += '<span>⭐ ' + (prof.rating ? prof.rating.normalized + '/5' : 'N/A') + '</span> · ';
        html += '<span>📝 ' + prof.reviewCount + ' reviews</span> · ';
        html += '<span>✅ ' + prof.completedJobs + ' jobs</span>';
        if (prof.badge) html += ' · <span>🏅 ' + prof.badge + '</span>';
        html += '</div>';
      }
      html += '</div>';
    });

    // Unified analysis
    if (platforms.length > 0) {
      var analysis = getUnifiedAnalysis();
      html += '<div class="cf-sync-analysis">';
      html += '<h4>📊 Unified Analysis</h4>';

      html += '<div class="cf-sync-stats">';
      html += '<div>📈 Avg Rating: <strong>' + (analysis.averageRating || 'N/A') + '/5</strong></div>';
      html += '<div>📝 Total Reviews: <strong>' + analysis.totalReviews + '</strong></div>';
      html += '<div>✅ Total Jobs: <strong>' + analysis.totalJobs + '</strong></div>';
      if (analysis.earnings) {
        html += '<div>💰 Total Earnings: <strong>$' + analysis.earnings.amount.toLocaleString() + '</strong></div>';
      }
      html += '</div>';

      if (analysis.insights.length > 0) {
        html += '<div class="cf-sync-insights"><strong>💡 Insights:</strong><ul>';
        analysis.insights.forEach(function (i) {
          html += '<li>' + i.message + '</li>';
        });
        html += '</ul></div>';
      }

      if (analysis.recommendations.length > 0) {
        html += '<div class="cf-sync-recs"><strong>🎯 Recommendations:</strong><ul>';
        analysis.recommendations.slice(0, 5).forEach(function (r) {
          var icons = { high: '🔴', medium: '🟡', low: '🟢' };
          html += '<li>' + (icons[r.priority] || '') + ' ' + r.message + '</li>';
        });
        html += '</ul></div>';
      }

      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.MultiPlatformSync = {
    PLATFORMS: PLATFORMS,
    importProfile: importProfile,
    detectPlatform: detectPlatform,
    getImportedProfiles: getImportedProfiles,
    removeProfile: removeProfile,
    getUnifiedAnalysis: getUnifiedAnalysis,
    renderSyncDashboard: renderSyncDashboard,

    // Normalizers (for testing/extension)
    normalizers: NORMALIZERS
  };

})();
