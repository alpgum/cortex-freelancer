/**
 * CF-253: Freelancer of the Week community feature
 * Weekly spotlight nomination/selection, profile card generator, social share templates, in-app showcase.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_spotlight';

  function FreelancerSpotlight() {
    this.nominations = this._load('nominations') || [];
    this.spotlights = this._load('spotlights') || [];
  }

  /* ---------- persistence ---------- */

  FreelancerSpotlight.prototype._load = function (key) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY + '_' + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  FreelancerSpotlight.prototype._save = function (key, data) {
    localStorage.setItem(STORAGE_KEY + '_' + key, JSON.stringify(data));
  };

  /* ---------- nomination ---------- */

  FreelancerSpotlight.prototype.nominate = function (params) {
    if (!params.nomineeId || !params.nominatorId || !params.reason) {
      return { success: false, error: 'nomineeId, nominatorId, and reason are required' };
    }

    var duplicate = this.nominations.find(function (n) {
      return n.nomineeId === params.nomineeId && n.nominatorId === params.nominatorId && n.weekId === currentWeekId();
    });
    if (duplicate) {
      return { success: false, error: 'You already nominated this freelancer this week' };
    }

    var nomination = {
      id: 'nom_' + Date.now(),
      nomineeId: params.nomineeId,
      nomineeName: params.nomineeName || 'Unknown',
      nominatorId: params.nominatorId,
      reason: params.reason,
      weekId: currentWeekId(),
      createdAt: new Date().toISOString(),
      votes: 1
    };

    this.nominations.push(nomination);
    this._save('nominations', this.nominations);
    return { success: true, nomination: nomination };
  };

  FreelancerSpotlight.prototype.vote = function (nominationId) {
    var nom = this.nominations.find(function (n) { return n.id === nominationId; });
    if (!nom) return { success: false, error: 'Nomination not found' };
    nom.votes += 1;
    this._save('nominations', this.nominations);
    return { success: true, votes: nom.votes };
  };

  /* ---------- selection ---------- */

  FreelancerSpotlight.prototype.selectWinner = function (weekId) {
    weekId = weekId || currentWeekId();
    var weekNominations = this.nominations.filter(function (n) { return n.weekId === weekId; });
    if (weekNominations.length === 0) return { success: false, error: 'No nominations for this week' };

    weekNominations.sort(function (a, b) { return b.votes - a.votes; });
    var winner = weekNominations[0];

    var spotlight = {
      id: 'spot_' + Date.now(),
      weekId: weekId,
      nomineeId: winner.nomineeId,
      nomineeName: winner.nomineeName,
      reason: winner.reason,
      votes: winner.votes,
      selectedAt: new Date().toISOString()
    };

    this.spotlights.push(spotlight);
    this._save('spotlights', this.spotlights);
    return { success: true, spotlight: spotlight };
  };

  FreelancerSpotlight.prototype.getCurrentSpotlight = function () {
    if (this.spotlights.length === 0) return null;
    return this.spotlights[this.spotlights.length - 1];
  };

  FreelancerSpotlight.prototype.getSpotlightHistory = function () {
    return this.spotlights.slice().reverse();
  };

  /* ---------- profile card generator ---------- */

  FreelancerSpotlight.prototype.generateProfileCard = function (spotlight) {
    if (!spotlight) spotlight = this.getCurrentSpotlight();
    if (!spotlight) return '';

    return '<div class="spotlight-card" style="border:2px solid #ffd700;border-radius:12px;padding:24px;max-width:400px;text-align:center;background:linear-gradient(135deg,#fff9e6,#fff);">' +
      '<div style="font-size:32px;">&#127942;</div>' +
      '<h3 style="margin:8px 0 4px;">Freelancer of the Week</h3>' +
      '<p style="color:#888;font-size:12px;">Week of ' + spotlight.weekId + '</p>' +
      '<h2 style="margin:12px 0;">' + escapeHtml(spotlight.nomineeName) + '</h2>' +
      '<p style="font-style:italic;">"' + escapeHtml(spotlight.reason) + '"</p>' +
      '<p style="color:#888;">' + spotlight.votes + ' community votes</p>' +
    '</div>';
  };

  /* ---------- social media share templates ---------- */

  FreelancerSpotlight.prototype.getShareTemplates = function (spotlight) {
    if (!spotlight) spotlight = this.getCurrentSpotlight();
    if (!spotlight) return null;

    var name = spotlight.nomineeName;
    var url = 'https://cortexfreelancer.com/spotlight/' + spotlight.id;

    return {
      twitter: 'Congrats to ' + name + ' — Cortex Freelancer of the Week! ' + url + ' #FreelancerSpotlight #Upwork',
      linkedin: 'Proud to highlight ' + name + ' as this week\'s Freelancer of the Week on Cortex Freelancer! Their dedication and expertise continue to inspire our community. Check out their profile: ' + url,
      facebook: name + ' has been selected as Cortex Freelancer of the Week! Join our community and get recognized for your amazing work. ' + url,
      email: {
        subject: name + ' is Cortex Freelancer of the Week!',
        body: 'Hi,\n\nWe\'re excited to announce that ' + name + ' has been selected as this week\'s Freelancer of the Week on Cortex Freelancer.\n\nReason: ' + spotlight.reason + '\n\nCheck it out: ' + url + '\n\nBest,\nThe Cortex Freelancer Team'
      }
    };
  };

  /* ---------- in-app showcase section ---------- */

  FreelancerSpotlight.prototype.renderShowcase = function (limit) {
    limit = limit || 4;
    var history = this.getSpotlightHistory().slice(0, limit);
    if (history.length === 0) return '<p>No spotlights yet. Nominate a freelancer today!</p>';

    var self = this;
    var cards = history.map(function (s) { return self.generateProfileCard(s); }).join('');
    return '<section class="spotlight-showcase">' +
      '<h2>Freelancer Spotlights</h2>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;">' + cards + '</div>' +
    '</section>';
  };

  /* ---------- helpers ---------- */

  function currentWeekId() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 1);
    var week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
    return now.getFullYear() + '-W' + (week < 10 ? '0' : '') + week;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.FreelancerSpotlight = FreelancerSpotlight;
})();
