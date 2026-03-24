/**
 * CF-281: Design Tokens
 * Define CSS custom properties programmatically: colors, typography scale,
 * spacing scale, border-radius, shadows. Apply to :root.
 *
 * @namespace window.CortexFreelancer.DesignTokens
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-design-tokens-styles';

  var tokens = {
    colors: {
      primary: {
        50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
        400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
        800: '#3730a3', 900: '#312e81'
      },
      secondary: {
        50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
        400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
        800: '#166534', 900: '#14532d'
      },
      accent: {
        50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
        400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
        800: '#9a3412', 900: '#7c2d12'
      },
      semantic: {
        success: '#22c55e', 'success-light': '#dcfce7',
        warning: '#f59e0b', 'warning-light': '#fef3c7',
        error: '#ef4444', 'error-light': '#fee2e2',
        info: '#3b82f6', 'info-light': '#dbeafe'
      },
      neutral: {
        0: '#ffffff', 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb',
        300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563',
        700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712'
      }
    },
    typography: {
      'font-family': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      'font-mono': "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      'text-xs': '0.75rem', 'text-sm': '0.875rem', 'text-base': '1rem',
      'text-lg': '1.125rem', 'text-xl': '1.25rem', 'text-2xl': '1.5rem',
      'text-3xl': '1.875rem', 'text-4xl': '2.25rem', 'text-5xl': '3rem',
      'leading-tight': '1.25', 'leading-normal': '1.5', 'leading-relaxed': '1.625',
      'font-light': '300', 'font-normal': '400', 'font-medium': '500',
      'font-semibold': '600', 'font-bold': '700'
    },
    spacing: {
      0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem',
      5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem',
      16: '4rem', 20: '5rem', 24: '6rem'
    },
    radius: {
      none: '0', sm: '0.125rem', default: '0.375rem', md: '0.5rem',
      lg: '0.75rem', xl: '1rem', '2xl': '1.5rem', full: '9999px'
    },
    shadows: {
      xs: '0 1px 2px rgba(0,0,0,0.05)',
      sm: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
      md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
      xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
      inner: 'inset 0 2px 4px rgba(0,0,0,0.06)',
      none: 'none'
    }
  };

  function flattenTokens(obj, prefix) {
    var result = {};
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      var name = prefix ? prefix + '-' + key : key;
      if (typeof val === 'object' && val !== null) {
        var nested = flattenTokens(val, name);
        Object.keys(nested).forEach(function (k) { result[k] = nested[k]; });
      } else {
        result[name] = val;
      }
    });
    return result;
  }

  function buildCSS() {
    var flat = flattenTokens(tokens, 'ct');
    var vars = Object.keys(flat).map(function (k) {
      return '  --' + k + ': ' + flat[k] + ';';
    });
    return ':root {\n' + vars.join('\n') + '\n}';
  }

  function inject() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCSS();
    document.head.appendChild(style);
  }

  function getToken(path) {
    var parts = path.split('.');
    var val = tokens;
    for (var i = 0; i < parts.length; i++) {
      val = val[parts[i]];
      if (val === undefined) return undefined;
    }
    return val;
  }

  function renderTokenPreview() {
    var html = '<div style="font-family:var(--ct-typography-font-family);padding:var(--ct-spacing-6)">';
    html += '<h2 style="margin-bottom:var(--ct-spacing-6);font-size:var(--ct-typography-text-2xl);font-weight:700">Design Tokens</h2>';

    // Color swatches
    ['primary', 'secondary', 'accent'].forEach(function (name) {
      html += '<h3 style="font-size:var(--ct-typography-text-lg);font-weight:600;margin:var(--ct-spacing-4) 0">' + name + '</h3>';
      html += '<div style="display:flex;gap:var(--ct-spacing-2);flex-wrap:wrap">';
      var palette = tokens.colors[name];
      Object.keys(palette).forEach(function (shade) {
        html += '<div style="text-align:center">';
        html += '<div style="width:48px;height:48px;border-radius:var(--ct-radius-md);background:' + palette[shade] + ';border:1px solid var(--ct-colors-neutral-200)"></div>';
        html += '<div style="font-size:var(--ct-typography-text-xs);margin-top:2px">' + shade + '</div></div>';
      });
      html += '</div>';
    });

    // Semantic colors
    html += '<h3 style="font-size:var(--ct-typography-text-lg);font-weight:600;margin:var(--ct-spacing-4) 0">Semantic</h3>';
    html += '<div style="display:flex;gap:var(--ct-spacing-2);flex-wrap:wrap">';
    var sem = tokens.colors.semantic;
    Object.keys(sem).forEach(function (k) {
      html += '<div style="text-align:center">';
      html += '<div style="width:48px;height:48px;border-radius:var(--ct-radius-md);background:' + sem[k] + '"></div>';
      html += '<div style="font-size:var(--ct-typography-text-xs);margin-top:2px">' + k + '</div></div>';
    });
    html += '</div>';

    // Spacing
    html += '<h3 style="font-size:var(--ct-typography-text-lg);font-weight:600;margin:var(--ct-spacing-4) 0">Spacing</h3>';
    html += '<div style="display:flex;gap:var(--ct-spacing-2);align-items:flex-end;flex-wrap:wrap">';
    Object.keys(tokens.spacing).forEach(function (k) {
      if (k === '0') return;
      html += '<div style="text-align:center">';
      html += '<div style="width:24px;height:' + tokens.spacing[k] + ';background:var(--ct-colors-primary-400);border-radius:2px"></div>';
      html += '<div style="font-size:var(--ct-typography-text-xs);margin-top:2px">' + k + '</div></div>';
    });
    html += '</div>';

    // Shadows
    html += '<h3 style="font-size:var(--ct-typography-text-lg);font-weight:600;margin:var(--ct-spacing-4) 0">Shadows</h3>';
    html += '<div style="display:flex;gap:var(--ct-spacing-4);flex-wrap:wrap">';
    Object.keys(tokens.shadows).forEach(function (k) {
      if (k === 'none' || k === 'inner') return;
      html += '<div style="width:80px;height:80px;background:#fff;border-radius:var(--ct-radius-md);box-shadow:' + tokens.shadows[k] + ';display:flex;align-items:center;justify-content:center;font-size:var(--ct-typography-text-sm)">' + k + '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  inject();

  window.CortexFreelancer.DesignTokens = {
    tokens: tokens,
    getToken: getToken,
    renderTokenPreview: renderTokenPreview,
    inject: inject
  };
})();
