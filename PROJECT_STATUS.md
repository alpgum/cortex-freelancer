# Cortex Freelancer — Project Status
> Son güncelleme: 2026-03-23 21:33 TRT
> Tüm agent'lar bu dosyayı okuyarak güncel durumu öğrenebilir.

## Live URL'ler
- **Landing:** https://cortexfreelancer.com
- **App:** https://cortexfreelancer.com/app/index.html (login olmadan erişilebilir)
- **Tools Hub:** https://cortexfreelancer.com/app/tools/
- **HQ Panel:** https://cortexfreelancer.com/hq
- **GitHub:** https://github.com/alpgum/cortex-freelancer
- **Hosting:** Vercel (cenoas-projects/cortex-freelancer)

## Güncel Teknik Durum (23 Mart 2026)

### ✅ Çalışan
- Guest mode — login olmadan tüm app erişilebilir
- Proposal Writer — job description'dan tam proposal üretiyor (client-side)
- Invoice Creator, Rate Calculator, Fee Calculator, tüm statik tool'lar
- Landing page, pricing, waitlist form
- GA4 tracking (GTM-NDV9WQ7)
- Dark/light theme toggle
- Cookie consent (CookieHub)

### ⚠️ Kısmen Çalışan
- Google Sign-in: redirect flow'a geçildi, authDomain=cortexfreelancer.com, ama Vercel'de Firebase `__/auth/handler` yok → test edilmedi
- Firebase Firestore: config mevcut (tets-e825e projesi), Email/Password auth Firebase Console'da aktif değil

### ❌ Çalışmayan
- Chat: `/api/chat` backend endpoint yok (Anthropic API çağırıyor ama Vercel'de serverless function olarak deploy edilmemiş)
- Upwork gerçek profil çekme: mock data üretiyor, [601-606] task'ları queue'da

### 🔧 Son Yapılan Değişiklikler (23 Mart)
1. **CSP tamamen kaldırıldı** — Sprint task'ları `'unsafe-inline'` kaldırmıştı, tüm inline JS kırılmıştı. 57 dosyadan CSP meta tag silindi.
2. **Auth guard devre dışı** — 30 HTML dosyasından `auth-guard.js` include kaldırıldı. Guest olarak geçiş sağlandı.
3. **Login/Signup'a "Continue as Guest" butonu** eklendi.
4. **Google Sign-in popup → redirect** flow'a geçirildi (`auth.js`).
5. **authDomain** `tets-e825e.firebaseapp.com` → `cortexfreelancer.com` olarak güncellendi (`auth.js` + `firebase-config.js`).
6. **Service Worker** cache version v3→v4 bump edildi.
7. **HQ dashboard** güncel proje metrikleriyle güncellendi.

### 📋 TODO / Bilinen Sorunlar
- [ ] CSP'yi `'unsafe-inline'` dahil olarak geri ekle (güvenlik)
- [ ] Chat backend'i Vercel serverless function olarak deploy et
- [ ] Firebase Console'da Email/Password auth aktif et
- [ ] Stripe live keys (UK şirket kurulumu bekleniyor)
- [ ] Upwork gerçek profil entegrasyonu [601-606]
- [ ] Service Worker purge stratejisi (eski cache sorunları)

### 🏗️ Mimari
- **Frontend:** Vanilla HTML + CSS + JS (tek sayfa app'ler, SPA değil)
- **Backend:** Express.js server (server.js, port 3847) — sadece lokal dev için
- **API:** `/api/` altında Vercel serverless functions (chat.js, waitlist.js, stripe.js vs.)
- **Auth:** Firebase Auth (Google provider + Email/Password placeholder)
- **DB:** Firebase Firestore (tets-e825e projesi)
- **Analytics:** GA4 via GTM + Amplitude (GTM üzerinden)
- **Payments:** Stripe (mock mode, live keys bekleniyor)
- **Deploy:** Vercel, `vercel --prod --yes` ile manuel veya git push ile auto

### 📊 Metrikler
- Tasks Done: 540+
- Git Commits: 400+
- Waitlist: 1,247+
- Paying Customers: 0 (pre-launch)
- Pro Launch Target: 3 Nisan 2026

### 🗂️ Önemli Dosyalar
- `app/_includes/head.js` — shared head (CSP buradan yönetiliyordu, şimdi devre dışı)
- `app/_includes/auth-guard.js` — auth guard (devre dışı, guest mode)
- `app/auth.js` — Firebase auth + Google Sign-in (redirect flow)
- `app/_includes/firebase-config.js` — Firebase config
- `app/engine.js` — Upwork profil analiz motoru (şimdilik mock)
- `server.js` — Express dev server (port 3847)
- `api/chat.js` — Chat API (Anthropic, serverless)
- `cortex-hq.html` — Founder control panel
- `TASK_QUEUE_600.md` — Sprint task queue
- `vercel.json` — Deploy config + routes
- `service-worker.js` — SW cache (v4)
