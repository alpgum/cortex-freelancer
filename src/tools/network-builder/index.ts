#!/usr/bin/env node
/**
 * Network Building Toolkit with Referral Opportunity Detection
 *
 * Professional contact management, referral scoring, relationship strength,
 * networking event ROI, introduction automation, and warm lead identification.
 *
 * CFX-068 Implementation
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Command } from 'commander';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ContactCategory = 'client' | 'peer' | 'mentor' | 'prospect';
export type InteractionType = 'meeting' | 'email' | 'call' | 'coffee' | 'event' | 'referral' | 'collaboration' | 'social' | 'intro';
export type SocialPlatform = 'linkedin' | 'twitter' | 'github' | 'dribbble' | 'behance' | 'other';

export interface SocialConnection {
  platform: SocialPlatform;
  profileUrl: string;
  connected: boolean;
  connectedDate?: string;
  lastEngagement?: string;
  engagementScore: number; // 0-100
}

export interface Interaction {
  id: string;
  date: string;
  type: InteractionType;
  notes: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  followUpDate?: string;
  followUpDone?: boolean;
}

export interface ProjectHistory {
  projectId: string;
  projectName: string;
  startDate: string;
  endDate?: string;
  revenue: number;
  satisfactionRating?: number; // 1-5
  feedbackNotes?: string;
  referralMade?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  category: ContactCategory;
  tags: string[];
  socialConnections: SocialConnection[];
  interactions: Interaction[];
  projectHistory: ProjectHistory[];
  introducedBy?: string; // contact id
  introducedTo: string[]; // contact ids
  notes: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface NetworkingEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  type: 'conference' | 'meetup' | 'workshop' | 'webinar' | 'dinner' | 'other';
  cost: number;
  contactsMade: string[]; // contact ids
  leadsGenerated: number;
  projectsWon: number;
  revenueAttributed: number;
  notes: string;
}

export interface IntroductionRequest {
  id: string;
  requesterId: string;  // who's asking
  targetId: string;     // who they want to meet
  facilitatorId: string; // mutual connection
  reason: string;
  status: 'pending' | 'sent' | 'accepted' | 'declined';
  createdAt: string;
  completedAt?: string;
}

export interface ReferralOpportunity {
  contactId: string;
  contactName: string;
  score: number; // 0-100
  signals: ReferralSignal[];
  suggestedAction: string;
  timing: 'now' | 'soon' | 'nurture';
}

export interface ReferralSignal {
  type: string;
  weight: number;
  description: string;
}

export interface RelationshipScore {
  contactId: string;
  contactName: string;
  overallScore: number; // 0-100
  components: {
    interactionFrequency: number;
    interactionRecency: number;
    projectSatisfaction: number;
    socialEngagement: number;
    reciprocity: number;
  };
  trend: 'growing' | 'stable' | 'declining';
}

export interface WarmLead {
  contactId: string;
  contactName: string;
  warmth: number; // 0-100
  source: string;
  reason: string;
  suggestedApproach: string;
}

export interface NetworkData {
  contacts: Contact[];
  events: NetworkingEvent[];
  introductions: IntroductionRequest[];
}

// ── Data Store ─────────────────────────────────────────────────────────────────

export class NetworkStore {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'network');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private filePath(name: string): string {
    return path.join(this.dataDir, `${name}.json`);
  }

  loadContacts(): Contact[] {
    const p = this.filePath('contacts');
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  saveContacts(contacts: Contact[]): void {
    this.ensureDir();
    fs.writeFileSync(this.filePath('contacts'), JSON.stringify(contacts, null, 2));
  }

  loadEvents(): NetworkingEvent[] {
    const p = this.filePath('events');
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  saveEvents(events: NetworkingEvent[]): void {
    this.ensureDir();
    fs.writeFileSync(this.filePath('events'), JSON.stringify(events, null, 2));
  }

  loadIntroductions(): IntroductionRequest[] {
    const p = this.filePath('introductions');
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  saveIntroductions(intros: IntroductionRequest[]): void {
    this.ensureDir();
    fs.writeFileSync(this.filePath('introductions'), JSON.stringify(intros, null, 2));
  }

  loadAll(): NetworkData {
    return {
      contacts: this.loadContacts(),
      events: this.loadEvents(),
      introductions: this.loadIntroductions(),
    };
  }
}

// ── Contact Manager ────────────────────────────────────────────────────────────

export class ContactManager {
  private store: NetworkStore;

  constructor(store: NetworkStore) {
    this.store = store;
  }

  addContact(input: {
    name: string;
    category: ContactCategory;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
    tags?: string[];
    notes?: string;
  }): Contact {
    const contacts = this.store.loadContacts();
    const now = new Date().toISOString();
    const contact: Contact = {
      id: crypto.randomBytes(8).toString('hex'),
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      role: input.role,
      category: input.category,
      tags: input.tags || [],
      socialConnections: [],
      interactions: [],
      projectHistory: [],
      introducedTo: [],
      notes: input.notes || '',
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    contacts.push(contact);
    this.store.saveContacts(contacts);
    return contact;
  }

  updateContact(id: string, updates: Partial<Omit<Contact, 'id' | 'createdAt'>>): Contact {
    const contacts = this.store.loadContacts();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error(`Contact not found: ${id}`);
    contacts[idx] = { ...contacts[idx], ...updates, updatedAt: new Date().toISOString() };
    this.store.saveContacts(contacts);
    return contacts[idx];
  }

  getContact(id: string): Contact | undefined {
    return this.store.loadContacts().find(c => c.id === id);
  }

  listContacts(opts?: { category?: ContactCategory; tag?: string; archived?: boolean }): Contact[] {
    let contacts = this.store.loadContacts();
    if (opts?.category) contacts = contacts.filter(c => c.category === opts.category);
    if (opts?.tag) contacts = contacts.filter(c => c.tags.includes(opts.tag!));
    if (opts?.archived !== undefined) contacts = contacts.filter(c => c.archived === opts.archived);
    else contacts = contacts.filter(c => !c.archived);
    return contacts;
  }

  archiveContact(id: string): void {
    this.updateContact(id, { archived: true });
  }

  addInteraction(contactId: string, interaction: Omit<Interaction, 'id'>): Interaction {
    const contacts = this.store.loadContacts();
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) throw new Error(`Contact not found: ${contactId}`);
    const entry: Interaction = { id: crypto.randomBytes(6).toString('hex'), ...interaction };
    contact.interactions.push(entry);
    contact.updatedAt = new Date().toISOString();
    this.store.saveContacts(contacts);
    return entry;
  }

  addProjectHistory(contactId: string, project: ProjectHistory): void {
    const contacts = this.store.loadContacts();
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) throw new Error(`Contact not found: ${contactId}`);
    contact.projectHistory.push(project);
    contact.updatedAt = new Date().toISOString();
    this.store.saveContacts(contacts);
  }

  addSocialConnection(contactId: string, social: SocialConnection): void {
    const contacts = this.store.loadContacts();
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) throw new Error(`Contact not found: ${contactId}`);
    const existing = contact.socialConnections.findIndex(s => s.platform === social.platform);
    if (existing >= 0) {
      contact.socialConnections[existing] = social;
    } else {
      contact.socialConnections.push(social);
    }
    contact.updatedAt = new Date().toISOString();
    this.store.saveContacts(contacts);
  }

  searchContacts(query: string): Contact[] {
    const q = query.toLowerCase();
    return this.store.loadContacts().filter(c =>
      !c.archived && (
        c.name.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q)) ||
        (c.role || '').toLowerCase().includes(q)
      )
    );
  }
}

// ── Relationship Strength Scorer ───────────────────────────────────────────────

export class RelationshipScorer {
  /**
   * Weights for each scoring component (must sum to 1.0).
   */
  private static readonly WEIGHTS = {
    interactionFrequency: 0.25,
    interactionRecency: 0.25,
    projectSatisfaction: 0.20,
    socialEngagement: 0.15,
    reciprocity: 0.15,
  };

  scoreContact(contact: Contact, allContacts: Contact[]): RelationshipScore {
    const freq = this.interactionFrequencyScore(contact);
    const rec = this.interactionRecencyScore(contact);
    const sat = this.projectSatisfactionScore(contact);
    const soc = this.socialEngagementScore(contact);
    const rep = this.reciprocityScore(contact, allContacts);

    const w = RelationshipScorer.WEIGHTS;
    const overall = Math.round(
      freq * w.interactionFrequency +
      rec * w.interactionRecency +
      sat * w.projectSatisfaction +
      soc * w.socialEngagement +
      rep * w.reciprocity
    );

    return {
      contactId: contact.id,
      contactName: contact.name,
      overallScore: Math.min(100, Math.max(0, overall)),
      components: {
        interactionFrequency: freq,
        interactionRecency: rec,
        projectSatisfaction: sat,
        socialEngagement: soc,
        reciprocity: rep,
      },
      trend: this.calculateTrend(contact),
    };
  }

  scoreAll(contacts: Contact[]): RelationshipScore[] {
    return contacts
      .filter(c => !c.archived)
      .map(c => this.scoreContact(c, contacts))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  // ── Component scores (each 0-100) ──

  interactionFrequencyScore(contact: Contact): number {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recent = contact.interactions.filter(i => new Date(i.date) >= sixMonthsAgo);
    // 12+ interactions in 6 months → 100
    return Math.min(100, Math.round((recent.length / 12) * 100));
  }

  interactionRecencyScore(contact: Contact): number {
    if (contact.interactions.length === 0) return 0;
    const latest = contact.interactions
      .map(i => new Date(i.date).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const daysSince = (Date.now() - latest) / (1000 * 60 * 60 * 24);
    // 0 days → 100, 180+ days → 0
    return Math.max(0, Math.round(100 - (daysSince / 180) * 100));
  }

  projectSatisfactionScore(contact: Contact): number {
    const rated = contact.projectHistory.filter(p => p.satisfactionRating !== undefined);
    if (rated.length === 0) return 50; // neutral baseline
    const avg = rated.reduce((sum, p) => sum + (p.satisfactionRating || 0), 0) / rated.length;
    return Math.round((avg / 5) * 100);
  }

  socialEngagementScore(contact: Contact): number {
    if (contact.socialConnections.length === 0) return 0;
    const avg = contact.socialConnections.reduce((s, c) => s + c.engagementScore, 0) / contact.socialConnections.length;
    return Math.round(avg);
  }

  reciprocityScore(contact: Contact, allContacts: Contact[]): number {
    let score = 50; // baseline
    // Has this contact introduced us to others?
    if (contact.introducedTo.length > 0) score += contact.introducedTo.length * 10;
    // Has this contact made referrals?
    const referralInteractions = contact.interactions.filter(i => i.type === 'referral');
    score += referralInteractions.length * 15;
    // Have we been introduced by them?
    const introsFromThem = allContacts.filter(c => c.introducedBy === contact.id);
    score += introsFromThem.length * 10;
    return Math.min(100, Math.max(0, score));
  }

  private calculateTrend(contact: Contact): 'growing' | 'stable' | 'declining' {
    const now = Date.now();
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
    const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;

    const recentCount = contact.interactions.filter(i => new Date(i.date).getTime() >= threeMonthsAgo).length;
    const olderCount = contact.interactions.filter(i => {
      const t = new Date(i.date).getTime();
      return t >= sixMonthsAgo && t < threeMonthsAgo;
    }).length;

    if (recentCount > olderCount + 1) return 'growing';
    if (recentCount < olderCount - 1) return 'declining';
    return 'stable';
  }
}

// ── Referral Opportunity Detector ──────────────────────────────────────────────

export class ReferralDetector {
  private scorer: RelationshipScorer;

  constructor() {
    this.scorer = new RelationshipScorer();
  }

  /**
   * Detect referral opportunities across all contacts.
   * Returns contacts most likely to refer, sorted by score.
   */
  detectOpportunities(contacts: Contact[]): ReferralOpportunity[] {
    return contacts
      .filter(c => !c.archived && c.category === 'client')
      .map(c => this.evaluateContact(c, contacts))
      .filter(o => o.score > 20) // threshold
      .sort((a, b) => b.score - a.score);
  }

  evaluateContact(contact: Contact, allContacts: Contact[]): ReferralOpportunity {
    const signals: ReferralSignal[] = [];
    let totalScore = 0;

    // 1. Project satisfaction (max 30 pts)
    const satisfaction = this.projectSatisfactionSignal(contact);
    signals.push(satisfaction);
    totalScore += satisfaction.weight;

    // 2. Relationship strength (max 25 pts)
    const relationship = this.relationshipStrengthSignal(contact, allContacts);
    signals.push(relationship);
    totalScore += relationship.weight;

    // 3. Timing signals (max 20 pts)
    const timing = this.timingSignal(contact);
    signals.push(timing);
    totalScore += timing.weight;

    // 4. Past referral behavior (max 15 pts)
    const pastReferrals = this.pastReferralSignal(contact);
    signals.push(pastReferrals);
    totalScore += pastReferrals.weight;

    // 5. Network position / influence (max 10 pts)
    const influence = this.influenceSignal(contact);
    signals.push(influence);
    totalScore += influence.weight;

    const score = Math.min(100, Math.max(0, Math.round(totalScore)));

    return {
      contactId: contact.id,
      contactName: contact.name,
      score,
      signals,
      suggestedAction: this.suggestAction(score, signals),
      timing: score >= 70 ? 'now' : score >= 40 ? 'soon' : 'nurture',
    };
  }

  private projectSatisfactionSignal(contact: Contact): ReferralSignal {
    const projects = contact.projectHistory;
    if (projects.length === 0) {
      return { type: 'project_satisfaction', weight: 0, description: 'No project history' };
    }
    const rated = projects.filter(p => p.satisfactionRating !== undefined);
    if (rated.length === 0) {
      return { type: 'project_satisfaction', weight: 10, description: 'Projects completed but no satisfaction data' };
    }
    const avg = rated.reduce((s, p) => s + (p.satisfactionRating || 0), 0) / rated.length;
    const weight = Math.round((avg / 5) * 30);
    return {
      type: 'project_satisfaction',
      weight,
      description: `Average satisfaction ${avg.toFixed(1)}/5 across ${rated.length} project(s)`,
    };
  }

  private relationshipStrengthSignal(contact: Contact, allContacts: Contact[]): ReferralSignal {
    const relScore = this.scorer.scoreContact(contact, allContacts).overallScore;
    const weight = Math.round((relScore / 100) * 25);
    return {
      type: 'relationship_strength',
      weight,
      description: `Relationship score ${relScore}/100`,
    };
  }

  private timingSignal(contact: Contact): ReferralSignal {
    // Best timing: project recently completed with high satisfaction
    const projects = contact.projectHistory.filter(p => p.endDate);
    if (projects.length === 0) {
      return { type: 'timing', weight: 0, description: 'No completed projects' };
    }
    const latest = projects.sort((a, b) =>
      new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime()
    )[0];
    const daysSinceEnd = (Date.now() - new Date(latest.endDate!).getTime()) / (1000 * 60 * 60 * 24);

    // Sweet spot: 7-60 days after project completion
    let weight = 0;
    let description = '';
    if (daysSinceEnd <= 7) {
      weight = 15;
      description = 'Project just completed — good time but let them enjoy the result first';
    } else if (daysSinceEnd <= 30) {
      weight = 20;
      description = 'Optimal window — project completed recently, satisfaction is fresh';
    } else if (daysSinceEnd <= 60) {
      weight = 15;
      description = 'Good window — still in post-project glow';
    } else if (daysSinceEnd <= 180) {
      weight = 8;
      description = 'Moderate window — consider a check-in first';
    } else {
      weight = 3;
      description = 'Project was a while ago — reconnect before asking';
    }

    return { type: 'timing', weight, description };
  }

  private pastReferralSignal(contact: Contact): ReferralSignal {
    const referrals = contact.interactions.filter(i => i.type === 'referral');
    const referredProjects = contact.projectHistory.filter(p => p.referralMade);
    const total = referrals.length + referredProjects.length;

    if (total === 0) {
      return { type: 'past_referrals', weight: 0, description: 'No past referrals' };
    }
    const weight = Math.min(15, total * 5);
    return {
      type: 'past_referrals',
      weight,
      description: `${total} past referral(s) — proven referrer`,
    };
  }

  private influenceSignal(contact: Contact): ReferralSignal {
    let score = 0;
    // Social reach
    const connectedPlatforms = contact.socialConnections.filter(s => s.connected).length;
    score += connectedPlatforms * 2;
    // Company role influence
    if (contact.role) {
      const seniorRoles = ['ceo', 'cto', 'vp', 'director', 'head', 'founder', 'partner', 'owner'];
      if (seniorRoles.some(r => contact.role!.toLowerCase().includes(r))) {
        score += 4;
      }
    }
    const weight = Math.min(10, score);
    return {
      type: 'influence',
      weight,
      description: `Network influence score: ${weight}/10`,
    };
  }

  private suggestAction(score: number, signals: ReferralSignal[]): string {
    if (score >= 70) {
      return 'Ask for a referral directly — relationship is strong and timing is right';
    }
    if (score >= 50) {
      return 'Schedule a check-in call, then ask about their network needs';
    }
    if (score >= 30) {
      const weakest = signals.reduce((min, s) => s.weight < min.weight ? s : min);
      return `Strengthen ${weakest.type.replace('_', ' ')} before asking — ${weakest.description}`;
    }
    return 'Focus on nurturing the relationship first';
  }
}

// ── Networking Event Tracker ───────────────────────────────────────────────────

export class EventTracker {
  private store: NetworkStore;

  constructor(store: NetworkStore) {
    this.store = store;
  }

  addEvent(input: {
    name: string;
    date: string;
    location: string;
    type: NetworkingEvent['type'];
    cost: number;
    notes?: string;
  }): NetworkingEvent {
    const events = this.store.loadEvents();
    const event: NetworkingEvent = {
      id: crypto.randomBytes(8).toString('hex'),
      name: input.name,
      date: input.date,
      location: input.location,
      type: input.type,
      cost: input.cost,
      contactsMade: [],
      leadsGenerated: 0,
      projectsWon: 0,
      revenueAttributed: 0,
      notes: input.notes || '',
    };
    events.push(event);
    this.store.saveEvents(events);
    return event;
  }

  updateEvent(id: string, updates: Partial<Omit<NetworkingEvent, 'id'>>): NetworkingEvent {
    const events = this.store.loadEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) throw new Error(`Event not found: ${id}`);
    events[idx] = { ...events[idx], ...updates };
    this.store.saveEvents(events);
    return events[idx];
  }

  linkContact(eventId: string, contactId: string): void {
    const events = this.store.loadEvents();
    const event = events.find(e => e.id === eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);
    if (!event.contactsMade.includes(contactId)) {
      event.contactsMade.push(contactId);
    }
    this.store.saveEvents(events);
  }

  calculateROI(eventId: string): { roi: number; costPerLead: number; costPerProject: number; summary: string } {
    const events = this.store.loadEvents();
    const event = events.find(e => e.id === eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);

    const roi = event.cost > 0 ? ((event.revenueAttributed - event.cost) / event.cost) * 100 : 0;
    const costPerLead = event.leadsGenerated > 0 ? event.cost / event.leadsGenerated : 0;
    const costPerProject = event.projectsWon > 0 ? event.cost / event.projectsWon : 0;

    return {
      roi: Math.round(roi * 100) / 100,
      costPerLead: Math.round(costPerLead * 100) / 100,
      costPerProject: Math.round(costPerProject * 100) / 100,
      summary: `${event.name}: ROI ${roi.toFixed(0)}% | ${event.contactsMade.length} contacts | ${event.leadsGenerated} leads | ${event.projectsWon} projects | $${event.revenueAttributed} revenue from $${event.cost} investment`,
    };
  }

  rankEventsByROI(): Array<{ event: NetworkingEvent; roi: number }> {
    const events = this.store.loadEvents();
    return events
      .map(event => ({
        event,
        roi: event.cost > 0 ? ((event.revenueAttributed - event.cost) / event.cost) * 100 : 0,
      }))
      .sort((a, b) => b.roi - a.roi);
  }
}

