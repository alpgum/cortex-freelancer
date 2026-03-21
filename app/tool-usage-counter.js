/* Tool Usage Counter — Cortex Freelancer
   Tracks tool usage counts in localStorage.
   Hooks into dataLayer 'tool_used' events automatically.
   Storage format: { toolName: { count: N, lastUsed: ISO } }
*/
(function() {
  'use strict';
  var STORAGE_KEY = 'cortex_tool_usage';

  function getUsage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function recordUsage(toolName) {
    if (!toolName) return;
    var usage = getUsage();
    if (!usage[toolName]) {
      usage[toolName] = { count: 0, lastUsed: null };
    }
    usage[toolName].count++;
    usage[toolName].lastUsed = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  }

  // Hook into dataLayer.push to capture tool_used events
  var origPush = window.dataLayer && window.dataLayer.push;
  if (window.dataLayer) {
    window.dataLayer.push = function() {
      for (var i = 0; i < arguments.length; i++) {
        var obj = arguments[i];
        if (obj && obj.event === 'tool_used' && obj.tool_name) {
          recordUsage(obj.tool_name);
        }
      }
      return origPush.apply(window.dataLayer, arguments);
    };
  }

  // Expose for dashboard
  window.cortexToolUsage = {
    get: getUsage,
    totalUses: function() {
      var usage = getUsage();
      var total = 0;
      Object.keys(usage).forEach(function(k) { total += usage[k].count; });
      return total;
    },
    estimatedHoursSaved: function() {
      // ~3 minutes saved per tool use on average
      return Math.round(this.totalUses() * 3 / 60 * 10) / 10;
    }
  };
})();
