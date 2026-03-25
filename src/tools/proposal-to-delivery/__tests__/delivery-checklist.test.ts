import { DeliveryChecklistService } from '../src/delivery-checklist';

describe('DeliveryChecklistService', () => {
  test('creates default checklist', () => {
    const svc = new DeliveryChecklistService();
    const list = svc.createDefaultChecklist();
    expect(list.length).toBeGreaterThan(5);
    expect(list.some(i => i.required)).toBe(true);
  });

  test('readiness fails when required items pending', () => {
    const svc = new DeliveryChecklistService();
    const list = svc.createDefaultChecklist({ includeSecurity: false });
    const ready = svc.isReady(list);
    expect(ready.ready).toBe(false);
    expect(ready.missing.length).toBeGreaterThan(0);
  });
});