// ── Introduction Request Manager ───────────────────────────────────────────────

export class IntroductionManager {
  private store: NetworkStore;

  constructor(store: NetworkStore) {
    this.store = store;
  }

  requestIntro(input: {
    requesterId: string;
    targetId: string;
    facilitatorId: string;
    reason: string;
  }): IntroductionRequest {
    const intros = this.store.loadIntroductions();
    const intro: IntroductionRequest = {
      id: crypto.randomBytes(8).toString('hex'),
      requesterId: input.requesterId,
      targetId: input.targetId,
      facilitatorId: input.facilitatorId,
      reason: input.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    intros.push(intro);
    this.store.saveIntroductions(intros);
    return intro;
  }

  updateStatus(id: string, status: IntroductionRequest['status']): IntroductionRequest {
    const intros = this.store.loadIntroductions();
    const idx = intros.findIndex(i => i.id === id);
    if (idx === -1) throw new Error(`Introduction not found: ${id}`);
    intros[idx].status = status;
    if (status === 'accepted' || status === 'declined') {
      intros[idx].completedAt = new Date().toISOString();
    }
    this.store.saveIntroductions(intros);
    return intros[idx];
  }

  findMutualConnections(contactAId: string, contactBId: string, contacts: Contact[]): Contact[] {
    const aConnections = new Set<string>();
    const contactA = contacts.find(c => c.id === contactAId);
    const contactB = contacts.find(c => c.id === contactBId);
    if (!contactA || !contactB) return [];

    // Contacts who introduced A or were introduced by A
    if (contactA.introducedBy) aConnections.add(contactA.introducedBy);
    contactA.introducedTo.forEach(id => aConnections.add(id));
    // Contacts who interacted with A
    contacts.forEach(c => {
      if (c.introducedTo.includes(contactAId) || c.introducedBy === contactAId) {
        aConnections.add(c.id);
      }
    });

    // Find overlap with B's connections
    const bConnections = new Set<string>();
    if (contactB.introducedBy) bConnections.add(contactB.introducedBy);
    contactB.introducedTo.forEach(id => bConnections.add(id));
    contacts.forEach(c => {
      if (c.introducedTo.includes(contactBId) || c.introducedBy === contactBId) {
        bConnections.add(c.id);
      }
    });

    const mutualIds = [...aConnections].filter(id => bConnections.has(id));
    return contacts.filter(c => mutualIds.includes(c.id));
  }

  listPending(): IntroductionRequest[] {
    return this.store.loadIntroductions().filter(i => i.status === 'pending' || i.status === 'sent');
  }

  generateIntroEmail(intro: IntroductionRequest, contacts: Contact[]): string {
    const requester = contacts.find(c => c.id === intro.requesterId);
    const target = contacts.find(c => c.id === intro.targetId);
    const facilitator = contacts.find(c => c.id === intro.facilitatorId);

    if (!requester || !target || !facilitator) {
      return 'Could not generate email — contact data missing.';
    }

    return [
      `Subject: Intro — ${requester.name} <> ${target.name}`,
      ``,
      `Hi ${facilitator.name},`,
      ``,
      `I'd love an introduction to ${target.name}${target.company ? ` at ${target.company}` : ''}.`,
      ``,
      `${intro.reason}`,
      ``,
      `Would you be comfortable making the connection? Happy to draft the intro email for you.`,
      ``,
      `Thanks!`,
      `${requester.name}`,
    ].join('\n');
  }
}

// ── Warm Lead Identifier ───────────────────────────────────────────────────────

export class WarmLeadIdentifier {
  private scorer: RelationshipScorer;

