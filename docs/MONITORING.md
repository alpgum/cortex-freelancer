# Monitoring Setup — Cortex Freelancer

## Health Endpoint

**URL:** `https://cortexfreelancer.com/api/health`
**Method:** GET
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-21T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 12345.67,
  "checks": {
    "firestore": "ok",
    "stripe": "configured",
    "openai": "configured"
  }
}
```

**Status values:**
- `ok` — all dependency checks pass
- `degraded` — one or more checks failing (Firestore down or Stripe key missing)

**Dependency checks:**
| Check     | What it does                                  | Healthy value  |
|-----------|-----------------------------------------------|----------------|
| firestore | Writes a ping doc to `_health` collection     | `ok`           |
| stripe    | Verifies `STRIPE_SECRET_KEY` env var is set    | `configured`   |
| openai    | Verifies `OPENAI_API_KEY` env var is set       | `configured`   |

## UptimeRobot Configuration

### Monitor 1 — Homepage

| Setting       | Value                              |
|---------------|------------------------------------|
| Monitor Type  | HTTP(s)                            |
| Friendly Name | Cortex Freelancer — Homepage       |
| URL           | `https://cortexfreelancer.com`     |
| Interval      | 5 minutes                          |
| Alert Contact | Team email / Slack webhook         |

### Monitor 2 — Health API

| Setting        | Value                                      |
|----------------|--------------------------------------------|
| Monitor Type   | HTTP(s) — Keyword                          |
| Friendly Name  | Cortex Freelancer — API Health             |
| URL            | `https://cortexfreelancer.com/api/health`  |
| Interval       | 5 minutes                                  |
| Keyword Type   | Keyword exists                             |
| Keyword Value  | `"status":"ok"`                            |
| Alert Contact  | Team email / Slack webhook                 |

### Setup Steps

1. Sign in at [uptimerobot.com](https://uptimerobot.com) (free tier supports 50 monitors).
2. Click **+ Add New Monitor** and enter the settings from Monitor 1.
3. Repeat for Monitor 2 — use **Keyword** type so it validates the JSON body, not just HTTP 200.
4. Under **My Settings → Alert Contacts**, add a Slack webhook or email for notifications.
5. Optionally enable the public status page and link it from your docs or footer.

### Alert Escalation

| Severity | Condition                         | Action                        |
|----------|-----------------------------------|-------------------------------|
| Warning  | Response time > 3 s               | Slack notification            |
| Critical | Down for 2 consecutive checks     | Slack + email to on-call      |

## Verifying Locally

```bash
curl -s https://cortexfreelancer.com/api/health | jq .
```

Expected: `status` field equals `"ok"`.
