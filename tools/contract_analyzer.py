#!/usr/bin/env python3
"""
Contract Risk Analyzer & Template Generator (CFX-060b)

Analyzes freelancer contracts for risks and generates safe templates:
- Red flag detection in contract language
- Risk scoring with specific clause analysis
- Template generation for common project types
- Clause-by-clause recommendations
- Payment terms validation

Usage:
    python contract_analyzer.py analyze --file contract.txt
    python contract_analyzer.py analyze --text "The client reserves the right..."
    python contract_analyzer.py template --type web_development --rate 95 --client "Acme Corp"
    python contract_analyzer.py checklist
"""

import argparse
import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from pathlib import Path

# ---------------------------------------------------------------------------
# Risk Pattern Database
# ---------------------------------------------------------------------------

RED_FLAGS = [
    {
        "pattern": r"work[- ]?for[- ]?hire|all\s+(?:intellectual\s+)?property\s+(?:shall\s+)?belong",
        "name": "Work-for-Hire / Full IP Transfer",
        "severity": "high",
        "advice": "Negotiate to retain rights to reusable components, frameworks, and pre-existing IP. License deliverables instead of full transfer where possible.",
    },
    {
        "pattern": r"unlimited\s+revisions?|revisions?\s+until\s+satisf(?:ied|action)",
        "name": "Unlimited Revisions",
        "severity": "critical",
        "advice": "NEVER accept unlimited revisions. Specify exact number (2-3 rounds) with additional rounds billed at hourly rate.",
    },
    {
        "pattern": r"non[- ]?compete|(?:shall|will)\s+not\s+(?:work|provide|offer)\s+(?:services?\s+)?(?:to|for)\s+(?:any\s+)?(?:competitor|similar|competing)",
        "name": "Non-Compete Clause",
        "severity": "high",
        "advice": "Non-competes can kill your business. Narrow the scope (specific companies, not industries), limit duration (6 months max), and ensure geographic limits.",
    },
    {
        "pattern": r"(?:terminate|cancel)\s+(?:at\s+)?any\s+time\s+(?:without|with\s+no)\s+(?:cause|reason|notice)",
        "name": "Termination Without Cause/Notice",
        "severity": "high",
        "advice": "Require 14-30 day written notice for termination. Include a kill fee (25-50% of remaining project value) for early termination.",
    },
    {
        "pattern": r"(?:net|payment\s+(?:within|in))\s+(?:60|90|120)\s+days?",
        "name": "Long Payment Terms (60+ days)",
        "severity": "medium",
        "advice": "Push for Net-15 or Net-30 maximum. Offer 2-3% early payment discount as incentive. Add late payment penalties (1.5%/month).",
    },
    {
        "pattern": r"no\s+(?:upfront|advance|deposit)|(?:payment|fee)\s+(?:upon|after|on)\s+(?:completion|delivery|final)",
        "name": "No Upfront Payment",
        "severity": "critical",
        "advice": "ALWAYS require 25-50% upfront deposit before starting work. Milestone payments for longer projects. Never do 100% on completion.",
    },
    {
        "pattern": r"indemnif(?:y|ication)|hold\s+harmless|defend\s+(?:against|from)",
        "name": "Indemnification Clause",
        "severity": "medium",
        "advice": "Ensure indemnification is mutual, not one-sided. Limit liability to the total contract value. Exclude consequential damages.",
    },
    {
        "pattern": r"(?:exclusive|sole)\s+(?:right|provider|contractor)",
        "name": "Exclusivity Requirement",
        "severity": "medium",
        "advice": "Avoid exclusivity unless compensated with a retainer. If accepted, limit to specific services and time period.",
    },
    {
        "pattern": r"(?:scope|requirements?)\s+(?:may|can|shall)\s+(?:be\s+)?(?:changed|modified|updated)\s+(?:at\s+)?(?:any\s+time|client.s?\s+discretion)",
        "name": "Uncontrolled Scope Changes",
        "severity": "critical",
        "advice": "Require written change orders for any scope modifications with cost/timeline impact assessment before proceeding.",
    },
    {
        "pattern": r"(?:liability|damages)\s+(?:shall\s+)?(?:not\s+)?exceed.*(?:10x|ten\s+times|unlimited|total\s+fees\s+paid)",
        "name": "Excessive Liability",
        "severity": "high",
        "advice": "Cap liability at 1x the total contract value. Exclude indirect, consequential, and punitive damages.",
    },
    {
        "pattern": r"(?:confidential|nda).*(?:perpetual|indefinite|no\s+expir)",
        "name": "Perpetual NDA / Confidentiality",
        "severity": "low",
        "advice": "Request a reasonable confidentiality period (2-5 years). Exclude publicly available information and your general knowledge/skills.",
    },
    {
        "pattern": r"(?:penalty|liquidated\s+damages)\s+(?:for|of).*(?:delay|late|miss)",
        "name": "Late Delivery Penalties",
        "severity": "medium",
        "advice": "If penalties exist, ensure they're capped (e.g., max 10% of project value) and include force majeure exceptions.",
    },
]

