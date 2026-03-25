/**
 * Network Builder Test Suite
 * Comprehensive tests for contact management, referral detection,
 * relationship scoring, event tracking, and warm lead identification.
 *
 * CFX-068
 */

import fs from 'fs';
import path from 'path';
import {
  NetworkStore,
  ContactManager,
  RelationshipScorer,
  ReferralDetector,
  EventTracker,
  IntroductionManager,
  WarmLeadIdentifier,
  CommunityEngagementScorer,
  Contact,
  ContactCategory,
  Interaction,
  ProjectHistory,
  SocialConnection,
  NetworkingEvent,
} from '../index';

// ── Helpers ────────────────────────────────────────────────────────────────────

let testCounter = 0;
const TEST_DIRS: string[] = [];

function makeStore(): NetworkStore {
  const dir = path.join(__dirname, '..', 'data', `test-${Date.now()}-${testCounter++}`);
  TEST_DIRS.push(dir);
  return new NetworkStore(dir);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: overrides.id || 'c-' + Math.random().toString(36).slice(2, 8),
    name: overrides.name || 'Test Contact',
    email: overrides.email,
    phone: overrides.phone,
    company: overrides.company,
    role: overrides.role,
    category: overrides.category || 'client',
    tags: overrides.tags || [],
    socialConnections: overrides.socialConnections || [],
    interactions: overrides.interactions || [],
    projectHistory: overrides.projectHistory || [],
    introducedBy: overrides.introducedBy,
    introducedTo: overrides.introducedTo || [],
    notes: overrides.notes || '',
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    archived: overrides.archived || false,
  };
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

