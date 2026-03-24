/**
 * CF-273: Staging Environment Manager
 * Detects environment, manages staging-specific config, and provides env switching UI.
 */
(function () {
  'use strict';

  var ENV_KEY = 'cortex_environment_override';

  var ENVIRONMENTS = {
    production: {
      name: 'Production',
      host: 'cortexfreelancer.com',
      firebase: 'cortex-freelancer-prod',
      stripeMode: 'live',
      color: '#10b981'
    },
    staging: {
      name: 'Staging',
      host: 'staging.cortexfreelancer.com',
      firebase: 'cortex-freelancer-staging',
      stripeMode: 'test',
      color: '#f59e0b'
    },
    development: {
      name: 'Development',
      host: 'localhost',
      firebase: 'cortex-freelancer-dev',
      stripeMode: 'test',
      color: '#8b5cf6'
    },
    preview: {
      name: 'Preview',
      host: '*.vercel.app',
      firebase: 'cortex-freelancer-staging',
      stripeMode: 'test',
      color: '#3b82f6'
    }
  };

  /**
   * Detect current environment from hostname.
   * @returns {string}
   */
  function detectEnvironment() {
    var override = getOverride();
    if (override && ENVIRONMENTS[override]) return override;

    var host = window.location.hostname;
    if (host === 'cortexfreelancer.com' || host === 'www.cortexfreelancer.com') return 'production';
    if (host.includes('staging')) return 'staging';
    if (host === 'localhost' || host === '127.0.0.1') return 'development';
    if (host.includes('vercel.app')) return 'preview';
    return 'production';
  }

  /**
   * Get environment config.
   * @param {string} [env]
   * @returns {Object}
   */
  function getConfig(env) {
    env = env || detectEnvironment();
    return ENVIRONMENTS[env] || ENVIRONMENTS.production;
  }

  /**
   * Check if current env is production.
   * @returns {boolean}
   */
  function isProduction() {
    return detectEnvironment() === 'production';
  }

  /**
   * Check if current env is staging or dev.
   * @returns {boolean}
   */
  function isTestEnv() {
    var env = detectEnvironment();
    return env === 'staging' || env === 'development' || env === 'preview';
  }

  /**
   * Get override env.
   * @returns {string|null}
   */
  function getOverride() {
    try {
      return localStorage.getItem(ENV_KEY);
    } catch (_e) {
      return null;
    }
  }

  /**
   * Set environment override (dev only).
   * @param {string} env
   */
  function setOverride(env) {
    if (!isTestEnv() && env !== 'production') return; // Can't override in prod
    if (ENVIRONMENTS[env]) {
      localStorage.setItem(ENV_KEY, env);
    }
  }

  /**
   * Clear environment override.
   */
  function clearOverride() {
    localStorage.removeItem(ENV_KEY);
  }

  /**
   * Get Stripe mode for current env.
   * @returns {'live'|'test'}
   */
  function getStripeMode() {
    return getConfig().stripeMode;
  }

  /**
   * Get Firebase project for current env.
   * @returns {string}
   */
  function getFirebaseProject() {
    return getConfig().firebase;
  }

  /**
   * Render environment banner (non-production only).
   */
  function renderBanner() {
    var env = detectEnvironment();
    if (env === 'production') return;

    var config = getConfig(env);
    var existing = document.getElementById('cortex-env-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'cortex-env-banner';
    banner.setAttribute('style',
      'position:fixed;top:0;left:0;right:0;z-index:99999;padding:4px 12px;' +
      'background:' + config.color + ';color:#fff;font-size:12px;font-weight:600;' +
      'text-align:center;font-family:monospace');
    banner.textContent = config.name.toUpperCase() + ' ENVIRONMENT — ' +
      (config.stripeMode === 'test' ? 'Test Stripe Keys' : 'Live Mode');

    document.body.insertBefore(banner, document.body.firstChild);
  }

  /**
   * Get all environment names.
   * @returns {Array<string>}
   */
  function getEnvironments() {
    return Object.keys(ENVIRONMENTS);
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.StagingEnvironment = {
    detectEnvironment: detectEnvironment,
    getConfig: getConfig,
    isProduction: isProduction,
    isTestEnv: isTestEnv,
    setOverride: setOverride,
    clearOverride: clearOverride,
    getStripeMode: getStripeMode,
    getFirebaseProject: getFirebaseProject,
    renderBanner: renderBanner,
    getEnvironments: getEnvironments
  };
})();
