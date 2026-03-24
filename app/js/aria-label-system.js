/**
 * CF-291 ARIA Label System
 * Audits and applies proper ARIA attributes to all interactive elements:
 * buttons, inputs, links, and dynamic content regions.
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  /**
   * @typedef {Object} AriaRule
   * @property {string} selector - CSS selector to match elements
   * @property {function(HTMLElement): boolean} needsFix - Whether the element needs ARIA remediation
   * @property {function(HTMLElement): void} fix - Apply the appropriate ARIA attribute
   * @property {string} description - Human-readable description of what this rule does
   */

  /** @type {AriaRule[]} */
  const RULES = [
    {
      selector: 'button:not([aria-label]):not([aria-labelledby])',
      description: 'Buttons without accessible names',
      needsFix(el) {
        return !el.textContent.trim() && !el.getAttribute('aria-label');
      },
      fix(el) {
        const title = el.getAttribute('title');
        const icon = el.querySelector('svg, i, img');
        if (title) {
          el.setAttribute('aria-label', title);
        } else if (icon) {
          const cls = icon.getAttribute('class') || '';
          const name = cls.replace(/.*icon[-_]?/i, '').replace(/[-_]/g, ' ').trim();
          el.setAttribute('aria-label', name || 'Action button');
        } else {
          el.setAttribute('aria-label', 'Button');
        }
      }
    },
    {
      selector: 'input:not([aria-label]):not([aria-labelledby]):not([id])',
      description: 'Inputs without associated labels',
      needsFix(el) {
        if (el.type === 'hidden') return false;
        const id = el.getAttribute('id');
        if (id && document.querySelector(`label[for="${id}"]`)) return false;
        if (el.closest('label')) return false;
        return !el.getAttribute('aria-label');
      },
      fix(el) {
        const placeholder = el.getAttribute('placeholder');
        const name = el.getAttribute('name');
        const label = placeholder || (name ? name.replace(/[-_]/g, ' ') : el.type || 'Input');
        el.setAttribute('aria-label', label);
      }
    },
    {
      selector: 'select:not([aria-label]):not([aria-labelledby])',
      description: 'Select elements without accessible names',
      needsFix(el) {
        const id = el.getAttribute('id');
        if (id && document.querySelector(`label[for="${id}"]`)) return false;
        if (el.closest('label')) return false;
        return !el.getAttribute('aria-label');
      },
      fix(el) {
        const name = el.getAttribute('name');
        el.setAttribute('aria-label', name ? name.replace(/[-_]/g, ' ') : 'Selection');
      }
    },
    {
      selector: 'textarea:not([aria-label]):not([aria-labelledby])',
      description: 'Textareas without accessible names',
      needsFix(el) {
        const id = el.getAttribute('id');
        if (id && document.querySelector(`label[for="${id}"]`)) return false;
        if (el.closest('label')) return false;
        return !el.getAttribute('aria-label');
      },
      fix(el) {
        const placeholder = el.getAttribute('placeholder');
        const name = el.getAttribute('name');
        el.setAttribute('aria-label', placeholder || (name ? name.replace(/[-_]/g, ' ') : 'Text input'));
      }
    },
    {
      selector: 'a:not([aria-label])',
      description: 'Links without descriptive text',
      needsFix(el) {
        return !el.textContent.trim() && !el.getAttribute('aria-label');
      },
      fix(el) {
        const title = el.getAttribute('title');
        const href = el.getAttribute('href') || '';
        if (title) {
          el.setAttribute('aria-label', title);
        } else if (href && href !== '#') {
          const segment = href.split('/').filter(Boolean).pop() || 'link';
          el.setAttribute('aria-label', segment.replace(/[-_]/g, ' '));
        } else {
          el.setAttribute('aria-label', 'Link');
        }
      }
    },
    {
      selector: 'img:not([alt])',
      description: 'Images without alt text',
      needsFix(el) {
        return !el.hasAttribute('alt');
      },
      fix(el) {
        const src = el.getAttribute('src') || '';
        const filename = src.split('/').pop().split('.')[0] || '';
        const isDecorative = el.getAttribute('role') === 'presentation' ||
          el.closest('[aria-hidden="true"]');
        if (isDecorative) {
          el.setAttribute('alt', '');
          el.setAttribute('role', 'presentation');
        } else {
          el.setAttribute('alt', filename.replace(/[-_]/g, ' ') || 'Image');
        }
      }
    },
    {
      selector: '[role="dialog"]:not([aria-label]):not([aria-labelledby])',
      description: 'Dialogs without accessible names',
      needsFix(el) {
        return !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby');
      },
      fix(el) {
        const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
          if (!heading.id) heading.id = 'dialog-title-' + Math.random().toString(36).slice(2, 8);
          el.setAttribute('aria-labelledby', heading.id);
        } else {
          el.setAttribute('aria-label', 'Dialog');
        }
      }
    },
    {
      selector: '[role="tablist"]',
      description: 'Tab lists needing proper tab roles',
      needsFix(el) {
        const tabs = el.querySelectorAll('[role="tab"]');
        return Array.from(tabs).some(t => !t.hasAttribute('aria-selected'));
      },
      fix(el) {
        const tabs = el.querySelectorAll('[role="tab"]');
        tabs.forEach(tab => {
          if (!tab.hasAttribute('aria-selected')) {
            tab.setAttribute('aria-selected', 'false');
          }
          if (!tab.hasAttribute('tabindex')) {
            tab.setAttribute('tabindex', tab.getAttribute('aria-selected') === 'true' ? '0' : '-1');
          }
        });
      }
    },
    {
      selector: '[onclick]:not(button):not(a):not([role])',
      description: 'Clickable non-interactive elements missing role',
      needsFix(el) {
        return !el.getAttribute('role');
      },
      fix(el) {
        el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.getAttribute('aria-label') && !el.textContent.trim()) {
          el.setAttribute('aria-label', 'Interactive element');
        }
      }
    }
  ];

  /**
   * Run all ARIA rules against the DOM, optionally within a root element.
   * @param {HTMLElement} [root=document] - Root element to audit
   * @param {Object} [options]
   * @param {boolean} [options.dryRun=false] - If true, return issues without fixing
   * @returns {{ fixed: number, issues: Array<{element: HTMLElement, rule: string}> }}
   */
  function audit(root, options) {
    root = root || document;
    const opts = options || {};
    const issues = [];
    let fixed = 0;

    RULES.forEach(function(rule) {
      const elements = root.querySelectorAll(rule.selector);
      elements.forEach(function(el) {
        if (rule.needsFix(el)) {
          issues.push({ element: el, rule: rule.description });
          if (!opts.dryRun) {
            rule.fix(el);
            fixed++;
          }
        }
      });
    });

    return { fixed: fixed, issues: issues };
  }

  /**
   * Observe DOM mutations and auto-apply ARIA fixes to new elements.
   * @param {HTMLElement} [root=document.body]
   * @returns {{ disconnect: function(): void }}
   */
  function observe(root) {
    root = root || document.body;
    var observer = new MutationObserver(function(mutations) {
      var needsAudit = mutations.some(function(m) {
        return m.addedNodes.length > 0 || m.type === 'attributes';
      });
      if (needsAudit) audit(root);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'onclick']
    });

    return { disconnect: function() { observer.disconnect(); } };
  }

  /**
   * Initialize: run initial audit and start observing.
   * @param {Object} [options]
   * @param {boolean} [options.autoObserve=true] - Whether to watch for DOM changes
   * @returns {{ fixed: number, issues: Array, observer: Object|null }}
   */
  function init(options) {
    var opts = Object.assign({ autoObserve: true }, options);
    var result = audit(document);
    var obs = null;

    if (opts.autoObserve && document.body) {
      obs = observe(document.body);
    }

    return { fixed: result.fixed, issues: result.issues, observer: obs };
  }

  ns.AriaLabelSystem = {
    RULES: RULES,
    audit: audit,
    observe: observe,
    init: init
  };
})();