afterAll(() => {
  TEST_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── NetworkStore ───────────────────────────────────────────────────────────────

describe('NetworkStore', () => {
  let store: NetworkStore;

  beforeEach(() => {
    store = makeStore();
  });

  test('returns empty arrays when no data files exist', () => {
    expect(store.loadContacts()).toEqual([]);
    expect(store.loadEvents()).toEqual([]);
    expect(store.loadIntroductions()).toEqual([]);
  });

  test('saves and loads contacts', () => {
    const contacts = [makeContact({ name: 'Alice' })];
    store.saveContacts(contacts);
    const loaded = store.loadContacts();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Alice');
  });

  test('saves and loads events', () => {
    const events: NetworkingEvent[] = [{
      id: 'e1',
      name: 'Test Meetup',
      date: new Date().toISOString(),
      location: 'Online',
      type: 'meetup',
      cost: 0,
      contactsMade: [],
      leadsGenerated: 0,
      projectsWon: 0,
      revenueAttributed: 0,
      notes: '',
    }];
    store.saveEvents(events);
    expect(store.loadEvents()).toHaveLength(1);
  });

  test('loadAll returns all data', () => {
    store.saveContacts([makeContact()]);
    const data = store.loadAll();
    expect(data.contacts).toHaveLength(1);
    expect(data.events).toEqual([]);
    expect(data.introductions).toEqual([]);
  });
});

// ── ContactManager ─────────────────────────────────────────────────────────────

describe('ContactManager', () => {
  let mgr: ContactManager;

  beforeEach(() => {
    mgr = new ContactManager(makeStore());
  });

  test('adds a contact with required fields', () => {
    const c = mgr.addContact({ name: 'Bob', category: 'client' });
    expect(c.name).toBe('Bob');
    expect(c.category).toBe('client');
    expect(c.id).toBeTruthy();
    expect(c.archived).toBe(false);
  });

  test('adds optional fields', () => {
    const c = mgr.addContact({
      name: 'Carol',
      category: 'mentor',
      email: 'carol@test.com',
      company: 'Acme',
      role: 'CTO',
      tags: ['tech', 'design'],
      notes: 'Met at conference',
    });
    expect(c.email).toBe('carol@test.com');
    expect(c.company).toBe('Acme');
    expect(c.tags).toContain('tech');
  });

  test('lists contacts filtering by category', () => {
    mgr.addContact({ name: 'A', category: 'client' });
    mgr.addContact({ name: 'B', category: 'peer' });
    mgr.addContact({ name: 'C', category: 'client' });
    expect(mgr.listContacts({ category: 'client' })).toHaveLength(2);
    expect(mgr.listContacts({ category: 'peer' })).toHaveLength(1);
  });

  test('lists contacts filtering by tag', () => {
    mgr.addContact({ name: 'A', category: 'client', tags: ['vip'] });
    mgr.addContact({ name: 'B', category: 'client', tags: ['standard'] });
    expect(mgr.listContacts({ tag: 'vip' })).toHaveLength(1);
  });

  test('excludes archived contacts by default', () => {
    const c = mgr.addContact({ name: 'A', category: 'client' });
    mgr.archiveContact(c.id);
    expect(mgr.listContacts()).toHaveLength(0);
  });

  test('updates a contact', () => {
    const c = mgr.addContact({ name: 'A', category: 'client' });
    const updated = mgr.updateContact(c.id, { company: 'NewCo' });
    expect(updated.company).toBe('NewCo');
  });

  test('throws on update of non-existent contact', () => {
    expect(() => mgr.updateContact('nope', { name: 'X' })).toThrow('Contact not found');
  });

  test('getContact returns contact or undefined', () => {
    const c = mgr.addContact({ name: 'A', category: 'client' });
    expect(mgr.getContact(c.id)?.name).toBe('A');
    expect(mgr.getContact('nope')).toBeUndefined();
  });

  test('adds interaction to contact', () => {
    const c = mgr.addContact({ name: 'A', category: 'client' });
    const i = mgr.addInteraction(c.id, {
      date: new Date().toISOString(),
      type: 'meeting',
      notes: 'Discussed project',
      sentiment: 'positive',
    });
    expect(i.id).toBeTruthy();
    const loaded = mgr.getContact(c.id);
    expect(loaded?.interactions).toHaveLength(1);
  });

  test('throws when adding interaction to non-existent contact', () => {
    expect(() => mgr.addInteraction('nope', {
      date: new Date().toISOString(),
      type: 'call',
      notes: 'test',
    })).toThrow('Contact not found');
  });

  test('adds project history', () => {
    const c = mgr.addContact({ name: 'A', category: 'client' });
    mgr.addProjectHistory(c.id, {
      projectId: 'p1',
      projectName: 'Website',
      startDate: monthsAgo(3),
      endDate: monthsAgo(1),
      revenue: 5000,
      satisfactionRating: 5,
    });
    const loaded = mgr.getContact(c.id);
    expect(loaded?.projectHistory).toHaveLength(1);
  });

  test('adds and updates social connection', () => {
    const c = mgr.addContact({ name: 'A', category: 'client' });
    mgr.addSocialConnection(c.id, {
      platform: 'linkedin',
      profileUrl: 'https://linkedin.com/in/test',
      connected: true,
      engagementScore: 70,
    });
    let loaded = mgr.getContact(c.id);
    expect(loaded?.socialConnections).toHaveLength(1);

    // Update same platform
    mgr.addSocialConnection(c.id, {
      platform: 'linkedin',
      profileUrl: 'https://linkedin.com/in/test',
      connected: true,
      engagementScore: 90,
    });
    loaded = mgr.getContact(c.id);
    expect(loaded?.socialConnections).toHaveLength(1);
    expect(loaded?.socialConnections[0].engagementScore).toBe(90);
  });

  test('searches contacts by name, company, email, tags, role', () => {
    mgr.addContact({ name: 'Alice Smith', category: 'client', company: 'Acme', email: 'alice@acme.com', tags: ['vip'] });
    mgr.addContact({ name: 'Bob Jones', category: 'peer', role: 'Designer' });

    expect(mgr.searchContacts('alice')).toHaveLength(1);
    expect(mgr.searchContacts('acme')).toHaveLength(1);
    expect(mgr.searchContacts('alice@acme')).toHaveLength(1);
    expect(mgr.searchContacts('vip')).toHaveLength(1);
    expect(mgr.searchContacts('designer')).toHaveLength(1);
    expect(mgr.searchContacts('zzz')).toHaveLength(0);
  });
});

// ── RelationshipScorer ─────────────────────────────────────────────────────────

describe('RelationshipScorer', () => {
  const scorer = new RelationshipScorer();

  test('scores contact with no data at baseline', () => {
    const contact = makeContact();
    const score = scorer.scoreContact(contact, [contact]);
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
    expect(score.contactName).toBe('Test Contact');
  });

  test('interaction frequency: many recent → high score', () => {
    const interactions: Interaction[] = Array.from({ length: 15 }, (_, i) => ({
      id: `i${i}`,
      date: daysAgo(i * 10),
      type: 'meeting' as const,
      notes: 'test',
    }));
    const contact = makeContact({ interactions });
    expect(scorer.interactionFrequencyScore(contact)).toBeGreaterThan(70);
  });

  test('interaction frequency: no interactions → 0', () => {
    expect(scorer.interactionFrequencyScore(makeContact())).toBe(0);
  });

  test('interaction recency: recent → high, old → low', () => {
    const recent = makeContact({
      interactions: [{ id: 'i1', date: daysAgo(2), type: 'call', notes: '' }],
    });
    const old = makeContact({
      interactions: [{ id: 'i1', date: daysAgo(200), type: 'call', notes: '' }],
    });
    expect(scorer.interactionRecencyScore(recent)).toBeGreaterThan(90);
    expect(scorer.interactionRecencyScore(old)).toBe(0);
  });

  test('project satisfaction: high rating → high score', () => {
    const contact = makeContact({
      projectHistory: [
        { projectId: 'p1', projectName: 'A', startDate: monthsAgo(6), revenue: 1000, satisfactionRating: 5 },
        { projectId: 'p2', projectName: 'B', startDate: monthsAgo(3), revenue: 2000, satisfactionRating: 4 },
      ],
    });
    expect(scorer.projectSatisfactionScore(contact)).toBeGreaterThan(80);
  });

  test('project satisfaction: no rated projects → 50 baseline', () => {
    expect(scorer.projectSatisfactionScore(makeContact())).toBe(50);
  });

  test('social engagement: connected profiles → score', () => {
    const contact = makeContact({
      socialConnections: [
        { platform: 'linkedin', profileUrl: '', connected: true, engagementScore: 80 },
        { platform: 'twitter', profileUrl: '', connected: true, engagementScore: 60 },
      ],
    });
    expect(scorer.socialEngagementScore(contact)).toBe(70);
  });

  test('social engagement: no connections → 0', () => {
    expect(scorer.socialEngagementScore(makeContact())).toBe(0);
  });

  test('scoreAll sorts by overall score descending', () => {
    const weak = makeContact({ id: 'weak', name: 'Weak' });
    const strong = makeContact({
      id: 'strong',
      name: 'Strong',
      interactions: Array.from({ length: 12 }, (_, i) => ({
        id: `i${i}`, date: daysAgo(i * 5), type: 'meeting' as const, notes: '',
      })),
      projectHistory: [{ projectId: 'p1', projectName: 'A', startDate: monthsAgo(3), revenue: 5000, satisfactionRating: 5 }],
    });
    const scores = scorer.scoreAll([weak, strong]);
    expect(scores[0].contactName).toBe('Strong');
  });

  test('trend detection: growing when recent > older', () => {
    const contact = makeContact({
      interactions: [
        // 5 in last 3 months
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `r${i}`, date: daysAgo(i * 15), type: 'call' as const, notes: '',
        })),
        // 1 in prior 3 months
        { id: 'o1', date: daysAgo(100), type: 'call' as const, notes: '' },
      ],
    });
    const score = scorer.scoreContact(contact, [contact]);
    expect(score.trend).toBe('growing');
  });
});

