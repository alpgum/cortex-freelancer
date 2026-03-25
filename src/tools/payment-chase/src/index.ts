import { StorageAdapter } from './types';
import { DEFAULT_TEMPLATES } from './templates/defaults';
import { ALL_DEFAULT_SEQUENCES } from './engine/sequences';

export * from './types';
export * from './storage';
export * from './file-storage';
export * from './engine/chase-engine';
export * from './engine/orchestrator';
export * from './engine/sequences';
export * from './templates/renderer';
export * from './templates/defaults';
export * from './intelligence/client-intelligence';
export * from './intelligence/smart-timing';
export * from './analytics/analytics-engine';
export * from './integrations/invoice-provider';
export * from './integrations/crm-provider';
export * from './integrations/notification-sender';

/**
 * Initialize storage with default chase sequences and templates.
 */
export async function initializeDefaults(storage: StorageAdapter): Promise<void> {
  for (const seq of ALL_DEFAULT_SEQUENCES) {
    await storage.saveSequence(seq);
  }
  for (const tmpl of DEFAULT_TEMPLATES) {
    await storage.saveTemplate(tmpl);
  }
}
