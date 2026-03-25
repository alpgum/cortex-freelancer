#!/usr/bin/env node
import { FileStorage } from './file-storage';
import { initializeDefaults } from './index';
import { InMemoryInvoiceProvider } from './integrations/invoice-provider';
import { InMemoryCRMProvider } from './integrations/crm-provider';
import { NoopNotificationSender } from './integrations/notification-sender';
import { PaymentChaseOrchestrator } from './engine/orchestrator';
import { AnalyticsEngine } from './analytics/analytics-engine';
import { Invoice, Client } from './types';
import { promises as fs } from 'fs';

function argValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  // revive dates for invoices
  const data = JSON.parse(raw);
  return data as T;
}

function reviveInvoices(invoices: any[]): Invoice[] {
  return invoices.map(i => ({
    ...i,
    issuedAt: new Date(i.issuedAt),
    dueDate: new Date(i.dueDate),
    paidAt: i.paidAt ? new Date(i.paidAt) : undefined,
  }));
}

function usage(): string {
  return `Payment Chase CLI

Usage:
  node dist/cli.js <command> [options]

Commands:
  init                       Initialize default templates and sequences
  tick --invoices <file> --clients <file> [--storage <file>]  Run one automation tick
  list-chases [--storage <file>]                               List chase records
  pause <chaseId> --reason <text> [--resumeAt <iso>] [--storage <file>]
  resume <chaseId> [--storage <file>]
  analytics --start <iso> --end <iso> --invoices <file> --clients <file> [--storage <file>]

Options:
  --storage <file>   Path to storage JSON (default: ./.payment-chase/storage.json)
  --invoices <file>  JSON file with invoices
  --clients <file>   JSON file with clients
`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    console.log(usage());
    process.exit(0);
  }

  const storagePath = argValue(args, '--storage') ?? './.payment-chase/storage.json';
  const storage = new FileStorage(storagePath);

  if (command === 'init') {
    await initializeDefaults(storage);
    console.log(`Initialized defaults in ${storagePath}`);
    return;
  }

  if (command === 'list-chases') {
    const chases = await storage.getAllChaseRecords();
    console.log(JSON.stringify(chases, null, 2));
    return;
  }

  if (command === 'pause') {
    const chaseId = args[1];
    const reason = argValue(args, '--reason');
    if (!chaseId || !reason) {
      console.error('pause requires <chaseId> and --reason');
      console.log(usage());
      process.exit(1);
    }
    const resumeAt = argValue(args, '--resumeAt');
    // create orchestrator engine quickly
    const orchestrator = new PaymentChaseOrchestrator(
      storage,
      new InMemoryInvoiceProvider([]),
      new InMemoryCRMProvider([]),
      new NoopNotificationSender(),
      { freelancerName: 'Freelancer' }
    );
    const res = await orchestrator.getChaseEngine().pauseChase(chaseId, reason, resumeAt ? new Date(resumeAt) : undefined);
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (command === 'resume') {
    const chaseId = args[1];
    if (!chaseId) {
      console.error('resume requires <chaseId>');
      process.exit(1);
    }
    const orchestrator = new PaymentChaseOrchestrator(
      storage,
      new InMemoryInvoiceProvider([]),
      new InMemoryCRMProvider([]),
      new NoopNotificationSender(),
      { freelancerName: 'Freelancer' }
    );
    const res = await orchestrator.getChaseEngine().resumeChase(chaseId);
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (command === 'tick') {
    const invoicesFile = argValue(args, '--invoices');
    const clientsFile = argValue(args, '--clients');
    if (!invoicesFile || !clientsFile) {
      console.error('tick requires --invoices and --clients');
      process.exit(1);
    }

    await initializeDefaults(storage);

    const invoicesRaw = await readJsonFile<any[]>(invoicesFile);
    const clients = await readJsonFile<Client[]>(clientsFile);
    const invoices = reviveInvoices(invoicesRaw);

    const invoiceProvider = new InMemoryInvoiceProvider(invoices);
    const crmProvider = new InMemoryCRMProvider(clients);

    const orchestrator = new PaymentChaseOrchestrator(
      storage,
      invoiceProvider,
      crmProvider,
      new NoopNotificationSender(),
      {
        freelancerName: process.env.FREELANCER_NAME ?? 'Freelancer',
        freelancerEmail: process.env.FREELANCER_EMAIL,
        freelancerPhone: process.env.FREELANCER_PHONE,
        defaultPaymentLink: process.env.PAYMENT_LINK,
      }
    );

    const res = await orchestrator.tick(new Date());
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (command === 'analytics') {
    const start = argValue(args, '--start');
    const end = argValue(args, '--end');
    const invoicesFile = argValue(args, '--invoices');
    const clientsFile = argValue(args, '--clients');
    if (!start || !end || !invoicesFile || !clientsFile) {
      console.error('analytics requires --start, --end, --invoices, --clients');
      process.exit(1);
    }

    const invoicesRaw = await readJsonFile<any[]>(invoicesFile);
    const clients = await readJsonFile<Client[]>(clientsFile);
    const invoices = reviveInvoices(invoicesRaw);

    const analytics = new AnalyticsEngine(storage);
    const report = await analytics.generateAnalytics({ start: new Date(start), end: new Date(end) }, invoices, clients);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log(usage());
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