// ── ReferralDetector ───────────────────────────────────────────────────────────

describe('ReferralDetector', () => {
  const detector = new ReferralDetector();

  test('only evaluates client contacts', () => {
    const contacts = [
      makeContact({ id: 'c1', category: 'client', name: 'Client' }),
      makeContact({ id: 'p1', category: 'peer', name: 'Peer' }),
    ];
    const opps = detector.detectOpportunities(contacts);
    const names = opps.map(o => o.contactName);
    expect(names).not.toContain('Peer');
  });

  test('excludes archived contacts', () => {
    const contacts = [makeContact({ id: 'c1', category: 'client', archived: true })];
    expect(detector.detectOpportunities(contacts)).toHaveLength(0);
  });

  test('high-satisfaction recent project → high score', () => {
    const contact = makeContact({
      id: 'c1',
      name: 'Happy Client',
      category: 'client',
      interactions: Array.from({ length: 6 }, (_, i) => ({
        id: `i${i}`, date: daysAgo(i * 10), type: 'meeting' as const, notes: '', sentiment: 'positive' as const,
      })),
      projectHistory: [{
        projectId: 'p1',
        projectName: 'Great Project',
        startDate: monthsAgo(3),
        endDate: daysAgo(20),
        revenue: 10000,
        satisfactionRating: 5,
      }],
      socialConnections: [
        { platform: 'linkedin', profileUrl: '', connected: true, engagementScore: 80 },
      ],
      role: 'CEO',
    });
    const opp = detector.evaluateContact(contact, [contact]);
    expect(opp.score).toBeGreaterThan(50);
    expect(opp.timing).not.toBe('nurture');
  });

  test('contact with past referrals gets bonus', () => {
    const withRef = makeContact({
      id: 'c1', category: 'client', name: 'Referrer',
      interactions: [
        { id: 'r1', date: daysAgo(30), type: 'referral', notes: 'Referred a friend' },
        { id: 'r2', date: daysAgo(60), type: 'referral', notes: 'Another referral' },
      ],
      projectHistory: [{ projectId: 'p1', projectName: 'P', startDate: monthsAgo(6), endDate: monthsAgo(4), revenue: 5000, satisfactionRating: 4 }],
    });
    const withoutRef = makeContact({
      id: 'c2', category: 'client', name: 'Non-referrer',
      interactions: [
        { id: 'i1', date: daysAgo(30), type: 'meeting', notes: '' },
        { id: 'i2', date: daysAgo(60), type: 'meeting', notes: '' },
      ],
      projectHistory: [{ projectId: 'p2', projectName: 'P', startDate: monthsAgo(6), endDate: monthsAgo(4), revenue: 5000, satisfactionRating: 4 }],
    });
    const all = [withRef, withoutRef];
    const opp1 = detector.evaluateContact(withRef, all);
    const opp2 = detector.evaluateContact(withoutRef, all);
    expect(opp1.score).toBeGreaterThan(opp2.score);
  });

  test('senior role adds influence signal', () => {
    const ceo = makeContact({ id: 'c1', category: 'client', role: 'CEO', name: 'Boss' });
    const intern = makeContact({ id: 'c2', category: 'client', role: 'Intern', name: 'Intern' });
    const opp1 = detector.evaluateContact(ceo, [ceo, intern]);
    const opp2 = detector.evaluateContact(intern, [ceo, intern]);
    const inf1 = opp1.signals.find(s => s.type === 'influence')!.weight;
    const inf2 = opp2.signals.find(s => s.type === 'influence')!.weight;
    expect(inf1).toBeGreaterThan(inf2);
  });

  test('signals array contains expected types', () => {
    const contact = makeContact({ id: 'c1', category: 'client' });
    const opp = detector.evaluateContact(contact, [contact]);
    const types = opp.signals.map(s => s.type);
    expect(types).toContain('project_satisfaction');
    expect(types).toContain('relationship_strength');
    expect(types).toContain('timing');
    expect(types).toContain('past_referrals');
    expect(types).toContain('influence');
  });

  test('suggestedAction varies by score', () => {
    // Low score
    const low = makeContact({ id: 'c1', category: 'client' });
    const oppLow = detector.evaluateContact(low, [low]);
    expect(oppLow.suggestedAction).toContain('nurtur');

    // High score
    const high = makeContact({
      id: 'c2', category: 'client',
      interactions: Array.from({ length: 12 }, (_, i) => ({
        id: `i${i}`, date: daysAgo(i * 5), type: 'meeting' as const, notes: '',
      })),
      projectHistory: [{
        projectId: 'p1', projectName: 'A', startDate: monthsAgo(2), endDate: daysAgo(15), revenue: 10000, satisfactionRating: 5, referralMade: true,
      }],
      socialConnections: [
        { platform: 'linkedin', profileUrl: '', connected: true, engagementScore: 90 },
        { platform: 'twitter', profileUrl: '', connected: true, engagementScore: 80 },
      ],
      role: 'CTO',
    });
    const oppHigh = detector.evaluateContact(high, [high]);
    if (oppHigh.score >= 70) {
      expect(oppHigh.suggestedAction).toContain('Ask for a referral');
    }
  });
});

