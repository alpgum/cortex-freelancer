# Cortex Freelancer — App Shell Redesign Spec

> v1.0 | 2026-03-21 00:36 | Alp feedback'i ile

## Ana Fikir
Chat-first layout. OpenClaw tarzı sol sidebar + sağda büyük chat alanı.
**Chat = ana ekran.** Tool'lar sidebar'dan erişilen yan özellikler.

## Layout

```
┌──────────────────────────────────────────────────────┐
│ ⚡ Cortex Freelancer              [🔔] [Avatar] Pro  │
├─────────┬────────────────────────────────────────────┤
│         │                                            │
│ 💬 Chat │   ┌────────────────────────────────┐       │
│ (active)│   │  Cortex AI                     │       │
│         │   │  ─────────────────────────     │       │
│ ─────── │   │  AI: Merhaba! Ben senin AI     │       │
│         │   │  iş danışmanınım. Nasıl        │       │
│ DEPT:   │   │  yardımcı olabilirim?          │       │
│         │   │                                │       │
│ 🔍 İş   │   │  User: Upwork'te UX design    │       │
│   Bulma │   │  fiyatımı belirleyemiyorum     │       │
│         │   │                                │       │
│ 📝 Teklif│   │  AI: Seni anlıyorum. Hemen    │       │
│ & Söz.  │   │  Rate Calculator'a bakalım... │       │
│         │   │  [Rate Calculator açıldı →]    │       │
│ 💰 Finans│   │                                │       │
│         │   │                                │       │
│ 📈 Büyüme│   │                                │       │
│         │   │                                │       │
│ ─────── │   │                                │       │
│ ⚙️ Ayar │   ├────────────────────────────────┤       │
│ 👑 Pro  │   │ [💬 Mesajınızı yazın...] [Gönder]│       │
│         │   └────────────────────────────────┘       │
└─────────┴────────────────────────────────────────────┘
```

## Chat Panel (Ana Ekran — %70 alan)
- OpenClaw webchat benzeri: mesaj balonları, markdown, typing indicator
- AI tool önerebildiğinde inline kart gösterir ("Rate Calculator açmak ister misin?")
- Freelancer'ın asıl zaman geçirdiği yer burası
- Opus 4.6 via Anthropic API (api/chat.js → proxy)

## Sidebar (Sol — %30 veya 250px fixed)
- Collapsible (mobile'da hamburger)
- Departmanlar = tool grupları

### Departmanlar

**🔍 İş Bulma**
- Upwork profil analizi (viral app)
- Job scanner (Pro)
- Profil score card

**📝 Teklif & Sözleşme**
- Proposal writer
- Contract review
- Scope analyzer
- Template browser

**💰 Finans**
- Invoice generator
- Fee calculator
- Rate calculator
- Payment checker
- Tax estimator (gelecek)

**📈 Büyüme**
- Bio generator (gelecek)
- Portfolio review (gelecek)
- Email writer
- Ad generator (gelecek)

## Persona-based Customization

### Onboarding Survey (3 adım)
1. "Ne yapıyorsun?" → Web Dev / Design / Writing / Marketing / Video / Translation
2. "Deneyim?" → Junior / Mid / Senior / Expert  
3. "En büyük zorluk?" → İş bulma / Fiyatlama / Faturalama / Zaman yönetimi

### Sonuç → Kişiselleştirilmiş sidebar sıralaması
- **Yazılımcı**: İş Bulma > Teklif > Finans > Büyüme
- **Tasarımcı**: Büyüme (portfolio) > Teklif > İş Bulma > Finans
- **Marketing**: Büyüme > İş Bulma > Finans > Teklif

### Gelecek: Behavior-based adaptation
- Kullanıcı en çok hangi tool'u kullanıyorsa → sidebar'da üstte
- Chat'te en çok ne soruyorsa → ilgili departmanı highlight
- "Son kullanılanlar" bölümü

## Teknik
- Tek SPA (app/index.html) — sidebar navigation, content area dynamically loads tool HTML via iframe veya fetch+innerHTML
- Chat always visible (split pane) veya chat = default view, tool = overlay/panel
- localStorage: persona, recent tools, chat history
- Mobile: bottom tab bar (Chat | Tools | Profile) — sidebar gizli

## Öncelik
Bu redesign TASK_QUEUE_300'deki [101-150] frontend task'larının yerine geçer.
Chat ACP bitince bu spec ile "app shell redesign" ACP başlatılacak.
