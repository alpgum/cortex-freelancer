/**
 * CF-253: Freelancer of the Week community feature
 * Weekly spotlight selection, display component, social media share data.
 */
(function () {
  'use strict';

  var API_BASE = '/api/freelancer-of-week';

  /**
   * Get the current Freelancer of the Week.
   * @returns {Promise<{ userId: string, name: string, title: string, bio: string, avatar: string, skills: string[], weekOf: string, stats: object }|null>}
   */
  async function getCurrent() {
    try {
      var res = await fetch(API_BASE + '/current');
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }
    return null;
  }

  /**
   * Get past spotlights.
   * @param {number} [limit=10]
   * @returns {Promise<Array>}
   */
  async function getArchive(limit) {
    try {
      var res = await fetch(API_BASE + '/archive?limit=' + (limit || 10));
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }
    return [];
  }

  /**
   * Nominate a freelancer for spotlight.
   * @param {object} params
   * @param {string} params.nominatorId
   * @param {string} params.nomineeId
   * @param {string} [params.reason]
   * @returns {Promise<{ success: boolean }>}
   */
  async function nominate(params) {
    if (!params.nominatorId || !params.nomineeId) throw new Error('nominatorId and nomineeId are required');

    try {
      var res = await fetch(API_BASE + '/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nominatorId: params.nominatorId,
          nomineeId: params.nomineeId,
          reason: params.reason || ''
        })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { success: false };
  }

  /**
   * Select this week's spotlight (admin).
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.featuredQuote
   * @returns {Promise<{ success: boolean, weekOf: string }>}
   */
  async function selectSpotlight(params) {
    if (!params.userId) throw new Error('userId is required');

    try {
      var res = await fetch(API_BASE + '/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { success: false, weekOf: '' };
  }

  /**
   * Build the display component data for embedding in the UI.
   * @param {object} spotlight - Spotlight data from getCurrent()
   * @returns {object} Component render data
   */
  function buildDisplayData(spotlight) {
    if (!spotlight) {
      return { empty: true, message: 'No spotlight this week — check back soon!' };
    }

    return {
      empty: false,
      heading: 'Freelancer of the Week',
      name: spotlight.name,
      title: spotlight.title || 'Freelancer',
      bio: spotlight.bio || '',
      avatar: spotlight.avatar || '/img/default-avatar.png',
      skills: (spotlight.skills || []).slice(0, 5),
      weekOf: spotlight.weekOf,
      badgeLabel: 'Featured Freelancer'
    };
  }

  /**
   * Generate social media share data for the spotlight.
   * @param {object} spotlight
   * @returns {{ twitter: { text: string, url: string }, linkedin: { title: string, summary: string, url: string }, og: object }}
   */
  function buildShareData(spotlight) {
    if (!spotlight) return null;

    var pageUrl = window.location.origin + '/community/freelancer-of-the-week';
    var tweetText = 'Congrats to ' + spotlight.name + ' — Cortex Freelancer of the Week! ' +
      (spotlight.skills || []).slice(0, 3).map(function (s) { return '#' + s.replace(/\s+/g, ''); }).join(' ');

    return {
      twitter: {
        text: tweetText,
        url: pageUrl
      },
      linkedin: {
        title: 'Freelancer of the Week: ' + spotlight.name,
        summary: (spotlight.name) + ' has been recognized as Cortex Freelancer of the Week for outstanding work in ' +
          (spotlight.skills || ['freelancing']).slice(0, 2).join(' and ') + '.',
        url: pageUrl
      },
      og: {
        title: 'Freelancer of the Week: ' + spotlight.name,
        description: spotlight.bio || spotlight.name + ' is this week\'s featured freelancer on Cortex.',
        image: spotlight.avatar || '/img/default-avatar.png',
        url: pageUrl
      }
    };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.FreelancerOfWeek = {
    getCurrent: getCurrent,
    getArchive: getArchive,
    nominate: nominate,
    selectSpotlight: selectSpotlight,
    buildDisplayData: buildDisplayData,
    buildShareData: buildShareData
  };
})();
