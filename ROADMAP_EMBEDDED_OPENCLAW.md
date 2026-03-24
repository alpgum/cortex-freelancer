# Cortex Freelancer — Embedded OpenClaw Roadmap
> "Her freelancer'ın içine gömülmüş bir OpenClaw'u var"
> Date: 2026-03-24

---

## Vizyon

Cortex Freelancer'ın asıl value prop'u tool'lar değil — **kişisel AI asistan**. 
Kullanıcı siteye gelip chat açtığında arkada senin lokal OpenClaw'un çalışıyor.
Ama kullanıcı bunu bilmiyor — sadece "Cortex AI" ile konuştuğunu sanıyor.

**Kullanıcı perspektifi:**
```
"Cortex, yarınki client meeting için 5 slide'lık sunum hazırla"
→ Gamma API ile sunum oluşturulur, PDF linki verilir

"Bu ay kaç kazandım, spreadsheet yap"
→ Google Sheets'e earnings tablosu eklenir, link verilir

"Upwork'teki bu iş ilanına proposal yaz"
→ Job description parse edilir, kişiselleştirilmiş proposal üretilir

"Bu client'a follow-up maili yaz, 5 gündür cevap yok"
→ Profesyonel follow-up draft'ı verilir
```

**Teknik gerçek:**
- Her kullanıcı request'i → senin OpenClaw'a sınırlı scope'la iletiliyor
- OpenClaw skill'leri + tool'ları kullanıyor (Gamma, Sheets, TTS, web search vs.)
- Sonuç kullanıcıya chat üzerinden dönüyor
- Kullanıcı hiçbir zaman kurulum yapmıyor, CLI görmüyor, config dosyası bilmiyor

---

## Mimari

```
┌─────────────────────────────────────┐
│  Cortex Freelancer (Web App)        │
│  cortexfreelancer.com               │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Chat UI (webchat benzeri)   │   │
│  │  Kullanıcı mesaj yazar      │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│             ▼                       │
│  ┌─────────────────────────────┐   │
│  │  API Gateway (Vercel)        │   │
│  │  /api/chat                   │   │
│  │  - Auth check (JWT/session)  │   │
│  │  - Rate limit (free/pro)     │   │
│  │  - Scope filter              │   │
│  └──────────┬──────────────────┘   │
│             │                       │
└─────────────┼───────────────────────┘
              │ HTTPS (webhook/API)
              ▼
┌─────────────────────────────────────┐
│  Alp's OpenClaw (lokal veya VPS)    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Cortex Agent (isolated)     │   │
│  │  - SOUL.md: freelancer coach │   │
│  │  - Skills: gamma, sheets,    │   │
│  │    proposal-gen, invoice,    │   │
│  │    email-writer, web-search  │   │
│  │  - Sandbox: kendi workspace  │   │
│  │  - NO access to Alp's files  │   │
│  └─────────────────────────────┘   │
│                                     │
│  Rate limit: X msg/user/day         │
│  Scope: freelancer tasks only       │
│  Output: text + file links          │
└─────────────────────────────────────┘
```

---

## Phase 0: Foundations (1 hafta)

