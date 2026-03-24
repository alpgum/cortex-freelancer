/**
 * @file Print Stylesheet System
 * @description Injects @media print CSS for invoices, earnings reports, and proposal pages.
 *   Optimizes layout, hides non-essential UI, and ensures clean printed output.
 * @version 1.0.0
 * @task CF-298
 */

(function() {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /**
   * @namespace PrintStyles
   * @memberof window.CortexFreelancer
   * @description Manages print-optimized stylesheets for reports, invoices, and proposals.
   */
  const PrintStyles = {
    /** @type {HTMLStyleElement|null} Injected stylesheet */
    styleEl: null,

    /** @type {boolean} Whether styles have been injected */
    initialized: false,

    /**
     * Initialize the print stylesheet system.
     * @returns {void}
     */
    init() {
      if (this.initialized) return;
      this._injectStyles();
      this.initialized = true;
    },

    /**
     * Inject the print stylesheet into the document head.
     * @private
     */
    _injectStyles() {
      var css = `
/* ==========================================================
   Cortex Freelancer — Print Stylesheet
   Covers: Invoices, Earnings Reports, Proposals
   ========================================================== */

@media print {

  /* ----- Global print resets ----- */
  *,
  *::before,
  *::after {
    background: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.5;
    margin: 0;
    padding: 0;
  }

  /* ----- Hide non-essential UI ----- */
  nav,
  header:not(.cf-print-header),
  footer:not(.cf-print-footer),
  .sidebar,
  .cf-nav,
  .cf-toolbar,
  .cf-toast,
  .cf-modal-overlay,
  .cf-chat-widget,
  .cf-fab,
  .cf-breadcrumbs,
  .cf-pagination,
  .cf-filters,
  .cf-actions-bar,
  .cf-dropdown-menu,
  .cf-tooltip,
  [data-cf-no-print],
  button:not(.cf-print-keep),
  .cf-btn:not(.cf-print-keep),
  input[type="button"]:not(.cf-print-keep),
  input[type="submit"]:not(.cf-print-keep) {
    display: none !important;
  }

  /* ----- Links ----- */
  a[href] {
    text-decoration: underline;
  }
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 9pt;
    font-weight: normal;
    opacity: 0.7;
  }
  a[href^="#"]::after,
  a[href^="javascript"]::after,
  a.cf-print-no-url::after {
    content: "";
  }

  /* ----- Page settings ----- */
  @page {
    size: A4;
    margin: 15mm 20mm;
  }

  @page :first {
    margin-top: 10mm;
  }

  /* ----- Page break control ----- */
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    break-after: avoid;
  }

  table, figure, img, pre, blockquote {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  p {
    orphans: 3;
    widows: 3;
  }

  /* =========================================================
     INVOICE PRINT STYLES
     ========================================================= */

  .cf-invoice {
    max-width: 100%;
    padding: 0;
  }

  .cf-invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2pt solid #000;
    padding-bottom: 10pt;
    margin-bottom: 15pt;
  }

  .cf-invoice-logo {
    max-height: 50pt;
    max-width: 150pt;
  }

  .cf-invoice-title {
    font-size: 22pt;
    font-weight: bold;
    margin: 0 0 4pt 0;
    text-transform: uppercase;
    letter-spacing: 1pt;
  }

  .cf-invoice-meta {
    text-align: right;
    font-size: 9pt;
    line-height: 1.6;
  }

  .cf-invoice-addresses {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20pt;
    font-size: 10pt;
  }

  .cf-invoice-addresses > div {
    width: 45%;
  }

  .cf-invoice-label {
    font-weight: bold;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    margin-bottom: 4pt;
    border-bottom: 0.5pt solid #999;
    padding-bottom: 2pt;
  }

  .cf-invoice-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20pt;
    font-size: 10pt;
  }

  .cf-invoice-table th {
    background-color: #f0f0f0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    border-bottom: 1.5pt solid #000;
    padding: 6pt 8pt;
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }

  .cf-invoice-table td {
    border-bottom: 0.5pt solid #ddd;
    padding: 6pt 8pt;
    vertical-align: top;
  }

  .cf-invoice-table .cf-col-amount,
  .cf-invoice-table .cf-col-rate,
  .cf-invoice-table .cf-col-qty {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .cf-invoice-totals {
    float: right;
    width: 240pt;
    font-size: 10pt;
  }

  .cf-invoice-totals tr td {
    padding: 3pt 8pt;
  }

  .cf-invoice-totals .cf-total-row {
    font-weight: bold;
    font-size: 12pt;
    border-top: 1.5pt solid #000;
  }

  .cf-invoice-notes {
    clear: both;
    margin-top: 30pt;
    padding-top: 10pt;
    border-top: 0.5pt solid #ccc;
    font-size: 9pt;
    color: #555 !important;
  }

  .cf-invoice-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 8pt;
    padding: 5pt 0;
    border-top: 0.5pt solid #ccc;
  }

  /* =========================================================
     EARNINGS REPORT PRINT STYLES
     ========================================================= */

  .cf-earnings-report {
    max-width: 100%;
    padding: 0;
  }

  .cf-earnings-report-title {
    font-size: 18pt;
    font-weight: bold;
    margin: 0 0 4pt 0;
  }

  .cf-earnings-report-period {
    font-size: 10pt;
    margin-bottom: 15pt;
    padding-bottom: 8pt;
    border-bottom: 1pt solid #000;
  }

  .cf-earnings-summary {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20pt;
    padding: 10pt;
    border: 1pt solid #ccc;
  }

  .cf-earnings-summary-item {
    text-align: center;
  }

  .cf-earnings-summary-value {
    font-size: 16pt;
    font-weight: bold;
    display: block;
  }

  .cf-earnings-summary-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }

  .cf-earnings-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 15pt;
    font-size: 10pt;
  }

  .cf-earnings-table th {
    background-color: #f0f0f0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    border-bottom: 1.5pt solid #000;
    padding: 5pt 6pt;
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
  }

  .cf-earnings-table td {
    border-bottom: 0.5pt solid #ddd;
    padding: 5pt 6pt;
  }

  /* Chart placeholder for print */
  .cf-earnings-chart {
    border: 1pt dashed #ccc;
    min-height: 120pt;
    display: flex;
    align-items: center;
    justify-content: center;
    font-style: italic;
    font-size: 10pt;
    margin-bottom: 15pt;
  }

  .cf-earnings-chart::after {
    content: "See digital version for interactive charts";
  }

  .cf-earnings-chart > * {
    display: none !important;
  }

  /* =========================================================
     PROPOSAL PRINT STYLES
     ========================================================= */

  .cf-proposal {
    max-width: 100%;
    padding: 0;
  }

  .cf-proposal-cover {
    text-align: center;
    padding: 40pt 0 30pt;
    border-bottom: 2pt solid #000;
    margin-bottom: 20pt;
    page-break-after: always;
    break-after: page;
  }

  .cf-proposal-cover-title {
    font-size: 26pt;
    font-weight: bold;
    margin-bottom: 8pt;
  }

  .cf-proposal-cover-subtitle {
    font-size: 12pt;
    font-style: italic;
  }

  .cf-proposal-cover-meta {
    margin-top: 30pt;
    font-size: 10pt;
  }

  .cf-proposal-section {
    margin-bottom: 20pt;
  }

  .cf-proposal-section-title {
    font-size: 14pt;
    font-weight: bold;
    border-bottom: 1pt solid #ccc;
    padding-bottom: 4pt;
    margin-bottom: 10pt;
  }

  .cf-proposal-scope-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 15pt;
    font-size: 10pt;
  }

  .cf-proposal-scope-table th {
    background-color: #f0f0f0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    padding: 5pt 8pt;
    text-align: left;
    border-bottom: 1pt solid #000;
    font-size: 8pt;
    text-transform: uppercase;
  }

  .cf-proposal-scope-table td {
    padding: 5pt 8pt;
    border-bottom: 0.5pt solid #ddd;
  }

  .cf-proposal-timeline {
    padding-left: 15pt;
  }

  .cf-proposal-timeline-item {
    position: relative;
    padding-left: 15pt;
    margin-bottom: 8pt;
    font-size: 10pt;
  }

  .cf-proposal-timeline-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 4pt;
    width: 6pt;
    height: 6pt;
    border: 1pt solid #000;
    border-radius: 50%;
  }

  .cf-proposal-signature {
    margin-top: 40pt;
    display: flex;
    justify-content: space-between;
  }

  .cf-proposal-signature-block {
    width: 40%;
    border-top: 1pt solid #000;
    padding-top: 6pt;
    font-size: 9pt;
  }

  /* =========================================================
     SHARED PRINT UTILITIES
     ========================================================= */

  .cf-print-only {
    display: block !important;
  }

  .cf-print-page-break {
    page-break-before: always;
    break-before: page;
  }

  .cf-print-no-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Watermark support */
  .cf-print-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 60pt;
    opacity: 0.04 !important;
    z-index: -1;
    pointer-events: none;
    text-transform: uppercase;
    letter-spacing: 10pt;
  }
}

/* Hide print-only elements on screen */
@media screen {
  .cf-print-only {
    display: none !important;
  }
}
`;

      this.styleEl = document.createElement('style');
      this.styleEl.id = 'cf-print-styles';
      this.styleEl.textContent = css;
      document.head.appendChild(this.styleEl);
    },

    /**
     * Trigger browser print dialog for a specific section.
     * Temporarily isolates the target content for clean printing.
     * @param {HTMLElement|string} target - Element or selector to print
     * @param {Object} [options] - Print options
     * @param {string} [options.title] - Document title during print
     * @param {string} [options.watermark] - Watermark text (e.g., "DRAFT", "PAID")
     */
    printSection(target, options) {
      var el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) {
        console.warn('[PrintStyles] Target not found:', target);
        return;
      }

      var opts = Object.assign({ title: '', watermark: '' }, options);
      var origTitle = document.title;

      if (opts.title) document.title = opts.title;

      // Add watermark if specified
      var watermarkEl = null;
      if (opts.watermark) {
        watermarkEl = document.createElement('div');
        watermarkEl.className = 'cf-print-watermark cf-print-only';
        watermarkEl.textContent = opts.watermark;
        document.body.appendChild(watermarkEl);
      }

      // Mark siblings as non-printable
      var siblings = [];
      var parent = el.parentElement;
      if (parent) {
        var children = parent.children;
        for (var i = 0; i < children.length; i++) {
          if (children[i] !== el && !children[i].hasAttribute('data-cf-no-print')) {
            children[i].setAttribute('data-cf-no-print', 'temp');
            siblings.push(children[i]);
          }
        }
      }

      window.print();

      // Restore
      if (opts.title) document.title = origTitle;
      if (watermarkEl) watermarkEl.remove();
      for (var j = 0; j < siblings.length; j++) {
        siblings[j].removeAttribute('data-cf-no-print');
      }
    },

    /**
     * Add a "Print" button next to a printable section.
     * @param {HTMLElement|string} target - Printable section
     * @param {Object} [options] - Options including button label and print options
     * @param {string} [options.label='Print'] - Button text
     * @returns {HTMLButtonElement|null}
     */
    addPrintButton(target, options) {
      var el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return null;

      var opts = Object.assign({ label: 'Print' }, options);
      var btn = document.createElement('button');
      btn.className = 'cf-btn cf-print-btn';
      btn.setAttribute('data-cf-no-print', '');
      btn.textContent = opts.label;

      var self = this;
      btn.addEventListener('click', function() {
        self.printSection(el, opts);
      });

      el.insertBefore(btn, el.firstChild);
      return btn;
    },

    /**
     * Remove injected print styles.
     */
    destroy() {
      if (this.styleEl) {
        this.styleEl.remove();
        this.styleEl = null;
      }
      this.initialized = false;
    }
  };

  window.CortexFreelancer.PrintStyles = PrintStyles;
})();
