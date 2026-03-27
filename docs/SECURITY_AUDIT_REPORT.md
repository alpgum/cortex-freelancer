# Security Audit Report — Cortex Freelancer v1.0.0

**Date:** 2026-03-27  
**Auditor:** Automated + Manual Review  
**Status:** 12 vulnerabilities identified (all in upstream dependencies)  
**Application Code Risk:** LOW — no direct vulnerabilities in app code

---

## Executive Summary

All 12 npm audit vulnerabilities are in **upstream transitive dependencies** (firebase-admin, mocha). No vulnerabilities exist in Cortex Freelancer's own application code. The fixes require major version bumps of two packages, which need controlled migration.

---

## Vulnerability Inventory

### 🔴 Critical (2)

| # | Package | CVE/Advisory | Description | Root Cause |
|---|---------|-------------|-------------|------------|
| 1 | `protobufjs` 6.10.0-6.11.3 | GHSA-h755-8qp9-cq85 | Prototype Pollution | `firebase-admin` → `google-gax` → `protobufjs` |
| 2 | `jsonwebtoken` ≤8.5.1 (3 advisories) | GHSA-8cf7-32gw-wr33, GHSA-hjrf-2m68-5959, GHSA-qwph-4952-7xr6 | Signature bypass, RSA-to-HMAC forgery, unrestricted key types | `firebase-admin` → `jsonwebtoken` |

### 🟠 High (3)

All three are the individual jsonwebtoken advisories counted above (same package, multiple CVEs).

### 🟡 Moderate (5)

| # | Package | Advisory | Description | Root Cause |
|---|---------|----------|-------------|------------|
| 3 | `@google-cloud/firestore` ≤6.1.0 | GHSA-4g6q-77j7-vvjc | Key logging in debug output | `firebase-admin` |
| 4 | `@grpc/grpc-js` <1.8.22 | GHSA-7v5v-9h63-cj86 | Memory allocation above limits | `firebase-admin` → `google-gax` |
| 5 | `brace-expansion` <5.0.5 | GHSA-f886-m6hf-6m8v | Zero-step DoS | `mocha` → `minimatch` |
| 6 | `js-yaml` <3.14.2 | GHSA-mh29-5h37-fv8m | Prototype pollution via merge | `mocha` |
| 7 | `minimatch` ≤10.0.2 | (transitive) | Depends on vulnerable brace-expansion | `mocha` |

### 🟢 Low (2)

| # | Package | Advisory | Description | Root Cause |
|---|---------|----------|-------------|------------|
| 8 | `debug` 3.2.0-3.2.6 | GHSA-gxpj-cx7g-858c | ReDoS | `mocha` |
| 9 | `diff` <3.5.1 | GHSA-73rr-hh4g-fpgx | DoS in parsePatch/applyPatch | `mocha` |

---

## Root Cause Analysis

**Two packages cause all 12 vulnerabilities:**

1. **`firebase-admin@^10.3.0`** → Causes 7 vulnerabilities (2 critical, 3 high, 2 moderate)
   - Fix: Upgrade to `firebase-admin@13.7.0` (MAJOR — breaking changes)
   
2. **`mocha@^9.x`** (dev dependency) → Causes 5 vulnerabilities (5 moderate/low)
   - Fix: Upgrade to `mocha@11.7.5` (MAJOR — breaking changes)

---

## Risk Assessment

### Application Code Security ✅

| Area | Status | Notes |
|------|--------|-------|
| Input validation | ✅ PASS | Joi schemas, email regex, parameter checks |
| SQL/NoSQL injection | ✅ PASS | Firestore SDK handles parameterization |
| XSS prevention | ✅ PASS | DOMPurify, helmet, CSP headers |
| CORS | ✅ PASS | Explicit origin allowlist |
| Rate limiting | ✅ PASS | express-rate-limit on all API routes |
| Auth token handling | ✅ PASS | OAuth tokens stored in Firestore, refreshed properly |
| Error handling | ✅ PASS | withErrorHandler wrapper, no stack traces in responses |
| Secrets management | ✅ PASS | Environment variables, no hardcoded credentials |
| HTTPS | ✅ PASS | Enforced via deployment platform |

