/**
 * CF-283: Typography System
 * Define type scale (h1-h6, body, caption, overline), inject CSS rules, font stack.
 *
 * @namespace window.CortexFreelancer.TypographySystem
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-typography-system-styles';

  var fontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  var monoStack = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

  var scale = {
    h1: { size: '2.25rem', weight: '700', leading: '1.2', spacing: '-0.025em' },
    h2: { size: '1.875rem', weight: '700', leading: '1.25', spacing: '-0.02em' },
    h3: { size: '1.5rem', weight: '600', leading: '1.3', spacing: '-0.015em' },
    h4: { size: '1.25rem', weight: '600', leading: '1.35', spacing: '-0.01em' },
    h5: { size: '1.125rem', weight: '600', leading: '1.4', spacing: '0' },
    h6: { size: '1rem', weight: '600', leading: '1.5', spacing: '0' },
    'body-lg': { size: '1.125rem', weight: '400', leading: '1.625', spacing: '0' },
    body: { size: '1rem', weight: '400', leading: '1.5', spacing: '0' },
    'body-sm': { size: '0.875rem', weight: '400', leading: '1.5', spacing: '0' },
    caption: { size: '0.75rem', weight: '400', leading: '1.5', spacing: '0.02em' },
    overline: { size: '0.6875rem', weight: '600', leading: '1.5', spacing: '0.08em', transform: 'uppercase' }
  };

  function buildCSS() {
    var css = '';

    // Base
    css += 'body{font-family:' + fontStack + ';font-size:1rem;line-height:1.5;color:var(--ct-colors-neutral-900,#111827);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}\n';
    css += 'code,pre,kbd{font-family:' + monoStack + '}\n';

    // Type classes
    Object.keys(scale).forEach(function (name) {
      var s = scale[name];
      css += '.ct-' + name + '{font-size:' + s.size + ';font-weight:' + s.weight + ';line-height:' + s.leading + ';letter-spacing:' + s.spacing;
      if (s.transform) css += ';text-transform:' + s.transform;
      css += '}\n';
    });

    // Heading reset
    css += '.ct-h1,.ct-h2,.ct-h3,.ct-h4,.ct-h5,.ct-h6{margin:0;color:var(--ct-colors-neutral-900,#111827)}\n';
    css += '.ct-body,.ct-body-lg,.ct-body-sm{color:var(--ct-colors-neutral-700,#374151)}\n';
    css += '.ct-caption{color:var(--ct-colors-neutral-500,#6b7280)}\n';
    css += '.ct-overline{color:var(--ct-colors-neutral-500,#6b7280)}\n';

    // Prose container
    css += '.ct-prose{max-width:65ch}\n';
    css += '.ct-prose p{margin:0 0 1em}\n';
    css += '.ct-prose h1,.ct-prose h2,.ct-prose h3,.ct-prose h4{margin:1.5em 0 0.5em}\n';
    css += '.ct-prose a{color:var(--ct-colors-primary-600,#4f46e5);text-decoration:underline}\n';

    return css;
  }

  function inject() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCSS();
    document.head.appendChild(style);
  }

  function renderTypographyGuide() {
    var html = '<div style="font-family:' + fontStack + ';padding:1.5rem;max-width:700px">';
    html += '<h2 class="ct-h2" style="margin-bottom:1.5rem">Typography System</h2>';

    Object.keys(scale).forEach(function (name) {
      var s = scale[name];
      var sampleText = name === 'overline' ? 'OVERLINE TEXT' : 'The quick brown fox jumps over the lazy dog';
      html += '<div style="margin-bottom:1.5rem;border-bottom:1px solid var(--ct-colors-neutral-200,#e5e7eb);padding-bottom:1rem">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:0.25rem">';
      html += '<span class="ct-caption" style="font-weight:600">' + name + '</span>';
      html += '<span class="ct-caption">' + s.size + ' / ' + s.weight + ' / ' + s.leading + '</span>';
      html += '</div>';
      html += '<div class="ct-' + name + '">' + sampleText + '</div>';
      html += '</div>';
    });

    html += '<h3 class="ct-h3" style="margin:1.5rem 0 0.75rem">Font Stacks</h3>';
    html += '<div class="ct-body-sm" style="margin-bottom:0.5rem"><strong>Sans:</strong> ' + fontStack + '</div>';
    html += '<div class="ct-body-sm"><strong>Mono:</strong> <code style="font-family:' + monoStack + '">' + monoStack + '</code></div>';

    html += '</div>';
    return html;
  }

  inject();

  window.CortexFreelancer.TypographySystem = {
    scale: scale,
    fontStack: fontStack,
    monoStack: monoStack,
    renderTypographyGuide: renderTypographyGuide,
    inject: inject
  };
})();