  constructor() {
    this.scorer = new RelationshipScorer();
  }

  identifyWarmLeads(contacts: Contact[]): WarmLead[] {
    const leads: WarmLead[] = [];

    for (const contact of contacts) {
      if (contact.archived) continue;

      // Prospects with recent engagement
      if (contact.category === 'prospect') {
        const warmth = this.calculateProspectWarmth(contact, contacts);
        if (warmth > 30) {
          leads.push({
            contactId: contact.id,
            contactName: contact.name,
            warmth,
            source: 'direct_prospect',
            reason: this.prospectReason(contact),
            suggestedApproach: this.suggestApproach(contact, warmth),
          });
        }
      }

      // Peers who might need services
      if (contact.category === 'peer') {
        const warmth = this.calculatePeerWarmth(contact, contacts);
        if (warmth > 40) {
          leads.push({
            contactId: contact.id,
            contactName: contact.name,
            warmth,
            source: 'peer_opportunity',
            reason: 'Peer with potential collaboration or overflow work',
            suggestedApproach: 'Reach out about collaboration opportunities',
          });
        }
      }

      // Former clients for repeat business
      if (contact.category === 'client') {
        const warmth = this.calculateRepeatBusinessWarmth(contact, contacts);
        if (warmth > 35) {
          leads.push({
            contactId: contact.id,
            contactName: contact.name,
            warmth,
            source: 'repeat_business',
            reason: 'Former client with repeat business potential',
            suggestedApproach: this.suggestRepeatApproach(contact),
          });
        }
      }
    }

    return leads.sort((a, b) => b.warmth - a.warmth);
  }