# ---------------------------------------------------------------------------
# Contract Analyzer
# ---------------------------------------------------------------------------

class ContractAnalyzer:
    def __init__(self):
        self.flags = RED_FLAGS

    def analyze(self, text: str) -> Dict:
        """Analyze contract text for risks."""
        text_lower = text.lower()
        findings = []
        for flag in self.flags:
            matches = re.findall(flag["pattern"], text_lower, re.IGNORECASE)
            if matches:
                findings.append({
                    "name": flag["name"],
                    "severity": flag["severity"],
                    "advice": flag["advice"],
                    "matches": len(matches),
                    "sample": matches[0] if matches else "",
                })

        # Calculate overall risk score
        severity_weights = {"critical": 30, "high": 20, "medium": 10, "low": 5}
        risk_score = min(100, sum(severity_weights.get(f["severity"], 5) for f in findings))

        # Check for good practices
        good_signs = []
        if re.search(r"(?:deposit|upfront|advance)\s+(?:payment|fee).*(?:25|30|50)\s*%", text_lower):
            good_signs.append("✅ Upfront deposit mentioned")
        if re.search(r"(?:2|3|two|three)\s+(?:rounds?\s+of\s+)?revisions?", text_lower):
            good_signs.append("✅ Limited revision rounds")
        if re.search(r"(?:change\s+order|scope\s+change)\s+(?:process|procedure|approval)", text_lower):
            good_signs.append("✅ Change order process defined")
        if re.search(r"(?:kill\s+fee|cancellation\s+fee|early\s+termination\s+fee)", text_lower):
            good_signs.append("✅ Kill fee / cancellation fee included")
        if re.search(r"(?:net[- ]?15|net[- ]?30|(?:within|in)\s+(?:15|30)\s+days?)", text_lower):
            good_signs.append("✅ Reasonable payment terms")
        if re.search(r"(?:late\s+(?:payment\s+)?(?:fee|penalty|interest))", text_lower):
            good_signs.append("✅ Late payment penalties")
        if re.search(r"(?:retain|keep|own).*(?:portfolio|sample|example)", text_lower):
            good_signs.append("✅ Portfolio usage rights")

        if risk_score < 20: level = "Low Risk 🟢"
        elif risk_score < 50: level = "Moderate Risk 🟡"
        elif risk_score < 75: level = "High Risk 🟠"
        else: level = "Critical Risk 🔴"

        return {
            "risk_score": risk_score,
            "risk_level": level,
            "findings": findings,
            "good_signs": good_signs,
            "total_flags": len(findings),
            "critical_flags": sum(1 for f in findings if f["severity"] == "critical"),
            "word_count": len(text.split()),
            "analyzed_at": datetime.now().isoformat(),
        }


# ---------------------------------------------------------------------------
# Contract Templates
# ---------------------------------------------------------------------------

