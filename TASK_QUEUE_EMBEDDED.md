# Cortex Freelancer — Embedded OpenClaw Task Queue
> Phase 0 + Phase 1 | Optimized for parallel ACP execution
> Created: 2026-03-24

---

## Dependency Graph

```
WAVE 1 (parallel, zero deps)
├── T01: Agent identity + workspace
├── T02: Chat UI shell (mock responses)
├── T03: Proposal writer engine
├── T04: Email writer engine  
└── T05: Job analyzer engine

WAVE 2 (parallel, depends on Wave 1 completing)
├── T06: /api/chat endpoint + protocol (needs T01 for agent config)
├── T07: Chat ↔ profile bridge (needs T02 for chat DOM)
└── T08: Invoice + Rate tools chat adapter (needs existing tools)

WAVE 3 (parallel, depends on Wave 2)
├── T09: OpenClaw webhook receiver (needs T06 for protocol)
├── T10: Chat tool dispatcher (needs T06 + T03/T04/T05)
└── T11: Rate limiting + session management (needs T06)

WAVE 4 (sequential, integration)
├── T12: Wire everything + E2E test
└── T13: Deploy + smoke test + polish
```

---

## WAVE 1 — Bağımsız modüller (5 paralel ACP)

### [T01] Agent Identity + Workspace Setup
**Scope:** OpenClaw agent config, yeni bir "cortex-freelancer" agent tanımla
**Files to create:**
- `agents/cortex-freelancer/SOUL.md` — Persona: "Sen Cortex, freelancer'ların AI iş yöneticisisin"
  - Tone: profesyonel ama samimi, aksiyon odaklı, kısa cevaplar
  - Dil: kullanıcının diline uyar (TR/EN auto-detect)
  - Scope: SADECE freelancer konuları (proposals, invoices, rates, jobs, clients, scheduling)
  - Yasaklar: sistem komutları, Alp'in dosyaları, diğer kullanıcı verisi
- `agents/cortex-freelancer/AGENTS.md` — Agent kuralları
  - Tool whitelist: web_search, gamma-export, google-sheets (ileride)
  - Dosya erişimi: sadece kendi workspace'i
  - Session kuralları: her kullanıcı izole session
- `agents/cortex-freelancer/TOOLS.md` — Mevcut tool notları
- `agents/cortex-freelancer/workspace/` dizini (boş, user dosyaları burada olacak)
- `agents/cortex-freelancer/skills/` — freelancer-specific skill pointerları

**ACP talimatı:** "Bu bir config/docs task'ı. Kod yok. Markdown dosyaları oluştur."
**Commit:** `feat(T01): cortex-freelancer agent identity + workspace`

---

### [T02] Chat UI Shell (Mock Responses)
**Scope:** Çalışan, güzel bir chat arayüzü — henüz backend yok, mock cevaplar
**Files:**
- `app/chat.html` — REWRITE (şu an boş/placeholder olabilir)
  - Full-screen chat layout, dark theme (mevcut design system)
  - Header: "Cortex AI" + user avatar + back button
  - Message list: user bubbles (sağ, yeşil), AI bubbles (sol, gri)
  - Input bar: textarea + send button + suggestion chips
  - Typing indicator (3 dot animation)
  - File attachment preview (image/PDF inline)
  - Auto-scroll to bottom
  - Mobile responsive (375px+)
- `app/js/chat-ui.js` — Chat DOM management
  - `addMessage(role, content, files)` 
  - `showTyping()` / `hideTyping()`
  - `addSuggestionChips(chips)`
  - `scrollToBottom()`
  - `getInputValue()` / `clearInput()`
  - Event: Enter to send, Shift+Enter newline
- `app/css/chat.css` — Chat-specific styles
- **Mock mode:** Şimdilik `chat-ui.js` içinde hardcoded cevaplar:
  - "proposal" → örnek proposal metni
  - "invoice" → "Invoice #42 created for $500"
  - "rate" → "Based on your profile, $45/hr is competitive"
  - Default → "I can help with proposals, invoices, emails, rates, and job analysis!"
- Suggestion chips: ["Write a proposal", "Create invoice", "Analyze a job", "Draft an email", "Calculate my rate"]

**ACP talimatı:** "Frontend only. Güzel chat UI. Mock responses. Mevcut styles.css'i import et ama chat.css'i ayrı yaz."
**Commit:** `feat(T02): chat UI shell with mock responses`

---

