// Upwork OAuth 2.0 Client
// Docs: https://developers.upwork.com/

const crypto = require('crypto');

const UPWORK_AUTH_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const UPWORK_TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';
const UPWORK_API_BASE = 'https://www.upwork.com/api/v3';

function getConfig() {
  const clientId = process.env.UPWORK_CLIENT_ID;
  const clientSecret = process.env.UPWORK_CLIENT_SECRET;
  const redirectUri = process.env.UPWORK_REDIRECT_URI || `${process.env.DOMAIN ? 'https://' + process.env.DOMAIN : 'http://localhost:3847'}/api/upwork-callback`;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

/**
 * Build Upwork OAuth2 authorization URL
 */
function buildAuthUrl(state) {
  const config = getConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state: state || crypto.randomBytes(16).toString('hex'),
  });

  return `${UPWORK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(code) {
  const config = getConfig();
  if (!config) throw new Error('Upwork OAuth not configured');

  const res = await fetch(UPWORK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upwork token exchange failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Refresh expired access token
 */
async function refreshToken(refresh_token) {
  const config = getConfig();
  if (!config) throw new Error('Upwork OAuth not configured');

  const res = await fetch(UPWORK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upwork token refresh failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Get a valid access token, refreshing if needed
 */
async function getValidToken(tokens) {
  if (!tokens || !tokens.refresh_token) {
    throw new Error('No Upwork refresh token available');
  }

  const now = Date.now();
  if (tokens.expires_at && now < tokens.expires_at - 300000) {
    return tokens;
  }

  const fresh = await refreshToken(tokens.refresh_token);
  return {
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + (fresh.expires_in || 3600) * 1000,
    token_type: fresh.token_type,
  };
}

/**
 * Make authenticated Upwork API request
 */
async function apiRequest(accessToken, endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${UPWORK_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upwork API ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Get authenticated user's profile
 */
async function getMyProfile(accessToken) {
  return apiRequest(accessToken, '/contractors/v3/profile.json');
}

/**
 * Search jobs via Upwork API (authenticated)
 */
async function searchJobs(accessToken, { query, skills, budget_min, budget_max, sort = 'recency', page = 0, paging = 10 }) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (skills) params.set('skills', Array.isArray(skills) ? skills.join(';') : skills);
  if (budget_min) params.set('budget', `[${budget_min}-${budget_max || ''}]`);
  params.set('sort', sort);
  params.set('paging', `${page};${paging}`);

  return apiRequest(accessToken, `/jobs/v3/search.json?${params.toString()}`);
}

/**
 * Get job details
 */
async function getJobDetails(accessToken, jobKey) {
  return apiRequest(accessToken, `/jobs/v3/${jobKey}.json`);
}

/**
 * Get freelancer's active contracts
 */
async function getContracts(accessToken) {
  return apiRequest(accessToken, '/contracts/v3/contracts.json');
}

/**
 * Get freelancer's earnings summary
 */
async function getEarnings(accessToken) {
  return apiRequest(accessToken, '/finreports/v3/providers/billings.json');
}

module.exports = {
  getConfig,
  buildAuthUrl,
  exchangeCode,
  refreshToken,
  getValidToken,
  apiRequest,
  getMyProfile,
  searchJobs,
  getJobDetails,
  getContracts,
  getEarnings,
};
