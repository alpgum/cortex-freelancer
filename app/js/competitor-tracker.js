/**
 * [CF-062] Competitor Tracker
 * Track competitor profiles, get alerts when they change rates, skills,
 * or availability.
 *
 * Persists to localStorage key: 'cortex_competitor_profiles'
 * Exposed on window.CortexFreelancer.competitorTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_competitor_profiles';

  // ─── Persistence helpers ────────────────────────────────────────────

  /**
   * Load all competitor data from localStorage.
   * @returns {{ competitors: Object.<string, Object>, changeLog: Array }}
   */
  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted data, reset */ }
    return { competitors: {}, changeLog: [] };
  }

  /**
   * Save data to localStorage.
   * @param {Object} data
   */
  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[CompetitorTracker] localStorage write failed:', e);
    }
  }

  /**
   * Generate a simple unique id.
   * @returns {string}
   */
  function _generateId() {
    return 'comp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  // ─── Core Functions ─────────────────────────────────────────────────

  /**
   * Add a competitor to track.
   * @param {{ name: string, url?: string, rate?: number, skills?: string[], jss?: number, availability?: string }} profile
   * @returns {{ id: string, competitor: Object }}
   */
  function addCompetitor(profile) {
    if (!profile || !profile.name) {
      throw new Error('Competitor name is required');
    }

    var data = _load();
    var id = _generateId();
    var now = new Date().toISOString();

    var competitor = {
      id: id,
      name: profile.name,
      url: profile.url || '',
      rate: profile.rate || null,
      skills: profile.skills || [],
      jss: profile.jss || null,
      availability: profile.availability || 'unknown',
      createdAt: now,
      updatedAt: now,
      history: [
        {
          timestamp: now,
          type: 'created',
          snapshot: {
            rate: profile.rate || null,
            skills: (profile.skills || []).slice(),
            jss: profile.jss || null,
            availability: profile.availability || 'unknown'
          }
        }
      ]
    };

    data.competitors[id] = competitor;
    _save(data);

    return { id: id, competitor: competitor };
  }

  /**
   * Update a competitor's data. Records changes in history.
   * @param {string} id
   * @param {Object} newData - Fields to update (rate, skills, jss, availability, name, url)
   * @returns {Object|null} Updated competitor, or null if not found
   */
  function updateCompetitor(id, newData) {
    if (!id || !newData) return null;

    var data = _load();
    var comp = data.competitors[id];
    if (!comp) return null;

    var now = new Date().toISOString();
    var changes = [];
    var trackFields = ['rate', 'skills', 'jss', 'availability'];

    trackFields.forEach(function (field) {
      if (newData[field] === undefined) return;

      var oldVal = comp[field];
      var newVal = newData[field];

      // Deep compare for arrays
      var changed = false;
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        changed = oldVal.length !== newVal.length ||
                  oldVal.some(function (v, i) { return v !== newVal[i]; });
      } else {
        changed = oldVal !== newVal;
      }

      if (changed) {
        changes.push({
          field: field,
          oldValue: Array.isArray(oldVal) ? oldVal.slice() : oldVal,
          newValue: Array.isArray(newVal) ? newVal.slice() : newVal
        });
      }
    });

    // Apply all updates (including non-tracked fields like name, url)
    Object.keys(newData).forEach(function (key) {
      comp[key] = newData[key];
    });
    comp.updatedAt = now;

    if (changes.length > 0) {
      var historyEntry = {
        timestamp: now,
        type: 'updated',
        changes: changes,
        snapshot: {
          rate: comp.rate,
          skills: (comp.skills || []).slice(),
          jss: comp.jss,
          availability: comp.availability
        }
      };
      comp.history.push(historyEntry);

      // Also log to global change log
      data.changeLog.push({
        competitorId: id,
        competitorName: comp.name,
        timestamp: now,
        changes: changes
      });
    }

    data.competitors[id] = comp;
    _save(data);

    return comp;
  }

  /**
   * Get all tracked competitors.
   * @returns {Array<Object>}
   */
  function getCompetitors() {
    var data = _load();
    return Object.keys(data.competitors).map(function (id) {
      return data.competitors[id];
    });
  }

  /**
   * Get change history for a specific competitor.
   * @param {string} competitorId
   * @returns {Array<Object>} History entries with timestamps and changes
   */
  function getChanges(competitorId) {
    var data = _load();
    var comp = data.competitors[competitorId];
    if (!comp) return [];
    return comp.history || [];
  }

  /**
   * Remove a competitor from tracking.
   * @param {string} id
   * @returns {boolean} True if removed, false if not found
   */
  function removeCompetitor(id) {
    var data = _load();
    if (!data.competitors[id]) return false;
    delete data.competitors[id];
    // Also clean up change log entries
    data.changeLog = data.changeLog.filter(function (entry) {
      return entry.competitorId !== id;
    });
    _save(data);
    return true;
  }

  /**
   * Compare a competitor list against the user's own profile.
   * @param {{ rate?: number, skills?: string[], jss?: number }} userProfile
   * @returns {Array<{ competitor: Object, rateDifference: number, rateLabel: string, skillOverlap: string[], skillsOnlyCompetitor: string[], skillsOnlyUser: string[], jssGap: number, jssLabel: string, threatLevel: string }>}
   */
  function compareWithUser(userProfile) {
    if (!userProfile) return [];

    var competitors = getCompetitors();
    var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase(); });
    var userRate = userProfile.rate || 0;
    var userJSS = userProfile.jss || 0;

    return competitors.map(function (comp) {
      var compSkills = (comp.skills || []).map(function (s) { return s.toLowerCase(); });

      // Skill overlap
      var overlap = userSkills.filter(function (s) {
        return compSkills.indexOf(s) !== -1;
      });
      var onlyCompetitor = compSkills.filter(function (s) {
        return userSkills.indexOf(s) === -1;
      });
      var onlyUser = userSkills.filter(function (s) {
        return compSkills.indexOf(s) === -1;
      });

      // Rate difference
      var compRate = comp.rate || 0;
      var rateDiff = userRate - compRate;
      var rateLabel = rateDiff > 5 ? 'You charge more'
                    : rateDiff < -5 ? 'They charge more'
                    : 'Similar rates';

      // JSS gap
      var compJSS = comp.jss || 0;
      var jssGap = userJSS - compJSS;
      var jssLabel = jssGap > 5 ? 'Your JSS is higher'
                   : jssGap < -5 ? 'Their JSS is higher'
                   : 'Similar JSS';

      // Threat level
      var threatScore = 0;
      if (compRate < userRate && compRate > 0) threatScore++;
      if (compJSS > userJSS) threatScore++;
      if (overlap.length > userSkills.length * 0.5) threatScore++;
      var threatLevel = threatScore >= 2 ? 'high'
                      : threatScore === 1 ? 'medium'
                      : 'low';

      return {
        competitor: comp,
        rateDifference: rateDiff,
        rateLabel: rateLabel,
        skillOverlap: overlap,
        skillsOnlyCompetitor: onlyCompetitor,
        skillsOnlyUser: onlyUser,
        jssGap: jssGap,
        jssLabel: jssLabel,
        threatLevel: threatLevel
      };
    });
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.competitorTracker = {
    addCompetitor: addCompetitor,
    updateCompetitor: updateCompetitor,
    getCompetitors: getCompetitors,
    compareWithUser: compareWithUser,
    getChanges: getChanges,
    removeCompetitor: removeCompetitor
  };
})();
