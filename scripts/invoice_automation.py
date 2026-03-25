#!/usr/bin/env python3
"""
Invoice Automation with Payment Tracking and Follow-up Sequences.

A comprehensive invoice management system for freelancers featuring:
- Professional invoice generation with multi-currency and tax support
- Payment status tracking with full lifecycle management
- Smart follow-up sequences with escalating tone
- Financial analytics and reporting

Usage:
    python invoice_automation.py --create '{"client_name": "Acme Corp", ...}'
    python invoice_automation.py --track '{"invoice_id": "INV-2026-0001", "status": "paid", ...}'
    python invoice_automation.py --followup
    python invoice_automation.py --report
    echo '{"action": "create", ...}' | python invoice_automation.py --stdin
"""

import argparse
import json
import os
import sys
import hashlib
import copy
from datetime import datetime, timedelta
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Tuple,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INVOICE_STATUSES = [
    "draft",
    "sent",
    "viewed",
    "partial",
    "paid",
    "overdue",
    "disputed",
]

VALID_TRANSITIONS: Dict[str, List[str]] = {
    "draft": ["sent", "disputed"],
    "sent": ["viewed", "partial", "paid", "overdue", "disputed"],
    "viewed": ["partial", "paid", "overdue", "disputed"],
    "partial": ["partial", "paid", "overdue", "disputed"],
    "overdue": ["partial", "paid", "disputed"],
    "disputed": ["partial", "paid", "sent"],
}

DEFAULT_FOLLOWUP_SCHEDULE = [
    {"days_after_due": 3, "tone": "friendly"},
    {"days_after_due": 7, "tone": "firm"},
    {"days_after_due": 14, "tone": "urgent"},
    {"days_after_due": 30, "tone": "final"},
]

TAX_RATES: Dict[str, float] = {
    "vat_standard": 0.20,
    "vat_reduced": 0.10,
    "vat_zero": 0.0,
    "sales_tax_us": 0.0875,
    "gst": 0.10,
    "none": 0.0,
}

CURRENCY_SYMBOLS: Dict[str, str] = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "TRY": "₺",
    "CAD": "CA$",
    "AUD": "A$",
    "JPY": "¥",
    "CHF": "CHF",
    "INR": "₹",
    "BRL": "R$",
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def find_project_root() -> str:
    """Find the cortex-freelancer project root."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(script_dir)


def find_data_dir() -> str:
    """Locate the data directory, creating it if needed."""
    root = find_project_root()
    data_dir = os.path.join(root, "data")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def load_json(filepath: str) -> Optional[Any]:
    """Load a JSON file, returning None on failure."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def save_json(filepath: str, data: Any) -> None:
    """Persist data as formatted JSON."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


def today_str() -> str:
    """Return today's date as YYYY-MM-DD."""
    return datetime.now().strftime("%Y-%m-%d")


def parse_date(date_str: str) -> datetime:
    """Parse a YYYY-MM-DD string into a datetime."""
    return datetime.strptime(date_str, "%Y-%m-%d")


def format_currency(amount: float, currency: str = "USD") -> str:
    """Format a monetary amount with the appropriate currency symbol."""
    symbol = CURRENCY_SYMBOLS.get(currency, currency + " ")
    if currency == "JPY":
        return f"{symbol}{amount:,.0f}"
    return f"{symbol}{amount:,.2f}"


# ---------------------------------------------------------------------------
# Invoice Store — simple JSON file-backed persistence
# ---------------------------------------------------------------------------

