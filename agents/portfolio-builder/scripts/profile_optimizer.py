#!/usr/bin/env python3
"""
Profile Optimizer — Portfolio Builder Agent
Analyzes freelancer profile text and suggests optimizations with scoring.

Usage:
    python3 profile_optimizer.py --input my-profile.txt
    echo "I am a web developer..." | python3 profile_optimizer.py --stdin
    python3 profile_optimizer.py --input my-profile.txt --platform upwork
"""

import argparse
import re
import sys

WEAK_PHRASES = [
    ("i am a passionate", -5, "Replace with a specific value proposition or result"),
    ("i am a hardworking", -5, "Replace with proof of results — show, don't tell"),
    ("i am a dedicated", -5, "Replace with a specific outcome you deliver"),
    ("i hope", -3, "Remove — confidence, not hope"),
    ("i think i can", -5, "Replace with 'I will' or 'I deliver'"),
    ("just a freelancer", -8, "Never diminish yourself — you're a specialist"),
    ("any kind of", -4, "Narrow your focus — specialists get paid more"),
    ("i can do anything", -6, "Pick a niche and lead with it"),
    ("please hire me", -8, "Remove — signals desperation"),
    ("i need work", -8, "Focus on what you offer, not what you need"),
    ("cheap", -5, "Use 'cost-effective' or 'competitive' instead"),
    ("sorry", -3, "Remove apologetic language"),
    ("i will try", -4, "Replace with 'I will' — confidence matters"),
]

STRONG_SIGNALS = [
    (r'\d+%', 3, "Includes percentage metrics"),
    (r'\$[\d,]+', 3, "Includes dollar amounts"),
    (r'\d+\+?\s*(years?|yrs?)', 2, "Mentions years of experience"),
    (r'\d+\+?\s*(projects?|clients?|companies)', 3, "Quantifies experience"),
    (r'(increased|improved|reduced|grew|boosted|saved|generated)', 3, "Uses result-oriented verbs"),
    (r'(roi|conversion|revenue|traffic|engagement)', 2, "Mentions business metrics"),
    (r'(top rated|100%|5[\s-]star|jss)', 3, "Includes platform credentials"),
    (r'(specializ|expert|focus)', 2, "Signals specialization"),
]

MUST_HAVES = [
    ("specific_result", r'(\d+%|\$[\d,]+|\d+x)', "Include at least one specific metric or result"),
    ("call_to_action", r'(message me|contact|let.s talk|book a call|send me|reach out|get in touch)', "Add a call-to-action"),
    ("niche_signal", r'(specializ|focus|expert|specifically)', "Signal a specialization or niche"),
    ("social_proof", r'(client|project|compan|review|testimonial|rated)', "Reference past clients or social proof"),
]


def analyze_profile(text, platform="general"):
    text_lower = text.lower()
    score = 50
    suggestions = []
    positives = []

    for phrase, penalty, suggestion in WEAK_PHRASES:
        if phrase in text_lower:
            score += penalty
            suggestions.append(f"  ⚠ Found \"{phrase}\" — {suggestion}")

    for pattern, bonus, note in STRONG_SIGNALS:
        if re.search(pattern, text_lower):
            score += bonus
            positives.append(f"  ✓ {note}")

    for name, pattern, suggestion in MUST_HAVES:
        if not re.search(pattern, text_lower):
            score -= 8
            suggestions.append(f"  ✗ Missing: {suggestion}")
        else:
            score += 5
            positives.append(f"  ✓ Has {name.replace('_', ' ')}")

    word_count = len(text.split())
    if word_count < 50:
        score -= 10
        suggestions.append(f"  ✗ Too short ({word_count} words). Aim for 150-300.")
    elif word_count < 100:
        score -= 5
        suggestions.append(f"  ⚠ Short ({word_count} words). Aim for 150-300.")
    elif word_count > 500:
        score -= 3
        suggestions.append(f"  ⚠ Long ({word_count} words). Consider trimming to 200-400.")
    else:
        score += 5
        positives.append(f"  ✓ Good length ({word_count} words)")

    first_line = text.strip().split('\n')[0].lower() if text.strip() else ""
    if first_line.startswith("i am") or first_line.startswith("i'm a"):
        score -= 5
        suggestions.append("  ⚠ First line starts with 'I am...' — lead with value instead")

    paragraphs = [p for p in text.strip().split('\n\n') if p.strip()]
    if len(paragraphs) < 3:
        score -= 5
        suggestions.append("  ⚠ Add more structure — use paragraphs: Hook → Services → Proof → CTA")

    score = max(0, min(100, score))
    return {"score": score, "positives": positives, "suggestions": suggestions, "word_count": word_count, "paragraphs": len(paragraphs)}


def print_report(result):
    score = result["score"]
    if score >= 80:
        grade, emoji, verdict = "A", "🟢", "Strong profile — minor tweaks only"
    elif score >= 60:
        grade, emoji, verdict = "B", "🟡", "Good foundation — address suggestions below"
    elif score >= 40:
        grade, emoji, verdict = "C", "🟠", "Needs improvement — key elements missing"
    else:
        grade, emoji, verdict = "D", "🔴", "Major overhaul needed"

    print(f"# Profile Analysis Report\n")
    print(f"## Score: {emoji} {score}/100 (Grade: {grade})")
    print(f"*{verdict}*\n")
    print(f"**Words:** {result['word_count']} | **Paragraphs:** {result['paragraphs']}\n")

    if result["positives"]:
        print("## What's Working")
        for p in result["positives"]:
            print(p)
        print()

    if result["suggestions"]:
        print("## Improvements Needed")
        for s in result["suggestions"]:
            print(s)
        print()

    print("## Quick Wins")
    print("1. Lead with your #1 result in the first line")
    print("2. Add 3+ specific metrics (%, $, client counts)")
    print("3. End with a clear call-to-action")
    print("4. Remove weak phrases flagged above")


def main():
    parser = argparse.ArgumentParser(description="Analyze and score a freelancer profile.")
    parser.add_argument("--input", type=str, help="Path to profile text file")
    parser.add_argument("--stdin", action="store_true", help="Read from stdin")
    parser.add_argument("--platform", default="general", choices=["general", "upwork", "fiverr", "linkedin"])
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.stdin or (not args.input and not sys.stdin.isatty()):
        text = sys.stdin.read()
    elif args.input:
        try:
            with open(args.input, 'r') as f:
                text = f.read()
        except FileNotFoundError:
            print(f"Error: File not found: {args.input}")
            sys.exit(1)
    else:
        parser.error("Provide --input FILE or pipe via stdin")

    if not text.strip():
        print("Error: Empty profile text")
        sys.exit(1)

    result = analyze_profile(text, args.platform)
    if args.json:
        import json
        print(json.dumps(result, indent=2))
    else:
        print_report(result)


if __name__ == "__main__":
    main()
