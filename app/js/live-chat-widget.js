/**
 * CF-255: Live chat widget integration (Crisp)
 * Lazy loading, custom styling, user context passing.
 */
(function () {
  'use strict';

  var CRISP_WEBSITE_ID = ''; // Set via configure()
  var CRISP_SCRIPT_URL = 'https://client.crisp.chat/l.js';
  var loaded = false;
  var config = {
    websiteId: '',
    color: '#4F46E5',
    position: 'right',
    locale: 'en',
    hideOnLoad: false,
    lazyLoadDelay: 3000
  };

  /**
   * Configure the live chat widget.
   * @param {object} opts
   * @param {string} opts.websiteId - Crisp website ID
   * @param {string} [opts.color] - Theme color
   * @param {"left"|"right"} [opts.position] - Widget position
   * @param {string} [opts.locale] - Language locale
   * @param {boolean} [opts.hideOnLoad] - Start with chat hidden
   * @param {number} [opts.lazyLoadDelay] - Delay in ms before loading script
   */
  function configure(opts) {
    if (!opts || !opts.websiteId) throw new Error('websiteId is required');
    config.websiteId = opts.websiteId;
    if (opts.color) config.color = opts.color;
    if (opts.position) config.position = opts.position;
    if (opts.locale) config.locale = opts.locale;
    if (typeof opts.hideOnLoad === 'boolean') config.hideOnLoad = opts.hideOnLoad;
    if (typeof opts.lazyLoadDelay === 'number') config.lazyLoadDelay = opts.lazyLoadDelay;
  }

  /**
   * Load the Crisp chat script lazily.
   * @returns {Promise<void>}
   */
  function load() {
    return new Promise(function (resolve, reject) {
      if (loaded) { resolve(); return; }
      if (!config.websiteId) { reject(new Error('Call configure() first')); return; }

      window.$crisp = window.$crisp || [];
      window.CRISP_WEBSITE_ID = config.websiteId;

      var script = document.createElement('script');
      script.src = CRISP_SCRIPT_URL;
      script.async = true;

      script.onload = function () {
        loaded = true;
        applyCustomStyles();
        if (config.hideOnLoad) {
          window.$crisp.push(['do', 'chat:hide']);
        }
        resolve();
      };

      script.onerror = function () {
        reject(new Error('Failed to load Crisp chat script'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialize with lazy loading after configured delay.
   * @returns {Promise<void>}
   */
  function init() {
    if (!config.websiteId) throw new Error('Call configure() first');

    return new Promise(function (resolve) {
      setTimeout(function () {
        load().then(resolve).catch(function () { resolve(); });
      }, config.lazyLoadDelay);
    });
  }

  /**
   * Apply custom styling to the widget.
   */
  function applyCustomStyles() {
    if (!window.$crisp) return;

    window.$crisp.push(['config', 'color:theme', [config.color]]);
    window.$crisp.push(['config', 'position:reverse', [config.position === 'left']]);
    window.$crisp.push(['config', 'locale:default', [config.locale]]);
  }

  /**
   * Pass user context to the chat widget for agent visibility.
   * @param {object} user
   * @param {string} [user.email]
   * @param {string} [user.name]
   * @param {string} [user.plan] - Current subscription plan
   * @param {string} [user.userId]
   * @param {object} [user.customData] - Additional key-value pairs
   */
  function setUserContext(user) {
    if (!window.$crisp || !user) return;

    if (user.email) window.$crisp.push(['set', 'user:email', [user.email]]);
    if (user.name) window.$crisp.push(['set', 'user:nickname', [user.name]]);

    var segments = [];
    if (user.plan) segments.push(user.plan);
    if (segments.length > 0) {
      window.$crisp.push(['set', 'session:segments', [segments]]);
    }

    var data = [];
    if (user.userId) data.push(['user_id', user.userId]);
    if (user.plan) data.push(['plan', user.plan]);

    if (user.customData) {
      var keys = Object.keys(user.customData);
      for (var i = 0; i < keys.length; i++) {
        data.push([keys[i], String(user.customData[keys[i]])]);
      }
    }

    if (data.length > 0) {
      window.$crisp.push(['set', 'session:data', [data]]);
    }
  }

  /**
   * Show the chat widget.
   */
  function show() {
    if (window.$crisp) window.$crisp.push(['do', 'chat:show']);
  }

  /**
   * Hide the chat widget.
   */
  function hide() {
    if (window.$crisp) window.$crisp.push(['do', 'chat:hide']);
  }

  /**
   * Open the chat window.
   */
  function open() {
    if (window.$crisp) window.$crisp.push(['do', 'chat:open']);
  }

  /**
   * Send an automated message to the user.
   * @param {string} text
   */
  function sendAutoMessage(text) {
    if (window.$crisp && text) {
      window.$crisp.push(['do', 'message:show', ['text', text]]);
    }
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.LiveChatWidget = {
    configure: configure,
    init: init,
    load: load,
    setUserContext: setUserContext,
    show: show,
    hide: hide,
    open: open,
    sendAutoMessage: sendAutoMessage
  };
})();
