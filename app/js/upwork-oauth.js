/**
 * CF-001: Upwork OAuth2 Integration
 * Handles OAuth2 flow with token storage (localStorage now, Firestore-ready interface).
 * @namespace window.CortexFreelancer.UpworkOAuth
 */
(function () {
  'use strict';

  /** @type {string} */
  const STORAGE_KEY = 'cortex_upwork_oauth';

  /** @type {string} */
  const AUTH_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';

  /** @type {string} */
  const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';

  /** @type {string} */
  const REDIRECT_URI = window.location.origin + '/auth/callback';

  /** @type {number} Token refresh buffer in ms (5 minutes before expiry) */
  const REFRESH_BUFFER_MS = 5 * 60 * 1000;

  /**
   * Storage interface — swap this object for Firestore adapter in production.
   * @type {{ get: function(): object|null, set: function(object): void, clear: function(): void }}
   */
  const storage = {
    get() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_e) {
        return null;
      }
    },
    set(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (_e) {
        console.error('[UpworkOAuth] Failed to persist token data');
      }
    },
    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_e) { /* noop */ }
    }
  };

  /**
   * Generate a cryptographically random state parameter for CSRF protection.
   * @returns {string}
   */
  function generateState() {
    var array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /**
   * Start the OAuth2 authorization flow.
   * Opens the Upwork authorization URL in the current window.
   *
   * @param {object} config
   * @param {string} config.clientId - Upwork API client ID
   * @param {string[]} [config.scopes] - Requested scopes (default: basic profile read)
   * @returns {{ authUrl: string, state: string }}
   */
  function startAuth(config) {
    var clientId = (config || {}).clientId;
    if (!clientId) {
      throw new Error('[UpworkOAuth] clientId is required');
    }

    var state = generateState();
    sessionStorage.setItem('upwork_oauth_state', state);

    var scopes = (config.scopes || ['read']).join(' ');
    var params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      state: state,
      scope: scopes
    });

    var authUrl = AUTH_URL + '?' + params.toString();

    return { authUrl: authUrl, state: state };
  }

  /**
   * Handle the OAuth2 callback after user authorization.
   * Extracts code and state from the URL, validates state, exchanges code for tokens.
   *
   * @param {object} config
   * @param {string} config.clientId - Upwork API client ID
   * @param {string} config.clientSecret - Upwork API client secret
   * @param {string} [config.callbackUrl] - Full callback URL (defaults to window.location.href)
   * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: number, scope: string }>}
   */
  async function handleCallback(config) {
    var url = new URL((config || {}).callbackUrl || window.location.href);
    var code = url.searchParams.get('code');
    var state = url.searchParams.get('state');
    var error = url.searchParams.get('error');

    if (error) {
      throw new Error('[UpworkOAuth] Authorization denied: ' + error);
    }

    if (!code) {
      throw new Error('[UpworkOAuth] No authorization code in callback URL');
    }

    // Validate state to prevent CSRF
    var savedState = sessionStorage.getItem('upwork_oauth_state');
    if (!state || state !== savedState) {
      throw new Error('[UpworkOAuth] State mismatch — possible CSRF attack');
    }
    sessionStorage.removeItem('upwork_oauth_state');

    // Exchange code for tokens
    var tokenData = await exchangeCodeForToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: code
    });

    return tokenData;
  }

  /**
   * Exchange an authorization code for access and refresh tokens.
   * In production, this should go through your backend to protect clientSecret.
   *
   * @param {object} params
   * @param {string} params.clientId
   * @param {string} params.clientSecret
   * @param {string} params.code
   * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: number, scope: string }>}
   */
  async function exchangeCodeForToken(params) {
    // --- MOCK IMPLEMENTATION ---
    // In production, POST to TOKEN_URL via your backend proxy.
    // The mock simulates a successful token exchange.
    if (typeof window.__UPWORK_OAUTH_MOCK__ !== 'undefined' || !params.clientSecret) {
      return mockTokenExchange(params.code);
    }

    var body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: REDIRECT_URI,
      client_id: params.clientId,
      client_secret: params.clientSecret
    });

    var res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      var errBody = await res.text();
      throw new Error('[UpworkOAuth] Token exchange failed: ' + res.status + ' ' + errBody);
    }

    var data = await res.json();
    var tokenData = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      scope: data.scope || ''
    };

    storage.set(tokenData);
    return tokenData;
  }

  /**
   * Mock token exchange for development/testing.
   * @param {string} code
   * @returns {{ accessToken: string, refreshToken: string, expiresAt: number, scope: string }}
   */
  function mockTokenExchange(code) {
    var tokenData = {
      accessToken: 'mock_access_' + code + '_' + Date.now(),
      refreshToken: 'mock_refresh_' + Date.now(),
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'read'
    };
    storage.set(tokenData);
    return tokenData;
  }

  /**
   * Get the current access token. Returns null if not authenticated or expired.
   * Automatically refreshes if within the refresh buffer window.
   *
   * @param {object} [config] - Required for auto-refresh: { clientId, clientSecret }
   * @returns {Promise<string|null>}
   */
  async function getAccessToken(config) {
    var data = storage.get();
    if (!data || !data.accessToken) {
      return null;
    }

    // Check expiration
    if (data.expiresAt && Date.now() >= data.expiresAt - REFRESH_BUFFER_MS) {
      if (data.refreshToken && config && config.clientId) {
        try {
          var refreshed = await refreshToken(config);
          return refreshed.accessToken;
        } catch (_e) {
          storage.clear();
          return null;
        }
      }
      storage.clear();
      return null;
    }

    return data.accessToken;
  }

  /**
   * Refresh the access token using the stored refresh token.
   *
   * @param {object} config
   * @param {string} config.clientId
   * @param {string} config.clientSecret
   * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: number, scope: string }>}
   */
  async function refreshToken(config) {
    var data = storage.get();
    if (!data || !data.refreshToken) {
      throw new Error('[UpworkOAuth] No refresh token available');
    }

    // --- MOCK IMPLEMENTATION ---
    if (typeof window.__UPWORK_OAUTH_MOCK__ !== 'undefined' || !config.clientSecret) {
      var refreshed = {
        accessToken: 'mock_refreshed_' + Date.now(),
        refreshToken: 'mock_refresh_' + Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
        scope: data.scope || 'read'
      };
      storage.set(refreshed);
      return refreshed;
    }

    var body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });

    var res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      storage.clear();
      throw new Error('[UpworkOAuth] Token refresh failed: ' + res.status);
    }

    var resData = await res.json();
    var tokenData = {
      accessToken: resData.access_token,
      refreshToken: resData.refresh_token || data.refreshToken,
      expiresAt: Date.now() + (resData.expires_in || 3600) * 1000,
      scope: resData.scope || data.scope || ''
    };

    storage.set(tokenData);
    return tokenData;
  }

  /**
   * Check if user is currently authenticated.
   * @returns {boolean}
   */
  function isAuthenticated() {
    var data = storage.get();
    return !!(data && data.accessToken && data.expiresAt > Date.now());
  }

  /**
   * Log out by clearing stored tokens.
   */
  function logout() {
    storage.clear();
    sessionStorage.removeItem('upwork_oauth_state');
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.UpworkOAuth = {
    startAuth: startAuth,
    handleCallback: handleCallback,
    getAccessToken: getAccessToken,
    refreshToken: refreshToken,
    isAuthenticated: isAuthenticated,
    logout: logout,
    /** Expose storage interface for Firestore adapter swap */
    _storage: storage
  };
})();
