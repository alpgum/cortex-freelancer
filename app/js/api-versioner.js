/**
 * CF-276 API Versioning Strategy
 * Version router, registry with migration helpers, deprecation warnings
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const VERSION_REGISTRY = {
    v1: { released: '2025-06-01', status: 'deprecated', sunset: '2026-06-01' },
    v2: { released: '2025-12-01', status: 'stable', sunset: null },
    v3: { released: '2026-03-01', status: 'beta', sunset: null }
  };

  const CURRENT_VERSION = 'v2';

  const MIGRATIONS = {
    'v1→v2': {
      description: 'Auth tokens moved from query params to Authorization header; response envelope changed',
      transformRequest(req) {
        const out = { ...req, headers: { ...req.headers } };
        if (req.params && req.params.token) {
          out.headers['Authorization'] = `Bearer ${req.params.token}`;
          delete out.params.token;
        }
        return out;
      },
      transformResponse(res) {
        if (res && res.result) return { data: res.result, meta: res.meta || {} };
        return res;
      }
    },
    'v2→v3': {
      description: 'Pagination uses cursor-based instead of offset; timestamps use ISO 8601',
      transformRequest(req) {
        const out = { ...req, params: { ...req.params } };
        if (out.params.page !== undefined) {
          out.params.cursor = btoa(String(out.params.page * (out.params.limit || 20)));
          delete out.params.page;
        }
        return out;
      },
      transformResponse(res) {
        return res;
      }
    }
  };

  function parseVersionFromPath(url) {
    const m = url.match(/\/api\/(v\d+)\//);
    return m ? m[1] : null;
  }

  function parseVersionFromHeader(headers) {
    if (!headers) return null;
    return headers['Accept-Version'] || headers['accept-version'] || null;
  }

  function resolveVersion(url, headers) {
    return parseVersionFromPath(url) || parseVersionFromHeader(headers) || CURRENT_VERSION;
  }

  function getVersionInfo(version) {
    return VERSION_REGISTRY[version] || null;
  }

  function isDeprecated(version) {
    const info = VERSION_REGISTRY[version];
    return info ? info.status === 'deprecated' : false;
  }

  function isSunset(version) {
    const info = VERSION_REGISTRY[version];
    if (!info || !info.sunset) return false;
    return new Date(info.sunset) <= new Date();
  }

  function getDeprecationWarning(version) {
    const info = VERSION_REGISTRY[version];
    if (!info) return `Unknown API version: ${version}`;
    if (info.status === 'deprecated') {
      return `API ${version} is deprecated` + (info.sunset ? `. Sunset date: ${info.sunset}` : '') + `. Please migrate to ${CURRENT_VERSION}.`;
    }
    return null;
  }

  function getMigrationPath(from, to) {
    const versions = Object.keys(VERSION_REGISTRY);
    const fromIdx = versions.indexOf(from);
    const toIdx = versions.indexOf(to);
    if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) return [];
    const path = [];
    for (let i = fromIdx; i < toIdx; i++) {
      const key = `${versions[i]}→${versions[i + 1]}`;
      if (MIGRATIONS[key]) path.push({ key, migration: MIGRATIONS[key] });
    }
    return path;
  }

  function migrateRequest(req, from, to) {
    const path = getMigrationPath(from, to);
    let current = { ...req };
    for (const step of path) {
      current = step.migration.transformRequest(current);
    }
    return current;
  }

  function migrateResponse(res, from, to) {
    const path = getMigrationPath(from, to);
    let current = res;
    for (const step of path) {
      current = step.migration.transformResponse(current);
    }
    return current;
  }

  function versionedFetch(url, options = {}) {
    const version = resolveVersion(url, options.headers);
    const warning = getDeprecationWarning(version);
    if (warning) console.warn('[API Versioner]', warning);
    if (isSunset(version)) {
      return Promise.reject(new Error(`API ${version} has been sunset and is no longer available.`));
    }
    return { version, warning, url, options };
  }

  function renderApiVersionDocs(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const versions = Object.entries(VERSION_REGISTRY);
    const statusColors = { stable: '#22c55e', beta: '#3b82f6', deprecated: '#ef4444' };

    el.innerHTML = `
      <div style="font-family:var(--font-main,system-ui);max-width:800px">
        <h2 style="margin:0 0 8px">API Version Registry</h2>
        <p style="color:#64748b;margin:0 0 24px;font-size:14px">Current version: <strong>${CURRENT_VERSION}</strong></p>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="text-align:left;border-bottom:2px solid #e2e8f0">
              <th style="padding:8px 12px">Version</th>
              <th style="padding:8px 12px">Status</th>
              <th style="padding:8px 12px">Released</th>
              <th style="padding:8px 12px">Sunset</th>
            </tr>
          </thead>
          <tbody>
            ${versions.map(([v, info]) => `
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:8px 12px;font-weight:600">${v}</td>
                <td style="padding:8px 12px">
                  <span style="background:${statusColors[info.status] || '#94a3b8'};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px">${info.status}</span>
                </td>
                <td style="padding:8px 12px">${info.released}</td>
                <td style="padding:8px 12px">${info.sunset || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3 style="margin:32px 0 12px">Migration Guides</h3>
        ${Object.entries(MIGRATIONS).map(([key, m]) => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px">
            <h4 style="margin:0 0 4px;font-size:15px">${key.replace('→', ' → ')}</h4>
            <p style="margin:0;color:#64748b;font-size:13px">${m.description}</p>
          </div>
        `).join('')}

        <h3 style="margin:32px 0 12px">Usage</h3>
        <div style="background:#1e293b;color:#e2e8f0;border-radius:8px;padding:16px;font-family:monospace;font-size:13px;white-space:pre;overflow-x:auto">
// Path-based versioning
fetch('/api/v2/users')

// Header-based versioning
fetch('/api/users', {
  headers: { 'Accept-Version': 'v2' }
})</div>
      </div>
    `;
  }

  ns.apiVersioner = {
    VERSION_REGISTRY, CURRENT_VERSION, MIGRATIONS,
    resolveVersion, getVersionInfo, isDeprecated, isSunset,
    getDeprecationWarning, getMigrationPath, migrateRequest,
    migrateResponse, versionedFetch, renderApiVersionDocs
  };
})();
