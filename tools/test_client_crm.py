#!/usr/bin/env python3
"""
Comprehensive test suite for Client CRM with Relationship Scoring.
"""

import argparse
import csv
import json
import os
import sys
import tempfile
import shutil
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from io import StringIO

# Add project path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from client_crm import (
    Client, Communication, RedFlag, Project,
    CRMStore, CRMApp, RelationshipScorer, HealthMonitor,
    SCORING_WEIGHTS, LIFECYCLE_STAGES, PLATFORMS, BUDGET_TIERS,
    COMM_TYPES, RED_FLAG_TYPES, DORMANCY_THRESHOLDS,
    CADENCE_RECOMMENDATIONS,
)


class TestBase(unittest.TestCase):
    """Base test class with temporary data directory"""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.store = CRMStore(data_dir=self.test_dir)
        self.app = CRMApp(store=self.store)
        self.scorer = RelationshipScorer()
        self.health = HealthMonitor()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _make_client(self, name="Test Client", **kwargs) -> Client:
        defaults = {
            "id": "test001",
            "name": name,
            "company": "Test Co",
            "email": "test@example.com",
            "phone": "+1234567890",
            "platform": "direct",
            "stage": "active",
            "tags": ["web", "frontend"],
            "industry": "technology",
            "budget_tier": "mid",
            "communication_preference": "email",
            "payment_reliability": 80,
            "responsiveness": 70,
            "communication_quality": 75,
            "referral_potential": 60,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        defaults.update(kwargs)
        return Client(**defaults)

    def _make_comm(self, client_id="test001", **kwargs) -> Communication:
        defaults = {
            "id": "comm001",
            "client_id": client_id,
            "type": "email",
            "direction": "outbound",
            "subject": "Follow-up",
            "summary": "Discussed next steps",
            "date": datetime.now().isoformat(),
        }
        defaults.update(kwargs)
        return Communication(**defaults)


# ---------------------------------------------------------------------------
# Data Model Tests
# ---------------------------------------------------------------------------

class TestClientModel(TestBase):
    """Test Client data model"""

    def test_create_client(self):
        c = self._make_client()
        self.assertEqual(c.name, "Test Client")
        self.assertEqual(c.platform, "direct")
        self.assertEqual(c.stage, "active")

    def test_client_to_dict(self):
        c = self._make_client()
        d = c.to_dict()
        self.assertIsInstance(d, dict)
        self.assertEqual(d["name"], "Test Client")
        self.assertEqual(d["platform"], "direct")
        self.assertIn("tags", d)

    def test_client_from_dict(self):
        c = self._make_client()
        d = c.to_dict()
        c2 = Client.from_dict(d)
        self.assertEqual(c.name, c2.name)
        self.assertEqual(c.id, c2.id)
        self.assertEqual(c.tags, c2.tags)

    def test_client_from_dict_missing_fields(self):
        """from_dict should handle missing fields gracefully"""
        d = {"id": "x", "name": "Minimal"}
        c = Client.from_dict(d)
        self.assertEqual(c.name, "Minimal")
        self.assertEqual(c.stage, "lead")  # default
        self.assertEqual(c.tags, [])

    def test_total_revenue(self):
        c = self._make_client(projects=[
            {"name": "P1", "revenue": 1000, "status": "completed", "hours": 10, "start_date": "2024-01-01"},
            {"name": "P2", "revenue": 2000, "status": "completed", "hours": 20, "start_date": "2024-02-01"},
        ])
        self.assertEqual(c.total_revenue, 3000)

    def test_total_hours(self):
        c = self._make_client(projects=[
            {"name": "P1", "revenue": 1000, "hours": 10, "status": "completed", "start_date": "2024-01-01"},
            {"name": "P2", "revenue": 2000, "hours": 20, "status": "completed", "start_date": "2024-02-01"},
        ])
        self.assertEqual(c.total_hours, 30)

    def test_project_count(self):
        c = self._make_client(projects=[
            {"name": "P1", "revenue": 1000, "status": "completed", "start_date": "2024-01-01"},
        ])
        self.assertEqual(c.project_count, 1)

    def test_completed_projects(self):
        c = self._make_client(projects=[
            {"name": "P1", "status": "completed", "start_date": "2024-01-01"},
            {"name": "P2", "status": "active", "start_date": "2024-02-01"},
            {"name": "P3", "status": "cancelled", "start_date": "2024-03-01"},
        ])
        self.assertEqual(c.completed_projects, 1)

    def test_avg_project_revenue(self):
        c = self._make_client(projects=[
            {"name": "P1", "revenue": 1000, "status": "completed", "start_date": "2024-01-01"},
            {"name": "P2", "revenue": 3000, "status": "completed", "start_date": "2024-02-01"},
        ])
        self.assertEqual(c.avg_project_revenue, 2000)

    def test_avg_project_revenue_no_projects(self):
        c = self._make_client()
        self.assertEqual(c.avg_project_revenue, 0.0)

    def test_red_flag_count(self):
        c = self._make_client(red_flags=[
            {"type": "late_payment", "description": "30 days late", "date": "2024-01-01"},
            {"type": "scope_creep", "description": "Added 3 new features", "date": "2024-02-01"},
        ])
        self.assertEqual(c.red_flag_count, 2)

    def test_scope_creep_count(self):
        c = self._make_client(red_flags=[
            {"type": "scope_creep", "description": "A", "date": "2024-01-01"},
            {"type": "scope_creep", "description": "B", "date": "2024-02-01"},
            {"type": "late_payment", "description": "C", "date": "2024-03-01"},
        ])
        self.assertEqual(c.scope_creep_count, 2)
        self.assertEqual(c.late_payment_count, 1)


class TestCommunicationModel(TestBase):
    """Test Communication data model"""

    def test_create_comm(self):
        cm = self._make_comm()
        self.assertEqual(cm.type, "email")
        self.assertEqual(cm.direction, "outbound")

    def test_comm_to_dict(self):
        cm = self._make_comm()
        d = cm.to_dict()
        self.assertIsInstance(d, dict)
        self.assertEqual(d["type"], "email")

    def test_comm_from_dict(self):
        cm = self._make_comm()
        d = cm.to_dict()
        cm2 = Communication.from_dict(d)
        self.assertEqual(cm.id, cm2.id)
        self.assertEqual(cm.client_id, cm2.client_id)


# ---------------------------------------------------------------------------
# Storage Tests
# ---------------------------------------------------------------------------

class TestCRMStore(TestBase):
    """Test JSON file-based storage"""

    def test_add_and_load_client(self):
        c = self._make_client()
        self.store.add_client(c)
        loaded = self.store.load_clients()
        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[0].name, "Test Client")

    def test_get_client_by_id(self):
        c = self._make_client(id="abc123")
        self.store.add_client(c)
        found = self.store.get_client("abc123")
        self.assertIsNotNone(found)
        self.assertEqual(found.name, "Test Client")

    def test_get_client_by_name(self):
        c = self._make_client()
        self.store.add_client(c)
        found = self.store.get_client("Test Client")
        self.assertIsNotNone(found)

    def test_get_client_partial_match(self):
        c = self._make_client(name="John Doe Corporation")
        self.store.add_client(c)
        found = self.store.get_client("john doe")
        self.assertIsNotNone(found)

    def test_get_client_not_found(self):
        found = self.store.get_client("nonexistent")
        self.assertIsNone(found)

    def test_update_client(self):
        c = self._make_client()
        self.store.add_client(c)
        c.company = "Updated Co"
        self.store.update_client(c)
        loaded = self.store.get_client(c.id)
        self.assertEqual(loaded.company, "Updated Co")

    def test_delete_client(self):
        c = self._make_client()
        self.store.add_client(c)
        result = self.store.delete_client(c.id)
        self.assertTrue(result)
        self.assertEqual(len(self.store.load_clients()), 0)

    def test_delete_nonexistent(self):
        result = self.store.delete_client("nonexistent")
        self.assertFalse(result)

    def test_add_and_load_communication(self):
        cm = self._make_comm()
        self.store.add_communication(cm)
        loaded = self.store.load_communications()
        self.assertEqual(len(loaded), 1)

    def test_get_client_comms(self):
        cm1 = self._make_comm(id="c1", client_id="client_a")
        cm2 = self._make_comm(id="c2", client_id="client_b")
        cm3 = self._make_comm(id="c3", client_id="client_a")
        self.store.add_communication(cm1)
        self.store.add_communication(cm2)
        self.store.add_communication(cm3)
        comms = self.store.get_client_comms("client_a")
        self.assertEqual(len(comms), 2)

    def test_get_last_contact(self):
        cm1 = self._make_comm(id="c1", date="2024-01-01T10:00:00")
        cm2 = self._make_comm(id="c2", date="2024-06-15T10:00:00")
        self.store.add_communication(cm1)
        self.store.add_communication(cm2)
        last = self.store.get_last_contact("test001")
        self.assertEqual(last.id, "c2")

    def test_get_last_contact_no_comms(self):
        last = self.store.get_last_contact("nonexistent")
        self.assertIsNone(last)

    def test_empty_file_handling(self):
        """Loading from nonexistent file returns empty list"""
        clients = self.store.load_clients()
        self.assertEqual(clients, [])

    def test_corrupt_json_handling(self):
        """Loading corrupt JSON returns empty list"""
        with open(self.store.clients_file, "w") as f:
            f.write("not valid json{{{")
        clients = self.store.load_clients()
        self.assertEqual(clients, [])

    def test_multiple_clients(self):
        for i in range(5):
            c = self._make_client(id=f"id{i}", name=f"Client {i}")
            self.store.add_client(c)
        self.assertEqual(len(self.store.load_clients()), 5)