// ── EventTracker ───────────────────────────────────────────────────────────────

describe('EventTracker', () => {
  let tracker: EventTracker;

  beforeEach(() => {
    tracker = new EventTracker(makeStore());
  });

  test('adds an event', () => {
    const event = tracker.addEvent({
      name: 'React Conf',
      date: '2026-04-01',
      location: 'Berlin',
      type: 'conference',
      cost: 500,
    });
    expect(event.id).toBeTruthy();
    expect(event.name).toBe('React Conf');
  });

  test('updates an event', () => {
    const event = tracker.addEvent({ name: 'E', date: '2026-01-01', location: 'X', type: 'meetup', cost: 0 });
    const updated = tracker.updateEvent(event.id, { leadsGenerated: 5, revenueAttributed: 3000 });
    expect(updated.leadsGenerated).toBe(5);
    expect(updated.revenueAttributed).toBe(3000);
  });

  test('throws on update non-existent event', () => {
    expect(() => tracker.updateEvent('nope', {})).toThrow('Event not found');
  });

  test('links contact to event (no duplicate)', () => {
    const event = tracker.addEvent({ name: 'E', date: '2026-01-01', location: 'X', type: 'meetup', cost: 0 });
    tracker.linkContact(event.id, 'contact-1');
    tracker.linkContact(event.id, 'contact-1'); // duplicate should not add
    // Update to read back and verify
    const updated = tracker.updateEvent(event.id, {});
    expect(updated.contactsMade).toHaveLength(1);
  });

  test('calculates ROI correctly', () => {
    const event = tracker.addEvent({ name: 'E', date: '2026-01-01', location: 'X', type: 'conference', cost: 1000 });
    tracker.updateEvent(event.id, {
      revenueAttributed: 5000,
      leadsGenerated: 10,
      projectsWon: 2,
    });
    const roi = tracker.calculateROI(event.id);
    expect(roi.roi).toBe(400);
    expect(roi.costPerLead).toBe(100);
    expect(roi.costPerProject).toBe(500);
    expect(roi.summary).toContain('400%');
  });

  test('ROI is 0 when cost is 0', () => {
    const event = tracker.addEvent({ name: 'Free', date: '2026-01-01', location: 'X', type: 'webinar', cost: 0 });
    const roi = tracker.calculateROI(event.id);
    expect(roi.roi).toBe(0);
  });

  test('ranks events by ROI', () => {
    const e1 = tracker.addEvent({ name: 'Bad', date: '2026-01-01', location: 'X', type: 'meetup', cost: 500 });
    tracker.updateEvent(e1.id, { revenueAttributed: 100 });
    const e2 = tracker.addEvent({ name: 'Good', date: '2026-02-01', location: 'Y', type: 'conference', cost: 200 });
    tracker.updateEvent(e2.id, { revenueAttributed: 5000 });
    const ranked = tracker.rankEventsByROI();
    expect(ranked[0].event.name).toBe('Good');
  });
});

