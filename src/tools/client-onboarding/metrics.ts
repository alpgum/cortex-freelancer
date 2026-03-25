/**
 * Success Metrics
 *
 * Track onboarding completion rate, average time to first deliverable,
 * client satisfaction at each step, and drop-off analysis.
 */

import fs from 'fs';
import path from 'path';

export interface StepSatisfaction {
  stepName: string;
  rating: number; // 1-5
  feedback?: string;
  timestamp: Date;
}

export interface OnboardingMetrics {
  totalSequences: number;
  completedSequences: number;
  completionRate: number; // 0-1
  averageTimeToKickoff: number; // days
  averageTimeToFirstDeliverable: number; // days
  averageStepCompletionTimes: Record<string, number>; // hours
  satisfactionByStep: Record<string, { average: number; count: number }>; // rating avg
  dropoffByStep: Record<string, { dropped: number; entered: number; dropoffRate: number }>;
  lastUpdated: Date;
}

export interface SuccessMetrics {
  targetTimeToKickoffDays: number;
  targetCompletionRate: number; // 0-1
  targetFirstDeliverableDays: number;
}

export interface SequenceTimelineEvent {
  sequenceId: string;
  clientId: string;
  name: string; // e.g., 'Kickoff Meeting'
  type: 'started' | 'completed' | 'dropped_off';
  at: Date;
  timeSpentMinutes?: number;
}

export class MetricsTracker {
  private dataDir?: string;
  private events: SequenceTimelineEvent[] = [];
  private satisfaction: Record<string, StepSatisfaction[]> = {};

  private targets: SuccessMetrics = {
    targetTimeToKickoffDays: 3.5,
    targetCompletionRate: 0.8,
    targetFirstDeliverableDays: 7
  };

  constructor(dataDir?: string) {
    this.dataDir = dataDir;
    if (this.dataDir) {
      this.ensureDir(this.dataDir);
      this.load();
    }
  }

  async startTracking(sequenceId: string): Promise<void> {
    // no-op placeholder for now
    void sequenceId;
  }

  trackEvent(evt: SequenceTimelineEvent): void {
    this.events.push({ ...evt, at: new Date(evt.at) });
    this.persist();
  }

  recordSatisfaction(sequenceId: string, entry: StepSatisfaction): void {
    if (!this.satisfaction[sequenceId]) this.satisfaction[sequenceId] = [];
    this.satisfaction[sequenceId].push({ ...entry, timestamp: new Date(entry.timestamp) });
    this.persist();
  }

  setTargets(targets: Partial<SuccessMetrics>): void {
    this.targets = { ...this.targets, ...targets };
    this.persist();
  }

  getTargets(): SuccessMetrics {
    return { ...this.targets };
  }

  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<OnboardingMetrics> {
    const events = this.filterEvents(timeRange);

    const sequenceIds = new Set(events.map(e => e.sequenceId));
    const totalSequences = sequenceIds.size;

    const completedSequences = new Set(
      events
        .filter(e => e.name === 'First Deliverable' && e.type === 'completed')
        .map(e => e.sequenceId)
    ).size;

    const completionRate = totalSequences > 0 ? completedSequences / totalSequences : 0;

    const averageTimeToKickoff = this.avgDaysBetween(events, 'Onboarding Started', 'Kickoff Meeting');
    const averageTimeToFirstDeliverable = this.avgDaysBetween(events, 'Onboarding Started', 'First Deliverable');

    const averageStepCompletionTimes = this.computeAvgStepTimes(events);
    const satisfactionByStep = this.computeSatisfactionByStep();
    const dropoffByStep = this.computeDropoffByStep(events);

    return {
      totalSequences,
      completedSequences,
      completionRate,
      averageTimeToKickoff,
      averageTimeToFirstDeliverable,
      averageStepCompletionTimes,
      satisfactionByStep,
      dropoffByStep,
      lastUpdated: new Date()
    };
  }

