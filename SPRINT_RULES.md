# Sprint Rules (kalıcı)

## Auto-refill kuralı
- Her 100 task'lık batch'in [X00]'üne ulaşınca (ör: 200/300 done):
  - MASTER_ROADMAP.md + APP_SHELL_SPEC.md + Alp'in feedback'lerinden yeni 100 task üret
  - Sıradaki batch dosyası olarak yaz (TASK_QUEUE_400.md, 500.md, ...)
  - Dispatcher bitince otomatik geçiş
  - Kesintisiz çalışma — Alp'e sormadan devam
- **HARD CAP: 800 task** — [800]'e ulaşınca dur, yeni batch üretme. Alp'e "800'e ulaştık, devam mı?" sor.

## Dispatcher parametreleri
- total_slots: 5
- auto_slots: 4
- reserved: 1 (Alp ad-hoc)
- check_interval: 2dk
- queue_file: TASK_QUEUE_300.md → 400 → 500 → ... → 800 (max)
