// Sentry error monitoring — free tier
// Captures unhandled errors and promise rejections
(function () {
  if (typeof Sentry === 'undefined') return;

  Sentry.init({
    dsn: window.SENTRY_DSN || '',
    environment: location.hostname === 'localhost' ? 'development' : 'production',
    sampleRate: 1.0,
    tracesSampleRate: 0,
    autoSessionTracking: false
  });

  window.addEventListener('error', function (event) {
    Sentry.captureException(event.error || event.message);
  });

  window.addEventListener('unhandledrejection', function (event) {
    Sentry.captureException(event.reason);
  });
})();
