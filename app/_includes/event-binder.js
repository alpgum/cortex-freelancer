// ===== CF-083: Inline Event Handler Migration =====
// Automatically migrates inline event handlers (onclick, onsubmit, onchange, etc.)
// to addEventListener calls. Include this script at the end of <body>.
// This allows future CSP tightening to remove 'unsafe-inline' for scripts.

(function() {
  'use strict';

  var EVENTS = ['click', 'submit', 'change', 'mouseover', 'mouseout', 'focus', 'blur', 'input', 'keydown', 'keyup', 'keypress'];

  function migrateInlineHandlers() {
    EVENTS.forEach(function(eventName) {
      var attrName = 'on' + eventName;
      var elements = document.querySelectorAll('[' + attrName + ']');
      elements.forEach(function(el) {
        var handlerCode = el.getAttribute(attrName);
        if (!handlerCode) return;

        // Remove the inline attribute
        el.removeAttribute(attrName);

        // Create a function from the handler code and attach via addEventListener
        try {
          var fn = new Function('event', handlerCode);
          el.addEventListener(eventName, fn);
        } catch (err) {
          console.warn('[event-binder] Failed to migrate handler:', attrName, handlerCode, err);
        }
      });
    });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', migrateInlineHandlers);
  } else {
    migrateInlineHandlers();
  }

  // Also observe for dynamically added elements with inline handlers
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function(mutations) {
      var needsMigration = false;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              EVENTS.forEach(function(eventName) {
                if (node.hasAttribute && node.hasAttribute('on' + eventName)) {
                  needsMigration = true;
                }
                // Check children too
                if (node.querySelectorAll) {
                  var children = node.querySelectorAll('[on' + eventName + ']');
                  if (children.length > 0) needsMigration = true;
                }
              });
            }
          });
        }
      });
      if (needsMigration) migrateInlineHandlers();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }
})();