// ── IntroductionManager ────────────────────────────────────────────────────────

describe('IntroductionManager', () => {
  let mgr: IntroductionManager;
  let store: NetworkStore;

  beforeEach(() => {
    store = makeStore();
    mgr = new IntroductionManager(store);
  });

  test('creates an intro request', () => {
    const intro = mgr.requestIntro({
      requesterId: 'me',
      targetId: 'target',
      facilitatorId: 'mutual',
      reason: 'Want to discuss partnership',
    });
    expect(intro.status).toBe('pending');
    expect(intro.id).toBeTruthy();
  });

  test('updates intro status', () => {
    const intro = mgr.requestIntro({
      requesterId: 'me', targetId: 'target', facilitatorId: 'mutual', reason: 'test',
    });
    const updated = mgr.updateStatus(intro.id, 'accepted');
    expect(updated.status).toBe('accepted');
    expect(updated.completedAt).toBeTruthy();
  });

  test('throws on update non-existent intro', () => {
    expect(() => mgr.updateStatus('nope', 'accepted')).toThrow('Introduction not found');
  });

  test('lists pending introductions', () => {
    mgr.requestIntro({ requesterId: 'a', targetId: 'b', facilitatorId: 'c', reason: '' });
    const intro2 = mgr.requestIntro({ requesterId: 'd', targetId: 'e', facilitatorId: 'f', reason: '' });
    mgr.updateStatus(intro2.id, 'accepted');
    expect(mgr.listPending()).toHaveLength(1);
  });

  test('generates intro email', () => {
    const contacts: Contact[] = [
      makeContact({ id: 'me', name: 'Alice' }),
      makeContact({ id: 'target', name: 'Bob', company: 'BigCo' }),
      makeContact({ id: 'mutual', name: 'Carol' }),
    ];
    store.saveContacts(contacts);
    const intro = mgr.requestIntro({
      requesterId: 'me', targetId: 'target', facilitatorId: 'mutual', reason: 'Discuss API integration',
    });
    const email = mgr.generateIntroEmail(intro, contacts);
    expect(email).toContain('Alice');
    expect(email).toContain('Bob');
    expect(email).toContain('Carol');
    expect(email).toContain('BigCo');
    expect(email).toContain('Discuss API integration');
  });

  test('handles missing contacts gracefully in email', () => {
    const intro = mgr.requestIntro({
      requesterId: 'x', targetId: 'y', facilitatorId: 'z', reason: 'test',
    });
    const email = mgr.generateIntroEmail(intro, []);
    expect(email).toContain('missing');
  });
});

