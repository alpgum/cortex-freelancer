import { Invoice } from '../types';

/**
 * Integration: Invoice System (CFX-056)
 *
 * This tool defines a provider interface so it can plug into the future
 * invoice system implementation.
 */
export interface InvoiceProvider {
  getInvoice(id: string): Promise<Invoice | null>;
  listOutstandingInvoices(): Promise<Invoice[]>;
  listInvoicesByClient(clientId: string): Promise<Invoice[]>;
  markInvoicePaid?(id: string, paidAt: Date): Promise<void>;
}

/**
 * Simple in-memory invoice provider for tests/demo.
 */
export class InMemoryInvoiceProvider implements InvoiceProvider {
  private invoices: Map<string, Invoice> = new Map();

  constructor(invoices: Invoice[] = []) {
    for (const inv of invoices) this.invoices.set(inv.id, inv);
  }

  seed(invoices: Invoice[]): void {
    for (const inv of invoices) this.invoices.set(inv.id, inv);
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) ?? null;
  }

  async listOutstandingInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i =>
      (i.status === 'sent' || i.status === 'overdue' || i.status === 'partial') && !i.paidAt
    );
  }

  async listInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.clientId === clientId);
  }

  async markInvoicePaid(id: string, paidAt: Date): Promise<void> {
    const inv = this.invoices.get(id);
    if (!inv) return;
    this.invoices.set(id, { ...inv, paidAt, status: 'paid' });
  }
}
