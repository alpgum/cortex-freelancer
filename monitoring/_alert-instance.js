/**
 * CFX-020: Singleton AlertManager instance
 * Shared across the app. Configure via environment variables.
 */
'use strict';

const AlertManager = require('./alert-manager');

const alertManager = new AlertManager({
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  emailWebhookUrl: process.env.ALERT_EMAIL_WEBHOOK_URL,
  cooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS) || 5 * 60 * 1000,
  enabled: process.env.ALERTS_ENABLED !== 'false',
});

module.exports = alertManager;
