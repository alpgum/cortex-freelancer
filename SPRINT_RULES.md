# Sprint Rules (kalıcı)

## Auto-refill kuralı
- TASK_QUEUE_300.md'de [200] task'a ulaşıldığında (200/300 done):
  - MASTER_ROADMAP.md + APP_SHELL_SPEC.md + Alp'in feedback'lerinden yeni 100 task üret
  - TASK_QUEUE_400.md olarak yaz (aynı format: ### [301]-[400])
  - Dispatcher'ı 300 bitince otomatik 400'e bağla
  - Kesintisiz çalışma — Alp'e sormadan devam

## Dispatcher parametreleri
- total_slots: 5
- auto_slots: 4
- reserved: 1 (Alp ad-hoc)
- check_interval: 2dk
- queue_file: TASK_QUEUE_300.md → TASK_QUEUE_400.md → ...
