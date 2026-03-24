# Cortex Freelancer — Embedded OpenClaw v2 (Orta Yol)
> Hedef: Güzel Chat UI + Gerçek AI (OpenClaw sessions_spawn) + ~2-3 gün
> Created: 2026-03-24

---

## Hedef Scope
- ✅ Chat UI güzel, mobil uyumlu, dark theme
- ✅ Arkada GERÇEK AI: /api/chat → OpenClaw sessions_spawn → Opus/Sonnet cevap
- ✅ Profile-aware: "React dev'sin, $45/hr, Turkey'desin" biliyor
- ✅ 5 ana komut: proposal, email, job analysis, rate advice, genel sohbet
- ✅ Session memory (aynı sohbette context hatırlar)
- ✅ Free/Pro rate limit
- ❌ Gamma/Sheets (Phase 2)
- ❌ Multi-user queue (Phase 2)
- ❌ Proactive agent (Phase 3)

---

## Wave 1 — Bağımsız (5 paralel ACP)

### [T01] Agent Identity + Skills
**Files:**
- `agents/cortex-freelancer/SOUL.md`
- `agents/cortex-freelancer/AGENTS.md`
- `agents/cortex-freelancer/TOOLS.md`
- `agents/cortex-freelancer/workspace/` (boş dizin, .gitkeep)

