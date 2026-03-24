# Cortex Freelancer — Sprint Progress

Updated: 2026-03-24

## Overall
- Total tasks in TASK_QUEUE_300.md: **300**
- Marked DONE (auto from git log): **223**
- Remaining: **77**

> DONE markers were applied by `scripts/mark_done_from_git.js` using git commit messages (supports CF-123 and CF-100→132 style ranges).

## Immediate next (first 30 pending in queue order)
- CF-054 Revenue by client pie chart
- CF-055 Earnings projection with trend analysis
- CF-057 Currency conversion for multi-currency earnings
- CF-168 Tool feedback widget to all tools
- CF-169 Tool sharing — shareable result links
- CF-172 Stripe Checkout session creation
- CF-173 Stripe webhook handler for subscription events
- CF-192 Downgrade flow + data retention
- CF-193 Payment receipt email via SendGrid
- CF-194 Stripe tax collection (EU/UK VAT)
- CF-195 Lifetime deal option
- CF-196 Checkout abandonment recovery email
- CF-204 Password reset flow
- CF-205 Fix Google Sign-in (Firebase handler)
- CF-206 Apple Sign-in provider
- CF-207 Auth session timeout
- CF-209 Account deletion flow
- CF-210 Data export (GDPR)
- CF-211 User onboarding wizard (3-step)
- CF-212 Role-based access (free/pro/admin)
- CF-214 Auth sync across browser tabs
- CF-215 Social login button styling consistency
- CF-216 Progressive auth (use tools first, prompt signup later)
- CF-217 User dashboard (activity overview)
- CF-218 Notification center
- CF-219 Preferences persistence in Firestore
- CF-223 Magic link login
- CF-224 Account linking (merge guest + registered)
- CF-225 Multi-device session management
- CF-226 Landing page hero A/B test

## Notes
- A large portion of remaining work clusters around **payments (Stripe), auth hardening, GDPR**, and **growth/landing experiments**.
- Next engineering emphasis should be: ship a stable onboarding→tool usage flow first, then payments.