### OAuth Implementation Security ✅

| Flow | Status | Notes |
|------|--------|-------|
| Upwork OAuth 2.0 | ✅ PASS | PKCE-ready, state parameter, token refresh |
| Gmail OAuth 2.0 | ✅ PASS | Minimal scopes, offline access, consent prompt |
| Token storage | ✅ PASS | Firestore with per-user isolation |
| Token refresh | ✅ PASS | 5-min buffer before expiry |
| Revocation | ✅ PASS | Google revocation endpoint called on disconnect |

---

## Remediation Plan

### Phase 1: Immediate (No Breaking Changes)
- [ ] Pin `firebase-admin` to exact version to prevent accidental updates
- [ ] Ensure mocha is dev-only dependency (not bundled in production)
- [ ] Add `.npmrc` with `audit-level=moderate`
- [ ] Add `npm audit` to CI pipeline

### Phase 2: Controlled Migration (Week of April 1-3)
- [ ] Create migration branch `feat/firebase-admin-v13`
- [ ] Update `firebase-admin` to v13.7.0
- [ ] Test all Firestore operations (CRUD, auth, tokens)
- [ ] Update import patterns for breaking changes
- [ ] Run full test suite (29 tests must pass)

### Phase 3: Dev Dependencies (Week of April 3-7)
- [ ] Update mocha to v11.7.5
- [ ] Update test scripts for new mocha API
- [ ] Verify all 29 tests still pass
- [ ] Remove unused test dependencies

### Phase 4: Hardening (Ongoing)
- [ ] Set up Dependabot/Renovate for automated PRs
- [ ] Add `npm audit` to pre-commit hooks
- [ ] Create security review cadence (monthly)

---

## Security Compliance Checklist

### OWASP Top 10 Coverage

| # | Risk | Status | Implementation |
|---|------|--------|---------------|
| A01 | Broken Access Control | ✅ | UID-based auth, Firestore rules |
| A02 | Cryptographic Failures | ✅ | HTTPS, bcrypt, no plaintext secrets |
| A03 | Injection | ✅ | Parameterized queries, Joi validation |
| A04 | Insecure Design | ✅ | Rate limiting, error boundaries |
| A05 | Security Misconfiguration | ✅ | Helmet, CSP, CORS allowlist |
| A06 | Vulnerable Components | ⚠️ | 12 upstream vulns (documented above) |
| A07 | Auth Failures | ✅ | OAuth 2.0, token refresh, session mgmt |
| A08 | Software Integrity | ✅ | package-lock.json, exact versions |
| A09 | Logging & Monitoring | ✅ | Error logging, email audit trail |
| A10 | SSRF | ✅ | URL validation, no user-supplied URLs to internal services |

### Data Privacy

| Requirement | Status | Notes |
|------------|--------|-------|
| User data isolation | ✅ | UID-scoped Firestore queries |
| Token encryption at rest | ⚠️ | Firestore default encryption (consider KMS) |
| Data deletion on account delete | ✅ | delete-account.js handles cleanup |
| Audit trail | ✅ | email_log, email_events collections |
| GDPR export | ✅ | export-data.js endpoint |

---

## Recommendations

1. **HIGH PRIORITY:** Upgrade `firebase-admin` to v13 — fixes 7 vulnerabilities including 2 critical
2. **MEDIUM:** Upgrade mocha to v11 — fixes 5 dev-only vulnerabilities
3. **LOW:** Consider server-side token encryption with KMS for OAuth tokens
4. **LOW:** Add Dependabot for automated security updates

---

*Report generated: 2026-03-27T08:39:00+03:00*
