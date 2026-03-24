/**
 * CF-296: Onboarding Illustrations
 * 5 SVG illustrations (welcome, profile-setup, first-tool, upgrade, success)
 * generated programmatically.
 *
 * @namespace window.CortexFreelancer.OnboardingIllustrations
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var P = '#6C5CE7'; // primary
  var S = '#A29BFE'; // secondary
  var A = '#FD79A8'; // accent
  var BG = '#F8F9FF'; // background
  var W = '#FFFFFF'; // white
  var G = '#DFE6E9'; // grey
  var Y = '#FFEAA7'; // yellow

  var ILLUSTRATIONS = {

    welcome: function () {
      return '<svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        // Background circle
        '<circle cx="140" cy="100" r="80" fill="' + BG + '"/>' +
        // Person body
        '<circle cx="140" cy="70" r="20" fill="' + P + '"/>' +
        '<rect x="120" y="92" width="40" height="50" rx="8" fill="' + P + '"/>' +
        // Waving hand
        '<path d="M170 80 Q185 65 178 50" stroke="' + A + '" stroke-width="4" stroke-linecap="round" fill="none"/>' +
        '<circle cx="178" cy="48" r="6" fill="' + A + '"/>' +
        // Stars
        '<circle cx="90" cy="50" r="3" fill="' + Y + '"/>' +
        '<circle cx="200" cy="45" r="4" fill="' + Y + '"/>' +
        '<circle cx="75" cy="130" r="2.5" fill="' + S + '"/>' +
        '<circle cx="210" cy="120" r="3" fill="' + S + '"/>' +
        // Speech bubble
        '<rect x="175" y="90" width="60" height="30" rx="6" fill="' + W + '" stroke="' + G + '"/>' +
        '<text x="205" y="109" text-anchor="middle" font-size="10" font-weight="600" fill="' + P + '">Hello!</text>' +
        '</svg>';
    },

    'profile-setup': function () {
      return '<svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="140" cy="100" r="80" fill="' + BG + '"/>' +
        // ID card
        '<rect x="85" y="55" width="110" height="90" rx="10" fill="' + W + '" stroke="' + G + '" stroke-width="2"/>' +
        // Photo placeholder
        '<rect x="97" y="70" width="30" height="30" rx="4" fill="' + S + '"/>' +
        '<circle cx="112" cy="80" r="8" fill="' + W + '"/>' +
        '<path d="M100 95 Q112 88 124 95" fill="' + W + '"/>' +
        // Text lines
        '<rect x="135" y="72" width="48" height="6" rx="3" fill="' + G + '"/>' +
        '<rect x="135" y="84" width="35" height="6" rx="3" fill="' + G + '"/>' +
        '<rect x="135" y="96" width="42" height="6" rx="3" fill="' + G + '"/>' +
        // Progress bar
        '<rect x="97" y="115" width="86" height="8" rx="4" fill="' + G + '"/>' +
        '<rect x="97" y="115" width="58" height="8" rx="4" fill="' + P + '"/>' +
        // Pencil icon
        '<rect x="200" y="45" width="6" height="25" rx="2" fill="' + A + '" transform="rotate(-30 200 45)"/>' +
        // Sparkle
        '<circle cx="80" cy="65" r="3" fill="' + Y + '"/>' +
        '<circle cx="215" cy="140" r="2.5" fill="' + S + '"/>' +
        '</svg>';
    },

    'first-tool': function () {
      return '<svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="140" cy="100" r="80" fill="' + BG + '"/>' +
        // Wrench
        '<path d="M110 70 L130 90 L120 100 L100 80 Z" fill="' + P + '"/>' +
        '<circle cx="105" cy="75" r="15" fill="none" stroke="' + P + '" stroke-width="4"/>' +
        // Gear
        '<circle cx="170" cy="90" r="18" fill="' + S + '"/>' +
        '<circle cx="170" cy="90" r="10" fill="' + BG + '"/>' +
        '<rect x="167" y="68" width="6" height="10" rx="2" fill="' + S + '"/>' +
        '<rect x="167" y="102" width="6" height="10" rx="2" fill="' + S + '"/>' +
        '<rect x="148" y="87" width="10" height="6" rx="2" fill="' + S + '"/>' +
        '<rect x="182" y="87" width="10" height="6" rx="2" fill="' + S + '"/>' +
        // Lightning bolt
        '<polygon points="138,50 130,80 142,78 134,110 155,70 143,72" fill="' + Y + '"/>' +
        // Small dots
        '<circle cx="80" cy="110" r="3" fill="' + A + '"/>' +
        '<circle cx="220" cy="60" r="3" fill="' + A + '"/>' +
        '<circle cx="95" cy="140" r="2" fill="' + Y + '"/>' +
        '</svg>';
    },

    upgrade: function () {
      return '<svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="140" cy="100" r="80" fill="' + BG + '"/>' +
        // Rocket body
        '<rect x="130" y="55" width="20" height="55" rx="10" fill="' + P + '"/>' +
        '<polygon points="130,55 140,35 150,55" fill="' + A + '"/>' +
        // Fins
        '<polygon points="130,95 118,110 130,105" fill="' + S + '"/>' +
        '<polygon points="150,95 162,110 150,105" fill="' + S + '"/>' +
        // Flames
        '<ellipse cx="140" cy="118" rx="8" ry="14" fill="' + Y + '"/>' +
        '<ellipse cx="140" cy="115" rx="5" ry="10" fill="' + A + '"/>' +
        // Window
        '<circle cx="140" cy="72" r="5" fill="' + W + '"/>' +
        // Stars
        '<circle cx="90" cy="55" r="3" fill="' + Y + '"/>' +
        '<circle cx="100" cy="85" r="2" fill="' + Y + '"/>' +
        '<circle cx="195" cy="60" r="3.5" fill="' + Y + '"/>' +
        '<circle cx="185" cy="100" r="2" fill="' + Y + '"/>' +
        // PRO badge
        '<rect x="170" y="50" width="40" height="20" rx="4" fill="' + P + '"/>' +
        '<text x="190" y="64" text-anchor="middle" font-size="10" font-weight="700" fill="' + W + '">PRO</text>' +
        '</svg>';
    },

    success: function () {
      return '<svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="140" cy="100" r="80" fill="' + BG + '"/>' +
        // Trophy base
        '<rect x="125" y="130" width="30" height="8" rx="2" fill="' + G + '"/>' +
        '<rect x="133" y="115" width="14" height="18" rx="2" fill="' + Y + '"/>' +
        // Trophy cup
        '<path d="M115 65 Q115 110 140 115 Q165 110 165 65 Z" fill="' + Y + '"/>' +
        '<path d="M120 70 Q120 105 140 110 Q160 105 160 70 Z" fill="' + A + '" opacity="0.3"/>' +
        // Handles
        '<path d="M115 75 Q95 75 95 90 Q95 105 115 100" fill="none" stroke="' + Y + '" stroke-width="4"/>' +
        '<path d="M165 75 Q185 75 185 90 Q185 105 165 100" fill="none" stroke="' + Y + '" stroke-width="4"/>' +
        // Star on trophy
        '<polygon points="140,75 143,84 153,84 145,90 148,100 140,94 132,100 135,90 127,84 137,84" fill="' + W + '"/>' +
        // Confetti
        '<circle cx="85" cy="50" r="4" fill="' + P + '"/>' +
        '<circle cx="200" cy="45" r="3" fill="' + A + '"/>' +
        '<circle cx="75" cy="100" r="2.5" fill="' + Y + '"/>' +
        '<circle cx="210" cy="90" r="3" fill="' + S + '"/>' +
        '<rect x="95" y="40" width="8" height="4" rx="2" fill="' + S + '" transform="rotate(30 95 40)"/>' +
        '<rect x="190" y="70" width="8" height="4" rx="2" fill="' + P + '" transform="rotate(-20 190 70)"/>' +
        '<rect x="80" cy="120" width="6" height="3" rx="1.5" fill="' + A + '" transform="rotate(15 80 120)"/>' +
        '</svg>';
    }
  };

  var CAPTIONS = {
    welcome: { title: 'Welcome to Cortex', desc: 'Your AI-powered freelance toolkit is ready.' },
    'profile-setup': { title: 'Set Up Your Profile', desc: 'Tell us about your skills so we can personalize your tools.' },
    'first-tool': { title: 'Try Your First Tool', desc: 'Pick a tool and see AI do the heavy lifting.' },
    upgrade: { title: 'Unlock Pro Features', desc: 'Go Pro for unlimited access to all 25+ tools.' },
    success: { title: 'You\'re All Set!', desc: 'Start winning more freelance gigs with Cortex.' }
  };

  function renderIllustration(name, container, opts) {
    opts = opts || {};
    var illFn = ILLUSTRATIONS[name];
    if (!illFn) return '';

    var cap = CAPTIONS[name] || {};
    var title = opts.title || cap.title || '';
    var desc = opts.desc || cap.desc || '';
    var size = opts.size || '200px';

    var html = '<div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:1.5rem">';
    html += '<div style="width:' + size + ';max-width:100%">' + illFn() + '</div>';
    if (title) html += '<h3 style="font-size:1.125rem;font-weight:700;margin:1rem 0 0.25rem;color:var(--ct-colors-neutral-900,#111827)">' + title + '</h3>';
    if (desc) html += '<p style="font-size:0.875rem;color:var(--ct-colors-neutral-500,#6b7280);margin:0;max-width:300px">' + desc + '</p>';
    html += '</div>';

    if (container) {
      var el = typeof container === 'string' ? document.querySelector(container) : container;
      if (el) el.innerHTML = html;
    }

    return html;
  }

  function renderIllustrationShowcase() {
    var html = '<div style="font-family:var(--ct-typography-font-family,sans-serif);padding:1.5rem">';
    html += '<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem">Onboarding Illustrations</h2>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem">';

    Object.keys(ILLUSTRATIONS).forEach(function (name) {
      html += '<div style="border:1px solid var(--ct-colors-neutral-200,#e5e7eb);border-radius:var(--ct-radius-lg,0.75rem);overflow:hidden">';
      html += '<div style="padding:0.5rem 1rem;background:var(--ct-colors-neutral-50,#f9fafb);border-bottom:1px solid var(--ct-colors-neutral-200,#e5e7eb);font-size:0.75rem;font-weight:600;color:var(--ct-colors-neutral-500,#6b7280);text-transform:uppercase;letter-spacing:0.05em">' + name + '</div>';
      html += renderIllustration(name);
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  window.CortexFreelancer.OnboardingIllustrations = {
    renderIllustration: renderIllustration,
    renderIllustrationShowcase: renderIllustrationShowcase,
    names: Object.keys(ILLUSTRATIONS)
  };
})();
