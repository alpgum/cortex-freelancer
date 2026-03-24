/**
 * CF-106: Fix tool pages not loading when accessed from bookmark
 * Ensures relative paths for JS/CSS work regardless of URL depth.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const ToolPathResolver = {
    init() {
      this.fixBaseTag();
      this.fixRelativePaths();
    },

    getBasePath() {
      const path = window.location.pathname;
      if (path.includes('/app/tools/')) return '../../';
      if (path.includes('/app/')) return '../';
      if (path.includes('/help/')) return '../';
      return './';
    },

    fixBaseTag() {
      let base = document.querySelector('base');
      if (!base) {
        base = document.createElement('base');
        document.head.prepend(base);
      }
      const basePath = this.getBasePath();
      if (!base.href || base.href === window.location.href) {
        base.href = basePath;
      }
    },

    fixRelativePaths() {
      const basePath = this.getBasePath();

      document.querySelectorAll('link[rel="stylesheet"][href^="app/"]').forEach(link => {
        if (!link.href.includes('://')) {
          link.href = basePath + link.getAttribute('href');
        }
      });

      document.querySelectorAll('script[src^="app/"]').forEach(script => {
        if (!script.src.includes('://')) {
          const newScript = document.createElement('script');
          newScript.src = basePath + script.getAttribute('src');
          newScript.defer = script.defer;
          script.parentNode.replaceChild(newScript, script);
        }
      });
    },

    resolve(relativePath) {
      return this.getBasePath() + relativePath;
    }
  };

  ToolPathResolver.init();
  window.CortexFreelancer.ToolPathResolver = ToolPathResolver;
})();