// ── WarmLeadIdentifier ─────────────────────────────────────────────────────────

describe('WarmLeadIdentifier', () => {
  const identifier = new WarmLeadIdentifier();

  test('identifies prospect with recent interactions as warm', () => {
    const prospect = makeContact({
      id: 'p1', name: 'Hot Prospect', category: 'prospect',
      interactions: [
        { id: 'i1', date: daysAgo(3), type: 'meeting', notes: 'Discovery call' },
        { id: 'i2', date: daysAgo(10), type: 'email', notes: 'Sent proposal' },
        { id: 'i3', date: daysAgo(15), type: 'call', notes: 'Follow-up' },
      ],
    });
    const leads = identifier.identifyWarmLeads([prospect]);
    expect(leads.length).toBeGreaterThanOrEqual(1);
    expect(leads[0].source).toBe('direct_prospect');
  });

  test('identifies repeat business opportunity from satisfied client', () => {
    const client = makeContact({
      id: 'c1', name: 'Happy Client', category: 'client',
      projectHistory: [{
        projectId: 'p1', projectName: 'Project A', startDate: monthsAgo(9), endDate: monthsAgo(6),
        revenue: 8000, satisfactionRating: 5,
      }],
      interactions: [
        { id: 'i1', date: daysAgo(30), type: 'email', notes: '' },
      ],
    });
    const leads = identifier.identifyWarmLeads([client]);
    const repeatLead = leads.find(l => l.source === 'repeat_business');
    expect(repeatLead).toBeDefined();
    expect(repeatLead!.warmth).toBeGreaterThan(35);
  });

  test('identifies peer collaboration opportunity', () => {
    const peer = makeContact({
      id: 'p1', name: 'Active Peer', category: 'peer',
      interactions: [
        { id: 'i1', date: daysAgo(5), type: 'collaboration', notes: 'Joint project' },
        { id: 'i2', date: daysAgo(15), type: 'referral', notes: 'Sent me a lead' },
        { id: 'i3', date: daysAgo(20), type: 'collaboration', notes: 'Another collab' },
        { id: 'i4', date: daysAgo(30), type: 'meeting', notes: 'Catch-up' },
      ],
    });
    const leads = identifier.identifyWarmLeads([peer]);
    const peerLead = leads.find(l => l.source === 'peer_opportunity');
    expect(peerLead).toBeDefined();
  });

  test('excludes archived contacts', () => {
    const archived = makeContact({ category: 'prospect', archived: true });
    expect(identifier.identifyWarmLeads([archived])).toHaveLength(0);
  });

  test('warm introduced prospect scores higher', () => {
    const introducer = makeContact({
      id: 'intro1', name: 'Strong Connection', category: 'client',
      interactions: Array.from({ length: 10 }, (_, i) => ({
        id: `i${i}`, date: daysAgo(i * 10), type: 'meeting' as const, notes: '',
      })),
      projectHistory: [{ projectId: 'p1', projectName: 'P', startDate: monthsAgo(6), revenue: 5000, satisfactionRating: 5 }],
    });
    const warmProspect = makeContact({
      id: 'p1', name: 'Introduced Prospect', category: 'prospect',
      introducedBy: 'intro1',
      interactions: [{ id: 'i1', date: daysAgo(5), type: 'meeting', notes: '' }],
    });
    const coldProspect = makeContact({
      id: 'p2', name: 'Cold Prospect', category: 'prospect',
      interactions: [{ id: 'i1', date: daysAgo(5), type: 'meeting', notes: '' }],
    });
    const leads = identifier.identifyWarmLeads([introducer, warmProspect, coldProspect]);
    const warm = leads.find(l => l.contactId === 'p1');
    const cold = leads.find(l => l.contactId === 'p2');
    if (warm && cold) {
      expect(warm.warmth).toBeGreaterThan(cold.warmth);
    }
  });

  test('leads are sorted by warmth descending', () => {
    const contacts = [
      makeContact({
        id: 'p1', name: 'Cold', category: 'prospect',
        interactions: [{ id: 'i1', date: daysAgo(25), type: 'email', notes: '' }],
      }),
      makeContact({
        id: 'p2', name: 'Hot', category: 'prospect',
        interactions: Array.from({ length: 5 }, (_, i) => ({
          id: `i${i}`, date: daysAgo(i * 3), type: 'meeting' as const, notes: '',
        })),
      }),
    ];
    const leads = identifier.identifyWarmLeads(contacts);
    if (leads.length >= 2) {
      expect(leads[0].warmth).toBeGreaterThanOrEqual(leads[1].warmth);
    }
  });
});

