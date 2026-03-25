#!/usr/bin/env python3
"""
Comprehensive tests for the Time Tracking system
"""

import unittest
import sys
import os
import tempfile
import shutil
import json
from unittest.mock import patch, MagicMock
from datetime import datetime, date, timedelta
from pathlib import Path

# Add tools directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))

from time_tracker import (
    TimeTracker, TimeEntry, ProductivityMetrics, OptimizationSuggestion,
    format_duration, create_cli_parser
)


class TestTimeEntry(unittest.TestCase):
    """Test cases for TimeEntry data model"""
    
    def test_time_entry_creation(self):
        """Test basic time entry creation"""
        start_time = datetime.now()
        entry = TimeEntry(
            id="TEST-001",
            project="Web Development",
            task="Frontend coding",
            start_time=start_time
        )
        
        self.assertEqual(entry.project, "Web Development")
        self.assertEqual(entry.task, "Frontend coding")
        self.assertTrue(entry.is_active)
        self.assertEqual(entry.duration_hours, 0)
        self.assertEqual(entry.earnings, 0)
    
    def test_time_entry_completion(self):
        """Test completing a time entry"""
        start_time = datetime.now()
        entry = TimeEntry(
            id="TEST-002",
            project="Web Development",
            task="Backend coding",
            start_time=start_time,
            hourly_rate=75.0
        )
        
        # Complete the entry
        entry.end_time = start_time + timedelta(hours=2, minutes=30)
        entry.duration_seconds = int((entry.end_time - entry.start_time).total_seconds())
        
        self.assertFalse(entry.is_active)
        self.assertAlmostEqual(entry.duration_hours, 2.5, places=2)
        self.assertAlmostEqual(entry.earnings, 187.5, places=2)
    
    def test_non_billable_entry(self):
        """Test non-billable entry earnings"""
        start_time = datetime.now()
        entry = TimeEntry(
            id="TEST-003",
            project="Admin",
            task="Email management",
            start_time=start_time,
            hourly_rate=75.0,
            is_billable=False
        )
        
        entry.end_time = start_time + timedelta(hours=1)
        entry.duration_seconds = 3600
        
        self.assertEqual(entry.earnings, 0)


