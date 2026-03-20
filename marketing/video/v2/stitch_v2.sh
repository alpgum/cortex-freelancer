#!/bin/bash
# Stitch Cortex Freelancer promo v2 - crossfades, overlays, fades
# Requires: ffmpeg with libx264
set -e

cd "$(dirname "$0")"

CLIPS_DIR="clips"
OVERLAYS_DIR="overlays"
OUTPUT="promo_v2.mp4"

# Clip durations (all 5s from Kling, but we trim for pacing)
# Clip 1: 4s, Clip 2: 6s (pad), Clip 3: 5s, Clip 4: 6s (pad), Clip 5: 6s (pad)
# Since Kling generates 5s clips, we'll use all at 5s and rely on crossfades for rhythm

CLIPS=(
    "$CLIPS_DIR/clip_01_hook.mp4"
    "$CLIPS_DIR/clip_02_ai_scan.mp4"
    "$CLIPS_DIR/clip_03_ghost_apply.mp4"
    "$CLIPS_DIR/clip_04_hired.mp4"
    "$CLIPS_DIR/clip_05_cta.mp4"
)

# Check all clips exist
for f in "${CLIPS[@]}"; do
    if [ ! -f "$f" ]; then
        echo "Missing: $f"
        exit 1
    fi
done

echo "=== Step 1: Normalize all clips to 1080x1920 ==="
for i in 0 1 2 3 4; do
    echo "Normalizing clip $((i+1))..."
    ffmpeg -y -i "${CLIPS[$i]}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30" -c:v libx264 -preset fast -crf 18 -an /tmp/cortex_v2_clip_$((i+1)).mp4 2>/dev/null
done

echo "=== Step 2: Add crossfade transitions ==="
# xfade filter chain: 0.5s crossfade between each pair
# Each clip is 5s. With 0.5s crossfade, effective length: 5*5 - 4*0.5 = 23s
FADE_DUR=0.5

# Build the complex xfade chain
ffmpeg -y \
    -i /tmp/cortex_v2_clip_1.mp4 \
    -i /tmp/cortex_v2_clip_2.mp4 \
    -i /tmp/cortex_v2_clip_3.mp4 \
    -i /tmp/cortex_v2_clip_4.mp4 \
    -i /tmp/cortex_v2_clip_5.mp4 \
    -filter_complex "\
[0:v][1:v]xfade=transition=fade:duration=${FADE_DUR}:offset=4.5[v01]; \
[v01][2:v]xfade=transition=fade:duration=${FADE_DUR}:offset=9.0[v012]; \
[v012][3:v]xfade=transition=fade:duration=${FADE_DUR}:offset=13.5[v0123]; \
[v0123][4:v]xfade=transition=fade:duration=${FADE_DUR}:offset=18.0[vall]; \
[vall]fade=t=in:st=0:d=0.5,fade=t=out:st=21.5:d=1.0[vfinal]" \
    -map "[vfinal]" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p /tmp/cortex_v2_stitched.mp4 2>/dev/null

echo "=== Step 3: Add text overlays ==="
# Overlay timing (seconds from start of stitched video):
# Clip 1: 0.5s - 4.5s   → overlay_01 from 0.5 to 4.0
# Clip 2: 4.5s - 9.5s   → overlay_02 from 5.5 to 9.0
# Clip 3: 9.0s - 14.0s  → overlay_03 from 10.0 to 13.5
# Clip 4: 13.5s - 18.5s → overlay_04 from 15.0 to 18.0
# Clip 5: 18.0s - 23.0s → overlay_05 from 19.0 to 22.5

ffmpeg -y \
    -i /tmp/cortex_v2_stitched.mp4 \
    -i "$OVERLAYS_DIR/overlay_01.png" \
    -i "$OVERLAYS_DIR/overlay_02.png" \
    -i "$OVERLAYS_DIR/overlay_03.png" \
    -i "$OVERLAYS_DIR/overlay_04.png" \
    -i "$OVERLAYS_DIR/overlay_05.png" \
    -filter_complex "\
[1:v]format=rgba[ov1]; \
[2:v]format=rgba[ov2]; \
[3:v]format=rgba[ov3]; \
[4:v]format=rgba[ov4]; \
[5:v]format=rgba[ov5]; \
[0:v][ov1]overlay=0:0:enable='between(t,0.5,4.0)'[t1]; \
[t1][ov2]overlay=0:0:enable='between(t,5.5,9.0)'[t2]; \
[t2][ov3]overlay=0:0:enable='between(t,10.0,13.5)'[t3]; \
[t3][ov4]overlay=0:0:enable='between(t,15.0,18.0)'[t4]; \
[t4][ov5]overlay=0:0:enable='between(t,19.0,22.5)'[vout]" \
    -map "[vout]" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p "$OUTPUT" 2>/dev/null

echo "=== Step 4: Mix audio ==="
# Get video duration
VID_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT" 2>/dev/null)

# Create silence track matching video duration
ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" -t "$VID_DUR" /tmp/cortex_v2_silence.wav 2>/dev/null

# Mix: silence base + ding SFX at ~15s (clip 4 start + 0.5s) + VO at ~18s (clip 5)
AUDIO_FILTER=""
AUDIO_INPUTS="-i /tmp/cortex_v2_silence.wav"
AUDIO_IDX=1

if [ -f "sfx_ding.wav" ]; then
    AUDIO_INPUTS="$AUDIO_INPUTS -i sfx_ding.wav"
    AUDIO_FILTER="[${AUDIO_IDX}:a]adelay=14000|14000,volume=1.5[ding];"
    AUDIO_IDX=$((AUDIO_IDX+1))
fi

if [ -f "vo_cta.mp3" ]; then
    AUDIO_INPUTS="$AUDIO_INPUTS -i vo_cta.mp3"
    AUDIO_FILTER="${AUDIO_FILTER}[${AUDIO_IDX}:a]adelay=18500|18500,volume=1.2[vo];"
    AUDIO_IDX=$((AUDIO_IDX+1))
fi

# Build amix based on available audio
if [ -f "sfx_ding.wav" ] && [ -f "vo_cta.mp3" ]; then
    ffmpeg -y $AUDIO_INPUTS -filter_complex \
        "${AUDIO_FILTER}[0:a][ding][vo]amix=inputs=3:duration=first:normalize=0" \
        /tmp/cortex_v2_audio.wav 2>/dev/null
elif [ -f "sfx_ding.wav" ]; then
    ffmpeg -y $AUDIO_INPUTS -filter_complex \
        "${AUDIO_FILTER}[0:a][ding]amix=inputs=2:duration=first:normalize=0" \
        /tmp/cortex_v2_audio.wav 2>/dev/null
else
    cp /tmp/cortex_v2_silence.wav /tmp/cortex_v2_audio.wav
fi

echo "=== Step 5: Merge video + audio ==="
ffmpeg -y -i "$OUTPUT" -i /tmp/cortex_v2_audio.wav \
    -c:v copy -c:a aac -b:a 192k -shortest \
    /tmp/cortex_v2_with_audio.mp4 2>/dev/null
mv /tmp/cortex_v2_with_audio.mp4 "$OUTPUT"

echo "=== Done! ==="
echo "Output: $OUTPUT"
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT" 2>/dev/null)
echo "Duration: ${DURATION}s"
echo "Size: $(du -h "$OUTPUT" | cut -f1)"
