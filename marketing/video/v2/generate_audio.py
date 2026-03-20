#!/usr/bin/env python3
"""Generate audio assets for promo video v2."""

import os
import subprocess
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load ElevenLabs credentials
el_env = os.path.expanduser("~/.openclaw/credentials/elevenlabs.env")
el_key = None
el_voice = None
el_model = None
if os.path.exists(el_env):
    for line in open(el_env):
        line = line.strip()
        if line.startswith("export "):
            line = line[7:]
        if "=" in line:
            k, v = line.split("=", 1)
            v = v.strip("'\"")
            if k == "ELEVENLABS_API_KEY":
                el_key = v
            elif k == "ELEVENLABS_VOICE_ID":
                el_voice = v
            elif k == "ELEVENLABS_MODEL_ID":
                el_model = v


def generate_notification_ding():
    """Generate a pleasant notification ding using ffmpeg synthesis."""
    out_path = os.path.join(BASE_DIR, "sfx_ding.wav")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} exists")
        return out_path

    print("[GEN] Generating notification ding SFX...")
    # Two-tone chime: C6 (1047Hz) + E6 (1319Hz), short and pleasant
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i",
        "sine=frequency=1047:duration=0.15,afade=t=out:st=0.05:d=0.1",
        "-f", "lavfi", "-i",
        "sine=frequency=1319:duration=0.3,afade=t=in:st=0:d=0.02,afade=t=out:st=0.1:d=0.2",
        "-filter_complex",
        "[0:a]adelay=0|0[a1];[1:a]adelay=100|100[a2];[a1][a2]amix=inputs=2:duration=longest,volume=0.7",
        out_path
    ], check=True, capture_output=True)
    print(f"[OK] {out_path}")
    return out_path


def generate_silence_track(duration=23.0):
    """Generate a silent audio track as music placeholder."""
    out_path = os.path.join(BASE_DIR, "music_placeholder.wav")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} exists")
        return out_path

    print(f"[GEN] Generating {duration}s silence placeholder...")
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
        "-t", str(duration),
        out_path
    ], check=True, capture_output=True)
    print(f"[OK] {out_path}")
    return out_path


def generate_vo_cta():
    """Generate CTA voiceover via ElevenLabs if available."""
    if not el_key:
        print("[SKIP] No ElevenLabs API key — skipping VO")
        return None

    out_path = os.path.join(BASE_DIR, "vo_cta.mp3")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} exists")
        return out_path

    print("[GEN] Generating CTA voiceover via ElevenLabs...")
    import urllib.request

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{el_voice}"
    payload = json.dumps({
        "text": "Stop chasing clients. Let AI find them for you. Cortex Freelancer.",
        "model_id": el_model or "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }).encode()

    req = urllib.request.Request(url, data=payload, headers={
        "xi-api-key": el_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    })

    try:
        with urllib.request.urlopen(req) as resp:
            with open(out_path, "wb") as f:
                f.write(resp.read())
        print(f"[OK] {out_path}")
        return out_path
    except Exception as e:
        print(f"[ERROR] ElevenLabs VO failed: {e}")
        return None


if __name__ == "__main__":
    generate_notification_ding()
    generate_silence_track()
    generate_vo_cta()
    print("\nDone! Audio assets ready.")