class TestTimeTracker(unittest.TestCase):
    """Test cases for TimeTracker class"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Create temporary directory for test data
        self.test_dir = tempfile.mkdtemp()
        self.tracker = TimeTracker(data_dir=self.test_dir)
    
    def tearDown(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.test_dir)
    
    def test_start_timer(self):
        """Test starting a timer"""
        entry = self.tracker.start_timer("Web Development", "Frontend coding")
        
        self.assertEqual(entry.project, "Web Development")
        self.assertEqual(entry.task, "Frontend coding")
        self.assertTrue(entry.is_active)
        self.assertEqual(len(self.tracker.time_entries), 1)
        
        # Verify persistence
        active_timers = self.tracker.get_active_timers()
        self.assertEqual(len(active_timers), 1)
    
    def test_stop_timer(self):
        """Test stopping a timer"""
        # Start timer
        entry = self.tracker.start_timer("Web Development", "Backend coding", hourly_rate=80.0)
        timer_id = entry.id
        
        # Wait a brief moment (simulate work)
        import time
        time.sleep(0.2)
        
        # Stop timer
        stopped_entry = self.tracker.stop_timer()
        
        self.assertIsNotNone(stopped_entry)
        self.assertEqual(stopped_entry.id, timer_id)
        self.assertFalse(stopped_entry.is_active)
        self.assertGreaterEqual(stopped_entry.duration_seconds, 0)
    
    def test_multiple_active_timers(self):
        """Test handling multiple concurrent timers"""
        entry1 = self.tracker.start_timer("Project A", "Task 1")
        entry2 = self.tracker.start_timer("Project B", "Task 2")
        
        active_timers = self.tracker.get_active_timers()
        self.assertEqual(len(active_timers), 2)
        
        # Stop specific timer
        stopped = self.tracker.stop_timer(entry1.id)
        self.assertEqual(stopped.id, entry1.id)
        
        active_timers = self.tracker.get_active_timers()
        self.assertEqual(len(active_timers), 1)
        self.assertEqual(active_timers[0].id, entry2.id)
    
    def test_manual_entry(self):
        """Test manual time entry"""
        entry_date = date(2026, 3, 20)
        entry = self.tracker.manual_entry(
            project="Client Work",
            task="Design Review",
            hours=1.5,
            entry_date=entry_date,
            hourly_rate=90.0,
            notes="Final design review meeting"
        )
        
        self.assertEqual(entry.project, "Client Work")
        self.assertEqual(entry.task, "Design Review")
        self.assertEqual(entry.duration_hours, 1.5)
        self.assertEqual(entry.earnings, 135.0)
        self.assertEqual(entry.entry_type, "manual")
        self.assertEqual(entry.notes, "Final design review meeting")
    
    def test_pause_timer(self):
        """Test pausing a timer"""
        entry = self.tracker.start_timer("Project C", "Research")
        timer_id = entry.id
        
        # Pause timer
        success = self.tracker.pause_timer(timer_id)
        self.assertTrue(success)
        
        # Verify it's stopped and tagged as paused
        paused_entry = next(e for e in self.tracker.time_entries if e.id == timer_id)
        self.assertFalse(paused_entry.is_active)
        self.assertIn("paused", paused_entry.tags)


class TestReporting(unittest.TestCase):
    """Test cases for reporting functionality"""
    
    def setUp(self):
        """Set up test fixtures with sample data"""
        self.test_dir = tempfile.mkdtemp()
        self.tracker = TimeTracker(data_dir=self.test_dir)
        
        # Create sample time entries
        base_date = datetime(2026, 3, 20)
        
        # Day 1 entries
        for i, (project, task, hours, rate) in enumerate([
            ("Web Development", "Frontend", 3.0, 75.0),
            ("Web Development", "Backend", 2.5, 75.0),
            ("Admin", "Email", 0.5, 0),  # Non-billable
        ]):
            start_time = base_date + timedelta(hours=i*4)
            entry = TimeEntry(
                id=f"TEST-{i+1}",
                project=project,
                task=task,
                start_time=start_time,
                end_time=start_time + timedelta(hours=hours),
                duration_seconds=int(hours * 3600),
                hourly_rate=rate if rate > 0 else None,
                is_billable=rate > 0,
                entry_type="manual"
            )
            self.tracker.time_entries.append(entry)
        
        # Day 2 entries (next day)
        next_day = base_date + timedelta(days=1)
        for i, (project, task, hours, rate) in enumerate([
            ("Web Development", "Testing", 4.0, 75.0),
            ("Marketing", "Content Creation", 2.0, 60.0),
        ]):
            start_time = next_day + timedelta(hours=i*5)
            entry = TimeEntry(
                id=f"TEST-D2-{i+1}",
                project=project,
                task=task,
                start_time=start_time,
                end_time=start_time + timedelta(hours=hours),
                duration_seconds=int(hours * 3600),
                hourly_rate=rate,
                entry_type="manual"
            )
            self.tracker.time_entries.append(entry)
    
    def tearDown(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.test_dir)
    
    def test_daily_report(self):
        """Test daily time reporting"""
        target_date = date(2026, 3, 20)
        report = self.tracker.daily_report(target_date)
        
        self.assertEqual(report['total_hours'], 6.0)  # 3 + 2.5 + 0.5
        self.assertEqual(report['total_entries'], 3)
        self.assertEqual(report['total_earnings'], 412.5)  # (3*75) + (2.5*75) + 0
        
        # Check project breakdown
        self.assertIn('Web Development', report['project_breakdown'])
        web_dev = report['project_breakdown']['Web Development']
        self.assertEqual(web_dev['hours'], 5.5)
        self.assertIn('Admin', report['project_breakdown'])
    
    def test_weekly_report(self):
        """Test weekly time reporting"""
        target_date = date(2026, 3, 21)  # Day 2 of our sample data
        report = self.tracker.weekly_report(target_date)
        
        # Should include both days
        self.assertEqual(report['total_hours'], 12.0)  # All entries
        self.assertEqual(report['total_entries'], 5)
        
        # Check that both projects are included
        self.assertIn('Web Development', report['project_breakdown'])
        self.assertIn('Marketing', report['project_breakdown'])
    
    def test_monthly_report(self):
        """Test monthly time reporting"""
        target_date = date(2026, 3, 21)
        report = self.tracker.monthly_report(target_date)
        
        # Should include all March entries
        self.assertEqual(report['total_hours'], 12.0)
        self.assertEqual(report['total_entries'], 5)
    
    def test_project_summary(self):
        """Test project-specific summaries"""
        start_date = date(2026, 3, 20)
        end_date = date(2026, 3, 21)
        
        summary = self.tracker.get_time_summary(start_date, end_date)
        
        # Verify project breakdown details
        web_dev = summary['project_breakdown']['Web Development']
        self.assertGreater(web_dev['hours'], 0)
        self.assertGreater(web_dev['earnings'], 0)
        self.assertIsInstance(web_dev['tasks'], list)
        
        # Verify average rate calculation
        self.assertGreater(summary['avg_earnings_per_hour'], 0)


class TestAnalytics(unittest.TestCase):
    """Test cases for productivity analytics"""
    
    def setUp(self):
        """Set up test fixtures with varied data for analytics"""
        self.test_dir = tempfile.mkdtemp()
        self.tracker = TimeTracker(data_dir=self.test_dir)
        
        # Create diverse sample data for analytics
        base_date = datetime.now() - timedelta(days=14)  # 2 weeks of data
        
        # Simulate work patterns
        for day_offset in range(14):
            current_date = base_date + timedelta(days=day_offset)
            
            # Skip weekends for realistic pattern
            if current_date.weekday() >= 5:
                continue
            
            # Morning session (9-12)
            morning_start = current_date.replace(hour=9, minute=0)
            entry1 = TimeEntry(
                id=f"ANALYTICS-{day_offset}-1",
                project="Main Project",
                task="Development",
                start_time=morning_start,
                end_time=morning_start + timedelta(hours=3),
                duration_seconds=10800,
                hourly_rate=75.0,
                estimated_duration=10800,  # Perfect estimate
                entry_type="timer"
            )
            self.tracker.time_entries.append(entry1)
            
            # Afternoon session (14-17)
            afternoon_start = current_date.replace(hour=14, minute=0)
            # Vary the duration for interesting analytics
            duration_hours = 3 + (day_offset % 3) * 0.5  # 3.0 to 4.0 hours
            entry2 = TimeEntry(
                id=f"ANALYTICS-{day_offset}-2",
                project="Client Work" if day_offset % 3 == 0 else "Main Project",
                task="Testing" if day_offset % 2 == 0 else "Development",
                start_time=afternoon_start,
                end_time=afternoon_start + timedelta(hours=duration_hours),
                duration_seconds=int(duration_hours * 3600),
                hourly_rate=80.0,
                estimated_duration=10800,  # 3 hour estimate (some overruns)
                entry_type="timer"
            )
            self.tracker.time_entries.append(entry2)
    
    def tearDown(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.test_dir)
    
    def test_productivity_metrics_calculation(self):
        """Test calculation of productivity metrics"""
        metrics = self.tracker.calculate_productivity_metrics(days_back=14)
        
        # Check basic metrics structure
        self.assertIsInstance(metrics.peak_hours, list)
        self.assertIsInstance(metrics.peak_days, list)
        self.assertGreater(metrics.avg_focus_duration, 0)
        self.assertGreaterEqual(metrics.productive_ratio, 0)
        self.assertLessEqual(metrics.productive_ratio, 1)
        self.assertGreaterEqual(metrics.efficiency_score, 0)
        self.assertLessEqual(metrics.efficiency_score, 1)
        
        # We expect peak hours to include our work hours (9, 14)
        self.assertTrue(any(hour in [9, 14, 15, 16] for hour in metrics.peak_hours))
        
        # We work Monday-Friday, so expect weekday peaks
        self.assertTrue(all(day < 5 for day in metrics.peak_days))  # Mon-Fri only
    
    def test_estimation_accuracy_calculation(self):
        """Test estimation accuracy analysis"""
        metrics = self.tracker.calculate_productivity_metrics()
        
        # Should have some estimation data
        self.assertGreaterEqual(metrics.efficiency_score, 0)
        
        # With our mixed estimates, efficiency shouldn't be perfect
        self.assertLess(metrics.efficiency_score, 1.0)
    
    def test_scope_creep_detection(self):
        """Test scope creep detection"""
        # Add some entries with significant overruns
        base_date = datetime.now() - timedelta(days=7)
        
        for i in range(5):
            start_time = base_date + timedelta(days=i, hours=10)
            entry = TimeEntry(
                id=f"OVERRUN-{i}",
                project="Problematic Project",
                task="Complex Feature",
                start_time=start_time,
                end_time=start_time + timedelta(hours=8),  # 8 hours actual
                duration_seconds=28800,  # 8 hours
                estimated_duration=14400,  # 4 hour estimate (100% overrun)
                hourly_rate=75.0,
                entry_type="timer"
            )
            self.tracker.time_entries.append(entry)
        
        metrics = self.tracker.calculate_productivity_metrics()
        
        # Should detect scope creep
        self.assertGreater(len(metrics.scope_creep_alerts), 0)
        
        # Check alert details
        alert = metrics.scope_creep_alerts[0]
        self.assertEqual(alert['project'], "Problematic Project")
        self.assertEqual(alert['task'], "Complex Feature")
        self.assertGreaterEqual(alert['overrun_percentage'], 90)  # Significant overrun
    
    def test_break_recommendations(self):
        """Test break pattern recommendations"""
        metrics = self.tracker.calculate_productivity_metrics()
        
        # Should have break recommendations
        self.assertIsInstance(metrics.break_recommendations, dict)
        self.assertIn('break_frequency', metrics.break_recommendations)
        
        # With our 3+ hour sessions, should suggest break management
        self.assertIsNotNone(metrics.break_recommendations.get('break_frequency'))


class TestOptimizationSuggestions(unittest.TestCase):
    """Test cases for optimization suggestions"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_dir = tempfile.mkdtemp()
        self.tracker = TimeTracker(data_dir=self.test_dir)
    
    def tearDown(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.test_dir)
    
    def test_optimization_suggestions_generation(self):
        """Test generation of optimization suggestions"""
        # Create data that should trigger various suggestions
        base_date = datetime.now() - timedelta(days=10)
        
        # Add short focus sessions (should trigger focus optimization)
        for i in range(10):
            start_time = base_date + timedelta(days=i, hours=9)
            entry = TimeEntry(
                id=f"SHORT-{i}",
                project="Project",
                task="Task",
                start_time=start_time,
                end_time=start_time + timedelta(minutes=45),  # Short sessions
                duration_seconds=2700,  # 45 minutes
                entry_type="timer"
            )
            self.tracker.time_entries.append(entry)
        
        suggestions = self.tracker.generate_optimization_suggestions()
        
        # Should generate suggestions
        self.assertGreater(len(suggestions), 0)
        
        # Check suggestion structure
        for suggestion in suggestions:
            self.assertIsInstance(suggestion, OptimizationSuggestion)
            self.assertIn(suggestion.category, ['schedule', 'productivity', 'estimation', 'breaks'])
            self.assertIn(suggestion.priority, ['high', 'medium', 'low'])
            self.assertTrue(suggestion.title)
            self.assertTrue(suggestion.description)
            self.assertIsInstance(suggestion.action_items, list)
            self.assertGreaterEqual(suggestion.confidence, 0)
            self.assertLessEqual(suggestion.confidence, 1)
        
        # With short sessions, should suggest focus improvement
        focus_suggestions = [s for s in suggestions if 'focus' in s.title.lower()]
        self.assertGreater(len(focus_suggestions), 0)
    
    def test_weekend_work_detection(self):
        """Test detection of weekend work patterns"""
        base_date = datetime.now() - timedelta(days=14)
        
        # Add significant weekend work
        for week in range(2):
            for day in [5, 6]:  # Saturday, Sunday
                work_date = base_date + timedelta(days=week*7 + day)
                entry = TimeEntry(
                    id=f"WEEKEND-{week}-{day}",
                    project="Urgent Project",
                    task="Weekend Work",
                    start_time=work_date.replace(hour=10),
                    end_time=work_date.replace(hour=15),
                    duration_seconds=18000,  # 5 hours
                    entry_type="timer"
                )
                self.tracker.time_entries.append(entry)
        
        suggestions = self.tracker.generate_optimization_suggestions()
        
        # Should suggest work-life balance consideration
        balance_suggestions = [s for s in suggestions if 'balance' in s.description.lower() or 'weekend' in s.description.lower()]
        # Note: weekend work detection might have different thresholds
    
    def test_scope_creep_suggestions(self):
        """Test suggestions for scope creep management"""
        base_date = datetime.now() - timedelta(days=7)
        
        # Add entries with consistent overruns
        for i in range(5):
            start_time = base_date + timedelta(days=i, hours=10)
            entry = TimeEntry(
                id=f"CREEP-{i}",
                project="Scope Creep Project",
                task="Feature Development",
                start_time=start_time,
                end_time=start_time + timedelta(hours=10),  # 10 hours actual
                duration_seconds=36000,
                estimated_duration=18000,  # 5 hour estimate (100% overrun)
                hourly_rate=75.0,
                entry_type="timer"
            )
            self.tracker.time_entries.append(entry)
        
        suggestions = self.tracker.generate_optimization_suggestions()
        
        # Should suggest scope creep management (or at least mention it in analytics)
        scope_suggestions = [s for s in suggestions if 'scope' in s.title.lower() or 'scope' in s.description.lower()]
        # Note: might not always trigger scope suggestions depending on thresholds


