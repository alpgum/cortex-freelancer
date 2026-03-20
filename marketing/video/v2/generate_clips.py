#!/usr/bin/env python3
"""Generate promo video v2 clips for Cortex Freelancer via fal.ai Kling 3 Pro."""

import os
import sys
import json
import urllib.request
import time

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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIPS_DIR = os.path.join(BASE_DIR, "clips")
os.makedirs(CLIPS_DIR, exist_ok=True)

MODEL = "fal-ai/kling-video/v3/pro/text-to-video"

# Load prompts
with open(os.path.join(BASE_DIR, "prompts.json")) as f:
    CLIPS = json.load(f)

COST_PER_CLIP = 0.70  # approximate cost for Kling 3 Pro 5s clip
costs = []


def generate_clip(clip_info):
    name = clip_info["name"]
    out_path = os.path.join(CLIPS_DIR, f"{name}.mp4")

    if os.path.exists(out_path):
        print(f"[SKIP] {name} already exists")
        return out_path

    print(f"[GEN] {name} — generating via Kling 3 Pro...")
    start = time.time()
    result = fal_client.subscribe(
        MODEL,
        arguments={
            "prompt": clip_info["prompt"],
            "aspect_ratio": "9:16",
            "duration": clip_info.get("duration", "5"),
        },
    )
    elapsed = time.time() - start
    print(f"[GEN] {name} completed in {elapsed:.0f}s")

    video_url = result.get("video", {}).get("url") or result.get("url")
    if not video_url:
        print(f"[ERROR] No video URL for {name}")
        print(json.dumps(result, indent=2, default=str))
        return None

    print(f"[DL] {name} → {out_path}")
    urllib.request.urlretrieve(video_url, out_path)
    costs.append({"clip": name, "cost_usd": COST_PER_CLIP, "duration_s": elapsed})
    return out_path


if __name__ == "__main__":
    if len(sys.argv) > 1:
        idx = int(sys.argv[1])
        generate_clip(CLIPS[idx])
    else:
        for clip in CLIPS:
            generate_clip(clip)

    # Save cost breakdown
    cost_path = os.path.join(BASE_DIR, "costs.json")
    with open(cost_path, "w") as f:
        json.dump(costs, f, indent=2)
    total = sum(c["cost_usd"] for c in costs)
    print(f"\nTotal estimated cost: ${total:.2f}")
    print("Done! Check clips/ directory.")