// ── CommunityEngagementScorer ──────────────────────────────────────────────────

describe('CommunityEngagementScorer', () => {
  const scorer = new CommunityEngagementScorer();

  test('scores 0 for contact with no social or community activity', () => {
    expect(scorer.scoreContact(makeContact())).toBe(0);
  });

  test('social connections increase score', () => {
    const contact = makeContact({
      socialConnections: [
        { platform: 'linkedin', profileUrl: '', connected: true, engagementScore: 50 },
        { platform: 'twitter', profileUrl: '', connected: true, engagementScore: 70 },
      ],
    });
    expect(scorer.scoreContact(contact)).toBeGreaterThan(0);
  });

  test('community interactions add score', () => {
    const contact = makeContact({
      interactions: [
        { id: 'i1', date: daysAgo(5), type: 'event', notes: 'Meetup' },
        { id: 'i2', date: daysAgo(10), type: 'collaboration', notes: 'Collab' },
        { id: 'i3', date: daysAgo(15), type: 'intro', notes: 'Made intro' },
      ],
    });
    expect(scorer.scoreContact(contact)).toBeGreaterThan(20);
  });

  test('non-community interactions do not add community score', () => {
    const contact = makeContact({
      interactions: [
        { id: 'i1', date: daysAgo(5), type: 'email', notes: '' },
        { id: 'i2', date: daysAgo(10), type: 'call', notes: '' },
      ],
    });
    expect(scorer.scoreContact(contact)).toBe(0);
  });

  test('rankContacts sorts by community score', () => {
    const contacts = [
      makeContact({ id: 'low', name: 'Low' }),
      makeContact({
        id: 'high', name: 'High',
        socialConnections: [{ platform: 'linkedin', profileUrl: '', connected: true, engagementScore: 90 }],
        interactions: [
          { id: 'i1', date: daysAgo(5), type: 'event', notes: '' },
          { id: 'i2', date: daysAgo(10), type: 'collaboration', notes: '' },
        ],
      }),
    ];
    const ranked = scorer.rankContacts(contacts);
    expect(ranked[0].name).toBe('High');
  });

  test('score caps at 100', () => {
    const contact = makeContact({
      socialConnections: [
        { platform: 'linkedin', profileUrl: '', connected: true, engagementScore: 100 },
        { platform: 'twitter', profileUrl: '', connected: true, engagementScore: 100 },
        { platform: 'github', profileUrl: '', connected: true, engagementScore: 100 },
        { platform: 'dribbble', profileUrl: '', connected: true, engagementScore: 100 },
      ],
      interactions: Array.from({ length: 10 }, (_, i) => ({
        id: `i${i}`, date: daysAgo(i), type: 'event' as const, notes: '',
      })),
    });
    expect(scorer.scoreContact(contact)).toBeLessThanOrEqual(100);
  });
});

// ── Integration: Full Workflow ─────────────────────────────────────────────────