TEMPLATES = {
    "web_development": {
        "name": "Web Development Contract",
        "template": """
# FREELANCE WEB DEVELOPMENT AGREEMENT

**Date:** {date}
**Between:** {freelancer_name} ("Developer") and {client_name} ("Client")

## 1. PROJECT SCOPE

{scope_description}

### Deliverables:
- {deliverable_1}
- {deliverable_2}
- {deliverable_3}

### Out of Scope:
- Content creation (unless specified)
- Stock photography
- Hosting and domain management (post-launch)
- SEO optimization (unless specified)

## 2. TIMELINE

- Project Start: {start_date}
- Milestone 1 (Design): {milestone_1_date}
- Milestone 2 (Development): {milestone_2_date}
- Final Delivery: {end_date}
- Timeline assumes timely client feedback (within 3 business days)

## 3. COMPENSATION

- Total Project Fee: ${total_fee}
- Hourly Rate (for additional work): ${hourly_rate}/hr

### Payment Schedule:
- 50% deposit due before work begins: ${deposit}
- 25% at Milestone 2 completion: ${milestone_payment}
- 25% upon final delivery and approval: ${final_payment}

### Payment Terms:
- Invoices due within 15 days (Net-15)
- Late payments incur 1.5% monthly interest
- Work pauses if payment is 15+ days overdue

## 4. REVISIONS

- Included: 2 rounds of revisions per milestone
- Additional revisions billed at ${hourly_rate}/hr
- Revision requests must be consolidated and submitted in writing

## 5. INTELLECTUAL PROPERTY

- Upon full payment, Client receives exclusive license to use deliverables
- Developer retains right to use work in portfolio and case studies
- Developer retains ownership of pre-existing code, frameworks, and libraries
- Client owns all custom content and business logic created specifically for this project

## 6. SCOPE CHANGES

- Any changes to scope require a written Change Order
- Change Orders include updated timeline and cost estimate
- Work on changes begins only after written approval
- Change Orders are billed at ${hourly_rate}/hr or agreed fixed fee

## 7. TERMINATION

- Either party may terminate with 14 days written notice
- Client pays for all work completed to date plus 25% kill fee on remaining balance
- Developer delivers all completed work upon payment
- Kill fee waived if termination is due to Developer's breach

## 8. CONFIDENTIALITY

- Both parties agree to keep project details confidential for 2 years
- Exceptions: publicly available information, prior knowledge, legal requirements
- Developer may reference project existence (not details) in portfolio

## 9. LIABILITY

- Developer's total liability limited to total fees paid under this agreement
- Neither party liable for indirect, consequential, or punitive damages
- Client responsible for legal review of content and business compliance

## 10. GENERAL

- This agreement constitutes the entire understanding between parties
- Amendments require written agreement from both parties
- Governed by the laws of {jurisdiction}
- Disputes resolved through mediation, then arbitration

---

**Developer:**
Name: {freelancer_name}
Signature: ____________________
Date: ____________________

**Client:**
Name: {client_name}
Signature: ____________________
Date: ____________________
""",
    },
    "consulting": {
        "name": "Consulting Agreement",
        "template": """
# CONSULTING SERVICES AGREEMENT

**Date:** {date}
**Between:** {freelancer_name} ("Consultant") and {client_name} ("Client")

## 1. SERVICES
Consultant will provide {scope_description}.

## 2. COMPENSATION
- Rate: ${hourly_rate}/hr
- Monthly retainer: ${total_fee}/month (includes {included_hours} hours)
- Overage rate: ${hourly_rate}/hr
- Payment: Net-15, 1.5% monthly late fee

## 3. TERM
- Start: {start_date}
- Initial term: {duration} months
- Auto-renews monthly unless 30 days written notice given

## 4. INTELLECTUAL PROPERTY
- Client owns deliverables upon payment
- Consultant retains pre-existing IP and methodologies
- Consultant may reference engagement in portfolio

## 5. CONFIDENTIALITY
- 3-year confidentiality period
- Standard exceptions apply

## 6. TERMINATION
- 30 days written notice by either party
- Payment for all work completed to termination date
- No non-compete restrictions

## 7. LIABILITY
- Limited to fees paid in prior 3 months
- No consequential damages

---
Signatures: ____________________
""",
    },
    "design": {
        "name": "Design Services Contract",
        "template": """
# DESIGN SERVICES AGREEMENT

**Date:** {date}
**Between:** {freelancer_name} ("Designer") and {client_name} ("Client")

## 1. PROJECT
{scope_description}

## 2. DELIVERABLES
- {deliverable_1}
- Source files in: {file_formats}
- Final files delivered via: {delivery_method}

## 3. PROCESS
1. Discovery & Brief (Week 1)
2. Concepts — 3 initial directions (Week 2)
3. Refinement — 2 rounds of revisions (Week 3-4)
4. Final delivery (Week 5)

## 4. COMPENSATION
- Project fee: ${total_fee}
- 50% deposit before start: ${deposit}
- 50% upon final delivery: ${final_payment}
- Additional revisions: ${hourly_rate}/hr

## 5. USAGE RIGHTS
- Upon full payment: exclusive commercial license
- Designer retains: portfolio rights, authorship credit
- Client may NOT: resell, redistribute, or sub-license designs

## 6. REVISIONS
- 2 rounds included per concept
- Revisions submitted within 5 business days
- Additional rounds at ${hourly_rate}/hr

## 7. CANCELLATION
- Before concepts: full refund minus 10% admin fee
- After concepts: deposit non-refundable
- After refinement: 75% of total fee due

---
Signatures: ____________________
""",
    },
}