### [T03] Proposal Writer Engine
**Scope:** Job description → kişiselleştirilmiş proposal üreten JS modülü
**Files:**
- `app/js/proposal-engine.js`
  - `window.CortexProposalEngine.generate(jobDesc, profile, options)` 
  - Input: job description text, user profile (from bridge), options {tone, length, focusAreas}
  - Output: `{ proposals: [{title, body, highlights, estimatedBudget}], metadata }`
  - 3 variant üretir (professional, friendly, technical)
  - Profile'dan skills/experience çeker, job'a match eder
  - Keyword extraction: job desc'den key requirements çıkarır
  - Template system: opening hook → relevant experience → approach → timeline → CTA
  - Tone presets: professional, friendly, bold, technical
  - Length presets: short (150 words), standard (250), detailed (400)
- `app/js/proposal-templates-data.js`
  - 10 kategori × 3 tone = 30 template skeleton
  - Kategori: web-dev, mobile, design, writing, marketing, data, devops, consulting, video, admin
  - Her template'te `{placeholders}` var

**ACP talimatı:** "Pure JS module. Export on window.CortexProposalEngine. Hiç DOM manipulation yok — sadece data in → data out. Profile bridge varsa kullan (window.CortexFreelancer.getProfile)."
**Commit:** `feat(T03): proposal writer engine (3 variants, 10 categories)`

---

### [T04] Email Writer Engine
**Scope:** Durum + context → profesyonel email draft'ları üreten JS modülü
**Files:**
- `app/js/email-engine.js`
  - `window.CortexEmailEngine.generate(type, context, profile)`
  - Types: follow-up, payment-reminder, scope-change, introduction, thank-you, deadline-extension, price-negotiation, project-complete, dispute-resolution, testimonial-request
  - Context: `{clientName, projectName, amount, daysSinceLastContact, customNotes}`
  - Output: `{subject, body, tone, tips[]}`
  - Profile'dan isim + skills çeker
  - Her type için 2 variant: formal + friendly
- `app/js/email-templates-data.js`
  - 10 type × 2 tone = 20 template
  - `{placeholders}` ile

**ACP talimatı:** "Pure JS module. Export on window.CortexEmailEngine. Data in → data out. Hiç DOM yok."
**Commit:** `feat(T04): email writer engine (10 types, 2 tones)`

---

### [T05] Job Analyzer Engine
**Scope:** Job post text → analiz + red flags + tavsiyeler
**Files:**
- `app/js/job-analysis-engine.js`
  - `window.CortexJobAnalyzer.analyze(jobText, profile)`
  - Output:
    ```
    {
      title, budget, type (fixed/hourly), clientInfo,
      matchScore (0-100 vs profile skills),
      matchedSkills[], missingSkills[],
      redFlags: [{flag, severity, explanation}],
      greenFlags: [{flag, explanation}],
      budgetAnalysis: {isBelow/above market, fairRate},
      recommendations: [{action, reason}],
      proposalTips: string[],
      shouldApply: boolean,
      confidence: number
    }
    ```
  - Red flags: vague scope, unrealistic timeline, no budget, excessive revisions, "test project" pattern, too many skills required
  - Green flags: verified payment, high client spend, clear milestones, reasonable timeline
  - Budget comparison: job budget vs user's rate × estimated hours
  - Skill match: job requirements vs profile skills (fuzzy match)

**ACP talimatı:** "Pure JS module. Export on window.CortexJobAnalyzer. Data in → data out."
**Commit:** `feat(T05): job analyzer engine (match score, red flags, recommendations)`

---

## WAVE 2 — Backend + adaptörler (3 paralel ACP, Wave 1 bitince)

### [T06] /api/chat Endpoint + Protocol
**Scope:** Vercel serverless function — chat mesajlarını alıp işleyen API
**Files:**
- `api/chat.js` — Ana endpoint
  - POST `{ message, sessionId, userId (optional) }`
  - Response `{ reply, files: [], suggestions: [], sessionId }`
  - Session yönetimi: sessionId yoksa yeni oluştur (UUID)
  - **Şimdilik lokal processing** (Phase 2'de OpenClaw'a bridge):
    - Intent detection: message'dan intent çıkar (proposal/email/invoice/rate/job/general)
    - Intent'e göre ilgili engine'i çağır
    - Context: önceki mesajları sessionStorage'da tut (max 10)
  - Error handling: graceful fallback mesajları
- `api/chat-intents.js` — Intent classifier
  - Keyword + pattern matching ile intent detection
  - Intents: proposal, email, invoice, rate, job-analysis, general-question, greeting
  - Confidence score: en yüksek intent seçilir
  - Multi-turn: "yes" / "that one" / "make it shorter" → önceki context'e bağla
- `api/chat-session.js` — Session state (in-memory/KV)
  - Store: last 10 messages, current intent, pending data
  - Vercel KV yoksa: encode in response + client stores (stateless fallback)

**ACP talimatı:** "Vercel serverless. ES module syntax. Import engine'ler client-side kalacak — API sadece intent detect + template response üretir. Engine'ler client'ta çalışacak, API lightweight coordinator."
**Commit:** `feat(T06): /api/chat endpoint + intent classifier + session management`

