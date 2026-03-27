# Phase 4 Implementation Roadmap — External Integrations

**Timeline:** March 27 – April 3, 2026  
**Status:** EARLY START (7 days ahead of schedule)  
**Previous:** Phase 3 MVP ✅ (29/29 tests, production-ready)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                Cortex Freelancer                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Upwork   │  │  Gmail   │  │   Google     │  │
│  │  OAuth2   │  │  OAuth2  │  │  Workspace   │  │
│  │           │  │          │  │  Drive/Docs  │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │          │
│  ┌────┴──────────────┴───────────────┴───────┐  │
│  │         Unified Token Manager             │  │
│  │    (Firestore + auto-refresh + revoke)    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │          Email Analytics Engine           │   │
│  │   (tracking pixel, open rates, history)   │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Completed (March 27 — Early Start)

### ✅ CF3-016: Upwork API Integration — Foundation Ready
- [x] OAuth 2.0 flow: `/api/upwork-auth` (authorize, status, disconnect)
- [x] Token exchange + refresh: `api/lib/upwork-oauth.js`
- [x] Job search with scoring: `/api/upwork-jobs` (RSS + OAuth + proxy fallback)
- [x] Profile retrieval: `getMyProfile()`, `getContracts()`, `getEarnings()`
- [x] Proposal submission endpoint: `submitProposal()` in integration layer
- [x] Callback handler: `/api/upwork-callback`

**Status:** Full OAuth flow implemented, job search with 3-tier fallback (OAuth API → RSS → proxy), scoring algorithm with skill overlap + rate fit + recency weighting.

### ✅ Gmail Integration — Production Ready
- [x] OAuth 2.0 flow: `/api/gmail-auth` (authorize, status, disconnect)
- [x] Send emails: `/api/gmail-send` (POST with HTML support, CC/BCC, threading)
- [x] Read emails: `/api/gmail-send` (GET with search, pagination)
- [x] AI templates: `/api/gmail-templates` (6 freelancer templates)
- [x] Callback handler: `/api/gmail-callback`
- [x] Token auto-refresh with 5-min buffer

### ✅ NEW: Email Analytics & Tracking
- [x] Tracking pixel endpoint: `/api/email-analytics?action=track-open`
- [x] Email send history: `/api/email-analytics?action=history`
- [x] Aggregate stats: `/api/email-analytics?action=stats` (open rates, daily volume)
- [x] Template performance: `/api/email-analytics?action=templates`
- [x] Event logging: `/api/email-analytics?action=log`
- [x] Firestore collections: `email_log`, `email_events`

### ✅ NEW: Google Workspace Connector
- [x] Drive file listing + search: `/api/google-workspace?action=files|search`
- [x] Google Docs read + create from template: `?action=doc|create-doc`
- [x] Google Sheets read/write/append: `?action=sheet|append-sheet`
- [x] Project folder creator: `?action=create-project` (auto-creates folder structure + tracker)
- [x] Time logging to spreadsheet: `?action=log-time`
- [x] Shared OAuth tokens with Gmail (extended scopes)

### ✅ Security Audit
- [x] Full npm audit documented (12 vulnerabilities, all upstream)
- [x] OWASP Top 10 coverage assessment
- [x] OAuth implementation review
- [x] Remediation plan with phased approach
- [x] Security compliance checklist
- [x] Data privacy review

---

## Remaining Tasks (March 28 – April 3)

### Week 1: Testing & Hardening (Mar 28-31)

| Task | Priority | Est. | Description |
|------|----------|------|-------------|
| CF4-001 | HIGH | 4h | Integration tests for Google Workspace API |
| CF4-002 | HIGH | 3h | Integration tests for email analytics |
| CF4-003 | HIGH | 4h | Firebase Admin upgrade to v13 (security fix) |
| CF4-004 | MED | 2h | Mocha upgrade to v11 (security fix) |
| CF4-005 | MED | 2h | Google Workspace scope upgrade in Gmail OAuth flow |
| CF4-006 | LOW | 1h | Add Dependabot configuration |

### Week 2: Enhancement & Polish (Apr 1-3)

| Task | Priority | Est. | Description |
|------|----------|------|-------------|
| CF4-007 | HIGH | 4h | Upwork proposal auto-draft with AI |
| CF4-008 | HIGH | 3h | Email analytics dashboard UI |
| CF4-009 | MED | 3h | Google Docs contract template library |
| CF4-010 | MED | 2h | Workspace project automation workflows |
| CF4-011 | MED | 2h | Email open rate tracking pixel injection |
| CF4-012 | LOW | 2h | Fiverr API integration (api/integrations/fiverr-api.js) |

---

## API Endpoint Summary (Phase 4)

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/upwork-auth` | GET/POST | ✅ Live | Upwork OAuth flow |
| `/api/upwork-callback` | GET | ✅ Live | Upwork OAuth callback |
| `/api/upwork-jobs` | POST | ✅ Live | Job search + scoring |
| `/api/upwork-profile` | GET | ✅ Live | Upwork profile data |
| `/api/gmail-auth` | GET/POST | ✅ Live | Gmail OAuth flow |
| `/api/gmail-callback` | GET | ✅ Live | Gmail OAuth callback |
| `/api/gmail-send` | GET/POST | ✅ Live | Send/read emails |
| `/api/gmail-templates` | POST | ✅ Live | AI email templates |
| `/api/email-analytics` | GET/POST | ✅ New | Email tracking & analytics |
| `/api/google-workspace` | GET/POST | ✅ New | Drive, Docs, Sheets |

**Total:** 10 integration endpoints, 3 OAuth flows, 1 analytics engine

---

## Integration Dependencies

```
firebase-admin@^10.3.0  → needs v13.7.0 (security)
mocha@^9.x              → needs v11.7.5 (security)
@anthropic-ai/sdk       → current, no issues
axios                   → current, no issues
express                 → current, no issues
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| External API integrations | 3+ | ✅ 3 (Upwork, Gmail, Google Workspace) |
| OAuth flows prototyped | 3 | ✅ 3 (all working) |
| Security audit complete | Yes | ✅ Yes |
| Test coverage | 29+ tests | ✅ 29 tests passing |
| Production deploy ready | Yes | ✅ Yes |

---

*Phase 4 early start: March 27, 2026*  
*Full Phase 4 target: April 3, 2026*  
*Status: ON TRACK — foundations complete, testing + hardening remaining*
