/**
 * Advanced Toolkit wiring for app/index.html
 * Exposes:
 *  - window.renderAdvancedWidget(key)
 *  - window.renderAdvancedToolkitAuto()
 */

(function () {
  'use strict';

  function getProfileData() {
    // Prefer real analysis integration payload
    if (window._realAnalysisData && window._realAnalysisData.apiData) {
      return window._realAnalysisData.apiData;
    }
    // Cached profile (upwork-profile-storage.js)
    if (window._cachedUpworkProfile) return window._cachedUpworkProfile;
    if (window.cachedUpworkProfile) return window.cachedUpworkProfile;
    // Last known profile in other modules
    if (window.lastProfileData) return window.lastProfileData;
    return null;
  }

  function ensureEl(id) {
    var el = document.getElementById(id);
    if (!el) throw new Error('Missing container #' + id);
    return el;
  }

  function safeRender(fn, containerId) {
    var el = ensureEl(containerId);
    el.innerHTML = '';
    try {
      var profile = getProfileData();
      if (!profile) {
        el.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Run an analysis first to load profile data.</div>';
        return;
      }
      fn(profile, el);
    } catch (e) {
      el.innerHTML = '<div style="color:#ff8844;font-size:0.85rem">Failed to render: ' + (e && e.message ? e.message : 'unknown error') + '</div>';
      console.warn('[advanced-toolkit] render failed', e);
    }
  }

  window.renderAdvancedWidget = function (key) {
    if (key === 'connects' && window.CortexConnectsTracker && window.CortexConnectsTracker.renderConnectsTracker) {
      var el = ensureEl('advanced-connects');
      el.innerHTML = '';
      window.CortexConnectsTracker.renderConnectsTracker(el);
      return;
    }

    if (key === 'proposalTemplates' && window.CortexProposalTemplates && window.CortexProposalTemplates.renderTemplateLibrary) {
      safeRender(function (profile, el) {
        window.CortexProposalTemplates.renderTemplateLibrary(profile, el);
      }, 'advanced-proposal-templates');
      return;
    }

    if (key === 'commTemplates' && window.CortexCommTemplates && window.CortexCommTemplates.renderTemplates) {
      safeRender(function (profile, el) {
        window.CortexCommTemplates.renderTemplates(profile, el);
      }, 'advanced-comm-templates');
      return;
    }

    if (key === 'ranking' && window.CortexRankingSimulator && window.CortexRankingSimulator.renderRankingSimulator) {
      safeRender(function (profile, el) {
        window.CortexRankingSimulator.renderRankingSimulator(profile, el);
      }, 'advanced-ranking');
      return;
    }

    if (key === 'negotiation' && window.CortexNegotiationCoach && window.CortexNegotiationCoach.renderNegotiationCoach) {
      safeRender(function (profile, el) {
        window.CortexNegotiationCoach.renderNegotiationCoach(profile, el);
      }, 'advanced-negotiation');
      return;
    }

    if (key === 'seo' && window.CortexProfileSEO && window.CortexProfileSEO.renderProfileSEO) {
      safeRender(function (profile, el) {
        window.CortexProfileSEO.renderProfileSEO(profile, el);
      }, 'advanced-seo');
      return;
    }

    if (key === 'revenue' && window.CortexRevenueForecast && window.CortexRevenueForecast.renderRevenueForecast) {
      safeRender(function (profile, el) {
        window.CortexRevenueForecast.renderRevenueForecast(profile, el);
      }, 'advanced-revenue');
      return;
    }

    if (key === 'burnout' && window.CortexBurnoutDetector && window.CortexBurnoutDetector.renderBurnoutDetector) {
      safeRender(function (profile, el) {
        window.CortexBurnoutDetector.renderBurnoutDetector(profile, el);
      }, 'advanced-burnout');
      return;
    }

    if (key === 'commAnalyzer' && window.CortexCommAnalyzer && window.CortexCommAnalyzer.renderCommAnalyzer) {
      safeRender(function (profile, el) {
        window.CortexCommAnalyzer.renderCommAnalyzer(profile, el);
      }, 'advanced-comm-analyzer');
      return;
    }

    console.warn('[advanced-toolkit] Unknown widget key or module missing:', key);
  };

  window.renderAdvancedToolkitAuto = function () {
    // Auto-render two highest leverage widgets
    try { window.renderAdvancedWidget('connects'); } catch (e) {}
    try { window.renderAdvancedWidget('proposalTemplates'); } catch (e) {}
  };

})();
