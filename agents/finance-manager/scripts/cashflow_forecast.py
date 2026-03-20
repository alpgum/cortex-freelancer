#!/usr/bin/env python3
"""
Cash Flow Forecast — Predict cash flow for the next 3 months.

Reads invoices.json (pending payments) and expenses.json (recurring costs) to project
monthly income vs expenses, cash runway, and warnings.

Usage:
    python3 cashflow_forecast.py
    python3 cashflow_forecast.py --months 6
    python3 cashflow_forecast.py --starting-balance 5000
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "..", "..", "data")
INVOICES_FILE = os.path.join(DATA_DIR, "invoices.json")
EXPENSES_FILE = os.path.join(DATA_DIR, "expenses.json")


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def load_json(filepath):
    """Load JSON file, return empty list if doesn't exist."""
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r") as f:
        return json.load(f)


def get_month_key(dt):
    """Return YYYY-MM string from datetime."""
    return dt.strftime("%Y-%m")


def get_future_months(num_months):
    """Get list of next N month keys starting from current month."""
    now = datetime.now()
    months = []
    for i in range(num_months):
        d = datetime(now.year, now.month, 1) + timedelta(days=32 * i)
        months.append(get_month_key(d))
    return months


def analyze_invoices(invoices, future_months):
    """Categorize invoices into projected income per month."""
    income = defaultdict(lambda: {"confirmed": 0, "pending": 0, "overdue": 0, "details": []})
    now = datetime.now()

    for inv in invoices:
        amount = inv.get("amount", inv.get("total", 0))
        status = inv.get("status", "").lower()
        inv_date = inv.get("date", inv.get("created", ""))
        due_date = inv.get("due_date", inv.get("dueDate", ""))
        client = inv.get("client", inv.get("clientName", "Unknown"))

        if not amount:
            continue

        # Parse dates
        try:
            inv_dt = datetime.strptime(inv_date[:10], "%Y-%m-%d") if inv_date else now
        except ValueError:
            inv_dt = now

        try:
            due_dt = datetime.strptime(due_date[:10], "%Y-%m-%d") if due_date else inv_dt + timedelta(days=30)
        except ValueError:
            due_dt = inv_dt + timedelta(days=30)

        month_key = get_month_key(due_dt)

        if status in ("paid", "completed"):
            income[month_key]["confirmed"] += amount
            income[month_key]["details"].append(f"  ✅ ${amount:,.0f} from {client} (paid)")
        elif status in ("sent", "pending", "unpaid", ""):
            if due_dt < now:
                current_month = get_month_key(now)
                income[current_month]["overdue"] += amount
                income[current_month]["details"].append(f"  ⚠️  ${amount:,.0f} from {client} (OVERDUE since {due_date})")
            else:
                income[month_key]["pending"] += amount
                income[month_key]["details"].append(f"  ⏳ ${amount:,.0f} from {client} (due {due_date})")

    return income


def analyze_expenses(expenses, future_months):
    """Project recurring and one-time expenses."""
    projected = defaultdict(lambda: {"recurring": 0, "estimated": 0, "details": []})

    # Find recurring expenses (appeared in 2+ of last 3 months)
    now = datetime.now()
    recent_months = []
    for i in range(3):
        d = datetime(now.year, now.month, 1) - timedelta(days=32 * i)
        recent_months.append(get_month_key(d))

    # Group expenses by description/category to find recurring ones
    by_desc = defaultdict(list)
    for e in expenses:
        key = f"{e.get('category', 'other')}:{e.get('description', '')}"
        by_desc[key].append(e)

    recurring_items = []
    for key, items in by_desc.items():
        months_appeared = set(e["date"][:7] for e in items)
        recent_count = sum(1 for m in recent_months if m in months_appeared)
        if recent_count >= 2 or any(e.get("recurring", False) for e in items):
            avg_amount = sum(e["amount"] for e in items) / len(items)
            recurring_items.append({
                "description": items[0].get("description", key),
                "category": items[0].get("category", "other"),
                "amount": avg_amount,
            })

    # Project recurring expenses into future months
    for month in future_months:
        for item in recurring_items:
            projected[month]["recurring"] += item["amount"]
            projected[month]["details"].append(
                f"  🔄 ${item['amount']:,.2f} — {item['description']} (recurring)"
            )

    # Calculate average monthly non-recurring expenses from last 3 months
    non_recurring_total = 0
    non_recurring_months = 0
    for month in recent_months:
        month_expenses = [e for e in expenses if e["date"].startswith(month)]
        recurring_total = sum(item["amount"] for item in recurring_items)
        month_non_recurring = sum(e["amount"] for e in month_expenses) - recurring_total
        if month_non_recurring > 0:
            non_recurring_total += month_non_recurring
            non_recurring_months += 1

    avg_non_recurring = non_recurring_total / max(1, non_recurring_months)

    for month in future_months:
        if avg_non_recurring > 0:
            projected[month]["estimated"] += avg_non_recurring
            projected[month]["details"].append(
                f"  📊 ${avg_non_recurring:,.2f} — estimated variable expenses"
            )

    return projected, recurring_items