**SOUL.md içeriği (önemli — AI'ın karakteri):**
```
Sen Cortex, freelancer'ların AI iş yöneticisisin.

Görevin: Freelancer'lara proposals, emails, job analysis, rate advice ve genel
kariyer rehberliği konusunda yardım etmek.

Kurallar:
- Kısa, aksiyon odaklı cevaplar (max 3 paragraf, gerekmedikçe daha az)
- Kullanıcının diline uyar (Türkçe sorulursa Türkçe, İngilizce sorulursa İngilizce)
- Her zaman somut çıktı ver (proposal metni, email draft'ı, puan/analiz)
- Kullanıcı profili context'te verilmişse kullan ("React deneyiminize dayanarak...")
- Freelancing dışı konularda: "Ben freelance konularında uzmanım, bununla yardımcı olamam ama [freelance konusu] ile ilgili bir şey sorabilirsin!"
- Spam/abuse: nazikçe reddet

Tonun: Profesyonel ama samimi. Bir kıdemli freelancer arkadaş gibi.
```

**Commit:** `feat(T01): cortex-freelancer agent identity`

---

### [T02] Chat UI (Güzel, Production-Ready)
**Files:**
- `app/chat.html` — full rewrite
- `app/css/chat.css`
- `app/js/chat-ui.js`

**Detay:**
- Dark theme, mevcut design system (--bg, --orange, --green vs.)
- Header: "⚡ Cortex AI" + remaining messages badge + back to dashboard link
- Messages: user (sağ, gradient border) / AI (sol, subtle bg)
- Markdown render: **bold**, `code`, bullet lists (basit regex, lib yok)
- File/link cards: eğer AI cevabında URL varsa card olarak göster
- Input: textarea (auto-resize) + send button (orange gradient)
- Shift+Enter = newline, Enter = send
- Typing indicator: 3 bouncing dots
- Welcome message: profile varsa "Merhaba {name}!" yoksa "Merhaba! Profilini yüklersen daha iyi yardımcı olurum"
- Suggestion chips (ilk açılışta): "✍️ Write a proposal", "📧 Draft an email", "🔍 Analyze a job post", "💰 Rate advice"
- Chip tıklanınca → chat input'a yazılır + otomatik gönderilir
- Mobile: full-screen, safe-area padding, keyboard-aware scroll
- **MOCK MODE:** İlk aşamada fetch yerine setTimeout + hardcoded cevap (T06 gelince gerçeğe geçer)
- `window.CortexChat` namespace: `init()`, `sendMessage(text)`, `addMessage(role, content)`, `setLoading(bool)`

**Commit:** `feat(T02): production-ready chat UI`

---

### [T03] Freelancer System Prompt Builder
**Files:**
- `app/js/chat-system-prompt.js`

**Detay:**
- `window.CortexSystemPrompt.build(profile, goals, chatHistory)` → string
- Profil varsa enjekte:
```
User profile:
- Name: Emre Yilmaz
- Title: Full-Stack Web Developer
- Rate: $45/hr
- Skills: JavaScript, React, Node.js, PostgreSQL
- JSS: 97%
- Total earned: $78,000
- Country: Turkey
- Income goal: $10K/mo
- Work preference: Long-term contracts
```
- Yoksa: "User hasn't shared their profile yet."
- Son 5 chat mesajı context olarak
- Scope reminder: "You are Cortex, a freelancer AI assistant. Only help with freelancing topics."

**Commit:** `feat(T03): system prompt builder with profile injection`

---

### [T04] /api/chat — OpenClaw Bridge (Gerçek AI)
**Files:**
- `api/chat.js`

**Detay:**
- POST `{ message, sessionId, profile, goals }`
- Eğer OPENCLAW_BRIDGE_URL env var varsa:
  - POST to OpenClaw bridge → gerçek AI cevap
- Eğer yoksa (fallback):
  - Doğrudan Anthropic API call (ANTHROPIC_API_KEY env var)
  - System prompt: T03'ün build ettiği prompt
  - Model: claude-sonnet-4-20250514 (ucuz + hızlı)
  - Max tokens: 1000
  - Temperature: 0.7
- Response: `{ reply, sessionId }`
- Rate limit check: X-Forwarded-For + sessionId bazlı
- Error: `{ error: "message", retryAfter: seconds }`

**ÖNEMLİ:** Bu endpoint 2 modda çalışır:
1. **Direct mode** (başlangıç): Anthropic API direkt çağır — en basit, hemen çalışır
2. **Bridge mode** (sonra): OpenClaw sessions_spawn üzerinden — tool kullanabilir

Başlangıçta Direct mode ile shiplayacağız. Bridge mode'u T09'da ekleyeceğiz.

**Commit:** `feat(T04): /api/chat with Anthropic direct + OpenClaw bridge modes`

---

### [T05] Chat Dispatcher + Session Store (Frontend)
**Files:**
- `app/js/chat-dispatcher.js`
- `app/js/chat-session-store.js`
- `app/js/chat-limiter.js`

**Detay — dispatcher:**
- `window.CortexChatDispatcher.send(message)` — ana flow:
  1. Limiter check → limit aşıldıysa upgrade CTA göster
  2. System prompt build (T03)
  3. Chat history'den son 10 mesajı al
  4. POST /api/chat { message, sessionId, profile, goals, history }
  5. Response'u chat UI'a ekle
  6. Session store'a kaydet
  7. Suggestion chips güncelle (context'e göre)

**Detay — session store:**
- localStorage `cortex_chat_sessions`
- `addMessage(sessionId, {role, content, timestamp})`
- `getHistory(sessionId, limit)` 
- `listSessions()` → [{id, title (first user message), lastMessage, timestamp}]
- Max 50 msg/session, max 10 sessions, FIFO

**Detay — limiter:**
- localStorage `cortex_chat_usage_{YYYY-MM-DD}`
- Free: 10 msg/gün, Pro: 200 msg/gün
- `canSend()`, `recordUsage()`, `getRemaining()`
- Reset: midnight UTC

**Commit:** `feat(T05): chat dispatcher + session store + rate limiter`

---

## Wave 2 — Bağlantı (2 paralel ACP, Wave 1 bitince)

### [T06] Wire Chat UI → Dispatcher → API
**Files to modify:**
- `app/chat.html` — script tag'leri ekle, mock mode kaldır
- `app/js/chat-ui.js` — mock yerine dispatcher.send() çağır
- `app/js/chat-bootstrap.js` (yeni) — init sequence:
  1. Profile bridge yükle
  2. Session store'dan son session'ı restore et
  3. Limiter init
  4. Dispatcher init
  5. Welcome message
  6. Suggestion chips

**Ayrıca:**
- chat.html'e tüm bağımlılıkları ekle (profile-bridge, system-prompt, dispatcher, limiter, session-store)
- app/index.html dashboard'dan "💬 Chat with Cortex" linki ekle
- Landing page'den "Chat" linki → /app/chat.html

**Commit:** `feat(T06): wire chat end-to-end`

---

### [T07] OpenClaw Sessions Bridge (Gerçek Tool Erişimi)
**Files:**
- `scripts/cortex-chat-bridge/server.js` — Express server
- `scripts/cortex-chat-bridge/package.json`
- `scripts/cortex-chat-bridge/README.md`
- `api/chat.js` güncelle — bridge mode ekle

**Detay:**
- Express server port 3849'da dinler
- POST /chat → OpenClaw sessions_spawn (cortex-freelancer agent, isolated)
- Task: system prompt + user message
- Timeout: 45 saniye
- Response: AI cevabı
- Cloudflare Tunnel veya Tailscale ile expose (README'de açıkla)
- api/chat.js: OPENCLAW_BRIDGE_URL varsa bu server'a POST at

**Commit:** `feat(T07): OpenClaw sessions bridge for real tool access`

---

## Wave 3 — Polish + Deploy (sıralı)

### [T08] E2E Test + Deploy
**Ben (Lucas) yapacağım, ACP değil:**
- Browser test: chat aç → mesaj yaz → gerçek AI cevap geldi mi
- 5 komut test: proposal, email, job analysis, rate, genel
- Profile-aware test: profil yükle → chat'te isim/skill referansı var mı
- Rate limiter test: 11. mesajda uyarı çıkıyor mu
- Mobile test
- Console error temizliği
- `vercel --prod` deploy
- README güncelle

---

## Execution Plan

| Wave | Tasks | Paralel | Süre | Blocker |
|------|-------|---------|------|---------|
| 1 | T01-T05 | 5 ACP | ~25 dk | — |
| 2 | T06-T07 | 2 ACP | ~20 dk | Wave 1 |
| 3 | T08 | Manuel | ~15 dk | Wave 2 |

**Toplam: ~60 dk coding + ~15 dk test/deploy = ~75 dk**

Ama gerçekçi (ACP retry, git conflict, debug): **~3-4 saat**

---

## Env Vars (Vercel'e eklenecek)

```
ANTHROPIC_API_KEY=sk-ant-...        # Direct mode (başlangıç)
OPENCLAW_BRIDGE_URL=https://...     # Bridge mode (sonra)
```

---

## Status

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
