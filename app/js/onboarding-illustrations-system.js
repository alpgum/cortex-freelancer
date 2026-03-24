/**
 * @file Onboarding Illustrations System
 * @description SVG-based illustration system for onboarding flow with 5 custom graphics:
 *   welcome, profile analysis, tools, upgrade, and success states.
 * @version 1.0.0
 * @task CF-296
 */

(function() {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /**
   * @namespace OnboardingIllustrations
   * @memberof window.CortexFreelancer
   * @description Generates and manages SVG illustrations for the onboarding experience.
   */
  const OnboardingIllustrations = {
    /** @type {Object<string, Object>} Illustration definitions */
    illustrations: {
      welcome: {
        id: 'onboarding-welcome',
        title: 'Welcome to Cortex Freelancer',
        viewBox: '0 0 400 300',
        palette: { primary: '#6C5CE7', secondary: '#A29BFE', accent: '#FD79A8', bg: '#F8F9FF', skin: '#FECA57', white: '#FFFFFF' },
        /**
         * @returns {string} SVG markup for the welcome illustration
         */
        render() {
          const p = this.palette;
          return `<svg viewBox="${this.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${this.title}">
            <title>${this.title}</title>
            <defs>
              <linearGradient id="welc-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${p.bg}"/>
                <stop offset="100%" stop-color="${p.secondary}" stop-opacity="0.2"/>
              </linearGradient>
              <linearGradient id="welc-card" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="${p.primary}"/>
                <stop offset="100%" stop-color="${p.secondary}"/>
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#welc-bg)" rx="16"/>
            <!-- Floating cards -->
            <g opacity="0.15">
              <rect x="20" y="40" width="80" height="60" rx="8" fill="${p.primary}" transform="rotate(-8 60 70)"/>
              <rect x="300" y="30" width="70" height="50" rx="8" fill="${p.accent}" transform="rotate(6 335 55)"/>
              <rect x="310" y="200" width="60" height="45" rx="8" fill="${p.secondary}" transform="rotate(-4 340 222)"/>
            </g>
            <!-- Person figure -->
            <circle cx="200" cy="110" r="28" fill="${p.skin}"/>
            <path d="M172 145 C172 145 180 170 200 170 C220 170 228 145 228 145" fill="${p.primary}"/>
            <rect x="175" y="145" width="50" height="55" rx="10" fill="${p.primary}"/>
            <!-- Waving hand -->
            <g transform="translate(230 120) rotate(-15)">
              <rect x="0" y="0" width="8" height="25" rx="4" fill="${p.skin}"/>
              <circle cx="4" cy="-4" r="6" fill="${p.skin}"/>
            </g>
            <!-- Welcome text badge -->
            <rect x="120" y="215" width="160" height="40" rx="20" fill="${p.primary}"/>
            <text x="200" y="240" text-anchor="middle" fill="${p.white}" font-family="system-ui,sans-serif" font-size="14" font-weight="600">Welcome!</text>
            <!-- Sparkles -->
            <g fill="${p.accent}">
              <polygon points="80,100 84,90 88,100 84,104" opacity="0.7"/>
              <polygon points="320,130 323,122 326,130 323,134" opacity="0.5"/>
              <polygon points="150,60 153,52 156,60 153,64" opacity="0.6"/>
            </g>
          </svg>`;
        }
      },

      profileAnalysis: {
        id: 'onboarding-profile-analysis',
        title: 'Profile Analysis',
        viewBox: '0 0 400 300',
        palette: { primary: '#0984E3', secondary: '#74B9FF', accent: '#00CEC9', bg: '#F0F8FF', dark: '#2D3436', white: '#FFFFFF' },
        /**
         * @returns {string} SVG markup for the profile analysis illustration
         */
        render() {
          const p = this.palette;
          return `<svg viewBox="${this.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${this.title}">
            <title>${this.title}</title>
            <defs>
              <linearGradient id="prof-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${p.bg}"/>
                <stop offset="100%" stop-color="${p.secondary}" stop-opacity="0.15"/>
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#prof-bg)" rx="16"/>
            <!-- Profile card -->
            <rect x="100" y="40" width="200" height="220" rx="12" fill="${p.white}" stroke="${p.secondary}" stroke-width="1.5"/>
            <!-- Avatar circle -->
            <circle cx="200" cy="90" r="30" fill="${p.secondary}" opacity="0.3"/>
            <circle cx="200" cy="90" r="24" fill="${p.primary}"/>
            <text x="200" y="96" text-anchor="middle" fill="${p.white}" font-family="system-ui,sans-serif" font-size="18" font-weight="700">A</text>
            <!-- Profile lines -->
            <rect x="155" y="130" width="90" height="8" rx="4" fill="${p.dark}" opacity="0.15"/>
            <rect x="140" y="148" width="120" height="6" rx="3" fill="${p.dark}" opacity="0.08"/>
            <!-- Stats bars -->
            <g transform="translate(130 170)">
              <rect x="0" y="0" width="140" height="14" rx="7" fill="${p.secondary}" opacity="0.2"/>
              <rect x="0" y="0" width="112" height="14" rx="7" fill="${p.primary}" opacity="0.8"/>
              <rect x="0" y="22" width="140" height="14" rx="7" fill="${p.secondary}" opacity="0.2"/>
              <rect x="0" y="22" width="98" height="14" rx="7" fill="${p.accent}"/>
              <rect x="0" y="44" width="140" height="14" rx="7" fill="${p.secondary}" opacity="0.2"/>
              <rect x="0" y="44" width="126" height="14" rx="7" fill="${p.primary}" opacity="0.6"/>
            </g>
            <!-- Scanning line animation hint -->
            <line x1="100" y1="150" x2="300" y2="150" stroke="${p.accent}" stroke-width="2" opacity="0.4" stroke-dasharray="6 4"/>
            <!-- Magnifier -->
            <g transform="translate(310 60)">
              <circle cx="0" cy="0" r="20" fill="none" stroke="${p.primary}" stroke-width="3"/>
              <line x1="14" y1="14" x2="28" y2="28" stroke="${p.primary}" stroke-width="3" stroke-linecap="round"/>
            </g>
          </svg>`;
        }
      },

      tools: {
        id: 'onboarding-tools',
        title: 'Your Freelancing Toolkit',
        viewBox: '0 0 400 300',
        palette: { primary: '#E17055', secondary: '#FAB1A0', accent: '#FDCB6E', bg: '#FFF9F0', dark: '#2D3436', white: '#FFFFFF' },
        /**
         * @returns {string} SVG markup for the tools illustration
         */
        render() {
          const p = this.palette;
          const toolIcons = [
            { x: 60, y: 80, label: 'Invoice', icon: `<rect x="-16" y="-20" width="32" height="40" rx="4" fill="${p.white}" stroke="${p.primary}" stroke-width="1.5"/><line x1="-8" y1="-10" x2="8" y2="-10" stroke="${p.dark}" stroke-width="1.5" opacity="0.3"/><line x1="-8" y1="-2" x2="8" y2="-2" stroke="${p.dark}" stroke-width="1.5" opacity="0.3"/><line x1="-8" y1="6" x2="4" y2="6" stroke="${p.dark}" stroke-width="1.5" opacity="0.3"/>` },
            { x: 200, y: 60, label: 'Analytics', icon: `<rect x="-12" y="4" width="6" height="16" rx="2" fill="${p.primary}"/><rect x="-3" y="-6" width="6" height="26" rx="2" fill="${p.accent}"/><rect x="6" y="-14" width="6" height="34" rx="2" fill="${p.primary}" opacity="0.7"/>` },
            { x: 340, y: 80, label: 'Calendar', icon: `<rect x="-18" y="-16" width="36" height="32" rx="4" fill="${p.white}" stroke="${p.primary}" stroke-width="1.5"/><rect x="-18" y="-16" width="36" height="10" rx="4" fill="${p.primary}"/><g fill="${p.dark}" opacity="0.3"><rect x="-12" y="2" width="6" height="6" rx="1"/><rect x="-2" y="2" width="6" height="6" rx="1"/><rect x="8" y="2" width="6" height="6" rx="1"/></g>` },
            { x: 120, y: 200, label: 'Proposals', icon: `<rect x="-18" y="-22" width="36" height="44" rx="4" fill="${p.white}" stroke="${p.accent}" stroke-width="1.5"/><path d="M-6 -4 L-2 2 L8 -8" stroke="${p.primary}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` },
            { x: 280, y: 200, label: 'Contracts', icon: `<rect x="-18" y="-22" width="36" height="44" rx="6" fill="${p.white}" stroke="${p.primary}" stroke-width="1.5"/><path d="M-4 8 Q0 14 6 6" stroke="${p.dark}" stroke-width="1.5" fill="none" opacity="0.5"/>` }
          ];
          const icons = toolIcons.map(t => `<g transform="translate(${t.x} ${t.y})">${t.icon}<text y="32" text-anchor="middle" fill="${p.dark}" font-family="system-ui,sans-serif" font-size="10" opacity="0.6">${t.label}</text></g>`).join('');
          return `<svg viewBox="${this.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${this.title}">
            <title>${this.title}</title>
            <rect width="400" height="300" fill="${p.bg}" rx="16"/>
            <!-- Connection lines -->
            <g stroke="${p.secondary}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.5">
              <line x1="80" y1="95" x2="180" y2="75"/>
              <line x1="220" y1="75" x2="320" y2="95"/>
              <line x1="75" y1="110" x2="110" y2="185"/>
              <line x1="325" y1="110" x2="290" y2="185"/>
              <line x1="145" y1="210" x2="255" y2="210"/>
            </g>
            ${icons}
            <!-- Central hub -->
            <circle cx="200" cy="145" r="22" fill="${p.primary}" opacity="0.1"/>
            <circle cx="200" cy="145" r="14" fill="${p.primary}"/>
            <text x="200" y="150" text-anchor="middle" fill="${p.white}" font-family="system-ui,sans-serif" font-size="12" font-weight="700">C</text>
          </svg>`;
        }
      },

      upgrade: {
        id: 'onboarding-upgrade',
        title: 'Upgrade Your Plan',
        viewBox: '0 0 400 300',
        palette: { primary: '#6C5CE7', secondary: '#A29BFE', accent: '#FD79A8', gold: '#FDCB6E', bg: '#F8F5FF', white: '#FFFFFF', dark: '#2D3436' },
        /**
         * @returns {string} SVG markup for the upgrade illustration
         */
        render() {
          const p = this.palette;
          return `<svg viewBox="${this.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${this.title}">
            <title>${this.title}</title>
            <defs>
              <linearGradient id="upg-shine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${p.gold}" stop-opacity="0.6"/>
                <stop offset="50%" stop-color="${p.gold}" stop-opacity="0"/>
                <stop offset="100%" stop-color="${p.gold}" stop-opacity="0.4"/>
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="${p.bg}" rx="16"/>
            <!-- Rocket body -->
            <g transform="translate(200 150)">
              <ellipse cx="0" cy="0" rx="24" ry="50" fill="${p.primary}"/>
              <ellipse cx="0" cy="-20" rx="18" ry="20" fill="${p.secondary}" opacity="0.5"/>
              <!-- Nose cone -->
              <path d="M-18 -40 Q0 -80 18 -40" fill="${p.accent}"/>
              <!-- Window -->
              <circle cx="0" cy="-15" r="10" fill="${p.white}" opacity="0.9"/>
              <circle cx="0" cy="-15" r="7" fill="${p.primary}" opacity="0.3"/>
              <!-- Fins -->
              <path d="M-24 30 L-40 55 L-18 40 Z" fill="${p.accent}" opacity="0.8"/>
              <path d="M24 30 L40 55 L18 40 Z" fill="${p.accent}" opacity="0.8"/>
              <!-- Flame -->
              <ellipse cx="0" cy="55" rx="14" ry="20" fill="${p.gold}" opacity="0.8"/>
              <ellipse cx="0" cy="60" rx="8" ry="14" fill="${p.accent}" opacity="0.6"/>
            </g>
            <!-- Stars -->
            <g fill="${p.gold}">
              <polygon points="60,50 63,42 66,50 63,54" opacity="0.6"/>
              <polygon points="340,80 343,72 346,80 343,84" opacity="0.5"/>
              <polygon points="80,220 83,214 86,220 83,223" opacity="0.4"/>
              <polygon points="320,200 323,193 326,200 323,204" opacity="0.7"/>
              <polygon points="50,140 53,134 56,140 53,143" opacity="0.3"/>
              <polygon points="350,140 353,134 356,140 353,143" opacity="0.5"/>
            </g>
            <!-- PRO badge -->
            <rect x="155" y="250" width="90" height="30" rx="15" fill="${p.gold}"/>
            <text x="200" y="270" text-anchor="middle" fill="${p.dark}" font-family="system-ui,sans-serif" font-size="13" font-weight="700">PRO</text>
          </svg>`;
        }
      },

      success: {
        id: 'onboarding-success',
        title: 'You\'re All Set!',
        viewBox: '0 0 400 300',
        palette: { primary: '#00B894', secondary: '#55EFC4', accent: '#FDCB6E', bg: '#F0FFF4', white: '#FFFFFF', dark: '#2D3436' },
        /**
         * @returns {string} SVG markup for the success illustration
         */
        render() {
          const p = this.palette;
          return `<svg viewBox="${this.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${this.title}">
            <title>${this.title}</title>
            <rect width="400" height="300" fill="${p.bg}" rx="16"/>
            <!-- Confetti -->
            <g opacity="0.6">
              <rect x="50" y="30" width="8" height="14" rx="2" fill="${p.accent}" transform="rotate(25 54 37)"/>
              <rect x="120" y="20" width="6" height="12" rx="2" fill="#FD79A8" transform="rotate(-15 123 26)"/>
              <rect x="280" y="25" width="8" height="14" rx="2" fill="#6C5CE7" transform="rotate(30 284 32)"/>
              <rect x="340" y="50" width="6" height="12" rx="2" fill="${p.primary}" transform="rotate(-20 343 56)"/>
              <rect x="70" y="240" width="7" height="12" rx="2" fill="#E17055" transform="rotate(15 73 246)"/>
              <rect x="330" y="230" width="6" height="10" rx="2" fill="${p.accent}" transform="rotate(-25 333 235)"/>
              <circle cx="160" cy="40" r="4" fill="${p.secondary}"/>
              <circle cx="250" cy="35" r="3" fill="#FD79A8"/>
              <circle cx="90" cy="180" r="3" fill="#6C5CE7"/>
              <circle cx="310" cy="170" r="4" fill="${p.accent}"/>
            </g>
            <!-- Main checkmark circle -->
            <circle cx="200" cy="130" r="60" fill="${p.primary}" opacity="0.15"/>
            <circle cx="200" cy="130" r="48" fill="${p.primary}"/>
            <path d="M175 130 L192 148 L228 112" stroke="${p.white}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Trophy -->
            <g transform="translate(200 235)">
              <rect x="-8" y="0" width="16" height="8" rx="2" fill="${p.accent}"/>
              <rect x="-14" y="8" width="28" height="5" rx="2" fill="${p.accent}" opacity="0.7"/>
              <path d="M-12 -2 L-12 -20 Q-12 -30 0 -30 Q12 -30 12 -20 L12 -2" fill="${p.accent}"/>
              <path d="M-18 -18 Q-24 -10 -12 -4" stroke="${p.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>
              <path d="M18 -18 Q24 -10 12 -4" stroke="${p.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>
            </g>
          </svg>`;
        }
      }
    },

    /**
     * Render an illustration into a container element.
     * @param {string} key - Illustration key: welcome|profileAnalysis|tools|upgrade|success
     * @param {HTMLElement|string} container - DOM element or selector
     * @param {Object} [options] - Rendering options
     * @param {string} [options.width='100%'] - CSS width
     * @param {string} [options.maxWidth='400px'] - CSS max-width
     * @param {boolean} [options.animate=true] - Whether to apply entrance animation
     * @returns {HTMLElement|null} The wrapper element or null if not found
     */
    render(key, container, options) {
      const illust = this.illustrations[key];
      if (!illust) {
        console.warn('[OnboardingIllustrations] Unknown illustration:', key);
        return null;
      }

      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) {
        console.warn('[OnboardingIllustrations] Container not found:', container);
        return null;
      }

      const opts = Object.assign({ width: '100%', maxWidth: '400px', animate: true }, options);

      const wrapper = document.createElement('div');
      wrapper.className = 'cf-onboarding-illust';
      wrapper.setAttribute('data-illustration', key);
      wrapper.style.cssText = `width:${opts.width};max-width:${opts.maxWidth};margin:0 auto;`;

      if (opts.animate) {
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'translateY(16px)';
        wrapper.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            wrapper.style.opacity = '1';
            wrapper.style.transform = 'translateY(0)';
          });
        });
      }

      wrapper.innerHTML = illust.render();
      el.appendChild(wrapper);
      return wrapper;
    },

    /**
     * Render all illustrations in sequence into a container.
     * @param {HTMLElement|string} container - DOM element or selector
     * @param {Object} [options] - Options passed to each render call
     * @returns {HTMLElement[]} Array of wrapper elements
     */
    renderAll(container, options) {
      var results = [];
      var keys = ['welcome', 'profileAnalysis', 'tools', 'upgrade', 'success'];
      for (var i = 0; i < keys.length; i++) {
        var el = this.render(keys[i], container, options);
        if (el) results.push(el);
      }
      return results;
    },

    /**
     * Get raw SVG string for a given illustration.
     * @param {string} key - Illustration key
     * @returns {string|null} SVG markup or null
     */
    getSVG(key) {
      var illust = this.illustrations[key];
      return illust ? illust.render() : null;
    },

    /**
     * Get all available illustration keys.
     * @returns {string[]}
     */
    getAvailableKeys() {
      return Object.keys(this.illustrations);
    }
  };

  window.CortexFreelancer.OnboardingIllustrations = OnboardingIllustrations;
})();
