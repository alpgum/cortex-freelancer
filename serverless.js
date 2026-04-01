/**
 * Vercel Serverless Entry Point
 * Lightweight wrapper that safely loads the full Express app.
 * If the main server fails to load, serves a maintenance page.
 */

let app;
let loadError = null;

try {
  app = require('./server');
} catch (err) {
  loadError = err;
  console.error('[serverless] FATAL: server.js failed to load:', err.message);
  console.error(err.stack);
  
  // Create a minimal Express app that serves error info
  const express = require('express');
  app = express();
  
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Service temporarily unavailable. The platform is undergoing maintenance.',
          code: 'SERVICE_UNAVAILABLE',
          type: 'server_error',
          debug: process.env.NODE_ENV !== 'production' ? loadError.message : undefined,
        },
      });
    } else {
      res.status(503).send(`
<!DOCTYPE html>
<html>
<head><title>Cortex Freelancer - Maintenance</title></head>
<body style="font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center;">
  <h1>🔧 Under Maintenance</h1>
  <p>Cortex Freelancer is currently being updated. We'll be back shortly.</p>
  <p style="color: #666; font-size: 0.9em;">Error: ${loadError.message}</p>
</body>
</html>`);
    }
  });
}

module.exports = app;