class InvoiceStore:
    """File-backed store for invoices and payment history."""

    def __init__(self, data_dir: Optional[str] = None) -> None:
        self.data_dir = data_dir or find_data_dir()
        self.invoices_file = os.path.join(self.data_dir, "invoices.json")
        self.payments_file = os.path.join(self.data_dir, "payments.json")
        self._invoices: Optional[Dict[str, Any]] = None
        self._payments: Optional[List[Dict[str, Any]]] = None

    # -- invoices ----------------------------------------------------------

    @property
    def invoices(self) -> Dict[str, Any]:
        if self._invoices is None:
            self._invoices = load_json(self.invoices_file) or {}
        return self._invoices

    def save_invoices(self) -> None:
        save_json(self.invoices_file, self.invoices)

    def get_invoice(self, invoice_id: str) -> Optional[Dict[str, Any]]:
        return self.invoices.get(invoice_id)

    def put_invoice(self, invoice: Dict[str, Any]) -> None:
        self.invoices[invoice["invoice_id"]] = invoice
        self.save_invoices()

    def all_invoices(self) -> List[Dict[str, Any]]:
        return list(self.invoices.values())

    # -- payments ----------------------------------------------------------

    @property
    def payments(self) -> List[Dict[str, Any]]:
        if self._payments is None:
            self._payments = load_json(self.payments_file) or []
        return self._payments

    def save_payments(self) -> None:
        save_json(self.payments_file, self.payments)

    def add_payment(self, entry: Dict[str, Any]) -> None:
        self.payments.append(entry)
        self.save_payments()

    def payments_for(self, invoice_id: str) -> List[Dict[str, Any]]:
        return [p for p in self.payments if p.get("invoice_id") == invoice_id]

    # -- next invoice number -----------------------------------------------

    def next_invoice_number(self, prefix: str = "INV", year: Optional[int] = None) -> str:
        """Generate the next sequential invoice ID like INV-2026-0001."""
        yr = year or datetime.now().year
        pattern = f"{prefix}-{yr}-"
        max_seq = 0
        for iid in self.invoices:
            if iid.startswith(pattern):
                try:
                    seq = int(iid[len(pattern):])
                    max_seq = max(max_seq, seq)
                except ValueError:
                    pass
        return f"{pattern}{max_seq + 1:04d}"


# ---------------------------------------------------------------------------
# Invoice Generator
# ---------------------------------------------------------------------------

