import { ChaseEngine, ChaseEngineConfig } from './chase-engine';
import { StorageAdapter, Invoice } from '../types';
import { InvoiceProvider } from '../integrations/invoice-provider';
import { CRMProvider } from '../integrations/crm-provider';
import { NotificationSender } from '../integrations/notification-sender';
import { ClientIntelligence } from '../intelligence/client-intelligence';

/**
 * PaymentChaseOrchestrator
 *
 * - Detects outstanding invoices via InvoiceProvider (CFX-056)
 * - Fetches client context via CRMProvider (CFX-058)
 * - Starts chases for new overdue invoices
 * - Processes existing chases on each tick
 */
export class PaymentChaseOrchestrator {
  private engine: ChaseEngine;
  private intelligence: ClientIntelligence;

  constructor(
    private storage: StorageAdapter,
    private invoices: InvoiceProvider,
    private crm: CRMProvider,
    private sender: NotificationSender,
    config: ChaseEngineConfig
  ) {
    this.engine = new ChaseEngine(storage, config);
    this.intelligence = new ClientIntelligence(storage);
  }

  getChaseEngine(): ChaseEngine {
    return this.engine;
  }

  /**
   * Tick: detect overdue invoices, start chases, then process all chases.
   */
  async tick(now: Date = new Date()): Promise<{
    started: number;
    processed: number;
    sent: number;
    results: any[];
  }> {
    const outstanding = await this.invoices.listOutstandingInvoices();

    // Build/update client profiles from invoice history
    const clientIds = Array.from(new Set(outstanding.map(i => i.clientId)));
    for (const clientId of clientIds) {
      const invoicesByClient = await this.invoices.listInvoicesByClient(clientId);
      await this.intelligence.buildProfile(clientId, invoicesByClient);
    }

    // Start chases for overdue invoices that have no active chase
    let started = 0;
    const results: any[] = [];
    for (const inv of outstanding) {
      if (inv.status !== 'overdue') continue;
      const client = await this.crm.getClient(inv.clientId);
      if (!client) continue;
      const res = await this.engine.startChase(inv, client);
      if (res.action === 'created') started++;
      results.push(res);
    }

    // Process all active chases
    const tickResults = await this.engine.processAllChases(
      (id: string) => this.invoices.getInvoice(id),
      (id: string) => this.crm.getClient(id),
      now
    );

    // Dispatch notifications for chase messages
    let sent = 0;
    for (const r of tickResults) {
      if (r.message) {
        // Need invoice+client to determine channel, but engine stored channel in action.
        // For now, send via email by default.
        const chase = await this.storage.getChaseRecord(r.chaseId);
        if (!chase) continue;
        const lastAction = chase.actions[chase.actions.length - 1];
        const client = await this.crm.getClient(chase.clientId);
        if (!client) continue;
        const resp = await this.sender.send(lastAction.channel, client, r.message);
        lastAction.delivered = resp.delivered;
        await this.storage.saveChaseRecord({ ...chase });
        sent++;
      }
    }

    return {
      started,
      processed: tickResults.length,
      sent,
      results: [...results, ...tickResults],
    };
  }
}
