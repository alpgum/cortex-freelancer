/**
 * CF-237: XML Sitemap Generator
 *
 * Generates sitemap.xml content with all public pages, proper lastmod dates,
 * and priority values. Outputs downloadable XML.
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var BASE_URL = window.location.origin;

  var PAGES = [
    { loc: '/',         changefreq: 'weekly',  priority: 1.0,  lastmod: '2026-03-24' },
    { loc: '/tools',    changefreq: 'weekly',  priority: 0.9,  lastmod: '2026-03-24' },
    { loc: '/pricing',  changefreq: 'monthly', priority: 0.8,  lastmod: '2026-03-20' },
    { loc: '/login',    changefreq: 'monthly', priority: 0.3,  lastmod: '2026-03-01' },
    { loc: '/signup',   changefreq: 'monthly', priority: 0.5,  lastmod: '2026-03-01' },
    { loc: '/about',    changefreq: 'monthly', priority: 0.5,  lastmod: '2026-03-10' },
    { loc: '/contact',  changefreq: 'monthly', priority: 0.4,  lastmod: '2026-03-10' },
    { loc: '/privacy',  changefreq: 'yearly',  priority: 0.2,  lastmod: '2026-01-15' },
    { loc: '/terms',    changefreq: 'yearly',  priority: 0.2,  lastmod: '2026-01-15' },
    { loc: '/blog',     changefreq: 'daily',   priority: 0.7,  lastmod: '2026-03-24' }
  ];

  function escapeXml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
  }

  /**
   * Generate sitemap XML string.
   * @param {Object} [options]
   * @param {string} [options.baseUrl] - Override base URL
   * @param {Array}  [options.extraPages] - Additional pages to include
   * @returns {string} XML sitemap content
   */
  function generate(options) {
    options = options || {};
    var base = options.baseUrl || BASE_URL;
    var pages = PAGES.slice();

    if (options.extraPages) {
      pages = pages.concat(options.extraPages);
    }

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    pages.forEach(function (page) {
      xml += '  <url>\n';
      xml += '    <loc>' + escapeXml(base + page.loc) + '</loc>\n';
      if (page.lastmod) {
        xml += '    <lastmod>' + escapeXml(page.lastmod) + '</lastmod>\n';
      }
      if (page.changefreq) {
        xml += '    <changefreq>' + escapeXml(page.changefreq) + '</changefreq>\n';
      }
      if (page.priority != null) {
        xml += '    <priority>' + page.priority.toFixed(1) + '</priority>\n';
      }
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  /**
   * Trigger a download of the sitemap.xml file.
   * @param {Object} [options] - Same options as generate()
   */
  function download(options) {
    var xml = generate(options);
    var blob = new Blob([xml], { type: 'application/xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Display a preview of the sitemap in a container.
   * @param {string|HTMLElement} target - CSS selector or DOM element
   * @param {Object} [options] - Same options as generate()
   */
  function preview(target, options) {
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) {
      console.warn('[SitemapGenerator] Target container not found:', target);
      return;
    }

    var xml = generate(options);
    var pre = document.createElement('pre');
    pre.style.cssText = 'background:#f8f9fa;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;';
    pre.textContent = xml;
    container.appendChild(pre);
  }

  /** Add a page to the sitemap definition */
  function addPage(page) {
    PAGES.push(page);
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.CortexFreelancer.SitemapGenerator = {
    generate: generate,
    download: download,
    preview: preview,
    addPage: addPage,
    getPages: function () { return PAGES.slice(); }
  };
})();