# ---------------------------------------------------------------------------
# Relationship Scoring Tests
# ---------------------------------------------------------------------------

class TestRelationshipScorer(TestBase):
    """Test scoring algorithm"""

    def test_basic_score(self):
        c = self._make_client()
        result = self.scorer.calculate(c, [])
        self.assertIn("score", result)
        self.assertIn("factors", result)
        self.assertIn("grade", result)
        self.assertTrue(0 <= result["score"] <= 100)

    def test_high_score_client(self):
        c = self._make_client(
            payment_reliability=95,
            responsiveness=90,
            communication_quality=90,
            referral_potential=85,
            budget_tier="enterprise",
            projects=[
                {"name": f"P{i}", "status": "completed", "revenue": 5000,
                 "hours": 20, "start_date": "2024-01-01"}
                for i in range(8)
            ],
        )
        result = self.scorer.calculate(c, [])
        self.assertGreaterEqual(result["score"], 80)
        self.assertIn(result["grade"], ["A+", "A"])

    def test_low_score_client(self):
        c = self._make_client(
            payment_reliability=20,
            responsiveness=15,
            communication_quality=20,
            referral_potential=10,
            budget_tier="low",
            red_flags=[
                {"type": "late_payment", "description": "x", "date": "2024-01-01"},
                {"type": "late_payment", "description": "x", "date": "2024-02-01"},
                {"type": "scope_creep", "description": "x", "date": "2024-03-01"},
                {"type": "scope_creep", "description": "x", "date": "2024-04-01"},
            ],
        )
        result = self.scorer.calculate(c, [])
        self.assertLessEqual(result["score"], 30)
        self.assertIn(result["grade"], ["D", "F"])

    def test_payment_penalty(self):
        """Late payments reduce payment reliability score"""
        c1 = self._make_client(id="c1", payment_reliability=80)
        c2 = self._make_client(id="c2", payment_reliability=80, red_flags=[
            {"type": "late_payment", "description": "x", "date": "2024-01-01"},
            {"type": "late_payment", "description": "x", "date": "2024-02-01"},
        ])
        r1 = self.scorer.calculate(c1, [])
        r2 = self.scorer.calculate(c2, [])
        self.assertGreater(r1["factors"]["payment_reliability"],
                          r2["factors"]["payment_reliability"])

    def test_scope_creep_penalty(self):
        c = self._make_client(red_flags=[
            {"type": "scope_creep", "description": "x", "date": "2024-01-01"},
            {"type": "scope_creep", "description": "x", "date": "2024-02-01"},
            {"type": "scope_creep", "description": "x", "date": "2024-03-01"},
        ])
        result = self.scorer.calculate(c, [])
        self.assertLessEqual(result["factors"]["scope_creep_history"], 40)

    def test_referral_bonus(self):
        c = self._make_client(referral_potential=50, referrals=["ref1", "ref2"])
        result = self.scorer.calculate(c, [])
        self.assertEqual(result["factors"]["referral_potential"], 70)

    def test_project_frequency_scores(self):
        """More projects = higher frequency score"""
        c0 = self._make_client(id="c0")
        c1 = self._make_client(id="c1", projects=[
            {"name": "P1", "status": "completed", "start_date": "2024-01-01"},
        ])
        c5 = self._make_client(id="c5", projects=[
            {"name": f"P{i}", "status": "completed", "start_date": "2024-01-01"}
            for i in range(5)
        ])
        s0 = self.scorer.calculate(c0, [])["factors"]["project_frequency"]
        s1 = self.scorer.calculate(c1, [])["factors"]["project_frequency"]
        s5 = self.scorer.calculate(c5, [])["factors"]["project_frequency"]
        self.assertLess(s0, s1)
        self.assertLess(s1, s5)

    def test_budget_tier_scores(self):
        for tier, expected in [("low", 25), ("mid", 50), ("high", 75), ("enterprise", 100)]:
            c = self._make_client(id=f"bt_{tier}", budget_tier=tier)
            result = self.scorer.calculate(c, [])
            self.assertEqual(result["factors"]["budget_tier"], expected)

    def test_grade_boundaries(self):
        self.assertEqual(RelationshipScorer._grade(95), "A+")
        self.assertEqual(RelationshipScorer._grade(85), "A")
        self.assertEqual(RelationshipScorer._grade(75), "B")
        self.assertEqual(RelationshipScorer._grade(65), "C")
        self.assertEqual(RelationshipScorer._grade(50), "D")
        self.assertEqual(RelationshipScorer._grade(30), "F")

    def test_weights_sum_to_one(self):
        total = sum(SCORING_WEIGHTS.values())
        self.assertAlmostEqual(total, 1.0, places=5)

    def test_score_details_warnings(self):
        c = self._make_client(
            payment_reliability=20,
            responsiveness=20,
            red_flags=[
                {"type": "scope_creep", "description": "x", "date": "2024-01-01"},
                {"type": "scope_creep", "description": "x", "date": "2024-02-01"},
                {"type": "scope_creep", "description": "x", "date": "2024-03-01"},
            ],
        )
        result = self.scorer.calculate(c, [])
        # Should have at least 2 warning details
        self.assertGreaterEqual(len(result["details"]), 2)


