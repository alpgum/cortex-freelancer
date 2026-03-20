#!/usr/bin/env python3
"""
Email Drafter — Client Communications Agent
Generates professional email drafts based on situation type, client context, and tone.

Usage:
    python3 email_drafter.py --client "Sarah Chen" --situation scope-creep --tone firm
    python3 email_drafter.py --client "Marcus" --situation follow-up --tone warm --context "Hasn't responded to mockups in 5 days"
    python3 email_drafter.py --list-situations
"""

import argparse
import sys
import textwrap
from datetime import datetime, timedelta

SITUATIONS = {
    "intro": {
        "name": "Introduction After Hire",
        "subject": "Excited to get started — quick intro + next steps",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                Thank you for choosing to work together — I'm genuinely excited about this project!

                Here's how I work:
                - **Communication:** I send weekly updates and respond within a few hours during business hours.
                - **Timeline:** I'll share a detailed timeline within 24 hours.
                - **What I need from you:** Any brand assets, access credentials, and reference examples.

                Would this week work for a quick 15-minute kickoff call? I have a few questions that'll help me deliver exactly what you're looking for.

                Looking forward to it!
                """),
            "formal": textwrap.dedent("""\
                Dear {client},

                Thank you for selecting me for this project. I look forward to delivering excellent results.

                I will share a detailed project plan and timeline within 24 hours. In the meantime, please provide:
                - Relevant brand assets and guidelines
                - Access credentials for any necessary systems
                - Reference materials or examples

                Please let me know your availability for a brief kickoff meeting this week.

                Best regards,
                """),
        }
    },
    "follow-up": {
        "name": "Follow-Up (No Response)",
        "subject": "Quick check-in on our project",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                Hope your week is going well! I wanted to check in — I sent over the deliverables on {date} and wanted to make sure they landed okay.

                I'm ready to move to the next phase once I have your feedback. No rush — just want to keep things on track.

                Let me know if you have any questions!
                """),
            "firm": textwrap.dedent("""\
                Hi {client},

                I want to make sure we stay on schedule. I'm currently waiting on your feedback from {date}.

                To hit our deadline, I'd ideally need your input by {deadline}. If your priorities have shifted, totally fine — just let me know so I can adjust the timeline accordingly.

                Happy to hop on a quick call if that's easier than writing feedback.
                """),
        }
    },
    "scope-creep": {
        "name": "Scope Creep Pushback",
        "subject": "Re: Additional requests — a couple of options",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                Great idea! I can see how that would add value to the project.

                That falls outside our current scope, but I have two options:

                1. **Swap it in:** I can replace a lower-priority item with this — same timeline, same budget.
                2. **Add it on:** I can include this as an additional deliverable with a separate quote.

                Which works better for you?
                """),
            "firm": textwrap.dedent("""\
                Hi {client},

                I appreciate you thinking bigger on this. To set expectations, this is a separate piece of work from what we originally scoped.

                I'd recommend we finish the current scope first, then tackle the new request as a Phase 2. I can put together a quick proposal for it.

                This way, the current project stays on track and you get a clear picture of the additional investment. Sound good?
                """),
        }
    },
    "payment-reminder": {
        "name": "Payment Reminder",
        "subject": "Friendly reminder — Invoice #{invoice}",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                Quick reminder that invoice #{invoice} for {amount} was due on {date}. Just wanted to make sure it didn't slip through the cracks.

                If there are any issues with the invoice, happy to sort them out. Otherwise, please let me know when I can expect payment.

                Thanks!
                """),
            "firm": textwrap.dedent("""\
                Hi {client},

                Following up on invoice #{invoice} for {amount}, which is now {days} days past due.

                Per our agreement, payment was due on {date}. I'd appreciate if you could process this at your earliest convenience.

                If there's a reason for the delay, please let me know so we can work something out. I'll need to pause ongoing work if the balance remains outstanding.
                """),
        }
    },
    "rate-negotiation": {
        "name": "Rate Negotiation",
        "subject": "Re: Project budget discussion",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                I appreciate you being upfront about the budget. Here's what I can offer:

                1. **Full scope at my standard rate** — everything we discussed, premium quality
                2. **Reduced scope at your budget** — I'd focus on the core deliverables and we can phase the rest
                3. **Retainer arrangement** — if you have ongoing work, I offer a discount for monthly commitments

                Which of these feels right for your situation?
                """),
            "firm": textwrap.dedent("""\
                Hi {client},

                Thanks for being transparent about the budget. My rate reflects the expertise and quality I bring to every project.

                I can't offer the full scope at a reduced rate, but I can adjust the scope to fit your budget. Here's what that would look like:

                - At your budget: [core deliverables only]
                - At my full rate: [complete scope with all features]

                Happy to go either direction — what works best for your goals?
                """),
        }
    },
    "thank-you": {
        "name": "Project Complete Thank You",
        "subject": "Project delivered — thank you!",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                The project is officially wrapped! It's been a genuine pleasure working with you.

                All deliverables have been sent, and I'll be available for any follow-up questions over the next two weeks.

                Three quick asks before I sign off:
                1. If you're happy, a review would mean the world to me
                2. If anyone in your network needs similar work, I'd appreciate a referral
                3. I'd love to help with future projects — just say the word

                Thank you for trusting me with this. Wishing you and your team all the best!
                """),
            "formal": textwrap.dedent("""\
                Dear {client},

                I am pleased to confirm that all project deliverables have been submitted. A summary of completed work is attached.

                I will remain available for post-delivery support for the next two weeks. Please do not hesitate to reach out with any questions.

                It has been a privilege working with you. I would welcome the opportunity to collaborate again in the future.

                Best regards,
                """),
        }
    },
    "negative-feedback": {
        "name": "Handle Negative Feedback",
        "subject": "Re: Your feedback — here's my plan",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                Thank you for the candid feedback — I appreciate you being specific about what isn't working. That helps me fix it quickly.

                Here's my plan:
                1. I'll address the core issues you raised within 48 hours
                2. I'll send you a revised version for review
                3. We can schedule a quick call to make sure everything is aligned

                I want to make sure you're completely happy with the result. If there's anything else I've missed, please let me know.
                """),
            "firm": textwrap.dedent("""\
                Hi {client},

                I take your feedback seriously and want to resolve this promptly.

                To make sure the revision hits the mark, I need a bit more specificity:
                - What aspects are working well? (So I keep those)
                - What specifically feels off?
                - Are there examples of what you had in mind?

                Once I have that clarity, I'll have a revised version to you within 48 hours. A brief call might be the fastest way to align — are you available this week?
                """),
        }
    },
    "upsell": {
        "name": "Upsell Existing Client",
        "subject": "Idea that could help {company}",
        "templates": {
            "warm": textwrap.dedent("""\
                Hi {client},

                While working on the project, I noticed an opportunity that might interest you:

                {context}

                I could address this in about a week. Based on similar work, you'd likely see a measurable improvement.

                Want me to put together a quick proposal? No obligation — just thought it was worth flagging since I'm already familiar with your setup.
                """),
            "firm": textwrap.dedent("""\
                Hi {client},

                Now that the current project is wrapping up, I wanted to share something I noticed during the work:

                {context}

                This is a natural next step that could build on the results we've achieved. I have a clear plan for addressing it efficiently.

                Shall I put together a detailed proposal with timeline and investment? I can have it to you by end of week.
                """),
        }
    },
}

TONES = ["warm", "formal", "firm", "firm-but-friendly"]


def resolve_tone(tone):
    """Map tone aliases to template keys."""
    mapping = {
        "warm": "warm",
        "friendly": "warm",
        "casual": "warm",
        "formal": "formal",
        "professional": "formal",
        "firm": "firm",
        "direct": "firm",
        "firm-but-friendly": "firm",
    }
    return mapping.get(tone, "warm")


def generate_draft(client, situation, tone, context=None, **kwargs):
    """Generate an email draft for the given situation."""
    sit = SITUATIONS.get(situation)
    if not sit:
        print(f"Error: Unknown situation '{situation}'")
        print(f"Available: {', '.join(SITUATIONS.keys())}")
        sys.exit(1)

    resolved = resolve_tone(tone)
    templates = sit["templates"]

    # Fall back to first available tone if exact match not found
    if resolved not in templates:
        resolved = list(templates.keys())[0]

    template = templates[resolved]

    # Build substitution values
    today = datetime.now()
    values = {
        "client": client,
        "date": (today - timedelta(days=5)).strftime("%B %d"),
        "deadline": (today + timedelta(days=3)).strftime("%B %d"),
        "days": "7",
        "invoice": "001",
        "amount": "$X,XXX",
        "company": f"{client}'s company",
        "context": context or "[Add specific context here]",
    }
    values.update(kwargs)

    subject = sit["subject"].format(**values)
    body = template.format(**values)

    return subject, body


def list_situations():
    """Print all available situations."""
    print("# Available Situations\n")
    for key, sit in SITUATIONS.items():
        tones = ", ".join(sit["templates"].keys())
        print(f"  {key:20s} — {sit['name']} (tones: {tones})")
    print(f"\n# Total: {len(SITUATIONS)} situations")


def main():
    parser = argparse.ArgumentParser(
        description="Generate professional email drafts for client communication.",
        epilog="Example: python3 email_drafter.py --client 'Sarah' --situation scope-creep --tone firm"
    )
    parser.add_argument("--client", type=str, help="Client name")
    parser.add_argument("--situation", type=str, help="Situation type (use --list-situations to see all)")
    parser.add_argument("--tone", type=str, default="warm",
                        help="Tone: warm, formal, firm, firm-but-friendly (default: warm)")
    parser.add_argument("--context", type=str, help="Additional context for the email")
    parser.add_argument("--list-situations", action="store_true", help="List all available situations")
    parser.add_argument("--subject-only", action="store_true", help="Output only the subject line")

    args = parser.parse_args()

    if args.list_situations:
        list_situations()
        sys.exit(0)

    if not args.client or not args.situation:
        parser.error("--client and --situation are required (or use --list-situations)")

    subject, body = generate_draft(args.client, args.situation, args.tone, args.context)

    if args.subject_only:
        print(subject)
    else:
        print(f"Subject: {subject}")
        print(f"Tone: {args.tone}")
        print(f"{'─' * 50}")
        print(body)
        print(f"{'─' * 50}")
        print("✓ Draft generated. Review tone before sending.")


if __name__ == "__main__":
    main()
