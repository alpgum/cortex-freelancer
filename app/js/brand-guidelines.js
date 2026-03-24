/**
 * CF-300: Brand Guidelines
 * Render brand guide: logo usage, color palette, typography rules, do's/don'ts, tone of voice.
 *
 * @namespace window.CortexFreelancer.BrandGuidelines
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var COLORS = {
    primary: [
      { name: 'Primary 600', hex: '#4F46E5', usage: 'CTAs, links, active states' },
      { name: 'Primary 700', hex: '#4338CA', usage: 'Hover states' },
      { name: 'Primary 500', hex: '#6366F1', usage: 'Backgrounds, accents' },
      { name: 'Primary 100', hex: '#E0E7FF', usage: 'Light backgrounds' }
    ],
    neutral: [
      { name: 'Neutral 900', hex: '#111827', usage: 'Headings, body text' },
      { name: 'Neutral 700', hex: '#374151', usage: 'Secondary text' },
      { name: 'Neutral 500', hex: '#6B7280', usage: 'Muted text, placeholders' },
      { name: 'Neutral 200', hex: '#E5E7EB', usage: 'Borders, dividers' },
      { name: 'Neutral 50', hex: '#F9FAFB', usage: 'Page backgrounds' }
    ],
    semantic: [
      { name: 'Success', hex: '#10B981', usage: 'Confirmations, positive' },
      { name: 'Error', hex: '#EF4444', usage: 'Errors, destructive actions' },
      { name: 'Warning', hex: '#F59E0B', usage: 'Warnings, caution' },
      { name: 'Info', hex: '#3B82F6', usage: 'Informational messages' }
    ]
  };

  var TYPOGRAPHY = [
    { name: 'Display', size: '2rem', weight: '800', usage: 'Hero headlines', tag: 'h1' },
    { name: 'Heading 1', size: '1.5rem', weight: '700', usage: 'Page titles', tag: 'h1' },
    { name: 'Heading 2', size: '1.25rem', weight: '700', usage: 'Section titles', tag: 'h2' },
    { name: 'Heading 3', size: '1.125rem', weight: '600', usage: 'Card titles', tag: 'h3' },
    { name: 'Body', size: '1rem', weight: '400', usage: 'Paragraphs, descriptions', tag: 'p' },
    { name: 'Small', size: '0.875rem', weight: '400', usage: 'Captions, labels', tag: 'span' },
    { name: 'Tiny', size: '0.75rem', weight: '500', usage: 'Badges, metadata', tag: 'span' }
  ];

  var LOGO_RULES = {
    dos: [
      'Use the full "Cortex Freelancer" logotype on marketing pages',
      'Maintain minimum clear space equal to the "C" height',
      'Use the icon mark (C) only in app chrome and favicons',
      'Place on solid backgrounds with sufficient contrast'
    ],
    donts: [
      'Don\'t stretch, rotate, or skew the logo',
      'Don\'t place on busy or low-contrast backgrounds',
      'Don\'t alter the logo colors outside the approved palette',
      'Don\'t add effects (shadows, gradients, outlines)'
    ]
  };

  var TONE = {
    voice: [
      { trait: 'Confident', desc: 'We know freelancing is tough. We speak with authority and empathy.' },
      { trait: 'Clear', desc: 'No jargon. Short sentences. Every word earns its place.' },
      { trait: 'Friendly', desc: 'We talk like a smart colleague, not a corporate manual.' },
      { trait: 'Action-oriented', desc: 'Always lead with what the user can do next.' }
    ],
    dos: [
      '"Write winning proposals in minutes" — direct, benefit-first',
      '"Your proposal is ready" — simple confirmation',
      '"Try the Rate Calculator" — action-oriented CTA'
    ],
    donts: [
      '"Leverage our cutting-edge AI-powered solution" — too corporate',
      '"Oopsie! Something broke" — too casual for errors',
      '"Click here" — vague, inaccessible'
    ]
  };

  function esc(str) {
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function swatch(color) {
    return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0">' +
      '<div style="width:40px;height:40px;border-radius:8px;background:' + color.hex + ';border:1px solid rgba(0,0,0,0.08);flex-shrink:0"></div>' +
      '<div><div style="font-weight:600;font-size:0.875rem">' + esc(color.name) + '</div>' +
      '<div style="font-size:0.75rem;color:var(--ct-colors-neutral-500,#6b7280)">' + color.hex + ' — ' + esc(color.usage) + '</div></div></div>';
  }

  function section(title, content) {
    return '<section style="margin-bottom:2rem">' +
      '<h3 style="font-size:1.125rem;font-weight:700;margin:0 0 1rem;padding-bottom:0.5rem;border-bottom:2px solid var(--ct-colors-primary-600,#4f46e5);color:var(--ct-colors-neutral-900,#111827)">' + esc(title) + '</h3>' +
      content + '</section>';
  }

  function listBlock(items, icon) {
    return '<ul style="list-style:none;padding:0;margin:0">' +
      items.map(function (item) {
        return '<li style="padding:4px 0;font-size:0.875rem;color:var(--ct-colors-neutral-700,#374151)">' +
          '<span style="margin-right:6px">' + icon + '</span>' + esc(item) + '</li>';
      }).join('') + '</ul>';
  }

  function renderBrandGuidelines(container) {
    var html = '<div style="font-family:var(--ct-typography-font-family,\'Inter\',sans-serif);padding:2rem;max-width:800px;margin:0 auto">';

    // Header
    html += '<div style="margin-bottom:2rem;text-align:center">';
    html += '<h2 style="font-size:1.75rem;font-weight:800;margin:0 0 0.5rem;color:var(--ct-colors-primary-600,#4f46e5)">Cortex Freelancer</h2>';
    html += '<p style="font-size:1rem;color:var(--ct-colors-neutral-500,#6b7280);margin:0">Brand Guidelines v1.0</p>';
    html += '</div>';

    // Logo Usage
    var logoContent = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">';
    logoContent += '<div style="background:var(--ct-colors-neutral-50,#f9fafb);padding:1rem;border-radius:8px">';
    logoContent += '<div style="font-weight:600;font-size:0.8125rem;color:#10B981;margin-bottom:0.5rem">DO</div>';
    logoContent += listBlock(LOGO_RULES.dos, '\u2713');
    logoContent += '</div>';
    logoContent += '<div style="background:#FEF2F2;padding:1rem;border-radius:8px">';
    logoContent += '<div style="font-weight:600;font-size:0.8125rem;color:#EF4444;margin-bottom:0.5rem">DON\'T</div>';
    logoContent += listBlock(LOGO_RULES.donts, '\u2717');
    logoContent += '</div></div>';
    html += section('Logo Usage', logoContent);

    // Color Palette
    var colorContent = '';
    Object.keys(COLORS).forEach(function (group) {
      colorContent += '<div style="margin-bottom:1rem">';
      colorContent += '<div style="font-weight:600;font-size:0.8125rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--ct-colors-neutral-500,#6b7280);margin-bottom:0.25rem">' + group + '</div>';
      COLORS[group].forEach(function (c) { colorContent += swatch(c); });
      colorContent += '</div>';
    });
    html += section('Color Palette', colorContent);

    // Typography
    var typoContent = '<div style="display:flex;flex-direction:column;gap:12px">';
    TYPOGRAPHY.forEach(function (t) {
      typoContent += '<div style="display:flex;align-items:baseline;gap:16px;padding:8px 0;border-bottom:1px solid var(--ct-colors-neutral-100,#f3f4f6)">';
      typoContent += '<div style="font-size:' + t.size + ';font-weight:' + t.weight + ';min-width:200px;color:var(--ct-colors-neutral-900,#111827)">Aa</div>';
      typoContent += '<div style="flex:1"><div style="font-weight:600;font-size:0.875rem">' + esc(t.name) + '</div>';
      typoContent += '<div style="font-size:0.75rem;color:var(--ct-colors-neutral-500,#6b7280)">' + t.size + ' / ' + t.weight + ' — ' + esc(t.usage) + '</div></div>';
      typoContent += '</div>';
    });
    typoContent += '</div>';
    html += section('Typography', typoContent);

    // Tone of Voice
    var toneContent = '<div style="margin-bottom:1rem">';
    TONE.voice.forEach(function (v) {
      toneContent += '<div style="padding:8px 0;border-bottom:1px solid var(--ct-colors-neutral-100,#f3f4f6)">';
      toneContent += '<span style="font-weight:600;font-size:0.875rem;color:var(--ct-colors-primary-600,#4f46e5)">' + esc(v.trait) + '</span>';
      toneContent += '<span style="font-size:0.875rem;color:var(--ct-colors-neutral-600,#4b5563)"> — ' + esc(v.desc) + '</span></div>';
    });
    toneContent += '</div>';
    toneContent += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">';
    toneContent += '<div style="background:var(--ct-colors-neutral-50,#f9fafb);padding:1rem;border-radius:8px">';
    toneContent += '<div style="font-weight:600;font-size:0.8125rem;color:#10B981;margin-bottom:0.5rem">DO</div>';
    toneContent += listBlock(TONE.dos, '\u2713');
    toneContent += '</div>';
    toneContent += '<div style="background:#FEF2F2;padding:1rem;border-radius:8px">';
    toneContent += '<div style="font-weight:600;font-size:0.8125rem;color:#EF4444;margin-bottom:0.5rem">DON\'T</div>';
    toneContent += listBlock(TONE.donts, '\u2717');
    toneContent += '</div></div>';
    html += section('Tone of Voice', toneContent);

    html += '</div>';

    if (container) {
      var el = typeof container === 'string' ? document.querySelector(container) : container;
      if (el) el.innerHTML = html;
    }

    return html;
  }

  window.CortexFreelancer.BrandGuidelines = {
    renderBrandGuidelines: renderBrandGuidelines,
    COLORS: COLORS,
    TYPOGRAPHY: TYPOGRAPHY,
    LOGO_RULES: LOGO_RULES,
    TONE: TONE
  };
})();
