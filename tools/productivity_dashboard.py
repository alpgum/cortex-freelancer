#!/usr/bin/env python3
"""
Productivity Dashboard Generator (CFX-057b)

Generates an interactive HTML dashboard from time tracking data with:
- Weekly/monthly productivity heatmaps
- Revenue vs hours visualization
- Client profitability ranking
- Focus time analysis
- Burnout risk indicator
- Exportable reports

Usage:
    python productivity_dashboard.py generate [--period weekly|monthly|quarterly]
    python productivity_dashboard.py summary
    python productivity_dashboard.py export --format html|json|csv
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any
from pathlib import Path
from collections import defaultdict
import statistics

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_DIR = Path(os.environ.get("CORTEX_DATA_DIR", Path.home() / ".cortex-freelancer"))
TIME_DATA_FILE = DATA_DIR / "time_entries.json"
DASHBOARD_OUTPUT = DATA_DIR / "dashboard.html"


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_time_entries() -> List[Dict]:
    """Load time entries from the time tracker data file."""
    if TIME_DATA_FILE.exists():
        with open(TIME_DATA_FILE) as f:
            data = json.load(f)
            return data.get("entries", data if isinstance(data, list) else [])
    return _generate_sample_data()


def _generate_sample_data() -> List[Dict]:
    """Generate realistic sample data for demo/testing."""
    import random
    projects = [
        ("Acme Corp Website", 85.0, "Acme Corp"),
        ("Logo Redesign", 120.0, "StartupXYZ"),
        ("API Integration", 95.0, "TechFlow"),
        ("Content Writing", 60.0, "BlogMaster"),
        ("Mobile App UI", 110.0, "AppVenture"),
    ]
    tasks = ["Development", "Design", "Research", "Meetings", "Code Review", "Testing", "Documentation"]
    entries = []
    now = datetime.now()

    for day_offset in range(90):
        d = now - timedelta(days=day_offset)
        if d.weekday() >= 6:  # Skip some Sundays
            if random.random() < 0.7:
                continue
        num_entries = random.randint(1, 4)
        hour = random.randint(8, 10)
        for _ in range(num_entries):
            proj, rate, client = random.choice(projects)
            dur = random.uniform(0.5, 3.5)
            start = d.replace(hour=hour, minute=random.randint(0, 59))
            end = start + timedelta(hours=dur)
            entries.append({
                "id": f"entry-{len(entries)}",
                "project": proj,
                "client": client,
                "task": random.choice(tasks),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "duration_hours": round(dur, 2),
                "hourly_rate": rate,
                "is_billable": random.random() > 0.15,
                "tags": random.sample(["focus", "deep-work", "admin", "creative", "collab"], k=random.randint(0, 2)),
            })
            hour = min(23, hour + int(dur) + 1)
    return entries


# ---------------------------------------------------------------------------
# Analytics Engine
# ---------------------------------------------------------------------------

class ProductivityAnalyzer:
    """Analyze time entries for productivity insights."""

    def __init__(self, entries: List[Dict]):
        self.entries = entries
        self._parse_dates()

    def _parse_dates(self):
        for e in self.entries:
            if isinstance(e.get("start_time"), str):
                e["_start"] = datetime.fromisoformat(e["start_time"])
            if isinstance(e.get("end_time"), str):
                e["_end"] = datetime.fromisoformat(e["end_time"])

    def weekly_summary(self, weeks: int = 4) -> List[Dict]:
        """Get weekly productivity summaries."""
        now = datetime.now()
        summaries = []
        for w in range(weeks):
            week_start = now - timedelta(days=now.weekday() + 7 * w)
            week_start = week_start.replace(hour=0, minute=0, second=0)
            week_end = week_start + timedelta(days=7)
            week_entries = [e for e in self.entries
                           if e.get("_start") and week_start <= e["_start"] < week_end]
            total_hours = sum(e.get("duration_hours", 0) for e in week_entries)
            billable = sum(e.get("duration_hours", 0) for e in week_entries if e.get("is_billable"))
            revenue = sum(e.get("duration_hours", 0) * e.get("hourly_rate", 0)
                          for e in week_entries if e.get("is_billable"))
            summaries.append({
                "week_start": week_start.strftime("%Y-%m-%d"),
                "total_hours": round(total_hours, 1),
                "billable_hours": round(billable, 1),
                "billable_ratio": round(billable / total_hours * 100, 1) if total_hours > 0 else 0,
                "revenue": round(revenue, 2),
                "entry_count": len(week_entries),
                "avg_session": round(total_hours / len(week_entries), 2) if week_entries else 0,
            })
        return summaries

    def hourly_heatmap(self) -> Dict[str, Dict[int, float]]:
        """Hours worked by day-of-week and hour-of-day."""
        heatmap = {day: {h: 0.0 for h in range(24)} for day in
                   ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for e in self.entries:
            if not e.get("_start"):
                continue
            day = day_names[e["_start"].weekday()]
            hour = e["_start"].hour
            heatmap[day][hour] += e.get("duration_hours", 0)
        return heatmap

    def client_profitability(self) -> List[Dict]:
        """Rank clients by profitability."""
        clients = defaultdict(lambda: {"hours": 0, "revenue": 0, "entries": 0, "projects": set()})
        for e in self.entries:
            client = e.get("client", e.get("project", "Unknown"))
            clients[client]["hours"] += e.get("duration_hours", 0)
            if e.get("is_billable"):
                clients[client]["revenue"] += e.get("duration_hours", 0) * e.get("hourly_rate", 0)
            clients[client]["entries"] += 1
            clients[client]["projects"].add(e.get("project", ""))

        result = []
        for name, data in clients.items():
            eff_rate = data["revenue"] / data["hours"] if data["hours"] > 0 else 0
            result.append({
                "client": name,
                "hours": round(data["hours"], 1),
                "revenue": round(data["revenue"], 2),
                "effective_rate": round(eff_rate, 2),
                "projects": len(data["projects"]),
                "entries": data["entries"],
            })
        return sorted(result, key=lambda x: x["effective_rate"], reverse=True)

    def focus_analysis(self) -> Dict:
        """Analyze focus patterns and deep work sessions."""
        durations = [e.get("duration_hours", 0) for e in self.entries if e.get("duration_hours", 0) > 0]
        deep_work = [d for d in durations if d >= 2.0]
        shallow = [d for d in durations if d < 0.5]
        return {
            "total_sessions": len(durations),
            "avg_session_length": round(statistics.mean(durations), 2) if durations else 0,
            "median_session": round(statistics.median(durations), 2) if durations else 0,
            "deep_work_sessions": len(deep_work),
            "deep_work_pct": round(len(deep_work) / len(durations) * 100, 1) if durations else 0,
            "shallow_sessions": len(shallow),
            "longest_session": round(max(durations), 2) if durations else 0,
            "focus_score": min(100, round(
                (len(deep_work) / max(len(durations), 1)) * 50 +
                (statistics.mean(durations) if durations else 0) * 20, 1
            )),
        }

    def burnout_risk(self) -> Dict:
        """Calculate burnout risk based on work patterns."""
        now = datetime.now()
        last_14 = [e for e in self.entries
                   if e.get("_start") and (now - e["_start"]).days <= 14]
        daily_hours = defaultdict(float)
        for e in last_14:
            day = e["_start"].date().isoformat()
            daily_hours[day] += e.get("duration_hours", 0)

        hours_list = list(daily_hours.values()) if daily_hours else [0]
        avg_daily = statistics.mean(hours_list)
        max_daily = max(hours_list)
        days_over_8 = sum(1 for h in hours_list if h > 8)
        weekend_work = sum(1 for e in last_14
                          if e.get("_start") and e["_start"].weekday() >= 5)

        risk_score = min(100, round(
            (avg_daily / 10) * 30 +
            (max_daily / 14) * 20 +
            (days_over_8 / 14) * 30 +
            (weekend_work / max(len(last_14), 1)) * 20
        ))

        if risk_score < 30:
            level, advice = "Low 🟢", "Healthy work patterns. Keep it up!"
        elif risk_score < 60:
            level, advice = "Moderate 🟡", "Watch your hours. Schedule breaks and protect weekends."
        elif risk_score < 80:
            level, advice = "High 🟠", "You're overworking. Take a day off soon and reduce daily hours."
        else:
            level, advice = "Critical 🔴", "Burnout imminent. Stop, rest, and restructure your workload."

        return {
            "risk_score": risk_score,
            "risk_level": level,
            "avg_daily_hours": round(avg_daily, 1),
            "max_daily_hours": round(max_daily, 1),
            "days_over_8h": days_over_8,
            "weekend_sessions": weekend_work,
            "advice": advice,
        }


# ---------------------------------------------------------------------------
# Dashboard HTML Generator
# ---------------------------------------------------------------------------

def generate_dashboard_html(analyzer: ProductivityAnalyzer, period: str = "monthly") -> str:
    """Generate a complete interactive HTML dashboard."""
    weeks = {"weekly": 1, "monthly": 4, "quarterly": 13}.get(period, 4)
    weekly = analyzer.weekly_summary(weeks)
    heatmap = analyzer.hourly_heatmap()
    clients = analyzer.client_profitability()
    focus = analyzer.focus_analysis()
    burnout = analyzer.burnout_risk()

    total_revenue = sum(w["revenue"] for w in weekly)
    total_hours = sum(w["total_hours"] for w in weekly)
    avg_rate = total_revenue / total_hours if total_hours > 0 else 0

    # Build heatmap data for JS
    heatmap_data = []
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for di, day in enumerate(days):
        for h in range(24):
            val = round(heatmap[day][h], 2)
            if val > 0:
                heatmap_data.append({"day": di, "hour": h, "value": val})

    client_labels = json.dumps([c["client"][:15] for c in clients[:8]])
    client_revenue = json.dumps([c["revenue"] for c in clients[:8]])
    client_rates = json.dumps([c["effective_rate"] for c in clients[:8]])

    week_labels = json.dumps([w["week_start"] for w in reversed(weekly)])
    week_hours = json.dumps([w["total_hours"] for w in reversed(weekly)])
    week_revenue = json.dumps([w["revenue"] for w in reversed(weekly)])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cortex Freelancer — Productivity Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  :root {{
    --bg: #0a0a0f; --card: #12121a; --border: #1e1e2e;
    --text: #e0e0e0; --muted: #888; --accent: #6c5ce7;
    --green: #00b894; --yellow: #fdcb6e; --red: #e17055; --blue: #74b9ff;
  }}
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: var(--bg); color: var(--text); padding: 24px; }}
  .header {{ text-align:center; margin-bottom:32px; }}
  .header h1 {{ font-size:28px; font-weight:700; }}
  .header p {{ color: var(--muted); margin-top:4px; }}
  .grid {{ display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:16px; margin-bottom:24px; }}
  .card {{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; }}
  .card h3 {{ font-size:13px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }}
  .card .value {{ font-size:32px; font-weight:700; }}
  .card .sub {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  .chart-card {{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px; }}
  .chart-card h2 {{ font-size:16px; margin-bottom:16px; }}
  .two-col {{ display:grid; grid-template-columns:1fr 1fr; gap:24px; }}
  @media(max-width:768px) {{ .two-col {{ grid-template-columns:1fr; }} }}
  .heatmap {{ display:grid; grid-template-columns: 40px repeat(24,1fr); gap:2px; font-size:11px; }}
  .heatmap .label {{ display:flex; align-items:center; color:var(--muted); }}
  .heatmap .cell {{ aspect-ratio:1; border-radius:3px; min-height:16px; }}
  .burnout {{ padding:20px; border-radius:12px; text-align:center; }}
  .burnout .score {{ font-size:48px; font-weight:800; }}
  table {{ width:100%; border-collapse:collapse; font-size:14px; }}
  th {{ text-align:left; color:var(--muted); padding:8px; border-bottom:1px solid var(--border); }}
  td {{ padding:8px; border-bottom:1px solid var(--border); }}
  .bar {{ height:6px; border-radius:3px; background:var(--accent); }}
</style>
</head>
<body>
<div class="header">
  <h1>⚡ Productivity Dashboard</h1>
  <p>Cortex Freelancer — {period.title()} Overview • Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
</div>

<div class="grid">
  <div class="card">
    <h3>Total Revenue</h3>
    <div class="value" style="color:var(--green)">${total_revenue:,.0f}</div>
    <div class="sub">{period} period</div>
  </div>
  <div class="card">
    <h3>Hours Worked</h3>
    <div class="value">{total_hours:.0f}h</div>
    <div class="sub">{total_hours/max(weeks,1):.1f}h avg/week</div>
  </div>
  <div class="card">
    <h3>Effective Rate</h3>
    <div class="value" style="color:var(--blue)">${avg_rate:.0f}/hr</div>
    <div class="sub">across all clients</div>
  </div>
  <div class="card">
    <h3>Focus Score</h3>
    <div class="value" style="color:var(--accent)">{focus['focus_score']}/100</div>
    <div class="sub">{focus['deep_work_sessions']} deep work sessions</div>
  </div>
</div>

<div class="two-col">
  <div class="chart-card">
    <h2>📈 Weekly Revenue & Hours</h2>
    <canvas id="weeklyChart"></canvas>
  </div>
  <div class="chart-card">
    <h2>💰 Client Profitability</h2>
    <canvas id="clientChart"></canvas>
  </div>
</div>

<div class="chart-card">
  <h2>🔥 Work Heatmap (hours by day & time)</h2>
  <div class="heatmap" id="heatmap"></div>
</div>

<div class="two-col">
  <div class="chart-card">
    <h2>🧠 Focus Analysis</h2>
    <table>
      <tr><td>Avg Session</td><td><strong>{focus['avg_session_length']}h</strong></td></tr>
      <tr><td>Deep Work %</td><td><strong>{focus['deep_work_pct']}%</strong></td></tr>
      <tr><td>Longest Session</td><td><strong>{focus['longest_session']}h</strong></td></tr>
      <tr><td>Total Sessions</td><td><strong>{focus['total_sessions']}</strong></td></tr>
    </table>
  </div>
  <div class="chart-card burnout" style="background:{'#1a2e1a' if burnout['risk_score']<30 else '#2e2a1a' if burnout['risk_score']<60 else '#2e1a1a'}">
    <h2>🫀 Burnout Risk</h2>
    <div class="score">{burnout['risk_score']}</div>
    <div style="font-size:18px;margin:8px 0">{burnout['risk_level']}</div>
    <div style="color:var(--muted);font-size:14px">{burnout['advice']}</div>
    <div style="margin-top:12px;font-size:13px;color:var(--muted)">
      Avg {burnout['avg_daily_hours']}h/day • Max {burnout['max_daily_hours']}h • {burnout['days_over_8h']} days &gt;8h
    </div>
  </div>
</div>

<div class="chart-card">
  <h2>🏆 Client Rankings</h2>
  <table>
    <thead><tr><th>Client</th><th>Hours</th><th>Revenue</th><th>Eff. Rate</th><th>Projects</th></tr></thead>
    <tbody>
    {''.join(f'<tr><td>{c["client"]}</td><td>{c["hours"]}h</td><td>${c["revenue"]:,.0f}</td><td>${c["effective_rate"]:.0f}/hr</td><td>{c["projects"]}</td></tr>' for c in clients[:10])}
    </tbody>
  </table>
</div>

<script>
const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
new Chart(weeklyCtx, {{
  type:'bar',
  data: {{
    labels: {week_labels},
    datasets: [
      {{ label:'Revenue ($)', data:{week_revenue}, backgroundColor:'rgba(108,92,231,0.7)', yAxisID:'y' }},
      {{ label:'Hours', data:{week_hours}, type:'line', borderColor:'#00b894', yAxisID:'y1', tension:0.3 }}
    ]
  }},
  options: {{
    responsive:true,
    scales: {{
      y: {{ position:'left', ticks:{{color:'#888'}}, grid:{{color:'#1e1e2e'}} }},
      y1: {{ position:'right', ticks:{{color:'#888'}}, grid:{{display:false}} }},
      x: {{ ticks:{{color:'#888'}}, grid:{{color:'#1e1e2e'}} }}
    }},
    plugins: {{ legend:{{ labels:{{color:'#ccc'}} }} }}
  }}
}});

const clientCtx = document.getElementById('clientChart').getContext('2d');
new Chart(clientCtx, {{
  type:'bar',
  data: {{
    labels: {client_labels},
    datasets: [
      {{ label:'Revenue ($)', data:{client_revenue}, backgroundColor:'rgba(116,185,255,0.7)' }},
      {{ label:'Eff. Rate ($/hr)', data:{client_rates}, type:'line', borderColor:'#fdcb6e', tension:0.3 }}
    ]
  }},
  options: {{
    responsive:true, indexAxis:'y',
    scales: {{
      x: {{ ticks:{{color:'#888'}}, grid:{{color:'#1e1e2e'}} }},
      y: {{ ticks:{{color:'#888'}}, grid:{{color:'#1e1e2e'}} }}
    }},
    plugins: {{ legend:{{ labels:{{color:'#ccc'}} }} }}
  }}
}});

// Heatmap
const heatmapData = {json.dumps(heatmap_data)};
const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const heatEl = document.getElementById('heatmap');
const maxVal = Math.max(...heatmapData.map(d=>d.value), 1);
// Hour headers
heatEl.innerHTML = '<div></div>' + Array.from({{length:24}},(_,i)=>`<div class="label" style="justify-content:center">${{i}}</div>`).join('');
days.forEach((day,di) => {{
  heatEl.innerHTML += `<div class="label">${{day}}</div>`;
  for(let h=0;h<24;h++) {{
    const entry = heatmapData.find(d=>d.day===di && d.hour===h);
    const val = entry ? entry.value : 0;
    const intensity = val / maxVal;
    const bg = val > 0 ? `rgba(108,92,231,${{0.15 + intensity*0.85}})` : 'rgba(255,255,255,0.03)';
    heatEl.innerHTML += `<div class="cell" style="background:${{bg}}" title="${{day}} ${{h}}:00 — ${{val.toFixed(1)}}h"></div>`;
  }}
}});
</script>
</body>
</html>"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_generate(args):
    entries = load_time_entries()
    analyzer = ProductivityAnalyzer(entries)
    html = generate_dashboard_html(analyzer, args.period)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    output = Path(args.output) if args.output else DASHBOARD_OUTPUT
    output.write_text(html)
    print(f"✅ Dashboard generated: {output}")
    print(f"   Period: {args.period} | Entries: {len(entries)}")
    return str(output)


def cmd_summary(args):
    entries = load_time_entries()
    analyzer = ProductivityAnalyzer(entries)
    weekly = analyzer.weekly_summary(4)
    focus = analyzer.focus_analysis()
    burnout = analyzer.burnout_risk()
    clients = analyzer.client_profitability()

    print("=" * 60)
    print("⚡ CORTEX FREELANCER — PRODUCTIVITY SUMMARY")
    print("=" * 60)
    print(f"\n📊 Last 4 Weeks:")
    for w in weekly:
        print(f"  {w['week_start']}: {w['total_hours']}h worked, ${w['revenue']:,.0f} earned, {w['billable_ratio']}% billable")
    print(f"\n🧠 Focus: {focus['focus_score']}/100 (avg {focus['avg_session_length']}h sessions, {focus['deep_work_pct']}% deep work)")
    print(f"🫀 Burnout Risk: {burnout['risk_level']} ({burnout['risk_score']}/100)")
    print(f"   → {burnout['advice']}")
    print(f"\n💰 Top Clients:")
    for c in clients[:5]:
        print(f"  {c['client']}: ${c['revenue']:,.0f} ({c['hours']}h @ ${c['effective_rate']:.0f}/hr)")


def cmd_export(args):
    entries = load_time_entries()
    analyzer = ProductivityAnalyzer(entries)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if args.format == "html":
        return cmd_generate(argparse.Namespace(period="monthly", output=args.output))
    elif args.format == "json":
        data = {
            "generated": datetime.now().isoformat(),
            "weekly": analyzer.weekly_summary(4),
            "clients": analyzer.client_profitability(),
            "focus": analyzer.focus_analysis(),
            "burnout": analyzer.burnout_risk(),
        }
        out = Path(args.output) if args.output else DATA_DIR / "productivity_export.json"
        out.write_text(json.dumps(data, indent=2))
        print(f"✅ Exported to {out}")
    elif args.format == "csv":
        import csv
        out = Path(args.output) if args.output else DATA_DIR / "time_entries.csv"
        with open(out, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["project", "client", "task", "start_time", "end_time", "duration_hours", "hourly_rate", "is_billable"])
            writer.writeheader()
            for e in entries:
                writer.writerow({k: e.get(k, "") for k in writer.fieldnames})
        print(f"✅ Exported {len(entries)} entries to {out}")


def main():
    parser = argparse.ArgumentParser(description="Cortex Freelancer Productivity Dashboard")
    sub = parser.add_subparsers(dest="command")

    gen = sub.add_parser("generate", help="Generate HTML dashboard")
    gen.add_argument("--period", choices=["weekly", "monthly", "quarterly"], default="monthly")
    gen.add_argument("--output", help="Output file path")
    gen.set_defaults(func=cmd_generate)

    summ = sub.add_parser("summary", help="Print productivity summary")
    summ.set_defaults(func=cmd_summary)

    exp = sub.add_parser("export", help="Export data")
    exp.add_argument("--format", choices=["html", "json", "csv"], default="json")
    exp.add_argument("--output", help="Output file path")
    exp.set_defaults(func=cmd_export)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
