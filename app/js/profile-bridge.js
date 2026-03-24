/**
 * Profile Bridge — Cortex Freelancer
 * Connects parsed Upwork profile + onboarding goals to all tools.
 * Usage: window.CortexFreelancer.getProfile() / .getGoals()
 */
(function () {
  'use strict';

  var PROFILE_KEY = 'cortexProfile';
  var GOALS_KEY = 'cortexGoals';

  function getProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setProfile(profileData) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
    } catch (e) { /* quota exceeded */ }
  }

  function getGoals() {
    try {
      var raw = localStorage.getItem(GOALS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setGoals(goalsData) {
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify(goalsData));
    } catch (e) { /* quota exceeded */ }
  }

  function hasProfile() {
    return !!getProfile();
  }

  function clearProfile() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(GOALS_KEY);
  }

  function getAnalyzedDate() {
    var p = getProfile();
    return p && p._parsedAt ? new Date(p._parsedAt) : null;
  }

  // Quick accessors for common fields
  function getName() {
    var p = getProfile();
    return (p && p.name) || null;
  }

  function getHourlyRate() {
    var p = getProfile();
    return (p && p.hourlyRate) || null;
  }

  function getSkills() {
    var p = getProfile();
    return (p && p.skills) || [];
  }

  function getTitle() {
    var p = getProfile();
    return (p && p.title) || null;
  }

  function getCountry() {
    var p = getProfile();
    return (p && p.country) || null;
  }

  // ── Expose globally ──
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.getProfile = getProfile;
  window.CortexFreelancer.setProfile = setProfile;
  window.CortexFreelancer.getGoals = getGoals;
  window.CortexFreelancer.setGoals = setGoals;
  window.CortexFreelancer.hasProfile = hasProfile;
  window.CortexFreelancer.clearProfile = clearProfile;
  window.CortexFreelancer.getAnalyzedDate = getAnalyzedDate;
  window.CortexFreelancer.getName = getName;
  window.CortexFreelancer.getHourlyRate = getHourlyRate;
  window.CortexFreelancer.getSkills = getSkills;
  window.CortexFreelancer.getTitle = getTitle;
  window.CortexFreelancer.getCountry = getCountry;
})();
