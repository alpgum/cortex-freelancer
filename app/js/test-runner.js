/**
 * CF-270 — Lightweight In-Browser Test Runner
 * describe/it/expect API, run suites, show pass/fail results
 */
(function() {
  const NS = (window.CortexFreelancer = window.CortexFreelancer || {});

  // ── Core runner state ──
  const suites = [];
  let currentSuite = null;

  function describe(name, fn) {
    const suite = { name, tests: [], beforeEachFn: null, afterEachFn: null };
    const prev = currentSuite;
    currentSuite = suite;
    try { fn(); } catch (e) { suite.error = e.message; }
    currentSuite = prev;
    suites.push(suite);
  }

  function it(name, fn) {
    if (!currentSuite) throw new Error('it() must be called inside describe()');
    currentSuite.tests.push({ name, fn });
  }

  function beforeEach(fn) {
    if (currentSuite) currentSuite.beforeEachFn = fn;
  }

  function afterEach(fn) {
    if (currentSuite) currentSuite.afterEachFn = fn;
  }

  // ── Expect / assertion builder ──
  function expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      },
      toEqual(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          throw new Error(`Expected deep equal ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      },
      toBeTruthy() {
        if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
      },
      toBeFalsy() {
        if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
      },
      toContain(item) {
        if (typeof actual === 'string') {
          if (!actual.includes(item)) throw new Error(`Expected "${actual}" to contain "${item}"`);
        } else if (Array.isArray(actual)) {
          if (!actual.includes(item)) throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
        } else {
          throw new Error('toContain requires string or array');
        }
      },
      toBeGreaterThan(n) {
        if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
      },
      toBeLessThan(n) {
        if (!(actual < n)) throw new Error(`Expected ${actual} < ${n}`);
      },
      toBeInstanceOf(cls) {
        if (!(actual instanceof cls)) throw new Error(`Expected instance of ${cls.name}`);
      },
      toThrow() {
        if (typeof actual !== 'function') throw new Error('toThrow requires a function');
        let threw = false;
        try { actual(); } catch (_) { threw = true; }
        if (!threw) throw new Error('Expected function to throw');
      },
      toMatch(regex) {
        if (!regex.test(actual)) throw new Error(`Expected "${actual}" to match ${regex}`);
      },
      toHaveLength(len) {
        if (actual.length !== len) throw new Error(`Expected length ${len}, got ${actual.length}`);
      },
      toBeDefined() {
        if (actual === undefined) throw new Error('Expected value to be defined');
      },
      toBeNull() {
        if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      },
      not: {
        toBe(expected) { if (actual === expected) throw new Error(`Expected not ${JSON.stringify(expected)}`); },
        toEqual(expected) {
          if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error('Expected values to differ');
        },
        toContain(item) {
          if ((typeof actual === 'string' && actual.includes(item)) || (Array.isArray(actual) && actual.includes(item)))
            throw new Error(`Expected not to contain ${JSON.stringify(item)}`);
        },
        toBeTruthy() { if (actual) throw new Error('Expected falsy'); },
        toBeFalsy() { if (!actual) throw new Error('Expected truthy'); },
        toBeNull() { if (actual === null) throw new Error('Expected not null'); }
      }
    };
  }

  // ── Run all suites ──
  async function runAllTests() {
    const results = [];
    for (const suite of suites) {
      const suiteResult = { name: suite.name, tests: [], passed: 0, failed: 0 };
      for (const test of suite.tests) {
        try {
          if (suite.beforeEachFn) suite.beforeEachFn();
          const ret = test.fn();
          if (ret && typeof ret.then === 'function') await ret;
          if (suite.afterEachFn) suite.afterEachFn();
          suiteResult.tests.push({ name: test.name, status: 'pass', error: null });
          suiteResult.passed++;
        } catch (e) {
          suiteResult.tests.push({ name: test.name, status: 'fail', error: e.message });
          suiteResult.failed++;
        }
      }
      results.push(suiteResult);
    }
    return results;
  }

  function clearSuites() { suites.length = 0; }

  // ── Built-in example tests (20+) ──
  function registerExampleTests() {
    // 1–4: Validators
    describe('Email Validator', function() {
      const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
      it('accepts valid email', function() { expect(isEmail('a@b.com')).toBe(true); });
      it('rejects missing @', function() { expect(isEmail('ab.com')).toBe(false); });
      it('rejects empty string', function() { expect(isEmail('')).toBe(false); });
      it('rejects double @', function() { expect(isEmail('a@@b.com')).toBe(false); });
    });

    // 5–8: Formatters
    describe('Currency Formatter', function() {
      const fmt = (n, c) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'USD' }).format(n);
      it('formats dollars', function() { expect(fmt(1234.5)).toContain('1,234.50'); });
      it('formats zero', function() { expect(fmt(0)).toContain('0.00'); });
      it('formats EUR', function() { expect(fmt(100, 'EUR')).toContain('100.00'); });
      it('handles negative', function() { expect(fmt(-50)).toContain('50.00'); });
    });

    // 9–12: Array utilities
    describe('Array Utilities', function() {
      it('unique filters duplicates', function() {
        expect([...new Set([1,2,2,3])]).toEqual([1,2,3]);
      });
      it('flat works on nested', function() {
        expect([1,[2,[3]]].flat(Infinity)).toEqual([1,2,3]);
      });
      it('includes finds item', function() {
        expect([1,2,3].includes(2)).toBe(true);
      });
      it('map transforms', function() {
        expect([1,2,3].map(x => x * 2)).toEqual([2,4,6]);
      });
    });

    // 13–16: String utilities
    describe('String Utilities', function() {
      const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      it('slugifies text', function() { expect(slug('Hello World!')).toBe('hello-world'); });
      it('trims edges', function() { expect(slug('--hi--')).toBe('hi'); });
      it('truncate works', function() {
        const trunc = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;
        expect(trunc('abcdef', 3)).toBe('abc…');
      });
      it('capitalize first', function() {
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        expect(cap('hello')).toBe('Hello');
      });
    });

    // 17–20: Scorer / math helpers
    describe('Score Calculator', function() {
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      const pct = (v, t) => Math.round((v / t) * 100);
      it('clamps low', function() { expect(clamp(-5, 0, 100)).toBe(0); });
      it('clamps high', function() { expect(clamp(200, 0, 100)).toBe(100); });
      it('percentage calc', function() { expect(pct(3, 4)).toBe(75); });
      it('percentage zero total', function() {
        expect(isFinite(pct(0, 0))).toBe(false);
      });
    });

    // 21–23: Type checks
    describe('Type Guards', function() {
      it('detects arrays', function() { expect(Array.isArray([])).toBe(true); });
      it('detects objects', function() { expect(typeof {} === 'object').toBe(true); });
      it('NaN check', function() { expect(Number.isNaN(NaN)).toBe(true); });
    });
  }

  // ── Render results to DOM ──
  function renderTestResults(container, results) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    const totalPassed = results.reduce((s, r) => s + r.passed, 0);
    const totalFailed = results.reduce((s, r) => s + r.failed, 0);
    const total = totalPassed + totalFailed;

    el.innerHTML = `
      <div style="font-family:var(--font-mono,'monospace');max-width:720px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:2px solid ${totalFailed ? '#ef4444' : '#22c55e'}">
          <h2 style="margin:0;font-size:18px">Test Results</h2>
          <span style="font-size:14px;color:${totalFailed ? '#ef4444' : '#22c55e'}">${totalPassed}/${total} passed</span>
        </div>
        ${results.map(suite => `
          <div style="margin:16px 0">
            <div style="font-weight:600;margin-bottom:8px">${suite.name}
              <span style="font-weight:400;color:#888;font-size:12px">(${suite.passed}/${suite.tests.length})</span>
            </div>
            ${suite.tests.map(t => `
              <div style="padding:4px 0 4px 16px;font-size:13px;color:${t.status === 'pass' ? '#22c55e' : '#ef4444'}">
                ${t.status === 'pass' ? '✓' : '✗'} ${t.name}
                ${t.error ? `<div style="color:#f87171;font-size:11px;margin-left:18px">${t.error}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>`;
  }

  // ── Public API ──
  NS.TestRunner = {
    describe, it, beforeEach, afterEach, expect,
    runAllTests, clearSuites, registerExampleTests,
    renderTestResults
  };
})();