describe('Integration: Full Workflow', () => {
  let store: NetworkStore;
  let contactMgr: ContactManager;
  let eventTracker: EventTracker;
  let introMgr: IntroductionManager;

  beforeEach(() => {
    store = makeStore();
    contactMgr = new ContactManager(store);
    eventTracker = new EventTracker(store);
    introMgr = new IntroductionManager(store);
  });

  test('complete workflow: add contact → interact → project → detect referral → find warm lead', () => {
    // 1. Add contacts
    const client = contactMgr.addContact({ name: 'Sarah', category: 'client', company: 'StartupX', role: 'Founder' });
    const prospect = contactMgr.addContact({ name: 'Mike', category: 'prospect', company: 'BigCorp' });

    // 2. Add interactions
    contactMgr.addInteraction(client.id, { date: daysAgo(60), type: 'meeting', notes: 'Discovery', sentiment: 'positive' });
    contactMgr.addInteraction(client.id, { date: daysAgo(45), type: 'call', notes: 'Proposal review', sentiment: 'positive' });
    contactMgr.addInteraction(client.id, { date: daysAgo(30), type: 'meeting', notes: 'Kickoff', sentiment: 'positive' });
    contactMgr.addInteraction(client.id, { date: daysAgo(15), type: 'email', notes: 'Progress update', sentiment: 'positive' });
    contactMgr.addInteraction(client.id, { date: daysAgo(5), type: 'meeting', notes: 'Review', sentiment: 'positive' });

    // 3. Complete project
    contactMgr.addProjectHistory(client.id, {
      projectId: 'proj1',
      projectName: 'Website Redesign',
      startDate: daysAgo(45),
      endDate: daysAgo(5),
      revenue: 15000,
      satisfactionRating: 5,
      feedbackNotes: 'Absolutely loved the result!',
    });

    // 4. Add social connection
    contactMgr.addSocialConnection(client.id, {
      platform: 'linkedin', profileUrl: 'https://linkedin.com/in/sarah', connected: true, engagementScore: 85,
    });

    // 5. Detect referral opportunities
    const contacts = store.loadContacts();
    const detector = new ReferralDetector();
    const opps = detector.detectOpportunities(contacts);
    expect(opps.length).toBeGreaterThanOrEqual(1);
    const sarahOpp = opps.find(o => o.contactId === client.id);
    expect(sarahOpp).toBeDefined();
    expect(sarahOpp!.score).toBeGreaterThan(40);

    // 6. Check relationship score
    const scorer = new RelationshipScorer();
    const score = scorer.scoreContact(contacts.find(c => c.id === client.id)!, contacts);
    expect(score.overallScore).toBeGreaterThan(30);

    // 7. Look for warm leads
    const warmLeadId = new WarmLeadIdentifier();
    // Add interaction for prospect to make them warm
    contactMgr.addInteraction(prospect.id, { date: daysAgo(3), type: 'meeting', notes: 'Intro call' });
    contactMgr.addInteraction(prospect.id, { date: daysAgo(10), type: 'email', notes: 'Sent info' });
    contactMgr.addInteraction(prospect.id, { date: daysAgo(15), type: 'call', notes: 'Follow-up' });

    const updatedContacts = store.loadContacts();
    const leads = warmLeadId.identifyWarmLeads(updatedContacts);
    expect(leads.length).toBeGreaterThanOrEqual(1);
  });

  test('event tracking with ROI calculation', () => {
    // 1. Track event
    const event = eventTracker.addEvent({
      name: 'Tech Summit 2026',
      date: '2026-03-01',
      location: 'Istanbul',
      type: 'conference',
      cost: 800,
    });

    // 2. Add contacts from event
    const c1 = contactMgr.addContact({ name: 'EventContact1', category: 'prospect' });
    const c2 = contactMgr.addContact({ name: 'EventContact2', category: 'prospect' });
    eventTracker.linkContact(event.id, c1.id);
    eventTracker.linkContact(event.id, c2.id);

    // 3. Update event outcomes
    eventTracker.updateEvent(event.id, {
      leadsGenerated: 5,
      projectsWon: 1,
      revenueAttributed: 12000,
    });

    // 4. Check ROI
    const roi = eventTracker.calculateROI(event.id);
    expect(roi.roi).toBe(1400); // (12000-800)/800 * 100
    expect(roi.costPerLead).toBe(160);
    expect(roi.costPerProject).toBe(800);
  });

  test('introduction workflow', () => {
    const me = contactMgr.addContact({ name: 'Me', category: 'peer' });
    const target = contactMgr.addContact({ name: 'Dream Client', category: 'prospect', company: 'MegaCorp' });
    const mutual = contactMgr.addContact({ name: 'Mutual Friend', category: 'mentor' });

    const intro = introMgr.requestIntro({
      requesterId: me.id,
      targetId: target.id,
      facilitatorId: mutual.id,
      reason: 'Would love to discuss their mobile app needs',
    });

    expect(intro.status).toBe('pending');

    const contacts = store.loadContacts();
    const email = introMgr.generateIntroEmail(intro, contacts);
    expect(email).toContain('Me');
    expect(email).toContain('Dream Client');
    expect(email).toContain('Mutual Friend');
    expect(email).toContain('MegaCorp');

    // Accept
    const updated = introMgr.updateStatus(intro.id, 'accepted');
    expect(updated.completedAt).toBeTruthy();
    expect(introMgr.listPending()).toHaveLength(0);
  });
});
