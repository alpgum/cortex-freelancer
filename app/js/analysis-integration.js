/**
 * [U-006] Frontend — Real Analysis Integration
 *
 * Connects scoring-engine.js + completeness-checker.js to the landing page UI.
 * Replaces mock analysis flow with real API calls + client-side scoring.
 */

(function () {
  'use strict';

  // ─── Refs ──────────────────────────────────────────────────────────
  var scoreProfile = window.CortexScoringEngine && window.CortexScoringEngine.scoreProfile;
  var checkCompleteness = window.CortexCompletenessChecker && window.CortexCompletenessChecker.checkCompleteness;

  if (!scoreProfile) console.warn('[U-006] CortexScoringEngine not loaded');
  if (!checkCompleteness) console.warn('[U-006] CortexCompletenessChecker not loaded');

  // ─── Helpers ───────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function fmt$(n) { return '$' + (n || 0).toLocaleString('en-US'); }

  // ─── Build profile object for scoring engine ─────────────────────
  function apiDataToScoringProfile(data) {
    // Parse hourly rate string → number
    var rate = 0;
    if (data.hourlyRate) {
      rate = parseFloat(String(data.hourlyRate).replace(/[^0-9.]/g, '')) || 0;
    }

    // Parse total earnings
    var earnings = 0;
    if (data.totalEarnings) {
      var es = String(data.totalEarnings).toLowerCase();
      if (es.includes('m')) earnings = parseFloat(es.replace(/[^0-9.]/g, '')) * 1000000;
      else if (es.includes('k')) earnings = parseFloat(es.replace(/[^0-9.]/g, '')) * 1000;
      else earnings = parseFloat(es.replace(/[^0-9.]/g, '')) || 0;
    }

    return {
      name: data.name || '',
      title: data.title || '',
      description: data.description || '',
      hourlyRate: rate,
      jobSuccess: data.jobSuccess != null ? data.jobSuccess : null,
      totalEarnings: earnings,
      totalJobs: data.totalJobs || 0,
      totalHours: data.totalHours || 0,
      skills: data.skills || [],
      categories: data.categories || [],
      portfolio: (data.portfolio || []).map(function (p) {
        return { description: p.description || '', image: p.image || p.thumbnail || null };
      }),
      location: data.location || '',
      memberSince: data.memberSince || null,
    };
  }

  // ─── Error Messages ────────────────────────────────────────────────
  var ERROR_MESSAGES = {
    not_found: "We couldn't find this profile. Check the URL and try again.",
    blocked: "Upwork is temporarily blocking requests. Try again in a few minutes.",
    network: "Connection failed. Please check your internet.",
    generic: "Something went wrong analyzing your profile. Please try again.",
  };

  function classifyError(err, response) {
    if (!navigator.onLine) return 'network';
    if (response) {
      if (response.status === 404) return 'not_found';
      if (response.status === 429 || response.status === 403) return 'blocked';
    }
    if (err && err.message && /fetch|network|failed/i.test(err.message)) return 'network';
    return 'generic';
  }

  // ─── Loading State ─────────────────────────────────────────────────
  function showLoadingState(btn, origText) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> <span class="analyze-progress-text">Fetching your profile...</span>';
    var errEl = $('error-message');
    if (errEl) errEl.style.display = 'none';
    // Hide any previous results
    var resultsEl = $('real-analysis-results');
    if (resultsEl) resultsEl.style.display = 'none';
  }

  function updateProgress(btn, text) {
    var span = btn.querySelector('.analyze-progress-text');
    if (span) span.textContent = text;
  }

  function resetButton(btn, origText) {
    btn.disabled = false;
    btn.textContent = origText;
  }

  function showError(type) {
    var el = $('error-message');
    if (!el) return;
    el.innerHTML = ERROR_MESSAGES[type] || ERROR_MESSAGES.generic;
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 8000);
  }

  // ─── Score Color ───────────────────────────────────────────────────
  function scoreColor(score) {
    if (score >= 80) return '#00ff88';
    if (score >= 60) return '#ffaa00';
    return '#ff4444';
  }

  function gradeColor(grade) {
    if (grade.startsWith('A')) return '#00ff88';
    if (grade.startsWith('B')) return '#88cc44';
    if (grade.startsWith('C')) return '#ffaa00';
    return '#ff4444';
  }

  // ─── Render: Profile Card ─────────────────────────────────────────
  function renderProfileCard(data) {
    var h = '<div class="real-profile-card">';
    h += '<div class="rpc-header">';
    h += '<div class="rpc-avatar">' + (data.name ? data.name.charAt(0).toUpperCase() : '?') + '</div>';
    h += '<div class="rpc-info">';
    h += '<div class="rpc-name">' + (data.name || 'Unknown') + '</div>';
    h += '<div class="rpc-title">' + (data.title || 'No title set') + '</div>';
    h += '</div></div>';

    h += '<div class="rpc-stats">';
    if (data.hourlyRate) h += '<div class="rpc-stat"><span class="rpc-stat-val">' + data.hourlyRate + '</span><span class="rpc-stat-lbl">Rate</span></div>';
    if (data.jobSuccess != null) h += '<div class="rpc-stat"><span class="rpc-stat-val" style="color:' + (data.jobSuccess >= 90 ? '#00ff88' : '#ffaa00') + '">' + data.jobSuccess + '%</span><span class="rpc-stat-lbl">Job Success</span></div>';
    if (data.totalEarnings) h += '<div class="rpc-stat"><span class="rpc-stat-val">' + data.totalEarnings + '</span><span class="rpc-stat-lbl">Earned</span></div>';
    if (data.totalJobs) h += '<div class="rpc-stat"><span class="rpc-stat-val">' + data.totalJobs + '</span><span class="rpc-stat-lbl">Jobs</span></div>';
    if (data.location) h += '<div class="rpc-stat"><span class="rpc-stat-val" style="font-size:0.9rem">' + data.location + '</span><span class="rpc-stat-lbl">Location</span></div>';
    h += '</div>';

    if (data.skills && data.skills.length) {
      h += '<div class="rpc-skills">';
      data.skills.slice(0, 10).forEach(function (s) {
        h += '<span class="rpc-skill-tag">' + s + '</span>';
      });
      if (data.skills.length > 10) h += '<span class="rpc-skill-tag rpc-dim">+' + (data.skills.length - 10) + ' more</span>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  // ─── Render: Score Wheel ──────────────────────────────────────────
  function renderScoreWheel(overall, grade) {
    var color = scoreColor(overall);
    var gc = gradeColor(grade);
    var h = '<div class="real-score-section">';
    h += '<div class="real-score-wheel">';
    h += '<svg viewBox="0 0 120 120" width="200" height="200">';
    h += '<circle cx="60" cy="60" r="52" fill="none" stroke="#222" stroke-width="10"/>';
    h += '<circle cx="60" cy="60" r="52" fill="none" stroke="url(#realScoreGrad)" stroke-width="10" stroke-linecap="round" ';
    h += 'stroke-dasharray="' + (2 * Math.PI * 52) + '" ';
    h += 'stroke-dashoffset="' + (2 * Math.PI * 52 * (1 - overall / 100)) + '" ';
    h += 'transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.5s ease-out"/>';
    h += '<defs><linearGradient id="realScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">';
    h += '<stop offset="0%" stop-color="#ff8844"/><stop offset="100%" stop-color="#00ff88"/>';
    h += '</linearGradient></defs>';
    h += '<text x="60" y="54" text-anchor="middle" fill="#fff" font-size="32" font-weight="800">' + overall + '</text>';
    h += '<text x="60" y="70" text-anchor="middle" fill="#888" font-size="12">/100</text>';
    h += '<text x="60" y="92" text-anchor="middle" fill="' + gc + '" font-size="18" font-weight="800">' + grade + '</text>';
    h += '</svg></div>';
    h += '<div class="real-score-label">Overall Profile Score</div>';
    h += '</div>';
    return h;
  }

  // ─── Render: Category Breakdown Bars ──────────────────────────────
  function renderCategoryBars(categories) {
    var labels = {
      jobSuccess: { name: 'Job Success', weight: '25%' },
      rate: { name: 'Hourly Rate', weight: '20%' },
      earnings: { name: 'Earnings', weight: '15%' },
      profileCompleteness: { name: 'Profile Completeness', weight: '15%' },
      skills: { name: 'Skills & Demand', weight: '10%' },
      portfolio: { name: 'Portfolio', weight: '10%' },
      tenureActivity: { name: 'Tenure & Activity', weight: '5%' },
    };

    var h = '<div class="real-categories">';
    h += '<h3 class="real-section-title">Score Breakdown</h3>';

    Object.keys(labels).forEach(function (key) {
      var cat = categories[key];
      if (!cat) return;
      var info = labels[key];
      var color = scoreColor(cat.score);
      h += '<div class="real-cat-item">';
      h += '<div class="real-cat-header">';
      h += '<span class="real-cat-name">' + info.name + ' <span class="real-cat-weight">(' + info.weight + ')</span></span>';
      h += '<span class="real-cat-score" style="color:' + color + '">' + cat.score + '</span>';
      h += '</div>';
      h += '<div class="real-cat-bar"><div class="real-cat-fill" style="width:' + cat.score + '%;background:' + color + '"></div></div>';
      h += '<div class="real-cat-detail">' + (cat.details || '') + '</div>';
      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  // ─── Render: Completeness Checklist ───────────────────────────────
  function renderCompletenessChecklist(completeness) {
    if (!completeness) return '';
    var h = '<div class="real-completeness">';
    h += '<h3 class="real-section-title">Profile Completeness <span style="color:' + scoreColor(completeness.score) + ';font-size:1rem;margin-left:0.5rem">' + completeness.score + '% (' + completeness.grade + ')</span></h3>';

    if (completeness.quickWins && completeness.quickWins.length) {
      h += '<div class="real-quickwins">';
      h += '<div class="real-quickwins-title">⚡ Quick Wins</div>';
      completeness.quickWins.forEach(function (qw) {
        h += '<div class="real-quickwin-item">' + qw + '</div>';
      });
      h += '</div>';
    }

    h += '<div class="real-checklist">';
    completeness.items.forEach(function (item) {
      var icon = item.status === 'pass' ? '✅' : item.status === 'bonus' ? '⭐' : '❌';
      var cls = item.status === 'fail' ? 'real-check-fail' : 'real-check-pass';
      h += '<div class="real-check-item ' + cls + '">';
      h += '<span class="real-check-icon">' + icon + '</span>';
      h += '<div class="real-check-content">';
      h += '<div class="real-check-name">' + item.name + ' <span class="real-check-weight">(+' + item.weight + ' pts)</span></div>';
      h += '<div class="real-check-detail">' + item.detail + '</div>';
      h += '</div></div>';
    });
    h += '</div>';

    if (completeness.missing && completeness.missing.length) {
      h += '<div class="real-missing">';
      h += '<div class="real-missing-title">📋 Missing Items</div>';
      completeness.missing.forEach(function (m) {
        h += '<div class="real-missing-item">• ' + m + '</div>';
      });
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  // ─── Render: Recommendations ──────────────────────────────────────
  function renderRecommendations(recommendations, aiRecs) {
    var recs = recommendations || [];
    var h = '<div class="real-recommendations">';
    h += '<h3 class="real-section-title">🎯 Top Recommendations</h3>';

    if (aiRecs && aiRecs.length) {
      h += '<div class="real-ai-recs">';
      h += '<div class="real-ai-badge">✨ AI-Powered Insights</div>';
      aiRecs.forEach(function (rec) {
        h += '<div class="real-rec-card real-rec-ai">';
        h += '<div class="real-rec-text">' + rec + '</div>';
        h += '</div>';
      });
      h += '</div>';
    }

    recs.forEach(function (rec, i) {
      var prioColor = rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8844' : rec.priority === 'medium' ? '#ffaa00' : '#888';
      h += '<div class="real-rec-card">';
      h += '<div class="real-rec-header">';
      h += '<span class="real-rec-num">' + (i + 1) + '</span>';
      h += '<span class="real-rec-title">' + rec.title + '</span>';
      h += '<span class="real-rec-prio" style="color:' + prioColor + '">' + rec.priority.toUpperCase() + '</span>';
      h += '</div>';
      h += '<div class="real-rec-desc">' + rec.description + '</div>';
      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  // ─── Render: Strengths & Weaknesses ───────────────────────────────
  function renderStrengthsWeaknesses(strengths, weaknesses) {
    var h = '<div class="real-sw-grid">';

    h += '<div class="real-sw-col real-strengths">';
    h += '<h3 class="real-section-title" style="color:#00ff88">💪 Strengths</h3>';
    if (strengths && strengths.length) {
      strengths.forEach(function (s) {
        h += '<div class="real-sw-item real-sw-good">✓ ' + s + '</div>';
      });
    } else {
      h += '<div class="real-sw-item real-sw-neutral">Complete more contracts to reveal strengths</div>';
    }
    h += '</div>';

    h += '<div class="real-sw-col real-weaknesses">';
    h += '<h3 class="real-section-title" style="color:#ff4444">⚠️ Areas to Improve</h3>';
    if (weaknesses && weaknesses.length) {
      weaknesses.forEach(function (w) {
        h += '<div class="real-sw-item real-sw-bad">✗ ' + w + '</div>';
      });
    } else {
      h += '<div class="real-sw-item real-sw-neutral">Great — no major weaknesses found!</div>';
    }
    h += '</div>';

    h += '</div>';
    return h;
  }

  // ─── Render: Share Button ──────────────────────────────────────────
  function renderShareButton(overall, grade) {
    var h = '<div class="real-share-section">';
    h += '<button class="real-share-btn" onclick="window.CortexAnalysisIntegration.shareScore()">';
    h += '📤 Share Your Score (' + overall + '/100 — ' + grade + ')';
    h += '</button>';
    h += '</div>';
    return h;
  }

  // ─── Ensure Results Container Exists ──────────────────────────────
  function ensureResultsContainer() {
    var existing = $('real-analysis-results');
    if (existing) return existing;

    var container = document.createElement('div');
    container.id = 'real-analysis-results';
    container.className = 'real-analysis-results';
    container.style.display = 'none';

    // Insert after the input-section in the landing screen
    var inputSection = document.querySelector('.input-section');
    if (inputSection) {
      inputSection.parentNode.insertBefore(container, inputSection.nextSibling);
    }
    return container;
  }

  // ─── Main: Run Real Analysis ───────────────────────────────────────
  function runRealAnalysis(url) {
    var btn = document.querySelector('.btn-analyze');
    if (!btn) return;
    var origText = btn.textContent;

    showLoadingState(btn, origText);

    var response = null;

    fetch('/api/upwork-profile?url=' + encodeURIComponent(url))
      .then(function (res) {
        response = res;
        updateProgress(btn, 'Running analysis...');
        return res.json();
      })
      .then(function (json) {
        if (!response.ok || !json.success || !json.data) {
          var errType = classifyError(null, response);
          throw { type: errType };
        }

        var apiData = json.data;

        // 1. Score with scoring engine
        var scoringProfile = apiDataToScoringProfile(apiData);
        var scoreResult = null;
        if (scoreProfile) {
          try {
            scoreResult = scoreProfile(scoringProfile);
          } catch (e) {
            console.warn('[U-006] Scoring engine error:', e);
          }
        }

        // 2. Check completeness
        var completenessResult = null;
        if (checkCompleteness) {
          try {
            // Map fields for completeness checker
            var ccProfile = {
              title: apiData.title,
              description: apiData.description,
              skills: apiData.skills || [],
              portfolio: (apiData.portfolio || []).map(function (p) {
                return { description: p.description || '', image: p.image || null };
              }),
              jobSuccessScore: apiData.jobSuccess,
              hourlyRate: parseFloat(String(apiData.hourlyRate || '0').replace(/[^0-9.]/g, '')) || 0,
              location: apiData.location,
              categories: apiData.categories || [],
              memberSince: apiData.memberSince,
              totalJobs: apiData.totalJobs || 0,
              totalEarnings: apiData.totalEarnings,
            };
            completenessResult = checkCompleteness(ccProfile);
          } catch (e) {
            console.warn('[U-006] Completeness checker error:', e);
          }
        }

        // 3. Try AI recommendations (optional, don't block on failure)
        updateProgress(btn, 'Generating recommendations...');

        var aiRecsPromise = fetch('/api/analyze-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: apiData }),
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { return d && d.recommendations ? d.recommendations : null; })
          .catch(function () { return null; });

        return aiRecsPromise.then(function (aiRecs) {
          resetButton(btn, origText);
          renderResults(apiData, scoreResult, completenessResult, aiRecs);
        });
      })
      .catch(function (err) {
        resetButton(btn, origText);
        var errType = err && err.type ? err.type : classifyError(err, response);
        showError(errType);
      });
  }

  // ─── Render All Results ────────────────────────────────────────────
  function renderResults(apiData, scoreResult, completenessResult, aiRecs) {
    var container = ensureResultsContainer();
    var h = '';

    // Profile card
    h += renderProfileCard(apiData);

    // Score wheel (use scoring engine result, fallback to old engine)
    if (scoreResult) {
      h += renderScoreWheel(scoreResult.overall, scoreResult.grade);
      h += renderCategoryBars(scoreResult.categories);
      h += renderStrengthsWeaknesses(scoreResult.strengths, scoreResult.weaknesses);
      h += renderRecommendations(scoreResult.recommendations, aiRecs);
    }

    // Completeness checklist
    if (completenessResult) {
      h += renderCompletenessChecklist(completenessResult);
    }

    // Share button
    if (scoreResult) {
      h += renderShareButton(scoreResult.overall, scoreResult.grade);
    }

    container.innerHTML = h;
    container.style.display = 'block';

    // Store for share functionality
    window._realAnalysisData = {
      apiData: apiData,
      scoreResult: scoreResult,
      completenessResult: completenessResult,
    };

    // Smooth scroll to results
    setTimeout(function () {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // Fire analytics
    if (typeof gtag === 'function' && scoreResult) {
      gtag('event', 'real_analysis_complete', {
        score: scoreResult.overall,
        grade: scoreResult.grade,
      });
    }
  }

  // ─── Share Functionality ──────────────────────────────────────────
  function shareScore() {
    var data = window._realAnalysisData;
    if (!data || !data.scoreResult) return;

    var sr = data.scoreResult;
    var shareData = {
      s: sr.overall,
      g: sr.grade,
      strengths: (sr.strengths || []).length,
      weaknesses: (sr.weaknesses || []).length,
    };
    var shareURL = location.origin + '/app/share.html#' + btoa(JSON.stringify(shareData));

    // Try native share first
    if (navigator.share) {
      navigator.share({
        title: 'My Freelancer Score: ' + sr.overall + '/100 (' + sr.grade + ')',
        text: 'I scored ' + sr.overall + '/100 on Cortex Freelancer! Get your free analysis:',
        url: shareURL,
      }).catch(function () {
        copyToClipboard(shareURL);
      });
    } else {
      copyToClipboard(shareURL);
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        if (typeof toast === 'function') toast('Link copied!');
      });
    }
  }

  // ─── Hook into existing analyzeFromURL ─────────────────────────────
  // We intercept the analyze flow. If a valid Upwork URL is entered,
  // run real analysis. Otherwise fall back to the existing engine.

  var _origAnalyzeFromURL = window.analyzeFromURL;

  window.analyzeFromURL = function () {
    var url = (document.getElementById('upwork-url').value || '').trim();
    if (!url) {
      if (typeof toast === 'function') toast('Please enter a URL or use manual form');
      return;
    }

    // Check if scoring engine is available and it's an Upwork URL
    var isUpwork = /upwork\.com\/(freelancers|fl)\//.test(url);

    if (isUpwork && scoreProfile) {
      runRealAnalysis(url);
    } else {
      // Fall back to the original mock analysis
      if (_origAnalyzeFromURL) _origAnalyzeFromURL();
    }
  };

  // ─── Public API ────────────────────────────────────────────────────
  window.CortexAnalysisIntegration = {
    runRealAnalysis: runRealAnalysis,
    shareScore: shareScore,
  };

})();
