// Upwork OAuth 2.0 Client
// Docs: https://developers.upwork.com/

const crypto = require('crypto');

const UPWORK_AUTH_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const UPWORK_TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';
// NOTE: Upwork REST API base is /api (most resources live under /profiles, /auth, /hr, /gds, etc.)
const UPWORK_API_BASE = 'https://www.upwork.com/api';

class UpworkApiError extends Error {
  constructor(message, { status, body, headers, code } = {}) {
    super(message);
    this.name = 'UpworkApiError';
    this.status = status;
    this.body = body;
    this.headers = headers;
    this.code = code;
  }
}

function getConfig() {
  const clientId = process.env.UPWORK_CLIENT_ID;
  const clientSecret = process.env.UPWORK_CLIENT_SECRET;
  const defaultBase = process.env.DOMAIN
    ? `https://${process.env.DOMAIN}`
    : `http://localhost:${process.env.PORT || 3847}`;

  const redirectUri = process.env.UPWORK_REDIRECT_URI || `${defaultBase}/api/upwork-callback`;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

function safeHeadersObject(headers) {
  try {
    const obj = {};
    for (const [k, v] of headers.entries()) obj[k.toLowerCase()] = v;
    return obj;
  } catch {
    return {};
  }
}

async function readBody(res) {
  const text = await res.text().catch(() => '');
  if (!text) return { text: '' };
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text };
  }
}

function extractOAuthError(body) {
  const json = body?.json;
  const code = json?.error || json?.error_code || json?.code || null;
  const desc = json?.error_description || json?.message || body?.text || null;
  return { code, desc };
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
  if (!config) throw new UpworkApiError('Upwork OAuth not configured', { code: 'UPWORK_NOT_CONFIGURED' });

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
    const body = await readBody(res);
    const hdrs = safeHeadersObject(res.headers);
    const { code: oauthCode, desc } = extractOAuthError(body);
    throw new UpworkApiError(`Upwork token exchange failed (${res.status})`, {
      status: res.status,
      body: body.json || body.text,
      headers: hdrs,
      code: oauthCode || 'TOKEN_EXCHANGE_FAILED',
    });
  }

  return res.json();
}

/**
 * Refresh expired access token
 */
async function refreshToken(refresh_token) {
  const config = getConfig();
  if (!config) throw new UpworkApiError('Upwork OAuth not configured', { code: 'UPWORK_NOT_CONFIGURED' });

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
    const body = await readBody(res);
    const hdrs = safeHeadersObject(res.headers);
    const { code: oauthCode, desc } = extractOAuthError(body);

    // invalid_grant typically indicates revoked/expired refresh token
    const derived = oauthCode === 'invalid_grant' ? 'REFRESH_REVOKED' : 'TOKEN_REFRESH_FAILED';

    throw new UpworkApiError(`Upwork token refresh failed (${res.status})${desc ? `: ${desc}` : ''}`, {
      status: res.status,
      body: body.json || body.text,
      headers: hdrs,
      code: derived,
    });
  }

  return res.json();
}

/**
 * Get a valid access token, refreshing if needed
 */
