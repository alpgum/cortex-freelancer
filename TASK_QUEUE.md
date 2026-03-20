# Cortex Freelancer — Task Queue
# Status: PENDING | RUNNING | DONE | BLOCKED
# Lucas picks the first PENDING task and spawns ACP for it.

## RUNNING

### proposal-writer-ui ⏳
Proposal writer tool page at app/tools/proposal.html. Input: paste job description. Output: 2 proposal variants + copy button. Dark theme matching app. Pro gating (1 free, then paywall). Save drafts to localStorage. Link from main app tools nav. After done: git add -A && git commit -m "Add Proposal Writer tool" && git push

### template-browser-ui ⏳
Template browser at app/tools/templates.html. Show all 78+ templates from agents/*/templates/ organized by category (proposals, invoices, contracts, emails, reports). Search + filter. One-click copy. Dark theme. Pro gating. After done: git add -A && git commit -m "Add Template Browser tool" && git push

### video-v2-stitch ⏳
Stitch the 5 new clips in marketing/video/v2/clips/ (clip_01_hook through clip_05_cta). Create PNG text overlays with Python PIL (since ffmpeg drawtext unavailable). Overlay text per storyboard. Add crossfade transitions. Output: marketing/video/v2/promo_v2.mp4. Use venv: source ~/.openclaw/venv/bin/activate. After done: git add marketing/video/v2/ && git commit -m "Promo video v2 assembled" && git push

### vercel-deploy ⏳
In /Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer: ensure vercel.json routes api/* correctly, run "vercel --prod" to deploy all new endpoints (checkout, webhook, toggle-pro, tools). Verify deploy URL works. After done: git add -A && git commit -m "Production deploy with Stripe + tools" && git push

## PENDING

### mobile-qa
Test cortex-freelancer.vercel.app on mobile viewport (use browser tool). Check: landing page, viral app, pricing, invoice tool, rate calculator. Fix any layout breaks. After done: git add -A && git commit -m "Mobile responsive fixes" && git push

### terms-privacy
Create terms.html and privacy.html for Cortex Freelancer. Standard SaaS terms. UK company placeholder. Link from footer of all pages. After done: git add -A && git commit -m "Add Terms and Privacy pages" && git push

### seo-og-cleanup
Add proper meta tags, OG images, canonical URLs to all pages (index, app, pricing, tools). Generate OG image (1200x630) with app name + tagline. After done: git add -A && git commit -m "SEO and OG meta cleanup" && git push

## DONE
- stripe-checkout-paywall (b0c5156)
- rate-calculator (b0c5156)
- invoice-generator (app/tools/invoice.html)
- launch-dashboard (dashboard.html)
- promo-video-v2-clips (5 clips generated)

## BLOCKED
- stripe-live-mode (UK company + real keys — Monday)
