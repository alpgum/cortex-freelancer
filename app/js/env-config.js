/**
 * CF-261: Centralized Environment Variable Management
 * Runtime config loader with validation for required variables.
 */
(function () {
  'use strict';

  var REQUIRED_VARS = [
    'ANTHROPIC_API_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'SENDGRID_API_KEY'
  ];

  var DEFAULTS = {
    APP_ENV: 'development',
    APP_NAME: 'Cortex Freelancer',
    API_BASE_URL: '/api',
    LOG_LEVEL: 'info',
    RATE_LIMIT_GENERAL: '60',
    RATE_LIMIT_AI: '10'
  };

  var _config = null;

  /**
   * Load configuration from window.__ENV or defaults.
   * @returns {object}
   */
  function load() {
    var env = (typeof window !== 'undefined' && window.__ENV) || {};
    _config = {};

    // Apply defaults first
    Object.keys(DEFAULTS).forEach(function (key) {
      _config[key] = DEFAULTS[key];
    });

    // Override with environment values
    Object.keys(env).forEach(function (key) {
      _config[key] = env[key];
    });

    return _config;
  }

  /**
   * Get a configuration value.
   * @param {string} key
   * @param {*} [fallback]
   * @returns {*}
   */
  function get(key, fallback) {
    if (!_config) load();
    return _config[key] !== undefined ? _config[key] : fallback;
  }

  /**
   * Get all configuration values.
   * @returns {object}
   */
  function getAll() {
    if (!_config) load();
    var copy = {};
    Object.keys(_config).forEach(function (k) { copy[k] = _config[k]; });
    return copy;
  }

  /**
   * Validate that all required environment variables are present.
   * @returns {{ valid: boolean, missing: string[] }}
   */
  function validate() {
    if (!_config) load();

    var missing = [];
    REQUIRED_VARS.forEach(function (key) {
      if (!_config[key] || !String(_config[key]).trim()) {
        missing.push(key);
      }
    });

    return { valid: missing.length === 0, missing: missing };
  }

  /**
   * Check if running in production.
   * @returns {boolean}
   */
  function isProduction() {
    return get('APP_ENV') === 'production';
  }

  /**
   * Check if running in development.
   * @returns {boolean}
   */
  function isDevelopment() {
    return get('APP_ENV') === 'development';
  }

  /**
   * Get the list of required variable names.
   * @returns {string[]}
   */
  function getRequiredVars() {
    return REQUIRED_VARS.slice();
  }

  /**
   * Set a runtime config value (does not persist).
   * @param {string} key
   * @param {*} value
   */
  function set(key, value) {
    if (!_config) load();
    _config[key] = value;
  }

  /**
   * Get a safe summary of config (masks sensitive keys).
   * @returns {object}
   */
  function getSanitized() {
    if (!_config) load();
    var sanitized = {};
    var sensitivePatterns = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD'];

    Object.keys(_config).forEach(function (k) {
      var isSensitive = sensitivePatterns.some(function (p) {
        return k.toUpperCase().indexOf(p) >= 0;
      });
      sanitized[k] = isSensitive ? '***' : _config[k];
    });

    return sanitized;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EnvConfig = {
    load: load,
    get: get,
    set: set,
    getAll: getAll,
    validate: validate,
    isProduction: isProduction,
    isDevelopment: isDevelopment,
    getRequiredVars: getRequiredVars,
    getSanitized: getSanitized
  };
})();
