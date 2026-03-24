/**
 * CF-275 — CORS Configuration Manager
 * Define allowed origins, methods, headers per endpoint.
 * Includes generateCorsHeaders() and renderCorsPolicy().
 */
(function() {
  'use strict';
  var NS = (window.CortexFreelancer = window.CortexFreelancer || {});

  // ── CORS policy definitions ──
  var CORS_POLICIES = {
    default: {
      allowedOrigins: [
        'https://cortex-freelancer.vercel.app',
        'https://cortexfreelancer.com',
        'https://www.cortexfreelancer.com'
      ],
      allowedMethods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposeHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
      maxAge: 86400,
      credentials: true
    },

    public: {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      exposeHeaders: [],
      maxAge: 3600,
      credentials: false
    },

    webhook: {
      allowedOrigins: ['https://api.stripe.com'],
      allowedMethods: ['POST'],
      allowedHeaders: ['Content-Type', 'Stripe-Signature'],
      exposeHeaders: [],
      maxAge: 0,
      credentials: false
    },

    staging: {
      allowedOrigins: [
        'https://cortex-freelancer-staging.vercel.app',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5500'
      ],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Debug'],
      exposeHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-Debug-Info'],
      maxAge: 0,
      credentials: true
    }
  };

  // ── Endpoint → policy mapping ──
  var ENDPOINT_POLICIES = {
    '/api/health': 'public',
    '/api/stats': 'public',
    '/api/contact': 'public',
    '/api/waitlist': 'public',
    '/api/stripe-webhook': 'webhook',
    '/api/webhook': 'webhook',
    '/api/chat': 'default',
    '/api/checkout': 'default',
    '/api/subscription': 'default',
    '/api/customer': 'default',
    '/api/feedback': 'default',
    '/api/track': 'default',
    '/api/export-data': 'default',
    '/api/download': 'default',
    '/api/billing-portal': 'default',
    '/api/customer-portal': 'default'
  };

  // ── Check if origin matches a policy (supports Vercel preview URLs) ──
  function isOriginAllowed(origin, policyName) {
    var policy = CORS_POLICIES[policyName || 'default'];
    if (!policy) return false;
    if (policy.allowedOrigins.indexOf('*') >= 0) return true;
    if (policy.allowedOrigins.indexOf(origin) >= 0) return true;
    // Allow Vercel preview deployments for non-webhook policies
    if (policyName !== 'webhook' && /^https:\/\/cortex-freelancer[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
    return false;
  }

  // ── Generate CORS headers for a request ──
  function generateCorsHeaders(endpoint, requestOrigin, policyOverride) {
    var policyName = policyOverride || ENDPOINT_POLICIES[endpoint] || 'default';
    var policy = CORS_POLICIES[policyName];
    if (!policy) return {};

    var headers = {};

    // Origin check
    if (policy.allowedOrigins.indexOf('*') >= 0) {
      headers['Access-Control-Allow-Origin'] = '*';
    } else if (requestOrigin && isOriginAllowed(requestOrigin, policyName)) {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
      headers['Vary'] = 'Origin';
    } else {
      // Origin not allowed — return empty (browser will block)
      return {};
    }

    headers['Access-Control-Allow-Methods'] = policy.allowedMethods.join(', ');
    headers['Access-Control-Allow-Headers'] = policy.allowedHeaders.join(', ');

    if (policy.exposeHeaders.length) {
      headers['Access-Control-Expose-Headers'] = policy.exposeHeaders.join(', ');
    }
    if (policy.maxAge > 0) {
      headers['Access-Control-Max-Age'] = String(policy.maxAge);
    }
    if (policy.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
  }

  // ── Middleware-style handler (for Vercel serverless) ──
  function corsMiddleware(policyName) {
    return function(req, res, next) {
      var origin = req.headers.origin || '';
      var headers = generateCorsHeaders(req.url, origin, policyName);
      Object.keys(headers).forEach(function(k) { res.setHeader(k, headers[k]); });

      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      if (next) next();
    };
  }

  // ── Generate vercel.json headers config ──
  function generateVercelConfig() {
    var defaultPolicy = CORS_POLICIES['default'];
    return {
      headers: [
        {
          source: '/api/(.*)',
          headers: [
            { key: 'Access-Control-Allow-Origin', value: defaultPolicy.allowedOrigins[0] },
            { key: 'Access-Control-Allow-Methods', value: defaultPolicy.allowedMethods.join(', ') },
            { key: 'Access-Control-Allow-Headers', value: defaultPolicy.allowedHeaders.join(', ') },
            { key: 'Access-Control-Max-Age', value: String(defaultPolicy.maxAge) }
          ]
        }
      ]
    };
  }

  // ── Test origins against policies ──
  function testOrigins(origins) {
    return (origins || []).map(function(o) {
      return { origin: o, allowed: isOriginAllowed(o, 'default'), allowedStaging: isOriginAllowed(o, 'staging') };
    });
  }

  // ── Render CORS policy documentation ──
  function renderCorsPolicy(container) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    var methodColor = function(m) {
      return { GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', DELETE: '#ef4444', PATCH: '#a855f7', OPTIONS: '#64748b' }[m] || '#888';
    };

    var policiesHtml = Object.keys(CORS_POLICIES).map(function(name) {
      var policy = CORS_POLICIES[name];
      return '<div style="margin-bottom:20px;border:1px solid #334155;border-radius:8px;overflow:hidden">' +
        '<div style="padding:12px 16px;background:#1e293b;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center">' +
          '<span>' + name + '</span>' +
          '<span style="font-size:11px;color:#94a3b8">' + (policy.credentials ? '🔒 Credentials' : '🌐 No credentials') + '</span>' +
        '</div>' +
        '<div style="padding:12px 16px;font-size:13px">' +
          '<div style="margin-bottom:8px">' +
            '<strong style="color:#94a3b8;font-size:11px;text-transform:uppercase">Origins</strong>' +
            '<div style="margin-top:4px">' + policy.allowedOrigins.map(function(o) {
              return '<code style="background:#1e293b;padding:2px 6px;border-radius:3px;margin-right:4px;font-size:12px">' + o + '</code>';
            }).join('') + '</div>' +
          '</div>' +
          '<div style="margin-bottom:8px">' +
            '<strong style="color:#94a3b8;font-size:11px;text-transform:uppercase">Methods</strong>' +
            '<div style="margin-top:4px">' + policy.allowedMethods.map(function(m) {
              return '<span style="display:inline-block;background:' + methodColor(m) + '22;color:' + methodColor(m) + ';padding:2px 8px;border-radius:3px;margin-right:4px;font-size:11px;font-weight:600">' + m + '</span>';
            }).join('') + '</div>' +
          '</div>' +
          '<div style="margin-bottom:8px">' +
            '<strong style="color:#94a3b8;font-size:11px;text-transform:uppercase">Headers</strong>' +
            '<div style="margin-top:4px;font-size:12px;color:#cbd5e1">' + policy.allowedHeaders.join(', ') + '</div>' +
          '</div>' +
          '<div style="font-size:11px;color:#64748b">Max-Age: ' + policy.maxAge + 's</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var endpointsHtml = Object.keys(ENDPOINT_POLICIES).map(function(ep) {
      var pol = ENDPOINT_POLICIES[ep];
      var p = CORS_POLICIES[pol];
      return '<tr style="border-bottom:1px solid #1e293b">' +
        '<td style="padding:8px;font-family:monospace;font-size:12px">' + ep + '</td>' +
        '<td style="padding:8px"><span style="background:#1e293b;padding:2px 8px;border-radius:3px;font-size:11px">' + pol + '</span></td>' +
        '<td style="padding:8px">' + p.allowedMethods.map(function(m) {
          return '<span style="color:' + methodColor(m) + ';font-size:11px;margin-right:4px">' + m + '</span>';
        }).join('') + '</td>' +
      '</tr>';
    }).join('');

    el.innerHTML =
      '<div style="font-family:var(--font-sans,system-ui);max-width:900px;margin:0 auto">' +
        '<h2 style="margin:0 0 20px;font-size:20px">CORS Policy Configuration</h2>' +
        policiesHtml +
        '<h3 style="margin:24px 0 12px;font-size:16px">Endpoint → Policy Mapping</h3>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr style="border-bottom:2px solid #334155;text-align:left">' +
            '<th style="padding:8px">Endpoint</th><th style="padding:8px">Policy</th><th style="padding:8px">Methods</th>' +
          '</tr></thead>' +
          '<tbody>' + endpointsHtml + '</tbody>' +
        '</table>' +
      '</div>';
  }

  NS.CorsConfig = {
    CORS_POLICIES: CORS_POLICIES,
    ENDPOINT_POLICIES: ENDPOINT_POLICIES,
    isOriginAllowed: isOriginAllowed,
    generateCorsHeaders: generateCorsHeaders,
    corsMiddleware: corsMiddleware,
    generateVercelConfig: generateVercelConfig,
    testOrigins: testOrigins,
    renderCorsPolicy: renderCorsPolicy
  };
})();