async function getValidToken(tokens) {
  if (!tokens || !tokens.refresh_token) {
    throw new UpworkApiError('No Upwork refresh token available', { code: 'NO_REFRESH_TOKEN' });
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

function normalizeEndpoint(endpoint) {
  if (endpoint.startsWith('http')) return endpoint;
  // Accept both '/path' and 'path'
  const p = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${UPWORK_API_BASE}${p}`;
}

async function apiRequest(accessToken, endpoint, options = {}) {
  const url = normalizeEndpoint(endpoint);

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await readBody(res);
    const hdrs = safeHeadersObject(res.headers);

    const retryAfter = hdrs['retry-after'] ? parseInt(hdrs['retry-after'], 10) : null;
    const code = res.status === 429 ? 'RATE_LIMIT' : 'UPWORK_HTTP_ERROR';

    throw new UpworkApiError(`Upwork API ${res.status} (${url})`, {
      status: res.status,
      body: body.json || body.text,
      headers: { ...hdrs, retryAfter },
      code,
    });
  }

  // Upwork responses are JSON for REST APIs
  return res.json();
}

// Some endpoints in Upwork REST accept both ".json" suffix and no suffix.
// Try with suffix first (more common), then fall back.
async function apiGetJson(accessToken, path, params) {
  const hasQuery = params && Object.keys(params).length > 0;
  const qs = hasQuery ? `?${new URLSearchParams(params).toString()}` : '';

  const base = path.startsWith('/') ? path : `/${path}`;
  const withJson = base.endsWith('.json') ? base : `${base}.json`;

  try {
    return await apiRequest(accessToken, `${withJson}${qs}`);
  } catch (err) {
    // 404 with .json but works without .json on some tenants
    if (err instanceof UpworkApiError && err.status === 404 && !base.endsWith('.json')) {
      return apiRequest(accessToken, `${base}${qs}`);
    }
    throw err;
  }
}

async function getUserInfo(accessToken) {
  return apiGetJson(accessToken, '/auth/v1/info');
}

function normalizeProviderProfile(resp) {
  const p = resp?.profile || resp?.provider || resp?.freelancer || resp || {};

  const name = p.name || [p.first_name || p.firstName, p.last_name || p.lastName].filter(Boolean).join(' ') || null;
  const title = p.title || p.professionalHeadline || p.tagline || p.profile_title || null;

  const rateRaw = p.rate?.amount ?? p.hourlyRate ?? p.hourly_rate ?? p.rate ?? null;
  const hourlyRate = typeof rateRaw === 'number' ? rateRaw : (rateRaw && Number(String(rateRaw).replace(/[^0-9.]/g, '')));

  const skills =
    Array.isArray(p.skills)
      ? p.skills
        .map(s => typeof s === 'string' ? s : (s.name || s.skl_name || s.skill || s.skl_name_raw || null))
        .filter(Boolean)
      : typeof p.skills === 'string'
        ? p.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

  const profileUrl = p.profile_url || p.profileUrl || p.dev_profile_url || null;

  return {
    name,
    title,
    hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
    skills,
    profileUrl,
    raw: resp,
  };
}

async function getProviderProfileBrief(accessToken, profileKey) {
  // Use brief endpoint when available
  try {
    return await apiGetJson(accessToken, `/profiles/v1/providers/${profileKey}/brief`);
  } catch {
    return apiGetJson(accessToken, `/profiles/v1/providers/${profileKey}`);
  }
}

/**
 * Get authenticated user's Upwork profile (normalized)
 */
async function getMyProfile(accessToken) {
  const info = await getUserInfo(accessToken);

  const profileKey =
    info?.auth_user?.profile_key ||
    info?.auth_user?.profileKey ||
    info?.info?.profile_key ||
    info?.info?.profileKey ||
    info?.profile_key ||
    info?.profileKey ||
    null;

  if (!profileKey) {
    // Fallback: return user info only
    return { profileKey: null, info, profile: normalizeProviderProfile(info) };
  }

  const providerProfile = await getProviderProfileBrief(accessToken, profileKey);
  return {
    profileKey,
    info,
    profile: normalizeProviderProfile(providerProfile),
  };
}

/**
 * Search jobs via Upwork API (authenticated)
 */
async function searchJobs(accessToken, { query, skills, sort = 'recency', page = 0, paging = 10 }) {
  const params = {
    q: query || undefined,
    skills: skills ? (Array.isArray(skills) ? skills.join(';') : skills) : undefined,
    sort,
    paging: `${page};${paging}`,
  };

  // Remove undefined keys
  Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);

  return apiGetJson(accessToken, '/profiles/v2/search/jobs', params);
}

/**
 * Get job details
 */
async function getJobDetails(accessToken, jobKey) {
  return apiGetJson(accessToken, `/profiles/v1/jobs/${jobKey}`);
}

/**
 * Get freelancer's active contracts
 */
async function getContracts(accessToken) {
  // Not always available for every app; keep for future use.
  return apiGetJson(accessToken, '/contracts/v3/contracts');
}

/**
 * Get freelancer's earnings summary
 */
async function getEarnings(accessToken) {
  // Not always available for every app; keep for future use.
  return apiGetJson(accessToken, '/gds/finreports/v1/contractor/earnings');
}

module.exports = {
  UpworkApiError,
  getConfig,
  buildAuthUrl,
  exchangeCode,
  refreshToken,
  getValidToken,
  apiRequest,
  apiGetJson,
  getUserInfo,
  getMyProfile,
  searchJobs,
  getJobDetails,
  getContracts,
  getEarnings,
};
