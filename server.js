const express = require('express');
const path = require('path');
const { setupRoutes } = require('./api/waitlist');
const { setupStripeRoutes } = require('./api/stripe');
const { setupDownloadRoutes } = require('./api/download');
const { rateLimitMiddleware } = require('./api/_middleware/rate-limit');

// Standalone Vercel serverless functions (need explicit mounting for local dev)
const healthHandler = require('./api/health');
const chatHandler = require('./api/chat');
const billingPortalHandler = require('./api/billing-portal');
const portalHandler = require('./api/portal');

const app = express();
const PORT = 3847;

// Stripe webhooks require the raw request body for signature verification.
app.use('/api/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for all API routes
app.use('/api', rateLimitMiddleware);

// API routes (Express-style setup)
setupRoutes(app);
setupStripeRoutes(app);
setupDownloadRoutes(app);

// Standalone serverless function routes (for local dev parity with Vercel)
app.all('/api/health', healthHandler);
app.all('/api/chat', chatHandler);
app.all('/api/billing-portal', billingPortalHandler);
app.all('/api/portal', portalHandler);

// Static files
app.use(express.static(path.join(__dirname), {
  extensions: ['html']
}));

// 404 handler — catch unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

const mockMode = !process.env.STRIPE_SECRET_KEY;
app.listen(PORT, () => {
  console.log(`Cortex Freelancer running at http://localhost:${PORT}`);
  if (mockMode) {
    console.log('  → Stripe MOCK MODE (no STRIPE_SECRET_KEY set)');
    console.log('  → Checkout will auto-create customers without real Stripe');
  }
});
