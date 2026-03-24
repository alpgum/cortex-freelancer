/**
 * CortexFreelancer Profile Bridge
 * Single source of truth for profile + goals.
 * Storage:
 *  - localStorage.cortexProfile (JSON)
 *  - localStorage.cortexGoals (JSON)
 */
(function(){
  'use strict';

  var g = window;
  g.CortexFreelancer = g.CortexFreelancer || {};

  var KEY_PROFILE = 'cortexProfile';
  var KEY_GOALS = 'cortexGoals';

  function safeJsonParse(s){
    try { return JSON.parse(s); } catch(e) { return null; }
  }

  function migrate(){
    // Legacy globals from earlier iterations
    var legacy = g._cachedUpworkProfile || g.cachedUpworkProfile || g.lastProfileData || null;
    if (legacy && !localStorage.getItem(KEY_PROFILE)) {
      try { localStorage.setItem(KEY_PROFILE, JSON.stringify(legacy)); } catch(e) {}
    }
  }

  function getProfile(){
    migrate();
    var raw = localStorage.getItem(KEY_PROFILE);
    return raw ? safeJsonParse(raw) : null;
  }

  function setProfile(profile){
    if (!profile) { localStorage.removeItem(KEY_PROFILE); return; }
    localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
  }

  function getGoals(){
    var raw = localStorage.getItem(KEY_GOALS);
    return raw ? safeJsonParse(raw) : null;
  }

  function setGoals(goals){
    if (!goals) { localStorage.removeItem(KEY_GOALS); return; }
    localStorage.setItem(KEY_GOALS, JSON.stringify(goals));
  }

  g.CortexFreelancer.getProfile = getProfile;
  g.CortexFreelancer.setProfile = setProfile;
  g.CortexFreelancer.getGoals = getGoals;
  g.CortexFreelancer.setGoals = setGoals;
})();