def main():
    parser = argparse.ArgumentParser(
        description="Forecast cash flow for the next 3 months based on invoices and expenses.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  cashflow_forecast.py\n"
               "  cashflow_forecast.py --months 6 --starting-balance 5000",
    )
    parser.add_argument("--months", type=int, default=3, help="Number of months to forecast (default: 3)")
    parser.add_argument("--starting-balance", type=float, default=0, help="Current bank balance (default: 0)")

    args = parser.parse_args()
    ensure_data_dir()

    invoices = load_json(INVOICES_FILE)
    expenses = load_json(EXPENSES_FILE)

    future_months = get_future_months(args.months)

    # Analyze
    income_projection = analyze_invoices(invoices, future_months)
    expense_projection, recurring_items = analyze_expenses(expenses, future_months)

    # Display
    print(f"\n{'=' * 60}")
    print(f"💰 CASH FLOW FORECAST — Next {args.months} Months")
    print(f"{'=' * 60}")

    if not invoices and not expenses:
        print(f"\n  ⚠️  No invoices or expenses data found.")
        print(f"  Files checked:")
        print(f"    {INVOICES_FILE}")
        print(f"    {EXPENSES_FILE}")
        print(f"\n  Start tracking expenses: expense_tracker.py add ...")
        print(f"  Generate invoices: invoice_gen.py ...")
        return

    running_balance = args.starting_balance
    monthly_summary = []

    for month in future_months:
        inc = income_projection[month]
        exp = expense_projection[month]

        total_income = inc["confirmed"] + inc["pending"] + inc["overdue"]
        # Discount pending income by 20% (not all invoices get paid on time)
        projected_income = inc["confirmed"] + inc["pending"] * 0.8 + inc["overdue"] * 0.5
        total_expenses = exp["recurring"] + exp["estimated"]

        net = projected_income - total_expenses
        running_balance += net

        # Warning logic
        warnings = []
        if inc["overdue"] > 0:
            warnings.append(f"⚠️  ${inc['overdue']:,.0f} overdue — follow up immediately")
        if net < 0:
            warnings.append(f"⚠️  Negative cash flow — expenses exceed projected income")
        if running_balance < 0:
            warnings.append(f"🔴 Balance goes negative — urgent action needed")
        if inc["pending"] > inc["confirmed"] * 2 and inc["pending"] > 1000:
            warnings.append(f"⚠️  Heavy reliance on pending invoices")

        monthly_summary.append({
            "month": month,
            "income": projected_income,
            "raw_income": total_income,
            "expenses": total_expenses,
            "net": net,
            "balance": running_balance,
            "warnings": warnings,
            "income_details": inc["details"],
            "expense_details": exp["details"],
        })

    # Summary bar
    print(f"\n📊 MONTHLY OVERVIEW")
    print(f"{'─' * 60}")
    if args.starting_balance > 0:
        print(f"  Starting balance: ${args.starting_balance:,.0f}")
        print()

    for ms in monthly_summary:
        sign = "+" if ms["net"] >= 0 else ""
        balance_icon = "✅" if ms["balance"] >= 0 else "🔴"
        print(f"  {ms['month']}:  {sign}${ms['net']:>8,.0f} projected | Balance: ${ms['balance']:>9,.0f} {balance_icon}")

    # Detailed breakdown
    for ms in monthly_summary:
        print(f"\n{'─' * 60}")
        print(f"📅 {ms['month']}")
        print(f"{'─' * 60}")

        print(f"\n  📈 INCOME (projected: ${ms['income']:,.0f})")
        if ms["income_details"]:
            for detail in ms["income_details"]:
                print(f"  {detail}")
        else:
            print(f"    No confirmed or pending income")

        print(f"\n  📉 EXPENSES (estimated: ${ms['expenses']:,.0f})")
        if ms["expense_details"]:
            for detail in ms["expense_details"]:
                print(f"  {detail}")
        else:
            print(f"    No projected expenses")

        if ms["warnings"]:
            print(f"\n  🚨 WARNINGS")
            for w in ms["warnings"]:
                print(f"    {w}")

    # Cash runway
    print(f"\n{'=' * 60}")
    print(f"📐 CASH RUNWAY ANALYSIS")
    print(f"{'=' * 60}")

    if recurring_items:
        monthly_burn = sum(item["amount"] for item in recurring_items)
        print(f"\n  Monthly recurring costs: ${monthly_burn:,.2f}")
        if args.starting_balance > 0 and monthly_burn > 0:
            runway_months = args.starting_balance / monthly_burn
            print(f"  Cash runway: {runway_months:.1f} months (at current burn rate)")
            if runway_months < 3:
                print(f"  🔴 Less than 3 months runway — increase income or cut costs")
            elif runway_months < 6:
                print(f"  🟡 Less than 6 months — build a buffer")
            else:
                print(f"  🟢 Healthy runway")

    # Recommendations
    total_net = sum(ms["net"] for ms in monthly_summary)
    print(f"\n💡 RECOMMENDATIONS")
    print(f"{'─' * 60}")

    if total_net < 0:
        print(f"  • Net forecast is negative (${total_net:,.0f}) — take action:")
        print(f"    - Follow up on overdue invoices immediately")
        print(f"    - Send proposals for new projects this week")
        print(f"    - Review subscriptions for cuts")
    else:
        print(f"  • Net forecast is positive (${total_net:,.0f})")
        print(f"    - Set aside 25-30% for taxes")
        print(f"    - Build emergency fund (3-6 months expenses)")

    if any(ms["warnings"] for ms in monthly_summary):
        print(f"  • Address warnings above to de-risk your forecast")

    print()


if __name__ == "__main__":
    main()
