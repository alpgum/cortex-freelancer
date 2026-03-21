# Dependency Audit — 2026-03-21

## Direct Dependencies

| Package | Version | Status |
|---|---|---|
| `express` | ^4.21.0 | OK — no known vulnerabilities |
| `firebase-admin` | ^13.7.0 | 8 low-severity transitive vulnerabilities (see below) |
| `stripe` | ^14.0.0 | OK — no known vulnerabilities |

## npm audit Results

```
8 low severity vulnerabilities
```

### Details

All 8 vulnerabilities are **low severity** and originate from a single transitive dependency chain:

- `@tootallnate/once` < 3.0.1 — Incorrect Control Flow Scoping
  - via `http-proxy-agent` → `teeny-request` → `@google-cloud/storage` → `firebase-admin`
  - via `google-gax` → `@google-cloud/firestore` → `firebase-admin`

### Risk Assessment

- **Severity**: Low
- **Exploitability**: Not directly exploitable in our server context
- **Impact**: The vulnerable code path is in the Google Cloud storage client HTTP proxy handling, which we do not use directly
- **Action**: Monitor for `firebase-admin` patch that updates the transitive dependency

### Fix Options

1. **Wait for upstream fix** — `firebase-admin` will likely update these transitives in a future release (recommended)
2. **Force fix** — `npm audit fix --force` would downgrade `firebase-admin` to v10.x (breaking change, not recommended)
3. **Override** — Add npm overrides in package.json for `@tootallnate/once` (may cause compatibility issues)

## Recommendation

No action required at this time. All vulnerabilities are low severity, not directly exploitable in our deployment context, and will be resolved by upstream updates. Re-run `npm audit` on next dependency update cycle.

## Next Audit

Schedule: Monthly or before each major release.