---

### [T07] Chat ↔ Profile Bridge Integration
**Scope:** Chat UI'ın profile-bridge'den veri alması + kişisel cevaplar
**Files:**
- `app/js/chat-context.js`
  - `window.CortexChatContext.build()` → tüm context'i toplar:
    - Profile: name, skills, rate, country, experience (from CortexFreelancer.getProfile)
    - Goals: income target, tax country, work type (from CortexFreelancer.getGoals)
    - Recent activity: son kullanılan tools, son proposal, son invoice
  - `enrichResponse(response, context)` → AI cevabını kişiselleştirir
    - "Based on your React/Node.js expertise..."
    - "$45/hr rate'inize göre..."
  - Profile yoksa → chat'te ilk mesajda CTA göster: "Profilini yükle → daha iyi cevaplar"

**ACP talimatı:** "Pure JS. Profile bridge'e bağımlı (window.CortexFreelancer). DOM manipülasyonu minimal — sadece CTA inject."
**Commit:** `feat(T07): chat context builder + profile-aware responses`

---

### [T08] Invoice + Rate Tools Chat Adapter
**Scope:** Mevcut invoice-generator ve rate-calculator tool'larını chat'ten çağırılabilir yap
**Files:**
- `app/js/chat-tool-adapters.js`
  - `window.CortexChatAdapters.invoice(params)` → mevcut invoice generator'ı çağırır, HTML/PDF döner
  - `window.CortexChatAdapters.rate(params)` → mevcut rate calculator'ı çağırır, sonuç döner
  - `window.CortexChatAdapters.fee(params)` → mevcut fee calculator
  - Her adapter: chat mesajından parametreleri parse eder
    - "Invoice $500 to John for website design" → {client: "John", amount: 500, description: "website design"}
    - "What should I charge for React in Turkey?" → {skill: "web-development", country: "TR"}
  - Output format: chat-friendly text + optional file attachment

**ACP talimatı:** "Mevcut tool'ları okuyup adapter yaz. Yeni tool yaratma — mevcut olanları bridge'le."
**Commit:** `feat(T08): chat adapters for invoice, rate, fee tools`

---

## WAVE 3 — Bağlantı katmanı (3 paralel ACP, Wave 2 bitince)

