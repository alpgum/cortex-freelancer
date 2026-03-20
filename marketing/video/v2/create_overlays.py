#!/usr/bin/env python3
"""Create transparent PNG text overlays for promo video v2."""

import os
import json
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OVERLAYS_DIR = os.path.join(BASE_DIR, "overlays")
os.makedirs(OVERLAYS_DIR, exist_ok=True)

WIDTH, HEIGHT = 1080, 1920
TEXT_Y = HEIGHT - 250  # 250px from bottom

# Try to use a bold sans-serif font
FONT_PATHS = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFCompact.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def get_font(size=64):
    for fp in FONT_PATHS:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def create_overlay(text, filename, text_color="white", font_size=64):
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = get_font(font_size)

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (WIDTH - text_w) // 2
    y = TEXT_Y

    # Parse color
    if text_color.startswith("#"):
        r = int(text_color[1:3], 16)
        g = int(text_color[3:5], 16)
        b = int(text_color[5:7], 16)
        color = (r, g, b, 255)
    else:
        color = (255, 255, 255, 255)

    shadow_color = (0, 0, 0, 200)

    # Draw shadow (offset by 3px)
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            draw.text((x + dx, y + dy), text, font=font, fill=shadow_color)

    # Draw main text
    draw.text((x, y), text, font=font, fill=color)

    out_path = os.path.join(OVERLAYS_DIR, filename)
    img.save(out_path, "PNG")
    print(f"[OK] {out_path}")
    return out_path


if __name__ == "__main__":
    with open(os.path.join(BASE_DIR, "prompts.json")) as f:
        clips = json.load(f)

    for i, clip in enumerate(clips):
        create_overlay(
            text=clip["overlay_text"],
            filename=f"overlay_{i+1:02d}.png",
            text_color=clip.get("overlay_color", "white"),
        )

    print("\nDone! Check overlays/ directory.")
