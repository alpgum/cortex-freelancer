# Payment Chase Automation (CFX-074)

A comprehensive payment chase automation system with:

- Configurable chase sequences
- Smart timing (day-of-week / time-of-day / client pattern based)
- Escalation levels (friendly → firm → formal → final → collections)
- Tone adaptation via templates
- Client intelligence (reliability scoring, late payment prediction)
- Analytics (recovery rates, days-to-payment, channel effectiveness)
- Pause/resume chasing (holidays, negotiations)
- Integration interfaces for Invoice System (CFX-056) and CRM (CFX-058)

## Structure

- `src/engine/` — chase engine + orchestrator
- `src/intelligence/` — smart timing + client profile analytics
- `src/templates/` — templates + renderer
- `src/integrations/` — provider interfaces + noop sender
- `src/analytics/` — reporting

## Quick Start (CLI)

From this folder:

```bash
npm install --no-package-lock
npm test
npm run build
node dist/cli.js init
```

### Tick automation using JSON fixtures

```bash
node dist/cli.js tick --invoices ./invoices.json --clients ./clients.json
```

Expected JSON shapes:
- `invoices.json`: array of invoices (with ISO strings for `issuedAt`, `dueDate`, `paidAt`)
- `clients.json`: array of clients

## Notes

This package ships with an `InMemoryStorage` (tests) and `FileStorage` (CLI). For production, replace storage and sender integrations.
