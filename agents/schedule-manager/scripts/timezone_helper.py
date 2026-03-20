#!/usr/bin/env python3
"""Timezone helper for finding overlapping business hours between two timezones.

Suggests best meeting windows by calculating the overlap of business hours
(9 AM - 6 PM) across two timezones.

Usage:
    python3 timezone_helper.py --me "Africa/Cairo" --client "America/New_York"
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

# Manual UTC offset mapping for common timezones (hours from UTC).
# Used as fallback when zoneinfo is unavailable.
_OFFSET_MAP = {
    "UTC": 0,
    "GMT": 0,
    "Africa/Cairo": 2,
    "Africa/Lagos": 1,
    "Africa/Nairobi": 3,
    "Africa/Johannesburg": 2,
    "Africa/Casablanca": 1,
    "America/New_York": -5,
    "America/Chicago": -6,
    "America/Denver": -7,
    "America/Los_Angeles": -8,
    "America/Toronto": -5,
    "America/Sao_Paulo": -3,
    "America/Mexico_City": -6,
    "America/Bogota": -5,
    "America/Argentina/Buenos_Aires": -3,
    "Europe/London": 0,
    "Europe/Berlin": 1,
    "Europe/Paris": 1,
    "Europe/Istanbul": 3,
    "Europe/Moscow": 3,
    "Europe/Madrid": 1,
    "Europe/Rome": 1,
    "Europe/Amsterdam": 1,
    "Asia/Karachi": 5,
    "Asia/Kolkata": 5.5,
    "Asia/Dubai": 4,
    "Asia/Shanghai": 8,
    "Asia/Tokyo": 9,
    "Asia/Singapore": 8,
    "Asia/Seoul": 9,
    "Asia/Hong_Kong": 8,
    "Asia/Riyadh": 3,
    "Asia/Jakarta": 7,
    "Asia/Bangkok": 7,
    "Australia/Sydney": 11,
    "Australia/Melbourne": 11,
    "Australia/Perth": 8,
    "Pacific/Auckland": 13,
    "Pacific/Honolulu": -10,
}

BUSINESS_START = 9   # 9 AM
BUSINESS_END = 18    # 6 PM


def _get_tz(name):
    """Return a timezone object for the given name.

    Tries zoneinfo first (Python 3.9+), falls back to manual offset map.
    """
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(name)
    except (ImportError, KeyError):
        pass

    if name in _OFFSET_MAP:
        offset_hours = _OFFSET_MAP[name]
        whole = int(offset_hours)
        frac = offset_hours - whole
        return timezone(timedelta(hours=whole, minutes=int(frac * 60)))

    return None


def _format_offset(tz_obj):
    """Return a human-readable UTC offset string like UTC+02:00."""
    now = datetime.now(tz_obj)
    off = now.utcoffset()
    total_seconds = int(off.total_seconds())
    sign = "+" if total_seconds >= 0 else "-"
    total_seconds = abs(total_seconds)
    h, m = divmod(total_seconds // 60, 60)
    return "UTC{}{:02d}:{:02d}".format(sign, h, m)


def find_overlap(tz_me, tz_client):
    """Find overlapping business hours between two timezones.

    Returns a list of (hour_me_local, hour_client_local) tuples for each
    overlapping hour.
    """
    now_me = datetime.now(tz_me)
    off_me = now_me.utcoffset().total_seconds() / 3600
    now_c = datetime.now(tz_client)
    off_client = now_c.utcoffset().total_seconds() / 3600

    overlaps = []
    for utc_hour in range(24):
        local_me = (utc_hour + off_me) % 24
        local_client = (utc_hour + off_client) % 24
        if BUSINESS_START <= local_me < BUSINESS_END and BUSINESS_START <= local_client < BUSINESS_END:
            overlaps.append((local_me, local_client))
    return overlaps


def format_hour(h):
    """Format a decimal hour as HH:MM AM/PM."""
    whole = int(h)
    minutes = int((h - whole) * 60)
    suffix = "AM" if whole < 12 else "PM"
    display = whole if whole <= 12 else whole - 12
    if display == 0:
        display = 12
    return "{:d}:{:02d} {}".format(display, minutes, suffix)


def main():
    parser = argparse.ArgumentParser(
        description="Find overlapping business hours between two timezones and suggest meeting windows.",
        epilog='Example: python3 timezone_helper.py --me "Africa/Cairo" --client "America/New_York"',
    )
    parser.add_argument("--me", required=True, help="Your timezone (e.g. Africa/Cairo)")
    parser.add_argument("--client", required=True, help="Client timezone (e.g. America/New_York)")
    args = parser.parse_args()

    tz_me = _get_tz(args.me)
    if tz_me is None:
        print("Error: Unknown timezone '{}'.".format(args.me), file=sys.stderr)
        print("Supported timezones (fallback list): {}".format(
            ", ".join(sorted(_OFFSET_MAP.keys()))), file=sys.stderr)
        sys.exit(1)

    tz_client = _get_tz(args.client)
    if tz_client is None:
        print("Error: Unknown timezone '{}'.".format(args.client), file=sys.stderr)
        print("Supported timezones (fallback list): {}".format(
            ", ".join(sorted(_OFFSET_MAP.keys()))), file=sys.stderr)
        sys.exit(1)

    now_me = datetime.now(tz_me)
    now_client = datetime.now(tz_client)

    print("=" * 60)
    print("  TIMEZONE MEETING HELPER")
    print("=" * 60)
    print()
    print("  Your timezone:    {} ({})".format(args.me, _format_offset(tz_me)))
    print("  Client timezone:  {} ({})".format(args.client, _format_offset(tz_client)))
    print()
    print("  Current time for you:     {}".format(now_me.strftime("%Y-%m-%d %I:%M %p")))
    print("  Current time for client:  {}".format(now_client.strftime("%Y-%m-%d %I:%M %p")))
    print()

    off_diff = (now_client.utcoffset().total_seconds() - now_me.utcoffset().total_seconds()) / 3600
    sign = "+" if off_diff >= 0 else ""
    whole = int(off_diff)
    frac = abs(off_diff - whole)
    diff_str = "{}{}".format(sign, whole)
    if frac:
        diff_str += ":{:02d}".format(int(frac * 60))
    print("  Time difference:  Client is {}h from you".format(diff_str))
    print()

    overlaps = find_overlap(tz_me, tz_client)

    if not overlaps:
        print("  ** No overlapping business hours found! **")
        print("  Consider asynchronous communication or early/late meetings.")
        print()
        sys.exit(0)

    print("-" * 60)
    print("  OVERLAPPING BUSINESS HOURS ({}h overlap)".format(len(overlaps)))
    print("-" * 60)
    print()
    print("  {:<20} {:<20}".format("Your Time", "Client Time"))
    print("  {:<20} {:<20}".format("--------", "-----------"))
    for h_me, h_client in overlaps:
        end_me = h_me + 1
        end_client = h_client + 1
        print("  {} - {:<12} {} - {}".format(
            format_hour(h_me), format_hour(end_me),
            format_hour(h_client), format_hour(end_client)))
    print()

    print("-" * 60)
    print("  SUGGESTED BEST MEETING WINDOWS")
    print("-" * 60)
    print()

    # Prefer late-morning / early-afternoon for both parties when possible.
    # Score each slot: closer to midday (12-13) is better for both sides.
    def slot_score(h_me, h_client):
        mid = 12.5
        return abs(h_me - mid) + abs(h_client - mid)

    ranked = sorted(overlaps, key=lambda x: slot_score(x[0], x[1]))
    top = ranked[:3]
    for i, (h_me, h_client) in enumerate(top, 1):
        end_me = h_me + 1
        end_client = h_client + 1
        print("  Option {}:  You {}-{}  |  Client {}-{}".format(
            i, format_hour(h_me), format_hour(end_me),
            format_hour(h_client), format_hour(end_client)))

    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
