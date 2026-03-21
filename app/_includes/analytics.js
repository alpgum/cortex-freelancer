/**
 * Cortex Freelancer — Privacy-friendly analytics
 * No cookies, no fingerprinting, no PII.
 * Sends page views and tool usage events to /api/track.
 */
(function() {
  'use strict';

  var ENDPOINT = '/api/track';

  function send(event, props) {
    var payload = {
      event: event,
      url: location.pathname,
      referrer: document.referrer || null,
      screen: screen.width + 'x' + screen.height,
      timestamp: new Date().toISOString()
    };
    if (props) {
      for (var k in props) {
        if (props.hasOwnProperty(k)) payload[k] = props[k];
      }
    }
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  // Track page view on load
  send('pageview');

  // Public API for tool usage tracking
  window.CortexTrack = {
    event: function(name, props) {
      send(name, props);
    },
    toolUse: function(toolName, action) {
      send('tool_use', { tool: toolName, action: action || 'open' });
    }
  };
})();
