#!/usr/bin/env python3
"""
Smart Client Communication Manager (CFX-064b)

Professional client communication system with:
- Template library for common scenarios (follow-ups, scope changes, delays, etc.)
- Communication timeline tracking per client
- Sentiment analysis of client interactions
- Smart follow-up scheduling with optimal timing
- Communication health scoring per relationship

Usage:
    python smart_client_comms.py draft --type follow_up --client "Acme Corp"
    python smart_client_comms.py draft --type scope_change --client "TechFlow" --context "They want 3 more pages"
    python smart_client_comms.py timeline --client "Acme Corp"
    python smart_client_comms.py health
    python smart_client_comms.py schedule
"""

import argparse
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(os.environ.get("CORTEX_DATA_DIR", Path.home() / ".cortex-freelancer"))
COMMS_FILE = DATA_DIR / "client_communications.json"

# ---------------------------------------------------------------------------
# Communication Templates
# ---------------------------------------------------------------------------

TEMPLATES = {
    "follow_up": {
        "name": "Project Follow-Up",
        "subject": "Quick update on {project}",
        "body": """Hi {client_name},

Hope you're doing well! I wanted to check in on {project}.

{context}

I'm on track with the current timeline and wanted to see if you have any questions or if there's anything you'd like to discuss before the next milestone.

Looking forward to hearing from you.

Best,
{sender_name}""",
        "best_time": "Tuesday-Thursday, 10:00-11:00 AM client timezone",
        "follow_up_days": 3,
    },
    "scope_change": {
        "name": "Scope Change Request",
        "subject": "Scope adjustment for {project} — let's align",
        "body": """Hi {client_name},

Thanks for sharing the additional requirements for {project}. I've reviewed them carefully.

**What's changing:**
{context}

**Impact assessment:**
- Additional time estimate: {est_hours} hours
- Timeline adjustment: {timeline_impact}
- Cost adjustment: ${cost_impact}

I want to make sure we're aligned before proceeding. I can prepare a quick change order for your approval, or we can hop on a 15-minute call to discuss.

What works best for you?

Best,
{sender_name}""",
        "best_time": "Send within 24h of scope change request",
        "follow_up_days": 2,
    },
    "delay_notification": {
        "name": "Delay Notification",
        "subject": "Timeline update for {project}",
        "body": """Hi {client_name},

I want to be upfront about the timeline for {project}.

**What happened:**
{context}

**Revised timeline:**
- Original deadline: {original_deadline}
- New estimated completion: {new_deadline}
- Reason: {delay_reason}

**What I'm doing about it:**
- {mitigation_1}
- {mitigation_2}

I take deadlines seriously and wanted to let you know as soon as possible rather than at the last minute. Please let me know if this impacts anything on your end — I'm happy to discuss alternatives.

Best,
{sender_name}""",
        "best_time": "As soon as delay is identified — never delay the delay notice",
        "follow_up_days": 1,
    },
    "milestone_delivery": {
        "name": "Milestone Delivery",
        "subject": "🎉 {milestone} complete — {project}",
        "body": """Hi {client_name},

Great news — {milestone} for {project} is complete!

**What's included:**
{deliverables}

**Key highlights:**
{context}

**Next steps:**
- Please review by {review_deadline}
- I'll address any feedback within {revision_timeline}
- Next milestone: {next_milestone}

Let me know if you have any questions or feedback. Excited about how this is coming together!

Best,
{sender_name}""",
        "best_time": "Tuesday-Wednesday, morning in client timezone",
        "follow_up_days": 3,
    },
    "payment_reminder": {
        "name": "Payment Reminder",
        "subject": "Invoice #{invoice_number} — friendly reminder",
        "body": """Hi {client_name},

I hope everything's going well! I'm writing to follow up on Invoice #{invoice_number} for {project}, which was due on {due_date}.

**Invoice details:**
- Amount: ${amount}
- Due date: {due_date}
- Days overdue: {days_overdue}

I understand things can slip through the cracks — would you mind checking on this when you get a chance? If there are any issues, I'm happy to discuss.

Payment can be sent to: {payment_details}

Thank you!

Best,
{sender_name}""",
        "best_time": "Tuesday morning, never Monday or Friday",
        "follow_up_days": 5,
    },
    "project_kickoff": {
        "name": "Project Kickoff",
        "subject": "Let's get started on {project}! 🚀",
        "body": """Hi {client_name},

Excited to kick off {project}! Here's what to expect:

**Project overview:**
{context}

**Timeline:**
- Start date: {start_date}
- First milestone: {first_milestone}
- Estimated completion: {end_date}

**What I need from you:**
- {requirement_1}
- {requirement_2}
- {requirement_3}

**Communication:**
- I'll send weekly progress updates every {update_day}
- Best way to reach me: {contact_method}
- Response time: Within {response_time}

Would {kickoff_date} work for a quick kickoff call? I'd love to align on priorities and answer any questions.

Let's build something great!

Best,
{sender_name}""",
        "best_time": "Within 24h of contract signing",
        "follow_up_days": 1,
    },
    "testimonial_request": {
        "name": "Testimonial Request",
        "subject": "Quick favor — would love your feedback on {project}",
        "body": """Hi {client_name},

It was a pleasure working with you on {project}! I'm really happy with how it turned out.

If you have a moment, would you mind sharing a brief testimonial about your experience? It would mean a lot and helps other clients know what to expect.

A few questions that might help (feel free to answer any or all):
1. What was the biggest challenge before we started working together?
2. What stood out most about working with me?
3. What results or improvements have you seen?

Even 2-3 sentences would be fantastic. And of course, I'm happy to write a recommendation for you as well!

Thank you so much,
{sender_name}""",
        "best_time": "1-2 weeks after project completion, after positive feedback",
        "follow_up_days": 7,
    },
    "rate_increase": {
        "name": "Rate Increase Notice",
        "subject": "Updated rates for {year} — {project}",
        "body": """Hi {client_name},

I wanted to let you know about an update to my rates, effective {effective_date}.

**What's changing:**
- Current rate: ${current_rate}/hr
- New rate: ${new_rate}/hr
- Effective: {effective_date}

**Why:**
{context}

**What stays the same:**
- Same quality and attention to detail
- Same responsiveness and communication
- Any work currently in progress will be honored at the current rate

I value our working relationship and wanted to give you plenty of notice. Happy to discuss if you have any questions.

Best,
{sender_name}""",
        "best_time": "30+ days before effective date, Tuesday-Thursday",
        "follow_up_days": 7,
    },
}

