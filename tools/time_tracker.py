#!/usr/bin/env python3
"""
Time Tracking with Productivity Analytics and Optimization Suggestions

A comprehensive time tracking and productivity analytics system for freelancers featuring:
- Multi-project timer management with context switching support
- Productivity analytics with actionable insights
- Smart optimization suggestions based on work patterns
- Session persistence and comprehensive reporting

Usage:
    python time_tracker.py start "Web Development" "Frontend Refactoring"
    python time_tracker.py stop
    python time_tracker.py log 2.5 "Web Development" "Code Review"
    python time_tracker.py status
    python time_tracker.py report daily
    python time_tracker.py analytics
    python time_tracker.py optimize
"""

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import statistics


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class TimeEntry:
    """Individual time entry record"""
    id: str
    project: str
    task: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int = 0
    entry_type: str = "timer"  # timer, manual, import
    tags: List[str] = field(default_factory=list)
    hourly_rate: Optional[float] = None
    estimated_duration: Optional[int] = None  # seconds
    is_billable: bool = True
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    
    @property
    def duration_hours(self) -> float:
        """Get duration in hours"""
        return self.duration_seconds / 3600
    
    @property
    def is_active(self) -> bool:
        """Check if this is an active timer"""
        return self.end_time is None and self.entry_type == "timer"
    
    @property
    def earnings(self) -> float:
        """Calculate earnings for this entry"""
        if not self.hourly_rate or not self.is_billable:
            return 0.0
        return self.duration_hours * self.hourly_rate

@dataclass  
class ProjectSummary:
    """Project-level summary statistics"""
    project_name: str
    total_hours: float
    total_entries: int
    total_earnings: float
    avg_session_duration: float
    estimated_vs_actual_ratio: Optional[float] = None
    productivity_score: float = 0.0
    
@dataclass
class ProductivityMetrics:
    """Analytics about productivity patterns"""
    peak_hours: List[int]  # Hours of day (0-23)
    peak_days: List[int]   # Days of week (0-6, Monday=0)
    avg_focus_duration: float  # Average session length in hours
    productive_ratio: float  # Productive time vs total tracked
    efficiency_score: float  # Overall efficiency score (0-1)
    break_recommendations: Dict[str, Any]
    scope_creep_alerts: List[Dict[str, Any]]

@dataclass
class OptimizationSuggestion:
    """Individual optimization recommendation"""
    category: str  # schedule, productivity, estimation, breaks
    priority: str  # high, medium, low
    title: str
    description: str
    action_items: List[str]
    potential_impact: str
    confidence: float  # 0-1


# ---------------------------------------------------------------------------
# Core Time Tracker Class
# ---------------------------------------------------------------------------

