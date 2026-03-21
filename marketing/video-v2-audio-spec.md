# Cortex Freelancer — Promo Video v2 Audio Spec

**Video Duration:** ~60s (extended cut for social ads)
**Audio Layers:** Background music, SFX, optional voiceover
**Delivery:** Stereo, 48kHz, 16-bit WAV (master), MP3 320kbps (web)

---

## 1. Background Music — Lo-Fi Beat

### Vibe
Warm, cinematic lo-fi hip-hop. Starts mellow and melancholic, builds to confident and aspirational. Think "late-night hustle turning into early-morning wins."

### Recommended Tracks (Royalty-Free)

| Track | Artist / Source | Why It Works |
|-------|----------------|--------------|
| "Warm Nights" | Chillhop Music | Mellow keys + vinyl crackle, cinematic build |
| "Coffee Shop Coder" | Lofi Girl (YouTube Audio Library) | Warm piano loop, unobtrusive, steady groove |
| "Midnight Drive" | Purrple Cat | Subtle bass, ambient pads, perfect for tension-to-payoff arc |
| "Golden Hour" | DJ Quads | Uplifting chords at the break, pairs well with "win" moment |
| "Dawn" | Sappheiros | Gentle build, emotional resolution, ideal for CTA fade |

### Alt Sources
- Epidemic Sound: search "lo-fi cinematic" or "chill hip-hop motivational"
- Artlist: search "lo-fi beat warm" — filter by "Technology" or "Inspiring" mood
- Free Music Archive: search "chillhop" under CC-BY license

### Music Structure Map

| Time | Section | Musical Feel |
|------|---------|-------------|
| 0:00–0:08 | Hook / Pain Point | Sparse, muted — filtered keys, soft kick, vinyl crackle. Low energy. |
| 0:08–0:20 | AI Takes Over | Beat drops in gently. Add bass, light hi-hats. Building anticipation. |
| 0:20–0:32 | Ghost Apply | Full groove — crisp hi-hats (double-time feel), subtle synth layer. Energy rising. |
| 0:32–0:42 | The Win | Bass drop or brief silence (0.5s) then warm chord resolution. Emotional peak. |
| 0:42–0:52 | CTA + Brand | Beat simplifies, warm chords sustain, gentle fade begins at 0:48. |
| 0:52–1:00 | Outro / URL Hold | Music fades to near-silence. Subtle reverb tail. Clean end. |

### Mix Notes
- Keep beat at -12dB under voiceover (if used), -8dB otherwise
- Sidechain compress kick against VO for clarity
- Add subtle vinyl crackle throughout (continuous, -18dB)
- Master to -1dB true peak, -14 LUFS integrated (social platform standard)

---

## 2. Sound Effects (SFX)

| Timestamp | SFX | Description | Source Suggestion |
|-----------|-----|-------------|-------------------|
| 0:00 | Ambient room tone | Subtle keyboard/mouse clicks, distant city hum | Freesound.org "office ambient" |
| 0:08 | Soft UI whoosh | Marks transition to AI scanning screen | Artlist "UI whoosh soft" |
| 0:10 | Digital scan sweep | Rising tone as AI scans job listings | Epidemic Sound "digital scan" |
| 0:16 | Selection lock | Subtle "click-lock" when AI picks the $3,500 gig | Freesound "UI confirm click" |
| 0:20 | Ghost typing burst | Rapid mechanical key sounds, slightly inhuman speed | Layer 2x speed keyboard recording |
| 0:28 | Proposal send whoosh | Outgoing send/upload sound | Artlist "send notification" |
| 0:32 | Brief silence | 0.3s dead air for impact before the notification | — |
| 0:32.3 | Notification DING | Bright, clear, satisfying — the money notification | Use existing sfx_ding.wav or Epidemic "success chime" |
| 0:33 | Cash register ka-ching | Layered subtly under the ding for subconscious "money" cue | Freesound "cash register subtle" |
| 0:42 | Soft transition pad | Gentle swell into CTA section | Reverb tail from previous section |
| 0:58 | Final resolve tone | Single warm note, like a piano key releasing | Any soft piano one-shot, heavy reverb |

### SFX Mix Notes
- All SFX should sit at -10dB to -6dB relative to music
- The notification DING is the loudest SFX moment — brief peak at -4dB
- Use subtle reverb on SFX to match room acoustic (small room, warm)
- Layer no more than 2 SFX simultaneously to avoid clutter

---

## 3. Voiceover Script (Optional)

**Voice Profile:** Male, mid-20s to early 30s, warm and confident. Slight casual edge — like a friend sharing a secret, not a salesperson. Think "tech YouTuber energy." Medium pace.

**Accent:** Neutral/international English. Clear articulation. No heavy regional accent.

### Script

| Timestamp | Line | Direction |
|-----------|------|-----------|
| 0:01–0:04 | "You ever spend more time chasing clients… than actually working?" | Tired, relatable tone. Slight pause after "clients." |
| 0:08–0:13 | "What if an AI could scan thousands of jobs… and find the perfect ones for you?" | Curious, intriguing. Emphasis on "thousands" and "perfect." |
| 0:20–0:26 | "It writes your proposals. Tailored. Professional. Sent before you wake up." | Confident, measured. Each sentence is its own beat. |
| 0:32–0:37 | "And then… you get the notification. You're hired. Three thousand five hundred dollars." | Build from quiet anticipation to genuine excitement. Pause after "And then." |
| 0:42–0:48 | "Cortex Freelancer. The AI that runs your freelance business." | Warm, assured. Brand name spoken clearly. Slight smile in voice. |
| 0:50–0:54 | "Try it free. cortexfreelancer.com." | Inviting, casual. URL spoken slowly and clearly. |

### VO Recording Notes
- Record in treated space (no echo, no background noise)
- Deliver dry (no effects) — post will add subtle warmth EQ and room reverb
- Record at 48kHz/24-bit, leave 1s silence before and after each line
- Provide 2-3 takes per line for editing flexibility
- Total VO runtime: ~28s of spoken content across 60s video (plenty of breathing room)

### If No VO
- The video works without voiceover — text overlays carry the story
- Without VO, raise music level to -6dB and let SFX carry more weight
- Consider adding more ambient/environmental sound design to fill the space

---

## 4. Audio Timeline Overview

```
0s          10s         20s         30s         40s         50s         60s
|-----------|-----------|-----------|-----------|-----------|-----------|
MUSIC: [sparse lo-fi]→[beat builds]→[full groove]→[DROP+warm]→[resolve]→[fade]
SFX:   [room tone   ] [whoosh+scan] [typing    ] [DING!    ] [pad     ] [tone]
VO:    [pain point  ]  [curiosity ]  [proposal ]  [the win  ] [brand+CTA]
TEXT:  [Tired of...] [AI scans...] [Applies...] [$3,500   ] [URL hold  ]
```

---

## 5. Delivery Checklist

- [ ] Final music mix (WAV + MP3)
- [ ] SFX stems (individual WAV files per effect)
- [ ] VO stems (individual WAV files per line)
- [ ] Combined master audio (all layers mixed, WAV)
- [ ] Platform-specific exports:
  - Instagram Reels / TikTok: AAC, -14 LUFS
  - YouTube Shorts: AAC, -14 LUFS
  - Twitter/X: MP3 320kbps
  - LinkedIn: MP3 320kbps