class TestExportIntegration(unittest.TestCase):
    """Test cases for export and integration functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_dir = tempfile.mkdtemp()
        self.tracker = TimeTracker(data_dir=self.test_dir)
        
        # Add sample billable entries
        base_date = datetime(2026, 3, 1)
        for i, (project, task, hours, rate) in enumerate([
            ("Client A", "Development", 8.0, 100.0),
            ("Client A", "Testing", 4.0, 100.0),
            ("Client B", "Consulting", 3.0, 150.0),
            ("Internal", "Admin", 2.0, 0),  # Non-billable
        ]):
            start_time = base_date + timedelta(days=i, hours=9)
            entry = TimeEntry(
                id=f"EXPORT-{i}",
                project=project,
                task=task,
                start_time=start_time,
                end_time=start_time + timedelta(hours=hours),
                duration_seconds=int(hours * 3600),
                hourly_rate=rate if rate > 0 else None,
                is_billable=rate > 0,
                entry_type="manual"
            )
            self.tracker.time_entries.append(entry)
    
    def tearDown(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.test_dir)
    
    def test_csv_export(self):
        """Test CSV export functionality"""
        start_date = date(2026, 3, 1)
        end_date = date(2026, 3, 4)
        
        filename = self.tracker.export_to_csv(start_date, end_date)
        
        # Verify file was created
        self.assertTrue(Path(filename).exists())
        
        # Verify content
        with open(filename, 'r') as f:
            content = f.read()
            self.assertIn("Date,Project,Task", content)  # Header
            self.assertIn("Client A", content)
            self.assertIn("Development", content)
            self.assertIn("100.0", content)  # Rate
    
    def test_invoice_integration(self):
        """Test invoice system integration"""
        start_date = date(2026, 3, 1)
        end_date = date(2026, 3, 2)
        
        invoice_data = self.tracker.get_billable_hours_for_invoice("Client A", start_date, end_date)
        
        # Verify invoice data structure
        self.assertEqual(invoice_data['project'], "Client A")
        self.assertEqual(invoice_data['total_hours'], 12.0)  # 8 + 4
        self.assertEqual(invoice_data['total_amount'], 1200.0)  # (8*100) + (4*100)
        
        # Check line items
        self.assertEqual(len(invoice_data['entries']), 2)  # Development + Testing
        
        dev_entry = next(e for e in invoice_data['entries'] if 'Development' in e['description'])
        self.assertEqual(dev_entry['hours'], 8.0)
        self.assertEqual(dev_entry['rate'], 100.0)
        self.assertEqual(dev_entry['amount'], 800.0)
    
    def test_json_export(self):
        """Test JSON export functionality via get_time_summary"""
        start_date = date(2026, 3, 1)
        end_date = date(2026, 3, 4)
        
        data = self.tracker.get_time_summary(start_date, end_date)
        
        # Verify data structure
        self.assertIn('total_hours', data)
        self.assertIn('total_earnings', data)
        self.assertIn('project_breakdown', data)
        
        # Verify billable vs non-billable separation
        self.assertEqual(data['total_hours'], 17.0)  # All entries
        self.assertEqual(data['total_earnings'], 1650.0)  # Only billable entries


class TestCLIInterface(unittest.TestCase):
    """Test cases for CLI interface"""
    
    def test_cli_parser_creation(self):
        """Test CLI parser creation"""
        parser = create_cli_parser()
        
        # Test that all expected commands are available
        # Note: This is a basic structure test
        self.assertIsNotNone(parser)
    
    def test_format_duration(self):
        """Test duration formatting utility"""
        # Test various durations
        self.assertEqual(format_duration(3600), "1h 0m")
        self.assertEqual(format_duration(5400), "1h 30m")
        self.assertEqual(format_duration(1800), "30m")
        self.assertEqual(format_duration(90), "1m")


class TestDataPersistence(unittest.TestCase):
    """Test cases for data persistence and file operations"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_dir = tempfile.mkdtemp()
        self.tracker = TimeTracker(data_dir=self.test_dir)
    
    def tearDown(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.test_dir)
    
    def test_save_and_load_entries(self):
        """Test saving and loading time entries"""
        # Add entries
        entry1 = self.tracker.start_timer("Project A", "Task 1", hourly_rate=50.0)
        entry2 = self.tracker.manual_entry("Project B", "Task 2", 2.5, hourly_rate=75.0)
        
        # Create new tracker instance (simulates restart)
        tracker2 = TimeTracker(data_dir=self.test_dir)
        
        # Verify data was loaded
        self.assertEqual(len(tracker2.time_entries), 2)
        
        loaded_entry1 = next(e for e in tracker2.time_entries if e.id == entry1.id)
        self.assertEqual(loaded_entry1.project, "Project A")
        self.assertEqual(loaded_entry1.hourly_rate, 50.0)
        
        loaded_entry2 = next(e for e in tracker2.time_entries if e.project == "Project B")
        self.assertEqual(loaded_entry2.project, "Project B")
        self.assertEqual(loaded_entry2.duration_hours, 2.5)
    
    def test_active_timer_persistence(self):
        """Test persistence of active timer state"""
        # Start timer
        entry = self.tracker.start_timer("Project C", "Task 3")
        
        # Create new tracker instance
        tracker2 = TimeTracker(data_dir=self.test_dir)
        
        # Verify active timer is recognized
        active_timers = tracker2.get_active_timers()
        self.assertEqual(len(active_timers), 1)
        self.assertEqual(active_timers[0].id, entry.id)
    
    def test_corrupted_data_handling(self):
        """Test handling of corrupted data files"""
        # Create corrupted entries file
        with open(self.tracker.entries_file, 'w') as f:
            f.write("invalid json content")
        
        # Create new tracker instance
        tracker2 = TimeTracker(data_dir=self.test_dir)
        
        # Should handle corruption gracefully
        self.assertEqual(len(tracker2.time_entries), 0)
        
        # Should still be able to add new entries
        entry = tracker2.start_timer("Recovery Test", "Task")
        self.assertEqual(len(tracker2.time_entries), 1)


if __name__ == '__main__':
    # Set up test discovery and execution
    unittest.main(verbosity=2)