### 0.1 OpenClaw Agent Oluştur
- [ ] `agents/cortex-freelancer/` dizini oluştur
- [ ] `SOUL.md`: "Sen Cortex, freelancer'ların AI iş yöneticisisin. Türkçe+EN. Kısa, aksiyon odaklı cevaplar."
- [ ] `AGENTS.md`: Scope kuralları — sadece freelancer konuları, kişisel veri yok
- [ ] Workspace: `/workspace/cortex-freelancer-users/` (her user'a alt klasör)
- [ ] Skills whitelist: gamma-export, web-search, proposal-gen (yeni), invoice-gen (yeni)

### 0.2 API Endpoint
- [ ] `/api/chat` Vercel serverless function
- [ ] Request: `{ userId, message, sessionId }`
- [ ] Response: `{ reply, files: [{name, url}], suggestions: [] }`
- [ ] Auth: JWT token (Firebase auth'dan) veya anonymous session
- [ ] Rate limit: Free=10 msg/gün, Pro=100 msg/gün

### 0.3 OpenClaw ↔ API Bağlantısı
- [ ] OpenClaw'da yeni plugin/webhook: dışarıdan mesaj alıp isolated session'da işle
- [ ] `sessions_spawn` ile her kullanıcı mesajı izole session'da çalışır
- [ ] Response webhook: session bitince Vercel API'ye callback
- [ ] Alternatif: OpenClaw webchat'i doğrudan embed et (iframe/postMessage)

---

## Phase 1: Chat UI + Temel Komutlar (1 hafta)

### 1.1 Chat Arayüzü
- [ ] `/app/chat.html` — full-screen chat (şu an boş sayfa var)
- [ ] Message bubbles (user/ai), typing indicator, auto-scroll
- [ ] Suggestion chips: "Write a proposal", "Create invoice", "Analyze job post"
- [ ] File preview: PDF/image inline, spreadsheet link
- [ ] Mobile responsive, dark theme (mevcut design system)

### 1.2 İlk 5 Komut (Skill Bazlı)
- [ ] **Proposal Writer**: Job URL/description → kişiselleştirilmiş proposal
- [ ] **Invoice Generator**: Client + items → PDF invoice (mevcut tool'u chat'e bağla)
- [ ] **Email Writer**: Durum + context → profesyonel email draft
- [ ] **Rate Calculator**: "Saatlik ne istemem lazım?" → hesaplama + açıklama
- [ ] **Job Analyzer**: Job post paste → red flags + match % + tavsiye

### 1.3 Context Awareness
- [ ] Chat, kullanıcının profile-bridge'deki profilini otomatik kullanır
- [ ] "Based on your profile (React dev, $45/hr, Turkey)..." gibi kişisel cevaplar
- [ ] Session memory: aynı sohbette önceki mesajları hatırla

---

## Phase 2: Dosya Üretimi + Dış Entegrasyonlar (2 hafta)

### 2.1 Gamma Sunumları
- [ ] "Yarınki toplantı için sunum hazırla" → Gamma API → PDF link
- [ ] Template'ler: Client Pitch, Project Proposal, Portfolio Showcase, Weekly Report
- [ ] Kullanıcı profil verileri otomatik enjekte (isim, skills, portfolio)

### 2.2 Google Sheets/Drive
- [ ] "Bu ayki kazançlarımı spreadsheet yap" → Sheets API → paylaşım linki
- [ ] Template'ler: Monthly Earnings, Client Tracker, Expense Log, Tax Summary
- [ ] Service account ile user'a share (veya public link)

### 2.3 Dosya Yönetimi
- [ ] Her kullanıcının `/workspace/cortex-freelancer-users/{userId}/` klasörü
- [ ] Üretilen dosyalar burada saklanır
- [ ] Chat'te "son dosyalarım" → liste
- [ ] Vercel'den dosya serve (veya S3/R2 bucket)

---

## Phase 3: Proactive Agent (2 hafta)

### 3.1 Günlük Briefing
- [ ] Her sabah (kullanıcının timezone'una göre) otomatik mesaj:
  - "Bugün 3 yeni job match var, 1 invoice overdue, client X'e follow-up zamanı"
- [ ] Push notification (web) veya email

### 3.2 Job Monitoring
- [ ] Kullanıcının skill'lerine göre Upwork/Fiverr RSS/API tarama
- [ ] Yeni iyi match bulunca: "Bu iş sana uygun! Proposal yazayım mı?"
- [ ] Cron job: her 4 saatte tarama

### 3.3 Deadline & Follow-up Tracking
- [ ] "Client X'e 3 gün önce proposal gönderdim" → otomatik follow-up hatırlatma
- [ ] Invoice due date tracking → "Invoice #12 yarın due, hatırlatma göndereyim mi?"

---

## Phase 4: Multi-User Scaling (2 hafta)

### 4.1 Queue Sistemi
- [ ] Tek OpenClaw instance, çoklu kullanıcı → request queue
- [ ] Priority: Pro users > Free users
- [ ] Max concurrent sessions: 4 (mevcut ACP slot sayısı)
- [ ] Queue full ise: "Şu an yoğunum, ~2dk içinde cevap veririm"

### 4.2 User Isolation
- [ ] Her user kendi session'ında, birbirinin verisine erişemez
- [ ] Alp'in dosyalarına hiçbir user erişemez (sandbox)
- [ ] Workspace per user: `/users/{id}/` altında izole

### 4.3 Usage Tracking + Billing
- [ ] Her mesaj/dosya üretimi loglanır (Amplitude event)
- [ ] Free limit: 10 msg/gün, 2 dosya/gün
- [ ] Pro limit: 100 msg/gün, 20 dosya/gün, priority queue
- [ ] Stripe billing entegrasyonu (Phase 1'den mevcut demo → gerçeğe çevir)

---

## Phase 5: Scale Beyond Single Instance (uzun vade)

### 5.1 VPS'e Taşıma
- [ ] OpenClaw'u dedicated VPS'e kur (Hetzner $5/mo)
- [ ] Lokal Mac'ten bağımsız çalışsın (Alp'in bilgisayarı kapalı olsa bile)
- [ ] Cloudflare Tunnel yerine doğrudan public endpoint

### 5.2 Multi-Instance
- [ ] Kullanıcı arttıkça 2. OpenClaw instance → load balancer
- [ ] Veya: Claude API direkt kullanım (OpenClaw bypass) for simple queries, OpenClaw for tool-requiring tasks

### 5.3 White-Label
- [ ] Başka platformlar da kendi "embedded OpenClaw"unu kursun
- [ ] Cortex SaaS olarak satılsın
- [ ] Config: SOUL.md + skill whitelist + branding = yeni ürün

---

## Güvenlik Kuralları (tüm phase'lerde geçerli)

1. **User → Alp dosyaları: YASAK** — kullanıcı asla Alp'in workspace'ine erişemez
2. **User → User: YASAK** — kullanıcılar birbirinin verisine erişemez
3. **Scope filter** — Agent sadece freelancer komutlarını kabul eder, sistem komutları reddedilir
4. **Output filter** — Dosya path'leri, API key'ler, internal URL'ler kullanıcıya gösterilmez
5. **Rate limit** — Abuse prevention (DDoS, spam, prompt injection)
6. **Audit log** — Her komut loglanır, anomali detection

---

## Öncelik Sırası

| Phase | Süre | Etki | Zorluk |
|-------|------|------|--------|
| 0: Foundations | 1 hafta | Altyapı | Orta |
| 1: Chat + 5 komut | 1 hafta | **İLK DEĞERİ GÖREN KULLANICI** | Orta |
| 2: Dosya üretimi | 2 hafta | "Wow" anı | Yüksek |
| 3: Proactive agent | 2 hafta | Retention | Orta |
| 4: Multi-user | 2 hafta | Scaling | Yüksek |
| 5: VPS + White-label | ongoing | Business | Yüksek |

**Toplam MVP (Phase 0-1): 2 hafta → ilk kullanıcı değer görür**
**Full product (Phase 0-4): 8 hafta → ölçeklenebilir ürün**

---

## Hemen Yapılabilecek İlk Adım

```
1. agents/cortex-freelancer/ oluştur (SOUL.md + skill whitelist)
2. /api/chat endpoint'i yaz (Vercel → OpenClaw sessions_spawn)
3. /app/chat.html'i gerçek chat'e çevir
4. İlk test: "Write me a proposal for this React job"
```

Tahmini: **1 gün** içinde çalışan ilk demo.
