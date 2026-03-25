import {
  ClientPaymentProfile,
  TimingRecommendation,
  TimingFactor,
  StorageAdapter,
} from '../types';
import { addDays, getDay, getHours, setHours, setMinutes, isWeekend } from 'date-fns';

/**
 * Smart Timing Engine
 * Determines the optimal time to send payment reminders based on:
 * - Client payment patterns (when they typically pay)
 * - Day of week (avoid weekends, prefer Tue-Thu)
 * - Time of day (business hours, morning preferred)
 * - Invoice amount (higher = more strategic timing)
 */
export class SmartTimingEngine {
  constructor(private storage: StorageAdapter) {}

  /**
   * Calculate optimal send time for a chase message.
   */
  async getOptimalTiming(
    clientId: string,
    baseDate: Date = new Date()
  ): Promise<TimingRecommendation> {
    const profile = await this.storage.getClientProfile(clientId);
    const factors: TimingFactor[] = [];
    let suggestedDate = new Date(baseDate);
    const reasoning: string[] = [];

    // Factor 1: Day of week preference
    const dayFactor = this.evaluateDayOfWeek(suggestedDate);
    factors.push(dayFactor);
    if (dayFactor.value < 0) {
      // Move to next good day
      suggestedDate = this.findNextGoodDay(suggestedDate);
      reasoning.push(`Moved to ${this.dayName(suggestedDate.getDay())} — better response day`);
    }

    // Factor 2: Time of day
    const timeFactor = this.evaluateTimeOfDay(suggestedDate);
    factors.push(timeFactor);
    suggestedDate = this.setOptimalTime(suggestedDate);
    reasoning.push('Set to 10:00 AM — optimal business hours');

    // Factor 3: Client patterns (if available)
    if (profile) {
      const patternFactor = this.evaluateClientPattern(profile, suggestedDate);
      factors.push(patternFactor);

      if (profile.preferredPayDayOfWeek !== undefined) {
        // Send reminder 1-2 days before their usual pay day
        const daysBefore = this.daysUntilWeekday(suggestedDate, profile.preferredPayDayOfWeek);
        if (daysBefore > 2) {
          const adjusted = addDays(suggestedDate, daysBefore - 2);
          if (adjusted > suggestedDate) {
            suggestedDate = adjusted;
            reasoning.push(`Timed near client's usual pay day (${this.dayName(profile.preferredPayDayOfWeek)})`);
          }
        }
      }

      // Factor 4: Client risk level
      const riskFactor = this.evaluateRiskLevel(profile);
      factors.push(riskFactor);
      if (profile.riskLevel === 'critical' || profile.riskLevel === 'high') {
        reasoning.push(`High-risk client — sending sooner`);
        // Don't delay for risky clients
        suggestedDate = this.setOptimalTime(baseDate > suggestedDate ? baseDate : suggestedDate);
      }
    }

    // Ensure not in the past
    if (suggestedDate < new Date()) {
      suggestedDate = this.setOptimalTime(addDays(new Date(), 1));
      suggestedDate = this.findNextGoodDay(suggestedDate);
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(factors, !!profile);

    return {
      suggestedDate,
      suggestedTime: `${String(suggestedDate.getHours()).padStart(2, '0')}:${String(suggestedDate.getMinutes()).padStart(2, '0')}`,
      confidence,
      reasoning,
      factors,
    };
  }

  // ── Factor Evaluation ──────────────────────────────────────────

  evaluateDayOfWeek(date: Date): TimingFactor {
    const day = getDay(date);
    // Tue(2), Wed(3), Thu(4) = best; Mon(1) = ok; Fri(5) = decent; Sat/Sun = avoid
    const dayScores: Record<number, number> = {
      0: -0.8, 1: 0.3, 2: 0.9, 3: 0.8, 4: 0.7, 5: 0.2, 6: -0.9,
    };
    return {
      name: 'day_of_week',
      weight: 0.25,
      value: dayScores[day] ?? 0,
      description: `${this.dayName(day)}: ${dayScores[day] > 0 ? 'good' : 'poor'} response day`,
    };
  }

  evaluateTimeOfDay(date: Date): TimingFactor {
    const hour = getHours(date);
    // 9-11 AM = best, 2-4 PM = good, rest = poor
    let value = 0;
    if (hour >= 9 && hour <= 11) value = 0.9;
    else if (hour >= 14 && hour <= 16) value = 0.5;
    else if (hour >= 7 && hour <= 18) value = 0.2;
    else value = -0.5;

    return {
      name: 'time_of_day',
      weight: 0.2,
      value,
      description: `${hour}:00 — ${value > 0.5 ? 'optimal' : value > 0 ? 'acceptable' : 'suboptimal'} time`,
    };
  }

  evaluateClientPattern(profile: ClientPaymentProfile, date: Date): TimingFactor {
    if (profile.totalInvoices < 2) {
      return {
        name: 'client_pattern',
        weight: 0.15,
        value: 0,
        description: 'Insufficient payment history for pattern analysis',
      };
    }

    let value = 0;
    const description: string[] = [];

    // Check if close to preferred pay day
    if (profile.preferredPayDay !== undefined) {
      const dayOfMonth = date.getDate();
      const distance = Math.abs(dayOfMonth - profile.preferredPayDay);
      value = distance <= 3 ? 0.8 : distance <= 7 ? 0.3 : -0.2;
      description.push(`Client tends to pay around day ${profile.preferredPayDay} of month`);
    }

    return {
      name: 'client_pattern',
      weight: 0.25,
      value,
      description: description.join('; ') || 'Client pattern analyzed',
    };
  }

  evaluateRiskLevel(profile: ClientPaymentProfile): TimingFactor {
    const riskValues: Record<string, number> = {
      low: 0.8,
      medium: 0.3,
      high: -0.3,
      critical: -0.8,
    };
    return {
      name: 'client_risk',
      weight: 0.3,
      value: riskValues[profile.riskLevel] ?? 0,
      description: `Client risk: ${profile.riskLevel} (reliability: ${profile.reliabilityScore})`,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private findNextGoodDay(date: Date): Date {
    let d = new Date(date);
    // Move past weekends, prefer Tue-Thu
    while (isWeekend(d) || getDay(d) === 1) { // skip weekends and Monday
      d = addDays(d, 1);
    }
    return d;
  }

  private setOptimalTime(date: Date): Date {
    let d = setHours(date, 10);
    d = setMinutes(d, 0);
    return d;
  }

  private daysUntilWeekday(from: Date, targetDay: number): number {
    const currentDay = getDay(from);
    const diff = (targetDay - currentDay + 7) % 7;
    return diff === 0 ? 7 : diff;
  }

  private dayName(day: number): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
  }

  private calculateConfidence(factors: TimingFactor[], hasProfile: boolean): number {
    if (factors.length === 0) return 0.3;
    const weightedSum = factors.reduce((sum, f) => sum + (f.value + 1) / 2 * f.weight, 0);
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    let confidence = totalWeight > 0 ? weightedSum / totalWeight : 0.3;
    // Boost if we have client data
    if (hasProfile) confidence = Math.min(1, confidence + 0.1);
    return Math.round(confidence * 100) / 100;
  }
}
