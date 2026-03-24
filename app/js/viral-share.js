/**
 * CF-251: Viral Share Mechanism — Profile Score Cards. Generate shareable
 * canvas-based image cards, download as PNG, share to social.
 */
(function () {
  'use strict';

  var CARD_WIDTH = 1200;
  var CARD_HEIGHT = 630;
  var SITE_URL = 'https://cortexfreelancer.com';

  /**
   * ViralShareCards — generates shareable profile score card images.
   * @constructor
   * @param {object} [options]
   * @param {number} [options.width]
   * @param {number} [options.height]
   */
  function ViralShareCards(options) {
    options = options || {};
    this.width = options.width || CARD_WIDTH;
    this.height = options.height || CARD_HEIGHT;
  }

  /**
   * Generate a canvas-based score card image.
   * @param {object} data
   * @param {string} data.name - User name
   * @param {number} data.score - Profile score (0-100)
   * @param {string} [data.title] - Professional title
   * @param {string} [data.avatarUrl] - URL for avatar image
   * @returns {Promise<HTMLCanvasElement>}
   */
  ViralShareCards.prototype.generateCard = async function (data) {
    if (!data || typeof data.score !== 'number') {
      throw new Error('Score is required');
    }

    var canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    var ctx = canvas.getContext('2d');

    // Background gradient
    var gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Decorative accent bar
    var accentGrad = ctx.createLinearGradient(0, 0, this.width, 0);
    accentGrad.addColorStop(0, '#00d2ff');
    accentGrad.addColorStop(1, '#7b2ff7');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, this.width, 6);

    // Score circle
    this._drawScoreCircle(ctx, this.width / 2, 260, 120, data.score);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.name || 'Freelancer', this.width / 2, 430);

    // Title
    if (data.title) {
      ctx.fillStyle = '#a0aec0';
      ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(data.title, this.width / 2, 470);
    }

    // Header text
    ctx.fillStyle = '#a0aec0';
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('My Upwork Profile Score', this.width / 2, 100);

    // Branding
    ctx.fillStyle = '#718096';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('powered by Cortex Freelancer', this.width / 2, 570);
    ctx.fillStyle = '#4a5568';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(SITE_URL, this.width / 2, 600);

    return canvas;
  };

  /**
   * Draw the score circle with progress arc.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} score
   * @private
   */
  ViralShareCards.prototype._drawScoreCircle = function (ctx, cx, cy, radius, score) {
    var startAngle = -Math.PI / 2;
    var endAngle = startAngle + (2 * Math.PI * (score / 100));

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 12;
    ctx.stroke();

    // Progress arc
    var color = this._getScoreColor(score);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score.toString(), cx, cy - 10);

    // "/100" label
    ctx.fillStyle = '#718096';
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('/100', cx, cy + 35);

    ctx.textBaseline = 'alphabetic';
  };

  /**
   * Get color based on score.
   * @param {number} score
   * @returns {string}
   * @private
   */
  ViralShareCards.prototype._getScoreColor = function (score) {
    if (score >= 80) return '#48bb78'; // Green
    if (score >= 60) return '#ecc94b'; // Yellow
    if (score >= 40) return '#ed8936'; // Orange
    return '#fc8181'; // Red
  };

  /**
   * Download the score card as a PNG file.
   * @param {object} data - Same as generateCard data
   * @param {string} [filename] - Download filename
   * @returns {Promise<void>}
   */
  ViralShareCards.prototype.downloadAsPNG = async function (data, filename) {
    var canvas = await this.generateCard(data);
    var name = data.name || 'freelancer';
    filename = filename || 'upwork-score-' + name.toLowerCase().replace(/\s+/g, '-') + '.png';

    var link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Get a data URL of the card image.
   * @param {object} data
   * @returns {Promise<string>}
   */
  ViralShareCards.prototype.toDataURL = async function (data) {
    var canvas = await this.generateCard(data);
    return canvas.toDataURL('image/png');
  };

  /**
   * Get social share links for the score card.
   * @param {object} data
   * @param {number} data.score
   * @param {string} [data.name]
   * @returns {object}
   */
  ViralShareCards.prototype.getShareLinks = function (data) {
    var score = data.score || 0;
    var name = data.name || 'My';
    var text = name + '\'s Upwork Profile Score: ' + score + '/100 \u2014 powered by Cortex Freelancer';
    var url = SITE_URL + '?utm_source=share_card&utm_medium=social';
    var encodedText = encodeURIComponent(text);
    var encodedUrl = encodeURIComponent(url);

    return {
      twitter: 'https://twitter.com/intent/tweet?text=' + encodedText + '&url=' + encodedUrl,
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '&quote=' + encodedText,
      copyText: text + '\n' + url
    };
  };

  /**
   * Share via Web Share API (mobile) or copy to clipboard.
   * @param {object} data
   * @returns {Promise<boolean>}
   */
  ViralShareCards.prototype.share = async function (data) {
    var links = this.getShareLinks(data);

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Upwork Profile Score',
          text: links.copyText,
          url: SITE_URL + '?utm_source=share_card&utm_medium=native'
        });
        return true;
      } catch (_e) {
        // User cancelled or API unavailable
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(links.copyText);
      return true;
    } catch (_e) {
      return false;
    }
  };

  /**
   * Render the share card UI into a container.
   * @param {string} containerId
   * @param {object} data
   * @returns {Promise<void>}
   */
  ViralShareCards.prototype.renderShareUI = async function (containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var dataUrl = await this.toDataURL(data);
    var links = this.getShareLinks(data);

    container.innerHTML =
      '<div class="viral-share">' +
        '<div class="viral-share__preview">' +
          '<img src="' + dataUrl + '" alt="Profile Score Card" class="viral-share__image">' +
        '</div>' +
        '<div class="viral-share__actions">' +
          '<button class="viral-share__btn viral-share__btn--download btn btn--primary" data-action="download">Download PNG</button>' +
          '<a href="' + links.twitter + '" target="_blank" rel="noopener" class="viral-share__btn btn btn--secondary">Share on Twitter</a>' +
          '<a href="' + links.linkedin + '" target="_blank" rel="noopener" class="viral-share__btn btn btn--secondary">Share on LinkedIn</a>' +
          '<a href="' + links.facebook + '" target="_blank" rel="noopener" class="viral-share__btn btn btn--secondary">Share on Facebook</a>' +
        '</div>' +
      '</div>';

    var self = this;
    var dlBtn = container.querySelector('[data-action="download"]');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        self.downloadAsPNG(data);
      });
    }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ViralShareCards = ViralShareCards;
})();
