#!/usr/bin/env python3
"""Generate PNG text overlays for promo v2 clips per STORYBOARD_v2.md specs."""

from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920
OUT_DIR = os.path.join(os.path.dirname(__file__), "overlays")
os.makedirs(OUT_DIR, exist_ok=True)

overlays = [
    ("overlay_01.png", "Tired of chasing clients?", "white"),
    ("overlay_02.png", "AI scans. AI matches.", "white"),
    ("overlay_03.png", "Applies while you sleep.", "white"),
    ("overlay_04.png", "You're hired. $3,500.", "#00FF66"),
    ("overlay_05.png", "cortexfreelancer.com", "white"),
]

# Try to find a bold sans-serif font
FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNSDisplay-Bold.otf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf",
]

font = None
for fp in FONT_CANDIDATES:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 64)
            print(f"Using font: {fp}")
            break
        except Exception:
            continue

if font is None:
    font = ImageFont.load_default()
    print("WARNING: using default font (no bold sans-serif found)")

shadow_offset = 3

for fname, text, color in overlays:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    x = (W - tw) // 2
    y = H - 200 - th  # ~200px from bottom

    # Black drop shadow
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill="black")
    # Main text
    draw.text((x, y), text, font=font, fill=color)

    out_path = os.path.join(OUT_DIR, fname)
    img.save(out_path)
    print(f"Created {fname} ({tw}x{th})")

print("Done.")
