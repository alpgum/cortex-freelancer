import {
  ClientPaymentProfile,
  ClientRiskLevel,
  Invoice,
  PaymentHistoryEntry,
  StorageAdapter,
} from '../types';
import { differenceInDays } from 'date-fns';

/**
 * Client Intelligence Engine
 * Tracks payment patterns per client, predicts late payments,
 * and adjusts chase strategy accordingly.
 */
export class ClientIntelligence {
  constructor(private storage: StorageAdapter) {}

  /**
   * Build or update a client's payment profile from their invoice history.
   */
  async buildProfile(clientId: string, invoices: Invoice[]): Promise<ClientPaymentProfile> {
    const clientInvoices = invoices.filter(inv => inv.clientId === clientId);
    const history: PaymentHistoryEntry[] = [];
    let totalPaid = 0;
    let totalOnTime = 0;
    let totalLate = 0;
    let totalUnpaid = 0;
    let totalDaysToPayment = 0;
    let totalDaysLate = 0;
    let paidCount = 0;
    let lateCount = 0;
    let totalOutstanding = 0;
    let lastPaymentDate: Date | undefined;
    const payDays: number[] = [];
    const payDaysOfWeek: number[] = [];

    for (const inv of clientInvoices) {
      const entry: PaymentHistoryEntry = {
        invoiceId: inv.id,
        amount: inv.amount,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        daysToPayment: undefined,
        daysLate: undefined,
        chaseActionsNeeded: 0,
      };

      if (inv.paidAt) {
        const daysToPayment = differenceInDays(inv.paidAt, inv.issuedAt);
        const daysLate = differenceInDays(inv.paidAt, inv.dueDate);
        entry.daysToPayment = daysToPayment;
        entry.daysLate = Math.max(0, daysLate);

        totalDaysToPayment += daysToPayment;
        paidCount++;
        totalPaid += inv.amount;
        payDays.push(inv.paidAt.getDate());
        payDaysOfWeek.push(inv.paidAt.getDay());

        if (daysLate > 0) {
          totalLate++;
          lateCount++;
          totalDaysLate += daysLate;
        } else {
          totalOnTime++;
        }

        if (!lastPaymentDate || inv.paidAt > lastPaymentDate) {
          lastPaymentDate = inv.paidAt;
        }
      } else if (inv.status === 'overdue' || inv.status === 'sent') {
        totalUnpaid++;
        totalOutstanding += inv.amount;
      }

      history.push(entry);
    }

    const averageDaysToPayment = paidCount > 0 ? totalDaysToPayment / paidCount : 0;
    const averageDaysLate = lateCount > 0 ? totalDaysLate / lateCount : 0;

    // Median days to payment
    const paidDays = history
      .filter(h => h.daysToPayment !== undefined)
      .map(h => h.daysToPayment!)
      .sort((a, b) => a - b);
    const medianDaysToPayment = paidDays.length > 0
      ? paidDays[Math.floor(paidDays.length / 2)]
      : 0;

    // Preferred pay day (mode)
    const preferredPayDay = this.mode(payDays);
    const preferredPayDayOfWeek = this.mode(payDaysOfWeek);

    // Reliability score (0-100)
    const reliabilityScore = this.calculateReliabilityScore({
      totalInvoices: clientInvoices.length,
      paidOnTime: totalOnTime,
      paidLate: totalLate,
      unpaid: totalUnpaid,
      averageDaysLate,
    });

    const riskLevel = this.assessRisk(reliabilityScore, totalOutstanding, totalUnpaid);

    const profile: ClientPaymentProfile = {
      clientId,
      totalInvoices: clientInvoices.length,
      paidOnTime: totalOnTime,
      paidLate: totalLate,
      unpaid: totalUnpaid,
      averageDaysToPayment: Math.round(averageDaysToPayment * 10) / 10,
      medianDaysToPayment,
      averageDaysLate: Math.round(averageDaysLate * 10) / 10,
      reliabilityScore,
      preferredPayDay,
      preferredPayDayOfWeek,
      lastPaymentDate,
      totalOutstanding,
      riskLevel,
      paymentHistory: history,
      updatedAt: new Date(),
    };

    await this.storage.saveClientProfile(profile);
    return profile;
  }

