/**
 * CF-008: Profile Photo Quality Checker
 * Validates profile photo dimensions, face detection hints,
 * background contrast, and professional appearance tips.
 */
(function () {
  'use strict';

  /** Recommended dimensions */
  var MIN_WIDTH = 200;
  var MIN_HEIGHT = 200;
  var IDEAL_WIDTH = 400;
  var IDEAL_HEIGHT = 400;
  var MAX_FILE_SIZE_MB = 5;

  /**
   * Check photo via an Image element (URL or data URI).
   * @param {string} src - Image URL or data URI
   * @returns {Promise<{score: number, checks: {name: string, passed: boolean, detail: string}[], tips: string[]}>}
   */
  function checkPhoto(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve({
          score: 0,
          checks: [{ name: 'Photo present', passed: false, detail: 'No profile photo provided' }],
          tips: [
            'Add a professional headshot — profiles with photos get up to 40% more invites',
            'Use a neutral background and good lighting',
            'Smile naturally and look directly at the camera'
          ]
        });
        return;
      }

      var img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = function () {
        var checks = [];
        var tips = [];
        var score = 0;

        // 1. Dimensions check (25 pts)
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w >= IDEAL_WIDTH && h >= IDEAL_HEIGHT) {
          checks.push({ name: 'Resolution', passed: true, detail: w + 'x' + h + ' — excellent resolution' });
          score += 25;
        } else if (w >= MIN_WIDTH && h >= MIN_HEIGHT) {
          checks.push({ name: 'Resolution', passed: true, detail: w + 'x' + h + ' — acceptable but could be sharper' });
          tips.push('Upload a higher resolution photo (' + IDEAL_WIDTH + 'x' + IDEAL_HEIGHT + '+ recommended)');
          score += 15;
        } else {
          checks.push({ name: 'Resolution', passed: false, detail: w + 'x' + h + ' — too small, will appear blurry' });
          tips.push('Use a photo at least ' + MIN_WIDTH + 'x' + MIN_HEIGHT + ' pixels');
          score += 5;
        }

        // 2. Aspect ratio check (15 pts)
        var ratio = w / h;
        if (ratio >= 0.8 && ratio <= 1.2) {
          checks.push({ name: 'Aspect ratio', passed: true, detail: 'Square-ish (' + ratio.toFixed(2) + ':1) — ideal for profile display' });
          score += 15;
        } else {
          checks.push({ name: 'Aspect ratio', passed: false, detail: 'Ratio ' + ratio.toFixed(2) + ':1 — may crop poorly' });
          tips.push('Use a square or near-square crop for best display across platforms');
          score += 5;
        }

        // 3. Brightness / contrast heuristic via canvas sampling (20 pts)
        var brightness = sampleBrightness(img);
        if (brightness === null) {
          checks.push({ name: 'Brightness', passed: true, detail: 'Could not analyze (cross-origin). Ensure good lighting.' });
          score += 10;
        } else if (brightness >= 60 && brightness <= 200) {
          checks.push({ name: 'Brightness', passed: true, detail: 'Good lighting (avg brightness: ' + brightness + ')' });
          score += 20;
        } else if (brightness < 60) {
          checks.push({ name: 'Brightness', passed: false, detail: 'Photo appears too dark (avg brightness: ' + brightness + ')' });
          tips.push('Use natural lighting or brighten the photo — dark photos reduce trust');
          score += 5;
        } else {
          checks.push({ name: 'Brightness', passed: false, detail: 'Photo may be overexposed (avg brightness: ' + brightness + ')' });
          tips.push('Reduce brightness/exposure slightly for a more natural look');
          score += 8;
        }

        // 4. Face region heuristic — center-weighted skin-tone presence (20 pts)
        var faceHint = detectFaceHint(img);
        if (faceHint === null) {
          checks.push({ name: 'Face detection', passed: true, detail: 'Could not analyze pixels. Ensure your face is clearly visible.' });
          score += 10;
        } else if (faceHint) {
          checks.push({ name: 'Face detection', passed: true, detail: 'Face-like region detected in center — good framing' });
          score += 20;
        } else {
          checks.push({ name: 'Face detection', passed: false, detail: 'No face-like region detected in center area' });
          tips.push('Center your face in the frame — Upwork crops to a circle, so keep important details centered');
          score += 5;
        }

        // 5. Background uniformity heuristic (20 pts)
        var bgUniform = checkBackgroundUniformity(img);
        if (bgUniform === null) {
          checks.push({ name: 'Background', passed: true, detail: 'Could not analyze. Use a clean, uncluttered background.' });
          score += 10;
        } else if (bgUniform) {
          checks.push({ name: 'Background', passed: true, detail: 'Background appears relatively uniform — professional look' });
          score += 20;
        } else {
          checks.push({ name: 'Background', passed: false, detail: 'Background may be cluttered or distracting' });
          tips.push('Use a plain or blurred background for a more professional appearance');
          score += 8;
        }

        // Always-useful tips
        if (tips.length === 0) {
          tips.push('Great photo! Consider refreshing it yearly to stay current.');
        }

        resolve({ score: Math.min(100, score), checks: checks, tips: tips });
      };

      img.onerror = function () {
        resolve({
          score: 0,
          checks: [{ name: 'Photo loadable', passed: false, detail: 'Could not load image from the provided source' }],
          tips: ['Ensure the photo URL is accessible and the file is a valid image (JPG/PNG)']
        });
      };

      img.src = src;
    });
  }

  /**
   * Check photo from a File object (e.g., from file input).
   * @param {File} file
   * @returns {Promise<{score: number, checks: {name: string, passed: boolean, detail: string}[], tips: string[]}>}
   */
  function checkPhotoFile(file) {
    return new Promise(function (resolve) {
      if (!file) {
        return checkPhoto(null).then(resolve);
      }

      // File type check
      if (!file.type.startsWith('image/')) {
        resolve({
          score: 0,
          checks: [{ name: 'File type', passed: false, detail: 'Not an image file (' + file.type + ')' }],
          tips: ['Upload a JPG or PNG image file']
        });
        return;
      }

      // File size check
      var sizeMB = file.size / (1024 * 1024);
      var sizeWarning = null;
      if (sizeMB > MAX_FILE_SIZE_MB) {
        sizeWarning = { name: 'File size', passed: false, detail: sizeMB.toFixed(1) + 'MB — may be too large for upload' };
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        checkPhoto(e.target.result).then(function (result) {
          if (sizeWarning) {
            result.checks.push(sizeWarning);
            result.tips.push('Compress the image to under ' + MAX_FILE_SIZE_MB + 'MB');
            result.score = Math.max(0, result.score - 10);
          }
          resolve(result);
        });
      };
      reader.onerror = function () {
        resolve({
          score: 0,
          checks: [{ name: 'File readable', passed: false, detail: 'Could not read the file' }],
          tips: ['Try a different image file']
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // ─── Canvas pixel helpers ───────────────────────────────────────────

  /**
   * Get pixel data from image center region. Returns null if cross-origin tainted.
   */
  function getPixelData(img, x, y, w, h) {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(x, y, w, h).data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Sample average brightness from full image.
   */
  function sampleBrightness(img) {
    var data = getPixelData(img, 0, 0, img.naturalWidth, img.naturalHeight);
    if (!data) return null;
    var sum = 0;
    var count = 0;
    // Sample every 40th pixel for speed
    for (var i = 0; i < data.length; i += 160) {
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      count++;
    }
    return count > 0 ? Math.round(sum / count) : null;
  }

  /**
   * Heuristic: check if center region has skin-tone-like pixels.
   */
  function detectFaceHint(img) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    // Sample center 40% of image
    var cx = Math.floor(w * 0.3);
    var cy = Math.floor(h * 0.1);
    var cw = Math.floor(w * 0.4);
    var ch = Math.floor(h * 0.5);
    var data = getPixelData(img, cx, cy, cw, ch);
    if (!data) return null;

    var skinPixels = 0;
    var total = 0;
    for (var i = 0; i < data.length; i += 16) {
      var r = data[i], g = data[i + 1], b = data[i + 2];
      // Broad skin-tone detection heuristic (covers diverse skin tones)
      if (r > 60 && g > 40 && b > 20 && r > g && r > b &&
          Math.abs(r - g) > 10 && r - b > 15 && r < 250) {
        skinPixels++;
      }
      total++;
    }
    // If >15% of center pixels are skin-tone-ish, likely a face
    return total > 0 && (skinPixels / total) > 0.15;
  }

  /**
   * Heuristic: check if edge pixels are relatively uniform (clean background).
   */
  function checkBackgroundUniformity(img) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    // Sample top-left corner (10% x 10%)
    var sw = Math.max(Math.floor(w * 0.1), 2);
    var sh = Math.max(Math.floor(h * 0.1), 2);
    var data = getPixelData(img, 0, 0, sw, sh);
    if (!data) return null;

    // Calculate color variance
    var sumR = 0, sumG = 0, sumB = 0;
    var count = 0;
    for (var i = 0; i < data.length; i += 4) {
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      count++;
    }
    if (count === 0) return null;
    var avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;

    var variance = 0;
    for (var j = 0; j < data.length; j += 4) {
      variance += Math.pow(data[j] - avgR, 2) + Math.pow(data[j + 1] - avgG, 2) + Math.pow(data[j + 2] - avgB, 2);
    }
    variance /= count;
    // Low variance = uniform background
    return variance < 3000;
  }

  // Export
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PhotoChecker = {
    checkPhoto: checkPhoto,
    checkPhotoFile: checkPhotoFile
  };
})();
