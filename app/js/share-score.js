/**
 * Cortex Freelancer — Share Score & Save Analysis
 * [U-010] Save analysis history + shareable score card + social sharing
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_analyses';
  var MAX_ANALYSES = 10;
  var CARD_W = 600;
  var CARD_H = 315;
  var SITE_URL = 'https://cortexfreelancer.com';

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Simple short hash from string (DJB2-ish) */
  function shortHash(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
    }
    return hash.toString(36);
  }

  function getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /** Normalize a score to 0-100 range (engine may use 0-10) */
  function normalizeScore(result) {
    if (!result) return 0;
    var s = result.totalScore || result.score || 0;
    return s <= 10 ? Math.round(s * 10) : Math.round(s);
  }

  // ─── 1) saveAnalysis ─────────────────────────────────────────────

  /**
   * Save analysis to localStorage.
   * @param {Object} profileData   - parsed profile (name, title, url, etc.)
   * @param {Object} scoringResult - scoring engine output
   * @param {Object} completenessResult - completeness checker output (optional)
   * @returns {string} analysisId  - short hash ID
   */
  function saveAnalysis(profileData, scoringResult, completenessResult) {
    var timestamp = new Date().toISOString();
    var profileUrl = (profileData && profileData.url) || '';
    var score = normalizeScore(scoringResult);
    var grade = getGrade(score);

    var analysisId = shortHash(profileUrl + timestamp);

    var entry = {
      id: analysisId,
      timestamp: timestamp,
      profileUrl: profileUrl,
      name: (profileData && profileData.name) || '',
      title: (profileData && profileData.title) || '',
      score: score,
      grade: grade,
      categories: extractTopCategories(scoringResult),
      completeness: completenessResult
        ? (completenessResult.percentage || completenessResult.score || null)
        : null
    };

    try {
      var analyses = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      analyses.unshift(entry);
      if (analyses.length > MAX_ANALYSES) {
        analyses = analyses.slice(0, MAX_ANALYSES);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
    } catch (e) {
      // Storage full or unavailable — silently fail
    }

    return analysisId;
  }

  /** Pull top 3 category scores from scoring result */
  function extractTopCategories(result) {
    if (!result) return [];
    var cats = [];

    // Try breakdown array first
    if (result.categories && Array.isArray(result.categories)) {
      cats = result.categories.map(function (c) {
        return { label: c.label || c.name, score: c.score };
      });
    } else {
      // Fallback: pluck known keys from the scoring engine
      var keys = [
        { key: 'headline', label: 'Headline' },
        { key: 'overview', label: 'Overview' },
        { key: 'skillsScore', label: 'Skills' },
        { key: 'portfolio', label: 'Portfolio' },
        { key: 'rateScore', label: 'Rate' },
        { key: 'experience', label: 'Experience' },
        { key: 'reviews', label: 'Reviews' }
      ];
      keys.forEach(function (k) {
        if (typeof result[k.key] === 'number') {
          cats.push({ label: k.label, score: result[k.key] });
        }
      });
    }

    // Sort descending, take top 3
    cats.sort(function (a, b) { return b.score - a.score; });
    return cats.slice(0, 3);
  }

  // ─── 2) generateShareCard ────────────────────────────────────────

  /**
   * Generate a 600×315 canvas-based share card image.
   * @param {Object} profileData   - { name, title }
   * @param {Object} scoringResult - scoring engine output
   * @returns {{ dataUrl: string, download: Function }}
   */
  function generateShareCard(profileData, scoringResult) {
    var score = normalizeScore(scoringResult);
    var grade = getGrade(score);
    var name = (profileData && profileData.name) || 'Freelancer';
    var title = (profileData && profileData.title) || '';
    var topCats = extractTopCategories(scoringResult);

    var canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext('2d');

    // ── Background
    var bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, '#0a0a0a');
    bg.addColorStop(1, '#141414');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // ── Border accent
    var borderGrad = ctx.createLinearGradient(0, 0, CARD_W, 0);
    borderGrad.addColorStop(0, '#ff8844');
    borderGrad.addColorStop(1, '#00ff88');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, CARD_W - 3, CARD_H - 3);

    // ── Score circle (right side)
    var cx = 480, cy = 110, r = 55;

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Score arc
    var pct = score / 100;
    var endAngle = -Math.PI / 2 + pct * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
    var arcGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    arcGrad.addColorStop(0, '#ff8844');
    arcGrad.addColorStop(1, '#00ff88');
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score number
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(score, cx, cy + 4);
    ctx.fillStyle = '#888';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('/100', cx, cy + 22);

    // Grade badge
    ctx.fillStyle = score >= 80 ? '#00ff88' : score >= 60 ? '#ffaa00' : '#ff4444';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(grade, cx, cy + 48);
    ctx.textAlign = 'left';

    // ── Left side text
    // "Cortex Score"
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('CORTEX SCORE', 32, 42);

    // Score headline
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(score + '/100 (' + grade + ')', 32, 78);

    // Name
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, sans-serif';
    var displayName = name.length > 30 ? name.substring(0, 28) + '…' : name;
    ctx.fillText(displayName, 32, 110);

    // Title
    if (title) {
      ctx.fillStyle = '#888';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      var displayTitle = title.length > 40 ? title.substring(0, 38) + '…' : title;
      ctx.fillText(displayTitle, 32, 132);
    }

    // ── Top 3 categories
    var catY = 165;
    ctx.fillStyle = '#666';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('TOP CATEGORIES', 32, catY);
    catY += 20;

    topCats.forEach(function (cat) {
      var catScore = cat.score <= 10 ? Math.round(cat.score * 10) : Math.round(cat.score);
      var barW = 200;
      var barH = 14;

      // Label
      ctx.fillStyle = '#ccc';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(cat.label, 32, catY + 11);

      // Bar background
      ctx.fillStyle = '#1a1a1a';
      roundRect(ctx, 150, catY, barW, barH, 4);

      // Bar fill
      var fillW = (catScore / 100) * barW;
      var barGrad = ctx.createLinearGradient(150, catY, 150 + barW, catY);
      barGrad.addColorStop(0, '#ff8844');
      barGrad.addColorStop(1, '#00ff88');
      ctx.fillStyle = barGrad;
      roundRect(ctx, 150, catY, Math.max(fillW, 4), barH, 4);

      // Score text
      ctx.fillStyle = '#aaa';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(catScore + '%', 150 + barW + 8, catY + 11);

      catY += 28;
    });

    // ── Bottom brand bar
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, CARD_H - 38, CARD_W, 38);
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('CORTEX FREELANCER', 32, CARD_H - 14);
    ctx.fillStyle = '#555';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('cortexfreelancer.com', CARD_W - 32, CARD_H - 14);
    ctx.textAlign = 'left';

    var dataUrl = canvas.toDataURL('image/png');

    return {
      dataUrl: dataUrl,
      download: function () {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'cortex-score-' + score + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
  }

  /** Helper: rounded rectangle fill */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  // ─── 3) getShareLinks ────────────────────────────────────────────

  /**
   * Generate social share URLs.
   * @param {number} score      - 0-100
   * @param {string} grade      - letter grade
   * @param {string} profileUrl - original profile URL (optional)
   * @returns {{ twitter: string, linkedin: string, copyLink: string }}
   */
  function getShareLinks(score, grade, profileUrl) {
    var shareText = 'I scored ' + score + '/100 (' + grade + ') on my freelance profile! Get your free analysis → cortexfreelancer.com';
    var linkedinText = 'I just scored ' + score + '/100 (' + grade + ') on my freelancer profile analysis. Free tool for freelancers → cortexfreelancer.com';
    var shareUrl = SITE_URL + '/app/?ref=share&score=' + score;

    var twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(shareUrl);
    var linkedinUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl);

    return {
      twitter: twitterUrl,
      linkedin: linkedinUrl,
      copyLink: shareUrl
    };
  }

  // ─── 4) UI: Render Share Section ─────────────────────────────────

  /**
   * Render the "Share Your Score" section into #share-score-section.
   * Call after analysis completes.
   */
  function renderShareSection(profileData, scoringResult, completenessResult) {
    var container = document.getElementById('share-score-section');
    if (!container) return;

    var score = normalizeScore(scoringResult);
    var grade = getGrade(score);
    var links = getShareLinks(score, grade, profileData && profileData.url);

    // Save to history
    saveAnalysis(profileData, scoringResult, completenessResult);

    // Generate share card
    var card = generateShareCard(profileData, scoringResult);

    container.innerHTML =
      '<h3 class="share-title">Share Your Score</h3>' +
      '<div class="share-card-preview">' +
        '<img src="' + card.dataUrl + '" alt="Score card: ' + score + '/100" style="width:100%;max-width:400px;border-radius:8px;border:1px solid var(--border)">' +
      '</div>' +
      '<div class="share-buttons">' +
        '<button class="share-btn share-btn-twitter" id="share-twitter-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
          ' Share on X' +
        '</button>' +
        '<button class="share-btn share-btn-linkedin" id="share-linkedin-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
          ' Share on LinkedIn' +
        '</button>' +
        '<button class="share-btn share-btn-download" id="share-download-btn">' +
          '📷 Download Card' +
        '</button>' +
        '<button class="share-btn share-btn-copy" id="share-copy-btn">' +
          '🔗 Copy Link' +
        '</button>' +
      '</div>';

    container.style.display = 'block';

    // Bind events
    document.getElementById('share-twitter-btn').onclick = function () {
      window.open(links.twitter, '_blank', 'width=600,height=400');
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'twitter', score: score });
    };
    document.getElementById('share-linkedin-btn').onclick = function () {
      window.open(links.linkedin, '_blank', 'width=600,height=400');
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'linkedin', score: score });
    };
    document.getElementById('share-download-btn').onclick = function () {
      card.download();
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'download', score: score });
    };
    document.getElementById('share-copy-btn').onclick = function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(links.copyLink).then(function () {
          toast('Link copied!');
        });
      } else {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = links.copyLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('Link copied!');
      }
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'copy_link', score: score });
    };
  }

  // ─── 5) LinkedIn-optimized Card (1200×627) ────────────────────────

  /**
   * Generate a LinkedIn-optimized 1200×627 share card.
   * Larger format with more detail for professional network sharing.
   */
  function generateLinkedInCard(profileData, scoringResult) {
    var LI_W = 1200;
    var LI_H = 627;
    var score = normalizeScore(scoringResult);
    var grade = getGrade(score);
    var name = (profileData && profileData.name) || 'Freelancer';
    var title = (profileData && profileData.title) || '';
    var topCats = extractTopCategories(scoringResult);

    var canvas = document.createElement('canvas');
    canvas.width = LI_W;
    canvas.height = LI_H;
    var ctx = canvas.getContext('2d');

    // ── Background gradient
    var bg = ctx.createLinearGradient(0, 0, LI_W, LI_H);
    bg.addColorStop(0, '#0a0a14');
    bg.addColorStop(0.5, '#0f1420');
    bg.addColorStop(1, '#0a1018');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LI_W, LI_H);

    // ── Decorative accent line (top)
    var topLine = ctx.createLinearGradient(0, 0, LI_W, 0);
    topLine.addColorStop(0, '#ff8844');
    topLine.addColorStop(0.5, '#ffaa66');
    topLine.addColorStop(1, '#00ff88');
    ctx.fillStyle = topLine;
    ctx.fillRect(0, 0, LI_W, 4);

    // ── Left panel: Profile info
    // Brand
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('CORTEX FREELANCER', 60, 60);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
    var displayName = name.length > 28 ? name.substring(0, 26) + '…' : name;
    ctx.fillText(displayName, 60, 120);

    // Title
    if (title) {
      ctx.fillStyle = '#999';
      ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
      var displayTitle = title.length > 45 ? title.substring(0, 43) + '…' : title;
      ctx.fillText(displayTitle, 60, 155);
    }

    // Score text
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Profile Analysis Score', 60, 210);

    // Large score display
    ctx.fillStyle = score >= 80 ? '#00ff88' : score >= 60 ? '#ffaa00' : '#ff4444';
    ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(score, 60, 290);

    ctx.fillStyle = '#666';
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
    var scoreWidth = ctx.measureText(String(score)).width;
    // Measure with the bold 72px font
    ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif';
    scoreWidth = ctx.measureText(String(score)).width;
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('/100', 60 + scoreWidth + 8, 290);

    // Grade badge
    ctx.fillStyle = score >= 80 ? '#00ff88' : score >= 60 ? '#ffaa00' : '#ff4444';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Grade: ' + grade, 60, 340);

    // ── Right panel: Score ring + categories
    var cx = 900, cy = 200, r = 100;

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Score arc
    var pct = score / 100;
    var endAngle = -Math.PI / 2 + pct * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
    var arcGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    arcGrad.addColorStop(0, '#ff8844');
    arcGrad.addColorStop(1, '#00ff88');
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score in center of ring
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(score, cx, cy + 8);
    ctx.fillStyle = '#888';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('OUT OF 100', cx, cy + 34);
    ctx.textAlign = 'left';

    // ── Category bars (below ring)
    var catStartY = 370;
    var catStartX = 700;

    ctx.fillStyle = '#555';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('CATEGORY BREAKDOWN', catStartX, catStartY);
    catStartY += 30;

    topCats.forEach(function (cat) {
      var catScore = cat.score <= 10 ? Math.round(cat.score * 10) : Math.round(cat.score);
      var barW = 350;
      var barH = 20;

      // Label
      ctx.fillStyle = '#ddd';
      ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(cat.label, catStartX, catStartY + 15);

      // Bar track
      ctx.fillStyle = '#1a1a2a';
      roundRect(ctx, catStartX + 160, catStartY, barW - 160, barH, 6);

      // Bar fill
      var fillW = (catScore / 100) * (barW - 160);
      var barGrad = ctx.createLinearGradient(catStartX + 160, catStartY, catStartX + barW, catStartY);
      barGrad.addColorStop(0, '#ff8844');
      barGrad.addColorStop(1, '#00ff88');
      ctx.fillStyle = barGrad;
      roundRect(ctx, catStartX + 160, catStartY, Math.max(fillW, 6), barH, 6);

      // Score label
      ctx.fillStyle = '#aaa';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(catScore + '%', catStartX + barW + 10, catStartY + 15);

      catStartY += 38;
    });

    // ── Bottom bar
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, LI_H - 50, LI_W, 50);
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('🚀 Get your free profile analysis', 60, LI_H - 20);
    ctx.fillStyle = '#555';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('cortexfreelancer.com', LI_W - 60, LI_H - 20);
    ctx.textAlign = 'left';

    var dataUrl = canvas.toDataURL('image/png');

    return {
      dataUrl: dataUrl,
      width: LI_W,
      height: LI_H,
      download: function () {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'cortex-score-linkedin-' + score + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
  }

  // ─── 6) Twitter-optimized Card (1200×675 / 2:1 summary_large_image) ───

  /**
   * Generate a Twitter/X-optimized share card (1200×675).
   */
  function generateTwitterCard(profileData, scoringResult) {
    var TW_W = 1200;
    var TW_H = 675;
    var score = normalizeScore(scoringResult);
    var grade = getGrade(score);
    var name = (profileData && profileData.name) || 'Freelancer';
    var title = (profileData && profileData.title) || '';

    var canvas = document.createElement('canvas');
    canvas.width = TW_W;
    canvas.height = TW_H;
    var ctx = canvas.getContext('2d');

    // ── Background
    var bg = ctx.createLinearGradient(0, 0, TW_W, TW_H);
    bg.addColorStop(0, '#0d0d1a');
    bg.addColorStop(1, '#1a0d0d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, TW_W, TW_H);

    // ── Decorative circles (subtle)
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    ctx.arc(TW_W - 100, 100, 300, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8844';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(100, TW_H - 100, 200, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff88';
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Center layout
    ctx.textAlign = 'center';

    // Brand
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('CORTEX FREELANCER', TW_W / 2, 70);

    // Score — big and bold
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(score, TW_W / 2, 240);

    ctx.fillStyle = '#666';
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('OUT OF 100', TW_W / 2, 280);

    // Grade pill
    var gradeColor = score >= 80 ? '#00ff88' : score >= 60 ? '#ffaa00' : '#ff4444';
    var pillW = 120, pillH = 44;
    var pillX = TW_W / 2 - pillW / 2;
    ctx.fillStyle = gradeColor;
    ctx.globalAlpha = 0.15;
    roundRect(ctx, pillX, 300, pillW, pillH, 22);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradeColor;
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Grade ' + grade, TW_W / 2, 330);

    // Name
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, sans-serif';
    var dName = name.length > 35 ? name.substring(0, 33) + '…' : name;
    ctx.fillText(dName, TW_W / 2, 400);

    // Title
    if (title) {
      ctx.fillStyle = '#888';
      ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
      var dTitle = title.length > 50 ? title.substring(0, 48) + '…' : title;
      ctx.fillText(dTitle, TW_W / 2, 432);
    }

    // CTA
    ctx.fillStyle = '#ff8844';
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Get your free profile analysis →', TW_W / 2, 520);

    // Bottom
    ctx.fillStyle = '#333';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('cortexfreelancer.com', TW_W / 2, TW_H - 40);
    ctx.textAlign = 'left';

    var dataUrl = canvas.toDataURL('image/png');

    return {
      dataUrl: dataUrl,
      width: TW_W,
      height: TW_H,
      download: function () {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'cortex-score-twitter-' + score + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
  }

  // ─── 7) Enhanced Share Section with Platform Cards ────────────────

  /**
   * Render enhanced share section with platform-specific card options.
   */
  function renderEnhancedShareSection(profileData, scoringResult, completenessResult) {
    var container = document.getElementById('share-score-section');
    if (!container) {
      renderShareSection(profileData, scoringResult, completenessResult);
      return;
    }

    var score = normalizeScore(scoringResult);
    var grade = getGrade(score);
    var links = getShareLinks(score, grade, profileData && profileData.url);

    saveAnalysis(profileData, scoringResult, completenessResult);

    var defaultCard = generateShareCard(profileData, scoringResult);
    var linkedinCard = generateLinkedInCard(profileData, scoringResult);
    var twitterCard = generateTwitterCard(profileData, scoringResult);

    container.innerHTML =
      '<h3 class="share-title">📤 Share Your Score</h3>' +
      '<div class="share-tabs">' +
        '<button class="share-tab active" data-tab="default">Standard</button>' +
        '<button class="share-tab" data-tab="linkedin">LinkedIn (1200×627)</button>' +
        '<button class="share-tab" data-tab="twitter">X/Twitter (1200×675)</button>' +
      '</div>' +
      '<div class="share-card-previews">' +
        '<div class="share-card-preview active" data-tab="default">' +
          '<img src="' + defaultCard.dataUrl + '" alt="Score card" style="width:100%;max-width:400px;border-radius:8px;border:1px solid var(--border,#333)">' +
        '</div>' +
        '<div class="share-card-preview" data-tab="linkedin" style="display:none">' +
          '<img src="' + linkedinCard.dataUrl + '" alt="LinkedIn card" style="width:100%;max-width:600px;border-radius:8px;border:1px solid var(--border,#333)">' +
        '</div>' +
        '<div class="share-card-preview" data-tab="twitter" style="display:none">' +
          '<img src="' + twitterCard.dataUrl + '" alt="Twitter card" style="width:100%;max-width:600px;border-radius:8px;border:1px solid var(--border,#333)">' +
        '</div>' +
      '</div>' +
      '<div class="share-buttons">' +
        '<button class="share-btn share-btn-twitter" id="share-twitter-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
          ' Share on X' +
        '</button>' +
        '<button class="share-btn share-btn-linkedin" id="share-linkedin-btn">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
          ' Share on LinkedIn' +
        '</button>' +
        '<button class="share-btn share-btn-download" id="share-download-btn">' +
          '📷 Download Card' +
        '</button>' +
        '<button class="share-btn share-btn-copy" id="share-copy-btn">' +
          '🔗 Copy Link' +
        '</button>' +
      '</div>';

    container.style.display = 'block';

    // Tab switching
    var tabs = container.querySelectorAll('.share-tab');
    var previews = container.querySelectorAll('.share-card-preview');
    var activeCard = { current: defaultCard };

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        previews.forEach(function (p) { p.style.display = 'none'; p.classList.remove('active'); });
        tab.classList.add('active');
        var preview = container.querySelector('.share-card-preview[data-tab="' + target + '"]');
        if (preview) { preview.style.display = 'block'; preview.classList.add('active'); }

        if (target === 'linkedin') activeCard.current = linkedinCard;
        else if (target === 'twitter') activeCard.current = twitterCard;
        else activeCard.current = defaultCard;
      });
    });

    // Button handlers
    document.getElementById('share-twitter-btn').onclick = function () {
      window.open(links.twitter, '_blank', 'width=600,height=400');
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'twitter', score: score });
    };
    document.getElementById('share-linkedin-btn').onclick = function () {
      window.open(links.linkedin, '_blank', 'width=600,height=400');
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'linkedin', score: score });
    };
    document.getElementById('share-download-btn').onclick = function () {
      activeCard.current.download();
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'download', score: score });
    };
    document.getElementById('share-copy-btn').onclick = function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(links.copyLink).then(function () {
          toast('Link copied!');
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = links.copyLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('Link copied!');
      }
      if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: 'copy_link', score: score });
    };
  }

  // ─── Exports ──────────────────────────────────────────────────────

  window.cortexShareScore = {
    saveAnalysis: saveAnalysis,
    generateShareCard: generateShareCard,
    generateLinkedInCard: generateLinkedInCard,
    generateTwitterCard: generateTwitterCard,
    getShareLinks: getShareLinks,
    renderShareSection: renderShareSection,
    renderEnhancedShareSection: renderEnhancedShareSection,
    normalizeScore: normalizeScore,
    getGrade: getGrade
  };

  // Also expose on CortexFreelancer namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ShareScore = window.cortexShareScore;

})();
