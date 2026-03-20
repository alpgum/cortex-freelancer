#!/bin/bash
# Stitch Cortex Freelancer promo clips into final video
# Requires: ffmpeg
# Usage: bash stitch.sh

cd "$(dirname "$0")"

CLIPS_DIR="clips"
OUTPUT="promo_v1.mp4"

# Check all clips exist
for f in clip_01_chill clip_02_screen clip_03_typing clip_04_notification clip_05_reaction; do
    if [ ! -f "$CLIPS_DIR/${f}.mp4" ]; then
        echo "Missing: $CLIPS_DIR/${f}.mp4"
        exit 1
    fi
done

# Create file list for concat
cat > /tmp/cortex_clips.txt << 'EOF'
file 'clips/clip_01_chill.mp4'
file 'clips/clip_02_screen.mp4'
file 'clips/clip_03_typing.mp4'
file 'clips/clip_04_notification.mp4'
file 'clips/clip_05_reaction.mp4'
EOF

# Step 1: Concatenate clips
echo "Concatenating clips..."
ffmpeg -y -f concat -safe 0 -i /tmp/cortex_clips.txt -c copy /tmp/cortex_concat.mp4

# Step 2: Scale to 1080x1920 and add text overlays
echo "Adding text overlays..."
ffmpeg -y -i /tmp/cortex_concat.mp4 -vf "\
scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,\
drawtext=text='What if AI found your next client?':fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t,0,5)',\
drawtext=text='Finding your next client...':fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t,5,10)',\
drawtext=text='Applying automatically...':fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t,10,15)',\
drawtext=text='You'\''re hired. \$3,500.':fontsize=56:fontcolor=00ff00:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t,15,20)',\
drawtext=text='cortexfreelancer.com':fontsize=44:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t,20,25)',\
fade=t=in:st=0:d=0.5,fade=t=out:st=24:d=1\
" -c:a copy "$OUTPUT"

echo "Done! Output: $OUTPUT"
echo "Add background music manually with:"
echo "  ffmpeg -i $OUTPUT -i music.mp3 -c:v copy -c:a aac -shortest promo_v1_music.mp4"
