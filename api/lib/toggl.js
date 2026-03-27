/**
 * Toggl Track API client (v9)
 * Auth: TOGGL_API_TOKEN (API token) via Basic auth: <token>:api_token
 *
 * Notes:
 * - If no token is configured, functions fall back to a small in-memory mock store.
 * - This keeps local dev + tests green and provides a usable demo mode.
 */

'use strict';

const API_BASE = 'https://api.track.toggl.com/api/v9';
const DEFAULT_TIMEOUT_MS = 20000;

function getApiToken() {
  return process.env.TOGGL_API_TOKEN || null;
}

function isMockMode() {
  // Explicit mock flag OR missing token
  const mockFlag = (process.env.MOCK_EXTERNAL_APIS || '').toLowerCase();
  return !getApiToken() || ['true', '1', 'yes', 'on'].includes(mockFlag);
}

function basicAuthHeader(token) {
  const t = token || '';
  return 'Basic ' + Buffer.from(`${t}:api_token`).toString('base64');
}

function toISO(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function startOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// ── Mock store (in-memory) ─────────────────────────────────────────────

const mockStore = {
  workspaceId: 123456,
  user: { id: 111, fullname: 'Demo User', email: 'demo@example.com' },
  projects: [
    { id: 9001, name: 'Client A — Website', active: true, color: '#ff8844' },
    { id: 9002, name: 'Client B — Retainer', active: true, color: '#00ff88' },
    { id: 9003, name: 'Internal — Admin', active: true, color: '#6699ff' },
  ],
  timeEntries: [],
};

function mockEnsureSeed() {
  // Seed a single entry for today if empty so UI has something to show
  if (mockStore.timeEntries.length > 0) return;
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  mockStore.timeEntries.push({
    id: 70001,
    workspace_id: mockStore.workspaceId,
    project_id: 9001,
    description: 'Demo: Kickoff + planning',
    start: start.toISOString(),
    duration: 45 * 60,
    billable: true,
    tags: ['demo'],
    at: new Date().toISOString(),
    created_with: 'cortex-freelancer-mock',
  });
}

function mockListTimeEntries(startISO, endISO) {
  mockEnsureSeed();
  const start = new Date(startISO);
  const end = new Date(endISO);
  return mockStore.timeEntries
    .filter(e => {
      const s = new Date(e.start);
      return s >= start && s <= end;
    })
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}

function mockCreateTimeEntry(payload) {
  const entry = {
    id: 70000 + mockStore.timeEntries.length + 1,
    workspace_id: payload.workspace_id || mockStore.workspaceId,
    project_id: payload.project_id ?? null,
    description: payload.description || 'Untitled',
    start: payload.start || new Date().toISOString(),
    duration: payload.duration || 0,
    billable: !!payload.billable,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    at: new Date().toISOString(),
    created_with: payload.created_with || 'cortex-freelancer-mock',
  };
  mockStore.timeEntries.push(entry);
  return entry;
}

// ── Low-level request helper ───────────────────────────────────────────

async function togglRequest(path, { method = 'GET', token, query, body, timeoutMs } = {}) {
  const apiToken = token || getApiToken();
  if (!apiToken) {
    const err = new Error('TOGGL_API_TOKEN not configured');
    err.code = 'NO_API_TOKEN';
    err.status = 400;
    throw err;
  }

  const url = new URL(`${API_BASE}${path}`);
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuthHeader(apiToken),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Toggl API error (${res.status}): ${text.slice(0, 300)}`);
      err.status = res.status;
      err.body = text;
      throw err;
    }

    // Some endpoints return empty body
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      return text;
    }

    return res.json();
  } finally {
    clearTimeout(t);
  }
}

// ── High-level API ─────────────────────────────────────────────────────

async function getMe() {
  if (isMockMode()) {
    return {
      ...mockStore.user,
      default_workspace_id: mockStore.workspaceId,
      workspaces: [{ id: mockStore.workspaceId, name: 'Demo Workspace' }],
    };
  }
  return togglRequest('/me');
}

async function getWorkspaceId(preferredWorkspaceId) {
  if (preferredWorkspaceId) return Number(preferredWorkspaceId);
  const me = await getMe();
  return me.default_workspace_id || me.workspaces?.[0]?.id || null;
}

async function getProjects(workspaceId) {
  if (isMockMode()) {
    return mockStore.projects;
  }
  const wid = await getWorkspaceId(workspaceId);
  return togglRequest(`/workspaces/${wid}/projects`);
}

async function getTimeEntries({ start, end } = {}) {
  const startISO = toISO(start) || startOfDayISO();
  const endISO = toISO(end) || endOfDayISO();

  if (isMockMode()) {
    return mockListTimeEntries(startISO, endISO);
  }

  // Toggl expects RFC3339
  return togglRequest('/me/time_entries', {
    query: {
      start_date: startISO,
      end_date: endISO,
    },
  });
}

async function createTimeEntry({ workspaceId, description, projectId, start, durationSeconds, billable, tags } = {}) {
  const wid = workspaceId ? Number(workspaceId) : await getWorkspaceId();
  const payload = {
    workspace_id: wid,
    description: description || 'Untitled',
    project_id: projectId ? Number(projectId) : undefined,
    start: toISO(start) || new Date().toISOString(),
    duration: Number(durationSeconds || 0),
    billable: !!billable,
    tags: Array.isArray(tags) ? tags : undefined,
    created_with: 'cortex-freelancer',
  };

  if (isMockMode()) {
    return mockCreateTimeEntry(payload);
  }

  // v9 create endpoint
  return togglRequest(`/workspaces/${wid}/time_entries`, {
    method: 'POST',
    body: payload,
  });
}

async function logTime({ workspaceId, description, projectId, minutes, billable, start, tags } = {}) {
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= 0) {
    const err = new Error('minutes must be a positive number');
    err.code = 'INVALID_MINUTES';
    err.status = 400;
    throw err;
  }

  return createTimeEntry({
    workspaceId,
    description,
    projectId,
    start: start || new Date(),
    durationSeconds: Math.round(mins * 60),
    billable,
    tags,
  });
}

async function getStatus() {
  // Always safe: in mock mode we return demo status without network calls
  if (isMockMode()) {
    const me = await getMe();
    return {
      connected: false,
      mock: true,
      message: 'TOGGL_API_TOKEN not configured — using mock mode',
      workspaceId: me.default_workspace_id || null,
      user: { fullname: me.fullname || null, email: me.email || null },
    };
  }

  try {
    const me = await getMe();
    return {
      connected: true,
      mock: false,
      message: 'Connected',
      workspaceId: me.default_workspace_id || null,
      user: { fullname: me.fullname || null, email: me.email || null },
    };
  } catch (err) {
    return {
      connected: false,
      mock: false,
      message: err.message,
      workspaceId: null,
      user: null,
      error: { status: err.status || null, code: err.code || null },
    };
  }
}

module.exports = {
  API_BASE,
  getApiToken,
  isMockMode,
  getMe,
  getWorkspaceId,
  getProjects,
  getTimeEntries,
  createTimeEntry,
  logTime,
  getStatus,
  // date helpers (used by API routes / UI tests)
  startOfDayISO,
  endOfDayISO,
};