class InvoiceGenerator:
    """Creates professional invoices from structured input."""

    def __init__(self, store: Optional[InvoiceStore] = None) -> None:
        self.store = store or InvoiceStore()

    def create_invoice(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create an invoice from input data.

        Required fields:
            client_name, line_items (list of {description, quantity, rate})

        Optional fields:
            client_email, currency (default USD), tax_type (default none),
            custom_tax_rate, due_days (default 30), notes, invoice_id,
            prefix, payment_terms, discount_percent, discount_amount
        """
        # Validate required fields
        if not data.get("client_name"):
            raise ValueError("client_name is required")
        if not data.get("line_items") or not isinstance(data["line_items"], list):
            raise ValueError("line_items (non-empty list) is required")

        for i, item in enumerate(data["line_items"]):
            for field in ("description", "quantity", "rate"):
                if field not in item:
                    raise ValueError(f"line_items[{i}] missing '{field}'")

        currency = data.get("currency", "USD")
        tax_type = data.get("tax_type", "none")
        tax_rate = data.get("custom_tax_rate", TAX_RATES.get(tax_type, 0.0))
        due_days = data.get("due_days", 30)
        prefix = data.get("prefix", "INV")
        invoice_id = data.get("invoice_id") or self.store.next_invoice_number(prefix)

        # Calculate line item totals
        line_items: List[Dict[str, Any]] = []
        subtotal = 0.0
        for item in data["line_items"]:
            qty = float(item["quantity"])
            rate = float(item["rate"])
            amount = round(qty * rate, 2)
            subtotal += amount
            line_items.append({
                "description": item["description"],
                "quantity": qty,
                "rate": rate,
                "amount": amount,
            })

        subtotal = round(subtotal, 2)

        # Discount
        discount = 0.0
        if data.get("discount_percent"):
            discount = round(subtotal * float(data["discount_percent"]) / 100, 2)
        elif data.get("discount_amount"):
            discount = round(float(data["discount_amount"]), 2)

        taxable = round(subtotal - discount, 2)
        tax_amount = round(taxable * tax_rate, 2)
        total = round(taxable + tax_amount, 2)

        now = datetime.now()
        due_date = (now + timedelta(days=due_days)).strftime("%Y-%m-%d")

        invoice: Dict[str, Any] = {
            "invoice_id": invoice_id,
            "status": "draft",
            "client_name": data["client_name"],
            "client_email": data.get("client_email", ""),
            "currency": currency,
            "line_items": line_items,
            "subtotal": subtotal,
            "discount": discount,
            "tax_type": tax_type,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total": total,
            "amount_paid": 0.0,
            "amount_due": total,
            "issue_date": now.strftime("%Y-%m-%d"),
            "due_date": due_date,
            "due_days": due_days,
            "payment_terms": data.get("payment_terms", f"Net {due_days}"),
            "notes": data.get("notes", ""),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "history": [
                {"date": now.isoformat(), "action": "created", "details": "Invoice created"}
            ],
        }

        self.store.put_invoice(invoice)
        return invoice

    # -- export helpers ----------------------------------------------------

    @staticmethod
    def to_markdown(invoice: Dict[str, Any]) -> str:
        """Render an invoice as Markdown."""
        cur = invoice.get("currency", "USD")
        lines = [
            f"# Invoice {invoice['invoice_id']}",
            "",
            f"**Client:** {invoice['client_name']}",
        ]
        if invoice.get("client_email"):
            lines.append(f"**Email:** {invoice['client_email']}")
        lines += [
            f"**Issue Date:** {invoice['issue_date']}",
            f"**Due Date:** {invoice['due_date']}",
            f"**Payment Terms:** {invoice.get('payment_terms', '')}",
            f"**Status:** {invoice['status'].upper()}",
            "",
            "## Line Items",
            "",
            "| Description | Qty | Rate | Amount |",
            "|---|---|---|---|",
        ]
        for item in invoice["line_items"]:
            lines.append(
                f"| {item['description']} | {item['quantity']} "
                f"| {format_currency(item['rate'], cur)} "
                f"| {format_currency(item['amount'], cur)} |"
            )
        lines += [
            "",
            f"**Subtotal:** {format_currency(invoice['subtotal'], cur)}",
        ]
        if invoice.get("discount", 0) > 0:
            lines.append(f"**Discount:** -{format_currency(invoice['discount'], cur)}")
        if invoice.get("tax_amount", 0) > 0:
            pct = invoice.get("tax_rate", 0) * 100
            lines.append(f"**Tax ({pct:.1f}%):** {format_currency(invoice['tax_amount'], cur)}")
        lines += [
            f"**Total:** {format_currency(invoice['total'], cur)}",
            f"**Amount Paid:** {format_currency(invoice.get('amount_paid', 0), cur)}",
            f"**Amount Due:** {format_currency(invoice.get('amount_due', invoice['total']), cur)}",
        ]
        if invoice.get("notes"):
            lines += ["", f"**Notes:** {invoice['notes']}"]
        return "\n".join(lines)

    @staticmethod
    def to_pdf_json(invoice: Dict[str, Any]) -> Dict[str, Any]:
        """Return a PDF-ready JSON structure (suitable for external renderers)."""
        return {
            "template": "invoice",
            "version": "1.0",
            "data": invoice,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "generator": "cortex-freelancer-invoice-automation",
            },
        }


# ---------------------------------------------------------------------------
# Payment Tracker
# ---------------------------------------------------------------------------

class PaymentTracker:
    """Manages payment status transitions and recording."""

    def __init__(self, store: Optional[InvoiceStore] = None) -> None:
        self.store = store or InvoiceStore()

    def update_status(
        self,
        invoice_id: str,
        new_status: str,
        amount: Optional[float] = None,
        payment_method: str = "",
        notes: str = "",
        date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transition an invoice to a new status, optionally recording a payment.

        Returns the updated invoice dict.
        """
        invoice = self.store.get_invoice(invoice_id)
        if invoice is None:
            raise ValueError(f"Invoice {invoice_id} not found")

        old_status = invoice["status"]
        if new_status not in INVOICE_STATUSES:
            raise ValueError(f"Invalid status '{new_status}'. Must be one of {INVOICE_STATUSES}")

        allowed = VALID_TRANSITIONS.get(old_status, [])
        if new_status not in allowed:
            raise ValueError(
                f"Cannot transition from '{old_status}' to '{new_status}'. "
                f"Allowed: {allowed}"
            )

        now = datetime.now()
        ts = now.isoformat()
        payment_date = date or now.strftime("%Y-%m-%d")

        # Record payment if amount provided
        if amount is not None and amount > 0:
            payment_entry = {
                "invoice_id": invoice_id,
                "date": payment_date,
                "amount": round(amount, 2),
                "method": payment_method,
                "notes": notes,
                "recorded_at": ts,
            }
            self.store.add_payment(payment_entry)
            invoice["amount_paid"] = round(invoice.get("amount_paid", 0) + amount, 2)
            invoice["amount_due"] = round(invoice["total"] - invoice["amount_paid"], 2)

        # Clamp amount_due to zero minimum
        if invoice["amount_due"] < 0:
            invoice["amount_due"] = 0.0

        # Auto-determine status based on payment
        if new_status in ("paid", "partial") and amount is not None:
            if invoice["amount_due"] <= 0:
                new_status = "paid"
                invoice["amount_due"] = 0.0
            else:
                new_status = "partial"

        invoice["status"] = new_status
        invoice["updated_at"] = ts
        invoice["history"].append({
            "date": ts,
            "action": f"status_change:{old_status}->{new_status}",
            "details": notes or f"Status changed to {new_status}",
            "amount": amount,
        })

        if new_status == "paid" and not invoice.get("paid_date"):
            invoice["paid_date"] = payment_date

        self.store.put_invoice(invoice)
        return invoice

    def get_outstanding(self) -> List[Dict[str, Any]]:
        """Return all invoices with outstanding balances."""
        return [
            inv for inv in self.store.all_invoices()
            if inv.get("amount_due", 0) > 0 and inv["status"] not in ("draft", "paid", "disputed")
        ]

    def get_overdue(self, as_of: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return invoices past their due date that are not paid."""
        ref = parse_date(as_of) if as_of else datetime.now()
        overdue = []
        for inv in self.store.all_invoices():
            if inv["status"] in ("paid", "draft", "disputed"):
                continue
            due = parse_date(inv["due_date"])
            if ref > due and inv.get("amount_due", 0) > 0:
                overdue.append(inv)
        return overdue

    def client_reliability_score(self, client_name: str) -> Dict[str, Any]:
        """
        Score a client's payment reliability (0-100).

        Factors: on-time %, average days late, dispute history.
        """
        client_invoices = [
            inv for inv in self.store.all_invoices()
            if inv["client_name"] == client_name and inv["status"] in ("paid", "partial", "overdue")
        ]

        if not client_invoices:
            return {
                "client_name": client_name,
                "score": None,
                "label": "no_data",
                "invoices_analyzed": 0,
            }

        total = len(client_invoices)
        on_time = 0
        days_late_list: List[int] = []
        disputes = 0

        for inv in client_invoices:
            due = parse_date(inv["due_date"])
            paid_date = inv.get("paid_date")
            if paid_date:
                paid = parse_date(paid_date)
                days_late = (paid - due).days
                if days_late <= 0:
                    on_time += 1
                    days_late_list.append(0)
                else:
                    days_late_list.append(days_late)
            # Count any invoice that was ever disputed
            for h in inv.get("history", []):
                if "disputed" in h.get("action", ""):
                    disputes += 1
                    break

        on_time_pct = (on_time / total) * 100 if total else 0
        avg_days_late = sum(days_late_list) / len(days_late_list) if days_late_list else 0
        dispute_pct = (disputes / total) * 100 if total else 0

        # Score: start at 100, deduct for lateness and disputes
        score = 100.0
        score -= (100 - on_time_pct) * 0.5  # up to -50 for never on time
        score -= min(avg_days_late * 1.0, 30)  # up to -30 for avg 30+ days late
        score -= dispute_pct * 0.2  # up to -20 for all disputed
        score = max(0, min(100, round(score)))

        if score >= 80:
            label = "excellent"
        elif score >= 60:
            label = "good"
        elif score >= 40:
            label = "fair"
        else:
            label = "poor"

        return {
            "client_name": client_name,
            "score": score,
            "label": label,
            "invoices_analyzed": total,
            "on_time_percent": round(on_time_pct, 1),
            "avg_days_late": round(avg_days_late, 1),
            "dispute_percent": round(dispute_pct, 1),
        }


# ---------------------------------------------------------------------------
# Follow-up Sequence Generator
# ---------------------------------------------------------------------------

class FollowUpGenerator:
    """Generates escalating follow-up emails for overdue invoices."""

    TEMPLATES: Dict[str, Dict[str, str]] = {
        "friendly": {
            "subject": "Friendly Reminder: Invoice {invoice_id} — Payment Due",
            "body": (
                "Hi {client_name},\n\n"
                "I hope you're doing well! I wanted to send a quick, friendly reminder "
                "that invoice {invoice_id} for {total} was due on {due_date}. "
                "It's now {days_overdue} days past due with {amount_due} remaining.\n\n"
                "If you've already sent the payment, please disregard this message. "
                "Otherwise, I'd appreciate it if you could process it at your earliest convenience.\n\n"
                "Let me know if you have any questions!\n\n"
                "Best regards"
            ),
        },
        "firm": {
            "subject": "Payment Reminder: Invoice {invoice_id} — {days_overdue} Days Overdue",
            "body": (
                "Dear {client_name},\n\n"
                "I'm writing to follow up on invoice {invoice_id} for {total}, "
                "which was due on {due_date}. The outstanding balance of {amount_due} "
                "is now {days_overdue} days overdue.\n\n"
                "Prompt payment would be greatly appreciated. If there are any issues "
                "with the invoice or you need to discuss payment arrangements, "
                "please let me know as soon as possible.\n\n"
                "{late_fee_note}"
                "Thank you for your attention to this matter.\n\n"
                "Regards"
            ),
        },
        "urgent": {
            "subject": "URGENT: Invoice {invoice_id} — {days_overdue} Days Past Due",
            "body": (
                "Dear {client_name},\n\n"
                "This is an urgent reminder regarding invoice {invoice_id} for {total}. "
                "The outstanding amount of {amount_due} is now {days_overdue} days past the due date "
                "of {due_date}.\n\n"
                "I must receive payment or a confirmed payment plan within the next 7 days. "
                "Failure to respond may result in additional late fees and suspension of ongoing work.\n\n"
                "{late_fee_note}"
                "Please treat this as a priority.\n\n"
                "Regards"
            ),
        },
        "final": {
            "subject": "FINAL NOTICE: Invoice {invoice_id} — Immediate Payment Required",
            "body": (
                "Dear {client_name},\n\n"
                "This is a final notice regarding the unpaid invoice {invoice_id} for {total}. "
                "Despite previous reminders, the balance of {amount_due} remains unpaid, "
                "now {days_overdue} days past the due date of {due_date}.\n\n"
                "If full payment is not received within 7 days, I will be forced to consider "
                "further action, which may include engaging a collections service or pursuing "
                "legal remedies.\n\n"
                "{late_fee_note}"
                "I sincerely hope we can resolve this amicably. Please respond immediately.\n\n"
                "Regards"
            ),
        },
    }

    def __init__(
        self,
        store: Optional[InvoiceStore] = None,
        schedule: Optional[List[Dict[str, Any]]] = None,
        late_fee_rate: float = 0.0,
    ) -> None:
        self.store = store or InvoiceStore()
        self.tracker = PaymentTracker(self.store)
        self.schedule = schedule or DEFAULT_FOLLOWUP_SCHEDULE
        self.late_fee_rate = late_fee_rate  # monthly percentage (e.g., 0.015 = 1.5%)

    def calculate_late_fee(self, invoice: Dict[str, Any], as_of: Optional[str] = None) -> float:
        """Calculate accumulated late fee for an overdue invoice."""
        if self.late_fee_rate <= 0:
            return 0.0
        ref = parse_date(as_of) if as_of else datetime.now()
        due = parse_date(invoice["due_date"])
        if ref <= due:
            return 0.0
        days_late = (ref - due).days
        months_late = days_late / 30.0
        fee = invoice.get("amount_due", invoice["total"]) * self.late_fee_rate * months_late
        return round(fee, 2)

    def determine_tone(self, invoice: Dict[str, Any], as_of: Optional[str] = None) -> Optional[str]:
        """Determine the appropriate follow-up tone based on how overdue."""
        ref = parse_date(as_of) if as_of else datetime.now()
        due = parse_date(invoice["due_date"])
        days_overdue = (ref - due).days
        if days_overdue <= 0:
            return None

        chosen_tone = None
        for step in sorted(self.schedule, key=lambda s: s["days_after_due"]):
            if days_overdue >= step["days_after_due"]:
                chosen_tone = step["tone"]
        return chosen_tone

    def generate_followup(
        self,
        invoice: Dict[str, Any],
        as_of: Optional[str] = None,
        tone_override: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a follow-up message for a given invoice.

        Returns a dict with subject, body, tone, days_overdue, late_fee or None.
        """
        ref = parse_date(as_of) if as_of else datetime.now()
        due = parse_date(invoice["due_date"])
        days_overdue = (ref - due).days

        if days_overdue <= 0:
            return None

        tone = tone_override or self.determine_tone(invoice, as_of)
        if tone is None:
            return None

        template = self.TEMPLATES.get(tone, self.TEMPLATES["friendly"])
        currency = invoice.get("currency", "USD")
        late_fee = self.calculate_late_fee(invoice, as_of)

        late_fee_note = ""
        if late_fee > 0:
            late_fee_note = (
                f"Please note that a late fee of {format_currency(late_fee, currency)} "
                f"has accrued on this invoice.\n\n"
            )

        fmt_vars = {
            "client_name": invoice["client_name"],
            "invoice_id": invoice["invoice_id"],
            "total": format_currency(invoice["total"], currency),
            "amount_due": format_currency(invoice.get("amount_due", invoice["total"]), currency),
            "due_date": invoice["due_date"],
            "days_overdue": days_overdue,
            "late_fee_note": late_fee_note,
        }

        return {
            "invoice_id": invoice["invoice_id"],
            "client_name": invoice["client_name"],
            "client_email": invoice.get("client_email", ""),
            "tone": tone,
            "days_overdue": days_overdue,
            "late_fee": late_fee,
            "subject": template["subject"].format(**fmt_vars),
            "body": template["body"].format(**fmt_vars),
            "generated_at": datetime.now().isoformat(),
        }

    def generate_all_followups(self, as_of: Optional[str] = None) -> List[Dict[str, Any]]:
        """Generate follow-ups for all overdue invoices."""
        overdue = self.tracker.get_overdue(as_of)
        followups = []
        for inv in overdue:
            fu = self.generate_followup(inv, as_of)
            if fu:
                followups.append(fu)
        return followups


# ---------------------------------------------------------------------------
# Analytics & Reporting
# ---------------------------------------------------------------------------

class InvoiceAnalytics:
    """Financial analytics and reporting for invoices."""

    def __init__(self, store: Optional[InvoiceStore] = None) -> None:
        self.store = store or InvoiceStore()

    def avg_days_to_payment(self, client_name: Optional[str] = None) -> Dict[str, float]:
        """
        Calculate average days from issue to payment.

        If client_name given, filter to that client. Returns dict keyed by client.
        """
        result: Dict[str, List[int]] = {}
        for inv in self.store.all_invoices():
            if inv["status"] != "paid" or not inv.get("paid_date"):
                continue
            if client_name and inv["client_name"] != client_name:
                continue
            issued = parse_date(inv["issue_date"])
            paid = parse_date(inv["paid_date"])
            days = (paid - issued).days
            result.setdefault(inv["client_name"], []).append(days)

        return {
            name: round(sum(days) / len(days), 1)
            for name, days in result.items()
        }

    def outstanding_receivables(self) -> Dict[str, Any]:
        """Dashboard data for outstanding receivables."""
        total_outstanding = 0.0
        by_client: Dict[str, float] = {}
        by_status: Dict[str, float] = {}
        invoices_detail: List[Dict[str, Any]] = []

        for inv in self.store.all_invoices():
            due = inv.get("amount_due", 0)
            if due <= 0 or inv["status"] in ("paid", "draft"):
                continue
            total_outstanding += due
            by_client[inv["client_name"]] = by_client.get(inv["client_name"], 0) + due
            by_status[inv["status"]] = by_status.get(inv["status"], 0) + due
            invoices_detail.append({
                "invoice_id": inv["invoice_id"],
                "client_name": inv["client_name"],
                "amount_due": due,
                "due_date": inv["due_date"],
                "status": inv["status"],
                "currency": inv.get("currency", "USD"),
            })

        return {
            "total_outstanding": round(total_outstanding, 2),
            "by_client": {k: round(v, 2) for k, v in by_client.items()},
            "by_status": {k: round(v, 2) for k, v in by_status.items()},
            "invoice_count": len(invoices_detail),
            "invoices": invoices_detail,
        }

    def revenue_by_period(
        self,
        period: str = "monthly",
        year: Optional[int] = None,
    ) -> Dict[str, float]:
        """
        Aggregate paid revenue by period (weekly/monthly/quarterly).

        Returns dict keyed by period label.
        """
        yr = year or datetime.now().year
        buckets: Dict[str, float] = {}

        for inv in self.store.all_invoices():
            if inv["status"] != "paid" or not inv.get("paid_date"):
                continue
            paid = parse_date(inv["paid_date"])
            if paid.year != yr:
                continue
            total = inv["total"]

            if period == "weekly":
                iso_year, iso_week, _ = paid.isocalendar()
                key = f"{iso_year}-W{iso_week:02d}"
            elif period == "quarterly":
                quarter = (paid.month - 1) // 3 + 1
                key = f"{yr}-Q{quarter}"
            else:  # monthly
                key = f"{yr}-{paid.month:02d}"

            buckets[key] = round(buckets.get(key, 0) + total, 2)

        return dict(sorted(buckets.items()))

    def payment_patterns(self) -> Dict[str, Any]:
        """Analyze payment patterns across all clients."""
        clients: Dict[str, List[int]] = {}
        total_paid = 0
        total_invoices = 0

        for inv in self.store.all_invoices():
            if inv["status"] != "paid" or not inv.get("paid_date"):
                continue
            total_invoices += 1
            total_paid += inv["total"]
            issued = parse_date(inv["issue_date"])
            paid = parse_date(inv["paid_date"])
            days = (paid - issued).days
            clients.setdefault(inv["client_name"], []).append(days)

        fastest_client = None
        slowest_client = None
        client_avgs: Dict[str, float] = {}

        for name, days_list in clients.items():
            avg = sum(days_list) / len(days_list)
            client_avgs[name] = round(avg, 1)

        if client_avgs:
            fastest_client = min(client_avgs, key=client_avgs.get)  # type: ignore[arg-type]
            slowest_client = max(client_avgs, key=client_avgs.get)  # type: ignore[arg-type]

        all_days = [d for ds in clients.values() for d in ds]
        overall_avg = round(sum(all_days) / len(all_days), 1) if all_days else 0

        return {
            "total_invoices_paid": total_invoices,
            "total_revenue": round(total_paid, 2),
            "overall_avg_days_to_payment": overall_avg,
            "fastest_paying_client": fastest_client,
            "slowest_paying_client": slowest_client,
            "client_averages": client_avgs,
        }

    def generate_report(self, period: str = "monthly", year: Optional[int] = None) -> str:
        """Generate a full text financial summary report."""
        receivables = self.outstanding_receivables()
        revenue = self.revenue_by_period(period, year)
        patterns = self.payment_patterns()
        yr = year or datetime.now().year

        lines = [
            f"# Financial Report — {yr}",
            "",
            "## Outstanding Receivables",
            f"- Total Outstanding: ${receivables['total_outstanding']:,.2f}",
            f"- Invoices Pending: {receivables['invoice_count']}",
        ]
        if receivables["by_client"]:
            lines.append("- By Client:")
            for client, amt in receivables["by_client"].items():
                lines.append(f"  - {client}: ${amt:,.2f}")

        lines += [
            "",
            f"## Revenue by Period ({period.title()})",
        ]
        for p, amt in revenue.items():
            lines.append(f"- {p}: ${amt:,.2f}")

        lines += [
            "",
            "## Payment Patterns",
            f"- Total Invoices Paid: {patterns['total_invoices_paid']}",
            f"- Total Revenue: ${patterns['total_revenue']:,.2f}",
            f"- Average Days to Payment: {patterns['overall_avg_days_to_payment']}",
        ]
        if patterns["fastest_paying_client"]:
            lines.append(f"- Fastest Payer: {patterns['fastest_paying_client']} ({patterns['client_averages'].get(patterns['fastest_paying_client'], '?')} days avg)")
        if patterns["slowest_paying_client"]:
            lines.append(f"- Slowest Payer: {patterns['slowest_paying_client']} ({patterns['client_averages'].get(patterns['slowest_paying_client'], '?')} days avg)")

        return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI Interface
# ---------------------------------------------------------------------------

def handle_create(json_str: str, store: InvoiceStore) -> None:
    """Handle --create command."""
    data = json.loads(json_str)
    gen = InvoiceGenerator(store)
    invoice = gen.create_invoice(data)
    print(json.dumps(invoice, indent=2, default=str))


def handle_track(json_str: str, store: InvoiceStore) -> None:
    """Handle --track command."""
    data = json.loads(json_str)
    invoice_id = data.get("invoice_id")
    if not invoice_id:
        raise ValueError("invoice_id is required for tracking")
    new_status = data.get("status")
    if not new_status:
        raise ValueError("status is required for tracking")

    tracker = PaymentTracker(store)
    updated = tracker.update_status(
        invoice_id=invoice_id,
        new_status=new_status,
        amount=data.get("amount"),
        payment_method=data.get("payment_method", ""),
        notes=data.get("notes", ""),
        date=data.get("date"),
    )
    print(json.dumps(updated, indent=2, default=str))


def handle_followup(store: InvoiceStore, late_fee_rate: float = 0.0) -> None:
    """Handle --followup command."""
    gen = FollowUpGenerator(store, late_fee_rate=late_fee_rate)
    followups = gen.generate_all_followups()
    if not followups:
        print("No overdue invoices requiring follow-up.")
        return
    print(json.dumps(followups, indent=2, default=str))


def handle_report(store: InvoiceStore, period: str = "monthly") -> None:
    """Handle --report command."""
    analytics = InvoiceAnalytics(store)
    report = analytics.generate_report(period)
    print(report)


def handle_stdin(store: InvoiceStore) -> None:
    """Handle --stdin piped JSON input with an 'action' field."""
    raw = sys.stdin.read().strip()
    if not raw:
        print("Error: No input received on stdin", file=sys.stderr)
        sys.exit(1)

    data = json.loads(raw)
    action = data.get("action")

    if action == "create":
        gen = InvoiceGenerator(store)
        result = gen.create_invoice(data)
    elif action == "track":
        tracker = PaymentTracker(store)
        result = tracker.update_status(
            invoice_id=data["invoice_id"],
            new_status=data["status"],
            amount=data.get("amount"),
            payment_method=data.get("payment_method", ""),
            notes=data.get("notes", ""),
            date=data.get("date"),
        )
    elif action == "followup":
        gen = FollowUpGenerator(store, late_fee_rate=data.get("late_fee_rate", 0.0))
        result = gen.generate_all_followups(data.get("as_of"))
    elif action == "report":
        analytics = InvoiceAnalytics(store)
        print(analytics.generate_report(data.get("period", "monthly"), data.get("year")))
        return
    else:
        print(f"Error: Unknown action '{action}'", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, indent=2, default=str))


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Invoice Automation — create, track, follow up, and report on invoices.",
    )
    parser.add_argument("--create", metavar="JSON", help="Create invoice from JSON string")
    parser.add_argument("--track", metavar="JSON", help="Update payment status from JSON string")
    parser.add_argument("--followup", action="store_true", help="Generate follow-ups for overdue invoices")
    parser.add_argument("--report", action="store_true", help="Generate financial summary report")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin (requires 'action' field)")
    parser.add_argument("--period", default="monthly", choices=["weekly", "monthly", "quarterly"],
                        help="Reporting period (default: monthly)")
    parser.add_argument("--late-fee-rate", type=float, default=0.0,
                        help="Monthly late fee rate, e.g. 0.015 for 1.5%%")
    parser.add_argument("--data-dir", help="Override data directory path")
    parser.add_argument("--markdown", metavar="INVOICE_ID", help="Export invoice as Markdown")
    parser.add_argument("--pdf-json", metavar="INVOICE_ID", help="Export invoice as PDF-ready JSON")

    args = parser.parse_args()
    store = InvoiceStore(args.data_dir)

    try:
        if args.stdin:
            handle_stdin(store)
        elif args.create:
            handle_create(args.create, store)
        elif args.track:
            handle_track(args.track, store)
        elif args.followup:
            handle_followup(store, args.late_fee_rate)
        elif args.report:
            handle_report(store, args.period)
        elif args.markdown:
            inv = store.get_invoice(args.markdown)
            if not inv:
                print(f"Invoice {args.markdown} not found", file=sys.stderr)
                sys.exit(1)
            print(InvoiceGenerator.to_markdown(inv))
        elif args.pdf_json:
            inv = store.get_invoice(args.pdf_json)
            if not inv:
                print(f"Invoice {args.pdf_json} not found", file=sys.stderr)
                sys.exit(1)
            print(json.dumps(InvoiceGenerator.to_pdf_json(inv), indent=2, default=str))
        else:
            parser.print_help()
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