  // Produce human-readable suggestions to hit targets
  async recommendImprovements(): Promise<string[]> {
    const m = await this.getMetrics();
    const recs: string[] = [];

    if (m.completionRate < this.targets.targetCompletionRate) {
      recs.push(
        `Raise completion rate from ${(m.completionRate * 100).toFixed(1)}% to ${(this.targets.targetCompletionRate * 100).toFixed(0)}%+: tighten follow-ups on Contract Signing + Payment Setup, add 1-click signing, and reduce form length.`
      );
    }

    if (m.averageTimeToKickoff > this.targets.targetTimeToKickoffDays) {
      recs.push(
        `Reduce time-to-kickoff from ${m.averageTimeToKickoff.toFixed(1)}d to ${this.targets.targetTimeToKickoffDays}d: auto-send welcome within 1h, pre-propose 3 kickoff slots, follow-up on unsigned contract at 48h.`
      );
    }

    const worstDropoff = Object.entries(m.dropoffByStep)
      .sort((a, b) => (b[1].dropoffRate || 0) - (a[1].dropoffRate || 0))[0];

    if (worstDropoff && worstDropoff[1].dropoffRate >= 0.3) {
      recs.push(
        `Highest drop-off: ${worstDropoff[0]} (${(worstDropoff[1].dropoffRate * 100).toFixed(1)}%). Add microcopy, reduce required fields, and offer “schedule a call instead”.`
      );
    }

    if (recs.length === 0) {
      recs.push('Onboarding metrics look healthy. Next: run A/B tests on welcome email subject + contract reminder cadence.');
    }

    return recs;
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private filterEvents(timeRange?: { start: Date; end: Date }): SequenceTimelineEvent[] {
    if (!timeRange) return [...this.events];
    const start = timeRange.start.getTime();
    const end = timeRange.end.getTime();
    return this.events.filter(e => {
      const t = e.at.getTime();
      return t >= start && t <= end;
    });
  }

  private avgDaysBetween(events: SequenceTimelineEvent[], startName: string, endName: string): number {
    const bySeq = new Map<string, { start?: Date; end?: Date }>();
    for (const e of events) {
      const rec = bySeq.get(e.sequenceId) || {};
      if (e.name === startName && e.type === 'started') rec.start = e.at;
      if (e.name === endName && e.type === 'completed') rec.end = e.at;
      bySeq.set(e.sequenceId, rec);
    }

    const deltas: number[] = [];
    for (const rec of bySeq.values()) {
      if (rec.start && rec.end) {
        deltas.push((rec.end.getTime() - rec.start.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    if (deltas.length === 0) return 0;
    return deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }

  private computeAvgStepTimes(events: SequenceTimelineEvent[]): Record<string, number> {
    const buckets: Record<string, number[]> = {};
    for (const e of events) {
      if (e.type === 'completed' && typeof e.timeSpentMinutes === 'number') {
        if (!buckets[e.name]) buckets[e.name] = [];
        buckets[e.name].push(e.timeSpentMinutes / 60);
      }
    }

    const out: Record<string, number> = {};
    for (const [k, arr] of Object.entries(buckets)) {
      out[k] = arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    return out;
  }

  private computeSatisfactionByStep(): Record<string, { average: number; count: number }> {
    const buckets: Record<string, number[]> = {};
    for (const seqEntries of Object.values(this.satisfaction)) {
      for (const s of seqEntries) {
        if (!buckets[s.stepName]) buckets[s.stepName] = [];
        buckets[s.stepName].push(s.rating);
      }
    }

    const out: Record<string, { average: number; count: number }> = {};
    for (const [step, arr] of Object.entries(buckets)) {
      out[step] = {
        average: arr.reduce((a, b) => a + b, 0) / arr.length,
        count: arr.length
      };
    }
    return out;
  }

  private computeDropoffByStep(events: SequenceTimelineEvent[]): OnboardingMetrics['dropoffByStep'] {
    const entered: Record<string, number> = {};
    const dropped: Record<string, number> = {};

    for (const e of events) {
      if (e.type === 'started') entered[e.name] = (entered[e.name] || 0) + 1;
      if (e.type === 'dropped_off') dropped[e.name] = (dropped[e.name] || 0) + 1;
    }

    const out: OnboardingMetrics['dropoffByStep'] = {};
    for (const step of new Set([...Object.keys(entered), ...Object.keys(dropped)])) {
      const en = entered[step] || 0;
      const dr = dropped[step] || 0;
      out[step] = {
        entered: en,
        dropped: dr,
        dropoffRate: en > 0 ? dr / en : 0
      };
    }

    return out;
  }

  private ensureDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }

  private persist(): void {
    if (!this.dataDir) return;
    const p = (f: string) => path.join(this.dataDir!, f);

    fs.writeFileSync(p('events.json'), JSON.stringify(this.events, null, 2));
    fs.writeFileSync(p('satisfaction.json'), JSON.stringify(this.satisfaction, null, 2));
    fs.writeFileSync(p('targets.json'), JSON.stringify(this.targets, null, 2));
  }

  private load(): void {
    if (!this.dataDir) return;
    const p = (f: string) => path.join(this.dataDir!, f);

    if (fs.existsSync(p('events.json'))) {
      const raw = JSON.parse(fs.readFileSync(p('events.json'), 'utf8'));
      this.events = raw.map((e: any) => ({ ...e, at: new Date(e.at) }));
    }
    if (fs.existsSync(p('satisfaction.json'))) {
      const raw = JSON.parse(fs.readFileSync(p('satisfaction.json'), 'utf8'));
      this.satisfaction = {};
      for (const [seqId, arr] of Object.entries(raw)) {
        this.satisfaction[seqId] = (arr as any[]).map(v => ({ ...v, timestamp: new Date((v as any).timestamp) }));
      }
    }
    if (fs.existsSync(p('targets.json'))) {
      this.targets = JSON.parse(fs.readFileSync(p('targets.json'), 'utf8'));
    }
  }
}