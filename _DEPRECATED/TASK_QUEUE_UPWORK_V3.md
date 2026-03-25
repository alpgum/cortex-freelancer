# Cortex Freelancer — Upwork Advanced Features Sprint V3
# Goal: Freelancer'ın Upwork'te kazanmasını sağlayan ileri seviye özellikler
# Generated: 2026-03-24 00:46

## PENDING

### [UX-001] Client research tool — investigate before applying
Bir işe başvurmadan önce client'ı araştır. Proxy ile client profil sayfasını aç, çek: toplam harcama, kaç freelancer çalıştırmış, avg rating vermiş, payment method verified mi, ülke, member since. Output: "Bu client güvenilir, $50K+ harcamış, 4.8 avg rating vermiş" veya "⚠️ Yeni hesap, 0 harcama, dikkatli ol."
Files: api/upwork-client.js, scripts/upwork-local-proxy.js (/client endpoint), app/js/client-researcher.js

### [UX-002] Connects ROI tracker — spend smarter
Upwork'te her başvuru "connect" harcıyor (paralı). Tracker: connects harcanan, interview alınan, iş kazanılan. ROI hesapla: "Son 30 günde 45 connect harcadın, 3 interview, 1 iş ($2K). Connect başına ROI: $44." Hangi iş tipinde connect harcamak karlı, hangisinde boşa gidiyor.
Files: app/js/connects-tracker.js

### [UX-003] Upwork search ranking simulator
Upwork freelancer'ları nasıl sıralıyor? JSS, response time, earnings, activity. Simulate: "JSS'ni 95'e çıkarırsan sıralamaĖ 15. → 8.'e yükselir." Hangi faktöre odaklanmalı.
Files: app/js/ranking-simulator.js

### [UX-004] Contract negotiation coach
AI ile interaktif negotiation practice. Client "Can you do it for $500?" diyor → AI coach en iyi yanıtı öğretiyor. Milestone yapısı, escrow kullanımı, scope creep'i önleme taktikleri.
Files: api/negotiation-coach.js, app/js/negotiation-coach.js

### [UX-005] Automated case study generator
Work history'den otomatik case study üret: problem → solution → result formatında. Her iş için shareable HTML card. "Bunu portfolyona ekle" butonu. AI ile client feedback + iş detaylarından anlamlı case study çıkar.
Files: api/generate-case-study.js, app/js/case-study-generator.js

### [UX-006] Upwork profile SEO analyzer
Hangi keywords client'lar arıyor? Profil title, description, skills'teki keyword density analizi. "React" 15x aranıyor ama senin profilinde 0 kez geçiyor. Keyword suggestions + placement guide.
Files: app/js/profile-seo.js

### [UX-007] Bid strategy calculator — which jobs to skip
Her iş için "bid or skip" skoru. Faktörler: skill match, budget/rate fit, competition level (kaç proposal var), client quality, time investment vs potential return. "Bu işe connect harcama — 50 proposal var, düşük budget." 
Files: app/js/bid-strategy.js

### [UX-008] Client communication templates
20+ hazır mesaj template: proje başlangıcı, milestone teslimi, scope change request, payment reminder, delay notification, project completion, feedback request, rate increase notice, unavailability notice. Her template AI ile kişiselleştirilebilir.
Files: app/js/communication-templates.js

### [UX-009] Revenue forecasting — next 3 months
Mevcut pipeline (aktif işler) + geçmiş earnings trend + seasonal patterns → 3 aylık gelir tahmini. "Bu hızla gidersen Q2'de $8,400 kazanırsın. Rate'i %20 artırırsan $10,100."
Files: app/js/revenue-forecast.js

### [UX-010] Multi-platform profile analyzer
Sadece Upwork değil — Fiverr + Freelancer.com profillerini de analiz et (parser'lar zaten var). 3 platformu yan yana karşılaştır. "Upwork'te 78 puan ama Fiverr'da 45. Fiverr profilini iyileştir."
Files: app/js/multi-platform-analyzer.js

### [UX-011] Freelancer burnout detector
Çalışma saatleri, proje sayısı, deadline yoğunluğu analizi. "Son 4 haftada haftada 50+ saat çalışıyorsun. Burnout riski yüksek." Öneriler: rate artır (aynı gelir, daha az saat), bazı projeleri reddet, tatil planla.
Files: app/js/burnout-detector.js

### [UX-012] Smart milestone planner
Proje scope'undan otomatik milestone planı üret. Fixed-price proje: "3 milestone öner: %30 upfront, %40 mid, %30 final." Her milestone için deliverable, timeline, payment amount. Escrow koruması tavsiyeleri.
Files: app/js/milestone-planner.js

### [UX-013] Upwork trending skills tracker
Hangi skill'lerin demand'ı yükseliyor, hangisi düşüyor? Haftalık trend. "TypeScript demand'ı son 30 günde %25 arttı. Öğrenmeye başla." Job posting frequency'den trend çıkar.
Files: app/js/trending-skills.js

### [UX-014] Proposal templates library
25+ kategori-spesifik proposal template. Web dev, mobile, design, writing, marketing, data science... Her template: hook, experience proof, approach, timeline, CTA. Kişiselleştirme rehberi.
Files: app/js/proposal-templates.js, data/proposal-templates.json

### [UX-015] Profile A/B test planner
"Title'ını 2 hafta 'React Developer' yap, sonra 2 hafta 'Full Stack Engineer' yap. Hangisi daha fazla davet alıyor?" Test planı oluştur, hatırlatma kur, sonuçları karşılaştır.
Files: app/js/profile-ab-test.js
