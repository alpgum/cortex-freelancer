// Gmail API client — OAuth2 + email operations
// Uses Google APIs directly (no googleapis SDK needed — keeps bundle small)

const crypto = require('crypto');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
].join(' ');

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.DOMAIN ? 'https://' + process.env.DOMAIN : 'http://localhost:3847'}/api/gmail-callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Build Google OAuth2 authorization URL
 */
function buildAuthUrl(state) {
  const config = getConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: state || crypto.randomBytes(16).toString('hex'),
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(code) {
  const config = getConfig();
  if (!config) throw new Error('Gmail OAuth not configured');

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Refresh an expired access token
 */
async function refreshToken(refreshToken) {
  const config = getConfig();
  if (!config) throw new Error('Gmail OAuth not configured');

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Get a valid access token — refreshes if needed
 * @param {object} tokens - { access_token, refresh_token, expires_at }
 * @returns {object} - Updated tokens with valid access_token
 */
async function getValidToken(tokens) {
  if (!tokens || !tokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  // Check if token is expired (with 5-min buffer)
  const now = Date.now();
  if (tokens.expires_at && now < tokens.expires_at - 300000) {
    return tokens; // Still valid
  }

  // Refresh
  const fresh = await refreshToken(tokens.refresh_token);
  return {
    access_token: fresh.access_token,
    refresh_token: tokens.refresh_token, // Google doesn't always return new refresh_token
    expires_at: Date.now() + (fresh.expires_in || 3600) * 1000,
  };
}

/**
 * Build a MIME message for Gmail API
 */
function buildMimeMessage({ to, subject, body, cc, bcc, replyTo, isHtml = true }) {
  const boundary = `----=_Part_${crypto.randomBytes(8).toString('hex')}`;
  const contentType = isHtml ? 'text/html' : 'text/plain';

  let headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}; charset=UTF-8`,
  ];

  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (replyTo) headers.push(`In-Reply-To: ${replyTo}`, `References: ${replyTo}`);

  const raw = headers.join('\r\n') + '\r\n\r\n' + body;

  // Base64url encode for Gmail API
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send an email via Gmail API
 */
async function sendEmail(accessToken, { to, subject, body, cc, bcc, replyTo, threadId, isHtml = true }) {
  const raw = buildMimeMessage({ to, subject, body, cc, bcc, replyTo, isHtml });

  const payload = { raw };
  if (threadId) payload.threadId = threadId;

  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * List messages (inbox, sent, etc.)
 */
async function listMessages(accessToken, { query, maxResults = 10, labelIds, pageToken } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (maxResults) params.set('maxResults', String(maxResults));
  if (labelIds) params.set('labelIds', Array.isArray(labelIds) ? labelIds.join(',') : labelIds);
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${GMAIL_API}/users/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail list failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Get a single message with full content
 */
async function getMessage(accessToken, messageId, format = 'full') {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}?format=${format}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail get message failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Parse Gmail message into readable format
 */
function parseMessage(msg) {
  const headers = msg.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  let bodyText = '';
  let bodyHtml = '';

  function extractParts(payload) {
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
      if (payload.mimeType === 'text/plain') bodyText = decoded;
      if (payload.mimeType === 'text/html') bodyHtml = decoded;
    }
    if (payload.parts) {
      payload.parts.forEach(extractParts);
    }
  }

  extractParts(msg.payload || {});

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    snippet: msg.snippet,
    bodyText,
    bodyHtml,
    labels: msg.labelIds || [],
  };
}

/**
 * Get user's Gmail profile
 */
async function getProfile(accessToken) {
  const res = await fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail profile failed (${res.status}): ${body}`);
  }

  return res.json();
}

module.exports = {
  getConfig,
  buildAuthUrl,
  exchangeCode,
  refreshToken,
  getValidToken,
  sendEmail,
  listMessages,
  getMessage,
  parseMessage,
  getProfile,
};
