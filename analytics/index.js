const crypto = require('crypto');
const { createNdjsonStore } = require('./store');

function sha256Short(input) {
  try {
    return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
  } catch {
    return 'anon';
  }
}

function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function clampStr(s, max = 200) {
  if (s == null) return null;
  s = String(s);
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function createAnalytics({ dataDir, appVersion, transportAllowlist } = {}) {
  const store = createNdjsonStore({ dir: dataDir });

  function sanitizeEvent(payload) {
    const now = Date.now();
    const ts = safeNumber(payload && payload.ts) || now;

    const type = clampStr(payload && payload.type, 64) || 'event';
    const name = clampStr(payload && payload.name, 64) || 'unknown';

    const sessionId = payload && payload.sessionId ? sha256Short(payload.sessionId) : sha256Short('no_session');
    const anonUserId = payload && payload.anonUserId ? sha256Short(payload.anonUserId) : null;

    const page = clampStr(payload && payload.page, 200);
    const referrer = clampStr(payload && payload.referrer, 200);

    let transport = clampStr(payload && payload.transport, 32);
    if (transportAllowlist && transport && !transportAllowlist.includes(transport)) transport = 'other';

    const perf = payload && typeof payload.perf === 'object' ? {
      ttfbMs: safeNumber(payload.perf.ttfbMs),
      totalMs: safeNumber(payload.perf.totalMs),
      connectLatencyMs: safeNumber(payload.perf.connectLatencyMs),
      bytesIn: safeNumber(payload.perf.bytesIn),
      bytesOut: safeNumber(payload.perf.bytesOut),
    } : undefined;

    const meta = payload && typeof payload.meta === 'object' ? {
      // keep only a small allowlist-ish set to avoid accidental PII
      kind: clampStr(payload.meta.kind, 64),
      errorCode: clampStr(payload.meta.errorCode, 64),
      retryable: payload.meta.retryable === true ? true : payload.meta.retryable === false ? false : undefined,
      model: clampStr(payload.meta.model, 64),
      environment: clampStr(payload.meta.environment, 32),
    } : undefined;

    return {
      v: 1,
      ts,
      type,
      name,
      sessionId,
      anonUserId,
      page,
      referrer,
      transport,
      perf,
      meta,
      appVersion: clampStr(appVersion, 32) || undefined,
    };
  }

  function track(payload) {
    const event = sanitizeEvent(payload || {});
    store.append(event);
    return event;
  }

  function summarize(events) {
    const summary = {
      totalEvents: events.length,
      byName: {},
      byTransport: {},
      errors: 0,
      performance: {
        totalMs: { count: 0, p50: null, p95: null, max: null },
        connectLatencyMs: { count: 0, p50: null, p95: null, max: null },
      },
      range: { fromTs: null, toTs: null },
    };

    const totalMs = [];
    const connectMs = [];

    for (const e of events) {
      if (!summary.range.fromTs || e.ts < summary.range.fromTs) summary.range.fromTs = e.ts;
      if (!summary.range.toTs || e.ts > summary.range.toTs) summary.range.toTs = e.ts;

      summary.byName[e.name] = (summary.byName[e.name] || 0) + 1;
      if (e.transport) summary.byTransport[e.transport] = (summary.byTransport[e.transport] || 0) + 1;
      if (e.type === 'error' || e.name === 'error') summary.errors += 1;

      const t = e.perf && Number.isFinite(e.perf.totalMs) ? e.perf.totalMs : null;
      if (t != null) totalMs.push(t);
      const c = e.perf && Number.isFinite(e.perf.connectLatencyMs) ? e.perf.connectLatencyMs : null;
      if (c != null) connectMs.push(c);
    }

    function finalize(arr) {
      if (!arr.length) return { count: 0, p50: null, p95: null, max: null };
      const s = arr.slice().sort((a, b) => a - b);
      const p = (q) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
      return { count: s.length, p50: p(0.5), p95: p(0.95), max: s[s.length - 1] };
    }

    summary.performance.totalMs = finalize(totalMs);
    summary.performance.connectLatencyMs = finalize(connectMs);

    return summary;
  }

  function getSummary({ limitDays = 14 } = {}) {
    const events = store.readAllEvents({ limitDays });
    return { summary: summarize(events), eventsCount: events.length, files: store.listFiles() };
  }

  function exportEvents({ limitDays = 14 } = {}) {
    return store.readAllEvents({ limitDays });
  }

  function exportCsv(events) {
    const headers = ['ts','type','name','sessionId','anonUserId','page','referrer','transport','perf.totalMs','perf.connectLatencyMs','meta.kind','meta.errorCode','meta.retryable'];
    const rows = [headers.join(',')];
    for (const e of events) {
      const row = [
        e.ts,
        JSON.stringify(e.type || ''),
        JSON.stringify(e.name || ''),
        JSON.stringify(e.sessionId || ''),
        JSON.stringify(e.anonUserId || ''),
        JSON.stringify(e.page || ''),
        JSON.stringify(e.referrer || ''),
        JSON.stringify(e.transport || ''),
        e.perf && Number.isFinite(e.perf.totalMs) ? e.perf.totalMs : '',
        e.perf && Number.isFinite(e.perf.connectLatencyMs) ? e.perf.connectLatencyMs : '',
        JSON.stringify(e.meta && e.meta.kind ? e.meta.kind : ''),
        JSON.stringify(e.meta && e.meta.errorCode ? e.meta.errorCode : ''),
        (e.meta && typeof e.meta.retryable === 'boolean') ? e.meta.retryable : '',
      ];
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  return { track, getSummary, exportEvents, exportCsv };
}

module.exports = { createAnalytics };
