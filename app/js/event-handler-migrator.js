/**
 * CF-083: Inline Event Handler → addEventListener Migrator
 *
 * Scans the DOM for inline event handlers (onclick, onchange, etc.)
 * and rebinds them using addEventListener. Also provides a report
 * of which elements had inline handlers for manual migration.
 *
 * Usage:
 *   CortexFreelancer.eventMigrator.scan()     — scan & report only
 *   CortexFreelancer.eventMigrator.migrate()   — scan, rebind, and remove inline attrs
 *   CortexFreelancer.eventMigrator.report()    — get last scan results
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  // All standard inline event handler attributes
  var EVENT_ATTRIBUTES = [
    'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
    'onmouseout', 'onmousemove', 'onmouseenter', 'onmouseleave',
    'onkeydown', 'onkeyup', 'onkeypress',
    'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset',
    'onscroll', 'onresize',
    'onload', 'onerror', 'onabort',
    'ondragstart', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave',
    'ondragover', 'ondrop',
    'ontouchstart', 'ontouchmove', 'ontouchend', 'ontouchcancel',
    'oncontextmenu', 'onwheel',
    'onanimationstart', 'onanimationend', 'onanimationiteration',
    'ontransitionend',
    'onselect', 'oncopy', 'oncut', 'onpaste',
    'onplay', 'onpause', 'onended', 'onvolumechange',
    'ontoggle'
  ];

  var lastResults = [];

  /**
   * Describe an element for human-readable reports.
   */
  function describeElement(el) {
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).join('.')
      : '';
    var text = (el.textContent || '').trim().substring(0, 40);
    return tag + id + cls + (text ? ' ("' + text + '…")' : '');
  }

  /**
   * Scan DOM for inline event handlers.
   * @param {Element} [root=document.body]
   * @returns {Array} Array of {element, attribute, handler, selector}
   */
  function scan(root) {
    root = root || document.body;
    if (!root) return [];

    var results = [];
    var allElements = root.querySelectorAll('*');

    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      for (var j = 0; j < EVENT_ATTRIBUTES.length; j++) {
        var attr = EVENT_ATTRIBUTES[j];
        var value = el.getAttribute(attr);
        if (value !== null) {
          results.push({
            element: el,
            attribute: attr,
            handler: value,
            description: describeElement(el),
            eventName: attr.substring(2) // 'onclick' → 'click'
          });
        }
      }
    }

    lastResults = results;
    return results;
  }

  /**
   * Migrate inline handlers to addEventListener.
   * @param {Element} [root=document.body]
   * @param {Object} [options]
   * @param {boolean} [options.removeAttr=true]  Remove the inline attribute after binding
   * @param {boolean} [options.dryRun=false]     If true, scan only — don't modify DOM
   * @returns {Object} { migrated: number, results: Array }
   */
  function migrate(root, options) {
    options = options || {};
    var removeAttr = options.removeAttr !== false;
    var dryRun = options.dryRun === true;

    var results = scan(root);
    var migrated = 0;

    for (var i = 0; i < results.length; i++) {
      var entry = results[i];
      if (dryRun) continue;

      try {
        // Create a function from the inline handler string
        // The handler runs in the element's context (this = element)
        var fn = new Function('event', entry.handler);
        entry.element.addEventListener(entry.eventName, fn);

        if (removeAttr) {
          entry.element.removeAttribute(entry.attribute);
        }

        entry.migrated = true;
        migrated++;
      } catch (err) {
        entry.migrated = false;
        entry.error = err.message;
        console.warn(
          '[EventMigrator] Failed to migrate', entry.attribute,
          'on', entry.description, ':', err.message
        );
      }
    }

    console.log('[EventMigrator]', dryRun ? 'Scan found' : 'Migrated',
      results.length, 'inline handler(s),', migrated, 'successfully rebound');

    return { migrated: migrated, total: results.length, results: results };
  }

  /**
   * Get a human-readable report of last scan.
   */
  function report() {
    if (lastResults.length === 0) {
      console.log('[EventMigrator] No inline handlers found (run scan() first).');
      return lastResults;
    }

    console.group('[EventMigrator] Inline Handler Report (' + lastResults.length + ' found)');
    console.table(lastResults.map(function (r) {
      return {
        Element: r.description,
        Attribute: r.attribute,
        Handler: r.handler.substring(0, 80),
        Migrated: r.migrated !== undefined ? (r.migrated ? '✅' : '❌') : '—'
      };
    }));
    console.groupEnd();

    return lastResults;
  }

  /**
   * FILES THAT COMMONLY NEED MANUAL MIGRATION
   * ──────────────────────────────────────────
   * These are typical patterns to search for in HTML/JS files:
   *
   * 1. HTML files with onclick="..." attributes:
   *    - app/index.html
   *    - app/pages/*.html
   *    - Any template strings in JS files
   *
   * 2. Dynamically generated HTML with inline handlers:
   *    - Search for: innerHTML.*onclick
   *    - Search for: insertAdjacentHTML.*on(click|change|submit)
   *    - Search for: template.*on(click|change|submit)
   *
   * 3. Common patterns to replace:
   *    BEFORE: <button onclick="doThing()">
   *    AFTER:  <button id="do-thing-btn">
   *            document.getElementById('do-thing-btn')
   *              .addEventListener('click', doThing);
   *
   *    BEFORE: <form onsubmit="return validate()">
   *    AFTER:  form.addEventListener('submit', function(e) {
   *              if (!validate()) e.preventDefault();
   *            });
   *
   *    BEFORE: <img onerror="this.src='fallback.png'">
   *    AFTER:  img.addEventListener('error', function() {
   *              this.src = 'fallback.png';
   *            });
   *
   * Run CortexFreelancer.eventMigrator.findInSource() for grep commands.
   */

  /**
   * Print grep commands to find inline handlers in source files.
   */
  function findInSource() {
    var cmds = [
      '# Find inline event handlers in HTML files:',
      'grep -rn "on\\(click\\|change\\|submit\\|load\\|error\\|focus\\|blur\\|input\\|keydown\\|keyup\\)=" app/ --include="*.html"',
      '',
      '# Find inline handlers in JS template strings:',
      'grep -rn "on\\(click\\|change\\|submit\\|load\\|error\\)=" app/js/ --include="*.js"',
      '',
      '# Find innerHTML assignments with handlers:',
      'grep -rn "innerHTML.*onclick\\|innerHTML.*onchange\\|innerHTML.*onsubmit" app/js/ --include="*.js"'
    ];

    console.group('[EventMigrator] Source File Search Commands');
    cmds.forEach(function (cmd) { console.log(cmd); });
    console.groupEnd();

    return cmds;
  }

  // ── Export ────────────────────────────────────────────────────────────

  window.CortexFreelancer.eventMigrator = {
    scan: scan,
    migrate: migrate,
    report: report,
    findInSource: findInSource,
    EVENT_ATTRIBUTES: EVENT_ATTRIBUTES
  };

  console.log('[CF] Event handler migrator loaded');
})();
