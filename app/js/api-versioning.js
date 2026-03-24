/**
 * CF-276: API Versioning Strategy
 * Manages API version prefixes, deprecation warnings, and version negotiation.
 */
(function () {
  'use strict';

  var CURRENT_VERSION = 'v1';
  var SUPPORTED_VERSIONS = ['v1'];
  var DEPRECATED_VERSIONS = [];
  var VERSION_HEADER = 'X-API-Version';
  var DEPRECATION_HEADER = 'X-API-Deprecated';

  /**
   * Build a versioned API URL.
   * @param {string} path — e.g., '/chat', '/checkout'
   * @param {string} [version]
   * @returns {string}
   */
  function buildUrl(path, version) {
    version = version || CURRENT_VERSION;
    path = path.startsWith('/') ? path : '/' + path;
    return '/api/' + version + path;
  }

  /**
   * Parse version from a URL.
   * @param {string} url
   * @returns {{ version: string|null, path: string }}
   */
  function parseUrl(url) {
    var match = url.match(/\/api\/(v\d+)(\/.*)/);
    if (match) {
      return { version: match[1], path: match[2] };
    }
    // Unversioned URL
    var apiMatch = url.match(/\/api(\/.*)/);
    return { version: null, path: apiMatch ? apiMatch[1] : url };
  }

  /**
   * Check if a version is supported.
   * @param {string} version
   * @returns {boolean}
   */
  function isSupported(version) {
    return SUPPORTED_VERSIONS.indexOf(version) >= 0;
  }

  /**
   * Check if a version is deprecated.
   * @param {string} version
   * @returns {boolean}
   */
  function isDeprecated(version) {
    return DEPRECATED_VERSIONS.indexOf(version) >= 0;
  }

  /**
   * Get migration guide from one version to another.
   * @param {string} fromVersion
   * @param {string} toVersion
   * @returns {{ changes: Array<{ endpoint: string, change: string }>, breakingChanges: boolean }}
   */
  function getMigrationGuide(fromVersion, toVersion) {
    // For now v1 is the only version — placeholder for future
    if (fromVersion === toVersion) {
      return { changes: [], breakingChanges: false };
    }
    return {
      changes: [
        { endpoint: '/api/*', change: 'Add version prefix /api/' + toVersion + '/*' }
      ],
      breakingChanges: false
    };
  }

  /**
   * Create a versioned fetch wrapper.
   * @param {string} [version]
   * @returns {function(string, Object): Promise<Response>}
   */
  function createClient(version) {
    version = version || CURRENT_VERSION;

    return function versionedFetch(path, options) {
      var url = buildUrl(path, version);
      options = options || {};
      options.headers = options.headers || {};
      options.headers[VERSION_HEADER] = version;

      return fetch(url, options).then(function (res) {
        // Check for deprecation warnings
        var deprecated = res.headers.get(DEPRECATION_HEADER);
        if (deprecated) {
          console.warn('[API] Version ' + version + ' is deprecated: ' + deprecated);
        }
        return res;
      });
    };
  }

  /**
   * Generate version documentation.
   * @returns {Object}
   */
  function getVersionInfo() {
    return {
      current: CURRENT_VERSION,
      supported: SUPPORTED_VERSIONS.slice(),
      deprecated: DEPRECATED_VERSIONS.slice(),
      policy: {
        deprecationNotice: '3 months before removal',
        sunsetPeriod: '6 months after deprecation',
        versioningScheme: 'URL path prefix (/api/v1/...)',
        headerSupport: VERSION_HEADER
      }
    };
  }

  /**
   * Render version info.
   * @param {HTMLElement} container
   */
  function render(container) {
    if (!container) return;

    var info = getVersionInfo();
    var html = '<div style="margin-bottom:16px">' +
      '<div style="font-weight:600;margin-bottom:8px">API Version: ' + info.current + '</div>' +
      '<div style="font-size:13px;color:#6b7280">' +
      'Supported: ' + info.supported.join(', ') +
      (info.deprecated.length ? ' | Deprecated: ' + info.deprecated.join(', ') : '') +
      '</div></div>';

    html += '<h4 style="font-size:14px;margin:0 0 8px">Versioning Policy</h4>';
    Object.keys(info.policy).forEach(function (key) {
      html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px">' +
        '<span style="color:#6b7280">' + key.replace(/([A-Z])/g, ' $1').trim() + '</span>' +
        '<span>' + info.policy[key] + '</span></div>';
    });

    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ApiVersioning = {
    CURRENT_VERSION: CURRENT_VERSION,
    SUPPORTED_VERSIONS: SUPPORTED_VERSIONS,
    buildUrl: buildUrl,
    parseUrl: parseUrl,
    isSupported: isSupported,
    isDeprecated: isDeprecated,
    getMigrationGuide: getMigrationGuide,
    createClient: createClient,
    getVersionInfo: getVersionInfo,
    render: render
  };
})();