def generate_contract(contract_type: str, **kwargs) -> str:
    template = TEMPLATES.get(contract_type)
    if not template:
        return f"Unknown type. Available: {', '.join(TEMPLATES.keys())}"

    text = template["template"]
    defaults = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "freelancer_name": "[Your Name]",
        "client_name": kwargs.get("client", "[Client Name]"),
        "scope_description": "[Project scope description]",
        "deliverable_1": "[Deliverable 1]",
        "deliverable_2": "[Deliverable 2]",
        "deliverable_3": "[Deliverable 3]",
        "start_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "end_date": (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d"),
        "milestone_1_date": (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
        "milestone_2_date": (datetime.now() + timedelta(days=42)).strftime("%Y-%m-%d"),
        "hourly_rate": str(kwargs.get("rate", 95)),
        "total_fee": str(kwargs.get("total", 5000)),
        "jurisdiction": "[Your State/Country]",
        "file_formats": "AI, PSD, PNG, SVG",
        "delivery_method": "Google Drive / Dropbox",
        "duration": "3",
        "included_hours": "20",
    }
    rate = kwargs.get("rate", 95)
    total = kwargs.get("total", 5000)
    defaults["deposit"] = str(int(total * 0.5))
    defaults["milestone_payment"] = str(int(total * 0.25))
    defaults["final_payment"] = str(int(total * 0.25))

    for key, val in {**defaults, **kwargs}.items():
        text = text.replace("{" + key + "}", str(val))
    return text


# ---------------------------------------------------------------------------
# Freelancer Contract Checklist
# ---------------------------------------------------------------------------