# ---------------------------------------------------------------------------
# Health Monitor Tests
# ---------------------------------------------------------------------------

class TestHealthMonitor(TestBase):
    """Test dormancy detection and health monitoring"""

    def test_healthy_client(self):
        c = self._make_client(stage="active")
        comm = self._make_comm(date=datetime.now().isoformat())
        status = self.health.check_dormancy(c, comm)
        self.assertEqual(status["status"], "healthy")

    def test_at_risk_client(self):
        c = self._make_client(stage="active")
        old_date = (datetime.now() - timedelta(days=45)).isoformat()
        comm = self._make_comm(date=old_date)
        status = self.health.check_dormancy(c, comm)
        self.assertEqual(status["status"], "at_risk")
        self.assertIn("action", status)

    def test_warning_client(self):
        c = self._make_client(stage="active")
        # 70% of 30 days = 21 days — just past the warning threshold
        warn_date = (datetime.now() - timedelta(days=23)).isoformat()
        comm = self._make_comm(date=warn_date)
        status = self.health.check_dormancy(c, comm)
        self.assertEqual(status["status"], "warning")

    def test_no_contact(self):
        c = self._make_client()
        status = self.health.check_dormancy(c, None)
        self.assertEqual(status["status"], "no_contact")

    def test_already_dormant(self):
        c = self._make_client(stage="dormant")
        status = self.health.check_dormancy(c, None)
        self.assertEqual(status["status"], "already_dormant")

    def test_already_lost(self):
        c = self._make_client(stage="lost")
        status = self.health.check_dormancy(c, None)
        self.assertEqual(status["status"], "already_dormant")

    def test_champion_longer_threshold(self):
        """Champions have a longer dormancy threshold (60 days)"""
        c = self._make_client(stage="champion")
        # 35 days ago — still healthy for champion (threshold=60, warning at 42)
        date = (datetime.now() - timedelta(days=35)).isoformat()
        comm = self._make_comm(date=date)
        status = self.health.check_dormancy(c, comm)
        self.assertEqual(status["status"], "healthy")

    def test_lead_shorter_threshold(self):
        """Leads have a shorter threshold (14 days)"""
        c = self._make_client(stage="lead")
        date = (datetime.now() - timedelta(days=20)).isoformat()
        comm = self._make_comm(date=date)
        status = self.health.check_dormancy(c, comm)
        self.assertEqual(status["status"], "at_risk")

    def test_cadence_recommendation(self):
        for stage in LIFECYCLE_STAGES:
            c = self._make_client(stage=stage)
            rec = self.health.cadence_recommendation(c)
            self.assertIn("days", rec)

    def test_client_value_analysis(self):
        c = self._make_client(
            stage="repeat",
            projects=[
                {"name": "P1", "revenue": 2000, "hours": 20, "status": "completed", "start_date": "2024-01-01"},
                {"name": "P2", "revenue": 3000, "hours": 30, "status": "completed", "start_date": "2024-03-01"},
            ],
        )
        value = self.health.client_value_analysis(c)
        self.assertEqual(value["total_revenue"], 5000)
        self.assertEqual(value["avg_project_revenue"], 2500)
        self.assertEqual(value["project_count"], 2)
        self.assertGreater(value["projected_ltv"], 5000)
        self.assertEqual(value["effective_hourly_rate"], 100)

    def test_value_analysis_no_projects(self):
        c = self._make_client()
        value = self.health.client_value_analysis(c)
        self.assertEqual(value["total_revenue"], 0)
        self.assertEqual(value["effective_hourly_rate"], 0)


