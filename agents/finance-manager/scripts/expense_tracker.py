#!/usr/bin/env python3
"""
Expense Tracker — Simple expense tracking for freelancers.

Usage:
    python3 expense_tracker.py add --amount 29.99 --category software --description "Figma subscription" --deductible yes
    python3 expense_tracker.py list --month 2026-03
    python3 expense_tracker.py summary --quarter Q1-2026
    python3 expense_tracker.py tax-report --year 2026
    python3 expense_tracker.py profit
"""

import argparse
import json
import os
import sys
from datetime import datetime
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "..", "..", "data")
EXPENSES_FILE = os.path.join(DATA_DIR, "expenses.json")
INVOICES_FILE = os.path.join(DATA_DIR, "invoices.json")

VALID_CATEGORIES = [
    "software", "hardware", "internet", "coworking", "education",
    "marketing", "travel", "subcontractors", "office", "insurance",
    "banking", "legal", "other"
]


def ensure_data_file(filepath, default=None):
    """Create data directory and file if they don't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(filepath):
        with open(filepath, "w") as f:
            json.dump(default if default is not None else [], f)


def load_json(filepath):
    """Load data from JSON file."""
    ensure_data_file(filepath)
    with open(filepath, "r") as f:
        return json.load(f)


def save_json(filepath, data):
    """Save data to JSON file."""
    ensure_data_file(filepath)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)


def load_expenses():
    return load_json(EXPENSES_FILE)


def save_expenses(expenses):
    save_json(EXPENSES_FILE, expenses)


def load_invoices():
    """Load invoices for profit calculation."""
    if not os.path.exists(INVOICES_FILE):
        return []
    return load_json(INVOICES_FILE)


def get_next_id(items):
    if not items:
        return 1
    return max(item.get("id", 0) for item in items) + 1


def parse_quarter(quarter_str):
    """Parse 'Q1-2026' into (year, quarter_num, start_month, end_month)."""
    parts = quarter_str.split("-")
    if len(parts) != 2 or not parts[0].startswith("Q"):
        raise ValueError(f"Invalid quarter format: {quarter_str}. Use Q1-2026.")
    q = int(parts[0][1])
    year = int(parts[1])
    if q < 1 or q > 4:
        raise ValueError("Quarter must be Q1-Q4")
    start_month = (q - 1) * 3 + 1
    end_month = q * 3
    return year, q, start_month, end_month


def filter_by_month(expenses, month_str):
    """Filter expenses by YYYY-MM."""
    return [e for e in expenses if e["date"].startswith(month_str)]


def filter_by_quarter(expenses, year, start_month, end_month):
    """Filter expenses by quarter."""
    results = []
    for e in expenses:
        try:
            d = datetime.strptime(e["date"], "%Y-%m-%d")
            if d.year == year and start_month <= d.month <= end_month:
                results.append(e)
        except (ValueError, KeyError):
            continue
    return results


def filter_by_year(expenses, year):
    """Filter expenses by year."""
    return [e for e in expenses if e["date"].startswith(str(year))]


def cmd_add(args):
    """Add a new expense."""
    expenses = load_expenses()
    expense = {
        "id": get_next_id(expenses),
        "amount": args.amount,
        "category": args.category.lower(),
        "description": args.description,
        "date": args.date or datetime.now().strftime("%Y-%m-%d"),
        "deductible": args.deductible == "yes" if args.deductible else True,
        "recurring": args.recurring or False,
    }
    expenses.append(expense)
    save_expenses(expenses)
    ded = "✅ deductible" if expense["deductible"] else "no deduction"
    print(f"✓ Expense #{expense['id']} added: ${expense['amount']:.2f} [{expense['category']}] — {expense['description']} ({ded})")


def cmd_list(args):
    """List expenses with optional filters."""
    expenses = load_expenses()
    if not expenses:
        print("No expenses tracked yet. Use 'add' to start.")
        return

    if args.month:
        expenses = filter_by_month(expenses, args.month)
        print(f"\n📋 Expenses for {args.month}")
    elif args.category:
        expenses = [e for e in expenses if e["category"] == args.category.lower()]
        print(f"\n📋 Expenses in '{args.category}'")
    else:
        print(f"\n📋 All Expenses")

    if not expenses:
        print("No matching expenses found.")
        return

    print(f"\n{'ID':<4} {'Date':<12} {'Category':<14} {'Amount':>10} {'Ded':>4} {'Description'}")
    print("-" * 75)
    total = 0
    for e in sorted(expenses, key=lambda x: x["date"], reverse=True):
        ded = "✅" if e.get("deductible", False) else "  "
        print(f"{e['id']:<4} {e['date']:<12} {e['category']:<14} ${e['amount']:>9,.2f} {ded:>4} {e['description']}")
        total += e["amount"]

    print("-" * 75)
    print(f"{'':>30} Total: ${total:>9,.2f}")
    print(f"{'':>30} Count: {len(expenses)}")


def cmd_summary(args):
    """Show expense summary by quarter or month."""
    expenses = load_expenses()
    if not expenses:
        print("No expenses tracked yet.")
        return

    if args.quarter:
        year, q, start_month, end_month = parse_quarter(args.quarter)
        filtered = filter_by_quarter(expenses, year, start_month, end_month)
        period = f"Q{q} {year}"
    elif args.month:
        filtered = filter_by_month(expenses, args.month)
        period = args.month
    elif args.year:
        filtered = filter_by_year(expenses, int(args.year))
        period = args.year
    else:
        filtered = expenses
        period = "All Time"

    if not filtered:
        print(f"No expenses found for {period}.")
        return

    # By category
    by_category = defaultdict(float)
    deductible_total = 0
    for e in filtered:
        by_category[e["category"]] += e["amount"]
        if e.get("deductible", False):
            deductible_total += e["amount"]

    total = sum(by_category.values())

    print(f"\n📊 EXPENSE SUMMARY — {period}")
    print("=" * 45)

    for cat, amount in sorted(by_category.items(), key=lambda x: -x[1]):
        pct = amount / total * 100 if total > 0 else 0
        bar_len = int(pct / 5)
        print(f"  {cat:<15} ${amount:>9,.2f}  {'█' * bar_len} {pct:.0f}%")

    print("─" * 45)
    print(f"  {'TOTAL':<15} ${total:>9,.2f}")
    print(f"  {'Deductible':<15} ${deductible_total:>9,.2f}")
    print(f"  {'Non-deductible':<15} ${total - deductible_total:>9,.2f}")

    # Monthly average
    dates = sorted(set(e["date"][:7] for e in filtered))
    if len(dates) > 1:
        monthly_avg = total / len(dates)
        print(f"\n  Monthly average: ${monthly_avg:,.2f}")


def cmd_tax_report(args):
    """Generate tax deduction report for a year."""
    expenses = load_expenses()
    year = args.year or datetime.now().year
    filtered = filter_by_year(expenses, int(year))

    if not filtered:
        print(f"No expenses found for {year}.")
        return

    deductible = [e for e in filtered if e.get("deductible", False)]
    non_deductible = [e for e in filtered if not e.get("deductible", False)]

    print(f"\n📋 TAX DEDUCTION REPORT — {year}")
    print("=" * 55)

    # Deductible by category
    by_category = defaultdict(lambda: {"total": 0, "count": 0, "items": []})
    for e in deductible:
        cat = e["category"]
        by_category[cat]["total"] += e["amount"]
        by_category[cat]["count"] += 1
        by_category[cat]["items"].append(e)

    total_deductible = sum(c["total"] for c in by_category.values())
    total_non_deductible = sum(e["amount"] for e in non_deductible)

    print(f"\n✅ DEDUCTIBLE EXPENSES")
    print(f"{'─' * 55}")
    for cat, data in sorted(by_category.items(), key=lambda x: -x[1]["total"]):
        print(f"\n  {cat.upper()} — ${data['total']:,.2f} ({data['count']} items)")
        for item in data["items"]:
            print(f"    {item['date']}  ${item['amount']:>8,.2f}  {item['description']}")

    print(f"\n{'─' * 55}")
    print(f"  TOTAL DEDUCTIBLE:      ${total_deductible:>10,.2f}")
    print(f"  TOTAL NON-DEDUCTIBLE:  ${total_non_deductible:>10,.2f}")
    print(f"  GRAND TOTAL:           ${total_deductible + total_non_deductible:>10,.2f}")

    # Quarterly breakdown
    print(f"\n📅 QUARTERLY BREAKDOWN")
    for q in range(1, 5):
        start = (q - 1) * 3 + 1
        end = q * 3
        q_expenses = filter_by_quarter(deductible, int(year), start, end)
        q_total = sum(e["amount"] for e in q_expenses)
        print(f"  Q{q}: ${q_total:>9,.2f}")


def cmd_profit(args):
    """Calculate profit: revenue - expenses."""
    expenses = load_expenses()
    invoices = load_invoices()

    # Filter by year if specified
    year = args.year or datetime.now().year

    year_expenses = filter_by_year(expenses, int(year))
    total_expenses = sum(e["amount"] for e in year_expenses)

    # Calculate revenue from invoices
    total_revenue = 0
    paid_invoices = []
    for inv in invoices:
        inv_date = inv.get("date", inv.get("created", ""))
        if inv_date.startswith(str(year)):
            status = inv.get("status", "").lower()
            if status in ("paid", "completed"):
                amount = inv.get("amount", inv.get("total", 0))
                total_revenue += amount
                paid_invoices.append(inv)

    net_profit = total_revenue - total_expenses
    margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0

    print(f"\n💰 PROFIT & LOSS — {year}")
    print("=" * 45)
    print(f"  Revenue (paid invoices):  ${total_revenue:>10,.2f}")
    print(f"  Total expenses:          -${total_expenses:>10,.2f}")
    print(f"  {'─' * 35}")
    print(f"  Net profit:               ${net_profit:>10,.2f}")
    print(f"  Profit margin:            {margin:>9.1f}%")

    if not invoices:
        print(f"\n  ⚠️  No invoices found in {INVOICES_FILE}")
        print(f"  Revenue calculation requires invoices with 'status': 'paid' and 'amount' fields.")

    # Monthly breakdown
    print(f"\n📅 MONTHLY BREAKDOWN")
    print(f"  {'Month':<10} {'Revenue':>10} {'Expenses':>10} {'Net':>10}")
    print(f"  {'─' * 42}")
    for m in range(1, 13):
        month_str = f"{year}-{m:02d}"
        m_expenses = sum(e["amount"] for e in year_expenses if e["date"].startswith(month_str))
        m_revenue = 0
        for inv in paid_invoices:
            inv_date = inv.get("date", inv.get("created", ""))
            if inv_date.startswith(month_str):
                m_revenue += inv.get("amount", inv.get("total", 0))
        m_net = m_revenue - m_expenses
        if m_expenses > 0 or m_revenue > 0:
            indicator = "✅" if m_net >= 0 else "⚠️"
            print(f"  {month_str:<10} ${m_revenue:>9,.2f} ${m_expenses:>9,.2f} ${m_net:>9,.2f} {indicator}")


def main():
    parser = argparse.ArgumentParser(
        description="Track freelance business expenses.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  expense_tracker.py add --amount 29.99 --category software --description 'Figma sub' --deductible yes\n"
               "  expense_tracker.py list --month 2026-03\n"
               "  expense_tracker.py summary --quarter Q1-2026\n"
               "  expense_tracker.py profit",
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Add
    add_p = subparsers.add_parser("add", help="Add an expense")
    add_p.add_argument("--amount", required=True, type=float, help="Amount in USD")
    add_p.add_argument("--category", required=True, choices=VALID_CATEGORIES, help="Expense category")
    add_p.add_argument("--description", required=True, help="What the expense is for")
    add_p.add_argument("--deductible", choices=["yes", "no"], help="Tax deductible? (default: yes)")
    add_p.add_argument("--date", help="Date (YYYY-MM-DD, default: today)")
    add_p.add_argument("--recurring", action="store_true", help="Mark as recurring expense")

    # List
    list_p = subparsers.add_parser("list", help="List expenses")
    list_p.add_argument("--month", help="Filter by month (YYYY-MM)")
    list_p.add_argument("--category", choices=VALID_CATEGORIES, help="Filter by category")

    # Summary
    sum_p = subparsers.add_parser("summary", help="Expense summary")
    sum_p.add_argument("--quarter", help="Quarter (e.g., Q1-2026)")
    sum_p.add_argument("--month", help="Month (YYYY-MM)")
    sum_p.add_argument("--year", help="Year (YYYY)")

    # Tax report
    tax_p = subparsers.add_parser("tax-report", help="Tax deduction report")
    tax_p.add_argument("--year", help="Year (default: current year)")

    # Profit
    profit_p = subparsers.add_parser("profit", help="Calculate profit (revenue - expenses)")
    profit_p.add_argument("--year", help="Year (default: current year)")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "add": cmd_add,
        "list": cmd_list,
        "summary": cmd_summary,
        "tax-report": cmd_tax_report,
        "profit": cmd_profit,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
