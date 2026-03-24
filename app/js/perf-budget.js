/**
 * CF-277 Performance Budgets
 * Define budgets (JS size, load time, FCP, LCP, CLS), measure via Performance API
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const DEFAULT_BUDGETS = {
    jsSize:    { label: 'JS Bundle Size',             target: 200,  unit: 'KB',  max: 300 },
    cssSize:   { label: 'CSS Size',                   target: 50,   unit: 'KB',  max: 80 },
    imgSize:   { label: 'Total Image Size',           target: 500,  unit: 'KB',  max: 800 },
    loadTime:  { label: 'Page Load Time',             target: 2000, unit: 'ms',  max: 3500 },
    fcp:       { label: 'First Contentful Paint',     target: 1200, unit: 'ms',  max: 2000 },
    lcp:       { label: 'Largest Contentful Paint',   target: 2500, unit: 'ms',  max: 4000 },
    cls:       { label: 'Cumulative Layout Shift',    target: 0.1,  unit: '',    max: 0.25 },
    ttfb:      { label: 'Time to First Byte',         target: 200,  unit: 'ms',  max: 600 },
    requests:  { label: 'Total HTTP Requests',        target: 30,   unit: '',    max: 50 },
    domNodes:  { label: 'DOM Node Count',             target: 800,  unit: '',    max: 1500 }
  };

  function getResourceSizes() {
    const entries = performance.getEntriesByType('resource');
    let js = 0, css = 0, img = 0, total = 0;
    for (const e of entries) {
      const size = e.transferSize || e.encodedBodySize || 0;
      total += size;
      if (/\.js(\?|$)/i.test(e.name)) js += size;
      else if (/\.css(\?|$)/i.test(e.name)) css += size;
      else if (/\.(png|jpe?g|gif|svg|webp|avif)(\?|$)/i.test(e.name)) img += size;
    }
    return { js: js / 1024, css: css / 1024, img: img / 1024, total: total / 1024, requestCount: entries.length };
  }

  function getNavigationTiming() {
    const [nav] = performance.getEntriesByType('navigation');
    if (!nav) return { loadTime: 0, ttfb: 0 };
    return {
      loadTime: Math.round(nav.loadEventEnd - nav.startTime),
      ttfb: Math.round(nav.responseStart - nav.requestStart)
    };
  }

  function getPaintTiming() {
    const entries = performance.getEntriesByType('paint');
    const fcp = entries.find(e => e.name === 'first-contentful-paint');
    return { fcp: fcp ? Math.round(fcp.startTime) : null };
  }

  function observeLCP(callback) {
    if (!window.PerformanceObserver) return;
    try {
      const obs = new PerformanceObserver(list => {
        const entries = list.getEntries();
        if (entries.length) callback(Math.round(entries[entries.length - 1].startTime));
      });
      obs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch(e) { /* unsupported */ }
  }

  function observeCLS(callback) {
    if (!window.PerformanceObserver) return;
    let cls = 0;
    try {
      const obs = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) cls += entry.value;
        }
        callback(Math.round(cls * 1000) / 1000);
      });
      obs.observe({ type: 'layout-shift', buffered: true });
    } catch(e) { /* unsupported */ }
  }

  function collectMetrics() {
    const sizes = getResourceSizes();
    const nav = getNavigationTiming();
    const paint = getPaintTiming();
    return {
      jsSize: Math.round(sizes.js),
      cssSize: Math.round(sizes.css),
      imgSize: Math.round(sizes.img),
      loadTime: nav.loadTime,
      ttfb: nav.ttfb,
      fcp: paint.fcp || 0,
      lcp: 0,
      cls: 0,
      requests: sizes.requestCount,
      domNodes: document.querySelectorAll('*').length
    };
  }

  function checkBudgets(budgets) {
    budgets = budgets || DEFAULT_BUDGETS;
    const metrics = collectMetrics();
    const results = [];
    for (const [key, budget] of Object.entries(budgets)) {
      const actual = metrics[key];
      if (actual === undefined || actual === null) continue;
      const pass = actual <= budget.max;
      const withinTarget = actual <= budget.target;
      results.push({
        key, label: budget.label, target: budget.target, max: budget.max,
        actual, unit: budget.unit, pass, withinTarget,
        status: withinTarget ? 'good' : pass ? 'warning' : 'fail',
        overage: pass ? 0 : actual - budget.max
      });
    }
    const passed = results.filter(r => r.pass).length;
    return { results, passed, total: results.length, allPassed: passed === results.length, timestamp: new Date().toISOString() };
  }

  function renderPerfDashboard(containerId, budgets) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const report = checkBudgets(budgets);
    const statusIcon = { good: '✓', warning: '⚠', fail: '✗' };
    const statusColor = { good: '#22c55e', warning: '#f59e0b', fail: '#ef4444' };

    el.innerHTML = `
      <div style="font-family:var(--font-main,system-ui);max-width:800px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <h2 style="margin:0">Performance Budget</h2>
          <span style="background:${report.allPassed ? '#22c55e' : '#ef4444'};color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600">
            ${report.passed}/${report.total} passed
          </span>
        </div>

        <div style="display:grid;gap:12px">
          ${report.results.map(r => {
            const pct = Math.min((r.actual / r.max) * 100, 150);
            return `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div>
                  <span style="color:${statusColor[r.status]};font-weight:700;margin-right:6px">${statusIcon[r.status]}</span>
                  <strong style="font-size:14px">${r.label}</strong>
                </div>
                <span style="font-size:14px;font-weight:600;color:${statusColor[r.status]}">
                  ${r.actual}${r.unit ? ' ' + r.unit : ''} / ${r.max}${r.unit ? ' ' + r.unit : ''}
                </span>
              </div>
              <div style="background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden">
                <div style="height:100%;width:${Math.min(pct, 100)}%;background:${statusColor[r.status]};border-radius:4px;transition:width .3s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:4px">
                <span>Target: ${r.target}${r.unit ? ' ' + r.unit : ''}</span>
                <span>Budget: ${r.max}${r.unit ? ' ' + r.unit : ''}</span>
              </div>
            </div>`;
          }).join('')}
        </div>

        <p style="color:#94a3b8;font-size:12px;margin-top:16px;text-align:right">
          Measured at ${new Date(report.timestamp).toLocaleTimeString()}
        </p>
      </div>
    `;
  }

  ns.perfBudget = {
    DEFAULT_BUDGETS, collectMetrics, checkBudgets,
    observeLCP, observeCLS, renderPerfDashboard
  };
})();
