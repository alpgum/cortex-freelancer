/* ===== SCORECARD GENERATOR — Shareable PNG via Canvas ===== */
(function() {
  'use strict';

  var CARD_W = 600, CARD_H = 340;

  function drawScorecard(result) {
    var canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext('2d');

    // Background
    var bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, '#0a0a0a');
    bg.addColorStop(1, '#111111');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Border glow
    ctx.strokeStyle = '#ff8844';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2);

    // Brand
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.fillText('CORTEX FREELANCER', 30, 40);

    // Title
    ctx.fillStyle = '#f0f0f0';
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.fillText('Freelancer Scorecard', 30, 75);

    // Score circle
    var cx = 500, cy = 90, r = 40;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Score arc
    var scoreAngle = (result.totalScore / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, scoreAngle);
    var grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#ff8844');
    grad.addColorStop(1, '#00ff88');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Score number
    ctx.fillStyle = '#f0f0f0';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(result.totalScore.toFixed(1), cx, cy + 8);
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('/10', cx, cy + 24);
    ctx.textAlign = 'left';

    // Skill & Country
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText(result.skillLabel + '  •  ' + result.countryLabel + '  •  $' + result.rate + '/hr', 30, 105);

    // Breakdown bars
    var categories = [
      { label: 'Headline', value: result.headline },
      { label: 'Overview', value: result.overview },
      { label: 'Skills', value: result.skillsScore },
      { label: 'Portfolio', value: result.portfolio },
      { label: 'Rate', value: result.rateScore }
    ];
    var startY = 135, barH = 22, gap = 10, barMaxW = 300;

    categories.forEach(function(cat, i) {
      var y = startY + i * (barH + gap);
      // Label
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(cat.label, 30, y + 15);
      // Track
      ctx.fillStyle = '#1a1a1a';
      roundRect(ctx, 110, y, barMaxW, barH, 4);
      ctx.fill();
      // Fill
      var fillW = (cat.value / 10) * barMaxW;
      var fillGrad = ctx.createLinearGradient(110, y, 110 + fillW, y);
      fillGrad.addColorStop(0, '#ff8844');
      fillGrad.addColorStop(1, cat.value >= 7 ? '#00ff88' : '#ff6622');
      ctx.fillStyle = fillGrad;
      roundRect(ctx, 110, y, fillW, barH, 4);
      ctx.fill();
      // Value
      ctx.fillStyle = '#f0f0f0';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.fillText(cat.value + '/10', 420, y + 15);
    });

    // Footer
    ctx.fillStyle = '#333';
    ctx.fillRect(0, CARD_H - 40, CARD_W, 40);
    ctx.fillStyle = '#888';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('Get your free score at cortexfreelancer.com/app', 30, CARD_H - 16);
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('cortexfreelancer.com', CARD_W - 30, CARD_H - 16);
    ctx.textAlign = 'left';

    return canvas;
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
  }

  function downloadScorecard(result) {
    var canvas = drawScorecard(result);
    var link = document.createElement('a');
    link.download = 'cortex-scorecard.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function shareOnTwitter(result) {
    var text = 'I scored ' + result.totalScore.toFixed(1) + '/10 on my freelancer profile! ' +
      result.skillLabel + ' in ' + result.countryLabel + '. ' +
      'Get your free score:';
    var url = 'https://cortexfreelancer.com/app';
    var twitterUrl = 'https://twitter.com/intent/tweet?text=' +
      encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  }

  // Expose globally
  window.downloadScorecard = downloadScorecard;
  window.shareOnTwitter = shareOnTwitter;
  window.drawScorecard = drawScorecard;
})();