CHECKLIST = """
╔══════════════════════════════════════════════════════════╗
║          📋 FREELANCER CONTRACT CHECKLIST               ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  PAYMENT & MONEY                                         ║
║  □ Upfront deposit (25-50%) before work starts           ║
║  □ Payment terms: Net-15 or Net-30 max                   ║
║  □ Late payment penalties defined (1-1.5%/month)         ║
║  □ Currency and payment method specified                 ║
║  □ Kill fee for early termination (25-50%)               ║
║                                                          ║
║  SCOPE & DELIVERABLES                                    ║
║  □ Deliverables clearly defined and listed               ║
║  □ Out-of-scope items explicitly stated                  ║
║  □ Change order process defined                          ║
║  □ Revision rounds limited (2-3 max included)            ║
║  □ Additional revisions billed at hourly rate            ║
║                                                          ║
║  TIMELINE                                                ║
║  □ Start and end dates specified                         ║
║  □ Milestone dates with deliverables                     ║
║  □ Client feedback turnaround time defined               ║
║  □ Timeline extension clause for client delays           ║
║                                                          ║
║  INTELLECTUAL PROPERTY                                   ║
║  □ IP transfer happens ONLY upon full payment            ║
║  □ Portfolio usage rights retained                       ║
║  □ Pre-existing IP excluded from transfer                ║
║  □ License type specified (exclusive/non-exclusive)      ║
║                                                          ║
║  PROTECTION                                              ║
║  □ Liability capped at total contract value              ║
║  □ No unlimited liability / indemnification              ║
║  □ Reasonable confidentiality period (2-5 years)         ║
║  □ No non-compete (or very narrowly scoped)              ║
║  □ Termination with notice period (14-30 days)           ║
║  □ Force majeure clause included                         ║
║                                                          ║
║  RED FLAGS TO REJECT                                     ║
║  ✗ Unlimited revisions                                   ║
║  ✗ 100% payment on completion only                       ║
║  ✗ Broad non-compete clauses                             ║
║  ✗ Uncontrolled scope changes                            ║
║  ✗ Net-60+ payment terms                                 ║
║  ✗ Full IP transfer of pre-existing work                 ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_analyze(args):
    if args.file:
        text = Path(args.file).read_text()
    elif args.text:
        text = args.text
    else:
        print("Provide --file or --text")
        return

    analyzer = ContractAnalyzer()
    result = analyzer.analyze(text)

    print(f"\n{'='*60}")
    print(f"📄 CONTRACT RISK ANALYSIS")
    print(f"{'='*60}")
    print(f"\n  Risk Score: {result['risk_score']}/100 — {result['risk_level']}")
    print(f"  Flags found: {result['total_flags']} ({result['critical_flags']} critical)")
    print(f"  Document: {result['word_count']} words")

    if result["findings"]:
        print(f"\n{'─'*60}")
        print("  ⚠️  RED FLAGS:")
        for f in sorted(result["findings"], key=lambda x: {"critical":0,"high":1,"medium":2,"low":3}[x["severity"]]):
            icon = {"critical":"🔴","high":"🟠","medium":"🟡","low":"🔵"}[f["severity"]]
            print(f"\n  {icon} {f['name']} [{f['severity'].upper()}]")
            print(f"     💡 {f['advice']}")

    if result["good_signs"]:
        print(f"\n{'─'*60}")
        print("  GOOD PRACTICES FOUND:")
        for g in result["good_signs"]:
            print(f"  {g}")

    print(f"\n{'='*60}")

def cmd_template(args):
    contract = generate_contract(
        args.type,
        client=args.client or "[Client Name]",
        rate=args.rate or 95,
        total=args.total or 5000,
    )
    print(contract)

def cmd_checklist(args):
    print(CHECKLIST)

def cmd_types(args):
    print("\n📋 Available Contract Templates:")
    for key, t in TEMPLATES.items():
        print(f"  • {key}: {t['name']}")


def main():
    parser = argparse.ArgumentParser(description="Cortex Freelancer — Contract Risk Analyzer")
    sub = parser.add_subparsers(dest="command")

    a = sub.add_parser("analyze", help="Analyze contract for risks")
    a.add_argument("--file", help="Path to contract file")
    a.add_argument("--text", help="Contract text to analyze")
    a.set_defaults(func=cmd_analyze)

    t = sub.add_parser("template", help="Generate contract template")
    t.add_argument("--type", required=True, choices=list(TEMPLATES.keys()))
    t.add_argument("--client", default="")
    t.add_argument("--rate", type=float, default=95)
    t.add_argument("--total", type=float, default=5000)
    t.set_defaults(func=cmd_template)

    c = sub.add_parser("checklist", help="Show contract checklist")
    c.set_defaults(func=cmd_checklist)

    tp = sub.add_parser("types", help="List template types")
    tp.set_defaults(func=cmd_types)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
