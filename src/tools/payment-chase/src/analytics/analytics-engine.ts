import {
  ChaseAnalytics,
  Client,
  ClientDelinquencyRecord,
  EscalationLevel,
  Invoice,
  StorageAdapter,
  ChaseChannel,
} from '../types';
import { differenceInDays, isWithinInterval } from 'date-fns';

/**
 * Analytics Engine
 * Computes chase effectiveness metrics, average days-to-payment,
 * recovery rates, and client reliability scoring.
 */
export class AnalyticsEngine {
  constructor(private storage: StorageAdapter) {}

  async generateAnalytics(
    period: { start: Date; end: Date },
    invoices: Invoice[],
    clients: Client[]
  ): Promise<ChaseAnalytics> {
    const allChases = await this.storage.getAllChaseRecords();

    const chasesInPeriod = allChases.filter(c =>
      isWithinInterval(c.createdAt, { start: period.start, end: period.end })
    );

    const activeChases = allChases.filter(c => c.status === 'active');
    const resolvedChases = allChases.filter(c => c.status === 'resolved');

    const escalationBreakdown: Record<EscalationLevel, number> = {
      [EscalationLevel.FriendlyReminder]: 0,
      [EscalationLevel.FirmFollowUp]: 0,
      [EscalationLevel.FormalNotice]: 0,
      [EscalationLevel.FinalWarning]: 0,
      [EscalationLevel.CollectionsReferral]: 0,
    };

    const channelStats: Record<ChaseChannel, { sent: number; delivered: number; opened: number; responded: number }> = {
      email: { sent: 0, delivered: 0, opened: 0, responded: 0 },
      sms: { sent: 0, delivered: 0, opened: 0, responded: 0 },
      phone: { sent: 0, delivered: 0, opened: 0, responded: 0 },
      letter: { sent: 0, delivered: 0, opened: 0, responded: 0 },
    };

    // Amount metrics
    let totalAmountChased = 0;
    let totalAmountRecovered = 0;
    let totalDaysToPayment = 0;
    let paidCount = 0;

    for (const chase of chasesInPeriod) {
      escalationBreakdown[chase.escalationLevel]++;

      const invoice = invoices.find(i => i.id === chase.invoiceId);
      if (invoice) {
        totalAmountChased += invoice.amount;
      }

      for (const action of chase.actions) {
        channelStats[action.channel].sent++;
        if (action.delivered) channelStats[action.channel].delivered++;
        if (action.opened) channelStats[action.channel].opened++;
        if (action.responded) channelStats[action.channel].responded++;
      }

      // Payment recovery tracking
      if (invoice && invoice.paidAt) {
        totalAmountRecovered += invoice.amount;
        totalDaysToPayment += differenceInDays(invoice.paidAt, invoice.issuedAt);
        paidCount++;
      }
    }

    // Compute channel effectiveness rates
    const channelEffectiveness: Record<ChaseChannel, {
      sent: number;
      delivered: number;
      opened: number;
      responded: number;
      effectivenessRate: number;
    }> = {
      email: { sent: 0, delivered: 0, opened: 0, responded: 0, effectivenessRate: 0 },
      sms: { sent: 0, delivered: 0, opened: 0, responded: 0, effectivenessRate: 0 },
      phone: { sent: 0, delivered: 0, opened: 0, responded: 0, effectivenessRate: 0 },
      letter: { sent: 0, delivered: 0, opened: 0, responded: 0, effectivenessRate: 0 },
    };

    for (const channel of Object.keys(channelStats) as ChaseChannel[]) {
      const stats = channelStats[channel];
      channelEffectiveness[channel] = {
        sent: stats.sent,
        delivered: stats.delivered,
        opened: stats.opened,
        responded: stats.responded,
        effectivenessRate: stats.sent > 0 ? Math.round((stats.responded / stats.sent) * 100) / 100 : 0,
      };
    }

    const recoveryRate = totalAmountChased > 0 ? totalAmountRecovered / totalAmountChased : 0;

    // Top delinquent clients
    const delinquentMap = new Map<string, ClientDelinquencyRecord>();
    for (const inv of invoices) {
      if (inv.status === 'overdue') {
        const client = clients.find(c => c.id === inv.clientId);
        const existing = delinquentMap.get(inv.clientId) ?? {
          clientId: inv.clientId,
          clientName: client?.name ?? 'Unknown',
          totalOutstanding: 0,
          invoicesOverdue: 0,
          averageDaysLate: 0,
          reliabilityScore: 0,
        };
        existing.totalOutstanding += inv.amount;
        existing.invoicesOverdue += 1;
        delinquentMap.set(inv.clientId, existing);
      }
    }

    // enrich with client profiles
    for (const record of delinquentMap.values()) {
      const profile = await this.storage.getClientProfile(record.clientId);
      if (profile) {
        record.averageDaysLate = profile.averageDaysLate;
        record.reliabilityScore = profile.reliabilityScore;
      }
    }

    const topDelinquentClients = Array.from(delinquentMap.values())
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 10);

    return {
      period,
      totalChases: chasesInPeriod.length,
      activeChases: activeChases.length,
      resolvedChases: resolvedChases.length,
      averageDaysToPayment: paidCount > 0 ? Math.round((totalDaysToPayment / paidCount) * 10) / 10 : 0,
      recoveryRate: Math.round(recoveryRate * 1000) / 1000,
      totalAmountChased: Math.round(totalAmountChased * 100) / 100,
      totalAmountRecovered: Math.round(totalAmountRecovered * 100) / 100,
      escalationBreakdown,
      channelEffectiveness,
      topDelinquentClients,
    };
  }
}
