/**
 * CFX-008: Browser Detection & Capability Detection
 * Provides browser-specific feature detection and compatibility utilities
 */
(function () {
  'use strict';

  // Browser detection
  const userAgent = navigator.userAgent;
  const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
  const isSafari = /Safari/.test(userAgent) && /Apple Computer/.test(navigator.vendor);
  const isFirefox = /Firefox/.test(userAgent);
  const isEdge = /Edge/.test(userAgent);
  const isMobile = /Mobi|Android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  // WebSocket capability detection
  function getWebSocketCapabilities() {
    const caps = {
      supported: typeof WebSocket !== 'undefined',
      maxConnections: 10,
      heartbeatInterval: 20000,
      reconnectDelay: 1000,
      needsExtraHeartbeat: false,
      supportsBinaryType: false,
      supportsExtensions: false
    };

    if (!caps.supported) {
      return caps;
    }

    // Test WebSocket features
    try {
      const testWs = new WebSocket('ws://localhost:1234'); // Dummy URL
      caps.supportsBinaryType = typeof testWs.binaryType !== 'undefined';
      caps.supportsExtensions = typeof testWs.extensions !== 'undefined';
      testWs.close();
    } catch (e) {
      // Expected to fail, we're just testing API availability
    }

    // Browser-specific adjustments
    if (isSafari) {
      caps.maxConnections = 6; // Safari has stricter limits
      caps.heartbeatInterval = 25000; // Safari needs longer intervals
      caps.reconnectDelay = 2000; // Safari needs more time between reconnects
      caps.needsExtraHeartbeat = true; // Safari has aggressive connection pruning
    } else if (isFirefox) {
      caps.maxConnections = 12; // Firefox handles more connections well
      caps.heartbeatInterval = 18000; // Firefox can handle faster heartbeats
      caps.reconnectDelay = 800;
    } else if (isMobile) {
      caps.heartbeatInterval = 30000; // Mobile browsers need longer intervals
      caps.reconnectDelay = 3000; // Mobile networks need more time
    }

    return caps;
  }

  // CSS feature detection
  function getCSSCapabilities() {
    const testEl = document.createElement('div');
    
    return {
      customProperties: CSS.supports('color', 'var(--test)'),
      grid: CSS.supports('display', 'grid'),
      flexbox: CSS.supports('display', 'flex'),
      transforms: CSS.supports('transform', 'translateX(0)'),
      animations: CSS.supports('animation-name', 'test'),
      backdropFilter: CSS.supports('backdrop-filter', 'blur(1px)') || 
                     CSS.supports('-webkit-backdrop-filter', 'blur(1px)'),
      objectFit: CSS.supports('object-fit', 'cover')
    };
  }

  // API availability detection
  function getAPICapabilities() {
    return {
      fetch: typeof fetch !== 'undefined',
      eventSource: typeof EventSource !== 'undefined',
      webWorker: typeof Worker !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator,
      localStorage: (function() {
        try {
          const test = 'browserDetectionTest';
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
        } catch (e) {
          return false;
        }
      })(),
      sessionStorage: (function() {
        try {
          const test = 'browserDetectionTest';
          sessionStorage.setItem(test, test);
          sessionStorage.removeItem(test);
          return true;
        } catch (e) {
          return false;
        }
      })(),
      indexedDB: typeof indexedDB !== 'undefined',
      notifications: 'Notification' in window,
      geolocation: 'geolocation' in navigator,
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      clipboard: 'clipboard' in navigator
    };
  }

  // Performance capabilities
  function getPerformanceCapabilities() {
    return {
      requestAnimationFrame: typeof requestAnimationFrame !== 'undefined',
      intersectionObserver: typeof IntersectionObserver !== 'undefined',
      resizeObserver: typeof ResizeObserver !== 'undefined',
      mutationObserver: typeof MutationObserver !== 'undefined',
      performanceObserver: typeof PerformanceObserver !== 'undefined',
      webGL: (function() {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
          return false;
        }
      })()
    };
  }

  // Connection type detection (for WebSocket optimization)
  function getConnectionType() {
    if ('connection' in navigator) {
      return navigator.connection.effectiveType || 'unknown';
    }
    if ('mozConnection' in navigator) {
      return navigator.mozConnection.type || 'unknown';
    }
    if ('webkitConnection' in navigator) {
      return navigator.webkitConnection.type || 'unknown';
    }
    return 'unknown';
  }

  // Get optimized WebSocket settings based on browser and connection
  function getWebSocketSettings() {
    const caps = getWebSocketCapabilities();
    const connectionType = getConnectionType();
    
    const settings = {
      heartbeatInterval: caps.heartbeatInterval,
      maxRetries: 10,
      backoffMultiplier: 2,
      maxBackoffDelay: 30000,
      initialBackoffDelay: caps.reconnectDelay,
      messageQueueSize: 50
    };

    // Adjust for connection type
    if (connectionType === 'slow-2g' || connectionType === '2g') {
      settings.heartbeatInterval *= 2;
      settings.maxRetries = 15;
      settings.initialBackoffDelay *= 3;
    } else if (connectionType === '3g') {
      settings.heartbeatInterval = Math.max(settings.heartbeatInterval, 25000);
      settings.maxRetries = 12;
    }

    // Safari-specific adjustments
    if (isSafari) {
      settings.maxRetries = 15; // Safari needs more retry attempts
      settings.messageQueueSize = 30; // Smaller queue for Safari
    }

    return settings;
  }

  // Apply browser-specific optimizations
  function applyBrowserOptimizations() {
    // Safari-specific CSS fixes
    if (isSafari) {
      document.documentElement.classList.add('safari');
    }
    
    // Mobile-specific optimizations
    if (isMobile) {
      document.documentElement.classList.add('mobile');
      // Disable hover effects on mobile
      document.documentElement.classList.add('no-hover');
    }
    
    // iOS-specific fixes
    if (isIOS) {
      document.documentElement.classList.add('ios');
      // Fix iOS viewport height issues
      const setViewportHeight = () => {
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
      };
      setViewportHeight();
      window.addEventListener('resize', setViewportHeight);
    }

    // Chrome-specific optimizations
    if (isChrome) {
      document.documentElement.classList.add('chrome');
    }

    // Firefox-specific optimizations  
    if (isFirefox) {
      document.documentElement.classList.add('firefox');
    }
  }

  // Initialize browser detection
  function init() {
    // Apply optimizations immediately
    applyBrowserOptimizations();

    // Log capabilities for debugging (dev mode only)
    if (window.location.search.includes('debug=1')) {
      console.group('Browser Capabilities');
      console.log('User Agent:', userAgent);
      console.log('WebSocket:', getWebSocketCapabilities());
      console.log('CSS:', getCSSCapabilities());
      console.log('APIs:', getAPICapabilities());
      console.log('Performance:', getPerformanceCapabilities());
      console.log('Connection:', getConnectionType());
      console.groupEnd();
    }
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export API
  window.CortexBrowserDetection = {
    // Browser flags
    isChrome,
    isSafari,
    isFirefox,
    isEdge,
    isMobile,
    isIOS,

    // Capability detection
    getWebSocketCapabilities,
    getCSSCapabilities,
    getAPICapabilities,
    getPerformanceCapabilities,
    getConnectionType,
    getWebSocketSettings,

    // Utilities
    init
  };
})();