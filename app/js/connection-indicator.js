/**
 * CFX-035: Connection Status Indicator (transport + health)
 *
 * Small always-visible indicator + details panel.
 *
 * Integrations (best-effort):
 * - CortexChatDispatcher (getConnectionMode / getConnectionStats / reconnect / enableWebRTC)
 * - CortexTransport (getStatus / connect / disconnect)
 * - CortexWsReconnect (on stateChange/message/failed)
 * - CortexFreelancer.ChatErrorHandler (wrap handleError to capture last error code)
 */
(function () {
  'use strict';

  var ID_WRAP = 'cfx035-conn';
  var ID_BTN = 'cfx035-conn-btn';
  var ID_DOT = 'cfx035-conn-dot';
  var ID_LABEL = 'cfx035-conn-label';
  var ID_SUB = 'cfx035-conn-sub';
  var ID_PANEL = 'cfx035-conn-panel';
  var ID_HISTORY = 'cfx035-conn-history';
  var ID_LASTERR = 'cfx035-conn-lasterr';
  var ID_LAT = 'cfx035-conn-lat';
  var ID_FORCE = 'cfx035-conn-force';
  var ID_CLOSE = 'cfx035-conn-close';

  var MAX_HISTORY = 12;
  var POLL_MS = 1000;
  var WS_PING_MS = 30000;
  var WS_PONG_MAX_MATCH_MS = 6000;

  var state = {
    mode: 'unknown',
    health: 'offline',
    latencyMs: null,
    lastErrorCode: null,
    lastErrorText: null,
    lastErrorAt: null,
    modeHistory: [],
    reconnecting: false,
    source: null
  };

  var _ui = {
    wrap: null,
    btn: null,
    dot: null,
    label: null,
    sub: null,
    panel: null,
    history: null,
    lastErr: null,
    lat: null,
    forceBtn: null,
    closeBtn: null
  };

  var _lastRendered = null;
  var _pollTimer = null;
  var _wsPingTimer = null;
  var _lastWsPingAt = 0;
  var _wsRtts = [];

  function now() { return Date.now(); }

  function clampHistory() {
    if (state.modeHistory.length > MAX_HISTORY) {
      state.modeHistory = state.modeHistory.slice(-MAX_HISTORY);
    }
  }

  function pushModeHistory(fromMode, toMode, reason) {
    if (!toMode) return;
    if (state.modeHistory.length) {
      var last = state.modeHistory[state.modeHistory.length - 1];
      if (last && last.to === toMode) return;
    }
    state.modeHistory.push({
      at: now(),
      from: fromMode || null,
      to: toMode,
      reason: reason || null
    });
    clampHistory();
  }

  function esc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s == null ? '' : s)));
    return d.innerHTML;
  }

  function fmtTime(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function normalizeMode(mode) {
    if (!mode) return 'unknown';
    var m = String(mode).toLowerCase();
    if (m === 'websocket') return 'ws';
    if (m === 'http-chunked' || m === 'chunked') return 'chunked';
    if (m === 'longpoll' || m === 'long-poll' || m === 'long_poll') return 'long-poll';
    if (m === 'rest') return 'http';
    if (m === 'reconnecting') return 'reconnecting';
    return m;
  }

  function healthFromLatency(latencyMs, connected) {
    if (!connected) return 'offline';
    if (typeof latencyMs !== 'number' || !isFinite(latencyMs) || latencyMs <= 0) return 'good';
    if (latencyMs < 250) return 'good';
    if (latencyMs < 800) return 'degraded';
    return 'poor';
  }

  function computeLatencyFromStats(mode) {
    // Prefer transport-specific stats where possible
    try {
      if (window.CortexTransport && typeof window.CortexTransport.getStatus === 'function') {
        var st = window.CortexTransport.getStatus();
        if (st && st.stats) {
          if (typeof st.stats.avgLatencyMs === 'number') return st.stats.avgLatencyMs;
          if (typeof st.stats.latencyMs === 'number') return st.stats.latencyMs;
          if (typeof st.stats.rttMs === 'number') return st.stats.rttMs;
        }
      }

      if (window.CortexChatDispatcher && typeof window.CortexChatDispatcher.getConnectionStats === 'function') {
        var cs = window.CortexChatDispatcher.getConnectionStats();
        if (cs && cs.webrtc && cs.webrtc.stats) {
          var ws = cs.webrtc.stats;
          if (typeof ws.rttMs === 'number') return ws.rttMs;
          if (typeof ws.latencyMs === 'number') return ws.latencyMs;
          if (typeof ws.roundTripTimeMs === 'number') return ws.roundTripTimeMs;
        }
      }
    } catch (e) { /* ignore */ }

    // WebSocket RTT rolling avg (computed by this module)
    if (mode === 'ws' && _wsRtts.length) {
      var sum = 0;
      for (var i = 0; i < _wsRtts.length; i++) sum += _wsRtts[i];
      return Math.round(sum / _wsRtts.length);
    }

    return null;
  }

  function computeModeAndConnectivity() {
    // Returns { mode, connected, reconnecting, source }

    // Highest priority: CortexTransport (unified)
    try {
      if (window.CortexTransport && typeof window.CortexTransport.getStatus === 'function') {
        var s = window.CortexTransport.getStatus();
        if (s) {
          var tm = normalizeMode(s.transport || s.stats && s.stats.transport);
          var connected = s.state === 'connected' || (typeof window.CortexTransport.isConnected === 'function' && window.CortexTransport.isConnected());
          return {
            mode: tm || 'unknown',
            connected: !!connected,
            reconnecting: s.state === 'connecting',
            source: 'CortexTransport'
          };
        }
      }
    } catch (e) { /* ignore */ }

    // Next: CortexChatDispatcher.getConnectionMode()
    try {
      if (window.CortexChatDispatcher && typeof window.CortexChatDispatcher.getConnectionMode === 'function') {
        var m = normalizeMode(window.CortexChatDispatcher.getConnectionMode());
        var wsState = window.CortexWsReconnect && typeof window.CortexWsReconnect.getState === 'function'
          ? window.CortexWsReconnect.getState()
          : null;
        var connected2 = (m === 'webrtc') || (m === 'ws') || (wsState === 'connected');
        var reconnecting = (m === 'reconnecting') || (wsState === 'reconnecting') || (wsState === 'connecting');
        return {
          mode: m,
          connected: !!connected2,
          reconnecting: !!reconnecting,
          source: 'CortexChatDispatcher'
        };
      }
    } catch (e2) { /* ignore */ }

    // Next: CortexWsReconnect state only
    try {
      if (window.CortexWsReconnect && typeof window.CortexWsReconnect.getState === 'function') {
        var st2 = window.CortexWsReconnect.getState();
        if (st2 === 'connected') return { mode: 'ws', connected: true, reconnecting: false, source: 'CortexWsReconnect' };
        if (st2 === 'connecting') return { mode: 'ws', connected: false, reconnecting: true, source: 'CortexWsReconnect' };
        if (st2 === 'reconnecting') return { mode: 'reconnecting', connected: false, reconnecting: true, source: 'CortexWsReconnect' };
        return { mode: 'ws', connected: false, reconnecting: false, source: 'CortexWsReconnect' };
      }
    } catch (e3) { /* ignore */ }

    return { mode: 'unknown', connected: false, reconnecting: false, source: 'none' };
  }

  function computeState() {
    var prevMode = state.mode;

    var mc = computeModeAndConnectivity();
    var mode = mc.mode;
    var connected = mc.connected;

    // compute latency
    var latencyMs = computeLatencyFromStats(mode);

    // health based on connectivity and latency
    var health = healthFromLatency(latencyMs, connected);

    // If reconnecting, downgrade health
    if (mc.reconnecting) {
      health = connected ? 'degraded' : 'poor';
    }

    state.source = mc.source;
    state.reconnecting = !!mc.reconnecting;
    state.mode = mode;
    state.latencyMs = latencyMs;
    state.health = (connected ? health : 'offline');

    if (prevMode !== state.mode) {
      pushModeHistory(prevMode, state.mode, mc.source);
    }

    return state;
  }

  function render() {
    if (!_ui.wrap) return;

    var snapshot = {
      mode: state.mode,
      health: state.health,
      latencyMs: state.latencyMs,
      lastErrorCode: state.lastErrorCode,
      lastErrorText: state.lastErrorText,
      reconnecting: state.reconnecting,
      source: state.source,
      modeHistory: state.modeHistory.slice()
    };

    // Cheap change detection
    var snapStr;
    try { snapStr = JSON.stringify(snapshot); } catch (e) { snapStr = String(now()); }
    if (_lastRendered === snapStr) return;
    _lastRendered = snapStr;

    // Dot + label
    _ui.wrap.setAttribute('data-health', state.health);
    _ui.wrap.setAttribute('data-mode', state.mode);

    var label = (state.mode || 'unknown').toUpperCase();
    if (state.mode === 'chunked') label = 'CHUNKED';
    if (state.mode === 'long-poll') label = 'LONG-POLL';
    if (state.mode === 'http') label = 'HTTP';
    if (state.mode === 'ws') label = 'WS';

    if (_ui.label) _ui.label.textContent = label;

    var sub = state.health;
    if (typeof state.latencyMs === 'number') sub += ' · ' + state.latencyMs + 'ms';
    if (state.reconnecting) sub = 'reconnecting…';
    if (_ui.sub) _ui.sub.textContent = sub;

    // aria
    if (_ui.btn) {
      _ui.btn.setAttribute('aria-label', 'Connection: ' + (state.mode || 'unknown') + ', ' + state.health);
    }

    // panel
    var modeEl2 = document.getElementById('cfx035-conn-mode');
    var healthEl2 = document.getElementById('cfx035-conn-health');
    if (modeEl2) modeEl2.textContent = state.mode || 'unknown';
    if (healthEl2) healthEl2.textContent = state.health || 'offline';

    if (_ui.history) {
      var h = '';
      var hist = state.modeHistory.slice().reverse();
      if (!hist.length) {
        h = '<div class="cfx035-empty">No switches yet.</div>';
      } else {
        for (var i = 0; i < hist.length; i++) {
          var it = hist[i];
          h += '<div class="cfx035-row">' +
            '<div class="cfx035-row-main">' +
              '<span class="cfx035-pill">' + esc((it.to || 'unknown').toUpperCase()) + '</span>' +
              (it.from ? '<span class="cfx035-muted"> from ' + esc((it.from || '').toUpperCase()) + '</span>' : '') +
            '</div>' +
            '<div class="cfx035-row-sub">' + esc(fmtTime(it.at)) + (it.reason ? ' · ' + esc(it.reason) : '') + '</div>' +
          '</div>';
        }
      }
      _ui.history.innerHTML = h;
    }

    if (_ui.lastErr) {
      if (state.lastErrorCode) {
        var t = state.lastErrorCode;
        if (state.lastErrorText) t += ' — ' + state.lastErrorText;
        if (state.lastErrorAt) t += ' (' + fmtTime(state.lastErrorAt) + ')';
        _ui.lastErr.textContent = t;
      } else {
        _ui.lastErr.textContent = '—';
      }
    }

    if (_ui.lat) {
      _ui.lat.textContent = (typeof state.latencyMs === 'number') ? (state.latencyMs + ' ms') : '—';
    }

    if (_ui.forceBtn) {
      _ui.forceBtn.disabled = false;
      // If offline and no reconnection APIs, disable
      var canForce = !!(
        (window.CortexTransport && typeof window.CortexTransport.connect === 'function') ||
        (window.CortexChatDispatcher && (typeof window.CortexChatDispatcher.reconnect === 'function' || typeof window.CortexChatDispatcher.enableWebRTC === 'function'))
      );
      _ui.forceBtn.disabled = !canForce;
    }
  }

  function ensureUI() {
    if (document.getElementById(ID_WRAP)) {
      _ui.wrap = document.getElementById(ID_WRAP);
      _ui.btn = document.getElementById(ID_BTN);
      _ui.dot = document.getElementById(ID_DOT);
      _ui.label = document.getElementById(ID_LABEL);
      _ui.sub = document.getElementById(ID_SUB);
      _ui.panel = document.getElementById(ID_PANEL);
      _ui.history = document.getElementById(ID_HISTORY);
      _ui.lastErr = document.getElementById(ID_LASTERR);
      _ui.lat = document.getElementById(ID_LAT);
      _ui.forceBtn = document.getElementById(ID_FORCE);
      _ui.closeBtn = document.getElementById(ID_CLOSE);
      return;
    }

    var wrap = document.createElement('div');
    wrap.id = ID_WRAP;
    wrap.className = 'cfx035-conn';
    wrap.setAttribute('data-health', 'offline');
    wrap.setAttribute('data-mode', 'unknown');

    var btn = document.createElement('button');
    btn.id = ID_BTN;
    btn.className = 'cfx035-btn';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', ID_PANEL);

    btn.innerHTML =
      '<span class="cfx035-dot" id="' + ID_DOT + '" aria-hidden="true"></span>' +
      '<span class="cfx035-text">' +
        '<span class="cfx035-label" id="' + ID_LABEL + '">—</span>' +
        '<span class="cfx035-sub" id="' + ID_SUB + '">offline</span>' +
      '</span>';

    var panel = document.createElement('div');
    panel.id = ID_PANEL;
    panel.className = 'cfx035-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', 'Connection details');
    panel.hidden = true;

    panel.innerHTML =
      '<div class="cfx035-panel-head">' +
        '<div class="cfx035-panel-title">Connection details</div>' +
        '<button type="button" class="cfx035-close" id="' + ID_CLOSE + '" aria-label="Close connection details">×</button>' +
      '</div>' +
      '<div class="cfx035-kv">' +
        '<div class="cfx035-k">Mode</div><div class="cfx035-v" id="cfx035-conn-mode">—</div>' +
        '<div class="cfx035-k">Health</div><div class="cfx035-v" id="cfx035-conn-health">—</div>' +
        '<div class="cfx035-k">Latency</div><div class="cfx035-v" id="' + ID_LAT + '">—</div>' +
        '<div class="cfx035-k">Last error</div><div class="cfx035-v" id="' + ID_LASTERR + '">—</div>' +
      '</div>' +
      '<div class="cfx035-section">' +
        '<div class="cfx035-section-title">Mode history</div>' +
        '<div id="' + ID_HISTORY + '" class="cfx035-history"></div>' +
      '</div>' +
      '<div class="cfx035-actions">' +
        '<button type="button" id="' + ID_FORCE + '" class="cfx035-force">Force fallback</button>' +
      '</div>';

    wrap.appendChild(btn);
    wrap.appendChild(panel);

    // mount (prefer header area on chat UI so we don't cover the input bar)
    var mountParent = document.querySelector('.chat-header-right');
    if (mountParent) {
      wrap.classList.add('cfx035-inline');
      mountParent.appendChild(wrap);
    } else {
      (document.body || document.documentElement).appendChild(wrap);
    }

    // cache nodes
    _ui.wrap = wrap;
    _ui.btn = btn;
    _ui.dot = document.getElementById(ID_DOT);
    _ui.label = document.getElementById(ID_LABEL);
    _ui.sub = document.getElementById(ID_SUB);
    _ui.panel = panel;
    _ui.history = document.getElementById(ID_HISTORY);
    _ui.lastErr = document.getElementById(ID_LASTERR);
    _ui.lat = document.getElementById(ID_LAT);
    _ui.forceBtn = document.getElementById(ID_FORCE);
    _ui.closeBtn = document.getElementById(ID_CLOSE);

    // interactions
    btn.addEventListener('click', function () {
      togglePanel();
    });

    panel.addEventListener('click', function (e) {
      // click-outside close
      if (e.target === panel) closePanel();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    if (_ui.closeBtn) {
      _ui.closeBtn.addEventListener('click', function () { closePanel(); });
    }

    if (_ui.forceBtn) {
      _ui.forceBtn.addEventListener('click', function () {
        forceFallback();
      });
    }
  }

  function openPanel() {
    if (!_ui.panel || !_ui.btn) return;
    _ui.panel.hidden = false;
    _ui.btn.setAttribute('aria-expanded', 'true');
    // populate simple kv
    var modeEl = document.getElementById('cfx035-conn-mode');
    var healthEl = document.getElementById('cfx035-conn-health');
    if (modeEl) modeEl.textContent = state.mode || 'unknown';
    if (healthEl) healthEl.textContent = state.health || 'offline';
  }

  function closePanel() {
    if (!_ui.panel || !_ui.btn) return;
    _ui.panel.hidden = true;
    _ui.btn.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (!_ui.panel) return;
    if (_ui.panel.hidden) openPanel();
    else closePanel();
  }

  function recordError(err) {
    try {
      var code = (err && err.code) ? String(err.code) : null;
      var text = null;
      if (err && typeof err === 'object') {
        text = err.error || err.message || err.title || null;
      } else if (typeof err === 'string') {
        text = err;
      }
      if (!code && err && err.status) code = 'HTTP_' + err.status;

      // Don’t spam with empty
      if (!code && !text) return;

      state.lastErrorCode = code || 'ERR';
      state.lastErrorText = text ? String(text).slice(0, 140) : null;
      state.lastErrorAt = now();
    } catch (e) { /* ignore */ }
  }

  function wrapChatErrorHandler() {
    try {
      var ns = window.CortexFreelancer;
      if (!ns || !ns.ChatErrorHandler || !ns.ChatErrorHandler.handleError) return;
      if (ns.ChatErrorHandler.__cfx035_wrapped) return;

      var orig = ns.ChatErrorHandler.handleError;
      ns.ChatErrorHandler.handleError = function (error) {
        recordError(error);
        return orig.apply(this, arguments);
      };
      ns.ChatErrorHandler.__cfx035_wrapped = true;
    } catch (e) { /* ignore */ }
  }

  function attachWsHooks() {
    if (!window.CortexWsReconnect || typeof window.CortexWsReconnect.on !== 'function') return;

    // state changes and failures
    try {
      window.CortexWsReconnect.on('stateChange', function (info) {
        if (info && info.to === 'failed') {
          recordError({ code: 'E101', error: 'WebSocket failed' });
        }
        // immediate refresh
        computeState();
        render();
      });

      window.CortexWsReconnect.on('failed', function (info) {
        recordError({ code: 'E101', error: info && info.message ? info.message : 'WebSocket failed' });
        computeState();
        render();
      });

      window.CortexWsReconnect.on('reconnecting', function (info) {
        // not an error, but we track as state
        computeState();
        render();
      });

      // latency probe: we send our own ping, measure pong
      window.CortexWsReconnect.on('message', function (data) {
        if (!data || data.type !== 'pong') return;
        if (!_lastWsPingAt) return;
        var rtt = now() - _lastWsPingAt;
        if (rtt > 0 && rtt < WS_PONG_MAX_MATCH_MS) {
          _wsRtts.push(rtt);
          if (_wsRtts.length > 10) _wsRtts = _wsRtts.slice(-10);
          _lastWsPingAt = 0;
          computeState();
          render();
        }
      });
    } catch (e) { /* ignore */ }
  }

  function startWsPingLoop() {
    if (_wsPingTimer) return;
    if (!window.CortexWsReconnect || typeof window.CortexWsReconnect.isConnected !== 'function') return;

    _wsPingTimer = setInterval(function () {
      try {
        if (!window.CortexWsReconnect.isConnected()) return;
        // avoid pounding if other modules ping; only record if we can match
        var t = now();
        if (t - _lastWsPingAt < 5000) return;
        _lastWsPingAt = t;
        window.CortexWsReconnect.send({ type: 'ping', _cfx035: t });
      } catch (e) {
        _lastWsPingAt = 0;
      }
    }, WS_PING_MS);
  }

  function forceFallback() {
    // Best-effort: try to move to next transport.
    try {
      if (window.CortexTransport && typeof window.CortexTransport.getStatus === 'function') {
        var st = window.CortexTransport.getStatus();
        var cur = st && st.transport ? st.transport : null;
        if (typeof window.CortexTransport.disconnect === 'function') window.CortexTransport.disconnect();
        // connect skipping current transport
        if (typeof window.CortexTransport.connect === 'function') {
          return window.CortexTransport.connect({ skip: cur ? [cur] : [] }).catch(function () {});
        }
      }

      if (window.CortexChatDispatcher) {
        var mode = null;
        if (typeof window.CortexChatDispatcher.getConnectionMode === 'function') {
          mode = normalizeMode(window.CortexChatDispatcher.getConnectionMode());
        }

        // Only explicit, user-controlled fallback we can guarantee: WebRTC → WS
        if (mode === 'webrtc' && typeof window.CortexChatDispatcher.enableWebRTC === 'function') {
          window.CortexChatDispatcher.enableWebRTC(false);
        }

        if (typeof window.CortexChatDispatcher.reconnect === 'function') {
          window.CortexChatDispatcher.reconnect();
        }
      }
    } catch (e) {
      recordError(e);
    }
  }

  function startPolling() {
    if (_pollTimer) return;
    _pollTimer = setInterval(function () {
      try {
        computeState();
        render();
      } catch (e) { /* ignore */ }
    }, POLL_MS);
  }

  function init() {
    ensureUI();

    // capture errors
    wrapChatErrorHandler();

    // hooks
    attachWsHooks();
    startWsPingLoop();

    // initial compute
    computeState();
    render();

    // polling fallback for mode switches we can’t subscribe to
    startPolling();

    console.log('[CFX-035] Connection indicator initialized');
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  window.CortexConnectionIndicator = {
    init: init,
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    forceFallback: forceFallback
  };
})();
