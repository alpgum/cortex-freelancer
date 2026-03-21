/* ===== FEATURE FLAGS ===== */
/* [245] Client-side feature flag system */

(function() {
  'use strict';

  var flags = {};
  var loaded = false;

  function loadFlags() {
    if (loaded) return Promise.resolve(flags);

    return fetch('/config/feature-flags.json')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        flags = data || {};
        loaded = true;
        return flags;
      })
      .catch(function() {
        flags = {};
        loaded = true;
        return flags;
      });
  }

  function isEnabled(flagName) {
    if (!loaded) return false;
    var flag = flags[flagName];
    if (!flag) return false;
    if (typeof flag === 'boolean') return flag;
    if (typeof flag === 'object') return flag.enabled === true;
    return false;
  }

  function getFlag(flagName) {
    if (!loaded) return null;
    return flags[flagName] || null;
  }

  // Load on init
  loadFlags();

  window.CortexFlags = {
    isEnabled: isEnabled,
    getFlag: getFlag,
    loadFlags: loadFlags,
    getAllFlags: function() { return Object.assign({}, flags); }
  };
})();
