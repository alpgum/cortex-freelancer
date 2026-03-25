#!/usr/bin/env python3
"""
Comprehensive test suite for Invoice Automation system.

Covers:
- Invoice generation (line items, taxes, discounts, currencies, numbering)
- Payment tracking (status transitions, partial payments, balances)
- Follow-up sequences (tone escalation, late fees, email generation)
- Analytics & reporting (revenue, patterns, receivables)
- CLI interface (--create, --track, --followup, --report, --stdin)
- Edge cases (disputes, currency formatting, invalid inputs)
"""

import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from io import StringIO
from unittest.mock import patch

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from invoice_automation import (
    CURRENCY_SYMBOLS,
    DEFAULT_FOLLOWUP_SCHEDULE,
    INVOICE_STATUSES,
    TAX_RATES,
    VALID_TRANSITIONS,
    FollowUpGenerator,
    InvoiceAnalytics,
    InvoiceGenerator,
    InvoiceStore,
    PaymentTracker,
    format_currency,
    parse_date,
    handle_create,
    handle_track,
    handle_followup,
    handle_report,
    handle_stdin,
)


class TempStoreTestCase(unittest.TestCase):
    """Base class that provides a temp data dir and InvoiceStore."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.mkdtemp()
        self.store = InvoiceStore(self.tmp_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def _sample_input(self, **overrides) -> dict:
        base = {
            "client_name": "Acme Corp",
            "client_email": "billing@acme.com",
            "currency": "USD",
            "tax_type": "none",
            "due_days": 30,
            "line_items": [
                {"description": "Web Development", "quantity": 40, "rate": 150},
                {"description": "UI Design", "quantity": 10, "rate": 120},
            ],
        }
        base.update(overrides)
        return base


# =========================================================================
# Invoice Generation Tests
# =========================================================================

class TestInvoiceGeneration(TempStoreTestCase):
    """Tests for InvoiceGenerator."""

    def test_basic_creation(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())

        self.assertEqual(inv["client_name"], "Acme Corp")
        self.assertEqual(inv["status"], "draft")
        self.assertEqual(inv["currency"], "USD")
        self.assertEqual(len(inv["line_items"]), 2)
        # 40*150 + 10*120 = 7200
        self.assertAlmostEqual(inv["subtotal"], 7200.0)
        self.assertAlmostEqual(inv["total"], 7200.0)
        self.assertAlmostEqual(inv["amount_due"], 7200.0)
        self.assertAlmostEqual(inv["amount_paid"], 0.0)

    def test_invoice_numbering_sequential(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv1 = gen.create_invoice(self._sample_input())
        inv2 = gen.create_invoice(self._sample_input())
        # Second should have next sequential number
        self.assertIn("-0001", inv1["invoice_id"])
        self.assertIn("-0002", inv2["invoice_id"])

    def test_custom_invoice_id(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(invoice_id="CUSTOM-001"))
        self.assertEqual(inv["invoice_id"], "CUSTOM-001")

    def test_vat_tax_calculation(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(tax_type="vat_standard"))
        expected_tax = round(7200.0 * 0.20, 2)
        self.assertAlmostEqual(inv["tax_amount"], expected_tax)
        self.assertAlmostEqual(inv["total"], 7200.0 + expected_tax)

    def test_custom_tax_rate(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(custom_tax_rate=0.05))
        expected_tax = round(7200.0 * 0.05, 2)
        self.assertAlmostEqual(inv["tax_amount"], expected_tax)

    def test_discount_percent(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(discount_percent=10))
        # 7200 - 10% = 6480 taxable
        self.assertAlmostEqual(inv["discount"], 720.0)
        self.assertAlmostEqual(inv["total"], 6480.0)

    def test_discount_amount(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(discount_amount=500))
        self.assertAlmostEqual(inv["discount"], 500.0)
        self.assertAlmostEqual(inv["total"], 6700.0)

    def test_discount_with_tax(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(
            discount_percent=10, tax_type="vat_standard"
        ))
        # subtotal=7200, discount=720, taxable=6480, tax=1296, total=7776
        self.assertAlmostEqual(inv["subtotal"], 7200.0)
        self.assertAlmostEqual(inv["discount"], 720.0)
        self.assertAlmostEqual(inv["tax_amount"], 1296.0)
        self.assertAlmostEqual(inv["total"], 7776.0)

    def test_multiple_currencies(self) -> None:
        for currency in ["EUR", "GBP", "TRY", "JPY"]:
            gen = InvoiceGenerator(self.store)
            inv = gen.create_invoice(self._sample_input(currency=currency))
            self.assertEqual(inv["currency"], currency)

    def test_due_date_calculation(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(due_days=45))
        issue = parse_date(inv["issue_date"])
        due = parse_date(inv["due_date"])
        self.assertEqual((due - issue).days, 45)

    def test_line_item_amounts(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        self.assertAlmostEqual(inv["line_items"][0]["amount"], 6000.0)
        self.assertAlmostEqual(inv["line_items"][1]["amount"], 1200.0)

    def test_missing_client_name_raises(self) -> None:
        gen = InvoiceGenerator(self.store)
        with self.assertRaises(ValueError):
            gen.create_invoice({"line_items": [{"description": "x", "quantity": 1, "rate": 100}]})

    def test_missing_line_items_raises(self) -> None:
        gen = InvoiceGenerator(self.store)
        with self.assertRaises(ValueError):
            gen.create_invoice({"client_name": "Test"})

    def test_empty_line_items_raises(self) -> None:
        gen = InvoiceGenerator(self.store)
        with self.assertRaises(ValueError):
            gen.create_invoice({"client_name": "Test", "line_items": []})

    def test_line_item_missing_field_raises(self) -> None:
        gen = InvoiceGenerator(self.store)
        with self.assertRaises(ValueError):
            gen.create_invoice({
                "client_name": "Test",
                "line_items": [{"description": "x", "quantity": 1}],  # missing rate
            })

    def test_history_created(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        self.assertEqual(len(inv["history"]), 1)
        self.assertEqual(inv["history"][0]["action"], "created")

    def test_persistence(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        # Load from fresh store
        store2 = InvoiceStore(self.tmp_dir)
        loaded = store2.get_invoice(inv["invoice_id"])
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["client_name"], "Acme Corp")

    # Fix the broken test
    def test_missing_line_items_dict_raises(self) -> None:
        gen = InvoiceGenerator(self.store)
        with self.assertRaises(ValueError):
            gen.create_invoice({"client_name": "Test"})


# =========================================================================
# Markdown / PDF-JSON export
# =========================================================================

class TestExport(TempStoreTestCase):
    """Tests for export helpers."""

    def test_markdown_export(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        md = InvoiceGenerator.to_markdown(inv)
        self.assertIn("# Invoice", md)
        self.assertIn("Acme Corp", md)
        self.assertIn("Web Development", md)
        self.assertIn("$7,200.00", md)

    def test_markdown_with_tax(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(tax_type="vat_standard"))
        md = InvoiceGenerator.to_markdown(inv)
        self.assertIn("Tax", md)

    def test_markdown_with_discount(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(discount_percent=5))
        md = InvoiceGenerator.to_markdown(inv)
        self.assertIn("Discount", md)

    def test_pdf_json_export(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        pdf_data = InvoiceGenerator.to_pdf_json(inv)
        self.assertEqual(pdf_data["template"], "invoice")
        self.assertEqual(pdf_data["version"], "1.0")
        self.assertEqual(pdf_data["data"]["invoice_id"], inv["invoice_id"])


# =========================================================================
# Payment Tracking Tests
# =========================================================================

class TestPaymentTracking(TempStoreTestCase):
    """Tests for PaymentTracker."""

    def _create_sent_invoice(self, **overrides) -> dict:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(**overrides))
        tracker = PaymentTracker(self.store)
        return tracker.update_status(inv["invoice_id"], "sent")

    def test_send_invoice(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        tracker = PaymentTracker(self.store)
        updated = tracker.update_status(inv["invoice_id"], "sent")
        self.assertEqual(updated["status"], "sent")

    def test_full_payment(self) -> None:
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        updated = tracker.update_status(
            inv["invoice_id"], "paid", amount=7200.0, payment_method="wire"
        )
        self.assertEqual(updated["status"], "paid")
        self.assertAlmostEqual(updated["amount_paid"], 7200.0)
        self.assertAlmostEqual(updated["amount_due"], 0.0)

    def test_partial_payment(self) -> None:
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        updated = tracker.update_status(
            inv["invoice_id"], "partial", amount=3000.0
        )
        self.assertEqual(updated["status"], "partial")
        self.assertAlmostEqual(updated["amount_paid"], 3000.0)
        self.assertAlmostEqual(updated["amount_due"], 4200.0)

    def test_multiple_partial_payments(self) -> None:
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "partial", amount=2000.0)
        tracker.update_status(inv["invoice_id"], "partial", amount=2000.0)
        updated = tracker.update_status(inv["invoice_id"], "paid", amount=3200.0)
        self.assertEqual(updated["status"], "paid")
        self.assertAlmostEqual(updated["amount_paid"], 7200.0)
        self.assertAlmostEqual(updated["amount_due"], 0.0)

    def test_auto_paid_when_balance_zero(self) -> None:
        """Even if status says partial, if balance is zero it should be 'paid'."""
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        updated = tracker.update_status(
            inv["invoice_id"], "partial", amount=7200.0
        )
        self.assertEqual(updated["status"], "paid")

    def test_auto_partial_when_balance_remaining(self) -> None:
        """Even if status says paid, if balance remains it should be 'partial'."""
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        updated = tracker.update_status(
            inv["invoice_id"], "paid", amount=1000.0
        )
        self.assertEqual(updated["status"], "partial")

    def test_invalid_transition_raises(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        tracker = PaymentTracker(self.store)
        with self.assertRaises(ValueError):
            tracker.update_status(inv["invoice_id"], "paid")  # draft -> paid invalid

    def test_invalid_status_raises(self) -> None:
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        with self.assertRaises(ValueError):
            tracker.update_status(inv["invoice_id"], "nonexistent")

    def test_nonexistent_invoice_raises(self) -> None:
        tracker = PaymentTracker(self.store)
        with self.assertRaises(ValueError):
            tracker.update_status("FAKE-001", "sent")

    def test_overdue_transition(self) -> None:
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        updated = tracker.update_status(inv["invoice_id"], "overdue")
        self.assertEqual(updated["status"], "overdue")

    def test_dispute_from_sent(self) -> None:
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        updated = tracker.update_status(inv["invoice_id"], "disputed", notes="Client disputes hours")
        self.assertEqual(updated["status"], "disputed")

    def test_payment_history_recorded(self) -> None:
        inv = self._create_sent_invoice()
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "partial", amount=1000.0, payment_method="check")
        payments = self.store.payments_for(inv["invoice_id"])
        self.assertEqual(len(payments), 1)
        self.assertAlmostEqual(payments[0]["amount"], 1000.0)
        self.assertEqual(payments[0]["method"], "check")

    def test_get_outstanding(self) -> None:
        # Create 2 sent, 1 paid
        inv1 = self._create_sent_invoice()
        inv2 = self._create_sent_invoice()
        gen = InvoiceGenerator(self.store)
        inv3 = gen.create_invoice(self._sample_input())
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv3["invoice_id"], "sent")
        tracker.update_status(inv3["invoice_id"], "paid", amount=7200.0)

        outstanding = tracker.get_outstanding()
        outstanding_ids = [o["invoice_id"] for o in outstanding]
        self.assertIn(inv1["invoice_id"], outstanding_ids)
        self.assertIn(inv2["invoice_id"], outstanding_ids)
        self.assertEqual(len(outstanding), 2)

    def test_get_overdue(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(due_days=0))
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "sent")
        # Check "tomorrow" so it's overdue
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        overdue = tracker.get_overdue(as_of=tomorrow)
        self.assertEqual(len(overdue), 1)

    def test_client_reliability_score_no_data(self) -> None:
        tracker = PaymentTracker(self.store)
        score = tracker.client_reliability_score("Unknown Client")
        self.assertIsNone(score["score"])
        self.assertEqual(score["label"], "no_data")

    def test_client_reliability_score_excellent(self) -> None:
        gen = InvoiceGenerator(self.store)
        tracker = PaymentTracker(self.store)
        # Create and pay on time
        for _ in range(3):
            inv = gen.create_invoice(self._sample_input(due_days=30))
            tracker.update_status(inv["invoice_id"], "sent")
            today = datetime.now().strftime("%Y-%m-%d")
            tracker.update_status(inv["invoice_id"], "paid", amount=7200.0, date=today)

        score = tracker.client_reliability_score("Acme Corp")
        self.assertIsNotNone(score["score"])
        self.assertGreaterEqual(score["score"], 80)
        self.assertEqual(score["label"], "excellent")


# =========================================================================
# Follow-up Sequence Tests
# =========================================================================

class TestFollowUpSequences(TempStoreTestCase):
    """Tests for FollowUpGenerator."""

    def _create_overdue_invoice(self, days_overdue: int = 5) -> dict:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(due_days=0))
        # Manually set due_date to be days_overdue ago
        past_due = (datetime.now() - timedelta(days=days_overdue)).strftime("%Y-%m-%d")
        inv["due_date"] = past_due
        self.store.put_invoice(inv)
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "sent")
        return self.store.get_invoice(inv["invoice_id"])

    def test_determine_tone_friendly(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=4)
        fg = FollowUpGenerator(self.store)
        tone = fg.determine_tone(inv)
        self.assertEqual(tone, "friendly")

    def test_determine_tone_firm(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=10)
        fg = FollowUpGenerator(self.store)
        tone = fg.determine_tone(inv)
        self.assertEqual(tone, "firm")

    def test_determine_tone_urgent(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=20)
        fg = FollowUpGenerator(self.store)
        tone = fg.determine_tone(inv)
        self.assertEqual(tone, "urgent")

    def test_determine_tone_final(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=35)
        fg = FollowUpGenerator(self.store)
        tone = fg.determine_tone(inv)
        self.assertEqual(tone, "final")

    def test_determine_tone_not_overdue(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(due_days=30))
        fg = FollowUpGenerator(self.store)
        tone = fg.determine_tone(inv)
        self.assertIsNone(tone)

    def test_generate_followup_friendly(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=4)
        fg = FollowUpGenerator(self.store)
        fu = fg.generate_followup(inv)
        self.assertIsNotNone(fu)
        self.assertEqual(fu["tone"], "friendly")
        self.assertIn("friendly reminder", fu["body"].lower())
        self.assertIn(inv["invoice_id"], fu["subject"])

    def test_generate_followup_final(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=35)
        fg = FollowUpGenerator(self.store)
        fu = fg.generate_followup(inv)
        self.assertIsNotNone(fu)
        self.assertEqual(fu["tone"], "final")
        self.assertIn("FINAL NOTICE", fu["subject"])
        self.assertIn("further action", fu["body"])

    def test_tone_override(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=4)
        fg = FollowUpGenerator(self.store)
        fu = fg.generate_followup(inv, tone_override="urgent")
        self.assertEqual(fu["tone"], "urgent")

    def test_late_fee_calculation(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=30)
        fg = FollowUpGenerator(self.store, late_fee_rate=0.015)
        fee = fg.calculate_late_fee(inv)
        # ~1 month late, 1.5% of amount_due
        expected = round(inv["amount_due"] * 0.015 * 1.0, 2)
        self.assertAlmostEqual(fee, expected, places=0)

    def test_late_fee_zero_when_not_overdue(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(due_days=30))
        fg = FollowUpGenerator(self.store, late_fee_rate=0.015)
        fee = fg.calculate_late_fee(inv)
        self.assertEqual(fee, 0.0)

    def test_late_fee_in_followup_body(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=10)
        fg = FollowUpGenerator(self.store, late_fee_rate=0.02)
        fu = fg.generate_followup(inv)
        self.assertIn("late fee", fu["body"].lower())
        self.assertGreater(fu["late_fee"], 0)

    def test_no_late_fee_when_rate_zero(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=10)
        fg = FollowUpGenerator(self.store, late_fee_rate=0.0)
        fu = fg.generate_followup(inv)
        self.assertEqual(fu["late_fee"], 0.0)
        self.assertNotIn("late fee", fu["body"].lower())

    def test_generate_all_followups(self) -> None:
        self._create_overdue_invoice(days_overdue=5)
        self._create_overdue_invoice(days_overdue=15)
        fg = FollowUpGenerator(self.store)
        followups = fg.generate_all_followups()
        self.assertEqual(len(followups), 2)
        tones = {fu["tone"] for fu in followups}
        self.assertTrue(len(tones) >= 1)

    def test_no_followup_for_paid(self) -> None:
        inv = self._create_overdue_invoice(days_overdue=10)
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "paid", amount=7200.0)
        fg = FollowUpGenerator(self.store)
        followups = fg.generate_all_followups()
        ids = [fu["invoice_id"] for fu in followups]
        self.assertNotIn(inv["invoice_id"], ids)

    def test_followup_contains_currency_symbol(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(currency="EUR", due_days=0))
        past = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        inv["due_date"] = past
        self.store.put_invoice(inv)
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "sent")
        inv = self.store.get_invoice(inv["invoice_id"])

        fg = FollowUpGenerator(self.store)
        fu = fg.generate_followup(inv)
        self.assertIn("€", fu["body"])


# =========================================================================
# Analytics & Reporting Tests
# =========================================================================

class TestAnalytics(TempStoreTestCase):
    """Tests for InvoiceAnalytics."""

    def _create_paid_invoice(self, client: str = "Acme Corp", days_to_pay: int = 15, total: float = 7200.0) -> dict:
        gen = InvoiceGenerator(self.store)
        items = [{"description": "Work", "quantity": total / 150, "rate": 150}]
        inv = gen.create_invoice(self._sample_input(client_name=client, line_items=items))
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "sent")
        paid_date = (parse_date(inv["issue_date"]) + timedelta(days=days_to_pay)).strftime("%Y-%m-%d")
        tracker.update_status(inv["invoice_id"], "paid", amount=inv["total"], date=paid_date)
        return self.store.get_invoice(inv["invoice_id"])

    def test_avg_days_to_payment(self) -> None:
        self._create_paid_invoice("Client A", days_to_pay=10)
        self._create_paid_invoice("Client A", days_to_pay=20)
        self._create_paid_invoice("Client B", days_to_pay=5)

        analytics = InvoiceAnalytics(self.store)
        result = analytics.avg_days_to_payment()
        self.assertAlmostEqual(result["Client A"], 15.0)
        self.assertAlmostEqual(result["Client B"], 5.0)

    def test_avg_days_to_payment_filtered(self) -> None:
        self._create_paid_invoice("Client A", days_to_pay=10)
        self._create_paid_invoice("Client B", days_to_pay=5)

        analytics = InvoiceAnalytics(self.store)
        result = analytics.avg_days_to_payment("Client A")
        self.assertIn("Client A", result)
        self.assertNotIn("Client B", result)

    def test_outstanding_receivables(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv1 = gen.create_invoice(self._sample_input(client_name="A"))
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv1["invoice_id"], "sent")

        inv2 = gen.create_invoice(self._sample_input(client_name="B"))
        tracker.update_status(inv2["invoice_id"], "sent")
        tracker.update_status(inv2["invoice_id"], "paid", amount=7200.0)

        analytics = InvoiceAnalytics(self.store)
        receivables = analytics.outstanding_receivables()
        self.assertAlmostEqual(receivables["total_outstanding"], 7200.0)
        self.assertEqual(receivables["invoice_count"], 1)
        self.assertIn("A", receivables["by_client"])

    def test_revenue_by_period_monthly(self) -> None:
        self._create_paid_invoice("Client A", days_to_pay=1)
        analytics = InvoiceAnalytics(self.store)
        revenue = analytics.revenue_by_period("monthly")
        self.assertTrue(len(revenue) >= 1)
        self.assertTrue(any(v > 0 for v in revenue.values()))

    def test_revenue_by_period_quarterly(self) -> None:
        self._create_paid_invoice("Client A", days_to_pay=1)
        analytics = InvoiceAnalytics(self.store)
        revenue = analytics.revenue_by_period("quarterly")
        self.assertTrue(len(revenue) >= 1)
        keys = list(revenue.keys())
        self.assertTrue(keys[0].startswith("20"))
        self.assertIn("-Q", keys[0])

    def test_payment_patterns(self) -> None:
        self._create_paid_invoice("Fast Co", days_to_pay=5)
        self._create_paid_invoice("Slow Inc", days_to_pay=45)
        analytics = InvoiceAnalytics(self.store)
        patterns = analytics.payment_patterns()
        self.assertEqual(patterns["total_invoices_paid"], 2)
        self.assertEqual(patterns["fastest_paying_client"], "Fast Co")
        self.assertEqual(patterns["slowest_paying_client"], "Slow Inc")

    def test_generate_report_text(self) -> None:
        self._create_paid_invoice("Client A", days_to_pay=10)
        analytics = InvoiceAnalytics(self.store)
        report = analytics.generate_report()
        self.assertIn("Financial Report", report)
        self.assertIn("Outstanding Receivables", report)
        self.assertIn("Revenue by Period", report)
        self.assertIn("Payment Patterns", report)

    def test_empty_analytics(self) -> None:
        analytics = InvoiceAnalytics(self.store)
        receivables = analytics.outstanding_receivables()
        self.assertAlmostEqual(receivables["total_outstanding"], 0.0)
        patterns = analytics.payment_patterns()
        self.assertEqual(patterns["total_invoices_paid"], 0)


# =========================================================================
# Utility / Currency Tests
# =========================================================================

class TestUtilities(unittest.TestCase):
    """Tests for utility functions."""

    def test_format_currency_usd(self) -> None:
        self.assertEqual(format_currency(1234.56, "USD"), "$1,234.56")

    def test_format_currency_eur(self) -> None:
        self.assertEqual(format_currency(1234.56, "EUR"), "€1,234.56")

    def test_format_currency_gbp(self) -> None:
        self.assertEqual(format_currency(1234.56, "GBP"), "£1,234.56")

    def test_format_currency_try(self) -> None:
        self.assertEqual(format_currency(1234.56, "TRY"), "₺1,234.56")

    def test_format_currency_jpy_no_decimals(self) -> None:
        self.assertEqual(format_currency(1234, "JPY"), "¥1,234")

    def test_format_currency_unknown(self) -> None:
        result = format_currency(100.0, "XYZ")
        self.assertIn("XYZ", result)
        self.assertIn("100.00", result)

    def test_parse_date(self) -> None:
        dt = parse_date("2026-03-15")
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 3)
        self.assertEqual(dt.day, 15)


# =========================================================================
# CLI / Integration Tests
# =========================================================================

class TestCLI(TempStoreTestCase):
    """Tests for CLI handlers."""

    def test_handle_create(self) -> None:
        data = json.dumps(self._sample_input())
        with patch("sys.stdout", new_callable=StringIO) as mock_out:
            handle_create(data, self.store)
        output = json.loads(mock_out.getvalue())
        self.assertEqual(output["client_name"], "Acme Corp")
        self.assertEqual(output["status"], "draft")

    def test_handle_track(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        data = json.dumps({"invoice_id": inv["invoice_id"], "status": "sent"})
        with patch("sys.stdout", new_callable=StringIO) as mock_out:
            handle_track(data, self.store)
        output = json.loads(mock_out.getvalue())
        self.assertEqual(output["status"], "sent")

    def test_handle_followup_no_overdue(self) -> None:
        with patch("sys.stdout", new_callable=StringIO) as mock_out:
            handle_followup(self.store)
        self.assertIn("No overdue", mock_out.getvalue())

    def test_handle_report(self) -> None:
        with patch("sys.stdout", new_callable=StringIO) as mock_out:
            handle_report(self.store)
        self.assertIn("Financial Report", mock_out.getvalue())

    def test_handle_stdin_create(self) -> None:
        data = self._sample_input()
        data["action"] = "create"
        stdin_data = json.dumps(data)
        with patch("sys.stdin", StringIO(stdin_data)), \
             patch("sys.stdout", new_callable=StringIO) as mock_out:
            handle_stdin(self.store)
        output = json.loads(mock_out.getvalue())
        self.assertEqual(output["client_name"], "Acme Corp")

    def test_handle_stdin_track(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input())
        data = {"action": "track", "invoice_id": inv["invoice_id"], "status": "sent"}
        with patch("sys.stdin", StringIO(json.dumps(data))), \
             patch("sys.stdout", new_callable=StringIO) as mock_out:
            handle_stdin(self.store)
        output = json.loads(mock_out.getvalue())
        self.assertEqual(output["status"], "sent")

    def test_handle_stdin_unknown_action(self) -> None:
        data = {"action": "unknown"}
        with patch("sys.stdin", StringIO(json.dumps(data))), \
             self.assertRaises(SystemExit):
            handle_stdin(self.store)

    def test_handle_stdin_empty(self) -> None:
        with patch("sys.stdin", StringIO("")), \
             self.assertRaises(SystemExit):
            handle_stdin(self.store)


# =========================================================================
# Integration / Full Workflow Tests
# =========================================================================

class TestFullWorkflow(TempStoreTestCase):
    """End-to-end integration tests."""

    def test_create_send_pay_report(self) -> None:
        """Full lifecycle: create → send → pay → report."""
        gen = InvoiceGenerator(self.store)
        tracker = PaymentTracker(self.store)
        analytics = InvoiceAnalytics(self.store)

        # Create
        inv = gen.create_invoice(self._sample_input())
        self.assertEqual(inv["status"], "draft")

        # Send
        inv = tracker.update_status(inv["invoice_id"], "sent")
        self.assertEqual(inv["status"], "sent")

        # View
        inv = tracker.update_status(inv["invoice_id"], "viewed")
        self.assertEqual(inv["status"], "viewed")

        # Partial pay
        inv = tracker.update_status(inv["invoice_id"], "partial", amount=3000.0)
        self.assertEqual(inv["status"], "partial")
        self.assertAlmostEqual(inv["amount_due"], 4200.0)

        # Full pay
        inv = tracker.update_status(inv["invoice_id"], "paid", amount=4200.0)
        self.assertEqual(inv["status"], "paid")
        self.assertAlmostEqual(inv["amount_due"], 0.0)

        # Report
        report = analytics.generate_report()
        self.assertIn("Financial Report", report)

    def test_overdue_followup_workflow(self) -> None:
        """Create overdue invoice → generate follow-up → pay."""
        gen = InvoiceGenerator(self.store)
        tracker = PaymentTracker(self.store)

        inv = gen.create_invoice(self._sample_input(due_days=0))
        # Set past due date
        past = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        inv["due_date"] = past
        self.store.put_invoice(inv)
        tracker.update_status(inv["invoice_id"], "sent")

        # Generate follow-up
        fg = FollowUpGenerator(self.store, late_fee_rate=0.01)
        followups = fg.generate_all_followups()
        self.assertEqual(len(followups), 1)
        self.assertEqual(followups[0]["tone"], "firm")

        # Pay it
        tracker.update_status(inv["invoice_id"], "paid", amount=7200.0)

        # No more follow-ups
        followups2 = fg.generate_all_followups()
        self.assertEqual(len(followups2), 0)

    def test_multi_client_analytics(self) -> None:
        """Multiple clients with different payment behaviors."""
        gen = InvoiceGenerator(self.store)
        tracker = PaymentTracker(self.store)

        clients = [
            ("Fast LLC", 5),
            ("Fast LLC", 3),
            ("Slow Corp", 40),
            ("Slow Corp", 50),
        ]

        for client, days in clients:
            inv = gen.create_invoice(self._sample_input(client_name=client))
            tracker.update_status(inv["invoice_id"], "sent")
            paid_date = (parse_date(inv["issue_date"]) + timedelta(days=days)).strftime("%Y-%m-%d")
            tracker.update_status(inv["invoice_id"], "paid", amount=7200.0, date=paid_date)

        analytics = InvoiceAnalytics(self.store)
        patterns = analytics.payment_patterns()

        self.assertEqual(patterns["fastest_paying_client"], "Fast LLC")
        self.assertEqual(patterns["slowest_paying_client"], "Slow Corp")
        self.assertAlmostEqual(patterns["client_averages"]["Fast LLC"], 4.0)
        self.assertAlmostEqual(patterns["client_averages"]["Slow Corp"], 45.0)

    def test_dispute_resolution_workflow(self) -> None:
        """Invoice disputed then resolved and paid."""
        gen = InvoiceGenerator(self.store)
        tracker = PaymentTracker(self.store)

        inv = gen.create_invoice(self._sample_input())
        tracker.update_status(inv["invoice_id"], "sent")
        tracker.update_status(inv["invoice_id"], "disputed", notes="Hours disagreement")
        # Resolve: re-send then pay
        tracker.update_status(inv["invoice_id"], "sent", notes="Resolved, adjusted hours")
        inv = tracker.update_status(inv["invoice_id"], "paid", amount=7200.0)
        self.assertEqual(inv["status"], "paid")
        # History should show the dispute
        actions = [h["action"] for h in inv["history"]]
        self.assertTrue(any("disputed" in a for a in actions))


# =========================================================================
# Edge Case Tests
# =========================================================================

class TestEdgeCases(TempStoreTestCase):
    """Edge case and boundary tests."""

    def test_zero_quantity_line_item(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(
            line_items=[{"description": "Free consultation", "quantity": 0, "rate": 100}]
        ))
        self.assertAlmostEqual(inv["total"], 0.0)

    def test_very_large_amounts(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(
            line_items=[{"description": "Enterprise project", "quantity": 1, "rate": 999999.99}]
        ))
        self.assertAlmostEqual(inv["total"], 999999.99)

    def test_single_line_item(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(
            line_items=[{"description": "Consulting", "quantity": 1, "rate": 500}]
        ))
        self.assertAlmostEqual(inv["total"], 500.0)

    def test_many_line_items(self) -> None:
        items = [{"description": f"Item {i}", "quantity": 1, "rate": 10} for i in range(100)]
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(line_items=items))
        self.assertAlmostEqual(inv["total"], 1000.0)

    def test_fractional_quantities(self) -> None:
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(
            line_items=[{"description": "Hours", "quantity": 2.5, "rate": 100}]
        ))
        self.assertAlmostEqual(inv["total"], 250.0)

    def test_payment_exceeding_balance(self) -> None:
        """Overpayment should still mark as paid with 0 due."""
        gen = InvoiceGenerator(self.store)
        inv = gen.create_invoice(self._sample_input(
            line_items=[{"description": "Work", "quantity": 1, "rate": 100}]
        ))
        tracker = PaymentTracker(self.store)
        tracker.update_status(inv["invoice_id"], "sent")
        updated = tracker.update_status(inv["invoice_id"], "paid", amount=150.0)
        self.assertEqual(updated["status"], "paid")
        # amount_due goes negative but forced to 0 because status is paid
        self.assertAlmostEqual(updated["amount_due"], 0.0)

    def test_store_isolation(self) -> None:
        """Two stores with different dirs should be independent."""
        other_dir = tempfile.mkdtemp()
        try:
            store2 = InvoiceStore(other_dir)
            gen1 = InvoiceGenerator(self.store)
            gen2 = InvoiceGenerator(store2)
            gen1.create_invoice(self._sample_input(client_name="Store1"))
            gen2.create_invoice(self._sample_input(client_name="Store2"))
            self.assertEqual(len(self.store.all_invoices()), 1)
            self.assertEqual(len(store2.all_invoices()), 1)
        finally:
            shutil.rmtree(other_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
