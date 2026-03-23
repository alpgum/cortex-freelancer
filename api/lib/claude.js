/**
 * Reusable Claude API client
 * Reads ANTHROPIC_API_KEY from env, handles retries, timeouts, JSON parsing
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1500;
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function getApiKey() {
  return process.env.ANTHROPIC_API_KEY || null;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a message to Claude and return parsed JSON response
 * @param {string} systemPrompt - System instruction
 * @param {string} userMessage - User message content
 * @param {object} [options] - Override model, maxTokens, timeout
 * @returns {Promise<object>} Parsed JSON from Claude's response
 */
async function askClaude(systemPrompt, userMessage, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ClaudeError('ANTHROPIC_API_KEY not configured', 'NO_API_KEY');
  }

  const model = options.model || MODEL;
  const maxTokens = options.maxTokens || MAX_TOKENS;
  const timeoutMs = options.timeout || TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      const jitter = Math.random() * backoff * 0.3;
      await sleep(backoff + jitter);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Rate limited — retry
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        if (retryAfter && attempt < maxRetries) {
          await sleep(parseInt(retryAfter, 10) * 1000 || INITIAL_BACKOFF_MS * 2);
        }
        lastError = new ClaudeError('Rate limited by Anthropic API', 'RATE_LIMITED', 429);
        continue;
      }

      // Server error — retry
      if (res.status >= 500 && attempt < maxRetries) {
        lastError = new ClaudeError(`Anthropic API error: ${res.status}`, 'API_ERROR', res.status);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ClaudeError(
          `Anthropic API returned ${res.status}: ${body.slice(0, 200)}`,
          'API_ERROR',
          res.status
        );
      }

      const data = await res.json();
      const text = data.content?.[0]?.text;

      if (!text) {
        throw new ClaudeError('Empty response from Claude', 'EMPTY_RESPONSE');
      }

      // Extract JSON from response (handle markdown code blocks)
      return parseJsonResponse(text);
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof ClaudeError) {
        lastError = err;
        if (err.statusCode && err.statusCode < 500 && err.statusCode !== 429) {
          throw err; // Don't retry client errors
        }
        continue;
      }

      if (err.name === 'AbortError') {
        lastError = new ClaudeError('Request timed out', 'TIMEOUT');
        if (attempt < maxRetries) continue;
        throw lastError;
      }

      throw new ClaudeError(`Network error: ${err.message}`, 'NETWORK_ERROR');
    }
  }

  throw lastError || new ClaudeError('Max retries exceeded', 'MAX_RETRIES');
}

/**
 * Extract and parse JSON from Claude's text response
 */
function parseJsonResponse(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // Try extracting from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { /* continue */ }
  }

  // Try finding first { ... } block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch { /* continue */ }
  }

  throw new ClaudeError('Could not parse JSON from Claude response', 'PARSE_ERROR');
}

/**
 * Custom error class for Claude API errors
 */
class ClaudeError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'ClaudeError';
    this.code = code;
    this.statusCode = statusCode || null;
  }
}

module.exports = { askClaude, getApiKey, ClaudeError, parseJsonResponse };
