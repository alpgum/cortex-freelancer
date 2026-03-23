/**
 * [UW-007] Competition Radar
 *
 * Fetches similar freelancers from Upwork via local proxy /search endpoint,
 * compares them against the user's profile, and renders a visual competition
 * analysis with radar chart, comparison table, and recommendations.
 */

(function () {
  'use strict';

  var PROXY_BASE = 'http://localhost:3848';

  // ─── CSS (dark theme, inline) ───────────────────────────────────────
  var STYLES = '\
    .competition-radar{background:#111;border:1px solid #222;border-radius:12px;padding:1.5rem;margin-top:1.5rem;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,sans-serif}\
    .cr-header{display:flex;align-items:center;gap:0.5rem;font-size:1.4rem;font-weight:700;margin-bottom:1rem;color:#fff}\
    .cr-loading{text-align:center;padding:2rem;color:#888;font-size:0.95rem}\
    .cr-loading .spinner{display:inline-block;width:20px;height:20px;border:2px solid #333;border-top-color:#00ff88;border-radius:50%;animation:cr-spin 0.8s linear infinite}\
    @keyframes cr-spin{to{transform:rotate(360deg)}}\
    .cr-error{color:#ff6b6b;padding:1rem;text-align:center;font-size:0.9rem}\
    .cr-table-wrap{overflow-x:auto;margin:1rem 0}\
    .cr-table{width:100%;border-collapse:collapse;font-size:0.85rem}\
    .cr-table th,.cr-table td{padding:0.5rem 0.6rem;text-align:left;border-bottom:1px solid #222;white-space:nowrap}\
    .cr-table th{color:#888;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px}\
    .cr-table .cr-you{background:rgba(0,255,136,0.06);font-weight:600}\
    .cr-table .cr-you td:first-child{color:#00ff88}\
    .cr-better{color:#00ff88}\
    .cr-worse{color:#ff4444}\
    .cr-similar{color:#ffaa00}\
    .cr-threat-strong{background:rgba(255,68,68,0.12);color:#ff6b6b;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600}\
    .cr-threat-similar{background:rgba(255,170,0,0.12);color:#ffaa00;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600}\
    .cr-threat-ahead{background:rgba(0,255,136,0.12);color:#00ff88;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600}\
    .cr-radar-section{display:flex;flex-wrap:wrap;gap:1.5rem;align-items:flex-start;margin:1.5rem 0}\
    .cr-radar-chart{flex:0 0 280px}\
    .cr-radar-chart svg{width:100%;height:auto}\
    .cr-insights{flex:1;min-width:260px}\
    .cr-insight-title{font-size:1rem;font-weight:700;margin-bottom:0.75rem;color:#fff}\
    .cr-rec-list{list-style:none;padding:0;margin:0}\
    .cr-rec-list li{padding:0.5rem 0;border-bottom:1px solid #1a1a1a;font-size:0.85rem;color:#ccc}\
    .cr-rec-list li::before{content:"💡 ";}\
    .cr-skill-overlap{display:inline-block;background:#222;padding:1px 6px;border-radius:3px;font-size:0.75rem;margin:1px;color:#aaa}\
    .cr-skill-shared{background:rgba(0,255,136,0.15);color:#00ff88}\
  ';

  function injectStyles() {
    if (document.getElementById('cr-styles')) return;
    var s = document.createElement('style');
    s.id = 'cr-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  function parseRate(rateStr) {
    if (!rateStr) return 0;
    var m = String(rateStr).match(/([\d,.]+)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  }

  function parseEarnings(earnStr) {
    if (!earnStr) return 0;
    var s = String(earnStr).toLowerCase().replace(/[^0-9.km+]/g, '');
    if (s.includes('m')) return parseFloat(s) * 1000000;
    if (s.includes('k')) return parseFloat(s) * 1000;
    return parseFloat(s) || 0;
  }

  function earningsTier(val) {
    if (val >= 1000000) return 'Elite ($1M+)';
    if (val >= 500000) return 'Top ($500K+)';
    if (val >= 100000) return 'Strong ($100K+)';
    if (val >= 10000) return 'Growing ($10K+)';
    return 'Starting';
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ─── Fetch Competitors ──────────────────────────────────────────────

  function fetchCompetitors(profileData) {
    // Pick top skill as search query
    var skills = profileData.skills || [];
    var query = skills[0] || profileData.title || 'freelancer';
    var limit = 5;

    return fetch(PROXY_BASE + '/search?q=' + encodeURIComponent(query) + '&limit=' + limit)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        // Filter out the user themselves (by name match)
        var userName = (profileData.name || '').toLowerCase().trim();
        var competitors = (data.freelancers || []).filter(function (f) {
          return f.name && f.name.toLowerCase().trim() !== userName;
        });
        return competitors.slice(0, 5);
      });
  }

  // ─── Compare With User ──────────────────────────────────────────────

  function compareWithUser(profileData, competitors) {
    var userRate = parseRate(profileData.hourlyRate);
    var userJSS = profileData.jobSuccess || 0;
    var userEarnings = parseEarnings(profileData.totalEarnings);
    var userSkills = (profileData.skills || []).map(function (s) { return s.toLowerCase(); });

    return competitors.map(function (comp) {
      var compRate = parseRate(comp.rate);
      var compJSS = comp.jss || 0;
      var compEarnings = parseEarnings(comp.earnings);
      var compSkills = (comp.skills || []).map(function (s) { return s.toLowerCase(); });

      // Rate comparison
      var rateDiff = userRate - compRate;
      var rateComparison = Math.abs(rateDiff) < 5 ? 'similar' : (rateDiff > 0 ? 'higher' : 'lower');

      // JSS comparison
      var jssDiff = userJSS - compJSS;
      var jssComparison = Math.abs(jssDiff) < 3 ? 'similar' : (jssDiff > 0 ? 'higher' : 'lower');

      // Earnings tier comparison
      var userTier = earningsTier(userEarnings);
      var compTier = earningsTier(compEarnings);
      var earningsComparison = userEarnings > compEarnings * 1.2 ? 'higher' : (compEarnings > userEarnings * 1.2 ? 'lower' : 'similar');

      // Skill overlap
      var shared = userSkills.filter(function (s) { return compSkills.indexOf(s) >= 0; });
      var overlap = userSkills.length > 0 ? Math.round((shared.length / userSkills.length) * 100) : 0;

      // Overall threat level
      var threatScore = 0;
      if (rateComparison === 'lower') threatScore += 1;  // cheaper competitor
      if (jssComparison === 'lower') threatScore += 2;    // better JSS
      if (earningsComparison === 'lower') threatScore += 1; // more experienced
      if (overlap >= 60) threatScore += 1;

      var threatLevel = threatScore >= 3 ? 'strong competitor' : (threatScore >= 1 ? 'similar' : "you're ahead");

      return {
        name: comp.name,
        title: comp.title,
        rate: comp.rate,
        rateNum: compRate,
        jss: compJSS,
        earnings: comp.earnings,
        earningsNum: compEarnings,
        earningsTier: compTier,
        location: comp.location,
        skills: comp.skills || [],
        profileUrl: comp.profileUrl,
        rateComparison: rateComparison,
        jssComparison: jssComparison,
        earningsComparison: earningsComparison,
        skillOverlap: overlap,
        sharedSkills: shared,
        threatLevel: threatLevel,
      };
    });
  }

  // ─── SVG Radar Chart ────────────────────────────────────────────────

  function renderRadarSVG(profileData, comparisons) {
    var dims = ['Rate', 'JSS', 'Earnings', 'Skill Depth', 'Experience'];
    var n = dims.length;
    var cx = 140, cy = 140, maxR = 110;
    var angleStep = (2 * Math.PI) / n;

    // Normalize user values to 0-100
    var userRate = parseRate(profileData.hourlyRate);
    var userJSS = profileData.jobSuccess || 0;
    var userEarnings = parseEarnings(profileData.totalEarnings);
    var userSkillCount = (profileData.skills || []).length;
    var userJobs = profileData.totalJobs || 0;

    // Calculate max values across all (user + competitors) for normalization
    var allRates = [userRate], allJSS = [userJSS], allEarnings = [userEarnings];
    var allSkills = [userSkillCount], allJobs = [userJobs];
    comparisons.forEach(function (c) {
      allRates.push(c.rateNum);
      allJSS.push(c.jss);
      allEarnings.push(c.earningsNum);
      allSkills.push(c.skills.length);
    });

    function norm(val, arr) {
      var mx = Math.max.apply(null, arr);
      return mx > 0 ? Math.min((val / mx) * 100, 100) : 50;
    }

    var userVals = [
      norm(userRate, allRates),
      norm(userJSS, allJSS),
      norm(userEarnings, allEarnings),
      norm(userSkillCount, allSkills),
      norm(userJobs, allJobs.length > 1 ? allJobs : [userJobs, 100]),
    ];

    // Average competitor values
    var avgVals = [0, 0, 0, 0, 0];
    if (comparisons.length > 0) {
      comparisons.forEach(function (c) {
        avgVals[0] += norm(c.rateNum, allRates);
        avgVals[1] += norm(c.jss, allJSS);
        avgVals[2] += norm(c.earningsNum, allEarnings);
        avgVals[3] += norm(c.skills.length, allSkills);
        avgVals[4] += 50; // no job count for competitors, use middle
      });
      for (var j = 0; j < 5; j++) avgVals[j] = avgVals[j] / comparisons.length;
    }

    function polarToXY(angle, radius) {
      return {
        x: cx + radius * Math.cos(angle - Math.PI / 2),
        y: cy + radius * Math.sin(angle - Math.PI / 2),
      };
    }

    function polyPoints(vals) {
      return vals.map(function (v, i) {
        var p = polarToXY(i * angleStep, (v / 100) * maxR);
        return p.x + ',' + p.y;
      }).join(' ');
    }

    var svg = '<svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">';

    // Grid circles
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (maxR * f) + '" fill="none" stroke="#222" stroke-width="0.5"/>';
    });

    // Grid lines
    for (var i = 0; i < n; i++) {
      var ep = polarToXY(i * angleStep, maxR);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ep.x + '" y2="' + ep.y + '" stroke="#222" stroke-width="0.5"/>';
    }

    // Competitor polygon (avg)
    if (comparisons.length > 0) {
      svg += '<polygon points="' + polyPoints(avgVals) + '" fill="rgba(255,68,68,0.15)" stroke="#ff4444" stroke-width="1.5" stroke-dasharray="4,3"/>';
    }

    // User polygon
    svg += '<polygon points="' + polyPoints(userVals) + '" fill="rgba(0,255,136,0.15)" stroke="#00ff88" stroke-width="2"/>';

    // Dots + labels
    for (var k = 0; k < n; k++) {
      var up = polarToXY(k * angleStep, (userVals[k] / 100) * maxR);
      svg += '<circle cx="' + up.x + '" cy="' + up.y + '" r="3.5" fill="#00ff88"/>';

      var lp = polarToXY(k * angleStep, maxR + 16);
      svg += '<text x="' + lp.x + '" y="' + lp.y + '" text-anchor="middle" fill="#888" font-size="9" font-family="sans-serif">' + dims[k] + '</text>';
    }

    // Legend
    svg += '<rect x="8" y="255" width="10" height="10" fill="rgba(0,255,136,0.5)" rx="2"/>';
    svg += '<text x="22" y="264" fill="#888" font-size="9" font-family="sans-serif">You</text>';
    svg += '<rect x="55" y="255" width="10" height="10" fill="rgba(255,68,68,0.3)" rx="2"/>';
    svg += '<text x="69" y="264" fill="#888" font-size="9" font-family="sans-serif">Avg Competitor</text>';

    svg += '</svg>';
    return svg;
  }

  // ─── Generate Recommendations ───────────────────────────────────────

  function generateRecommendations(profileData, comparisons) {
    var recs = [];
    var userRate = parseRate(profileData.hourlyRate);
    var userJSS = profileData.jobSuccess || 0;

    var cheaperCount = comparisons.filter(function (c) { return c.rateComparison === 'lower'; }).length;
    var betterJSSCount = comparisons.filter(function (c) { return c.jssComparison === 'lower'; }).length;
    var strongCount = comparisons.filter(function (c) { return c.threatLevel === 'strong competitor'; }).length;

    // Rate-based
    if (cheaperCount >= 3) {
      recs.push('Your rate is higher than most competitors. Emphasize unique value, niche expertise, and premium deliverables to justify pricing.');
    } else if (cheaperCount === 0 && userRate > 0) {
      recs.push('Your rate is competitive! Consider raising it gradually — you\'re priced below most in your space.');
    }

    // JSS-based
    if (betterJSSCount >= 2) {
      recs.push('Several competitors have higher Job Success Scores. Focus on 5-star feedback, timely delivery, and proactive communication to boost yours.');
    } else if (userJSS >= 95) {
      recs.push('Your JSS is top-tier! Feature it prominently in your profile overview and proposals.');
    }

    // Skill overlap
    var avgOverlap = comparisons.reduce(function (sum, c) { return sum + c.skillOverlap; }, 0) / (comparisons.length || 1);
    if (avgOverlap > 70) {
      recs.push('High skill overlap with competitors. Differentiate by adding a niche specialization or certifications others don\'t have.');
    } else if (avgOverlap < 30) {
      recs.push('Low skill overlap — you\'re in a unique niche. Double down on this positioning in your title and proposals.');
    }

    // Strong competitors
    if (strongCount >= 3) {
      recs.push('Tough competition in this space. Consider narrowing your niche, creating portfolio case studies, or targeting a different client segment.');
    }

    // Portfolio
    if (!profileData.portfolioCount || profileData.portfolioCount < 3) {
      recs.push('Add portfolio pieces showcasing your best work — competitors with portfolios get 2-3× more invites.');
    }

    // General
    if (recs.length < 3) {
      recs.push('Regularly update your profile title and overview to match trending job descriptions in your field.');
    }

    return recs;
  }

  // ─── Render Competition Radar ───────────────────────────────────────

  function renderCompetitionRadar(profileData, container) {
    injectStyles();
    container.innerHTML = '<div class="competition-radar">' +
      '<div class="cr-header">👥 Your Competition</div>' +
      '<div class="cr-loading"><div class="spinner"></div><br>Searching for similar freelancers…</div>' +
      '</div>';

    fetchCompetitors(profileData)
      .then(function (competitors) {
        if (!competitors || competitors.length === 0) {
          container.querySelector('.cr-loading').innerHTML = '<div class="cr-error">No competitors found. Try adding more skills to your profile.</div>';
          return;
        }

        var comparisons = compareWithUser(profileData, competitors);
        var recs = generateRecommendations(profileData, comparisons);

        var h = '<div class="competition-radar">';
        h += '<div class="cr-header">👥 Your Competition</div>';

        // Radar chart + insights
        h += '<div class="cr-radar-section">';
        h += '<div class="cr-radar-chart">' + renderRadarSVG(profileData, comparisons) + '</div>';
        h += '<div class="cr-insights">';
        h += '<div class="cr-insight-title">💡 How to Stand Out</div>';
        h += '<ul class="cr-rec-list">';
        recs.forEach(function (r) {
          h += '<li>' + escHtml(r) + '</li>';
        });
        h += '</ul></div></div>';

        // Comparison table
        h += '<div class="cr-table-wrap"><table class="cr-table">';
        h += '<thead><tr><th>Freelancer</th><th>Rate</th><th>JSS</th><th>Earnings</th><th>Skills Match</th><th>Threat Level</th></tr></thead>';
        h += '<tbody>';

        // User row
        h += '<tr class="cr-you">';
        h += '<td>⭐ ' + escHtml(profileData.name || 'You') + '</td>';
        h += '<td>' + escHtml(profileData.hourlyRate || '—') + '</td>';
        h += '<td>' + (profileData.jobSuccess ? profileData.jobSuccess + '%' : '—') + '</td>';
        h += '<td>' + escHtml(profileData.totalEarnings || '—') + '</td>';
        h += '<td>—</td><td>—</td>';
        h += '</tr>';

        // Competitor rows
        comparisons.forEach(function (c) {
          var threatCls = c.threatLevel === 'strong competitor' ? 'cr-threat-strong' : (c.threatLevel === 'similar' ? 'cr-threat-similar' : 'cr-threat-ahead');
          var rateCls = c.rateComparison === 'lower' ? 'cr-worse' : (c.rateComparison === 'higher' ? 'cr-better' : 'cr-similar');
          var jssCls = c.jssComparison === 'lower' ? 'cr-worse' : (c.jssComparison === 'higher' ? 'cr-better' : 'cr-similar');
          var earnCls = c.earningsComparison === 'lower' ? 'cr-worse' : (c.earningsComparison === 'higher' ? 'cr-better' : 'cr-similar');

          h += '<tr>';
          h += '<td>';
          if (c.profileUrl) {
            h += '<a href="' + escHtml(c.profileUrl) + '" target="_blank" style="color:#8ab4f8;text-decoration:none">' + escHtml(c.name || 'Unknown') + '</a>';
          } else {
            h += escHtml(c.name || 'Unknown');
          }
          h += '</td>';
          h += '<td class="' + rateCls + '">' + escHtml(c.rate || '—') + '</td>';
          h += '<td class="' + jssCls + '">' + (c.jss ? c.jss + '%' : '—') + '</td>';
          h += '<td class="' + earnCls + '">' + escHtml(c.earnings || '—') + '</td>';
          h += '<td>' + c.skillOverlap + '%</td>';
          h += '<td><span class="' + threatCls + '">' + escHtml(c.threatLevel) + '</span></td>';
          h += '</tr>';
        });

        h += '</tbody></table></div>';
        h += '</div>';

        container.innerHTML = h;
      })
      .catch(function (err) {
        console.error('[UW-007] Competition radar error:', err);
        var loadingEl = container.querySelector('.cr-loading');
        if (loadingEl) {
          loadingEl.innerHTML = '<div class="cr-error">⚠️ Could not fetch competitors. Make sure the local proxy is running on port 3848.</div>';
        }
      });
  }

  // ─── Public API ─────────────────────────────────────────────────────
  window.CortexCompetitionRadar = {
    fetchCompetitors: fetchCompetitors,
    compareWithUser: compareWithUser,
    renderCompetitionRadar: renderCompetitionRadar,
  };

})();
