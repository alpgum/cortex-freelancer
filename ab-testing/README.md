# CFX-044 — A/B Testing (client-side)

Lightweight, deterministic A/B assignment for Cortex Freelancer web chat + connection methods.

## What’s included

- Deterministic hashing assignment (same user → same variant)
- Experiment registry (transport + UI)
- Feature-flag style forcing (query params or localStorage)
- Client-side metrics collector (success, error, latency)
- Local results dashboard: `ab-results.html`

## Files

- `ab-testing/` (Node/CommonJS module, useful for server-side or tests)
- `public/ab-testing/cortex-ab.js` (browser bundle, no build step)
- `ab-results.html` (results viewer)

## Experiments

Defined in:

- `ab-testing/experiments.js` (source of truth)

Current experiments:

- `transport_method_v1`: `sse | polling | socketio | ws`
- `chat_ui_v1`: `control | compact | loading_skeleton`

Weights are percentages via `weight`.

## Assignment rules

- A stable **AB user id** is stored in `localStorage` key: `cfx_ab_user_id`
- A stable assignment map is stored in: `cfx_ab_assigned`
- Deterministic hash seed: `salt + experimentKey + userId`

If you clear site storage, assignments will change.

## Forcing variants (feature flags)

### URL query override (highest priority)

Format:

- `?ab_<experimentKey>=<variantKey>`

Example:

- `/?ab_transport_method_v1=polling`
- `/?ab_chat_ui_v1=loading_skeleton`

### LocalStorage forced map

You can force via JS:

```js
CortexABTesting.forceVariant('transport_method_v1', 'sse');
CortexABTesting.forceVariant('chat_ui_v1', 'compact');
```

Clear forces:

```js
CortexABTesting.clearForces();
```

## Metrics

Metrics are stored locally (bounded to 2000 events) in:

- `localStorage['cfx_ab_metrics_v1']`

Primary helper:

```js
CortexABMetrics.recordTransportEvent({
  name: 'job_completed',
  transport: 'sse',
  ok: true,
  latencyMs: 123
});
```

Aggregation (used by the dashboard):

```js
CortexABMetrics.aggregate();
```

## Integration point

`src/redis-queue/client-adapter.js` now supports:

- `transport: 'auto' | 'sse' | 'polling' | 'socketio' | 'ws'`

If `transport === 'auto'` and `window.CortexABTesting` is present, it will use:

- `CortexABTesting.getVariant('transport_method_v1')`

and record basic setup/job metrics via `window.CortexABMetrics`.

## Results dashboard

Open:

- `/ab-results.html`

This shows *this browser’s* metrics only.

## Notes / limitations

- `socketio` and `ws` transports are **best-effort** and will automatically fall back to SSE/polling if client/server support is missing.
- If you want team-wide stats, add a server endpoint (e.g. `/api/ab/metric`) and have `recordTransportEvent` POST/`sendBeacon` there.
