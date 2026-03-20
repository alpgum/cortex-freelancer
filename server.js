const express = require('express');
const path = require('path');
const { setupRoutes } = require('./api/waitlist');
const { setupStripeRoutes } = require('./api/stripe');
const { setupDownloadRoutes } = require('./api/download');
const { rateLimitMiddleware } = require('./api/_middleware/rate-limit');

const app = express();
const PORT = 3847;

// Stripe webhooks require the raw request body for signature verification.
app.use('/api/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for all API routes
app.use('/api', rateLimitMiddleware);

// API routes
setupRoutes(app);
setupStripeRoutes(app);
setupDownloadRoutes(app);

// Static files
app.use(express.static(path.join(__dirname), {
  extensions: ['html']
}));

const mockMode = !process.env.STRIPE_SECRET_KEY;
app.listen(PORT, () => {
  console.log(`Cortex Freelancer running at http://localhost:${PORT}`);
  if (mockMode) {
    console.log('  → Stripe MOCK MODE (no STRIPE_SECRET_KEY set)');
    console.log('  → Checkout will auto-create customers without real Stripe');
  }
});
