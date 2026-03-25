# Productivity Metrics Dashboard (CFX-069)

Comprehensive productivity tracking and optimization for freelancers.

## Features

- **Productivity Scoring** (0-100) — daily/weekly/monthly composite score with 4 sub-scores
- **Revenue per Hour** — track across projects and clients
- **Task Velocity** — completion rate, estimation accuracy, trend detection
- **Focus Ratio** — focus vs admin vs meeting time analysis
- **Client Profitability** — rank clients by effective hourly rate (incl. overhead)
- **Benchmarking** — compare against personal goals, averages, and bests
- **AI Recommendations** — pattern-based suggestions (day-of-week, time-of-day, rate gaps, focus issues)
- **Trend Data** — structured chart-ready data for score, revenue, and focus trends

## CLI Commands

```bash
# Generate dashboard
npx ts-node index.ts dashboard --period weekly --date 2026-03-25

# Log time
npx ts-node index.ts log --date 2026-03-25 --start 09:00 --end 12:00 \
  --project proj-1 --client client-1 --type focus --desc "Development work"

# View productivity score
npx ts-node index.ts score --period daily

# Get recommendations
npx ts-node index.ts recommendations --period weekly

# Manage data
npx ts-node index.ts add-client --id c1 --name "Acme Corp" --rate 120
npx ts-node index.ts add-project --id p1 --name "Website" --client c1 --rate 120
npx ts-node index.ts add-task --project p1 --title "Build auth" --estimate 480
npx ts-node index.ts complete-task --project p1 --task task-xxx --actual 400

# Set goals
npx ts-node index.ts set-goal --name "Score Target" --metric productivity_score --target 80

# View trends (JSON)
npx ts-node index.ts trends --type score

# Seed sample data
npx ts-node index.ts seed
```

## Data Storage

All data stored as JSON in `data/productivity/`:
- `time-entries.json` — logged time entries
- `projects.json` — projects with tasks
- `clients.json` — client records
- `goals.json` — personal goals
- `score-history.json` — historical productivity scores

## Score Breakdown

| Component | Max | What it measures |
|-----------|-----|-----------------|
| Focus Time | 25 | % of time in deep work (target: 60%+) |
| Task Completion | 25 | Task done ratio across projects |
| Revenue Efficiency | 25 | $/hr effectiveness (target: $100/hr) |
| Consistency | 25 | Working days regularity |

## Testing

```bash
npm test
npm run test:coverage
```
