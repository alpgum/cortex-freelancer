const fs = require('fs');
const path = require('path');
const { cors } = require('./middleware/cors');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const FEEDBACK_FILE = path.join(__dirname, '..', 'data', 'feedback.json');

const VALID_RATINGS = ['up', 'down'];
const MAX_COMMENT_LENGTH = 500;

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { tool, rating, comment, timestamp } = req.body || {};

  if (!tool || typeof tool !== 'string') {
    return sendError(res, 400, 'Tool name is required', 'INVALID_INPUT', 'validation_error');
  }

  if (!VALID_RATINGS.includes(rating)) {
    return sendError(res, 400, 'Rating must be "up" or "down"', 'INVALID_INPUT', 'validation_error');
  }

  const entry = {
    tool: tool.slice(0, 100),
    rating: rating,
    comment: typeof comment === 'string' ? comment.slice(0, MAX_COMMENT_LENGTH) : '',
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };

  /* Read existing feedback or start fresh */
  let feedback = [];
  try {
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf8');
    feedback = JSON.parse(raw);
    if (!Array.isArray(feedback)) feedback = [];
  } catch (e) {
    /* file doesn't exist yet — that's fine */
  }

  feedback.push(entry);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));

  res.json({ success: true, data: { saved: true } });
});
