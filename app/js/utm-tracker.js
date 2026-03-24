// CF-243: UTM Parameter Tracking End-to-End
(function() {
  'use strict';

  var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var STORAGE_KEY = 'cortex_utm_data';

  var UTMTracker = {
    _data: null,

    init: function() {
      this._captureFromURL();
      this._attachFormHandlers();
      return this;
    },

    _captureFromURL: function() {
      var params = new URLSearchParams(window.location.search);
      var utmData = {};
      var hasUTM = false;

      UTM_PARAMS.forEach(function(param) {
        var value = params.get(param);
        if (value) {
          utmData[param] = value;
          hasUTM = true;
        }
      });

      if (hasUTM) {
        utmData.landing_page = window.location.pathname;
        utmData.captured_at = new Date().toISOString();
        utmData.referrer = document.referrer || '';

        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utmData));
        } catch (e) {
          // sessionStorage unavailable
        }

        this._data = utmData;
        this._fireGA4Event('utm_captured', utmData);
      } else {
        this._loadFromStorage();
      }
    },

    _loadFromStorage: function() {
      try {
        var stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          this._data = JSON.parse(stored);
        }
      } catch (e) {
        this._data = null;
      }
    },

    getUTMData: function() {
      if (!this._data) {
        this._loadFromStorage();
      }
      return this._data ? Object.assign({}, this._data) : null;
    },

    getParam: function(param) {
      var data = this.getUTMData();
      return data ? data[param] || null : null;
    },

    _attachFormHandlers: function() {
      var self = this;

      document.addEventListener('submit', function(e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;

        var isTrackedForm = form.dataset.utmTrack !== undefined ||
          form.classList.contains('waitlist-form') ||
          form.classList.contains('signup-form');

        if (isTrackedForm) {
          self._injectUTMFields(form);
          self._fireGA4Event('form_submit_with_utm', {
            form_id: form.id || form.className,
            form_action: form.action
          });
        }
      }, true);
    },

    _injectUTMFields: function(form) {
      var data = this.getUTMData();
      if (!data) return;

      UTM_PARAMS.forEach(function(param) {
        if (!data[param]) return;

        var existing = form.querySelector('input[name="' + param + '"]');
        if (existing) {
          existing.value = data[param];
        } else {
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = param;
          hidden.value = data[param];
          form.appendChild(hidden);
        }
      });

      // Also inject landing page and referrer
      if (data.landing_page) {
        var lpField = document.createElement('input');
        lpField.type = 'hidden';
        lpField.name = 'utm_landing_page';
        lpField.value = data.landing_page;
        form.appendChild(lpField);
      }
    },

    _fireGA4Event: function(eventName, params) {
      var eventParams = {};
      var data = this.getUTMData();

      if (data) {
        UTM_PARAMS.forEach(function(param) {
          if (data[param]) {
            eventParams[param] = data[param];
          }
        });
      }

      if (params) {
        Object.keys(params).forEach(function(key) {
          eventParams[key] = params[key];
        });
      }

      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, eventParams);
      }

      if (typeof window.dataLayer !== 'undefined') {
        window.dataLayer.push(Object.assign({ event: eventName }, eventParams));
      }
    },

    trackEvent: function(eventName, additionalParams) {
      this._fireGA4Event(eventName, additionalParams);
    },

    trackConversion: function(conversionType, value) {
      this._fireGA4Event('conversion', {
        conversion_type: conversionType,
        value: value || 0
      });
    },

    buildTrackingURL: function(baseURL, utmParams) {
      var url = new URL(baseURL, window.location.origin);
      Object.keys(utmParams).forEach(function(key) {
        if (utmParams[key]) {
          url.searchParams.set(key, utmParams[key]);
        }
      });
      return url.toString();
    },

    clear: function() {
      this._data = null;
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // ignore
      }
    },

    getAttributionSummary: function() {
      var data = this.getUTMData();
      if (!data) return 'Direct / No UTM';

      var parts = [];
      if (data.utm_source) parts.push('Source: ' + data.utm_source);
      if (data.utm_medium) parts.push('Medium: ' + data.utm_medium);
      if (data.utm_campaign) parts.push('Campaign: ' + data.utm_campaign);
      return parts.join(' | ') || 'Direct / No UTM';
    }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.UTMTracker = UTMTracker;
})();