# ---------------------------------------------------------------------------
# Communication Tracker
# ---------------------------------------------------------------------------

class ClientCommsManager:
    def __init__(self):
        self.data = self._load()

    def _load(self) -> Dict:
        if COMMS_FILE.exists():
            with open(COMMS_FILE) as f:
                return json.load(f)
        return {"communications": [], "clients": {}, "scheduled_followups": []}

    def _save(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(COMMS_FILE, "w") as f:
            json.dump(self.data, f, indent=2, default=str)

    def log_communication(self, client: str, comm_type: str, subject: str,
                          direction: str = "outgoing", sentiment: str = "neutral",
                          notes: str = ""):
        entry = {
            "id": f"comm-{len(self.data['communications'])+1}",
            "client": client,
            "type": comm_type,
            "subject": subject,
            "direction": direction,
            "sentiment": sentiment,
            "notes": notes,
            "timestamp": datetime.now().isoformat(),
        }
        self.data["communications"].append(entry)

        # Update client health
        if client not in self.data["clients"]:
            self.data["clients"][client] = {"first_contact": datetime.now().isoformat(), "notes": ""}
        self.data["clients"][client]["last_contact"] = datetime.now().isoformat()
        self.data["clients"][client]["total_comms"] = sum(
            1 for c in self.data["communications"] if c["client"] == client
        )
        self._save()
        return entry

    def get_timeline(self, client: str) -> List[Dict]:
        return sorted(
            [c for c in self.data["communications"] if c["client"].lower() == client.lower()],
            key=lambda x: x["timestamp"], reverse=True
        )

    def communication_health(self) -> List[Dict]:
        """Score communication health per client."""
        clients = defaultdict(list)
        for c in self.data["communications"]:
            clients[c["client"]].append(c)

        results = []
        now = datetime.now()
        for client, comms in clients.items():
            sorted_comms = sorted(comms, key=lambda x: x["timestamp"])
            last = datetime.fromisoformat(sorted_comms[-1]["timestamp"])
            days_since = (now - last).days

            outgoing = sum(1 for c in comms if c.get("direction") == "outgoing")
            incoming = sum(1 for c in comms if c.get("direction") == "incoming")
            positive = sum(1 for c in comms if c.get("sentiment") == "positive")
            negative = sum(1 for c in comms if c.get("sentiment") == "negative")

            # Health score: recency + frequency + sentiment balance
            recency_score = max(0, 100 - days_since * 5)
            balance_score = min(100, (min(outgoing, incoming) / max(outgoing, incoming, 1)) * 100)
            sentiment_score = (positive * 2 - negative * 3 + len(comms)) / max(len(comms), 1) * 50
            health = min(100, round((recency_score * 0.4 + balance_score * 0.3 + sentiment_score * 0.3)))

            if health >= 70: level = "Healthy 🟢"
            elif health >= 40: level = "Needs Attention 🟡"
            else: level = "At Risk 🔴"

            results.append({
                "client": client,
                "health_score": health,
                "health_level": level,
                "days_since_contact": days_since,
                "total_comms": len(comms),
                "outgoing": outgoing,
                "incoming": incoming,
                "positive": positive,
                "negative": negative,
                "suggestion": f"Reach out soon — it's been {days_since} days" if days_since > 7
                             else "Communication is healthy" if health >= 70
                             else "Consider a check-in",
            })
        return sorted(results, key=lambda x: x["health_score"])

    def due_followups(self) -> List[Dict]:
        """Find communications that need follow-up."""
        due = []
        now = datetime.now()
        for comm in self.data["communications"]:
            if comm.get("direction") != "outgoing":
                continue
            template = TEMPLATES.get(comm.get("type", ""))
            if not template:
                continue
            sent = datetime.fromisoformat(comm["timestamp"])
            followup_days = template.get("follow_up_days", 3)
            followup_date = sent + timedelta(days=followup_days)
            # Check if there's been a response
            has_response = any(
                c for c in self.data["communications"]
                if c["client"] == comm["client"]
                and c.get("direction") == "incoming"
                and datetime.fromisoformat(c["timestamp"]) > sent
            )
            if not has_response and now > followup_date:
                due.append({
                    "client": comm["client"],
                    "original_type": comm["type"],
                    "sent_date": comm["timestamp"],
                    "followup_due": followup_date.isoformat(),
                    "days_overdue": (now - followup_date).days,
                })
        return due


# ---------------------------------------------------------------------------
# Draft Generator
# ---------------------------------------------------------------------------

def draft_message(template_type: str, client: str, context: str = "",
                  sender: str = "Your Name", **kwargs) -> str:
    template = TEMPLATES.get(template_type)
    if not template:
        available = ", ".join(TEMPLATES.keys())
        return f"❌ Unknown template: {template_type}\nAvailable: {available}"

    # Fill template with provided values, leave placeholders for missing
    text = template["body"]
    fills = {
        "client_name": client,
        "sender_name": sender,
        "context": context or "[Add context here]",
        "project": kwargs.get("project", "[Project Name]"),
        **kwargs,
    }
    for key, val in fills.items():
        text = text.replace("{" + key + "}", str(val))

    subject = template["subject"]
    for key, val in fills.items():
        subject = subject.replace("{" + key + "}", str(val))

    output = f"""
{'='*60}
📧 {template['name']}
{'='*60}
Subject: {subject}

{text}

{'─'*60}
💡 Timing: {template['best_time']}
📅 Follow-up in: {template['follow_up_days']} days if no response
{'='*60}
"""
    return output


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_draft(args):
    result = draft_message(
        args.type, args.client, args.context or "",
        sender=args.sender or "Your Name",
        project=args.project or "[Project Name]",
    )
    print(result)

def cmd_timeline(args):
    mgr = ClientCommsManager()
    timeline = mgr.get_timeline(args.client)
    if not timeline:
        print(f"No communication history for '{args.client}'")
        # Show sample
        print("\nTip: Log communications with 'log' command first")
        return
    print(f"\n📋 Communication Timeline — {args.client}")
    print("=" * 60)
    for c in timeline[:20]:
        arrow = "→" if c.get("direction") == "outgoing" else "←"
        sent_label = {"positive": "😊", "negative": "😟", "neutral": "😐"}.get(c.get("sentiment", ""), "")
        print(f"  {c['timestamp'][:16]} {arrow} {c['type']} {sent_label}")
        if c.get("subject"):
            print(f"    Subject: {c['subject']}")
        if c.get("notes"):
            print(f"    Notes: {c['notes']}")

def cmd_health(args):
    mgr = ClientCommsManager()
    health = mgr.communication_health()
    if not health:
        print("No communication data yet. Log some interactions first!")
        print("\nSample command: python smart_client_comms.py log --client 'Acme' --type follow_up --subject 'Project update'")
        return
    print("\n🏥 Client Communication Health")
    print("=" * 60)
    for h in health:
        print(f"\n  {h['health_level']} {h['client']} — Score: {h['health_score']}/100")
        print(f"    Last contact: {h['days_since_contact']} days ago | Total: {h['total_comms']} comms")
        print(f"    → {h['suggestion']}")

def cmd_schedule(args):
    mgr = ClientCommsManager()
    due = mgr.due_followups()
    if not due:
        print("✅ No follow-ups currently due!")
        return
    print("\n📅 Due Follow-Ups")
    print("=" * 60)
    for f in due:
        print(f"  ⚠️ {f['client']} — {f['original_type']} ({f['days_overdue']} days overdue)")
        print(f"    Original sent: {f['sent_date'][:10]}")

def cmd_log(args):
    mgr = ClientCommsManager()
    entry = mgr.log_communication(
        args.client, args.type, args.subject,
        direction=args.direction, sentiment=args.sentiment, notes=args.notes or ""
    )
    print(f"✅ Logged: {entry['type']} with {entry['client']}")

def cmd_templates(args):
    print("\n📋 Available Communication Templates")
    print("=" * 60)
    for key, t in TEMPLATES.items():
        print(f"\n  📧 {key}")
        print(f"     {t['name']}")
        print(f"     Timing: {t['best_time']}")
        print(f"     Follow-up: {t['follow_up_days']} days")


def main():
    parser = argparse.ArgumentParser(description="Cortex Freelancer — Smart Client Communications")
    sub = parser.add_subparsers(dest="command")

    d = sub.add_parser("draft", help="Draft a client message")
    d.add_argument("--type", required=True, choices=list(TEMPLATES.keys()))
    d.add_argument("--client", required=True)
    d.add_argument("--context", default="")
    d.add_argument("--project", default="")
    d.add_argument("--sender", default="")
    d.set_defaults(func=cmd_draft)

    t = sub.add_parser("timeline", help="View communication timeline")
    t.add_argument("--client", required=True)
    t.set_defaults(func=cmd_timeline)

    h = sub.add_parser("health", help="Communication health scores")
    h.set_defaults(func=cmd_health)

    s = sub.add_parser("schedule", help="View due follow-ups")
    s.set_defaults(func=cmd_schedule)

    lg = sub.add_parser("log", help="Log a communication")
    lg.add_argument("--client", required=True)
    lg.add_argument("--type", required=True)
    lg.add_argument("--subject", required=True)
    lg.add_argument("--direction", choices=["outgoing", "incoming"], default="outgoing")
    lg.add_argument("--sentiment", choices=["positive", "neutral", "negative"], default="neutral")
    lg.add_argument("--notes", default="")
    lg.set_defaults(func=cmd_log)

    tp = sub.add_parser("templates", help="List available templates")
    tp.set_defaults(func=cmd_templates)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