# ---------------------------------------------------------------------------
# CRM App Integration Tests
# ---------------------------------------------------------------------------

class TestCRMAppCommands(TestBase):
    """Test CLI commands via programmatic API"""

    def test_add_noninteractive(self):
        client = self.app.cmd_add_noninteractive(
            name="Alice Smith",
            company="Alice Co",
            email="alice@example.com",
            platform="upwork",
            stage="active",
            budget_tier="high",
            tags=["design", "branding"],
        )
        self.assertIsNotNone(client)
        self.assertEqual(client.name, "Alice Smith")
        self.assertEqual(client.platform, "upwork")
        loaded = self.store.load_clients()
        self.assertEqual(len(loaded), 1)

    def test_add_with_invalid_platform(self):
        client = self.app.cmd_add_noninteractive(
            name="Bob", platform="invalid_platform"
        )
        self.assertEqual(client.platform, "other")

    def test_add_with_invalid_stage(self):
        client = self.app.cmd_add_noninteractive(
            name="Bob", stage="invalid_stage"
        )
        self.assertEqual(client.stage, "lead")

    def test_add_referral_tracking(self):
        c1 = self.app.cmd_add_noninteractive(name="Referrer")
        c2 = self.app.cmd_add_noninteractive(name="Referred", referred_by=c1.id)
        # Reload referrer
        referrer = self.store.get_client(c1.id)
        self.assertIn(c2.id, referrer.referrals)

    def test_log_noninteractive(self):
        client = self.app.cmd_add_noninteractive(name="Tester")
        comm = self.app.cmd_log_noninteractive(
            client.id, comm_type="call", direction="outbound",
            subject="Intro call", summary="Discussed project scope",
        )
        self.assertIsNotNone(comm)
        self.assertEqual(comm.type, "call")
        comms = self.store.get_client_comms(client.id)
        self.assertEqual(len(comms), 1)

    def test_log_invalid_client(self):
        comm = self.app.cmd_log_noninteractive("nonexistent")
        self.assertIsNone(comm)

    def test_add_project(self):
        client = self.app.cmd_add_noninteractive(name="Tester")
        result = self.app.add_project(
            client.id, name="Website Redesign",
            revenue=5000, hours=40, status="completed",
        )
        self.assertTrue(result)
        loaded = self.store.get_client(client.id)
        self.assertEqual(len(loaded.projects), 1)
        self.assertEqual(loaded.total_revenue, 5000)

    def test_add_red_flag(self):
        client = self.app.cmd_add_noninteractive(name="Tester")
        result = self.app.add_red_flag(
            client.id, "late_payment",
            description="Invoice #123 — 30 days overdue", severity=3,
        )
        self.assertTrue(result)
        loaded = self.store.get_client(client.id)
        self.assertEqual(len(loaded.red_flags), 1)
        self.assertEqual(loaded.red_flags[0]["severity"], 3)

    def test_add_red_flag_invalid_type(self):
        client = self.app.cmd_add_noninteractive(name="Tester")
        result = self.app.add_red_flag(client.id, "made_up_flag")
        self.assertTrue(result)
        loaded = self.store.get_client(client.id)
        self.assertEqual(loaded.red_flags[0]["type"], "other")

    def test_add_red_flag_invalid_client(self):
        result = self.app.add_red_flag("nonexistent", "late_payment")
        self.assertFalse(result)

    def test_export_csv(self):
        self.app.cmd_add_noninteractive(name="Export Test", tags=["web", "api"])
        csv_str = self.app.export_to_string()
        self.assertIn("Export Test", csv_str)
        self.assertIn("web;api", csv_str)

    def test_cmd_list_output(self):
        self.app.cmd_add_noninteractive(name="Client A", stage="active")
        self.app.cmd_add_noninteractive(name="Client B", stage="lead")

        args = argparse.Namespace(stage=None, tag=None, platform=None,
                                  score_min=None, score_max=None)
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_list(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("Client A", output)
        self.assertIn("Client B", output)

    def test_cmd_list_filter_stage(self):
        self.app.cmd_add_noninteractive(name="Active One", stage="active")
        self.app.cmd_add_noninteractive(name="Lead One", stage="lead")

        args = argparse.Namespace(stage="active", tag=None, platform=None,
                                  score_min=None, score_max=None)
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_list(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("Active One", output)
        self.assertNotIn("Lead One", output)

    def test_cmd_list_filter_tag(self):
        self.app.cmd_add_noninteractive(name="Tagged", tags=["design"])
        self.app.cmd_add_noninteractive(name="No Tag")

        args = argparse.Namespace(stage=None, tag="design", platform=None,
                                  score_min=None, score_max=None)
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_list(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("Tagged", output)
        self.assertNotIn("No Tag", output)

    def test_cmd_list_empty(self):
        args = argparse.Namespace(stage=None, tag=None, platform=None,
                                  score_min=None, score_max=None)
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_list(args)
        sys.stdout = sys.__stdout__
        self.assertIn("No clients", captured.getvalue())

    def test_cmd_show_output(self):
        client = self.app.cmd_add_noninteractive(
            name="Show Me", company="ShowCo", stage="active",
        )
        self.app.add_project(client.id, "Project X", revenue=3000, hours=25)
        self.app.cmd_log_noninteractive(client.id, subject="Hello")

        args = argparse.Namespace(id=client.id)
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_show(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("Show Me", output)
        self.assertIn("ShowCo", output)
        self.assertIn("Project X", output)
        self.assertIn("$3,000", output)

    def test_cmd_show_not_found(self):
        args = argparse.Namespace(id="nonexistent")
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_show(args)
        sys.stdout = sys.__stdout__
        self.assertIn("not found", captured.getvalue())

    def test_cmd_score_output(self):
        client = self.app.cmd_add_noninteractive(name="Score Me")
        args = argparse.Namespace(id=client.id)
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_score(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("Score", output)
        self.assertIn("/100", output)

    def test_cmd_health_output(self):
        client = self.app.cmd_add_noninteractive(name="Health Client", stage="active")
        # No comms → should show as no_contact / warning
        args = argparse.Namespace()
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_health(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("Health", output)

    def test_cmd_dormant_output(self):
        client = self.app.cmd_add_noninteractive(name="Dormant Client", stage="active")
        # Old communication
        self.app.cmd_log_noninteractive(
            client.id, date_str=(datetime.now() - timedelta(days=60)).isoformat(),
        )
        args = argparse.Namespace()
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_dormant(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("Dormant Client", output)

    def test_cmd_dormant_all_healthy(self):
        client = self.app.cmd_add_noninteractive(name="Healthy", stage="active")
        self.app.cmd_log_noninteractive(client.id, date_str=datetime.now().isoformat())
        args = argparse.Namespace()
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_dormant(args)
        sys.stdout = sys.__stdout__
        self.assertIn("healthy", captured.getvalue())

    def test_cmd_stats_output(self):
        c1 = self.app.cmd_add_noninteractive(name="Stats A", stage="active", platform="upwork")
        c2 = self.app.cmd_add_noninteractive(name="Stats B", stage="repeat", platform="direct")
        self.app.add_project(c1.id, "P1", revenue=2000, hours=20)
        self.app.add_project(c2.id, "P2", revenue=5000, hours=30)
        self.app.cmd_log_noninteractive(c1.id, comm_type="email")
        self.app.cmd_log_noninteractive(c2.id, comm_type="call")

        args = argparse.Namespace()
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_stats(args)
        sys.stdout = sys.__stdout__
        output = captured.getvalue()
        self.assertIn("$7,000", output)
        self.assertIn("upwork", output)

    def test_cmd_import(self):
        # Create CSV to import
        csv_path = os.path.join(self.test_dir, "import_test.csv")
        with open(csv_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["name", "company", "email", "platform", "stage", "tags"])
            writer.writerow(["Imported A", "Co A", "a@test.com", "fiverr", "lead", "web;design"])
            writer.writerow(["Imported B", "Co B", "b@test.com", "direct", "active", "api"])

        args = argparse.Namespace(file=csv_path)
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_import(args)
        sys.stdout = sys.__stdout__

        clients = self.store.load_clients()
        self.assertEqual(len(clients), 2)
        self.assertEqual(clients[0].name, "Imported A")
        self.assertEqual(clients[0].platform, "fiverr")
        self.assertEqual(clients[0].tags, ["web", "design"])

    def test_cmd_import_file_not_found(self):
        args = argparse.Namespace(file="/nonexistent/path.csv")
        captured = StringIO()
        sys.stdout = captured
        self.app.cmd_import(args)
        sys.stdout = sys.__stdout__
        self.assertIn("not found", captured.getvalue())


# ---------------------------------------------------------------------------
# Constants & Configuration Tests
# ---------------------------------------------------------------------------

class TestConstants(unittest.TestCase):
    """Verify configuration constants"""

    def test_lifecycle_stages(self):
        expected = ["lead", "prospect", "active", "repeat", "champion", "dormant", "lost"]
        self.assertEqual(LIFECYCLE_STAGES, expected)

    def test_scoring_weights_sum(self):
        self.assertAlmostEqual(sum(SCORING_WEIGHTS.values()), 1.0, places=5)

    def test_dormancy_thresholds_positive(self):
        for stage, days in DORMANCY_THRESHOLDS.items():
            self.assertGreater(days, 0)
            self.assertIn(stage, LIFECYCLE_STAGES)

    def test_cadence_recommendations_positive(self):
        for stage, days in CADENCE_RECOMMENDATIONS.items():
            self.assertGreater(days, 0)
            self.assertIn(stage, LIFECYCLE_STAGES)

    def test_platforms(self):
        self.assertIn("upwork", PLATFORMS)
        self.assertIn("fiverr", PLATFORMS)
        self.assertIn("direct", PLATFORMS)

    def test_budget_tiers(self):
        self.assertEqual(BUDGET_TIERS, ["low", "mid", "high", "enterprise"])


# ---------------------------------------------------------------------------
# Edge Cases
# ---------------------------------------------------------------------------

class TestEdgeCases(TestBase):
    """Test edge cases and boundary conditions"""

    def test_score_clamping(self):
        """Scores should never exceed 100 or go below 0"""
        c = self._make_client(
            payment_reliability=200,  # intentionally over 100
            responsiveness=200,
            communication_quality=200,
            referral_potential=200,
        )
        result = self.scorer.calculate(c, [])
        self.assertLessEqual(result["score"], 100)
        for v in result["factors"].values():
            self.assertLessEqual(v, 100)
            self.assertGreaterEqual(v, 0)

    def test_score_floor(self):
        """Extreme penalties should not go below 0"""
        c = self._make_client(
            payment_reliability=10,
            red_flags=[
                {"type": "late_payment", "description": "x", "date": "2024-01-01"}
                for _ in range(10)
            ],
        )
        result = self.scorer.calculate(c, [])
        self.assertGreaterEqual(result["factors"]["payment_reliability"], 0)

    def test_severity_clamping(self):
        client = self.app.cmd_add_noninteractive(name="Sev Test")
        self.app.add_red_flag(client.id, "late_payment", severity=10)
        loaded = self.store.get_client(client.id)
        self.assertEqual(loaded.red_flags[0]["severity"], 5)

    def test_severity_floor(self):
        client = self.app.cmd_add_noninteractive(name="Sev Test 2")
        self.app.add_red_flag(client.id, "late_payment", severity=-5)
        loaded = self.store.get_client(client.id)
        self.assertEqual(loaded.red_flags[0]["severity"], 1)

    def test_invalid_date_in_dormancy(self):
        c = self._make_client()
        comm = self._make_comm(date="not-a-date")
        status = self.health.check_dormancy(c, comm)
        self.assertEqual(status["status"], "unknown")

    def test_concurrent_json_writes(self):
        """Multiple writes should not corrupt data"""
        for i in range(10):
            self.app.cmd_add_noninteractive(name=f"Client {i}")
        clients = self.store.load_clients()
        self.assertEqual(len(clients), 10)

    def test_special_characters_in_name(self):
        client = self.app.cmd_add_noninteractive(
            name="José María O'Brien-López",
            company="Über Café™",
            notes="Notes with \"quotes\" and 'apostrophes'",
        )
        loaded = self.store.get_client(client.id)
        self.assertEqual(loaded.name, "José María O'Brien-López")
        self.assertEqual(loaded.company, "Über Café™")

    def test_empty_projects_list(self):
        c = self._make_client()
        self.assertEqual(c.total_revenue, 0)
        self.assertEqual(c.total_hours, 0)
        self.assertEqual(c.avg_project_revenue, 0)

    def test_value_analysis_with_different_stages(self):
        """LTV projection varies by stage"""
        for stage in LIFECYCLE_STAGES:
            c = self._make_client(
                id=f"va_{stage}", stage=stage,
                projects=[{"name": "P", "revenue": 1000, "hours": 10,
                          "status": "completed", "start_date": "2024-01-01"}],
            )
            value = self.health.client_value_analysis(c)
            self.assertGreaterEqual(value["projected_ltv"], 0)


# ---------------------------------------------------------------------------
# CLI Parser Tests
# ---------------------------------------------------------------------------

class TestCLIParser(unittest.TestCase):
    """Test argparse configuration"""

    def test_parser_creation(self):
        from client_crm import build_parser
        parser = build_parser()
        self.assertIsNotNone(parser)

    def test_list_args(self):
        from client_crm import build_parser
        parser = build_parser()
        args = parser.parse_args(["list", "--stage", "active", "--tag", "web"])
        self.assertEqual(args.command, "list")
        self.assertEqual(args.stage, "active")
        self.assertEqual(args.tag, "web")

    def test_show_args(self):
        from client_crm import build_parser
        parser = build_parser()
        args = parser.parse_args(["show", "abc123"])
        self.assertEqual(args.command, "show")
        self.assertEqual(args.id, "abc123")

    def test_score_args(self):
        from client_crm import build_parser
        parser = build_parser()
        args = parser.parse_args(["score", "abc123"])
        self.assertEqual(args.command, "score")
        self.assertEqual(args.id, "abc123")

    def test_export_args(self):
        from client_crm import build_parser
        parser = build_parser()
        args = parser.parse_args(["export", "--output", "out.csv"])
        self.assertEqual(args.command, "export")
        self.assertEqual(args.output, "out.csv")

    def test_import_args(self):
        from client_crm import build_parser
        parser = build_parser()
        args = parser.parse_args(["import", "data.csv"])
        self.assertEqual(args.command, "import")
        self.assertEqual(args.file, "data.csv")

    def test_no_command(self):
        from client_crm import build_parser
        parser = build_parser()
        args = parser.parse_args([])
        self.assertIsNone(args.command)


# ---------------------------------------------------------------------------
# Formatting Tests
# ---------------------------------------------------------------------------

class TestFormatters(unittest.TestCase):
    """Test output formatting functions"""

    def test_format_score_bar(self):
        from client_crm import format_score_bar
        bar = format_score_bar(75)
        self.assertIn("75", bar)

    def test_format_stage_badge(self):
        from client_crm import format_stage_badge
        for stage in LIFECYCLE_STAGES:
            badge = format_stage_badge(stage)
            self.assertIn(stage.upper(), badge)

    def test_format_health_indicator(self):
        from client_crm import format_health_indicator
        for status in ["healthy", "warning", "at_risk", "no_contact"]:
            indicator = format_health_indicator(status)
            self.assertIsInstance(indicator, str)
            self.assertTrue(len(indicator) > 0)

    def test_format_currency(self):
        from client_crm import format_currency
        self.assertEqual(format_currency(1500), "$1,500")
        self.assertEqual(format_currency(99.5), "$99.50")
        self.assertEqual(format_currency(0), "$0.00")


if __name__ == "__main__":
    unittest.main(verbosity=2)
