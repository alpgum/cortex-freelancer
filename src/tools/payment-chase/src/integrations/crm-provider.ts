import { Client } from '../types';

/**
 * Integration: CRM (CFX-058)
 *
 * Provider interface for client context and contact details.
 */
export interface CRMProvider {
  getClient(id: string): Promise<Client | null>;
  listClients(): Promise<Client[]>;
}

export class InMemoryCRMProvider implements CRMProvider {
  private clients: Map<string, Client> = new Map();

  constructor(clients: Client[] = []) {
    for (const c of clients) this.clients.set(c.id, c);
  }

  seed(clients: Client[]): void {
    for (const c of clients) this.clients.set(c.id, c);
  }

  async getClient(id: string): Promise<Client | null> {
    return this.clients.get(id) ?? null;
  }

  async listClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }
}
