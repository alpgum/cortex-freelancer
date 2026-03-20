# Cortex Freelancer — Master Plan v2

> Owner: Alp | Orchestrator: Lucas | Status: ACTIVE SPRINT
> Domain: cortexfreelancer.com
> Created: 2026-03-20 | Updated: 2026-03-20
> Legal entity: UK Ltd (TBD Pazartesi)
> Target: First paying customer by March 27, 2026

---

## 🎯 Mission
Freelancer'ların tüm iş operasyonlarını yöneten AI web app.
Free viral hook (profil analizi) → Pro paywall ($29/mo) → Cenoa pipeline ($0 CAC).

## 📊 Mevcut Durum (20 Mart 18:00)
- 177 dosya, cortexfreelancer.com LIVE
- Viral app çalışıyor (Enter URL → instant analysis)
- 8 agent, 78+ template, 25+ script, 6 skill library
- Waitlist API + Stripe mock + CRO + 19 marketing dosyası hazır
- Pro paywall kısmen built, tam entegrasyon devam ediyor

---

## 🎯 Hedefler

### Kısa vade (7 gün — 27 Mart)
- [ ] İlk ödeme yapan müşteri ($29)
- [ ] 10 beta kullanıcı (5 free, 5 paid)
- [ ] 500+ free profil analizi

### Orta vade (30 gün — 20 Nisan)
- [ ] 50 paying customer = $1,450 MRR
- [ ] 2,000+ free analiz
- [ ] 100+ Cenoa signup (indirect)
- [ ] Product Hunt launch

### Uzun vade (90 gün — 20 Haziran)
- [ ] 500 paying customer = $14,500 MRR
- [ ] 20,000+ free analiz
- [ ] 500+ Cenoa activation
- [ ] Self-funding product

---

## 🗺️ 7-Day Sprint

### PHASE 1: Ürün Mükemmelliği (21-23 Mart — 3 gün)

**Gün 1 (Cuma gece/Cumartesi — 21 Mart):**
- [ ] Pro paywall tam çalışır (free → blur → $29 unlock)
- [ ] Invoice generator (browser, PDF çıktı)
- [ ] Proposal writer (template-based, clipboard copy)
- [ ] Template browser (78+ template, search/filter)
- [ ] Rate calculator (detaylı pazar analizi)
- [ ] Viral app polish (animasyonlar, mobile UX, edge cases)

**Gün 2 (Cumartesi — 22 Mart):**
- [ ] Stripe gerçek entegrasyon (UK şirket bilgisi gelince)
- [ ] Google OAuth login (Firebase Auth free tier)
- [ ] User dashboard (login sonrası: analizler, invoices, saved jobs)
- [ ] Terms of Service + Privacy Policy
- [ ] SEO kontrol (meta tags, OG images, canonical)

**Gün 3 (Pazar — 23 Mart):**
- [ ] End-to-end test (signup → analyze → pro → invoice → share)
- [ ] Mobile test (iOS Safari, Android Chrome)
- [ ] Lighthouse >90
- [ ] Bug fix sprint
- [ ] ✅ "Ürün hazır" checkpoint

### PHASE 2: Marketing Launch (24-27 Mart — 4 gün)

**Gün 4 (Pazartesi — 24 Mart):**
- [ ] Stripe live (UK şirket onayı)
- [ ] Domain + legal finalize
- [ ] Reddit soft launch (r/freelance — feedback post)
- [ ] 5 beta user recruit (EG/PK)

**Gün 5 (Salı — 25 Mart):**
- [ ] Twitter/X launch thread
- [ ] LinkedIn post
- [ ] Facebook groups (EG, PK, NG, TR)
- [ ] Upwork Community post

**Gün 6 (Çarşamba — 26 Mart):**
- [ ] Product Hunt launch
- [ ] Email waitlist'e launch maili
- [ ] Influencer outreach (10 DM)
- [ ] Reddit r/SideProject + r/SaaS

**Gün 7 (Perşembe — 27 Mart):**
- [ ] 🎯 İLK PAYING CUSTOMER
- [ ] Iterate based on feedback
- [ ] Double down on best channel

---

## 💰 Gelir Modeli

| Tier | Fiyat | İçerik |
|------|-------|--------|
| Free | $0 | 1 profil analizi, 5 job match, temel fee karşılaştırma, score card share |
| Pro | $29/mo | Sınırsız analiz, 20 job, invoice gen, proposal writer, 78 template, rate calc |
| Annual | $249/yr | Pro + %28 indirim + gelecek agent'lar dahil |

## 🔑 Başarı Metrikleri
- Activation: Free → Pro upgrade (%5 hedef)
- Viral: Her kullanıcı 0.3 kişiye share
- Cenoa: Fee savings gören → signup (%10)

## 🏗️ Teknik Altyapı
- Frontend: Vanilla HTML/CSS/JS (client-side)
- Backend: Express (Vercel serverless)
- Auth: Firebase Auth (Google login)
- Payment: Stripe Checkout
- Hosting: Vercel
- Domain: cortexfreelancer.com
- Storage: localStorage (free) + Firestore (pro users)
- Analytics: GA4

## 📁 Dosya Yapısı (177 dosya)
```
cortexfreelancer.com/
├── index.html          — Landing page (CRO optimized)
├── app/                — Viral web app (4 dosya)
├── agents/             — 8 agent paketi (SOUL/KNOWLEDGE/templates/scripts)
├── skills/             — 6 skill library
├── scripts/            — Global automation scripts
├── marketing/          — 19 GTM dosyası
├── api/                — Waitlist + Stripe + Download APIs
├── docs/               — Getting started + agent catalog
├── data/               — Waitlist + customer storage
├── pricing.html        — Pricing page
├── admin.html          — Admin dashboard
├── thanks.html         — Post-signup
├── checkout-success.html
├── server.js           — Express server
└── vercel.json         — Routing config
```