  private calculateProspectWarmth(contact: Contact, allContacts: Contact[]): number {
    let warmth = 0;
    const relScore = this.scorer.scoreContact(contact, allContacts).overallScore;
    warmth += relScore * 0.5;

    // Introduced by someone we know well?
    if (contact.introducedBy) {
      const introducer = allContacts.find(c => c.id === contact.introducedBy);
      if (introducer) {
        const introducerScore = this.scorer.scoreContact(introducer, allContacts).overallScore;
        warmth += (introducerScore / 100) * 30;
      }
    }

    // Recent interactions?
    const recentInteractions = contact.interactions.filter(i => {
      const daysSince = (Date.now() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 30;
    });
    warmth += recentInteractions.length * 5;

    return Math.min(100, Math.round(warmth));
  }

  private calculatePeerWarmth(contact: Contact, allContacts: Contact[]): number {
    let warmth = 0;
    const relScore = this.scorer.scoreContact(contact, allContacts).overallScore;
    warmth += relScore * 0.4;

    // Collaboration interactions
    const collabs = contact.interactions.filter(i => i.type === 'collaboration');
    warmth += collabs.length * 10;

    // Referral exchanges
    const referrals = contact.interactions.filter(i => i.type === 'referral');
    warmth += referrals.length * 8;

    return Math.min(100, Math.round(warmth));
  }

  private calculateRepeatBusinessWarmth(contact: Contact, allContacts: Contact[]): number {
    let warmth = 0;

    // High satisfaction on past projects?
    const avgSat = this.avgSatisfaction(contact);
    warmth += (avgSat / 5) * 40;

    // Time since last project (sweet spot 3-12 months)
    const lastProject = this.lastCompletedProject(contact);
    if (lastProject?.endDate) {
      const monthsSince = (Date.now() - new Date(lastProject.endDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= 3 && monthsSince <= 12) warmth += 25;
      else if (monthsSince < 3) warmth += 15;
      else if (monthsSince <= 24) warmth += 10;
    }

    // Relationship strength
    const relScore = this.scorer.scoreContact(contact, allContacts).overallScore;
    warmth += relScore * 0.2;

    return Math.min(100, Math.round(warmth));
  }

  private avgSatisfaction(contact: Contact): number {
    const rated = contact.projectHistory.filter(p => p.satisfactionRating !== undefined);
    if (rated.length === 0) return 3;
    return rated.reduce((s, p) => s + (p.satisfactionRating || 0), 0) / rated.length;
  }

  private lastCompletedProject(contact: Contact): ProjectHistory | undefined {
    return contact.projectHistory
      .filter(p => p.endDate)
      .sort((a, b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime())[0];
  }

  private prospectReason(contact: Contact): string {
    if (contact.introducedBy) return 'Warm introduction from existing contact';
    if (contact.interactions.length > 2) return 'Multiple interactions indicate genuine interest';
    if (contact.interactions.length > 0) return 'Initial engagement started';
    return 'Prospect in pipeline';
  }

  private suggestApproach(contact: Contact, warmth: number): string {
    if (warmth >= 70) return 'Schedule a discovery call — strong engagement signals';
    if (warmth >= 50) return 'Send a personalized case study or portfolio piece';
    return 'Share relevant content or engage on social media';
  }

  private suggestRepeatApproach(contact: Contact): string {
    const avgSat = this.avgSatisfaction(contact);
    if (avgSat >= 4.5) return 'Reach out with a new service offering — they loved the last project';
    if (avgSat >= 3.5) return 'Check in and ask about upcoming needs';
    return 'Send a friendly catch-up message before pitching';
  }
}

// ── Community Engagement Scorer ────────────────────────────────────────────────

export class CommunityEngagementScorer {
  /**
   * Aggregate social + interaction engagement into a single community score.
   */
  scoreContact(contact: Contact): number {
    let score = 0;

    // Social connections (max 30)
    const connectedSocials = contact.socialConnections.filter(s => s.connected);
    score += Math.min(30, connectedSocials.length * 10);

    // Social engagement quality (max 30)
    if (connectedSocials.length > 0) {
      const avgEngagement = connectedSocials.reduce((s, c) => s + c.engagementScore, 0) / connectedSocials.length;
      score += Math.round((avgEngagement / 100) * 30);
    }

    // Community interactions like events, intros, collaborations (max 40)
    const communityTypes: InteractionType[] = ['event', 'collaboration', 'intro', 'referral'];
    const communityInteractions = contact.interactions.filter(i => communityTypes.includes(i.type));
    score += Math.min(40, communityInteractions.length * 8);

    return Math.min(100, score);
  }

  rankContacts(contacts: Contact[]): Array<{ contactId: string; name: string; communityScore: number }> {
    return contacts
      .filter(c => !c.archived)
      .map(c => ({
        contactId: c.id,
        name: c.name,
        communityScore: this.scoreContact(c),
      }))
      .sort((a, b) => b.communityScore - a.communityScore);
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────────

export class NetworkBuilderCLI {
  private store: NetworkStore;
  private contactMgr: ContactManager;
  private eventTracker: EventTracker;
  private introMgr: IntroductionManager;
  private scorer: RelationshipScorer;
  private referralDetector: ReferralDetector;
  private warmLeadId: WarmLeadIdentifier;
  private communityScorer: CommunityEngagementScorer;

  constructor(dataDir?: string) {
    this.store = new NetworkStore(dataDir);
    this.contactMgr = new ContactManager(this.store);
    this.eventTracker = new EventTracker(this.store);
    this.introMgr = new IntroductionManager(this.store);
    this.scorer = new RelationshipScorer();
    this.referralDetector = new ReferralDetector();
    this.warmLeadId = new WarmLeadIdentifier();
    this.communityScorer = new CommunityEngagementScorer();
  }

  async run(): Promise<void> {
    const program = new Command();

    program
      .name('network-builder')
      .description('Network Building Toolkit with Referral Opportunity Detection')
      .version('1.0.0');

    // ── Contact commands ───────────────────────

    const contactCmd = program.command('contact').description('Manage professional contacts');

    contactCmd
      .command('add')
      .description('Add a new contact')
      .requiredOption('-n, --name <name>', 'Contact name')
      .requiredOption('-c, --category <category>', 'Category: client|peer|mentor|prospect')
      .option('-e, --email <email>', 'Email address')
      .option('--company <company>', 'Company name')
      .option('--role <role>', 'Job role')
      .option('-t, --tags <tags>', 'Comma-separated tags')
      .option('--notes <notes>', 'Notes')
      .action((opts) => {
        const contact = this.contactMgr.addContact({
          name: opts.name,
          category: opts.category as ContactCategory,
          email: opts.email,
          company: opts.company,
          role: opts.role,
          tags: opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : [],
          notes: opts.notes,
        });
        console.log(`✅ Contact added: ${contact.name} (${contact.id})`);
      });

    contactCmd
      .command('list')
      .description('List contacts')
      .option('-c, --category <category>', 'Filter by category')
      .option('-t, --tag <tag>', 'Filter by tag')
      .option('-a, --archived', 'Include archived')
      .action((opts) => {
        const contacts = this.contactMgr.listContacts({
          category: opts.category as ContactCategory,
          tag: opts.tag,
          archived: opts.archived ? undefined : false,
        });
        if (contacts.length === 0) {
          console.log('No contacts found.');
          return;
        }
        console.log(`\n📇 Contacts (${contacts.length}):\n`);
        contacts.forEach(c => {
          console.log(`  ${c.name} [${c.category}] ${c.company ? '@ ' + c.company : ''} — ${c.id}`);
        });
      });

    contactCmd
      .command('search <query>')
      .description('Search contacts')
      .action((query: string) => {
        const results = this.contactMgr.searchContacts(query);
        console.log(`\n🔍 Found ${results.length} contact(s):\n`);
        results.forEach(c => {
          console.log(`  ${c.name} [${c.category}] ${c.company || ''} — ${c.id}`);
        });
      });

    contactCmd
      .command('interact <contactId>')
      .description('Log an interaction')
      .requiredOption('--type <type>', 'Type: meeting|email|call|coffee|event|referral|collaboration|social|intro')
      .requiredOption('--notes <notes>', 'Interaction notes')
      .option('--sentiment <sentiment>', 'Sentiment: positive|neutral|negative')
      .option('--follow-up <date>', 'Follow-up date (ISO)')
      .action((contactId: string, opts) => {
        const interaction = this.contactMgr.addInteraction(contactId, {
          date: new Date().toISOString(),
          type: opts.type as InteractionType,
          notes: opts.notes,
          sentiment: opts.sentiment,
          followUpDate: opts.followUp,
        });
        console.log(`✅ Interaction logged: ${interaction.id}`);
      });

    // ── Referral commands ──────────────────────

    program
      .command('referrals')
      .description('Detect referral opportunities')
      .option('--min-score <score>', 'Minimum score threshold', '20')
      .action((opts) => {
        const contacts = this.store.loadContacts();
        const opportunities = this.referralDetector.detectOpportunities(contacts)
          .filter(o => o.score >= parseInt(opts.minScore));
        if (opportunities.length === 0) {
          console.log('No referral opportunities detected above threshold.');
          return;
        }
        console.log(`\n🎯 Referral Opportunities (${opportunities.length}):\n`);
        opportunities.forEach(o => {
          const timingEmoji = o.timing === 'now' ? '🟢' : o.timing === 'soon' ? '🟡' : '🔵';
          console.log(`  ${timingEmoji} ${o.contactName} — Score: ${o.score}/100`);
          console.log(`     Action: ${o.suggestedAction}`);
          o.signals.forEach(s => {
            console.log(`     • ${s.type}: ${s.description} (+${s.weight})`);
          });
          console.log('');
        });
      });

    // ── Relationship scores ────────────────────

    program
      .command('scores')
      .description('Show relationship strength scores')
      .option('--top <n>', 'Show top N', '10')
      .action((opts) => {
        const contacts = this.store.loadContacts();
        const scores = this.scorer.scoreAll(contacts).slice(0, parseInt(opts.top));
        if (scores.length === 0) {
          console.log('No contacts to score.');
          return;
        }
        console.log(`\n💪 Relationship Scores:\n`);
        scores.forEach(s => {
          const trendEmoji = s.trend === 'growing' ? '📈' : s.trend === 'declining' ? '📉' : '➡️';
          console.log(`  ${s.contactName}: ${s.overallScore}/100 ${trendEmoji}`);
          console.log(`    Freq: ${s.components.interactionFrequency} | Recent: ${s.components.interactionRecency} | Sat: ${s.components.projectSatisfaction} | Social: ${s.components.socialEngagement} | Recip: ${s.components.reciprocity}`);
        });
      });

    // ── Warm leads ─────────────────────────────

    program
      .command('warm-leads')
      .description('Identify warm leads from existing network')
      .action(() => {
        const contacts = this.store.loadContacts();
        const leads = this.warmLeadId.identifyWarmLeads(contacts);
        if (leads.length === 0) {
          console.log('No warm leads identified.');
          return;
        }
        console.log(`\n🔥 Warm Leads (${leads.length}):\n`);
        leads.forEach(l => {
          console.log(`  ${l.contactName} — Warmth: ${l.warmth}/100 [${l.source}]`);
          console.log(`    ${l.reason}`);
          console.log(`    → ${l.suggestedApproach}`);
          console.log('');
        });
      });

    // ── Events ─────────────────────────────────

    const eventCmd = program.command('event').description('Track networking events');

    eventCmd
      .command('add')
      .description('Add a networking event')
      .requiredOption('-n, --name <name>', 'Event name')
      .requiredOption('-d, --date <date>', 'Event date (ISO)')
      .requiredOption('-l, --location <location>', 'Location')
      .option('--type <type>', 'Type: conference|meetup|workshop|webinar|dinner|other', 'meetup')
      .option('--cost <cost>', 'Cost in dollars', '0')
      .action((opts) => {
        const event = this.eventTracker.addEvent({
          name: opts.name,
          date: opts.date,
          location: opts.location,
          type: opts.type as NetworkingEvent['type'],
          cost: parseFloat(opts.cost),
        });
        console.log(`✅ Event added: ${event.name} (${event.id})`);
      });

    eventCmd
      .command('roi [eventId]')
      .description('Calculate event ROI')
      .action((eventId?: string) => {
        if (eventId) {
          const result = this.eventTracker.calculateROI(eventId);
          console.log(`\n📊 ${result.summary}`);
          console.log(`   Cost/Lead: $${result.costPerLead} | Cost/Project: $${result.costPerProject}`);
        } else {
          const ranked = this.eventTracker.rankEventsByROI();
          if (ranked.length === 0) {
            console.log('No events tracked yet.');
            return;
          }
          console.log(`\n📊 Events by ROI:\n`);
          ranked.forEach(r => {
            console.log(`  ${r.event.name}: ${r.roi.toFixed(0)}% ROI ($${r.event.cost} invested → $${r.event.revenueAttributed} revenue)`);
          });
        }
      });

    // ── Introductions ──────────────────────────

    program
      .command('intro')
      .description('Request an introduction')
      .requiredOption('--from <id>', 'Your contact ID (requester)')
      .requiredOption('--to <id>', 'Target contact ID')
      .requiredOption('--via <id>', 'Facilitator contact ID')
      .requiredOption('--reason <reason>', 'Why you want the intro')
      .action((opts) => {
        const intro = this.introMgr.requestIntro({
          requesterId: opts.from,
          targetId: opts.to,
          facilitatorId: opts.via,
          reason: opts.reason,
        });
        const contacts = this.store.loadContacts();
        const email = this.introMgr.generateIntroEmail(intro, contacts);
        console.log(`✅ Introduction request created: ${intro.id}\n`);
        console.log('📧 Draft email:\n');
        console.log(email);
      });

    // ── Community engagement ───────────────────

    program
      .command('community')
      .description('Community engagement rankings')
      .option('--top <n>', 'Show top N', '10')
      .action((opts) => {
        const contacts = this.store.loadContacts();
        const ranked = this.communityScorer.rankContacts(contacts).slice(0, parseInt(opts.top));
        if (ranked.length === 0) {
          console.log('No contacts to rank.');
          return;
        }
        console.log(`\n🌐 Community Engagement Rankings:\n`);
        ranked.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.name}: ${r.communityScore}/100`);
        });
      });

    // ── Dashboard ──────────────────────────────

    program
      .command('dashboard')
      .description('Network overview dashboard')
      .action(() => {
        const contacts = this.store.loadContacts().filter(c => !c.archived);
        const events = this.store.loadEvents();
        const intros = this.store.loadIntroductions();

        const byCategory = (cat: ContactCategory) => contacts.filter(c => c.category === cat).length;
        const totalInteractions = contacts.reduce((s, c) => s + c.interactions.length, 0);
        const totalRevenue = contacts.reduce((s, c) =>
          s + c.projectHistory.reduce((ps, p) => ps + p.revenue, 0), 0);

        console.log('\n═══════════════════════════════════════');
        console.log('   📡 NETWORK DASHBOARD');
        console.log('═══════════════════════════════════════\n');
        console.log(`  Total Contacts: ${contacts.length}`);
        console.log(`    Clients: ${byCategory('client')} | Peers: ${byCategory('peer')} | Mentors: ${byCategory('mentor')} | Prospects: ${byCategory('prospect')}`);
        console.log(`  Total Interactions: ${totalInteractions}`);
        console.log(`  Lifetime Revenue: $${totalRevenue.toLocaleString()}`);
        console.log(`  Events Attended: ${events.length}`);
        console.log(`  Intro Requests: ${intros.length} (${intros.filter(i => i.status === 'pending').length} pending)`);
        console.log('');

        // Top referral opportunities
        const referrals = this.referralDetector.detectOpportunities(contacts).slice(0, 3);
        if (referrals.length > 0) {
          console.log('  🎯 Top Referral Opportunities:');
          referrals.forEach(r => console.log(`    • ${r.contactName} (${r.score}/100) — ${r.timing}`));
          console.log('');
        }

        // Top warm leads
        const leads = this.warmLeadId.identifyWarmLeads(contacts).slice(0, 3);
        if (leads.length > 0) {
          console.log('  🔥 Top Warm Leads:');
          leads.forEach(l => console.log(`    • ${l.contactName} (${l.warmth}/100) — ${l.source}`));
        }

        console.log('\n═══════════════════════════════════════\n');
      });

    await program.parseAsync(process.argv);
  }
}

// CLI execution
if (require.main === module) {
  const cli = new NetworkBuilderCLI();
  cli.run().catch(error => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}