### [T09] OpenClaw Webhook/Bridge Receiver
**Scope:** OpenClaw'un dışarıdan mesaj alıp isolated session'da işlemesi
**Files:**
- `scripts/openclaw-chat-bridge.js` — OpenClaw tarafında çalışacak script
  - HTTP endpoint (Express veya basit http server) dinler
  - Gelen mesajı `sessions_spawn` ile izole session'a yönlendirir
  - Session bitmesini bekler, response'u callback URL'e POST eder
  - Agent: `cortex-freelancer` (T01'de oluşturulan)
  - Timeout: 30 saniye
  - Error handling: timeout → "Biraz uzun sürdü, tekrar dene"
- `scripts/openclaw-chat-bridge-config.json` — Config
  - port, allowedOrigins, maxConcurrent, timeout
  - agent mapping: which agent handles chat
- **NOT:** Bu Phase 1'de OPTIONAL. İlk MVP'de engine'ler client-side çalışabilir.
  Ama bridge hazır olsun ki Phase 2'de Gamma/Sheets gibi tool'lar için gerekecek.

**ACP talimatı:** "Node.js script. OpenClaw sessions_spawn kullanmaz (bunu sonra bağlarız) — şimdilik mock response döner. Ama yapı hazır olsun."
**Commit:** `feat(T09): OpenClaw chat bridge receiver (mock mode)`

---

### [T10] Chat Tool Dispatcher (Frontend)
**Scope:** Chat UI'da kullanıcı mesajı → doğru engine'e yönlendirme + response rendering
**Files:**
- `app/js/chat-dispatcher.js`
  - `window.CortexChatDispatcher.handle(message, context)`
  - Flow:
    1. Intent detect (keyword matching, T06'dan client-side port)
    2. Context build (T07)
    3. Engine çağır:
       - proposal → CortexProposalEngine.generate()
       - email → CortexEmailEngine.generate()
       - job → CortexJobAnalyzer.analyze()
       - invoice → CortexChatAdapters.invoice()
       - rate → CortexChatAdapters.rate()
       - general → hardcoded helpful responses + suggestions
    4. Response format: text + optional files + suggestion chips
  - Multi-turn support:
    - "Make it shorter" → re-run last engine with modified params
    - "Send the second one" → select variant
    - "Change tone to friendly" → re-run with tone param
  - Fallback: "I can help with proposals, invoices, emails, job analysis, and rate calculations. What do you need?"

**ACP talimatı:** "Bağlayıcı modül. T03/T04/T05/T07/T08'i import eder (window globals). Chat-ui.js'e message gönderir."
**Commit:** `feat(T10): chat tool dispatcher + multi-turn support`

---

### [T11] Rate Limiting + Session Management (Frontend)
**Scope:** Free/Pro limitleri + localStorage session tracking
**Files:**
- `app/js/chat-limiter.js`
  - `window.CortexChatLimiter.canSend()` → true/false
  - `window.CortexChatLimiter.recordMessage()`
  - `window.CortexChatLimiter.getRemaining()` → {messages: 7, resets: "2h 15m"}
  - Limits: Free=10 msg/gün, Pro=unlimited
  - Reset: midnight UTC
  - Storage: localStorage `cortex_chat_usage_{date}`
  - UI: remaining count badge in chat header
  - Limit reached: show upgrade CTA in chat
- `app/js/chat-session-store.js`
  - localStorage'da chat history tut (per sessionId)
  - Max 50 messages per session, max 5 sessions
  - `getHistory(sessionId)`, `addMessage(sessionId, msg)`, `listSessions()`
  - Session picker UI: son sohbetlere geri dön

**ACP talimatı:** "Pure JS. localStorage based. Pro detection via existing CortexPro.isPro()."
**Commit:** `feat(T11): chat rate limiter + session persistence`

---

## WAVE 4 — Entegrasyon (sıralı, Wave 3 bitince)

### [T12] Wire Everything + E2E Flow Test
**Scope:** Tüm modülleri birbirine bağla, chat.html'i tam çalışır hale getir
**Files to modify:**
- `app/chat.html` — Script tag'leri ekle (tüm chat-*.js + engine'ler)
- `app/js/chat-ui.js` — Mock mode kaldır, dispatcher'a bağla
- `app/index.html` — Chat butonunu/linkini güncelle
- `app/js/chat-bootstrap.js` (yeni) — App init:
  1. Profile yükle (bridge)
  2. Context build
  3. Session restore veya yeni session
  4. Dispatcher init
  5. Limiter init
  6. Welcome message: "Merhaba {name}! Ben Cortex. Proposals, invoices, emails — ne lazımsa yardımcı olurum."
  - Profile yoksa: "Merhaba! Daha iyi yardım için Upwork profilini yükle → [link]"

**ACP talimatı:** "Integration task. Tüm app/js/chat-*.js ve engine dosyalarını oku. chat.html'e script tag'leri ekle. Mock'ları gerçek dispatcher'a değiştir. Bootstrap sequence yaz. E2E: mesaj yaz → cevap al akışı çalışmalı."
**Commit:** `feat(T12): wire chat system end-to-end`

---

### [T13] Deploy + Polish
**Scope:** Vercel deploy, son rötuşlar
**Tasks:**
- `vercel --prod` deploy
- Browser test: chat açılıyor mu, mesaj gönderiliyor mu, 5 komut çalışıyor mu
- Console error temizliği
- Mobile responsive check
- Loading states (typing indicator gerçekten çalışıyor mu)
- Welcome flow: ilk açılışta onboarding → chat
- Link'leri güncelle: landing page "Chat with Cortex" → /app/chat.html

**Bu task ACP değil, ben (Lucas) yapacağım.**

---

## Execution Plan

| Wave | Tasks | Paralel ACP | Tahmini Süre | Prerequisite |
|------|-------|-------------|-------------|-------------|
| 1 | T01, T02, T03, T04, T05 | 5 | ~20 dk | — |
| 2 | T06, T07, T08 | 3 | ~15 dk | Wave 1 |
| 3 | T09, T10, T11 | 3 | ~15 dk | Wave 2 |
| 4 | T12, T13 | 1 (sequential) | ~15 dk | Wave 3 |

**Toplam: ~65 dk (4 wave × ~15-20 dk)**
**Max parallelism: 5 ACP**

---

## Task Format (ACP'ye verilecek)

Her task şu formatta ACP'ye gönderilir:
```
Workdir: /Users/.../projects/cortex-freelancer/
Files to create: [list]
Files to read first: [list]  
Dependencies (window globals): [list]
Export namespace: window.CortexXxx
Commit message: "feat(Txx): description"
```

---

## Status Tracking

| Task | Status | Commit |
|------|--------|--------|
| T01 | PENDING | |
| T02 | PENDING | |
| T03 | PENDING | |
| T04 | PENDING | |
| T05 | PENDING | |
| T06 | PENDING | |
| T07 | PENDING | |
| T08 | PENDING | |
| T09 | PENDING | |
| T10 | PENDING | |
| T11 | PENDING | |
| T12 | PENDING | |
| T13 | PENDING | |
