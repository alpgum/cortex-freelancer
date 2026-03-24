/**
 * CF-116: Fix invoice generator PDF export broken
 * Fixes PDF generation — ensures jsPDF/html2canvas load correctly.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const InvoicePDFFix = {
    CDN: {
      jsPDF: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    },

    init() {
      document.addEventListener('DOMContentLoaded', () => this.patchExportButton());
    },

    loadScript(url) {
      return new Promise((resolve, reject) => {
        if (url.includes('jspdf') && window.jspdf) return resolve();
        if (url.includes('html2canvas') && window.html2canvas) return resolve();

        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load: ' + url));
        document.head.appendChild(script);
      });
    },

    async ensureLibraries() {
      try {
        await Promise.all([
          this.loadScript(this.CDN.jsPDF),
          this.loadScript(this.CDN.html2canvas)
        ]);
        return true;
      } catch (err) {
        console.error('[CF-116] Library load failed:', err);
        return false;
      }
    },

    patchExportButton() {
      const btn = document.querySelector(
        '#export-pdf, #download-pdf, [data-export="pdf"], .export-pdf-btn'
      );
      if (!btn) return;

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.exportPDF();
      });
    },

    async exportPDF() {
      const btn = document.querySelector('#export-pdf, #download-pdf, [data-export="pdf"]');
      const originalText = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generating PDF...';
      }

      try {
        const loaded = await this.ensureLibraries();
        if (!loaded) throw new Error('PDF libraries not available');

        const invoiceEl = document.querySelector(
          '#invoice-preview, .invoice-container, .invoice-output'
        );
        if (!invoiceEl) throw new Error('Invoice element not found');

        const canvas = await window.html2canvas(invoiceEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        const filename = this.getFilename();
        pdf.save(filename);
      } catch (err) {
        console.error('[CF-116] PDF export failed:', err);
        alert('PDF export failed: ' + err.message + '. Please try again.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    },

    getFilename() {
      const invoiceNo = document.querySelector('#invoice-number, [data-invoice-number]')?.textContent || '';
      const clientName = document.querySelector('#client-name, [data-client-name]')?.textContent || '';
      const date = new Date().toISOString().slice(0, 10);
      const parts = ['invoice', invoiceNo, clientName, date].filter(Boolean);
      return parts.join('-').replace(/[^a-zA-Z0-9-]/g, '') + '.pdf';
    }
  };

  InvoicePDFFix.init();
  window.CortexFreelancer.InvoicePDFFix = InvoicePDFFix;
})();
