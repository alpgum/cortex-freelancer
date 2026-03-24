/**
 * CFX-026: REST API with Polling Server
 * 
 * Simple REST endpoints for chat interactions with polling-based response retrieval.
 * Final fallback in the transport chain: WebSocket → SSE → Long Polling → REST Polling
 * 
 * Endpoints:
 *   POST /api/chat              - Submit message, get request ID
 *   GET  /api/chat/:id          - Poll for status/progress  
 *   GET  /api/chat/:id/result   - Get complete result
 *   DELETE /api/chat/:id        - Cancel request
 */

const express = require('express');
const { randomUUID } = require('crypto');
const path = require('path');
const RateLimiter = require('./rate-limiter');
const QueueManager = require('./queue-manager');

class RestPollingServer {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || 3026;
    this.apiPath = options.apiPath || '/api/chat';
    
    // Dependencies
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.queueManager = new QueueManager(options.queue);
    
    // Request processing
    this.processor = this.initializeProcessor(options);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupCleanup();
  }

  setupMiddleware() {
    // CORS
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-ID');
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Poll-Interval');
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      next();
    });

    // JSON parsing with size limit
    this.app.use(express.json({ 
      limit: '8kb',
      strict: true,
      verify: (req, res, buf) => {
        // Store raw body for future extensions
        req.rawBody = buf;
      }
    }));

    // Request ID tracking
    this.app.use((req, res, next) => {
      req.requestId = req.headers['x-request-id'] || `req_${Date.now()}_${randomUUID().slice(0, 8)}`;
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });
    
    // Basic request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      const originalSend = res.send;
      
      res.send = function(data) {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
        return originalSend.call(this, data);
      };
      
      next();
    });
  }

  setupRoutes() {
    // Submit message
    this.app.post(this.apiPath, async (req, res) => {
      try {
        await this.handleSubmitMessage(req, res);
      } catch (error) {
        console.error('[REST] Submit error:', error);
        res.status(500).json({
          error: 'Internal server error',
          code: 'E500',
          hint: 'Please try again in a moment'
        });
      }
    });

    // Poll for status
    this.app.get(`${this.apiPath}/:id`, async (req, res) => {
      try {
        await this.handlePollStatus(req, res);
      } catch (error) {
        console.error('[REST] Poll error:', error);
        res.status(500).json({
          error: 'Internal server error',
          code: 'E500'
        });
      }
    });

    // Get result
    this.app.get(`${this.apiPath}/:id/result`, async (req, res) => {
      try {
        await this.handleGetResult(req, res);
      } catch (error) {
        console.error('[REST] Result error:', error);
        res.status(500).json({
          error: 'Internal server error',
          code: 'E500'
        });
      }
    });

    // Cancel request
    this.app.delete(`${this.apiPath}/:id`, async (req, res) => {
      try {
        await this.handleCancelRequest(req, res);
      } catch (error) {
        console.error('[REST] Cancel error:', error);
        res.status(500).json({
          error: 'Internal server error',
          code: 'E500'
        });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        queue: this.queueManager.getStats(),
        memory: process.memoryUsage()
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.json({
        queue: this.queueManager.getStats(),
        rateLimiter: this.rateLimiter.getStats(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleSubmitMessage(req, res) {
    // Rate limiting
    const clientKey = this.getClientKey(req);
    const rateLimitResult = this.rateLimiter.checkLimit(clientKey);
    
    if (!rateLimitResult.allowed) {
      res.setHeader('X-Rate-Limit-Reset', rateLimitResult.resetTime);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'E429',
        retryAfter: rateLimitResult.retryAfter,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining
      });
    }

    // Validate request
    const { message, sessionId, profile, goals } = req.body || {};
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required',
        code: 'E400',
        hint: 'Provide a non-empty message string'
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: 'Message too long',
        code: 'E400',
        hint: 'Keep message under 4000 characters'
      });
    }

    // Create request
    const requestId = `req_${Date.now()}_${randomUUID().slice(0, 12)}`;
    const finalSessionId = sessionId || `session_${Date.now()}_${randomUUID().slice(0, 8)}`;
    
    const request = {
      id: requestId,
      sessionId: finalSessionId,
      message: message.trim(),
      profile,
      goals,
      clientKey,
      createdAt: Date.now(),
      status: 'queued'
    };

    // Check queue capacity
    if (!this.queueManager.canAcceptRequest()) {
      return res.status(503).json({
        error: 'Server is busy',
        code: 'E503',
        retryAfter: 30,
        hint: 'Too many concurrent requests. Please try again shortly.'
      });
    }

    // Queue request
    const queueResult = this.queueManager.enqueue(request);
    
    // Start processing if not busy
    this.processQueue();
    
    res.setHeader('X-Poll-Interval', queueResult.pollInterval.toString());
    res.status(201).json({
      requestId,
      sessionId: finalSessionId,
      status: 'queued',
      position: queueResult.position,
      estimatedWaitMs: queueResult.estimatedWaitMs,
      pollInterval: queueResult.pollInterval
    });
  }

  async handlePollStatus(req, res) {
    const requestId = req.params.id;
    const request = this.queueManager.getRequest(requestId);

    if (!request) {
      return res.status(404).json({
        error: 'Request not found or expired',
        code: 'E404',
        hint: 'The request may have expired or been cancelled'
      });
    }

    // Calculate poll interval based on status
    let pollInterval = this.calculatePollInterval(request);
    res.setHeader('X-Poll-Interval', pollInterval.toString());

    const response = {
      requestId,
      status: request.status,
      pollInterval
    };

    switch (request.status) {
      case 'queued':
        const position = this.queueManager.getPosition(requestId);
        response.position = position;
        response.estimatedWaitMs = position * 2000; // Rough estimate
        break;

      case 'processing':
        if (request.startedAt) {
          const elapsed = Date.now() - request.startedAt;
          response.progress = Math.min(elapsed / 30000, 0.95); // Rough progress estimate
          response.estimatedTimeRemaining = Math.max(0, 30000 - elapsed);
        }
        break;

      case 'streaming':
        // For compatibility with streaming clients
        response.progress = request.progress || 0.7;
        break;

      case 'complete':
        response.hasResult = true;
        response.resultLength = request.result?.length || 0;
        if (request.meta) response.meta = request.meta;
        break;

      case 'error':
        response.error = request.error;
        response.code = request.errorCode;
        if (request.retryAfter) response.retryAfter = request.retryAfter;
        break;

      case 'cancelled':
        response.message = 'Request was cancelled';
        break;

      case 'expired':
        response.message = 'Request expired due to timeout';
        break;
    }

    res.json(response);
  }

  async handleGetResult(req, res) {
    const requestId = req.params.id;
    const request = this.queueManager.getRequest(requestId);

    if (!request) {
      return res.status(404).json({
        error: 'Request not found or expired',
        code: 'E404'
      });
    }

    if (request.status !== 'complete') {
      return res.status(409).json({
        error: `Request is ${request.status}, not complete`,
        code: 'E409',
        hint: 'Poll the status endpoint until status is "complete"'
      });
    }

    res.json({
      requestId,
      status: 'complete',
      result: request.result,
      sessionId: request.sessionId,
      meta: request.meta || {},
      completedAt: new Date(request.completedAt).toISOString()
    });
  }

  async handleCancelRequest(req, res) {
    const requestId = req.params.id;
    const result = this.queueManager.cancelRequest(requestId);

    if (!result.found) {
      return res.status(404).json({
        error: 'Request not found or expired',
        code: 'E404'
      });
    }

    res.json({
      requestId,
      status: 'cancelled',
      message: result.message
    });
  }

  calculatePollInterval(request) {
    const baseInterval = 1000; // 1 second
    
    switch (request.status) {
      case 'queued':
        return 2000; // Poll less frequently when waiting
        
      case 'processing':
      case 'streaming':
        // Get faster as we approach typical completion time
        const elapsed = Date.now() - (request.startedAt || request.createdAt);
        if (elapsed < 5000) return 500;  // Fast initially
        if (elapsed < 15000) return 1000; // Medium
        return 2000; // Slower for long requests
        
      case 'complete':
      case 'error':
      case 'cancelled':
      case 'expired':
        return 60000; // Very slow - shouldn't be polling these
        
      default:
        return baseInterval;
    }
  }

  getClientKey(req) {
    // Use forwarded IP or connection IP
    return (req.headers['x-forwarded-for'] || 
            req.headers['x-real-ip'] || 
            req.connection.remoteAddress || 
            'unknown').split(',')[0].trim();
  }

  initializeProcessor(options) {
    // Determine processing mode
    const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.ANTHROPIC_API_KEY);
    
    if (isRailway) {
      // Use Anthropic SDK directly
      return this.createAnthropicProcessor();
    } else {
      // Use OpenClaw CLI
      return this.createCLIProcessor();
    }
  }

  createAnthropicProcessor() {
    let Anthropic;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    } catch (e) {
      throw new Error('Anthropic SDK not available in Railway mode');
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    return {
      async processRequest(request) {
        const prompt = this.buildPrompt(request);
        const systemPrompt = this.getSystemPrompt();

        try {
          const response = await client.messages.create({
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
          });

          return {
            result: response.content[0].text,
            meta: {
              model: response.model,
              usage: response.usage,
              processingTimeMs: Date.now() - request.startedAt
            }
          };
        } catch (error) {
          throw {
            error: this.mapAnthropicError(error),
            code: this.getErrorCode(error),
            retryAfter: this.getRetryAfter(error)
          };
        }
      }
    };
  }

  createCLIProcessor() {
    const { spawn } = require('child_process');

    return {
      async processRequest(request) {
        return new Promise((resolve, reject) => {
          const prompt = this.buildPrompt(request);
          const args = [
            'agent',
            '--message', prompt,
            '--session-id', request.sessionId,
            '--json',
            '--local'
          ];

          const proc = spawn('openclaw', args, {
            env: { ...process.env },
            timeout: 120000
          });

          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          proc.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          proc.on('close', (code) => {
            if (code !== 0 && !stdout.trim()) {
              return reject({
                error: 'Cortex is temporarily unavailable',
                code: 'E503',
                retryAfter: 30
              });
            }

            try {
              // Parse OpenClaw response
              let result = 'No response from Cortex.';
              let meta = {};

              const jsonStart = stdout.indexOf('{');
              if (jsonStart !== -1) {
                const parsed = JSON.parse(stdout.slice(jsonStart));
                const responseText = (parsed.payloads || [])
                  .map(p => p.text)
                  .filter(Boolean)
                  .join('\\n\\n');
                
                result = responseText || result;
                meta = {
                  model: parsed.meta?.agentMeta?.model,
                  processingTimeMs: Date.now() - request.startedAt,
                  durationMs: parsed.meta?.durationMs
                };
              } else {
                result = stdout.trim() || result;
              }

              resolve({ result, meta });
            } catch (e) {
              resolve({
                result: stdout.trim() || 'No response from Cortex.',
                meta: { processingTimeMs: Date.now() - request.startedAt }
              });
            }
          });

          proc.on('error', (error) => {
            reject({
              error: 'Cortex is temporarily unavailable',
              code: 'E503',
              retryAfter: 30
            });
          });

          // Store process for cancellation
          request._process = proc;
        });
      }
    };
  }

  buildPrompt(request) {
    let prompt = '';

    // Add profile context
    if (request.profile && !request.profile._skipped) {
      const lines = ['<user_profile>'];
      if (request.profile.name) lines.push(`Name: ${request.profile.name}`);
      if (request.profile.title) lines.push(`Title: ${request.profile.title}`);
      if (request.profile.hourlyRate) lines.push(`Rate: $${request.profile.hourlyRate}/hr`);
      if (request.profile.skills?.length) lines.push(`Skills: ${request.profile.skills.slice(0, 15).join(', ')}`);
      if (request.profile.jobSuccessScore) lines.push(`JSS: ${request.profile.jobSuccessScore}%`);
      if (request.profile.totalEarnings) lines.push(`Earned: $${request.profile.totalEarnings}`);
      if (request.profile.country) lines.push(`Country: ${request.profile.country}`);
      lines.push('</user_profile>');
      prompt += lines.join('\\n') + '\\n\\n';
    }

    // Add goals context
    if (request.goals) {
      const lines = ['<user_goals>'];
      if (request.goals.incomeGoal) lines.push(`Income goal: $${request.goals.incomeGoal}/mo`);
      if (request.goals.taxCountry) lines.push(`Tax country: ${request.goals.taxCountry}`);
      if (request.goals.workType) lines.push(`Work preference: ${request.goals.workType}`);
      lines.push('</user_goals>');
      prompt += lines.join('\\n') + '\\n\\n';
    }

    // Add the actual message
    const freelancerContext = 'I need help with my freelance business: ';
    prompt += freelancerContext + request.message.substring(0, 4000 - freelancerContext.length);

    return prompt;
  }

  getSystemPrompt() {
    return `You are Cortex, an AI business manager for freelancers. You help freelancers with:
- Rate optimization and pricing strategy
- Proposal writing and job analysis  
- Client communication and red flag detection
- Revenue forecasting and income tracking
- Contract review and negotiation
- Portfolio review and professional branding
- Tax planning and business operations

You are knowledgeable about platforms like Upwork, Fiverr, and direct client work.
Be practical, actionable, and supportive. Give specific advice, not generic platitudes.
Keep responses concise but thorough. Use bullet points and structure when helpful.`;
  }

  mapAnthropicError(error) {
    if (error.status === 529) return 'AI service is busy. Try again shortly.';
    if (error.status === 429) return 'Rate limit reached. Please wait.';
    if (error.status >= 500) return 'AI service temporarily unavailable.';
    return 'An error occurred while processing your request.';
  }

  getErrorCode(error) {
    if (error.status === 429) return 'E429';
    if (error.status === 529) return 'E529';
    if (error.status >= 500) return 'E500';
    return 'E400';
  }

  getRetryAfter(error) {
    if (error.status === 429) return 60;
    if (error.status === 529) return 10;
    if (error.status >= 500) return 30;
    return null;
  }

  async processQueue() {
    // Simple single-threaded processing to avoid concurrency issues
    if (this.processing) return;
    this.processing = true;

    try {
      while (true) {
        const request = this.queueManager.getNextRequest();
        if (!request) break;

        // Mark as processing
        this.queueManager.updateStatus(request.id, 'processing');
        request.startedAt = Date.now();

        try {
          // Process the request
          const result = await this.processor.processRequest(request);
          
          // Mark as complete
          this.queueManager.updateStatus(request.id, 'complete', {
            result: result.result,
            meta: result.meta,
            completedAt: Date.now()
          });
        } catch (error) {
          console.error(`[REST] Processing error for ${request.id}:`, error);
          
          // Mark as error
          this.queueManager.updateStatus(request.id, 'error', {
            error: error.error || 'Processing failed',
            errorCode: error.code || 'E500',
            retryAfter: error.retryAfter
          });
        }
      }
    } finally {
      this.processing = false;
    }
  }

  setupCleanup() {
    // Periodic cleanup
    setInterval(() => {
      this.queueManager.cleanup();
      this.rateLimiter.cleanup();
    }, 60000).unref();

    // Graceful shutdown
    const shutdown = () => {
      console.log('\\n[REST] Shutting down...');
      this.queueManager.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`[REST] Server running on port ${this.port}`);
      console.log(`[REST] API endpoint: ${this.apiPath}`);
      console.log(`[REST] Health check: http://localhost:${this.port}/health`);
    });
  }
}

module.exports = RestPollingServer;