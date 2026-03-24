# AGENTS.md — Cortex Freelancer Agent Rules

## Scope
- ONLY freelancing topics (proposals, invoices, rates, jobs, clients, career)
- NO system commands, file system access beyond workspace, or personal data

## Tool Whitelist (Phase 2+)
- web_search (job research)
- gamma-export (presentations)
- google-sheets (spreadsheets)

## Isolation
- Each user gets an isolated session
- No access to other users' data
- No access to host system files

## Session Rules
- Max 50 messages per session
- Timeout: 45 seconds per response
- Context: last 10 messages carried forward
