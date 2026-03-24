/**
 * CF-273 — Staging Environment Config
 * Detect staging vs prod from URL/env, switch Firebase/Stripe/API configs.
 * Includes renderEnvironmentBanner() for staging indicator.
 */
(function() {
  const NS = (window.CortexFreelancer = window.CortexFreelancer || {});

  // ── Environment detection ──
  function detectEnvironment() {
    const hostname = window.location.hostname;
    const search = window.location.search;

    if (search.includes('env=staging') || hostname.includes('staging') || hostname.includes('preview') || hostname.includes('--staging')) {
      return 'staging';
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'development';
    }
    return 'production';
  }

  // ── Config maps ──
  const configs = {
    production: {
      firebase: {
        apiKey: 'PROD_FIREBASE_API_KEY',
        authDomain: 'cortex-freelancer.firebaseapp.com',
        projectId: 'cortex-freelancer',
        storageBucket: 'cortex-freelancer.appspot.com',
        messagingSenderId: 'PROD_SENDER_ID',
        appId: 'PROD_APP_ID'
      },
      stripe: {
        publishableKey: 'pk_live_XXXX',
        priceIdMonthly: 'price_prod_monthly',
        priceIdAnnual: 'price_prod_annual'
      },
      api: {
        baseUrl: 'https://cortex-freelancer.vercel.app/api',
        timeout: 15000
      },
      features: {
        debugPanel: false,
        verboseLogging: false,
        mockPayments: false
      }
    },

    staging: {
      firebase: {
        apiKey: 'STAGING_FIREBASE_API_KEY',
        authDomain: 'cortex-freelancer-staging.firebaseapp.com',
        projectId: 'cortex-freelancer-staging',
        storageBucket: 'cortex-freelancer-staging.appspot.com',
        messagingSenderId: 'STAGING_SENDER_ID',
        appId: 'STAGING_APP_ID'
      },
      stripe: {
        publishableKey: 'pk_test_XXXX',
        priceIdMonthly: 'price_staging_monthly',
        priceIdAnnual: 'price_staging_annual'
      },
      api: {
        baseUrl: 'https://cortex-freelancer-staging.vercel.app/api',
        timeout: 30000
      },
      features: {
        debugPanel: true,
        verboseLogging: true,
        mockPayments: true
      }
    },

    development: {
      firebase: {
        apiKey: 'DEV_FIREBASE_API_KEY',
        authDomain: 'localhost',
        projectId: 'cortex-freelancer-dev',
        storageBucket: 'cortex-freelancer-dev.appspot.com',
        messagingSenderId: 'DEV_SENDER_ID',
        appId: 'DEV_APP_ID'
      },
      stripe: {
        publishableKey: 'pk_test_XXXX',
        priceIdMonthly: 'price_test_monthly',
        priceIdAnnual: 'price_test_annual'
      },
      api: {
        baseUrl: 'http://localhost:3000/api',
        timeout: 60000
      },
      features: {
        debugPanel: true,
        verboseLogging: true,
        mockPayments: true
      }
    }
  };

  // ── Accessor ──
  let _env = null;
  let _config = null;

  function getEnvironment() {
    if (!_env) _env = detectEnvironment();
    return _env;
  }

  function getConfig(section) {
    if (!_config) _config = configs[getEnvironment()] || configs.production;
    return section ? _config[section] : _config;
  }

  function isProduction() { return getEnvironment() === 'production'; }
  function isStaging() { return getEnvironment() === 'staging'; }
  function isDevelopment() { return getEnvironment() === 'development'; }

  function overrideEnvironment(env) {
    if (!configs[env]) throw new Error(`Unknown environment: ${env}`);
    _env = env;
    _config = configs[env];
  }

  // ── Staging banner ──
  function renderEnvironmentBanner() {
    const env = getEnvironment();
    if (env === 'production') return; // no banner in prod

    const existing = document.getElementById('cf-env-banner');
    if (existing) existing.remove();

    const colors = {
      staging: { bg: '#f59e0b', text: '#000' },
      development: { bg: '#8b5cf6', text: '#fff' }
    };
    const c = colors[env] || colors.staging;

    const banner = document.createElement('div');
    banner.id = 'cf-env-banner';
    banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:99999;background:${c.bg};color:${c.text};text-align:center;padding:4px 12px;font-size:12px;font-family:var(--font-mono,monospace);font-weight:600;letter-spacing:1px`;
    banner.textContent = `⚠ ${env.toUpperCase()} ENVIRONMENT — not production data`;

    // Dismiss button
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:inherit;cursor:pointer;margin-left:12px;font-size:14px';
    btn.onclick = () => banner.remove();
    banner.appendChild(btn);

    document.body.prepend(banner);

    // Shift body content down
    document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop) || 0) + 28 + 'px';
  }

  // ── Config summary (for debug panel) ──
  function getConfigSummary() {
    const env = getEnvironment();
    const cfg = getConfig();
    return {
      environment: env,
      firebaseProject: cfg.firebase.projectId,
      stripeMode: cfg.stripe.publishableKey.startsWith('pk_live') ? 'live' : 'test',
      apiBaseUrl: cfg.api.baseUrl,
      features: { ...cfg.features }
    };
  }

  NS.StagingConfig = {
    detectEnvironment, getEnvironment, getConfig, getConfigSummary,
    isProduction, isStaging, isDevelopment,
    overrideEnvironment, renderEnvironmentBanner
  };
})();
