/**
 * Cortex Freelancer — Share Score Card to Social Media
 * [CF-077] Generate shareable image cards of profile score for LinkedIn/Twitter.
 *
 * Features:
 *   - Canvas-based card generation (600×315 default, 1200×627 LinkedIn, 1200×675 Twitter)
 *   - Score ring with gradient arc, grade badge, top-3 categories with progress bars
 *   - Social share URLs for Twitter/X and LinkedIn with pre-filled text
 *   - Analysis history in localStorage (last 10 entries)
 *   - Download as PNG with platform-optimized filenames
 *   - Clipboard copy for share link
 *   - Tab-based UI with live preview of each card format
 *   - GTM dataLayer events for analytics
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cortex_analyses';
  var MAX_ANALYSES = 10;
  var SITE_URL = 'https://cortexfreelancer.com';

  var CARD_SIZES = {
    default:  { w: 600,  h: 315 },
    linkedin: { w: 1200, h: 627 },
    twitter:  { w: 1200, h: 675 }
  };

  var _initialized = false;
  var _lastResult = null; // cached { profileData, scoringResult, completenessResult }

  // ─── Helpers ──────────────────────────────────────────────────────

  function shortHash(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
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

  function normalizeScore(result) {
    if (!result) return 0;
    var s = result.totalScore || result.score || 0;
    return s <= 10 ? Math.round(s * 10) : Math.round(s);
  }

  function gradeColor(score) {
    return score >= 80 ? '#00ff88' : score >= 60 ? '#ffaa00' : '#ff4444';
  }

  function extractTopCategories(result) {
    if (!result) return [];
    var cats = [];
    if (result.categories && Array.isArray(result.categories)) {
      cats = result.categories.map(function (c) { return { label: c.label || c.name, score: c.score }; });
    } else {
      [{ key: 'headline', label: 'Headline' }, { key: 'overview', label: 'Overview' },
       { key: 'skillsScore', label: 'Skills' }, { key: 'portfolio', label: 'Portfolio' },
       { key: 'rateScore', label: 'Rate' }, { key: 'experience', label: 'Experience' },
       { key: 'reviews', label: 'Reviews' }].forEach(function (k) {
        if (typeof result[k.key] === 'number') cats.push({ label: k.label, score: result[k.key] });
      });
    }
    cats.sort(function (a, b) { return b.score - a.score; });
    return cats.slice(0, 3);
  }

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

  function clampText(text, max) {
    return text && text.length > max ? text.substring(0, max - 1) + '…' : (text || '');
  }

  function toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:14px;z-index:99999;transition:opacity .3s';
    document.body.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, 2000);
  }

  function pushEvent(platform, score) {
    if (typeof dataLayer !== 'undefined') dataLayer.push({ event: 'share_score', platform: platform, score: score });
  }

  // ─── Analysis History ─────────────────────────────────────────────

  function saveAnalysis(profileData, scoringResult, completenessResult) {
    var timestamp = new Date().toISOString();
    var profileUrl = (profileData && profileData.url) || '';
    var score = normalizeScore(scoringResult);

    var entry = {
      id: shortHash(profileUrl + timestamp),
      timestamp: timestamp,
      profileUrl: profileUrl,
      name: (profileData && profileData.name) || '',
      title: (profileData && profileData.title) || '',
      score: score,
      grade: getGrade(score),
      categories: extractTopCategories(scoringResult),
      completeness: completenessResult ? (completenessResult.percentage || completenessResult.score || null) : null
    };

    try {
      var analyses = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      analyses.unshift(entry);
      if (analyses.length > MAX_ANALYSES) analyses = analyses.slice(0, MAX_ANALYSES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
    } catch (e) { /* full */ }

    return entry.id;
  }

  function getAnalysisHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }

  function clearAnalysisHistory() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ─── Card Drawing: Shared Primitives ──────────────────────────────

  function _drawScoreRing(ctx, cx, cy, r, score, lineWidth) {
    lineWidth = lineWidth || 8;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#222'; ctx.lineWidth = lineWidth; ctx.stroke();
    var pct = score / 100;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    var g = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    g.addColorStop(0, '#ff8844'); g.addColorStop(1, '#00ff88');
    ctx.strokeStyle = g; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.stroke();
  }

  function _drawCategoryBars(ctx, cats, x, y, barW, barH, gap) {
    cats.forEach(function (cat) {
      var cs = cat.score <= 10 ? Math.round(cat.score * 10) : Math.round(cat.score);
      ctx.fillStyle = '#ccc'; ctx.font = (barH - 2) + 'px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillText(cat.label, x, y + barH - 2);
      var bx = x + 120;
      ctx.fillStyle = '#1a1a1a'; roundRect(ctx, bx, y, barW, barH, barH / 2);
      var fw = Math.max((cs / 100) * barW, 4);
      var bg = ctx.createLinearGradient(bx, y, bx + barW, y);
      bg.addColorStop(0, '#ff8844'); bg.addColorStop(1, '#00ff88');
      ctx.fillStyle = bg; roundRect(ctx, bx, y, fw, barH, barH / 2);
      ctx.fillStyle = '#aaa'; ctx.font = (barH - 3) + 'px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillText(cs + '%', bx + barW + 8, y + barH - 2);
      y += gap;
    });
  }

  function _bgGradient(ctx, w, h, c1, c2) {
    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, c1 || '#0a0a0a'); bg.addColorStop(1, c2 || '#141414');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  }

  function _brandBar(ctx, w, h, barH) {
    barH = barH || 38;
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, h - barH, w, barH);
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 11px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('CORTEX FREELANCER', 32, h - barH / 2 + 4);
    ctx.fillStyle = '#555';
    ctx.font = '11px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('cortexfreelancer.com', w - 32, h - barH / 2 + 4);
    ctx.textAlign = 'left';
  }

  function _borderAccent(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#ff8844'); g.addColorStop(1, '#00ff88');
    ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  // ─── Card: Default 600×315 ────────────────────────────────────────

  function generateShareCard(profileData, scoringResult) {
    var W = CARD_SIZES.default.w, H = CARD_SIZES.default.h;
    var score = normalizeScore(scoringResult), grade = getGrade(score);
    var name = (profileData && profileData.name) || 'Freelancer';
    var title = (profileData && profileData.title) || '';
    var topCats = extractTopCategories(scoringResult);

    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    _bgGradient(ctx, W, H);
    _borderAccent(ctx, W, H);

    // Score ring (right)
    var cx = 480, cy = 110, r = 55;
    _drawScoreRing(ctx, cx, cy, r, score, 8);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(score, cx, cy + 4);
    ctx.fillStyle = '#888'; ctx.font = '12px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('/100', cx, cy + 22);
    ctx.fillStyle = gradeColor(score); ctx.font = 'bold 16px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(grade, cx, cy + 48);
    ctx.textAlign = 'left';

    // Left text
    ctx.fillStyle = '#ff8844'; ctx.font = 'bold 13px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('CORTEX SCORE', 32, 42);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(score + '/100 (' + grade + ')', 32, 78);
    ctx.fillStyle = '#e0e0e0'; ctx.font = '600 16px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(clampText(name, 30), 32, 110);
    if (title) { ctx.fillStyle = '#888'; ctx.font = '14px -apple-system,BlinkMacSystemFont,sans-serif'; ctx.fillText(clampText(title, 40), 32, 132); }

    // Categories
    ctx.fillStyle = '#666'; ctx.font = '11px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('TOP CATEGORIES', 32, 165);
    _drawCategoryBars(ctx, topCats, 32, 185, 200, 14, 28);

    _brandBar(ctx, W, H);

    var dataUrl = canvas.toDataURL('image/png');
    return { dataUrl: dataUrl, width: W, height: H, download: function () { _downloadPng(dataUrl, 'cortex-score-' + score + '.png'); } };
  }

  // ─── Card: LinkedIn 1200×627 ──────────────────────────────────────

  function generateLinkedInCard(profileData, scoringResult) {
    var W = CARD_SIZES.linkedin.w, H = CARD_SIZES.linkedin.h;
    var score = normalizeScore(scoringResult), grade = getGrade(score);
    var name = (profileData && profileData.name) || 'Freelancer';
    var title = (profileData && profileData.title) || '';
    var topCats = extractTopCategories(scoringResult);

    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    _bgGradient(ctx, W, H, '#0a0a14', '#0a1018');
    // Top accent
    var tl = ctx.createLinearGradient(0, 0, W, 0);
    tl.addColorStop(0, '#ff8844'); tl.addColorStop(1, '#00ff88');
    ctx.fillStyle = tl; ctx.fillRect(0, 0, W, 4);

    // Left panel
    ctx.fillStyle = '#ff8844'; ctx.font = 'bold 16px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('CORTEX FREELANCER', 60, 60);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(clampText(name, 28), 60, 120);
    if (title) { ctx.fillStyle = '#999'; ctx.font = '20px -apple-system,BlinkMacSystemFont,sans-serif'; ctx.fillText(clampText(title, 45), 60, 155); }
    ctx.fillStyle = '#e0e0e0'; ctx.font = '18px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('Profile Analysis Score', 60, 210);
    ctx.fillStyle = gradeColor(score); ctx.font = 'bold 72px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(String(score), 60, 290);
    var sw = ctx.measureText(String(score)).width;
    ctx.fillStyle = '#666'; ctx.font = '28px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('/100', 60 + sw + 8, 290);
    ctx.fillStyle = gradeColor(score); ctx.font = 'bold 32px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('Grade: ' + grade, 60, 340);

    // Right ring
    var cx = 900, cy = 200, r = 100;
    _drawScoreRing(ctx, cx, cy, r, score, 14);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(score, cx, cy + 8);
    ctx.fillStyle = '#888'; ctx.font = '16px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('OUT OF 100', cx, cy + 34);
    ctx.textAlign = 'left';

    // Category bars
    ctx.fillStyle = '#555'; ctx.font = '14px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('CATEGORY BREAKDOWN', 700, 370);
    var catY = 400;
    topCats.forEach(function (cat) {
      var cs = cat.score <= 10 ? Math.round(cat.score * 10) : Math.round(cat.score);
      ctx.fillStyle = '#ddd'; ctx.font = '15px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillText(cat.label, 700, catY + 15);
      ctx.fillStyle = '#1a1a2a'; roundRect(ctx, 860, catY, 190, 20, 6);
      var bg = ctx.createLinearGradient(860, catY, 1050, catY);
      bg.addColorStop(0, '#ff8844'); bg.addColorStop(1, '#00ff88');
      ctx.fillStyle = bg; roundRect(ctx, 860, catY, Math.max((cs / 100) * 190, 6), 20, 6);
      ctx.fillStyle = '#aaa'; ctx.font = '14px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillText(cs + '%', 1060, catY + 15);
      catY += 38;
    });

    // Bottom
    ctx.fillStyle = '#080810'; ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = '#ff8844'; ctx.font = 'bold 14px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('🚀 Get your free profile analysis', 60, H - 20);
    ctx.fillStyle = '#555'; ctx.font = '14px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign = 'right'; ctx.fillText('cortexfreelancer.com', W - 60, H - 20); ctx.textAlign = 'left';

    var dataUrl = canvas.toDataURL('image/png');
    return { dataUrl: dataUrl, width: W, height: H, download: function () { _downloadPng(dataUrl, 'cortex-score-linkedin-' + score + '.png'); } };
  }

  // ─── Card: Twitter/X 1200×675 ────────────────────────────────────

  function generateTwitterCard(profileData, scoringResult) {
    var W = CARD_SIZES.twitter.w, H = CARD_SIZES.twitter.h;
    var score = normalizeScore(scoringResult), grade = getGrade(score);
    var name = (profileData && profileData.name) || 'Freelancer';
    var title = (profileData && profileData.title) || '';

    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    _bgGradient(ctx, W, H, '#0d0d1a', '#1a0d0d');

    // Decorative circles
    ctx.globalAlpha = 0.05;
    ctx.beginPath(); ctx.arc(W - 100, 100, 300, 0, Math.PI * 2); ctx.fillStyle = '#ff8844'; ctx.fill();
    ctx.beginPath(); ctx.arc(100, H - 100, 200, 0, Math.PI * 2); ctx.fillStyle = '#00ff88'; ctx.fill();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8844'; ctx.font = 'bold 18px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('CORTEX FREELANCER', W / 2, 70);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 120px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(String(score), W / 2, 240);
    ctx.fillStyle = '#666'; ctx.font = '28px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('OUT OF 100', W / 2, 280);

    // Grade pill
    var gc = gradeColor(score);
    ctx.fillStyle = gc; ctx.globalAlpha = 0.15;
    roundRect(ctx, W / 2 - 60, 300, 120, 44, 22);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gc; ctx.font = 'bold 24px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('Grade ' + grade, W / 2, 330);

    ctx.fillStyle = '#e0e0e0'; ctx.font = '600 24px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText(clampText(name, 35), W / 2, 400);
    if (title) { ctx.fillStyle = '#888'; ctx.font = '18px -apple-system,BlinkMacSystemFont,sans-serif'; ctx.fillText(clampText(title, 50), W / 2, 432); }

    ctx.fillStyle = '#ff8844'; ctx.font = '600 20px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('Get your free profile analysis →', W / 2, 520);
    ctx.fillStyle = '#333'; ctx.font = '16px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillText('cortexfreelancer.com', W / 2, H - 40);
    ctx.textAlign = 'left';

    var dataUrl = canvas.toDataURL('image/png');
    return { dataUrl: dataUrl, width: W, height: H, download: function () { _downloadPng(dataUrl, 'cortex-score-twitter-' + score + '.png'); } };
  }

  function _downloadPng(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // ─── Share Links ──────────────────────────────────────────────────

  function getShareLinks(score, grade, profileUrl) {
    var shareUrl = SITE_URL + '/app/?ref=share&score=' + score;
    return {
      twitter: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('I scored ' + score + '/100 (' + grade + ') on my freelance profile! Get your free analysis → cortexfreelancer.com') + '&url=' + encodeURIComponent(shareUrl),
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl),
      copyLink: shareUrl
    };
  }

  // ─── UI: render(containerId) ──────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!_lastResult) {
      container.innerHTML = '<div style="padding:24px;color:#888;text-align:center">Run a profile analysis first to generate share cards.</div>';
      return;
    }

    var pd = _lastResult.profileData;
    var sr = _lastResult.scoringResult;
    var cr = _lastResult.completenessResult;
    var score = normalizeScore(sr);
    var grade = getGrade(score);
    var links = getShareLinks(score, grade, pd && pd.url);

    saveAnalysis(pd, sr, cr);

    var cards = {
      default: generateShareCard(pd, sr),
      linkedin: generateLinkedInCard(pd, sr),
      twitter: generateTwitterCard(pd, sr)
    };

    var html = '<div class="cf-share-score">';
    html += '<h3 style="margin:0 0 16px">📤 Share Your Score</h3>';

    // Tabs
    html += '<div class="cf-share-tabs" style="display:flex;gap:6px;margin-bottom:16px">';
    ['default', 'linkedin', 'twitter'].forEach(function (tab, i) {
      var labels = { default: 'Standard (600×315)', linkedin: 'LinkedIn (1200×627)', twitter: 'X / Twitter (1200×675)' };
      html += '<button class="cf-share-tab" data-tab="' + tab + '" style="padding:6px 14px;border:1px solid #333;border-radius:6px;background:' + (i === 0 ? '#222' : '#111') + ';color:#ccc;cursor:pointer;font-size:0.85em">' + labels[tab] + '</button>';
    });
    html += '</div>';

    // Previews
    ['default', 'linkedin', 'twitter'].forEach(function (tab, i) {
      html += '<div class="cf-share-preview" data-tab="' + tab + '" style="display:' + (i === 0 ? 'block' : 'none') + ';margin-bottom:16px">';
      html += '<img src="' + cards[tab].dataUrl + '" alt="' + tab + ' card" style="width:100%;max-width:' + (tab === 'default' ? '400' : '600') + 'px;border-radius:8px;border:1px solid #333">';
      html += '</div>';
    });

    // Buttons
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button id="cf-share-twitter" style="padding:8px 16px;border:none;border-radius:6px;background:#1d9bf0;color:#fff;cursor:pointer;font-size:0.9em">𝕏 Share on X</button>';
    html += '<button id="cf-share-linkedin" style="padding:8px 16px;border:none;border-radius:6px;background:#0a66c2;color:#fff;cursor:pointer;font-size:0.9em">in Share on LinkedIn</button>';
    html += '<button id="cf-share-download" style="padding:8px 16px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.9em">📷 Download Card</button>';
    html += '<button id="cf-share-copy" style="padding:8px 16px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.9em">🔗 Copy Link</button>';
    html += '</div>';

    // History
    var history = getAnalysisHistory();
    if (history.length > 1) {
      html += '<details style="margin-top:20px"><summary style="cursor:pointer;color:#888;font-size:0.85em">📜 Analysis History (' + history.length + ')</summary>';
      html += '<div style="margin-top:8px">';
      history.forEach(function (h) {
        html += '<div style="padding:6px 0;border-bottom:1px solid #222;font-size:0.85em;color:#bbb">';
        html += '<strong>' + h.score + '/100 (' + h.grade + ')</strong> — ' + (h.name || 'Unknown');
        html += ' <span style="color:#666">' + new Date(h.timestamp).toLocaleDateString() + '</span>';
        html += '</div>';
      });
      html += '</div></details>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Active card tracker
    var activeTab = 'default';

    // Tab switching
    container.querySelectorAll('.cf-share-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        activeTab = tab;
        container.querySelectorAll('.cf-share-tab').forEach(function (b) { b.style.background = '#111'; });
        btn.style.background = '#222';
        container.querySelectorAll('.cf-share-preview').forEach(function (p) { p.style.display = 'none'; });
        var pv = container.querySelector('.cf-share-preview[data-tab="' + tab + '"]');
        if (pv) pv.style.display = 'block';
      });
    });

    // Button handlers
    document.getElementById('cf-share-twitter').addEventListener('click', function () {
      window.open(links.twitter, '_blank', 'width=600,height=400');
      pushEvent('twitter', score);
    });
    document.getElementById('cf-share-linkedin').addEventListener('click', function () {
      window.open(links.linkedin, '_blank', 'width=600,height=400');
      pushEvent('linkedin', score);
    });
    document.getElementById('cf-share-download').addEventListener('click', function () {
      cards[activeTab].download();
      pushEvent('download', score);
    });
    document.getElementById('cf-share-copy').addEventListener('click', function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(links.copyLink).then(function () { toast('Link copied!'); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = links.copyLink;
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        toast('Link copied!');
      }
      pushEvent('copy_link', score);
    });
  }

  // ─── Set Result (call before render) ──────────────────────────────

  function setResult(profileData, scoringResult, completenessResult) {
    _lastResult = { profileData: profileData, scoringResult: scoringResult, completenessResult: completenessResult || null };
  }

  // ─── Legacy compat: renderShareSection / renderEnhancedShareSection ─

  function renderShareSection(profileData, scoringResult, completenessResult) {
    setResult(profileData, scoringResult, completenessResult);
    render('share-score-section');
  }

  function renderEnhancedShareSection(profileData, scoringResult, completenessResult) {
    setResult(profileData, scoringResult, completenessResult);
    render('share-score-section');
  }

  // ─── Init ─────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;
    // Pre-warm: load last analysis if available
    var history = getAnalysisHistory();
    if (history.length > 0 && !_lastResult) {
      _lastResult = {
        profileData: { name: history[0].name, title: history[0].title, url: history[0].profileUrl },
        scoringResult: { score: history[0].score, categories: history[0].categories },
        completenessResult: history[0].completeness ? { percentage: history[0].completeness } : null
      };
    }
  }

  // ─── Instagram Story Card (1080×1920) ───────────────────────────

  function generateInstagramCard(profileData, scoringResult) {
    var IG_W = 1080, IG_H = 1920;
    var score = normalizeScore(scoringResult);
    var grade = getGrade(score);
    var name = (profileData && profileData.name) || 'Freelancer';
    var title = (profileData && profileData.title) || '';
    var topCats = extractTopCategories(scoringResult);

    var canvas = document.createElement('canvas');
    canvas.width = IG_W; canvas.height = IG_H;
    var ctx = canvas.getContext('2d');

    // Background
    var bg = ctx.createLinearGradient(0, 0, IG_W, IG_H);
    bg.addColorStop(0, '#0a0a14'); bg.addColorStop(0.4, '#12121f'); bg.addColorStop(1, '#0d1a1a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, IG_W, IG_H);

    // Decorative glow
    ctx.globalAlpha = 0.08;
    ctx.beginPath(); ctx.arc(IG_W / 2, 600, 400, 0, Math.PI * 2);
    ctx.fillStyle = score >= 80 ? '#00ff88' : '#ff8844'; ctx.fill();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';

    // Brand
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('CORTEX FREELANCER', IG_W / 2, 200);

    ctx.fillStyle = '#888';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Profile Analysis Score', IG_W / 2, 260);

    // Score ring
    var cx = IG_W / 2, cy = 520, r = 160;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 20; ctx.stroke();

    var pct = score / 100;
    var endAngle = -Math.PI / 2 + pct * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
    var arcGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    arcGrad.addColorStop(0, '#ff8844'); arcGrad.addColorStop(1, '#00ff88');
    ctx.strokeStyle = arcGrad; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.stroke();

    // Score number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(score, cx, cy + 20);
    ctx.fillStyle = '#888';
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('OUT OF 100', cx, cy + 60);

    // Grade
    var gradeColor = score >= 80 ? '#00ff88' : score >= 60 ? '#ffaa00' : '#ff4444';
    ctx.fillStyle = gradeColor;
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Grade: ' + grade, cx, cy + 140);

    // Name
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '600 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(name.length > 25 ? name.substring(0, 23) + '...' : name, cx, 880);

    if (title) {
      ctx.fillStyle = '#999';
      ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(title.length > 35 ? title.substring(0, 33) + '...' : title, cx, 920);
    }

    // Category bars
    var catY = 1020;
    ctx.textAlign = 'left';
    topCats.forEach(function (cat) {
      var catScore = cat.score <= 10 ? Math.round(cat.score * 10) : Math.round(cat.score);
      var barX = 120, barW = IG_W - 240, barH = 28;

      ctx.fillStyle = '#ddd';
      ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(cat.label, barX, catY); catY += 36;

      ctx.fillStyle = '#1a1a2a'; roundRect(ctx, barX, catY, barW, barH, 8);
      var fillW = (catScore / 100) * barW;
      var barGrad = ctx.createLinearGradient(barX, catY, barX + barW, catY);
      barGrad.addColorStop(0, '#ff8844'); barGrad.addColorStop(1, '#00ff88');
      ctx.fillStyle = barGrad; roundRect(ctx, barX, catY, Math.max(fillW, 8), barH, 8);

      ctx.fillStyle = '#aaa'; ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right'; ctx.fillText(catScore + '%', barX + barW, catY - 8);
      ctx.textAlign = 'left'; catY += 56;
    });

    // CTA
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8844';
    ctx.font = '600 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Get your free analysis', IG_W / 2, IG_H - 240);
    ctx.fillStyle = '#555';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('cortexfreelancer.com', IG_W / 2, IG_H - 190);
    ctx.textAlign = 'left';

    var dataUrl = canvas.toDataURL('image/png');
    return {
      dataUrl: dataUrl, width: IG_W, height: IG_H,
      download: function () {
        var a = document.createElement('a');
        a.href = dataUrl; a.download = 'cortex-score-story-' + score + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    };
  }

  // ─── WhatsApp share ────────────────────────────────────────────

  function getWhatsAppShareLink(score, grade) {
    var text = 'I scored ' + score + '/100 (' + grade + ') on my freelance profile analysis! Try it free: cortexfreelancer.com';
    return 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  // ─── Export ───────────────────────────────────────────────────────

  var mod = {
    init: init,
    render: render,
    setResult: setResult,

    // Card generators
    generateShareCard: generateShareCard,
    generateLinkedInCard: generateLinkedInCard,
    generateTwitterCard: generateTwitterCard,
    generateInstagramCard: generateInstagramCard,

    // Share links
    getShareLinks: getShareLinks,
    getWhatsAppShareLink: getWhatsAppShareLink,

    // Analysis history
    saveAnalysis: saveAnalysis,
    getAnalysisHistory: getAnalysisHistory,
    clearAnalysisHistory: clearAnalysisHistory,

    // Score helpers
    normalizeScore: normalizeScore,
    getGrade: getGrade,

    // Legacy compat
    renderShareSection: renderShareSection,
    renderEnhancedShareSection: renderEnhancedShareSection
  };

  window.CortexFreelancer.ShareScore = mod;
  // Legacy alias
  window.cortexShareScore = mod;

})();
