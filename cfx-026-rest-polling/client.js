/**
 * CFX-026: REST Polling Client
 * 
 * Browser-compatible client for REST API with adaptive polling.
 * Integrates as the final fallback in the transport chain.
 * 
 * Features:
 * - Adaptive polling intervals (fast → slow)
 * - Smart retry with exponential backoff
 * - Request cancellation support
 * - Battery-aware polling on mobile
 * - Progress callbacks and status updates
 */

(function (global) {
  'use strict';

  /**
   * REST Polling Transport Client
   */
  function RestPollingClient(options) {
    options = options || {};
    
    this.baseUrl = options.baseUrl || '';
    this.apiPath = options.apiPath || '/api/chat';
    this.minInterval = options.minInterval || 500;
    this.maxInterval = options.maxInterval || 5000;
    this.backoffMultiplier = options.backoffMultiplier || 1.2;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000;
    
    // Mobile detection
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.isLowBattery = false;
    
    // Battery awareness
    this.initBatteryAwareness();
    
    // Active requests tracking
    this.activeRequests = new Map(); // requestId -> { abortController, status }
  }

  RestPollingClient.prototype = {
    /**
     * Initialize battery-aware polling
     */
    initBatteryAwareness: function () {
      if (!navigator.getBattery) return;
      
      var self = this;
      navigator.getBattery().then(function (battery) {
        function updateBatteryStatus() {
          self.isLowBattery = !battery.charging && battery.level < 0.2;
        }
        
        battery.addEventListener('levelchange', updateBatteryStatus);
        battery.addEventListener('chargingchange', updateBatteryStatus);
        updateBatteryStatus();
      }).catch(function () {
        // Battery API not available
      });
    },

    /**
     * Send a chat message with polling for response
     * @param {string} message - The chat message
     * @param {Object} options - Options (sessionId, profile, goals, callbacks)
     * @returns {Promise<Object>} - Response object
     */
    sendMessage: function (message, options) {
      options = options || {};
      
      var self = this;
      
      return new Promise(function (resolve, reject) {
        self._submitMessage(message, options)
          .then(function (submitResponse) {
            var requestId = submitResponse.requestId;
            
            // Start polling for result
            self._pollForResult(requestId, {
              onProgress: options.onProgress,
              onComplete: options.onComplete,
              onError: options.onError
            })
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      });
    },

    /**
     * Submit initial message
     * @private
     */
    _submitMessage: function (message, options) {
      var self = this;
      
      var body = {
        message: message,
        sessionId: options.sessionId,
        profile: options.profile,
        goals: options.goals
      };

      return self._fetch('POST', self.apiPath, body)
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (error) {
              throw new Error(error.error || 'Failed to submit message');
            });
          }
          return response.json();
        });
    },

    /**
     * Poll for request completion with adaptive intervals
     * @private
     */
    _pollForResult: function (requestId, callbacks) {
      var self = this;
      callbacks = callbacks || {};
      
      return new Promise(function (resolve, reject) {
        var interval = self.minInterval;
        var consecutivePolls = 0;
        var retryCount = 0;
        var lastStatus = null;

        // Create abort controller for cancellation
        var abortController = new AbortController();
        self.activeRequests.set(requestId, {
          abortController: abortController,
          status: 'polling'
        });

        function poll() {
          // Check if cancelled
          if (abortController.signal.aborted) {
            self.activeRequests.delete(requestId);
            reject(new Error('Request cancelled'));
            return;
          }

          self._checkStatus(requestId, abortController.signal)
            .then(function (statusResponse) {
              consecutivePolls++;
              
              // Call progress callback
              if (callbacks.onProgress) {
                callbacks.onProgress(statusResponse);
              }

              switch (statusResponse.status) {
                case 'complete':
                  self._getResult(requestId, abortController.signal)
                    .then(function (result) {
                      self.activeRequests.delete(requestId);
                      if (callbacks.onComplete) callbacks.onComplete(result);
                      resolve(result);
                    })
                    .catch(function (error) {
                      self.activeRequests.delete(requestId);
                      if (callbacks.onError) callbacks.onError(error);
                      reject(error);
                    });
                  break;

                case 'error':
                  var error = new Error(statusResponse.error || 'Request failed');
                  error.code = statusResponse.code;
                  error.retryAfter = statusResponse.retryAfter;
                  
                  self.activeRequests.delete(requestId);
                  if (callbacks.onError) callbacks.onError(error);
                  reject(error);
                  break;

                case 'expired':
                  var expiredError = new Error('Request expired');
                  expiredError.code = 'EXPIRED';
                  
                  self.activeRequests.delete(requestId);
                  if (callbacks.onError) callbacks.onError(expiredError);
                  reject(expiredError);
                  break;

                case 'cancelled':
                  var cancelledError = new Error('Request was cancelled');
                  cancelledError.code = 'CANCELLED';
                  
                  self.activeRequests.delete(requestId);
                  if (callbacks.onError) callbacks.onError(cancelledError);
                  reject(cancelledError);
                  break;

                default:
                  // Still processing - schedule next poll
                  self._scheduleNextPoll(statusResponse, interval, consecutivePolls, poll);
                  break;
              }

              lastStatus = statusResponse.status;
              retryCount = 0; // Reset retry count on successful poll
            })
            .catch(function (error) {
              retryCount++;
              
              if (retryCount >= self.maxRetries) {
                self.activeRequests.delete(requestId);
                if (callbacks.onError) callbacks.onError(error);
                reject(error);
                return;
              }

              // Exponential backoff for errors
              var errorInterval = self.minInterval * Math.pow(2, retryCount);
              errorInterval = Math.min(errorInterval, self.maxInterval);
              
              setTimeout(poll, errorInterval);
            });
        }

        // Start polling
        poll();
      });
    },

    /**
     * Schedule next poll with adaptive interval
     * @private
     */
    _scheduleNextPoll: function (statusResponse, currentInterval, consecutivePolls, pollFunction) {
      var nextInterval = currentInterval;
      
      // Use server-suggested interval if available
      if (statusResponse.pollInterval) {
        nextInterval = statusResponse.pollInterval;
      } else {
        // Adaptive interval based on status and time
        switch (statusResponse.status) {
          case 'queued':
            nextInterval = Math.max(this.minInterval * 2, 2000);
            break;
            
          case 'processing':
          case 'streaming':
            // Fast initially, then slower
            if (consecutivePolls < 3) {
              nextInterval = this.minInterval;
            } else if (consecutivePolls < 10) {
              nextInterval = this.minInterval * 2;
            } else {
              nextInterval = Math.min(currentInterval * this.backoffMultiplier, this.maxInterval);
            }
            break;
            
          default:
            nextInterval = this.minInterval * 2;
        }
      }

      // Mobile and battery adjustments
      if (this.isMobile) {
        nextInterval = Math.max(nextInterval, 1000); // Minimum 1s on mobile
      }
      
      if (this.isLowBattery) {
        nextInterval *= 2; // Double interval on low battery
      }

      setTimeout(pollFunction, nextInterval);
    },

    /**
     * Check request status
     * @private
     */
    _checkStatus: function (requestId, signal) {
      return this._fetch('GET', this.apiPath + '/' + requestId, null, signal)
        .then(function (response) {
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error('Request not found or expired');
            }
            return response.json().then(function (error) {
              throw new Error(error.error || 'Status check failed');
            });
          }
          return response.json();
        });
    },

    /**
     * Get final result
     * @private
     */
    _getResult: function (requestId, signal) {
      return this._fetch('GET', this.apiPath + '/' + requestId + '/result', null, signal)
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (error) {
              throw new Error(error.error || 'Failed to get result');
            });
          }
          return response.json();
        });
    },

    /**
     * Cancel an active request
     * @param {string} requestId - Request ID to cancel
     * @returns {Promise<Object>} - Cancellation result
     */
    cancelRequest: function (requestId) {
      var self = this;
      
      // Cancel local polling first
      var activeRequest = this.activeRequests.get(requestId);
      if (activeRequest && activeRequest.abortController) {
        activeRequest.abortController.abort();
      }
      
      // Send cancel request to server
      return this._fetch('DELETE', this.apiPath + '/' + requestId)
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (error) {
              throw new Error(error.error || 'Cancellation failed');
            });
          }
          return response.json();
        })
        .finally(function () {
          self.activeRequests.delete(requestId);
        });
    },

    /**
     * Check if REST polling is supported
     * @returns {boolean}
     */
    isSupported: function () {
      return typeof fetch !== 'undefined' && 
             typeof Promise !== 'undefined' && 
             typeof AbortController !== 'undefined';
    },

    /**
     * Get active request count
     * @returns {number}
     */
    getActiveRequestCount: function () {
      return this.activeRequests.size;
    },

    /**
     * Cancel all active requests
     */
    cancelAllRequests: function () {
      for (var entry of this.activeRequests.values()) {
        if (entry.abortController) {
          entry.abortController.abort();
        }
      }
      this.activeRequests.clear();
    },

    /**
     * Enhanced fetch with timeout and error handling
     * @private
     */
    _fetch: function (method, path, body, signal) {
      var url = this.baseUrl + path;
      var options = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        signal: signal
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      // Add timeout if no signal provided
      if (!signal) {
        var abortController = new AbortController();
        options.signal = abortController.signal;
        
        setTimeout(function () {
          abortController.abort();
        }, this.timeout);
      }

      return fetch(url, options);
    }
  };

  /**
   * Integration helper for chat dispatcher
   * Returns a transport object compatible with the existing fallback chain
   */
  RestPollingClient.createTransport = function (options) {
    var client = new RestPollingClient(options);
    
    return {
      isSupported: function () {
        return client.isSupported();
      },
      
      hasFailed: function () {
        return false; // REST polling should always work if HTTP works
      },
      
      sendMessage: function (message, options) {
        return client.sendMessage(message, options);
      },
      
      cancel: function () {
        client.cancelAllRequests();
      }
    };
  };

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RestPollingClient;
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return RestPollingClient; });
  } else {
    global.CortexRestPolling = RestPollingClient;
  }

})(typeof window !== 'undefined' ? window : this);