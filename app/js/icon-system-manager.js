/**
 * CF-295 Icon System Manager
 * Provides a consistent icon system using Lucide icons rendered as inline SVG.
 * Replaces inconsistent icon usage across all pages with a unified API.
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  /** @type {string} Lucide CDN URL */
  const LUCIDE_CDN = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';

  /**
   * Built-in SVG path data for core icons (fallback when CDN is unavailable).
   * Each entry is an array of SVG child element strings.
   * @type {Object<string, string>}
   */
  const ICON_PATHS = {
    'arrow-left':     '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'arrow-right':    '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'check':          '<path d="M20 6 9 17l-5-5"/>',
    'chevron-down':   '<path d="m6 9 6 6 6-6"/>',
    'chevron-right':  '<path d="m9 18 6-6-6-6"/>',
    'chevron-up':     '<path d="m18 15-6-6-6 6"/>',
    'close':          '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'x':              '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'copy':           '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'download':       '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    'edit':           '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    'external-link':  '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'eye':            '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    'file':           '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    'filter':         '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    'grid':           '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    'heart':          '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'home':           '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'info':           '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'loader':         '<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/>',
    'lock':           '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'log-out':        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    'mail':           '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'menu':           '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    'moon':           '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'plus':           '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'search':         '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'settings':       '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'star':           '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'sun':            '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    'trash':          '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    'upload':         '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    'user':           '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'users':          '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'warning':        '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'zap':            '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'
  };

  /**
   * Default icon rendering options.
   * @type {Object}
   */
  const DEFAULTS = {
    size: 24,
    strokeWidth: 2,
    color: 'currentColor',
    fill: 'none',
    className: 'cf-icon'
  };

  /** @type {boolean} */
  var lucideLoaded = false;

  /**
   * Create an SVG icon element.
   * @param {string} name - Icon name (kebab-case, e.g. 'arrow-left')
   * @param {Object} [options]
   * @param {number} [options.size=24] - Icon size in px
   * @param {number} [options.strokeWidth=2] - Stroke width
   * @param {string} [options.color='currentColor'] - Stroke color
   * @param {string} [options.fill='none'] - Fill color
   * @param {string} [options.className='cf-icon'] - CSS class
   * @param {string} [options.ariaLabel] - Accessible label (icon gets role="img")
   * @returns {SVGElement}
   */
  function createIcon(name, options) {
    var opts = Object.assign({}, DEFAULTS, options);
    var pathData = ICON_PATHS[name];

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', opts.size);
    svg.setAttribute('height', opts.size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', opts.fill);
    svg.setAttribute('stroke', opts.color);
    svg.setAttribute('stroke-width', opts.strokeWidth);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', opts.className + ' cf-icon-' + name);

    if (opts.ariaLabel) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', opts.ariaLabel);
    } else {
      svg.setAttribute('aria-hidden', 'true');
    }

    if (pathData) {
      svg.innerHTML = pathData;
    } else if (lucideLoaded && window.lucide) {
      // Try Lucide runtime if available
      var iconData = window.lucide.icons[name];
      if (iconData) {
        svg.innerHTML = iconData[1].map(function(child) {
          var tag = child[0];
          var attrs = child[1] || {};
          var attrStr = Object.keys(attrs).map(function(k) {
            return k + '="' + attrs[k] + '"';
          }).join(' ');
          return '<' + tag + ' ' + attrStr + '/>';
        }).join('');
      }
    }

    return svg;
  }

  /**
   * Get icon as an HTML string.
   * @param {string} name - Icon name
   * @param {Object} [options] - Same as createIcon options
   * @returns {string}
   */
  function iconHTML(name, options) {
    var el = createIcon(name, options);
    var wrapper = document.createElement('div');
    wrapper.appendChild(el);
    return wrapper.innerHTML;
  }

  /**
   * Replace an element's icon content with a consistent Lucide icon.
   * @param {HTMLElement} el - The element containing an icon
   * @param {string} iconName - Target icon name
   * @param {Object} [options]
   */
  function replaceIcon(el, iconName, options) {
    var existingSvg = el.querySelector('svg');
    var existingI = el.querySelector('i');
    var icon = createIcon(iconName, options);

    if (existingSvg) {
      existingSvg.replaceWith(icon);
    } else if (existingI) {
      existingI.replaceWith(icon);
    } else {
      el.prepend(icon);
    }
  }

  /**
   * Scan and normalize all icons on the page based on class-name heuristics.
   * Maps common icon class patterns to Lucide icon names.
   * @param {HTMLElement} [root=document.body]
   * @returns {number} Number of icons replaced
   */
  function normalizeAll(root) {
    root = root || document.body;
    var count = 0;

    /** Map of common class substrings to Lucide icon names */
    var CLASS_MAP = {
      'home': 'home', 'house': 'home',
      'search': 'search', 'magnif': 'search',
      'user': 'user', 'person': 'user', 'account': 'user',
      'settings': 'settings', 'gear': 'settings', 'cog': 'settings',
      'menu': 'menu', 'hamburger': 'menu', 'bars': 'menu',
      'close': 'close', 'times': 'close',
      'edit': 'edit', 'pencil': 'edit', 'pen': 'edit',
      'trash': 'trash', 'delete': 'trash', 'remove': 'trash',
      'plus': 'plus', 'add': 'plus',
      'check': 'check', 'tick': 'check',
      'download': 'download',
      'upload': 'upload',
      'mail': 'mail', 'email': 'mail', 'envelope': 'mail',
      'star': 'star', 'favorite': 'star',
      'heart': 'heart', 'like': 'heart',
      'lock': 'lock', 'secure': 'lock',
      'eye': 'eye', 'view': 'eye', 'visible': 'eye',
      'filter': 'filter', 'funnel': 'filter',
      'sun': 'sun', 'light': 'sun',
      'moon': 'moon', 'dark': 'moon',
      'warning': 'warning', 'alert': 'warning', 'exclamation': 'warning',
      'info': 'info', 'information': 'info',
      'arrow-left': 'arrow-left', 'back': 'arrow-left',
      'arrow-right': 'arrow-right', 'forward': 'arrow-right',
      'external': 'external-link', 'launch': 'external-link',
      'copy': 'copy', 'clipboard': 'copy',
      'logout': 'log-out', 'signout': 'log-out',
      'grid': 'grid', 'dashboard': 'grid',
      'bolt': 'zap', 'lightning': 'zap', 'zap': 'zap'
    };

    var iconElements = root.querySelectorAll('i[class*="icon"], i[class*="fa-"], i[class*="material-"], .icon > i, .icon > svg');
    iconElements.forEach(function(el) {
      var cls = (el.className || '').toString().toLowerCase();
      var matched = null;
      var keys = Object.keys(CLASS_MAP);
      for (var i = 0; i < keys.length; i++) {
        if (cls.indexOf(keys[i]) !== -1) {
          matched = CLASS_MAP[keys[i]];
          break;
        }
      }
      if (matched) {
        var parent = el.parentNode;
        var icon = createIcon(matched);
        parent.replaceChild(icon, el);
        count++;
      }
    });

    return count;
  }

  /**
   * Register a custom icon by name.
   * @param {string} name - Icon name
   * @param {string} svgContent - Inner SVG markup (paths, circles, etc.)
   */
  function register(name, svgContent) {
    ICON_PATHS[name] = svgContent;
  }

  /**
   * Get all available icon names.
   * @returns {string[]}
   */
  function listIcons() {
    return Object.keys(ICON_PATHS).sort();
  }

  /**
   * Load the Lucide library from CDN for access to the full icon set.
   * @returns {Promise<boolean>}
   */
  function loadLucide() {
    return new Promise(function(resolve) {
      if (lucideLoaded || window.lucide) {
        lucideLoaded = true;
        resolve(true);
        return;
      }
      var script = document.createElement('script');
      script.src = LUCIDE_CDN;
      script.onload = function() {
        lucideLoaded = true;
        resolve(true);
      };
      script.onerror = function() {
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Inject base icon styles.
   */
  function injectStyles() {
    if (document.getElementById('cf-icon-styles')) return;
    var style = document.createElement('style');
    style.id = 'cf-icon-styles';
    style.textContent = [
      '.cf-icon {',
      '  display: inline-block;',
      '  vertical-align: middle;',
      '  flex-shrink: 0;',
      '}',
      '.cf-icon-spin {',
      '  animation: cf-icon-spin 1s linear infinite;',
      '}',
      '@keyframes cf-icon-spin {',
      '  from { transform: rotate(0deg); }',
      '  to { transform: rotate(360deg); }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * Initialize the icon system.
   * @param {Object} [options]
   * @param {boolean} [options.loadCDN=false] - Whether to load Lucide from CDN
   * @param {boolean} [options.normalizeExisting=false] - Replace existing inconsistent icons
   * @returns {Promise<{replaced: number}>}
   */
  function init(options) {
    var opts = Object.assign({ loadCDN: false, normalizeExisting: false }, options);
    injectStyles();

    var work = opts.loadCDN ? loadLucide() : Promise.resolve(true);
    return work.then(function() {
      var replaced = 0;
      if (opts.normalizeExisting) {
        replaced = normalizeAll();
      }
      return { replaced: replaced };
    });
  }

  ns.IconSystemManager = {
    ICON_PATHS: ICON_PATHS,
    DEFAULTS: DEFAULTS,
    createIcon: createIcon,
    iconHTML: iconHTML,
    replaceIcon: replaceIcon,
    normalizeAll: normalizeAll,
    register: register,
    listIcons: listIcons,
    loadLucide: loadLucide,
    init: init
  };
})();
