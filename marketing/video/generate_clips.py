#!/usr/bin/env python3
"""Generate promo video clips for Cortex Freelancer via fal.ai Kling 3 Pro."""

import os
import sys
import json
import urllib.request

try:
    import fal_client
except ImportError:
    print("ERROR: pip install fal-client", file=sys.stderr)
    sys.exit(1)

# Load credentials
cred_path = os.path.expanduser("~/.openclaw/credentials/fal.env")
if not os.environ.get("FAL_KEY") and os.path.exists(cred_path):
    for line in open(cred_path):
        if line.startswith("FAL_KEY="):
            os.environ["FAL_KEY"] = line.strip().split("=", 1)[1]

CLIPS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clips")
os.makedirs(CLIPS_DIR, exist_ok=True)

MODEL = "fal-ai/kling-video/v3/pro"  # ~$2/clip

CLIPS = [
    {
        "name": "clip_01_chill",
        "prompt": (
            "Cinematic close-up of a young freelancer sitting at a modern desk with a glowing laptop screen. "
            "Hands raised in the air in a relaxed pose, leaning back in an ergonomic chair. "
            "Dark room illuminated only by a warm desk lamp and the laptop glow. "
            "Shallow depth of field, film grain, moody atmosphere. The person looks relaxed and slightly amused. "
            "Shot on anamorphic lens, 9:16 vertical framing."
        ),
    },
    {
        "name": "clip_02_screen",
        "prompt": (
            "POV shot of a laptop screen in a dark room showing a freelance job listing website. "
            "A bright green highlight overlay smoothly appears around one job listing. "
            "An automated cursor moves to click it. Dark UI with matrix-green accents, code-like elements. "
            "Screen recording aesthetic, glowing text. Cinematic, 9:16 vertical framing."
        ),
    },
    {
        "name": "clip_03_typing",
        "prompt": (
            "Cinematic close-up of a laptop keyboard with ghost typing effect. Keys pressing themselves rapidly "
            "with no hands visible. The screen in the background shows a job application form being filled out "
            "at superhuman speed. Dark moody lighting, shallow depth of field. "
            "Futuristic AI automation feel. 9:16 vertical framing."
        ),
    },
    {
        "name": "clip_04_notification",
        "prompt": (
            "Close-up of a laptop screen in a dark room showing a large green notification popup that reads "
            "'Congratulations' with colorful confetti animation bursting across the screen. "
            "Bright green glow reflecting on the person's face visible at the bottom of frame. "
            "Dramatic lighting, celebratory mood. 9:16 vertical framing."
        ),
    },
    {
        "name": "clip_05_reaction",
        "prompt": (
            "Cinematic close-up of a young freelancer at a desk. Hands still raised in the air. "
            "Face transitions from a relaxed expression to pure shock and amazement. Mouth drops open, eyes go wide. "
            "Warm desk lamp lighting, laptop glow on face, shallow depth of field. "
            "The ultimate wow reaction moment. 9:16 vertical framing."
        ),
    },
]


def generate_clip(clip_info):
    name = clip_info["name"]
    out_path = os.path.join(CLIPS_DIR, f"{name}.mp4")

    if os.path.exists(out_path):
        print(f"[SKIP] {name} already exists")
        return out_path

    print(f"[GEN] {name} — generating via Kling 3 Pro...")
    result = fal_client.subscribe(
        MODEL,
        arguments={
            "prompt": clip_info["prompt"],
            "aspect_ratio": "9:16",
            "duration": "5",
        },
    )

    video_url = result.get("video", {}).get("url") or result.get("url")
    if not video_url:
        print(f"[ERROR] No video URL for {name}")
        print(json.dumps(result, indent=2, default=str))
        return None

    print(f"[DL] {name} → {out_path}")
    urllib.request.urlretrieve(video_url, out_path)
    return out_path


if __name__ == "__main__":
    # Allow generating a single clip by index: python generate_clips.py 0
    if len(sys.argv) > 1:
        idx = int(sys.argv[1])
        generate_clip(CLIPS[idx])
    else:
        for clip in CLIPS:
            generate_clip(clip)
    print("\nDone! Check clips/ directory.")