  /**
   * Calculate reliability score (0-100).
   * Factors: on-time rate, number of unpaid, average days late.
   */
  calculateReliabilityScore(data: {
    totalInvoices: number;
    paidOnTime: number;
    paidLate: number;
    unpaid: number;
    averageDaysLate: number;
  }): number {
    if (data.totalInvoices === 0) return 50; // no data = neutral

    const totalPaid = data.paidOnTime + data.paidLate;
    const onTimeRate = totalPaid > 0 ? data.paidOnTime / totalPaid : 0;
    const unpaidRate = data.unpaid / data.totalInvoices;
    const latePenalty = Math.min(data.averageDaysLate / 60, 1); // max penalty at 60 days

    // Weighted scoring
    let score = 100;
    score -= (1 - onTimeRate) * 40;     // up to -40 for late payments
    score -= unpaidRate * 35;             // up to -35 for unpaid invoices
    score -= latePenalty * 25;            // up to -25 for how late they pay

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Assess client risk level based on reliability and outstanding amounts.
   */
  assessRisk(reliabilityScore: number, totalOutstanding: number, unpaidCount: number): ClientRiskLevel {
    if (reliabilityScore >= 80 && unpaidCount <= 1) return 'low';
    if (reliabilityScore >= 60 && unpaidCount <= 2) return 'medium';
    if (reliabilityScore >= 40 || (unpaidCount <= 3 && totalOutstanding < 10000)) return 'high';
    return 'critical';
  }

  /**
   * Predict if a client is likely to pay late based on their profile.
   */
  async predictLatePayment(clientId: string): Promise<{
    likelihood: number; // 0-1
    predictedDaysLate: number;
    reasoning: string[];
  }> {
    const profile = await this.storage.getClientProfile(clientId);
    if (!profile) {
      return { likelihood: 0.3, predictedDaysLate: 0, reasoning: ['No payment history available'] };
    }

    const reasoning: string[] = [];
    let likelihood = 0;

    // Base rate from history
    const lateRate = profile.totalInvoices > 0
      ? profile.paidLate / (profile.paidOnTime + profile.paidLate || 1)
      : 0.3;
    likelihood = lateRate;
    reasoning.push(`Historical late rate: ${(lateRate * 100).toFixed(0)}%`);

    // Adjust for current outstanding
    if (profile.unpaid > 0) {
      likelihood = Math.min(1, likelihood + 0.15);
      reasoning.push(`${profile.unpaid} currently unpaid invoices`);
    }

    // Adjust for risk level
    if (profile.riskLevel === 'critical') {
      likelihood = Math.min(1, likelihood + 0.2);
      reasoning.push('Client is flagged as critical risk');
    } else if (profile.riskLevel === 'high') {
      likelihood = Math.min(1, likelihood + 0.1);
      reasoning.push('Client is flagged as high risk');
    }

    return {
      likelihood: Math.round(likelihood * 100) / 100,
      predictedDaysLate: Math.round(profile.averageDaysLate),
      reasoning,
    };
  }

  /**
   * Get the recommended chase sequence for a client based on their profile.
   */
  async getRecommendedStrategy(clientId: string): Promise<{
    urgency: 'relaxed' | 'standard' | 'aggressive';
    reasoning: string[];
  }> {
    const profile = await this.storage.getClientProfile(clientId);
    if (!profile) return { urgency: 'standard', reasoning: ['No client data — using standard approach'] };

    const reasoning: string[] = [];

    if (profile.reliabilityScore >= 80) {
      reasoning.push(`High reliability score (${profile.reliabilityScore}) — client usually pays`);
      reasoning.push('Using relaxed approach to maintain good relationship');
      return { urgency: 'relaxed', reasoning };
    }

    if (profile.reliabilityScore < 50 || profile.riskLevel === 'critical') {
      reasoning.push(`Low reliability score (${profile.reliabilityScore})`);
      if (profile.totalOutstanding > 5000) {
        reasoning.push(`High outstanding amount: $${profile.totalOutstanding}`);
      }
      reasoning.push('Using aggressive approach for faster recovery');
      return { urgency: 'aggressive', reasoning };
    }

    reasoning.push(`Moderate reliability score (${profile.reliabilityScore}) — using standard approach`);
    return { urgency: 'standard', reasoning };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private mode(arr: number[]): number | undefined {
    if (arr.length === 0) return undefined;
    const freq = new Map<number, number>();
    let maxFreq = 0;
    let modeVal = arr[0];
    for (const val of arr) {
      const count = (freq.get(val) ?? 0) + 1;
      freq.set(val, count);
      if (count > maxFreq) {
        maxFreq = count;
        modeVal = val;
      }
    }
    return modeVal;
  }
}
