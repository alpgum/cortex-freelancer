/**
 * CF-272 — E2E Test Definitions
 * Critical user journeys as test specs with step definitions,
 * expected states, and visual test progress renderer
 */
(function() {
  const NS = (window.CortexFreelancer = window.CortexFreelancer || {});

  // ── Step status constants ──
  const STATUS = { PENDING: 'pending', RUNNING: 'running', PASSED: 'passed', FAILED: 'failed', SKIPPED: 'skipped' };

  // ── Journey builder ──
  function journey(name) {
    const steps = [];
    const j = {
      name,
      step(label, expectedState, assertFn) {
        steps.push({ label, expectedState, assertFn, status: STATUS.PENDING, error: null, duration: 0 });
        return j;
      },
      getSteps() { return steps; }
    };
    return j;
  }

  // ── Define critical journeys ──
  function defineJourneys() {
    const journeys = [];

    // 1. Landing → Signup → Dashboard
    journeys.push(
      journey('New User Onboarding')
        .step('Load landing page', { url: '/', title: 'Cortex Freelancer' }, ctx => {
          return ctx.url === '/' && ctx.title;
        })
        .step('Click "Get Started" CTA', { navigated: '/app/signup.html' }, ctx => {
          return ctx.url === '/app/signup.html';
        })
        .step('Fill email and password', { formFilled: true }, ctx => {
          return ctx.email && ctx.password && ctx.password.length >= 6;
        })
        .step('Submit signup form', { userCreated: true, redirected: '/app/dashboard.html' }, ctx => {
          return ctx.uid && ctx.url === '/app/dashboard.html';
        })
        .step('Dashboard renders tools grid', { toolsVisible: true, toolCount: '>0' }, ctx => {
          return ctx.toolCount > 0;
        })
    );

    // 2. Login → Use Tool → Save Result
    journeys.push(
      journey('Tool Usage Flow')
        .step('Navigate to login', { url: '/app/login.html' }, ctx => ctx.url === '/app/login.html')
        .step('Sign in with email', { authenticated: true }, ctx => !!ctx.uid)
        .step('Navigate to proposal tool', { url: '/app/tools/proposal.html' }, ctx => ctx.url.includes('proposal'))
        .step('Enter job description', { inputFilled: true }, ctx => ctx.jobDescription && ctx.jobDescription.length > 10)
        .step('Generate proposal', { proposalGenerated: true }, ctx => ctx.proposal && ctx.proposal.length > 50)
        .step('Copy proposal to clipboard', { copied: true }, ctx => ctx.clipboardContent === ctx.proposal)
    );

    // 3. Free → Upgrade → Pro Features
    journeys.push(
      journey('Upgrade to Pro')
        .step('Login as free user', { tier: 'free', authenticated: true }, ctx => ctx.uid && ctx.tier === 'free')
        .step('Hit usage limit on tool', { limitReached: true, upgradePrompt: true }, ctx => ctx.usageCount >= ctx.limit)
        .step('Click upgrade button', { navigated: '/pricing.html' }, ctx => ctx.url === '/pricing.html')
        .step('Select Pro plan', { planSelected: 'pro' }, ctx => ctx.selectedPlan === 'pro')
        .step('Complete Stripe checkout', { checkoutComplete: true, tier: 'pro' }, ctx => ctx.tier === 'pro')
        .step('Verify pro badge on dashboard', { proBadge: true }, ctx => ctx.hasBadge === true)
        .step('Use previously-limited tool', { toolAccessible: true }, ctx => ctx.canUseTool === true)
    );

    // 4. Subscription Management
    journeys.push(
      journey('Subscription Management')
        .step('Login as pro user', { tier: 'pro' }, ctx => ctx.tier === 'pro')
        .step('Open account settings', { url: '/app/dashboard.html#settings' }, ctx => ctx.settingsVisible)
        .step('Click manage subscription', { portalOpened: true }, ctx => ctx.portalUrl)
        .step('View billing history', { invoicesLoaded: true }, ctx => Array.isArray(ctx.invoices))
        .step('Update payment method', { paymentUpdated: true }, ctx => ctx.newCardLast4)
    );

    // 5. Guest → Signup Conversion
    journeys.push(
      journey('Guest to Signup Conversion')
        .step('Visit landing page', { url: '/' }, ctx => ctx.url === '/')
        .step('Try free tool without auth', { toolLoaded: true, guestMode: true }, ctx => ctx.guestMode)
        .step('See result with signup prompt', { resultShown: true, signupCta: true }, ctx => ctx.resultShown && ctx.signupCta)
        .step('Click signup CTA', { navigated: '/app/signup.html' }, ctx => ctx.url === '/app/signup.html')
        .step('Complete registration', { authenticated: true }, ctx => !!ctx.uid)
        .step('Previous result restored', { dataRestored: true }, ctx => ctx.previousResult)
    );

    // 6. SEO Landing → Tool → Share
    journeys.push(
      journey('SEO Landing to Share')
        .step('Land on SEO page', { url: '/app/tools/rate-calculator.html', referrer: 'google' }, ctx => ctx.url.includes('rate-calculator'))
        .step('Use calculator tool', { calculated: true }, ctx => ctx.hourlyRate > 0)
        .step('See share prompt', { shareVisible: true }, ctx => ctx.shareVisible)
        .step('Share via link', { linkGenerated: true }, ctx => ctx.shareUrl && ctx.shareUrl.startsWith('http'))
    );

    return journeys;
  }

  // ── Simulate running a journey (mock) ──
  async function runJourney(j, mockCtxSequence) {
    const steps = j.getSteps();
    const contexts = mockCtxSequence || [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      step.status = STATUS.RUNNING;
      const start = performance.now();
      try {
        const ctx = contexts[i] || {};
        const ok = step.assertFn(ctx);
        step.status = ok ? STATUS.PASSED : STATUS.FAILED;
        if (!ok) step.error = 'Assertion returned false';
      } catch (e) {
        step.status = STATUS.FAILED;
        step.error = e.message;
      }
      step.duration = Math.round(performance.now() - start);
      if (step.status === STATUS.FAILED) {
        // Skip remaining steps
        for (let k = i + 1; k < steps.length; k++) steps[k].status = STATUS.SKIPPED;
        break;
      }
    }
    return {
      name: j.name,
      steps,
      passed: steps.filter(s => s.status === STATUS.PASSED).length,
      failed: steps.filter(s => s.status === STATUS.FAILED).length,
      skipped: steps.filter(s => s.status === STATUS.SKIPPED).length,
      allPassed: steps.every(s => s.status === STATUS.PASSED)
    };
  }

  // ── Visual progress renderer ──
  function renderTestProgress(container, journeyResults) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    const totalSteps = journeyResults.reduce((s, j) => s + j.steps.length, 0);
    const passedSteps = journeyResults.reduce((s, j) => s + j.passed, 0);
    const allGreen = journeyResults.every(j => j.allPassed);

    const statusIcon = s => ({ passed: '✓', failed: '✗', skipped: '○', pending: '…', running: '►' }[s] || '?');
    const statusColor = s => ({ passed: '#22c55e', failed: '#ef4444', skipped: '#94a3b8', pending: '#64748b', running: '#3b82f6' }[s] || '#888');

    el.innerHTML = `
      <div style="font-family:var(--font-mono,'monospace');max-width:800px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:2px solid ${allGreen ? '#22c55e' : '#ef4444'}">
          <h2 style="margin:0;font-size:18px">E2E Test Progress</h2>
          <div style="font-size:13px">
            <span style="color:#22c55e">${passedSteps} passed</span> /
            <span>${totalSteps} total</span>
          </div>
        </div>

        <!-- Progress bar -->
        <div style="height:6px;background:#1e293b;border-radius:3px;margin:12px 0;overflow:hidden">
          <div style="height:100%;width:${Math.round((passedSteps / totalSteps) * 100)}%;background:${allGreen ? '#22c55e' : '#f59e0b'};transition:width .3s"></div>
        </div>

        ${journeyResults.map(j => `
          <div style="margin:20px 0;border:1px solid #334155;border-radius:8px;overflow:hidden">
            <div style="padding:12px 16px;background:#1e293b;display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:14px">${j.name}</span>
              <span style="font-size:12px;color:${j.allPassed ? '#22c55e' : '#ef4444'}">${j.allPassed ? 'PASSED' : 'FAILED'}</span>
            </div>
            <div style="padding:8px 16px">
              ${j.steps.map((s, idx) => `
                <div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid #1e293b">
                  <span style="color:${statusColor(s.status)};font-size:14px;width:16px;text-align:center;flex-shrink:0">${statusIcon(s.status)}</span>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;color:${s.status === 'skipped' ? '#64748b' : '#e2e8f0'}">
                      <span style="color:#64748b;margin-right:6px">${idx + 1}.</span>${s.label}
                    </div>
                    ${s.error ? `<div style="font-size:11px;color:#f87171;margin-top:2px">${s.error}</div>` : ''}
                  </div>
                  ${s.duration ? `<span style="font-size:11px;color:#64748b;flex-shrink:0">${s.duration}ms</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  NS.E2ETestSuite = { STATUS, journey, defineJourneys, runJourney, renderTestProgress };
})();
