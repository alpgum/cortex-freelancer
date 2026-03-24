/**
 * CFX-008: Enhanced WebSocket Reconnection with Browser Compatibility
 * Extends the existing ws-reconnect.js with browser-specific optimizations
 * 
 * This file works alongside ws-reconnect.js to provide browser-specific
 * enhancements and fallbacks for WebSocket connections.
 */
(function () {
  'use strict';

  // Wait for dependencies
  if (!window.CortexWsReconnect || !window.CortexBrowserDetection) {
    setTimeout(function() {
      if (window.CortexWsReconnect && window.CortexBrowserDetection) {
        initBrowserCompatEnhancements();
      }
    }, 1000);
    return;
  }

  initBrowserCompatEnhancements();

  function initBrowserCompatEnhancements() {
    const wsReconnect = window.CortexWsReconnect;
    const browserDetection = window.CortexBrowserDetection;
    
    // Get browser-specific WebSocket settings
    const wsSettings = browserDetection.getWebSocketSettings();
    
    // Browser-specific state tracking
    let safariActivityTimer = null;
    let lastSafariActivity = Date.now();
    let firefoxConnectionCount = 0;
    let chromePerformanceMode = false;

    // Enhanced connection state management
    const originalWsReconnect = { ...wsReconnect };

    // Safari-specific enhancements
    if (browserDetection.isSafari) {
      enhanceForSafari();
    }

    // Firefox-specific enhancements
    if (browserDetection.isFirefox) {
      enhanceForFirefox();
    }

    // Chrome-specific enhancements
    if (browserDetection.isChrome) {
      enhanceForChrome();
    }

    // Mobile-specific enhancements
    if (browserDetection.isMobile) {
      enhanceForMobile();
    }

    function enhanceForSafari() {
      console.log('[ws-compat] Applying Safari WebSocket optimizations');

      // Safari needs more aggressive connection monitoring
      wsReconnect.on('connected', function() {
        lastSafariActivity = Date.now();
        
        // Monitor Safari WebSocket for unusual silence
        if (safariActivityTimer) clearInterval(safariActivityTimer);
        safariActivityTimer = setInterval(function() {
          const timeSinceActivity = Date.now() - lastSafariActivity;
          
          // If no activity for 60 seconds, Safari may have silently closed the connection
          if (timeSinceActivity > 60000) {
            console.warn('[ws-compat] Safari WebSocket appears stale, triggering reconnect');
            if (wsReconnect.isConnected()) {
              // Force a ping to check if connection is really alive
              wsReconnect.send({ type: 'ping' });
              
              // If no pong within 10 seconds, force reconnection
              setTimeout(function() {
                const currentTime = Date.now();
                if (currentTime - lastSafariActivity > 70000) {
                  wsReconnect.resetAndReconnect();
                }
              }, 10000);
            }
          }
        }, 30000);
      });

      // Track activity for Safari
      const originalOn = wsReconnect.on;
      wsReconnect.on = function(event, callback) {
        if (event === 'message') {
          const wrappedCallback = function(data) {
            lastSafariActivity = Date.now();
            return callback(data);
          };
          return originalOn.call(this, event, wrappedCallback);
        }
        return originalOn.call(this, event, callback);
      };

      // Clean up Safari timer on disconnect
      wsReconnect.on('disconnected', function() {
        if (safariActivityTimer) {
          clearInterval(safariActivityTimer);
          safariActivityTimer = null;
        }
      });

      // Safari-specific connection retry logic
      const originalConnect = wsReconnect.connect;
      wsReconnect.connect = function() {
        // Add small delay for Safari
        setTimeout(function() {
          originalConnect.call(wsReconnect);
        }, 200);
      };
    }

    function enhanceForFirefox() {
      console.log('[ws-compat] Applying Firefox WebSocket optimizations');

      // Firefox handles multiple connections better
      firefoxConnectionCount = 0;

      // Track connection attempts for Firefox
      wsReconnect.on('stateChange', function(info) {
        if (info.to === 'connecting') {
          firefoxConnectionCount++;
        } else if (info.to === 'connected') {
          firefoxConnectionCount = 0;
        }

        // Firefox can handle faster reconnections
        if (info.to === 'reconnecting' && firefoxConnectionCount < 3) {
          // Reduce backoff delay for Firefox
          console.log('[ws-compat] Firefox fast reconnect mode');
        }
      });
    }

    function enhanceForChrome() {
      console.log('[ws-compat] Applying Chrome WebSocket optimizations');

      // Chrome performance mode detection
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        chromePerformanceMode = connection.effectiveType === '4g' || 
                               connection.effectiveType === '3g';
        
        // Adjust settings based on connection
        if (chromePerformanceMode) {
          console.log('[ws-compat] Chrome high-performance mode enabled');
        }
      }

      // Chrome-specific memory management
      wsReconnect.on('connected', function() {
        // Chrome handles WebSocket connections very efficiently
        // We can be more aggressive with message throughput
        if (chromePerformanceMode) {
          // Enable batch message sending for Chrome
          window.CortexWsBatchMode = true;
        }
      });
    }

    function enhanceForMobile() {
      console.log('[ws-compat] Applying mobile WebSocket optimizations');

      let visibilityChangeHandler;
      let backgroundTime = null;

      // Handle mobile app backgrounding
      const handleVisibilityChange = function() {
        if (document.hidden) {
          backgroundTime = Date.now();
          console.log('[ws-compat] App backgrounded, connection may be suspended');
        } else {
          if (backgroundTime) {
            const backgroundDuration = Date.now() - backgroundTime;
            console.log('[ws-compat] App foregrounded after', backgroundDuration, 'ms');
            
            // If backgrounded for more than 30 seconds, assume connection is dead
            if (backgroundDuration > 30000) {
              console.log('[ws-compat] Long background period, forcing reconnect');
              wsReconnect.resetAndReconnect();
            } else if (backgroundDuration > 10000) {
              // Send a ping to check connection health
              if (wsReconnect.isConnected()) {
                wsReconnect.send({ type: 'ping' });
              }
            }
          }
          backgroundTime = null;
        }
      };

      // Add visibility change listener
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Mobile-specific network change handling
      if ('connection' in navigator) {
        navigator.connection.addEventListener('change', function() {
          console.log('[ws-compat] Mobile network changed:', navigator.connection.effectiveType);
          
          // If connection improved significantly, reset backoff
          if (navigator.connection.effectiveType === '4g' && wsReconnect.getRetryInfo().attempts > 0) {
            console.log('[ws-compat] Network improved, resetting backoff');
            wsReconnect.resetAndReconnect();
          }
        });
      }

      // Clean up mobile listeners
      wsReconnect.on('disconnected', function() {
        if (visibilityChangeHandler) {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      });
    }

    // Connection quality monitoring
    function monitorConnectionQuality() {
      let pingTimes = [];
      let lastPingTime = 0;

      wsReconnect.on('message', function(data) {
        if (data.type === 'pong' && lastPingTime) {
          const roundTripTime = Date.now() - lastPingTime;
          pingTimes.push(roundTripTime);
          
          // Keep only last 10 ping times
          if (pingTimes.length > 10) {
            pingTimes.shift();
          }

          // Calculate average ping time
          const avgPing = pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length;
          
          // Update connection quality indicator
          updateConnectionQuality(avgPing);
        }
      });

      // Send periodic pings for quality monitoring
      wsReconnect.on('connected', function() {
        const qualityCheck = setInterval(function() {
          if (!wsReconnect.isConnected()) {
            clearInterval(qualityCheck);
            return;
          }
          
          lastPingTime = Date.now();
          wsReconnect.send({ type: 'ping' });
        }, 30000);

        wsReconnect.on('disconnected', function() {
          clearInterval(qualityCheck);
        });
      });
    }

    function updateConnectionQuality(pingTime) {
      let quality = 'excellent';
      let qualityClass = 'ws-quality-excellent';

      if (pingTime > 1000) {
        quality = 'poor';
        qualityClass = 'ws-quality-poor';
      } else if (pingTime > 500) {
        quality = 'fair';
        qualityClass = 'ws-quality-fair';
      } else if (pingTime > 200) {
        quality = 'good';
        qualityClass = 'ws-quality-good';
      }

      // Update UI if quality indicator exists
      const qualityEl = document.querySelector('.ws-quality-indicator');
      if (qualityEl) {
        qualityEl.className = 'ws-quality-indicator ' + qualityClass;
        qualityEl.textContent = quality;
        qualityEl.title = `WebSocket latency: ${pingTime}ms`;
      }
    }

    // Browser-specific error handling
    const originalSend = wsReconnect.send;
    wsReconnect.send = function(data) {
      try {
        return originalSend.call(this, data);
      } catch (error) {
        // Browser-specific error handling
        if (browserDetection.isSafari && error.message.includes('not in the OPEN state')) {
          console.warn('[ws-compat] Safari WebSocket not ready, queueing message');
          return false; // This will queue the message
        }
        
        if (browserDetection.isFirefox && error.name === 'InvalidStateError') {
          console.warn('[ws-compat] Firefox WebSocket invalid state, triggering reconnect');
          this.resetAndReconnect();
          return false;
        }

        // Re-throw other errors
        throw error;
      }
    };

    // Initialize connection quality monitoring
    monitorConnectionQuality();

    // Add browser compatibility info to debug output
    wsReconnect.getBrowserInfo = function() {
      return {
        browser: browserDetection.isChrome ? 'Chrome' : 
                browserDetection.isSafari ? 'Safari' :
                browserDetection.isFirefox ? 'Firefox' : 'Other',
        mobile: browserDetection.isMobile,
        capabilities: browserDetection.getWebSocketCapabilities(),
        settings: wsSettings
      };
    };

    console.log('[ws-compat] Browser compatibility enhancements loaded');
  }

  // Export for debugging
  window.CortexWsBrowserCompat = {
    version: '1.0.0',
    initialized: true
  };
})();