class TimeTracker:
    """Main time tracking system with analytics and optimization"""
    
    def __init__(self, data_dir: str = None):
        """Initialize time tracker with data directory"""
        if data_dir is None:
            script_dir = Path(__file__).parent
            self.data_dir = script_dir.parent / "data" / "time_tracking"
        else:
            self.data_dir = Path(data_dir)
        
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Data files
        self.entries_file = self.data_dir / "time_entries.json"
        self.active_timers_file = self.data_dir / "active_timers.json"
        self.analytics_cache_file = self.data_dir / "analytics_cache.json"
        
        # Load data
        self.time_entries = self._load_time_entries()
        self.active_timers = self._load_active_timers()
    
    def _load_time_entries(self) -> List[TimeEntry]:
        """Load time entries from file"""
        if not self.entries_file.exists():
            return []
        
        try:
            with open(self.entries_file, 'r') as f:
                data = json.load(f)
                entries = []
                for entry_data in data:
                    # Convert datetime strings back to datetime objects
                    entry_data['start_time'] = datetime.fromisoformat(entry_data['start_time'])
                    if entry_data.get('end_time'):
                        entry_data['end_time'] = datetime.fromisoformat(entry_data['end_time'])
                    entry_data['created_at'] = datetime.fromisoformat(entry_data['created_at'])
                    entries.append(TimeEntry(**entry_data))
                return entries
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Error loading time entries: {e}")
            return []
    
    def _save_time_entries(self):
        """Save time entries to file"""
        try:
            data = []
            for entry in self.time_entries:
                entry_dict = asdict(entry)
                # Convert datetime objects to strings
                entry_dict['start_time'] = entry.start_time.isoformat()
                if entry.end_time:
                    entry_dict['end_time'] = entry.end_time.isoformat()
                entry_dict['created_at'] = entry.created_at.isoformat()
                data.append(entry_dict)
            
            with open(self.entries_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Error saving time entries: {e}")
    
    def _load_active_timers(self) -> List[str]:
        """Load active timer IDs"""
        if not self.active_timers_file.exists():
            return []
        
        try:
            with open(self.active_timers_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    
    def _save_active_timers(self):
        """Save active timer IDs"""
        active_ids = [entry.id for entry in self.time_entries if entry.is_active]
        try:
            with open(self.active_timers_file, 'w') as f:
                json.dump(active_ids, f)
        except Exception as e:
            print(f"Error saving active timers: {e}")
    
    def _generate_entry_id(self) -> str:
        """Generate unique ID for time entry"""
        timestamp = int(time.time() * 1000)
        return f"TIME-{timestamp}"
    
    # ---------------------------------------------------------------------------
    # Timer Management
    # ---------------------------------------------------------------------------
    
    def start_timer(self, project: str, task: str, estimated_hours: Optional[float] = None,
                   hourly_rate: Optional[float] = None, tags: Optional[List[str]] = None) -> TimeEntry:
        """Start a new timer for project/task"""
        entry = TimeEntry(
            id=self._generate_entry_id(),
            project=project.strip(),
            task=task.strip(),
            start_time=datetime.now(),
            entry_type="timer",
            estimated_duration=int(estimated_hours * 3600) if estimated_hours else None,
            hourly_rate=hourly_rate,
            tags=tags or []
        )
        
        self.time_entries.append(entry)
        self._save_time_entries()
        self._save_active_timers()
        
        return entry
    
    def stop_timer(self, timer_id: Optional[str] = None) -> Optional[TimeEntry]:
        """Stop an active timer"""
        if timer_id:
            # Stop specific timer
            entry = next((e for e in self.time_entries if e.id == timer_id and e.is_active), None)
        else:
            # Stop most recent active timer
            active_timers = [e for e in self.time_entries if e.is_active]
            entry = max(active_timers, key=lambda e: e.start_time) if active_timers else None
        
        if not entry:
            return None
        
        entry.end_time = datetime.now()
        entry.duration_seconds = int((entry.end_time - entry.start_time).total_seconds())
        
        self._save_time_entries()
        self._save_active_timers()
        
        return entry
    
    def pause_timer(self, timer_id: str) -> bool:
        """Pause an active timer (stops it but keeps as resumable)"""
        entry = self.stop_timer(timer_id)
        if entry:
            entry.tags = entry.tags + ["paused"] if "paused" not in entry.tags else entry.tags
            self._save_time_entries()
            return True
        return False
    
    def get_active_timers(self) -> List[TimeEntry]:
        """Get all currently active timers"""
        return [entry for entry in self.time_entries if entry.is_active]
    
    def manual_entry(self, project: str, task: str, hours: float,
                    entry_date: Optional[date] = None, hourly_rate: Optional[float] = None,
                    tags: Optional[List[str]] = None, notes: str = "") -> TimeEntry:
        """Add manual time entry"""
        if entry_date is None:
            entry_date = date.today()
        
        start_time = datetime.combine(entry_date, datetime.now().time())
        duration_seconds = int(hours * 3600)
        end_time = start_time + timedelta(seconds=duration_seconds)
        
        entry = TimeEntry(
            id=self._generate_entry_id(),
            project=project.strip(),
            task=task.strip(),
            start_time=start_time,
            end_time=end_time,
            duration_seconds=duration_seconds,
            entry_type="manual",
            hourly_rate=hourly_rate,
            tags=tags or [],
            notes=notes.strip()
        )
        
        self.time_entries.append(entry)
        self._save_time_entries()
        
        return entry
    
    # ---------------------------------------------------------------------------
    # Reporting
    # ---------------------------------------------------------------------------
    
    def get_time_summary(self, start_date: date, end_date: date) -> Dict[str, Any]:
        """Get time summary for date range"""
        entries = [
            e for e in self.time_entries 
            if e.end_time and start_date <= e.start_time.date() <= end_date
        ]
        
        if not entries:
            return {
                "total_hours": 0,
                "total_entries": 0,
                "total_earnings": 0,
                "project_breakdown": {},
                "date_range": f"{start_date} to {end_date}"
            }
        
        total_hours = sum(e.duration_hours for e in entries)
        total_earnings = sum(e.earnings for e in entries)
        
        # Project breakdown
        project_breakdown = {}
        for entry in entries:
            if entry.project not in project_breakdown:
                project_breakdown[entry.project] = {
                    "hours": 0,
                    "entries": 0,
                    "earnings": 0,
                    "tasks": set()
                }
            
            project_breakdown[entry.project]["hours"] += entry.duration_hours
            project_breakdown[entry.project]["entries"] += 1
            project_breakdown[entry.project]["earnings"] += entry.earnings
            project_breakdown[entry.project]["tasks"].add(entry.task)
        
        # Convert sets to lists for JSON serialization
        for project_data in project_breakdown.values():
            project_data["tasks"] = list(project_data["tasks"])
        
        return {
            "total_hours": round(total_hours, 2),
            "total_entries": len(entries),
            "total_earnings": round(total_earnings, 2),
            "avg_earnings_per_hour": round(total_earnings / total_hours, 2) if total_hours > 0 else 0,
            "project_breakdown": project_breakdown,
            "date_range": f"{start_date} to {end_date}"
        }
    
    def daily_report(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Get daily time report"""
        if target_date is None:
            target_date = date.today()
        return self.get_time_summary(target_date, target_date)
    
    def weekly_report(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Get weekly time report"""
        if target_date is None:
            target_date = date.today()
        
        # Get start of week (Monday)
        start_of_week = target_date - timedelta(days=target_date.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        
        return self.get_time_summary(start_of_week, end_of_week)
    
    def monthly_report(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Get monthly time report"""
        if target_date is None:
            target_date = date.today()
        
        # Get start and end of month
        start_of_month = target_date.replace(day=1)
        if target_date.month == 12:
            end_of_month = start_of_month.replace(year=target_date.year + 1, month=1) - timedelta(days=1)
        else:
            end_of_month = start_of_month.replace(month=target_date.month + 1) - timedelta(days=1)
        
        return self.get_time_summary(start_of_month, end_of_month)
    
    # ---------------------------------------------------------------------------
    # Analytics
    # ---------------------------------------------------------------------------
    
    def calculate_productivity_metrics(self, days_back: int = 30) -> ProductivityMetrics:
        """Calculate productivity metrics for the last N days"""
        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)
        
        entries = [
            e for e in self.time_entries 
            if e.end_time and start_date <= e.start_time.date() <= end_date
        ]
        
        if not entries:
            return ProductivityMetrics(
                peak_hours=[], peak_days=[], avg_focus_duration=0,
                productive_ratio=0, efficiency_score=0,
                break_recommendations={}, scope_creep_alerts=[]
            )
        
        # Peak hours analysis
        hourly_distribution = {}
        for entry in entries:
            hour = entry.start_time.hour
            hourly_distribution[hour] = hourly_distribution.get(hour, 0) + entry.duration_hours
        
        # Get top 3 productive hours
        peak_hours = sorted(hourly_distribution.keys(), 
                          key=lambda h: hourly_distribution[h], reverse=True)[:3]
        
        # Peak days analysis  
        daily_distribution = {}
        for entry in entries:
            day = entry.start_time.weekday()  # 0=Monday
            daily_distribution[day] = daily_distribution.get(day, 0) + entry.duration_hours
        
        peak_days = sorted(daily_distribution.keys(),
                         key=lambda d: daily_distribution[d], reverse=True)[:3]
        
        # Focus duration analysis
        session_durations = [e.duration_hours for e in entries if e.duration_hours > 0.1]  # Filter very short entries
        avg_focus_duration = statistics.mean(session_durations) if session_durations else 0
        
        # Productivity ratio (billable vs non-billable)
        billable_hours = sum(e.duration_hours for e in entries if e.is_billable)
        total_hours = sum(e.duration_hours for e in entries)
        productive_ratio = billable_hours / total_hours if total_hours > 0 else 0
        
        # Efficiency score (combination of factors)
        estimation_accuracy = self._calculate_estimation_accuracy(entries)
        focus_quality = min(avg_focus_duration / 2.0, 1.0)  # 2+ hours = perfect focus
        consistency_score = self._calculate_consistency_score(entries)
        
        efficiency_score = (estimation_accuracy * 0.3 + 
                          focus_quality * 0.4 + 
                          consistency_score * 0.3)
        
        # Break recommendations
        break_recommendations = self._generate_break_recommendations(entries)
        
        # Scope creep alerts
        scope_creep_alerts = self._detect_scope_creep(entries)
        
        return ProductivityMetrics(
            peak_hours=peak_hours,
            peak_days=peak_days,
            avg_focus_duration=round(avg_focus_duration, 2),
            productive_ratio=round(productive_ratio, 2),
            efficiency_score=round(efficiency_score, 2),
            break_recommendations=break_recommendations,
            scope_creep_alerts=scope_creep_alerts
        )
    
    def _calculate_estimation_accuracy(self, entries: List[TimeEntry]) -> float:
        """Calculate how accurate time estimates are"""
        estimated_entries = [e for e in entries if e.estimated_duration and e.duration_seconds > 0]
        
        if not estimated_entries:
            return 0.5  # Neutral score if no estimates
        
        accuracy_scores = []
        for entry in estimated_entries:
            estimated_hours = entry.estimated_duration / 3600
            actual_hours = entry.duration_hours
            
            # Calculate accuracy (closer to 1.0 = more accurate)
            if estimated_hours > 0:
                ratio = min(actual_hours / estimated_hours, estimated_hours / actual_hours)
                accuracy_scores.append(ratio)
        
        return statistics.mean(accuracy_scores) if accuracy_scores else 0.5
    
    def _calculate_consistency_score(self, entries: List[TimeEntry]) -> float:
        """Calculate consistency of work patterns"""
        if len(entries) < 7:
            return 0.5  # Not enough data
        
        # Group by day and calculate daily hours
        daily_hours = {}
        for entry in entries:
            day_key = entry.start_time.date()
            daily_hours[day_key] = daily_hours.get(day_key, 0) + entry.duration_hours
        
        # Calculate coefficient of variation (lower = more consistent)
        hours_values = list(daily_hours.values())
        if len(hours_values) < 2:
            return 0.5
        
        mean_hours = statistics.mean(hours_values)
        if mean_hours == 0:
            return 0
        
        std_dev = statistics.stdev(hours_values)
        cv = std_dev / mean_hours
        
        # Convert to 0-1 score (lower CV = higher consistency score)
        consistency_score = max(0, 1 - min(cv, 1))
        return consistency_score
    
    def _generate_break_recommendations(self, entries: List[TimeEntry]) -> Dict[str, Any]:
        """Generate break pattern recommendations"""
        # Analyze session lengths
        session_lengths = [e.duration_hours for e in entries if e.duration_hours > 0]
        
        if not session_lengths:
            return {"status": "insufficient_data"}
        
        avg_session = statistics.mean(session_lengths)
        long_sessions = [s for s in session_lengths if s > 3]  # 3+ hour sessions
        
        recommendations = {}
        
        if avg_session > 4:
            recommendations["break_frequency"] = "Consider taking breaks every 90-120 minutes for optimal focus"
        elif avg_session > 2:
            recommendations["break_frequency"] = "Your session lengths look good, maintain current break patterns"
        else:
            recommendations["break_frequency"] = "Try extending focus sessions to 90+ minutes with planned breaks"
        
        if len(long_sessions) > len(session_lengths) * 0.3:
            recommendations["burnout_warning"] = "Many long sessions detected - ensure adequate rest between work periods"
        
        recommendations["ideal_pattern"] = "90 min work + 15 min break, with longer breaks every 3-4 hours"
        
        return recommendations
    
    def _detect_scope_creep(self, entries: List[TimeEntry]) -> List[Dict[str, Any]]:
        """Detect potential scope creep in projects"""
        alerts = []
        
        # Group by project and task
        project_tasks = {}
        for entry in entries:
            key = f"{entry.project}::{entry.task}"
            if key not in project_tasks:
                project_tasks[key] = []
            project_tasks[key].append(entry)
        
        # Analyze each project-task combination
        for key, task_entries in project_tasks.items():
            if len(task_entries) < 3:  # Need at least 3 entries for pattern analysis
                continue
            
            project, task = key.split("::", 1)
            total_hours = sum(e.duration_hours for e in task_entries)
            
            # Check if any entry has estimates
            estimated_entries = [e for e in task_entries if e.estimated_duration]
            if estimated_entries:
                total_estimated = sum(e.estimated_duration for e in estimated_entries) / 3600
                
                if total_hours > total_estimated * 1.5:  # 50% over estimate
                    alerts.append({
                        "project": project,
                        "task": task,
                        "estimated_hours": round(total_estimated, 1),
                        "actual_hours": round(total_hours, 1),
                        "overrun_percentage": round((total_hours / total_estimated - 1) * 100, 1),
                        "severity": "high" if total_hours > total_estimated * 2 else "medium"
                    })
        
        return alerts
    
    # ---------------------------------------------------------------------------
    # Optimization Suggestions
    # ---------------------------------------------------------------------------
    
    def generate_optimization_suggestions(self, days_back: int = 30) -> List[OptimizationSuggestion]:
        """Generate personalized optimization suggestions"""
        metrics = self.calculate_productivity_metrics(days_back)
        suggestions = []
        
        # Schedule optimization
        if metrics.peak_hours:
            suggestions.append(OptimizationSuggestion(
                category="schedule",
                priority="high",
                title="Optimize Your Peak Hours",
                description=f"You're most productive during hours {', '.join(map(str, metrics.peak_hours))}. Schedule your most important work during these times.",
                action_items=[
                    f"Block hours {'-'.join(map(str, metrics.peak_hours[:2]))} for deep work",
                    "Schedule meetings and admin tasks outside peak hours",
                    "Protect peak hours from interruptions"
                ],
                potential_impact="20-30% productivity increase",
                confidence=0.85
            ))
        
        # Focus optimization
        if metrics.avg_focus_duration < 1.5:
            suggestions.append(OptimizationSuggestion(
                category="productivity",
                priority="high", 
                title="Increase Focus Session Length",
                description=f"Your average focus session is {metrics.avg_focus_duration:.1f} hours. Longer sessions can improve deep work quality.",
                action_items=[
                    "Try the Pomodoro Technique with extended 90-minute sessions",
                    "Eliminate distractions during work blocks",
                    "Use focus apps or website blockers",
                    "Create a dedicated workspace"
                ],
                potential_impact="15-25% efficiency gain",
                confidence=0.75
            ))
        
        # Estimation improvement
        if metrics.efficiency_score < 0.6:
            suggestions.append(OptimizationSuggestion(
                category="estimation",
                priority="medium",
                title="Improve Time Estimation Accuracy", 
                description="Your time estimates often don't match actual time spent. Better estimates lead to better planning.",
                action_items=[
                    "Track estimation accuracy for each task type",
                    "Add buffer time (20-30%) to estimates",
                    "Break large tasks into smaller, estimatable chunks",
                    "Review past similar tasks before estimating"
                ],
                potential_impact="Better client relationships and project planning",
                confidence=0.70
            ))
        
        # Break pattern optimization
        if "burnout_warning" in metrics.break_recommendations:
            suggestions.append(OptimizationSuggestion(
                category="breaks",
                priority="high",
                title="Prevent Burnout with Better Break Patterns",
                description="You're working many long sessions without adequate breaks.",
                action_items=[
                    "Take a 15-minute break every 90 minutes",
                    "Step away from the screen during breaks",
                    "Consider a longer lunch break",
                    "Track energy levels throughout the day"
                ],
                potential_impact="Sustained productivity and reduced burnout risk",
                confidence=0.80
            ))
        
        # Scope creep management
        if metrics.scope_creep_alerts:
            high_severity_alerts = [a for a in metrics.scope_creep_alerts if a["severity"] == "high"]
            if high_severity_alerts:
                suggestions.append(OptimizationSuggestion(
                    category="estimation",
                    priority="high",
                    title="Address Scope Creep Issues",
                    description=f"Found {len(high_severity_alerts)} tasks significantly over estimate.",
                    action_items=[
                        "Review project scope with clients regularly",
                        "Document all changes and time impacts",
                        "Use change request process for scope additions",
                        "Build scope creep buffers into estimates"
                    ],
                    potential_impact="Better project profitability and client relationships",
                    confidence=0.90
                ))
        
        # Day-of-week optimization
        if metrics.peak_days:
            weekend_productive = any(day >= 5 for day in metrics.peak_days)  # Sat/Sun = 5/6
            if weekend_productive:
                suggestions.append(OptimizationSuggestion(
                    category="schedule",
                    priority="low",
                    title="Consider Work-Life Balance",
                    description="You're showing high productivity on weekends. Consider if this is sustainable.",
                    action_items=[
                        "Evaluate weekend work necessity",
                        "Plan better weekday time management",
                        "Set boundaries for weekend work",
                        "Ensure adequate rest time"
                    ],
                    potential_impact="Better work-life balance and long-term sustainability",
                    confidence=0.65
                ))
        
        return sorted(suggestions, key=lambda x: (
            {"high": 3, "medium": 2, "low": 1}[x.priority],
            x.confidence
        ), reverse=True)
    
    # ---------------------------------------------------------------------------
    # Export/Integration
    # ---------------------------------------------------------------------------
    
    def export_to_csv(self, start_date: date, end_date: date, filename: Optional[str] = None) -> str:
        """Export time entries to CSV format"""
        import csv
        from io import StringIO
        
        entries = [
            e for e in self.time_entries 
            if e.end_time and start_date <= e.start_time.date() <= end_date
        ]
        
        if filename is None:
            filename = self.data_dir / f"time_export_{start_date}_to_{end_date}.csv"
        else:
            filename = Path(filename)
        
        # Prepare CSV content
        output = StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Date", "Project", "Task", "Start Time", "End Time", 
            "Duration (Hours)", "Hourly Rate", "Earnings", "Billable", 
            "Entry Type", "Tags", "Notes"
        ])
        
        # Data rows
        for entry in sorted(entries, key=lambda e: e.start_time):
            writer.writerow([
                entry.start_time.date().isoformat(),
                entry.project,
                entry.task,
                entry.start_time.strftime("%H:%M:%S"),
                entry.end_time.strftime("%H:%M:%S") if entry.end_time else "",
                round(entry.duration_hours, 2),
                entry.hourly_rate or "",
                round(entry.earnings, 2),
                "Yes" if entry.is_billable else "No",
                entry.entry_type,
                ",".join(entry.tags),
                entry.notes
            ])
        
        # Save to file
        with open(filename, 'w', newline='') as f:
            f.write(output.getvalue())
        
        return str(filename)
    
    def get_billable_hours_for_invoice(self, project: str, start_date: date, end_date: date) -> Dict[str, Any]:
        """Get billable hours summary for invoice integration"""
        entries = [
            e for e in self.time_entries 
            if (e.end_time and 
                e.project == project and
                e.is_billable and
                start_date <= e.start_time.date() <= end_date)
        ]
        
        if not entries:
            return {
                "project": project,
                "total_hours": 0,
                "total_amount": 0,
                "entries": [],
                "date_range": f"{start_date} to {end_date}"
            }
        
        # Group by task for invoice line items
        task_summaries = {}
        for entry in entries:
            if entry.task not in task_summaries:
                task_summaries[entry.task] = {
                    "hours": 0,
                    "rate": entry.hourly_rate,
                    "amount": 0
                }
            
            task_summaries[entry.task]["hours"] += entry.duration_hours
            task_summaries[entry.task]["amount"] += entry.earnings
        
        # Format for invoice system
        invoice_lines = []
        for task, summary in task_summaries.items():
            invoice_lines.append({
                "description": f"{project} - {task}",
                "hours": round(summary["hours"], 2),
                "rate": summary["rate"],
                "amount": round(summary["amount"], 2)
            })
        
        total_hours = sum(e.duration_hours for e in entries)
        total_amount = sum(e.earnings for e in entries)
        
        return {
            "project": project,
            "total_hours": round(total_hours, 2),
            "total_amount": round(total_amount, 2),
            "entries": invoice_lines,
            "date_range": f"{start_date} to {end_date}",
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat()
        }


# ---------------------------------------------------------------------------
# CLI Interface 
# ---------------------------------------------------------------------------

def create_cli_parser():
    """Create command line argument parser"""
    parser = argparse.ArgumentParser(description="Time Tracking with Productivity Analytics")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Start timer
    start_parser = subparsers.add_parser('start', help='Start a timer')
    start_parser.add_argument('project', help='Project name')
    start_parser.add_argument('task', help='Task description')
    start_parser.add_argument('--estimate', type=float, help='Estimated hours')
    start_parser.add_argument('--rate', type=float, help='Hourly rate')
    start_parser.add_argument('--tags', nargs='*', help='Tags for the entry')
    
    # Stop timer
    stop_parser = subparsers.add_parser('stop', help='Stop active timer')
    stop_parser.add_argument('--id', help='Specific timer ID to stop')
    
    # Manual entry
    log_parser = subparsers.add_parser('log', help='Add manual time entry')
    log_parser.add_argument('hours', type=float, help='Hours worked')
    log_parser.add_argument('project', help='Project name')
    log_parser.add_argument('task', help='Task description')
    log_parser.add_argument('--date', help='Date (YYYY-MM-DD), defaults to today')
    log_parser.add_argument('--rate', type=float, help='Hourly rate')
    log_parser.add_argument('--tags', nargs='*', help='Tags for the entry')
    log_parser.add_argument('--notes', help='Additional notes')
    
    # Status
    subparsers.add_parser('status', help='Show current tracking status')
    
    # Reports
    report_parser = subparsers.add_parser('report', help='Generate time reports')
    report_parser.add_argument('period', choices=['daily', 'weekly', 'monthly'], 
                              help='Report period')
    report_parser.add_argument('--date', help='Target date (YYYY-MM-DD), defaults to today')
    report_parser.add_argument('--format', choices=['json', 'table'], default='table',
                              help='Output format')
    
    # Analytics
    analytics_parser = subparsers.add_parser('analytics', help='Show productivity analytics')
    analytics_parser.add_argument('--days', type=int, default=30, help='Days to analyze')
    analytics_parser.add_argument('--format', choices=['json', 'table'], default='table',
                                 help='Output format')
    
    # Optimization
    optimize_parser = subparsers.add_parser('optimize', help='Get optimization suggestions')
    optimize_parser.add_argument('--days', type=int, default=30, help='Days to analyze')
    optimize_parser.add_argument('--format', choices=['json', 'table'], default='table',
                                help='Output format')
    
    # Export
    export_parser = subparsers.add_parser('export', help='Export data')
    export_parser.add_argument('format', choices=['csv', 'json'], help='Export format')
    export_parser.add_argument('--start', required=True, help='Start date (YYYY-MM-DD)')
    export_parser.add_argument('--end', required=True, help='End date (YYYY-MM-DD)')
    export_parser.add_argument('--output', help='Output filename')
    
    # Invoice integration
    invoice_parser = subparsers.add_parser('invoice', help='Get billable hours for invoice')
    invoice_parser.add_argument('project', help='Project name')
    invoice_parser.add_argument('--start', required=True, help='Start date (YYYY-MM-DD)')
    invoice_parser.add_argument('--end', required=True, help='End date (YYYY-MM-DD)')
    
    return parser


def format_duration(seconds: int) -> str:
    """Format duration in human readable format"""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    else:
        return f"{minutes}m"


def print_table_report(data: Dict[str, Any]):
    """Print report data in table format"""
    print(f"\n📊 Time Report - {data['date_range']}")
    print("=" * 50)
    print(f"Total Hours: {data['total_hours']}")
    print(f"Total Entries: {data['total_entries']}")
    print(f"Total Earnings: ${data.get('total_earnings', 0):.2f}")
    if data.get('avg_earnings_per_hour'):
        print(f"Avg Rate: ${data['avg_earnings_per_hour']:.2f}/hour")
    
    print(f"\n📋 Project Breakdown:")
    for project, info in data.get('project_breakdown', {}).items():
        print(f"  {project}")
        print(f"    Hours: {info['hours']:.1f}")
        print(f"    Earnings: ${info.get('earnings', 0):.2f}")
        print(f"    Tasks: {', '.join(info['tasks'][:3])}{'...' if len(info['tasks']) > 3 else ''}")
        print()


def print_analytics(metrics: ProductivityMetrics):
    """Print analytics in readable format"""
    print(f"\n📈 Productivity Analytics")
    print("=" * 50)
    print(f"Peak Hours: {', '.join(map(str, metrics.peak_hours))}")
    print(f"Peak Days: {', '.join(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day] for day in metrics.peak_days)}")
    print(f"Avg Focus Duration: {metrics.avg_focus_duration:.1f} hours")
    print(f"Productive Ratio: {metrics.productive_ratio:.0%}")
    print(f"Efficiency Score: {metrics.efficiency_score:.0%}")
    
    print(f"\n💡 Break Recommendations:")
    for key, value in metrics.break_recommendations.items():
        print(f"  {key}: {value}")
    
    if metrics.scope_creep_alerts:
        print(f"\n⚠️  Scope Creep Alerts:")
        for alert in metrics.scope_creep_alerts:
            print(f"  {alert['project']} - {alert['task']}: {alert['overrun_percentage']:.0f}% over estimate")


def print_optimization_suggestions(suggestions: List[OptimizationSuggestion]):
    """Print optimization suggestions in readable format"""
    print(f"\n🎯 Optimization Suggestions")
    print("=" * 50)
    
    if not suggestions:
        print("No specific suggestions at this time. Keep tracking for more insights!")
        return
    
    for i, suggestion in enumerate(suggestions[:5], 1):  # Show top 5
        priority_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}
        print(f"{i}. {priority_icon[suggestion.priority]} {suggestion.title}")
        print(f"   {suggestion.description}")
        print(f"   Impact: {suggestion.potential_impact}")
        print(f"   Confidence: {suggestion.confidence:.0%}")
        print()


def main():
    """Main CLI entry point"""
    parser = create_cli_parser()
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize tracker
    tracker = TimeTracker()
    
    try:
        if args.command == 'start':
            entry = tracker.start_timer(
                project=args.project,
                task=args.task,
                estimated_hours=args.estimate,
                hourly_rate=args.rate,
                tags=args.tags
            )
            print(f"⏱️  Started timer: {args.project} - {args.task}")
            if args.estimate:
                print(f"   Estimated: {args.estimate} hours")
            print(f"   Timer ID: {entry.id}")
        
        elif args.command == 'stop':
            entry = tracker.stop_timer(args.id)
            if entry:
                print(f"⏹️  Stopped timer: {entry.project} - {entry.task}")
                print(f"   Duration: {format_duration(entry.duration_seconds)}")
                if entry.hourly_rate:
                    print(f"   Earnings: ${entry.earnings:.2f}")
            else:
                print("❌ No active timer found to stop")
        
        elif args.command == 'log':
            entry_date = None
            if args.date:
                entry_date = datetime.strptime(args.date, '%Y-%m-%d').date()
            
            entry = tracker.manual_entry(
                project=args.project,
                task=args.task,
                hours=args.hours,
                entry_date=entry_date,
                hourly_rate=args.rate,
                tags=args.tags,
                notes=args.notes or ""
            )
            print(f"✅ Logged {args.hours} hours: {args.project} - {args.task}")
            if args.rate:
                print(f"   Earnings: ${entry.earnings:.2f}")
        
        elif args.command == 'status':
            active_timers = tracker.get_active_timers()
            if active_timers:
                print(f"⏱️  Active Timers ({len(active_timers)}):")
                for timer in active_timers:
                    elapsed = datetime.now() - timer.start_time
                    elapsed_str = format_duration(int(elapsed.total_seconds()))
                    print(f"   {timer.project} - {timer.task} ({elapsed_str})")
            else:
                print("⏸️  No active timers")
                
            # Today's summary
            today_summary = tracker.daily_report()
            print(f"\n📅 Today: {today_summary['total_hours']:.1f} hours, ${today_summary.get('total_earnings', 0):.2f}")
        
        elif args.command == 'report':
            target_date = None
            if args.date:
                target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
            
            if args.period == 'daily':
                data = tracker.daily_report(target_date)
            elif args.period == 'weekly':
                data = tracker.weekly_report(target_date)
            else:  # monthly
                data = tracker.monthly_report(target_date)
            
            if args.format == 'json':
                print(json.dumps(data, indent=2, default=str))
            else:
                print_table_report(data)
        
        elif args.command == 'analytics':
            metrics = tracker.calculate_productivity_metrics(args.days)
            
            if args.format == 'json':
                print(json.dumps(asdict(metrics), indent=2, default=str))
            else:
                print_analytics(metrics)
        
        elif args.command == 'optimize':
            suggestions = tracker.generate_optimization_suggestions(args.days)
            
            if args.format == 'json':
                print(json.dumps([asdict(s) for s in suggestions], indent=2, default=str))
            else:
                print_optimization_suggestions(suggestions)
        
        elif args.command == 'export':
            start_date = datetime.strptime(args.start, '%Y-%m-%d').date()
            end_date = datetime.strptime(args.end, '%Y-%m-%d').date()
            
            if args.format == 'csv':
                filename = tracker.export_to_csv(start_date, end_date, args.output)
                print(f"📄 Exported to: {filename}")
            else:  # json
                data = tracker.get_time_summary(start_date, end_date)
                output_file = args.output or f"time_export_{start_date}_to_{end_date}.json"
                with open(output_file, 'w') as f:
                    json.dump(data, f, indent=2, default=str)
                print(f"📄 Exported to: {output_file}")
        
        elif args.command == 'invoice':
            start_date = datetime.strptime(args.start, '%Y-%m-%d').date()
            end_date = datetime.strptime(args.end, '%Y-%m-%d').date()
            
            invoice_data = tracker.get_billable_hours_for_invoice(args.project, start_date, end_date)
            print(json.dumps(invoice_data, indent=2, default=str))
    
    except KeyboardInterrupt:
        print(f"\n👋 Goodbye!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()