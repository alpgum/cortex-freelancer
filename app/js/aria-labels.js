/**
 * CF-291: ARIA Labels Auto-Patching System
 * Scans DOM and auto-adds missing aria-label/aria-labelledby to buttons,
 * inputs, icons, and dynamic regions. Includes audit and fix helpers.
 *
 * @namespace window.CortexFreelancer.AriaLabels
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var observer = null;

  function getAccessibleName(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.getAttribute('aria-labelledby')) {
      var ref = document.getElementById(el.getAttribute('aria-labelledby'));
      if (ref) return ref.textContent.trim();
    }
    if (el.getAttribute('alt')) return el.getAttribute('alt');
    if (el.getAttribute('title')) return el.getAttribute('title');
    return (el.textContent || '').trim();
  }

  function isIconOnly(el) {
    var text = (el.textContent || '').trim();
    if (text.length > 0 && text.length < 3) return false;
    if (text.length === 0) {
      var hasIcon = el.querySelector('svg,i,[class*="icon"],img');
      return !!hasIcon;
    }
    return false;
  }

  function auditAria(root) {
    root = root || document.body;
    var report = {
      buttons: [],
      inputs: [],
      icons: [],
      images: [],
      regions: [],
      total: 0
    };

    // Buttons without accessible names
    var buttons = root.querySelectorAll('button,[role="button"],a[role="button"]');
    Array.prototype.forEach.call(buttons, function (btn) {
      if (!getAccessibleName(btn)) {
        report.buttons.push(btn);
      }
    });

    // Inputs without labels
    var inputs = root.querySelectorAll('input,select,textarea');
    Array.prototype.forEach.call(inputs, function (inp) {
      if (inp.type === 'hidden') return;
      var hasLabel = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
      if (!hasLabel) {
        var id = inp.id;
        if (id) {
          var label = root.querySelector('label[for="' + id + '"]');
          if (label) return;
        }
        var parentLabel = inp.closest('label');
        if (parentLabel) return;
        report.inputs.push(inp);
      }
    });

    // Icon-only elements
    var iconEls = root.querySelectorAll('i[class*="icon"],span[class*="icon"],svg:not([aria-hidden])');
    Array.prototype.forEach.call(iconEls, function (icon) {
      if (!icon.getAttribute('aria-label') && !icon.getAttribute('aria-hidden')) {
        report.icons.push(icon);
      }
    });

    // Images without alt
    var images = root.querySelectorAll('img');
    Array.prototype.forEach.call(images, function (img) {
      if (!img.hasAttribute('alt')) {
        report.images.push(img);
      }
    });

    // Dynamic regions without aria-live
    var dynamics = root.querySelectorAll('.live-region,.dynamic-content,.toast-container,[data-dynamic]');
    Array.prototype.forEach.call(dynamics, function (region) {
      if (!region.getAttribute('aria-live') && !region.getAttribute('role')) {
        report.regions.push(region);
      }
    });

    report.total = report.buttons.length + report.inputs.length +
      report.icons.length + report.images.length + report.regions.length;

    return report;
  }

  function fixAria(root) {
    root = root || document.body;
    var fixed = 0;

    // Fix buttons
    var buttons = root.querySelectorAll('button,[role="button"]');
    Array.prototype.forEach.call(buttons, function (btn) {
      if (getAccessibleName(btn)) return;
      // Try title
      if (btn.getAttribute('title')) {
        btn.setAttribute('aria-label', btn.getAttribute('title'));
        fixed++;
        return;
      }
      // Try icon class
      var icon = btn.querySelector('i[class*="icon"],svg');
      if (icon) {
        var cls = icon.className || '';
        if (typeof cls === 'string') {
          var match = cls.match(/icon[-_](\w+)/);
          if (match) {
            btn.setAttribute('aria-label', match[1].replace(/[-_]/g, ' '));
            fixed++;
            return;
          }
        }
      }
      // Fallback: mark with generic label
      if (!btn.textContent.trim()) {
        btn.setAttribute('aria-label', 'Button');
        fixed++;
      }
    });

    // Fix inputs
    var inputs = root.querySelectorAll('input,select,textarea');
    Array.prototype.forEach.call(inputs, function (inp) {
      if (inp.type === 'hidden') return;
      if (inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby')) return;
      if (inp.id) {
        var label = root.querySelector('label[for="' + inp.id + '"]');
        if (label) {
          if (!label.id) label.id = 'label-' + inp.id;
          inp.setAttribute('aria-labelledby', label.id);
          fixed++;
          return;
        }
      }
      if (inp.closest('label')) return;
      var name = inp.getAttribute('placeholder') || inp.getAttribute('name') || inp.type;
      if (name) {
        inp.setAttribute('aria-label', name.replace(/[-_]/g, ' '));
        fixed++;
      }
    });

    // Fix icons
    var icons = root.querySelectorAll('i[class*="icon"],span[class*="icon"]');
    Array.prototype.forEach.call(icons, function (icon) {
      if (icon.getAttribute('aria-hidden') || icon.getAttribute('aria-label')) return;
      // If inside a button that has text, just hide the icon
      var parent = icon.closest('button,[role="button"],a');
      if (parent && parent.textContent.trim().length > 1) {
        icon.setAttribute('aria-hidden', 'true');
      } else {
        icon.setAttribute('role', 'img');
        var cls = icon.className || '';
        var match = cls.match(/icon[-_](\w+)/);
        icon.setAttribute('aria-label', match ? match[1].replace(/[-_]/g, ' ') : 'icon');
      }
      fixed++;
    });

    // Fix standalone SVGs
    var svgs = root.querySelectorAll('svg:not([aria-hidden])');
    Array.prototype.forEach.call(svgs, function (svg) {
      var parent = svg.closest('button,[role="button"],a');
      if (parent) {
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
      }
      fixed++;
    });

    // Fix images
    var images = root.querySelectorAll('img:not([alt])');
    Array.prototype.forEach.call(images, function (img) {
      var src = img.getAttribute('src') || '';
      var filename = src.split('/').pop().split('.')[0] || '';
      img.setAttribute('alt', filename.replace(/[-_]/g, ' ') || '');
      fixed++;
    });

    // Fix dynamic regions
    var dynamics = root.querySelectorAll('.live-region,.dynamic-content,.toast-container,[data-dynamic]');
    Array.prototype.forEach.call(dynamics, function (region) {
      if (!region.getAttribute('aria-live')) {
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('role', 'status');
        fixed++;
      }
    });

    return fixed;
  }

  function startObserver() {
    if (observer) return;
    var debounceTimer = null;
    observer = new MutationObserver(function (mutations) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        mutations.forEach(function (mutation) {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (node.nodeType === 1) fixAria(node);
          });
        });
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  window.CortexFreelancer.AriaLabels = {
    auditAria: auditAria,
    fixAria: fixAria,
    startObserver: startObserver,
    stopObserver: stopObserver
  };
})();
